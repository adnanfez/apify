/**
 * Glassdoor Job Finder Agent - Main Entry Point
 *
 * This Apify actor scrapes Glassdoor for job listings that match your CV
 * and rates each job from 0/10 to 10/10 based on how well it matches
 * your skills and experience.
 *
 * Input:
 *   - cvText: Your CV/resume text (required)
 *   - searchKeywords: Additional search keywords (optional)
 *   - location: Job location to search in (optional)
 *   - maxJobs: Maximum number of jobs to fetch (default: 50)
 *   - withinLastMonth: Filter to jobs posted within 30 days (default: true)
 *   - minMatchScore: Minimum match score 0-10 to include (default: 0)
 *
 * Output:
 *   - Dataset of rated job listings, sorted by match score (highest first)
 */

import { Actor, log } from 'apify';
import { parseCv } from './cv-parser.js';
import { rateJobMatch, getMatchLabel } from './job-rater.js';
import { scrapeGlassdoorJobs, isWithinLastMonth } from './scraper.js';

await Actor.init();

try {
    // Load and validate input
    const input = await Actor.getInput();

    if (!input?.cvText) {
        throw new Error('Input validation failed: "cvText" is required. Please provide your CV text.');
    }

    const {
        cvText,
        searchKeywords = '',
        location = '',
        maxJobs = 50,
        withinLastMonth = true,
        minMatchScore = 0,
    } = input;

    log.info('🚀 Glassdoor Job Finder Agent starting...');
    log.info(`Settings: maxJobs=${maxJobs}, withinLastMonth=${withinLastMonth}, minMatchScore=${minMatchScore}`);

    // Step 1: Parse CV
    log.info('📄 Parsing CV...');
    const cvProfile = parseCv(cvText);
    log.info(`Extracted ${cvProfile.skills.length} skills and ${cvProfile.jobTitles.length} job titles from CV`);
    log.info(`Detected skills: ${cvProfile.skills.slice(0, 10).join(', ')}`);
    if (cvProfile.jobTitles.length > 0) {
        log.info(`Detected job titles: ${cvProfile.jobTitles.join(', ')}`);
    }
    if (cvProfile.yearsOfExperience > 0) {
        log.info(`Detected experience: ${cvProfile.yearsOfExperience} years`);
    }

    // Step 2: Determine search keywords
    const effectiveKeywords = searchKeywords.trim() || cvProfile.searchKeywords.join(' ');
    log.info(`🔍 Searching Glassdoor with keywords: "${effectiveKeywords}", location: "${location || 'any'}"`);

    // Step 3: Scrape Glassdoor
    log.info('🌐 Scraping Glassdoor job listings...');
    let jobs = [];
    try {
        jobs = await scrapeGlassdoorJobs({
            keywords: effectiveKeywords,
            location,
            maxJobs,
        });
        log.info(`Found ${jobs.length} job listings on Glassdoor`);
    } catch (err) {
        log.error(`Failed to scrape Glassdoor: ${err.message}`);
        // Continue with empty list to avoid complete failure
    }

    // Step 4: Apply date filter (within last month)
    let filteredJobs = jobs;
    if (withinLastMonth && jobs.length > 0) {
        const recentJobs = jobs.filter((job) => isWithinLastMonth(job.datePosted));
        log.info(`Jobs posted within last 30 days: ${recentJobs.length}`);

        // Fall back to all jobs if fewer than 5 recent ones
        if (recentJobs.length < 5) {
            log.info('Fewer than 5 recent jobs found — showing all available jobs as fallback');
            filteredJobs = jobs;
        } else {
            filteredJobs = recentJobs;
        }
    }

    // Step 5: Rate each job
    log.info('⭐ Rating jobs against your CV...');
    const ratedJobs = filteredJobs.map((job) => {
        const rating = rateJobMatch(job, cvProfile);
        return {
            ...job,
            matchScore: rating.score,
            matchLabel: getMatchLabel(rating.score),
            matchBreakdown: rating.breakdown,
            matchedSkills: rating.matchedSkills,
        };
    });

    // Step 6: Sort by match score (highest first)
    ratedJobs.sort((a, b) => b.matchScore - a.matchScore);

    // Step 7: Apply minimum score filter
    const outputJobs = ratedJobs.filter((job) => job.matchScore >= minMatchScore);
    log.info(`Jobs after minimum score filter (≥${minMatchScore}): ${outputJobs.length}`);

    // Step 8: Save results to dataset
    if (outputJobs.length === 0) {
        log.warning('No jobs matched the criteria. Try lowering minMatchScore or broadening your search keywords.');
    }

    for (const job of outputJobs) {
        await Actor.pushData({
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            datePosted: job.datePosted,
            companyRating: job.companyRating,
            url: job.url,
            matchScore: `${job.matchScore}/10`,
            matchLabel: job.matchLabel,
            matchedSkills: job.matchedSkills,
            matchBreakdown: job.matchBreakdown,
            description: job.description,
        });
    }

    log.info(`✅ Done! Saved ${outputJobs.length} rated job listings to dataset.`);
    if (outputJobs.length > 0) {
        log.info(`Top match: "${outputJobs[0].title}" at ${outputJobs[0].company} — Score: ${outputJobs[0].matchScore}/10`);
    }
} catch (err) {
    log.error(`Actor failed: ${err.message}`);
    throw err;
} finally {
    await Actor.exit();
}
