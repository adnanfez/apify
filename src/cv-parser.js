/**
 * CV Parser - Extracts structured information from CV/resume text.
 * Identifies skills, job titles, experience, and generates search keywords.
 */

const TECH_SKILLS = [
    // Programming languages
    'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'rust', 'ruby', 'php',
    'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'bash', 'shell', 'powershell',
    // Frontend
    'react', 'angular', 'vue', 'svelte', 'html', 'css', 'sass', 'less', 'webpack', 'vite',
    'next.js', 'nextjs', 'nuxt', 'gatsby', 'redux', 'mobx', 'graphql', 'rest', 'api',
    // Backend
    'node.js', 'nodejs', 'express', 'fastapi', 'django', 'flask', 'spring', 'asp.net',
    'rails', 'laravel', 'nestjs', 'microservices', 'serverless',
    // Databases
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'cassandra', 'oracle', 'sqlite', 'firebase', 'supabase',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform',
    'ansible', 'jenkins', 'gitlab ci', 'github actions', 'ci/cd', 'linux', 'nginx',
    // Data & AI/ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn',
    'pandas', 'numpy', 'spark', 'hadoop', 'kafka', 'airflow', 'dbt', 'tableau', 'power bi',
    'data science', 'data engineering', 'nlp', 'computer vision', 'llm', 'ai',
    // Mobile
    'ios', 'android', 'react native', 'flutter', 'xamarin',
    // Testing
    'jest', 'pytest', 'junit', 'selenium', 'cypress', 'playwright', 'tdd', 'bdd',
    // Other
    'git', 'agile', 'scrum', 'jira', 'figma', 'photoshop', 'blockchain', 'solidity',
    'cybersecurity', 'networking', 'tcp/ip', 'oauth', 'jwt',
];

const JOB_TITLE_PATTERNS = [
    /(?:senior|junior|lead|principal|staff|associate|mid[- ]?level)?\s*(?:software|web|mobile|frontend|front[- ]end|backend|back[- ]end|full[- ]?stack|data|machine learning|ml|ai|devops|cloud|security|systems?|site reliability|platform|embedded|firmware)\s+(?:engineer|developer|architect|scientist|analyst|specialist)/gi,
    /(?:senior|junior|lead|principal|head of|director of|vp of)?\s*(?:product|project|program|engineering|data|design|marketing|sales|operations|finance|hr|human resources)\s+(?:manager|director|lead|head|officer|analyst)/gi,
    /(?:ux|ui|product|graphic|visual|interaction|brand)?\s*designer/gi,
    /data\s+(?:scientist|engineer|analyst|architect)/gi,
    /(?:devops|sre|cloud|platform|security|network|database|system)\s+(?:engineer|architect|administrator|specialist|analyst)/gi,
    /(?:cto|ceo|cpo|cfo|coo|vp|director|manager|lead|head)\s+of/gi,
    /(?:scrum master|product owner|business analyst|solutions architect|technical lead)/gi,
];

const EXPERIENCE_PATTERNS = [
    /(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience|exp)/gi,
    /experienced?\s+(?:in\s+)?(\d+)\+?\s*years?/gi,
];

const EDUCATION_KEYWORDS = [
    'bachelor', 'master', 'phd', 'doctorate', 'mba', 'bsc', 'msc', 'ba', 'ma',
    'computer science', 'software engineering', 'information technology', 'data science',
    'electrical engineering', 'mathematics', 'statistics', 'physics',
];

/**
 * Parses a CV text and extracts structured information.
 * @param {string} cvText - Raw CV/resume text
 * @returns {object} Parsed CV with skills, titles, experience, keywords
 */
export function parseCv(cvText) {
    const normalizedText = cvText.toLowerCase();

    const skills = extractSkills(normalizedText);
    const jobTitles = extractJobTitles(cvText);
    const yearsOfExperience = extractExperience(normalizedText);
    const education = extractEducation(normalizedText);
    const searchKeywords = generateSearchKeywords(skills, jobTitles);

    return {
        skills,
        jobTitles,
        yearsOfExperience,
        education,
        searchKeywords,
        rawText: cvText,
    };
}

/**
 * Extracts technical and soft skills from CV text.
 */
function extractSkills(normalizedText) {
    const foundSkills = new Set();

    for (const skill of TECH_SKILLS) {
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`(?<![a-z])${escapeRegex(skill)}(?![a-z])`, 'i');
        if (regex.test(normalizedText)) {
            foundSkills.add(skill.toLowerCase());
        }
    }

    return [...foundSkills];
}

/**
 * Extracts job titles/roles mentioned in the CV.
 */
function extractJobTitles(cvText) {
    const foundTitles = new Set();

    for (const pattern of JOB_TITLE_PATTERNS) {
        const matches = cvText.match(pattern) || [];
        for (const match of matches) {
            foundTitles.add(match.trim().toLowerCase().replace(/\s+/g, ' '));
        }
    }

    return [...foundTitles].slice(0, 10);
}

/**
 * Extracts years of experience from CV text.
 */
function extractExperience(normalizedText) {
    let maxYears = 0;

    for (const pattern of EXPERIENCE_PATTERNS) {
        const matches = [...normalizedText.matchAll(pattern)];
        for (const match of matches) {
            const years = parseInt(match[1], 10);
            if (!isNaN(years) && years > maxYears) {
                maxYears = years;
            }
        }
    }

    return maxYears;
}

/**
 * Extracts education information from CV text.
 */
function extractEducation(normalizedText) {
    return EDUCATION_KEYWORDS.filter((keyword) => normalizedText.includes(keyword));
}

/**
 * Generates Glassdoor search keywords from skills and job titles.
 */
function generateSearchKeywords(skills, jobTitles) {
    const keywords = [];

    // Add most relevant job title as primary keyword
    if (jobTitles.length > 0) {
        keywords.push(jobTitles[0]);
    }

    // Add top skills as secondary keywords
    const prioritySkills = skills.slice(0, 5);
    keywords.push(...prioritySkills);

    return keywords.slice(0, 6);
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
