# Automated Lead Generation System

This document explains how to use the automated lead generation system that triggers when a job is created.

## Overview

The automated lead generation system integrates with the free-tier orchestrator to automatically generate qualified leads for job postings. It can be triggered automatically when a job is created or manually via API.

## Architecture

```
┌─────────────────┐
│  Job Creation   │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────┐
│ triggerLeadGenerationForJob()       │
│                                     │
│ 1. Fetch job details                │
│ 2. Extract search criteria          │
│ 3. Call free-tier orchestrator      │
│ 4. Associate leads with job         │
│ 5. Return statistics                │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│ Free-Tier Orchestrator              │
│                                     │
│ - Apify: LinkedIn scraping          │
│ - Apollo: Email enrichment          │
│ - Lusha: Phone enrichment           │
│ - Claude AI: Candidate scoring      │
└────────┬────────────────────────────┘
         │
         v
┌─────────────────┐
│  Database       │
│  (candidates)   │
└─────────────────┘
```

## Usage

### 1. Programmatic Usage (TypeScript)

```typescript
import { triggerLeadGenerationForJob } from '@/lib/jobs/auto-lead-generation'

// Generate leads for a specific job
const stats = await triggerLeadGenerationForJob(
  'job-uuid-here',      // jobId
  'company-uuid-here',  // companyId
  20                    // maxLeads (optional, default: 20)
)

console.log(stats)
// {
//   jobId: 'job-uuid-here',
//   jobTitle: 'Senior Construction Manager',
//   totalLeadsGenerated: 18,
//   savedToDatabase: 18,
//   emailsFound: 15,
//   phonesFound: 12,
//   avgDataCompleteness: 82,
//   avgMatchScore: 76,
//   estimatedCost: 4.80,
//   apiUsage: { apify: 18, apollo: 3, lusha: 6 },
//   remainingApifyCredits: 32
// }
```

### 2. API Endpoint Usage

#### Generate Leads for a Specific Job

```bash
POST /api/jobs/{jobId}/generate-leads
Content-Type: application/json

{
  "maxLeads": 20  // Optional, default: 20, max: 50
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000/generate-leads \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"maxLeads": 25}'
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "jobTitle": "Senior Construction Manager",
    "totalLeadsGenerated": 23,
    "savedToDatabase": 23,
    "emailsFound": 19,
    "phonesFound": 15,
    "avgDataCompleteness": 85,
    "avgMatchScore: 78,
    "estimatedCost": 5.83,
    "apiUsage": {
      "apify": 23,
      "apollo": 4,
      "lusha": 8
    },
    "remainingApifyCredits": 27
  }
}
```

### 3. Using the Existing /api/leads/generate Endpoint

The existing lead generation endpoint now supports an optional `jobId` parameter:

```bash
POST /api/leads/generate
Content-Type: application/json

{
  "jobTitle": "Construction Superintendent",
  "location": "New York, NY",
  "maxLeads": 30,
  "jobId": "550e8400-e29b-41d4-a716-446655440000"  // Optional
}
```

**With jobId**: Leads are associated with the specified job
**Without jobId**: Leads are created without job association (general lead pool)

## Validation

Before generating leads, you can validate if a job is eligible:

```typescript
import { canGenerateLeadsForJob } from '@/lib/jobs/auto-lead-generation'

const validation = await canGenerateLeadsForJob(jobId, companyId)

if (!validation.canGenerate) {
  console.error(validation.reason)
  // "Job not found or does not belong to company"
  // "Job must have a title for lead generation"
}
```

## How It Works

### Step 1: Extract Search Criteria

The system automatically extracts search parameters from the job:
- **Job Title**: Used for LinkedIn search keyword
- **Location**: Used for geographic filtering (defaults to "United States" if not specified)

### Step 2: Generate Leads

Uses the free-tier orchestrator to:
1. Scrape LinkedIn profiles via Apify (20-50 leads)
2. Enrich missing emails via Apollo.io (free tier)
3. Enrich missing phones via Lusha (free tier)
4. Score candidates using Claude AI

