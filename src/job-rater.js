/**
 * Job Match Rater - Rates how well a job listing matches a parsed CV.
 * Returns a score from 0 to 10.
 */

/**
 * Rates a job listing against a parsed CV profile.
 * @param {object} job - Job listing object
 * @param {object} cvProfile - Parsed CV from cv-parser.js
 * @returns {object} Rating result with score and breakdown
 */
export function rateJobMatch(job, cvProfile) {
    const jobText = buildJobText(job);
    const normalizedJobText = jobText.toLowerCase();

    const skillScore = scoreSkillMatch(normalizedJobText, cvProfile.skills);
    const titleScore = scoreTitleMatch(normalizedJobText, job.title || '', cvProfile.jobTitles);
    const experienceScore = scoreExperienceMatch(normalizedJobText, cvProfile.yearsOfExperience);
    const educationScore = scoreEducationMatch(normalizedJobText, cvProfile.education);

    // Weighted average: skills are most important
    const weights = { skills: 0.50, title: 0.30, experience: 0.12, education: 0.08 };
    const rawScore =
        skillScore * weights.skills +
        titleScore * weights.title +
        experienceScore * weights.experience +
        educationScore * weights.education;

    const finalScore = Math.min(10, Math.max(0, Math.round(rawScore * 10) / 10));

    return {
        score: finalScore,
        breakdown: {
            skillMatch: Math.round(skillScore * 10) / 10,
            titleMatch: Math.round(titleScore * 10) / 10,
            experienceMatch: Math.round(experienceScore * 10) / 10,
            educationMatch: Math.round(educationScore * 10) / 10,
        },
        matchedSkills: getMatchedSkills(normalizedJobText, cvProfile.skills),
    };
}

/**
 * Builds a searchable text string from all job fields.
 */
function buildJobText(job) {
    return [job.title, job.description, job.requirements, job.company, job.location]
        .filter(Boolean)
        .join(' ');
}

/**
 * Scores how many of the candidate's skills appear in the job listing.
 * Returns a value from 0 to 10.
 */
function scoreSkillMatch(jobText, cvSkills) {
    if (!cvSkills || cvSkills.length === 0) return 5;

    const matchedCount = cvSkills.filter((skill) => {
        const regex = new RegExp(`(?<![a-z])${escapeRegex(skill)}(?![a-z])`, 'i');
        return regex.test(jobText);
    }).length;

    // Scale: matching all skills = 10, matching none = 0
    const ratio = matchedCount / Math.min(cvSkills.length, 10);
    return Math.min(10, ratio * 10);
}

/**
 * Scores the similarity between job title and candidate's target titles.
 * Returns a value from 0 to 10.
 */
function scoreTitleMatch(jobText, jobTitle, cvTitles) {
    if (!cvTitles || cvTitles.length === 0) return 5;

    const normalizedJobTitle = jobTitle.toLowerCase();
    let bestScore = 0;

    for (const cvTitle of cvTitles) {
        const cvWords = cvTitle.toLowerCase().split(/\s+/);
        const jobWords = normalizedJobTitle.split(/\s+/);

        // Check how many words from the CV title appear in the job title
        const matchingWords = cvWords.filter((word) =>
            word.length > 2 && (jobWords.includes(word) || jobText.includes(word)),
        );

        const score = cvWords.length > 0 ? (matchingWords.length / cvWords.length) * 10 : 0;
        if (score > bestScore) bestScore = score;
    }

    return Math.min(10, bestScore);
}

/**
 * Scores how well the experience requirements match the candidate's experience.
 * Returns a value from 0 to 10.
 */
function scoreExperienceMatch(jobText, cvYearsOfExperience) {
    if (cvYearsOfExperience === 0) return 5; // Unknown experience - neutral score

    // Extract required experience from job text
    const expMatch = jobText.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?(?:experience|exp)/i);
    if (!expMatch) return 7; // No experience mentioned - assume OK

    const requiredYears = parseInt(expMatch[1], 10);
    const diff = cvYearsOfExperience - requiredYears;

    if (diff >= 0 && diff <= 3) return 10; // Perfect match or slightly overqualified
    if (diff > 3) return 8; // Overqualified
    if (diff === -1) return 6; // Slightly under - still possible
    if (diff === -2) return 4; // Under by 2 years
    return 2; // Significantly under-qualified
}

/**
 * Scores how well the education requirements match the candidate's education.
 * Returns a value from 0 to 10.
 */
function scoreEducationMatch(jobText, cvEducation) {
    if (!cvEducation || cvEducation.length === 0) return 5;

    const requiresDegree = /bachelor|master|phd|degree|university|college/i.test(jobText);
    const hasRelevantDegree = cvEducation.some((edu) =>
        ['bachelor', 'master', 'phd', 'mba', 'bsc', 'msc'].includes(edu),
    );

    if (!requiresDegree) return 8; // No education requirement - neutral-positive
    if (hasRelevantDegree) return 10; // Has required degree
    return 4; // Degree required but not clearly present in CV
}

/**
 * Returns the list of CV skills that appear in the job listing.
 */
function getMatchedSkills(jobText, cvSkills) {
    return (cvSkills || []).filter((skill) => {
        const regex = new RegExp(`(?<![a-z])${escapeRegex(skill)}(?![a-z])`, 'i');
        return regex.test(jobText);
    });
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns a human-readable label for a match score.
 * @param {number} score - Score from 0 to 10
 * @returns {string} Label
 */
export function getMatchLabel(score) {
    if (score >= 9) return 'Excellent match';
    if (score >= 7) return 'Strong match';
    if (score >= 5) return 'Good match';
    if (score >= 3) return 'Partial match';
    return 'Weak match';
}
