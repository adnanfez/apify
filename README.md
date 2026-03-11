# Glassdoor Job Finder Agent

An [Apify](https://apify.com) actor that scrapes Glassdoor for job listings, matches them against your CV using OpenAI, and rates each listing with a score from **0/10** to **10/10**.

## Features

- 🔍 **Smart job search** – searches Glassdoor by job title and location.  
  If you don't specify a title, the agent derives the best search keyword from your CV.
- 📅 **Fresh listings** – prefers jobs posted within the last 30 days (configurable).  
  If fewer than 5 results are found in that window, the search automatically widens.
- 🤖 **AI match rating** – uses OpenAI `gpt-4o-mini` to score each job against your CV:
  - **matchScore** – integer 0–10
  - **matchRating** – e.g. `"8/10"`
  - **reasoning** – one-sentence explanation
  - **keyMatches** – matching skills/experiences
  - **gaps** – missing requirements
- 📊 **Results sorted** by match score (best first) and saved to the Apify dataset.

## Input

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `cvText` | string | ✅ | – | Full text of your CV / résumé |
| `jobTitle` | string | | – | Job title to search for (auto-derived from CV if omitted) |
| `location` | string | | `"United States"` | City, state, or country |
| `maxJobs` | integer | | `20` | Maximum job listings to evaluate |
| `daysBack` | integer | | `30` | Only include jobs posted within this many days |
| `minMatchScore` | integer | | `0` | Skip jobs scoring below this threshold (0–10) |
| `openAiApiKey` | string | ✅ | – | Your OpenAI API key |
| `proxyConfiguration` | object | | – | Apify proxy configuration |

## Output

Each item in the dataset represents one rated job listing:

```json
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "location": "New York, NY",
  "postedAge": "3 days ago",
  "salary": "$130K – $160K",
  "url": "https://www.glassdoor.com/job-listing/...",
  "matchScore": 8,
  "matchRating": "8/10",
  "reasoning": "Strong alignment on Python and cloud experience; candidate lacks Kubernetes depth.",
  "keyMatches": ["Python", "AWS", "REST APIs"],
  "gaps": ["Kubernetes", "Go"]
}
```

## Usage

### Running locally

```bash
npm install
npx playwright install chromium
APIFY_IS_AT_HOME=0 node src/main.js
```

Set your input in `storage/key_value_stores/default/INPUT.json`:

```json
{
  "cvText": "Your CV text here...",
  "jobTitle": "Software Engineer",
  "location": "Remote",
  "maxJobs": 10,
  "daysBack": 30,
  "openAiApiKey": "sk-..."
}
```

### Running on Apify

1. Deploy this actor to your Apify account.
2. Fill in the input form in the Apify console.
3. Run the actor and view results in the **Output** → **Dataset** tab.

## Project structure

```
.actor/
  actor.json          # Actor metadata
  input_schema.json   # Input field definitions
src/
  main.js             # Actor entry point
  scraper.js          # Glassdoor Playwright scraper
  matcher.js          # CV ↔ job OpenAI matcher
tests/
  matcher.test.js     # Unit tests for matcher
  scraper.test.js     # Unit tests for URL builder
package.json
```

## Running tests

```bash
npm install
npm test
```