### Step 3: Associate with Job

All generated leads are automatically:
- Linked to the job via `jobId` foreign key
- Tagged with `stage: 'sourced'`
- Enriched with AI scoring and data completeness metrics

### Step 4: Track Usage

API usage is automatically tracked in the `api_usage` table:
- Apify leads consumed
- Apollo calls made
- Lusha calls made
- Total cost estimate

## Free Tier Limits

The system respects these free tier limits:

| Service    | Monthly Limit | Cost/Lead  |
|------------|---------------|------------|
| Apify      | 50 leads      | $0.20      |
| Apollo.io  | 50 calls      | Free       |
| Lusha      | 50 calls      | Free       |
| Claude AI  | Unlimited*    | $0.01      |

*Unlimited within your Anthropic account limits

## Use Cases

### 1. Automatic Lead Generation on Job Creation

```typescript
// In your job creation handler
const newJob = await db.insert(jobs).values({...}).returning()

// Automatically generate leads
await triggerLeadGenerationForJob(
  newJob.id,
  newJob.companyId,
  30 // Generate 30 leads initially
)
```

### 2. Manual Lead Refresh

Users can manually trigger lead generation to get more candidates:

```typescript
// User clicks "Generate More Leads" button in UI
fetch(`/api/jobs/${jobId}/generate-leads`, {
  method: 'POST',
  body: JSON.stringify({ maxLeads: 20 })
})
```

### 3. Scheduled Lead Generation

```typescript
// Run daily for active jobs
const activeJobs = await db.select().from(jobs)
  .where(eq(jobs.status, 'active'))

for (const job of activeJobs) {
  await triggerLeadGenerationForJob(job.id, job.companyId, 10)
}
```

## Error Handling

The system handles errors gracefully:

```typescript
try {
  const stats = await triggerLeadGenerationForJob(jobId, companyId)
} catch (error) {
  if (error.message.includes('Job not found')) {
    // Handle missing job
  } else if (error.message.includes('title is required')) {
    // Handle validation error
  } else {
    // Handle API errors (Apify, Apollo, etc.)
  }
}
```

## Database Schema

Leads are stored in the `candidates` table with these key fields:

```typescript
{
  id: uuid,
  companyId: uuid,
  jobId: uuid,              // Links to the job
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  currentTitle: string,
  currentCompany: string,
  location: string,
  linkedinUrl: string,
  experienceYears: number,
  skills: string[],
  aiScore: number,          // 0-100 match score
  stage: 'sourced',         // Initial stage
  source: string,           // 'apify', 'apollo', etc.
  enrichmentSource: string, // Comma-separated list
  dataCompleteness: number, // 0-100
  socialProfiles: jsonb,
  createdAt: timestamp
}
```

## Integration with Existing Workflow

This system seamlessly integrates with your existing VerticalHire workflow:

1. **Job Creation** → Auto-generate leads
2. **Lead Review** → Candidates appear in job pipeline
3. **Outreach** → Use candidates in campaigns
4. **Tracking** → Monitor API usage and costs

## Best Practices

1. **Set Realistic Limits**: Start with 20-30 leads per job to conserve API credits
2. **Specify Locations**: Always provide job location for better targeting
3. **Monitor Usage**: Check `api_usage` table to track monthly consumption
4. **Quality over Quantity**: The AI scoring helps prioritize high-quality matches
5. **Re-run Strategically**: Don't re-generate leads too frequently (APIs have rate limits)

## Troubleshooting

**Problem**: No leads generated
- **Solution**: Check if job has a title and the free tier limits haven't been exceeded

**Problem**: Low data completeness
- **Solution**: Some LinkedIn profiles have limited public data; this is expected

**Problem**: API rate limit errors
- **Solution**: The system includes built-in rate limiting, but if you hit limits, wait 1-2 minutes

**Problem**: Duplicate candidates
- **Solution**: The database will reject duplicates based on email uniqueness (if configured)
