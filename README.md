# Glassdoor Job Finder Agent

An Apify Actor that scrapes Glassdoor for job listings matching your CV and rates each job from **0/10 to 10/10** based on how well it matches your skills and experience.

## Features

- 🔍 **Keyword extraction** — Automatically extracts skills, job titles, and experience from your CV
- 🌐 **Glassdoor scraping** — Searches Glassdoor for matching jobs using Crawlee + Playwright
- 📅 **Date filtering** — Filters jobs posted within the last 30 days (falls back to all jobs if fewer than 5 recent ones)
- ⭐ **Match rating** — Rates each job 0–10 based on:
  - Skill match (50% weight)
  - Job title match (30% weight)
  - Experience match (12% weight)
  - Education match (8% weight)
- 📊 **Sorted output** — Results sorted by match score (highest first)

## Input

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `cvText` | string | ✅ | — | Your full CV/resume text |
| `searchKeywords` | string | ❌ | _(from CV)_ | Override search keywords for Glassdoor |
| `location` | string | ❌ | _(any)_ | Location to search in (e.g. `"New York"`, `"Remote"`) |
| `maxJobs` | integer | ❌ | `50` | Max number of jobs to scrape (1–200) |
| `withinLastMonth` | boolean | ❌ | `true` | Filter to jobs posted within 30 days |
| `minMatchScore` | integer | ❌ | `0` | Minimum match score (0–10) to include in output |

### Example Input

```json
{
  "cvText": "Software Engineer with 5 years of experience in Python, React, and AWS. Built scalable microservices and REST APIs. BSc Computer Science.",
  "location": "London",
  "maxJobs": 30,
  "withinLastMonth": true,
  "minMatchScore": 5
}
```

## Output

Each job listing is saved to the Apify dataset with the following fields:

| Field | Description |
|-------|-------------|
| `title` | Job title |
| `company` | Company name |
| `location` | Job location |
| `salary` | Salary estimate (if available) |
| `datePosted` | When the job was posted |
| `companyRating` | Glassdoor company rating |
| `url` | Link to the job listing |
| `matchScore` | Match score (e.g. `"8.5/10"`) |
| `matchLabel` | Human-readable label (`"Excellent match"`, `"Strong match"`, etc.) |
| `matchedSkills` | List of your skills found in the job listing |
| `matchBreakdown` | Detailed score breakdown (skill, title, experience, education) |
| `description` | Job description text |

### Example Output Record

```json
{
  "title": "Senior Python Developer",
  "company": "Acme Corp",
  "location": "London, UK",
  "salary": "£70K–£90K",
  "datePosted": "3d",
  "companyRating": "4.2",
  "url": "https://www.glassdoor.com/job-listing/...",
  "matchScore": "8.5/10",
  "matchLabel": "Excellent match",
  "matchedSkills": ["python", "aws", "microservices", "rest"],
  "matchBreakdown": {
    "skillMatch": 9.0,
    "titleMatch": 8.0,
    "experienceMatch": 10.0,
    "educationMatch": 8.0
  },
  "description": "We are looking for a Senior Python Developer..."
}
```

## Match Score Labels

| Score | Label |
|-------|-------|
| 9–10 | Excellent match |
| 7–8 | Strong match |
| 5–6 | Good match |
| 3–4 | Partial match |
| 0–2 | Weak match |

## Running Locally

```bash
npm install
npx apify-cli run
```

Make sure to create an `apify_storage/key_value_stores/default/INPUT.json` file with your input before running locally.

## Deployment on Apify

```bash
npx apify-cli push
```

Then run it from the [Apify Console](https://console.apify.com).
