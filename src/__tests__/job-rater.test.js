import { rateJobMatch, getMatchLabel } from '../job-rater.js';

const sampleCvProfile = {
    skills: ['python', 'javascript', 'react', 'aws', 'docker', 'postgresql', 'machine learning'],
    jobTitles: ['senior software engineer', 'software developer'],
    yearsOfExperience: 5,
    education: ['bachelor', 'computer science'],
    searchKeywords: ['senior software engineer', 'python', 'react'],
};

describe('rateJobMatch', () => {
    test('gives high score to a job that closely matches the CV', () => {
        const job = {
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            location: 'London',
            description: 'We need a senior software engineer with Python, React, AWS, and Docker skills. 5 years of experience required. Bachelor degree in Computer Science preferred.',
            requirements: 'Python, React, AWS, Docker, PostgreSQL',
        };

        const result = rateJobMatch(job, sampleCvProfile);
        expect(result.score).toBeGreaterThanOrEqual(7);
        expect(result.matchedSkills.length).toBeGreaterThan(3);
    });

    test('gives low score to a completely unrelated job', () => {
        const job = {
            title: 'Chef de Cuisine',
            company: 'Fancy Restaurant',
            location: 'Paris',
            description: 'Experienced chef needed for upscale restaurant. Culinary degree required. 10 years cooking experience.',
            requirements: 'Cooking, pastry, food safety, kitchen management',
        };

        const result = rateJobMatch(job, sampleCvProfile);
        expect(result.score).toBeLessThan(4);
        expect(result.matchedSkills.length).toBe(0);
    });

    test('returns score between 0 and 10', () => {
        const jobs = [
            { title: 'Python Dev', description: 'Python developer needed', requirements: '' },
            { title: 'Cook', description: 'Cooking skills required', requirements: '' },
            { title: 'Senior Engineer', description: 'React AWS Docker PostgreSQL Machine Learning senior', requirements: 'Python JavaScript' },
        ];

        for (const job of jobs) {
            const result = rateJobMatch(job, sampleCvProfile);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(10);
        }
    });

    test('returns breakdown object with expected fields', () => {
        const job = { title: 'Developer', description: 'Python developer', requirements: '' };
        const result = rateJobMatch(job, sampleCvProfile);

        expect(result.breakdown).toHaveProperty('skillMatch');
        expect(result.breakdown).toHaveProperty('titleMatch');
        expect(result.breakdown).toHaveProperty('experienceMatch');
        expect(result.breakdown).toHaveProperty('educationMatch');
    });

    test('returns matched skills list', () => {
        const job = {
            title: 'Python React Developer',
            description: 'We need Python and React developer with AWS experience',
            requirements: '',
        };
        const result = rateJobMatch(job, sampleCvProfile);

        expect(result.matchedSkills).toContain('python');
        expect(result.matchedSkills).toContain('react');
        expect(result.matchedSkills).toContain('aws');
    });

    test('handles job with empty description gracefully', () => {
        const job = { title: '', description: '', requirements: '', company: '', location: '' };
        const result = rateJobMatch(job, sampleCvProfile);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
    });

    test('handles CV profile with no skills gracefully', () => {
        const emptyProfile = {
            skills: [],
            jobTitles: [],
            yearsOfExperience: 0,
            education: [],
        };
        const job = { title: 'Developer', description: 'Python developer', requirements: '' };
        const result = rateJobMatch(job, emptyProfile);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
    });
});

describe('getMatchLabel', () => {
    test('returns "Excellent match" for score >= 9', () => {
        expect(getMatchLabel(9)).toBe('Excellent match');
        expect(getMatchLabel(10)).toBe('Excellent match');
        expect(getMatchLabel(9.5)).toBe('Excellent match');
    });

    test('returns "Strong match" for score 7-8', () => {
        expect(getMatchLabel(7)).toBe('Strong match');
        expect(getMatchLabel(8)).toBe('Strong match');
        expect(getMatchLabel(7.5)).toBe('Strong match');
    });

    test('returns "Good match" for score 5-6', () => {
        expect(getMatchLabel(5)).toBe('Good match');
        expect(getMatchLabel(6)).toBe('Good match');
    });

    test('returns "Partial match" for score 3-4', () => {
        expect(getMatchLabel(3)).toBe('Partial match');
        expect(getMatchLabel(4)).toBe('Partial match');
    });

    test('returns "Weak match" for score < 3', () => {
        expect(getMatchLabel(0)).toBe('Weak match');
        expect(getMatchLabel(1)).toBe('Weak match');
        expect(getMatchLabel(2)).toBe('Weak match');
    });
});
