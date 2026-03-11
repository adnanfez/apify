import { parseCv } from '../cv-parser.js';

describe('parseCv', () => {
    const sampleCv = `
John Doe
Senior Software Engineer

Experience:
5 years of experience in software development.

Skills:
- Python, JavaScript, TypeScript
- React, Node.js, Django
- AWS, Docker, Kubernetes
- PostgreSQL, MongoDB
- Machine Learning, TensorFlow

Education:
BSc Computer Science, University of London, 2018

Work History:
Senior Software Engineer at TechCorp (2020-present)
  - Built REST APIs and microservices
  - Led a team of 5 developers

Software Developer at StartupX (2018-2020)
`;

    test('extracts skills from CV text', () => {
        const profile = parseCv(sampleCv);
        expect(profile.skills).toContain('python');
        expect(profile.skills).toContain('javascript');
        expect(profile.skills).toContain('typescript');
        expect(profile.skills).toContain('react');
        expect(profile.skills).toContain('aws');
        expect(profile.skills).toContain('docker');
        expect(profile.skills).toContain('kubernetes');
        expect(profile.skills).toContain('mongodb');
    });

    test('extracts years of experience', () => {
        const profile = parseCv(sampleCv);
        expect(profile.yearsOfExperience).toBe(5);
    });

    test('extracts education keywords', () => {
        const profile = parseCv(sampleCv);
        // "BSc" maps to the "bsc" keyword; "Computer Science" to "computer science"
        expect(profile.education).toContain('bsc');
        expect(profile.education).toContain('computer science');
    });

    test('generates search keywords', () => {
        const profile = parseCv(sampleCv);
        expect(profile.searchKeywords.length).toBeGreaterThan(0);
        expect(Array.isArray(profile.searchKeywords)).toBe(true);
    });

    test('includes raw CV text in output', () => {
        const profile = parseCv(sampleCv);
        expect(profile.rawText).toBe(sampleCv);
    });

    test('handles minimal CV text gracefully', () => {
        const minimalCv = 'Software developer with experience in Python and JavaScript.';
        const profile = parseCv(minimalCv);
        expect(profile.skills).toContain('python');
        expect(profile.skills).toContain('javascript');
        expect(profile.yearsOfExperience).toBe(0);
    });

    test('does not produce duplicate skills', () => {
        const cvWithDuplicates = 'Python developer with Python experience and python skills.';
        const profile = parseCv(cvWithDuplicates);
        const pythonOccurrences = profile.skills.filter((s) => s === 'python').length;
        expect(pythonOccurrences).toBe(1);
    });
});
