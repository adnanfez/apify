/**
 * Glassdoor job scraper.
 *
 * Uses Crawlee's PlaywrightCrawler to:
 *  1. Search Glassdoor for jobs matching a keyword and location.
 *  2. Follow pagination up to `maxJobs` total listings.
 *  3. Visit each job-detail page to grab the full description.
 *  4. Apply a date-posted filter (daysBack); if too few results, fall back to
 *     a wider window.
 */

import { PlaywrightCrawler, RequestQueue, Log } from 'crawlee';

const log = new Log({ prefix: 'GlassdoorScraper' });

/** Timeouts (ms) for waiting on page selectors. */
const SEARCH_PAGE_TIMEOUT_MS = 20_000;
const JOB_DETAIL_TIMEOUT_MS = 15_000;

/**
 * Build the Glassdoor job-search URL.
 *
 * @param {string} keyword   - Search keyword / job title
 * @param {string} location  - Location string
 * @param {number} fromAge   - Number of days back (0 = any time)
 * @param {number} page      - Page index (0-based)
 * @returns {string}
 */
export function buildSearchUrl(keyword, location, fromAge, page = 0) {
    const base = 'https://www.glassdoor.com/Job/jobs.htm';
    const params = new URLSearchParams({
        'sc.keyword': keyword,
        locT: 'N',
        locId: '1',
        ...(location && location.toLowerCase() !== 'united states'
            ? { locKeyword: location }
            : {}),
        ...(fromAge > 0 ? { fromAge: String(fromAge) } : {}),
        ...(page > 0 ? { p: String(page + 1) } : {}),
    });
    return `${base}?${params.toString()}`;
}

/**
 * Parse all job cards visible on a Glassdoor search results page.
 * Returns an array of partial job objects (without full description).
 *
 * This function is serialised and injected into the browser context via
 * Playwright's `page.evaluate`, so it must not reference any outer scope.
 *
 * @returns {Array<Object>}
 */
function parseJobCards() {
    const cards = Array.from(
        document.querySelectorAll(
            'li[data-test="jobListing"], .JobsList_jobListItem__JBBUV, li.react-job-listing',
        ),
    );

    return cards.map((card) => {
        const titleEl =
            card.querySelector('[data-test="job-title"]') ||
            card.querySelector('.job-title') ||
            card.querySelector('[class*="JobCard_seoLink"]') ||
            card.querySelector('a[class*="jobTitle"]');

        const companyEl =
            card.querySelector('[data-test="employer-name"]') ||
            card.querySelector('[class*="EmployerProfile_compactEmployerName"]') ||
            card.querySelector('[class*="jobCard-employerName"]');

        const locationEl =
            card.querySelector('[data-test="emp-location"]') ||
            card.querySelector('[class*="JobCard_location"]') ||
            card.querySelector('[class*="location"]');

        const ageEl =
            card.querySelector('[data-test="job-age"]') ||
            card.querySelector('[class*="listing-age"]') ||
            card.querySelector('[class*="JobCard_listingAge"]') ||
            card.querySelector('time');

        const salaryEl =
            card.querySelector('[data-test="detailSalary"]') ||
            card.querySelector('[class*="JobCard_salaryEstimate"]') ||
            card.querySelector('[class*="salary"]');

        const linkEl = titleEl?.closest('a') || card.querySelector('a[href*="/job-listing/"]');

        return {
            title: titleEl?.textContent?.trim() ?? '',
            company: companyEl?.textContent?.trim() ?? '',
            location: locationEl?.textContent?.trim() ?? '',
            postedAge: ageEl?.textContent?.trim() ?? '',
            salary: salaryEl?.textContent?.trim() ?? '',
            url: linkEl?.href ?? '',
        };
    });
}

/**
 * Parse the full job description from a Glassdoor job-detail page.
 *
 * @returns {string}
 */
function parseJobDescription() {
    const descEl =
        document.querySelector('[class*="JobDetails_jobDescription"]') ||
        document.querySelector('[data-test="jobDescriptionContent"]') ||
        document.querySelector('[class*="jobDescriptionContent"]') ||
        document.querySelector('.desc');

    return descEl?.innerText?.trim() ?? '';
}

