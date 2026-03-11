/**
 * CV-to-job matcher using OpenAI.
 *
 * Provides two functions:
 *  - extractJobTitleFromCV  – derive a suitable Glassdoor search term from raw CV text
 *  - matchJobWithCV         – score a single job listing against the CV (0-10)
 */

import OpenAI from 'openai';

/**
 * Build and return a configured OpenAI client.
 * @param {string} apiKey
 * @returns {OpenAI}
 */
function createClient(apiKey) {
    return new OpenAI({ apiKey });
}

/**
 * Ask the model to infer the most appropriate job title / search keyword from
 * the candidate's CV so we can drive the Glassdoor search query.
 *
 * @param {string} cvText   - Full CV text
 * @param {string} apiKey   - OpenAI API key
 * @returns {Promise<string>} Best job title to search for
 */
export async function extractJobTitleFromCV(cvText, apiKey) {
    const openai = createClient(apiKey);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content:
                    'You are a career advisor. Given a CV, respond with ONLY the most appropriate job title ' +
                    'that the candidate should search for on a job board. ' +
                    'Return plain text – no explanations, no quotes, no punctuation.',
            },
            {
                role: 'user',
                content: `CV:\n${cvText}`,
            },
        ],
        max_tokens: 30,
        temperature: 0.2,
    });

    return response.choices[0].message.content.trim();
}

/**
 * Rate how well a single job listing matches the candidate's CV.
 *
 * @param {Object} job        - Job object from the scraper
 * @param {string} job.title
 * @param {string} job.company
 * @param {string} job.location
 * @param {string} job.description
 * @param {string} cvText     - Full CV text
 * @param {string} apiKey     - OpenAI API key
 * @returns {Promise<{score: number, reasoning: string, keyMatches: string[], gaps: string[]}>}
 */
export async function matchJobWithCV(job, cvText, apiKey) {
    const openai = createClient(apiKey);

    const prompt =
        `You are an expert career advisor and recruiter. ` +
        `Evaluate how well the candidate's CV matches the job listing below and return a JSON object.\n\n` +
        `CANDIDATE CV:\n${cvText}\n\n` +
        `JOB LISTING:\n` +
        `Title: ${job.title}\n` +
        `Company: ${job.company}\n` +
        `Location: ${job.location}\n` +
        `Description:\n${job.description || '(no description available)'}\n\n` +
        `Return ONLY a valid JSON object with these fields:\n` +
        `{\n` +
        `  "score": <integer 0-10>,\n` +
        `  "reasoning": "<one or two sentence explanation>",\n` +
        `  "keyMatches": ["<matched skill or experience>", ...],\n` +
        `  "gaps": ["<missing requirement>", ...]\n` +
        `}\n` +
        `Score 0 means no match at all; 10 means perfect match.`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    return {
        score: Math.min(10, Math.max(0, Math.round(Number(parsed.score) || 0))),
        reasoning: parsed.reasoning ?? '',
        keyMatches: Array.isArray(parsed.keyMatches) ? parsed.keyMatches : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    };
}
