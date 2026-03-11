/**
 * Glassdoor Scraper - Scrapes job listings from Glassdoor using Crawlee/Playwright.
 *
 * Glassdoor has strong anti-bot protections, so this scraper uses:
 * - Playwright with stealth mode via Crawlee's PlaywrightCrawler
 * - Apify residential proxies for IP rotation
 * - Human-like delays and interaction patterns
 */

import { PlaywrightCrawler, RequestQueue, sleep } from 'crawlee';
import { Actor } from 'apify';

const GLASSDOOR_BASE_URL = 'https://www.glassdoor.com';
const JOBS_SEARCH_URL = `${GLASSDOOR_BASE_URL}/Job/jobs.htm`;

/**
 * Builds the Glassdoor job search URL.
 * @param {string} keywords - Search keywords
 * @param {string} location - Job location
 * @returns {string} Search URL
 */
export function buildSearchUrl(keywords, location) {
    const params = new URLSearchParams();
    if (keywords) params.set('sc.keyword', keywords);
    if (location) params.set('locT', 'C');
    if (location) params.set('locName', location);
    params.set('fromAge', '30'); // Posted within last 30 days
    return `${JOBS_SEARCH_URL}?${params.toString()}`;
}

/**
 * Parses the date posted string from Glassdoor into a JavaScript Date.
 * @param {string} dateStr - e.g. "30d", "2d", "Just now", "1h"
 * @returns {Date|null} Parsed date or null
 */
export function parseDatePosted(dateStr) {
    if (!dateStr) return null;
    const now = new Date();

    const justNow = /just now|today|< 1 day/i.test(dateStr);
    if (justNow) return now;

    const hoursMatch = dateStr.match(/(\d+)\s*h/i);
    if (hoursMatch) {
        const result = new Date(now);
        result.setHours(result.getHours() - parseInt(hoursMatch[1], 10));
        return result;
    }

    const daysMatch = dateStr.match(/(\d+)\s*d/i);
    if (daysMatch) {
        const result = new Date(now);
        result.setDate(result.getDate() - parseInt(daysMatch[1], 10));
        return result;
    }

    const monthMatch = dateStr.match(/(\d+)\s*mo/i);
    if (monthMatch) {
        const result = new Date(now);
        result.setMonth(result.getMonth() - parseInt(monthMatch[1], 10));
        return result;
    }

    return null;
}

/**
 * Checks whether a job was posted within the last 30 days.
 * @param {string} datePostedStr - Raw date string from Glassdoor
 * @returns {boolean}
 */
export function isWithinLastMonth(datePostedStr) {
    const date = parseDatePosted(datePostedStr);
    if (!date) return false;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= thirtyDaysAgo;
}

/**
 * Scrapes Glassdoor job listings for the given search query.
 * @param {object} options
 * @param {string} options.keywords - Search keywords
 * @param {string} options.location - Job location
 * @param {number} options.maxJobs - Maximum number of jobs to scrape
 * @param {boolean} options.proxyEnabled - Whether to use Apify proxy
 * @returns {Promise<object[]>} Array of job listing objects
 */
export async function scrapeGlassdoorJobs({ keywords, location, maxJobs = 50, proxyEnabled = true }) {
    const jobs = [];
    const startUrl = buildSearchUrl(keywords, location);

    const proxyConfiguration = proxyEnabled
        ? await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] })
        : undefined;

    const crawler = new PlaywrightCrawler({
        proxyConfiguration,
        launchContext: {
            launchOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                ],
            },
        },
        browserPoolOptions: {
            useFingerprints: true,
        },
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 60,
        async requestHandler({ page, request, log }) {
            log.info(`Scraping: ${request.url}`);

            // Wait for the page to fully load
            await page.waitForLoadState('networkidle');

            // Check for CAPTCHA or blocking page
            const pageTitle = await page.title();
            if (pageTitle.toLowerCase().includes('captcha') || pageTitle.toLowerCase().includes('blocked')) {
                log.warning('Blocked by Glassdoor. Retrying with different proxy...');
                throw new Error('Blocked');
            }

            if (request.label === 'JOB_DETAIL') {
                // Scrape individual job detail page
                const jobData = await scrapeJobDetail(page, request.userData);
                if (jobData) jobs.push(jobData);
                return;
            }

            // Scrape job listings from search results page
            await sleep(1000 + Math.random() * 2000);

            const jobListings = await page.evaluate(() => {
                const jobCards = document.querySelectorAll('[data-test="jobListing"], .JobsList_jobListItem__wjTHv, li[class*="JobsList_jobListItem"]');
                const results = [];

                for (const card of jobCards) {
                    try {
                        const titleEl = card.querySelector('[data-test="job-title"], .JobCard_jobTitle__GLyJ1, a[class*="JobCard_trackingLink"]');
                        const companyEl = card.querySelector('[data-test="employer-name"], .EmployerProfile_profileContainer__63w3R, .JobCard_companyName__PtPcm');
                        const locationEl = card.querySelector('[data-test="emp-location"], .JobCard_location__N_iYE');
                        const salaryEl = card.querySelector('[data-test="detailSalary"], .JobCard_salaryEstimate__QpbIy');
                        const dateEl = card.querySelector('[data-test="job-age"], .JobCard_listingAge__KuaxZ, .listingAge');
                        const linkEl = card.querySelector('a[href*="/job-listing/"], a[data-test="job-title"]');
                        const ratingEl = card.querySelector('.RatingDropdown_ratingContainer__C8JFU, [data-test="rating"]');

                        results.push({
                            title: titleEl?.textContent?.trim() || null,
                            company: companyEl?.textContent?.trim() || null,
                            location: locationEl?.textContent?.trim() || null,
                            salary: salaryEl?.textContent?.trim() || null,
                            datePosted: dateEl?.textContent?.trim() || null,
                            companyRating: ratingEl?.textContent?.trim() || null,
                            url: linkEl?.href || null,
                        });
                    } catch {
                        // Skip malformed card
                    }
                }

                return results;
            });

            log.info(`Found ${jobListings.length} job listings on this page`);

            for (const listing of jobListings) {
                if (jobs.length >= maxJobs) break;
                if (listing.title && listing.url) {
                    jobs.push({
                        ...listing,
                        description: null,
                        requirements: null,
                    });
                }
            }

            // Handle pagination - click "Next" if we need more jobs
            if (jobs.length < maxJobs) {
                const nextButton = await page.$('[data-test="pagination-next"], .pagination__btn-next, button[aria-label="next page"]');
                if (nextButton) {
                    await sleep(1500 + Math.random() * 1500);
                    await nextButton.click();
                    await page.waitForLoadState('networkidle');
                    // The crawler will follow internal navigation automatically
                }
            }
        },
        failedRequestHandler({ request, log, error }) {
            log.error(`Request failed: ${request.url} - ${error?.message}`);
        },
    });

    await crawler.run([startUrl]);
    return jobs;
}

/**
 * Scrapes detailed job information from an individual job listing page.
 * @param {Page} page - Playwright page object
 * @param {object} metadata - Metadata from the job card
 * @returns {Promise<object|null>}
 */
async function scrapeJobDetail(page, metadata) {
    try {
        await page.waitForSelector('[data-test="jobDescriptionText"], .JobDetails_jobDescription__6VeBn', {
            timeout: 15000,
        });

        const detail = await page.evaluate(() => {
            const descEl = document.querySelector('[data-test="jobDescriptionText"], .JobDetails_jobDescription__6VeBn');
            return {
                description: descEl?.textContent?.trim() || null,
            };
        });

        return { ...metadata, ...detail };
    } catch {
        return metadata;
    }
}
