/**
 * Unit tests for src/scraper.js – specifically the URL builder helper.
 *
 * The PlaywrightCrawler itself is not tested here (it requires a live browser
 * and network).  We exercise the pure utility logic that is safe to unit-test.
 */

import { buildSearchUrl } from '../src/scraper.js';

describe('buildSearchUrl', () => {
    test('builds basic URL with keyword and default location', () => {
        const url = buildSearchUrl('Software Engineer', 'United States', 30, 0);
        expect(url).toContain('sc.keyword=Software+Engineer');
        expect(url).toContain('fromAge=30');
        expect(url).not.toContain('locKeyword');
        expect(url).not.toContain('&p=');
    });

    test('includes locKeyword for non-US locations', () => {
        const url = buildSearchUrl('Data Scientist', 'London, UK', 30, 0);
        expect(url).toContain('locKeyword=London%2C+UK');
    });

    test('omits fromAge when set to 0 (any time)', () => {
        const url = buildSearchUrl('Engineer', 'United States', 0, 0);
        expect(url).not.toContain('fromAge');
    });

    test('adds page parameter for pages > 0', () => {
        const url = buildSearchUrl('Engineer', 'United States', 30, 2);
        expect(url).toContain('p=3');
    });

    test('does not add page parameter for page 0', () => {
        const url = buildSearchUrl('Engineer', 'United States', 30, 0);
        expect(url).not.toContain('&p=');
    });
});
