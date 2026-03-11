import { parseDatePosted, isWithinLastMonth, buildSearchUrl } from '../scraper.js';

describe('parseDatePosted', () => {
    test('parses "Just now" as today', () => {
        const result = parseDatePosted('Just now');
        const now = new Date();
        expect(result).not.toBeNull();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(5000);
    });

    test('parses "today" as today', () => {
        const result = parseDatePosted('today');
        const now = new Date();
        expect(result).not.toBeNull();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(5000);
    });

    test('parses "< 1 day" as today', () => {
        const result = parseDatePosted('< 1 day');
        const now = new Date();
        expect(result).not.toBeNull();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(5000);
    });

    test('parses "2d" as 2 days ago', () => {
        const result = parseDatePosted('2d');
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        expect(result).not.toBeNull();
        expect(Math.abs(result.getDate() - twoDaysAgo.getDate())).toBeLessThanOrEqual(1);
    });

    test('parses "30d" as 30 days ago', () => {
        const result = parseDatePosted('30d');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        expect(result).not.toBeNull();
        expect(Math.abs(result.getDate() - thirtyDaysAgo.getDate())).toBeLessThanOrEqual(1);
    });

    test('parses "3h" as 3 hours ago', () => {
        const result = parseDatePosted('3h');
        expect(result).not.toBeNull();
        const now = new Date();
        const diffHours = (now - result) / (1000 * 60 * 60);
        expect(Math.abs(diffHours - 3)).toBeLessThan(0.1);
    });

    test('parses "2mo" as 2 months ago', () => {
        const result = parseDatePosted('2mo');
        expect(result).not.toBeNull();
        const now = new Date();
        const diffDays = (now - result) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThan(55);
    });

    test('returns null for empty or invalid input', () => {
        expect(parseDatePosted(null)).toBeNull();
        expect(parseDatePosted('')).toBeNull();
        expect(parseDatePosted(undefined)).toBeNull();
    });
});

describe('isWithinLastMonth', () => {
    test('returns true for jobs posted recently', () => {
        expect(isWithinLastMonth('Just now')).toBe(true);
        expect(isWithinLastMonth('1d')).toBe(true);
        expect(isWithinLastMonth('15d')).toBe(true);
        expect(isWithinLastMonth('29d')).toBe(true);
    });

    test('returns false for jobs posted more than 30 days ago', () => {
        expect(isWithinLastMonth('31d')).toBe(false);
        expect(isWithinLastMonth('2mo')).toBe(false);
    });

    test('returns false for null/empty date', () => {
        expect(isWithinLastMonth(null)).toBe(false);
        expect(isWithinLastMonth('')).toBe(false);
    });
});

describe('buildSearchUrl', () => {
    test('includes search keywords in URL', () => {
        const url = buildSearchUrl('Python developer', 'London');
        // URLSearchParams encodes spaces as '+' which is valid URL encoding
        expect(url).toMatch(/Python[+%20]developer/);
        expect(url).toContain('glassdoor.com');
    });

    test('handles empty location', () => {
        const url = buildSearchUrl('React developer', '');
        expect(url).toMatch(/React[+%20]developer/);
        expect(url).not.toContain('locName=');
    });

    test('includes 30-day filter', () => {
        const url = buildSearchUrl('Engineer', 'New York');
        expect(url).toContain('fromAge=30');
    });

    test('handles empty keywords', () => {
        const url = buildSearchUrl('', 'London');
        expect(url).toContain('glassdoor.com');
    });
});
