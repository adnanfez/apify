/**
 * Unit tests for src/matcher.js
 *
 * We mock the OpenAI client so no real API calls are made.
 */

import { jest } from '@jest/globals';

// ── Mock openai before importing matcher ─────────────────────────────────────
const mockCreate = jest.fn();

jest.unstable_mockModule('openai', () => ({
    default: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    })),
}));

const { extractJobTitleFromCV, matchJobWithCV } = await import('../src/matcher.js');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractJobTitleFromCV', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns trimmed title from model response', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: '  Software Engineer  ' } }],
        });

        const result = await extractJobTitleFromCV('My CV text here...', 'sk-test');
        expect(result).toBe('Software Engineer');
    });

    test('returns raw content when no trimming needed', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Data Scientist' } }],
        });

        const result = await extractJobTitleFromCV('CV text', 'sk-test');
        expect(result).toBe('Data Scientist');
    });
});

describe('matchJobWithCV', () => {
    const sampleJob = {
        title: 'Frontend Developer',
        company: 'Acme Corp',
        location: 'Remote',
        description: 'React, TypeScript, 3 years experience required.',
    };

    const sampleCV = 'Experienced frontend developer with 4 years of React and TypeScript.';

    afterEach(() => jest.clearAllMocks());

    test('returns correct score and normalised fields', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            score: 9,
                            reasoning: 'Great match on React and TypeScript.',
                            keyMatches: ['React', 'TypeScript'],
                            gaps: [],
                        }),
                    },
                },
            ],
        });

        const result = await matchJobWithCV(sampleJob, sampleCV, 'sk-test');

        expect(result.score).toBe(9);
        expect(result.reasoning).toBe('Great match on React and TypeScript.');
        expect(result.keyMatches).toEqual(['React', 'TypeScript']);
        expect(result.gaps).toEqual([]);
    });

    test('clamps score to 0–10', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            score: 15,
                            reasoning: 'Over the top.',
                            keyMatches: [],
                            gaps: [],
                        }),
                    },
                },
            ],
        });

        const result = await matchJobWithCV(sampleJob, sampleCV, 'sk-test');
        expect(result.score).toBe(10);
    });

    test('clamps negative score to 0', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            score: -3,
                            reasoning: 'No match at all.',
                            keyMatches: [],
                            gaps: ['Everything'],
                        }),
                    },
                },
            ],
        });

        const result = await matchJobWithCV(sampleJob, sampleCV, 'sk-test');
        expect(result.score).toBe(0);
    });

    test('handles missing optional fields gracefully', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({ score: 5 }),
                    },
                },
            ],
        });

        const result = await matchJobWithCV(sampleJob, sampleCV, 'sk-test');
        expect(result.score).toBe(5);
        expect(result.reasoning).toBe('');
        expect(result.keyMatches).toEqual([]);
        expect(result.gaps).toEqual([]);
    });

    test('handles NaN score (e.g. string value) by defaulting to 0', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: JSON.stringify({ score: 'not-a-number', reasoning: '', keyMatches: [], gaps: [] }),
                    },
                },
            ],
        });

        const result = await matchJobWithCV(sampleJob, sampleCV, 'sk-test');
        expect(result.score).toBe(0);
    });
});
