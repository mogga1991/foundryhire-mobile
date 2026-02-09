# Jobs Module - Automated Lead Generation

This directory contains the automated lead generation system for job postings.

## Files

### Core Functionality

- **`auto-lead-generation.ts`**: Main lead generation module
  - `triggerLeadGenerationForJob()`: Generate leads for a specific job
  - `canGenerateLeadsForJob()`: Validate if lead generation can run

- **`job-hooks.ts`**: Lifecycle hooks for job events
  - `onJobCreated()`: Hook for when a job is created
  - `onJobPublished()`: Hook for when a job is published

### Documentation

- **`AUTO_LEAD_GENERATION_USAGE.md`**: Complete usage guide
- **`INTEGRATION_EXAMPLE.md`**: Integration examples and best practices
- **`README.md`**: This file

## Quick Start

### 1. Generate Leads Programmatically

```typescript
import { triggerLeadGenerationForJob } from '@/lib/jobs/auto-lead-generation'

const stats = await triggerLeadGenerationForJob(
  jobId,
  companyId,
  20 // maxLeads
)
```

### 2. Use API Endpoint

```bash
POST /api/jobs/{jobId}/generate-leads
Content-Type: application/json

{
  "maxLeads": 20
}
```

### 3. Use Job Hooks

```typescript
import { onJobCreated } from '@/lib/jobs/job-hooks'

// After creating a job
await onJobCreated(newJob.id, companyId, {
  autoGenerateLeads: true,
  maxLeads: 20
})
```

## Features

- Automatic extraction of search criteria from job details
- Integration with free-tier lead generation orchestrator
- Automatic lead association with jobs
- Comprehensive statistics and tracking
- Error handling and validation
- API usage monitoring

## API Endpoints

### Generate Leads for Job

```
POST /api/jobs/{id}/generate-leads
```

**Request Body:**
```json
{
  "maxLeads": 20  // Optional, default: 20, max: 50
}
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "jobId": "...",
    "jobTitle": "...",
    "totalLeadsGenerated": 18,
    "savedToDatabase": 18,
    "emailsFound": 15,
    "phonesFound": 12,
    "avgDataCompleteness": 82,
    "avgMatchScore": 76,
    "estimatedCost": 4.80,
    "apiUsage": {
      "apify": 18,
      "apollo": 3,
      "lusha": 6
    },
    "remainingApifyCredits": 32
  }
}
```

### Generate Leads (General)

```
POST /api/leads/generate
```

**Request Body:**
```json
{
  "jobTitle": "Construction Manager",
  "location": "Denver, CO",
  "maxLeads": 30,
  "jobId": "..."  // Optional: associate with job
}
```

## Integration Patterns

### Pattern 1: Background Generation (Recommended)

```typescript
// Non-blocking, best UX
onJobCreated(jobId, companyId, {
  autoGenerateLeads: true,
  maxLeads: 20
}).catch(error => console.error(error))

// Return immediately
return { success: true }
```

### Pattern 2: Synchronous Generation

```typescript
// Blocking, complete before returning
const result = await onJobCreated(jobId, companyId, {
  autoGenerateLeads: true,
  maxLeads: 20
})

return { success: true, leadStats: result }
```

### Pattern 3: Client-Triggered

```typescript
// Client calls API separately
// 1. Create job
const job = await createJob(...)

// 2. Generate leads
const stats = await fetch(`/api/jobs/${job.id}/generate-leads`, {
  method: 'POST',
  body: JSON.stringify({ maxLeads: 25 })
})
```

## Dependencies

- `/lib/integrations/free-tier-orchestrator`: Core lead generation
- `/lib/db/schema`: Database schema (jobs, candidates)
- `/lib/auth-helpers`: Authentication helpers

## Error Handling

The system handles these errors gracefully:

- Job not found
- Job doesn't belong to company
- Missing required fields (title)
- API rate limits
- Database errors
- Individual lead save failures (continues with others)

## Best Practices

1. Use background generation for better UX
2. Start with 20-30 leads per job
3. Monitor API usage via `api_usage` table
4. Always specify job location for better targeting
5. Don't regenerate too frequently (respect rate limits)

## Testing

```bash
# Test the API endpoint
curl -X POST http://localhost:3000/api/jobs/{jobId}/generate-leads \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"maxLeads": 10}'
```

## Architecture

```
Job Creation/Update
        |
        v
  Job Hooks (Optional)
        |
        v
Auto Lead Generation
        |
        v
Free-Tier Orchestrator
        |
        +-- Apify (LinkedIn)
        +-- Apollo (Email)
        +-- Lusha (Phone)
        +-- Claude AI (Scoring)
        |
        v
    Database (candidates table with jobId)
```

## License

Part of VerticalHire application.