/**
 * Scrape Glassdoor for job listings.
 *
 * @param {Object} options
 * @param {string}  options.keyword           - Job title / keywords
 * @param {string}  options.location          - Location
 * @param {number}  options.maxJobs           - Maximum jobs to return
 * @param {number}  options.daysBack          - Preferred days-back window
 * @param {Object}  [options.proxyConfig]     - Apify proxy configuration object
 * @returns {Promise<Array<Object>>}
 */
export async function scrapeGlassdoorJobs({
    keyword,
    location,
    maxJobs,
    daysBack,
    proxyConfig,
}) {
    const jobs = [];
    const seenUrls = new Set();

    /**
     * Run a single crawl pass for the given `fromAge` filter.
     * @param {number} fromAge
     * @returns {Promise<void>}
     */
    async function runCrawl(fromAge) {
        const requestQueue = await RequestQueue.open();

        const startUrl = buildSearchUrl(keyword, location, fromAge);
        await requestQueue.addRequest({ url: startUrl, label: 'SEARCH', userData: { fromAge, page: 0 } });

        const crawler = new PlaywrightCrawler({
            requestQueue,
            proxyConfiguration: proxyConfig ?? undefined,
            maxRequestRetries: 3,
            navigationTimeoutSecs: 60,
            requestHandlerTimeoutSecs: 120,
            launchContext: {
                launchOptions: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            },

            async requestHandler({ request, page, enqueueLinks, log: crawlLog }) {
                const { label, userData } = request;

                if (label === 'SEARCH') {
                    crawlLog.info(`Scraping search page: ${request.url}`);

                    // Wait for job cards to appear; tolerate pages with no results.
                    try {
                        await page.waitForSelector(
                            'li[data-test="jobListing"], .JobsList_jobListItem__JBBUV, li.react-job-listing',
                            { timeout: SEARCH_PAGE_TIMEOUT_MS },
                        );
                    } catch {
                        crawlLog.warning('No job cards found on search page, might be a captcha or empty results.');
                        return;
                    }

                    const cards = await page.evaluate(parseJobCards);

                    for (const card of cards) {
                        if (jobs.length >= maxJobs) break;
                        if (!card.url || seenUrls.has(card.url)) continue;

                        seenUrls.add(card.url);
                        jobs.push({ ...card, description: '' });

                        // Enqueue the job-detail page.
                        await requestQueue.addRequest({
                            url: card.url,
                            label: 'JOB',
                            userData: { jobIndex: jobs.length - 1 },
                        });
                    }

                    // Enqueue next search page if we still need more jobs.
                    if (jobs.length < maxJobs && cards.length > 0) {
                        const nextPage = (userData.page ?? 0) + 1;
                        const nextUrl = buildSearchUrl(keyword, location, fromAge, nextPage);
                        if (!seenUrls.has(nextUrl)) {
                            seenUrls.add(nextUrl);
                            await requestQueue.addRequest({
                                url: nextUrl,
                                label: 'SEARCH',
                                userData: { fromAge, page: nextPage },
                            });
                        }
                    }
                } else if (label === 'JOB') {
                    crawlLog.info(`Scraping job detail: ${request.url}`);

                    try {
                        await page.waitForSelector(
                            '[class*="JobDetails_jobDescription"], [data-test="jobDescriptionContent"], .desc',
                            { timeout: JOB_DETAIL_TIMEOUT_MS },
                        );
                    } catch {
                        crawlLog.warning(`Could not load job description for: ${request.url}`);
                        return;
                    }

                    const description = await page.evaluate(parseJobDescription);
                    const { jobIndex } = userData;
                    if (jobs[jobIndex] !== undefined) {
                        jobs[jobIndex].description = description;
                    }
                }
            },

            failedRequestHandler({ request, error }) {
                log.error(`Request ${request.url} failed: ${error.message}`);
            },
        });

        await crawler.run();
    }

    // First pass: use the preferred daysBack window.
    await runCrawl(daysBack);

    // If we got very few results, retry with a wider window (no date limit).
    const MIN_JOBS_THRESHOLD = 5;
    if (jobs.length < MIN_JOBS_THRESHOLD) {
        log.info(
            `Only ${jobs.length} jobs found within ${daysBack} days. ` +
            `Retrying with no date filter to broaden results.`,
        );
        await runCrawl(0);
    }

    return jobs.slice(0, maxJobs);
}
