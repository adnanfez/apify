/**
 * Glassdoor Job Finder Agent – main entry point.
 *
 * This Apify actor:
 *  1. Reads the actor input (CV, search parameters, OpenAI key).
 *  2. Determines the best job-title keyword (from input or derived from CV).
 *  3. Scrapes Glassdoor for matching job listings (preferring the last 30 days).
 *  4. Uses OpenAI to rate each listing against the CV (score 0–10).
 *  5. Saves results, sorted by score descending, to the default dataset.
 */

import { Actor, log } from 'apify';
import { scrapeGlassdoorJobs } from './scraper.js';
import { extractJobTitleFromCV, matchJobWithCV } from './matcher.js';

Actor.main(async () => {
    const input = await Actor.getInput();

    if (!input) {
        throw new Error('No input provided. Please configure the actor with a CV and OpenAI API key.');
    }

    const {
        cvText,
        jobTitle,
        location = 'United States',
        maxJobs = 20,
        daysBack = 30,
        minMatchScore = 0,
        openAiApiKey,
        proxyConfiguration: proxyConfigInput,
    } = input;

    if (!cvText || cvText.trim().length < 50) {
        throw new Error('cvText is required and must be at least 50 characters.');
    }
    if (!openAiApiKey) {
        throw new Error('openAiApiKey is required to rate job listings.');
    }

    // ── 1. Resolve the search keyword ──────────────────────────────────────
    let keyword = jobTitle?.trim();
    if (!keyword) {
        log.info('No job title provided; extracting from CV via AI…');
        keyword = await extractJobTitleFromCV(cvText, openAiApiKey);
        log.info(`Extracted job title: "${keyword}"`);
    }

    // ── 2. Build Apify proxy configuration ─────────────────────────────────
    const proxyConfig = proxyConfigInput
        ? await Actor.createProxyConfiguration(proxyConfigInput)
        : null;

    // ── 3. Scrape Glassdoor ─────────────────────────────────────────────────
    log.info(`Searching Glassdoor for "${keyword}" in "${location}" (last ${daysBack} days, max ${maxJobs} jobs)…`);

    const jobs = await scrapeGlassdoorJobs({
        keyword,
        location,
        maxJobs,
        daysBack,
        proxyConfig,
    });

    log.info(`Found ${jobs.length} job listing(s). Starting CV matching…`);

    if (jobs.length === 0) {
        log.warning('No jobs found. The search returned no results; try different keywords or location.');
        return;
    }

    // ── 4. Rate each job against the CV ────────────────────────────────────
    const results = [];

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        log.info(`Rating job ${i + 1}/${jobs.length}: "${job.title}" at "${job.company}"…`);

        let matchResult;
        try {
            matchResult = await matchJobWithCV(job, cvText, openAiApiKey);
        } catch (err) {
            log.error(`Failed to rate job "${job.title}": ${err.message}`);
            matchResult = { score: 0, reasoning: 'Rating failed.', keyMatches: [], gaps: [] };
        }

        const result = {
            // Job information
            title: job.title,
            company: job.company,
            location: job.location,
            postedAge: job.postedAge,
            salary: job.salary,
            url: job.url,
            // AI match rating
            matchScore: matchResult.score,
            matchRating: `${matchResult.score}/10`,
            reasoning: matchResult.reasoning,
            keyMatches: matchResult.keyMatches,
            gaps: matchResult.gaps,
        };

        if (result.matchScore >= minMatchScore) {
            results.push(result);
        }
    }

    // ── 5. Sort by match score (best first) and save ────────────────────────
    results.sort((a, b) => b.matchScore - a.matchScore);

    log.info(`Saving ${results.length} rated job(s) to dataset…`);
    await Actor.pushData(results);

    // Surface a quick summary in the log.
    const top = results.slice(0, 5);
    log.info('─── Top matches ───────────────────────────────────');
    for (const r of top) {
        log.info(`  ${r.matchRating}  ${r.title} @ ${r.company} (${r.location})`);
    }
    log.info('───────────────────────────────────────────────────');
    log.info(`Done! ${results.length} job(s) saved.`);
});
