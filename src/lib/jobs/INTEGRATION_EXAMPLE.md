# Integration Example: Automatic Lead Generation

This document shows how to integrate the automated lead generation system with your job creation workflow.

## Option 1: Trigger on Job Creation (Immediate)

Modify `/api/jobs` POST endpoint to automatically generate leads when a job is created:

```typescript
// src/app/api/jobs/route.ts

import { onJobCreated } from '@/lib/jobs/job-hooks'

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const body = await request.json()

    // ... validation code ...

    // Create the job
    const [newJob] = await db
      .insert(jobs)
      .values({
        companyId,
        createdBy: user.id,
        title: body.title.trim(),
        // ... other fields ...
      })
      .returning()

    // ============================================================
    // AUTOMATIC LEAD GENERATION
    // ============================================================

    // Option A: Generate leads immediately (blocks response)
    if (body.auto_generate_leads) {
      const hookResult = await onJobCreated(newJob.id, companyId, {
        autoGenerateLeads: true,
        maxLeads: body.max_leads || 20,
      })

      return NextResponse.json({
        data: newJob,
        leadGeneration: hookResult,
        error: null,
      }, { status: 201 })
    }

    return NextResponse.json({ data: newJob, error: null }, { status: 201 })
  } catch (error) {
    // ... error handling ...
  }
}
```

## Option 2: Trigger on Job Publish (When Status Changes to 'active')

Modify the PATCH endpoint to generate leads when a job is published:

```typescript
// src/app/api/jobs/route.ts

import { onJobPublished } from '@/lib/jobs/job-hooks'

export async function PATCH(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()

    // ... existing code ...

    const [updated] = await db
      .update(jobs)
      .set(updateData)
      .where(and(eq(jobs.id, id), eq(jobs.companyId, companyId)))
      .returning()

    // ============================================================
    // AUTOMATIC LEAD GENERATION ON PUBLISH
    // ============================================================

    // If job was just published, generate leads
    if (body.status === 'active' && existing.status !== 'active') {
      // Run async without blocking response
      onJobPublished(updated.id, companyId, {
        generateLeadsOnPublish: true,
        maxLeads: 30,
      }).catch(error => {
        console.error('[Job Publish] Lead generation failed:', error)
      })
    }

    return NextResponse.json({ data: updated, error: null })
  } catch (error) {
    // ... error handling ...
  }
}
```

## Option 3: Background Job (Non-Blocking)

For better performance, run lead generation in the background:

```typescript
// src/app/api/jobs/route.ts

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()
    const body = await request.json()

    // Create the job
    const [newJob] = await db
      .insert(jobs)
      .values({...})
      .returning()

    // ============================================================
    // BACKGROUND LEAD GENERATION (Non-blocking)
    // ============================================================

    if (body.auto_generate_leads !== false) {
      // Fire and forget - don't await
      onJobCreated(newJob.id, companyId, {
        autoGenerateLeads: true,
        maxLeads: body.max_leads || 20,
      }).catch(error => {
        console.error('[Background] Lead generation failed:', error)
      })
    }

    // Return immediately without waiting for lead generation
    return NextResponse.json({
      data: newJob,
      message: 'Job created. Lead generation started in background.',
      error: null
    }, { status: 201 })

  } catch (error) {
    // ... error handling ...
  }
}
```

## Option 4: Client-Triggered (Manual)

Let the client decide when to generate leads:

```typescript
// Client-side code (React/Next.js)

async function createJobWithLeads() {
  // Step 1: Create the job
  const jobResponse = await fetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Senior Construction Manager',
      location: 'Denver, CO',
      // ... other fields
    })
  })

  const { data: newJob } = await jobResponse.json()

  // Step 2: Generate leads for the job
  const leadsResponse = await fetch(`/api/jobs/${newJob.id}/generate-leads`, {
    method: 'POST',
    body: JSON.stringify({
      maxLeads: 25
    })
  })

  const { stats } = await leadsResponse.json()

  console.log(`Generated ${stats.totalLeadsGenerated} leads for job ${newJob.title}`)
}
```

## Option 5: Scheduled/Cron Job

Run lead generation on a schedule for all active jobs:

```typescript
// src/lib/jobs/scheduled-lead-generation.ts

import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { triggerLeadGenerationForJob } from './auto-lead-generation'

export async function generateLeadsForActiveJobs() {
  console.log('[Scheduled] Generating leads for active jobs...')

  // Find all active jobs that need more leads
  const activeJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'active'))

  for (const job of activeJobs) {
    try {
      const stats = await triggerLeadGenerationForJob(
        job.id,
        job.companyId,
        10 // Generate 10 new leads per job
      )

      console.log(`[Scheduled] Generated ${stats.totalLeadsGenerated} leads for job: ${job.title}`)

      // Rate limit: wait 5 seconds between jobs
      await new Promise(resolve => setTimeout(resolve, 5000))

    } catch (error) {
      console.error(`[Scheduled] Failed for job ${job.id}:`, error)
    }
  }

  console.log('[Scheduled] Complete!')
}

// Run with cron (Vercel Cron, etc.)
// Schedule: 0 9 * * * (daily at 9am)
```

## Recommended Approach

**For MVP/Testing**: Use **Option 3** (Background Job)
- Non-blocking
- Simple to implement
- Good user experience

**For Production**: Use **Option 4** (Client-Triggered) or **Option 5** (Scheduled)
- More control
- Better error handling
- Doesn't slow down job creation
- Users can see real-time progress

## Complete Example: Job Creation with Background Lead Generation

```typescript
// src/app/api/jobs/route.ts (POST handler)

import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { jobs } from '@/lib/db/schema'
import { onJobCreated } from '@/lib/jobs/job-hooks'

export async function POST(request: NextRequest) {
  try {
    const { user, companyId } = await requireCompanyAccess()

    const body = await request.json()

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 3) {
      return NextResponse.json(
        { error: 'Job title is required and must be at least 3 characters', data: null },
        { status: 400 }
      )
    }

    const [newJob] = await db
      .insert(jobs)
      .values({
        companyId,
        createdBy: user.id,
        title: body.title.trim(),
        department: body.department ?? null,
        location: body.location ?? null,
        employmentType: body.employment_type ?? null,
        experienceLevel: body.experience_level ?? null,
        salaryMin: body.salary_min ? Number(body.salary_min) : null,
        salaryMax: body.salary_max ? Number(body.salary_max) : null,
        salaryCurrency: body.salary_currency ?? 'USD',
        description: body.description ?? null,
        requirements: body.requirements ?? null,
        responsibilities: body.responsibilities ?? null,
        benefits: body.benefits ?? null,
        skillsRequired: body.skills_required ?? null,
        skillsPreferred: body.skills_preferred ?? null,
        status: body.status === 'active' ? 'active' : 'draft',
        publishedAt: body.status === 'active' ? new Date() : null,
        closesAt: body.closes_at ? new Date(body.closes_at) : null,
      })
      .returning()

    // ============================================================
    // AUTOMATIC LEAD GENERATION (Background, Non-Blocking)
    // ============================================================

    const shouldAutoGenerate = body.auto_generate_leads !== false

    if (shouldAutoGenerate) {
      console.log('[Job Creation] Triggering background lead generation...')

      // Fire and forget - don't await
      onJobCreated(newJob.id, companyId, {
        autoGenerateLeads: true,
        maxLeads: body.max_leads || 20,
      }).catch(error => {
        console.error('[Job Creation] Background lead generation failed:', error)
      })
    }

    return NextResponse.json({
      data: newJob,
      message: shouldAutoGenerate
        ? 'Job created successfully. Lead generation started in background.'
        : 'Job created successfully.',
      error: null
    }, { status: 201 })

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'No company found for user') {
      return NextResponse.json({ error: 'Company not found', data: null }, { status: 404 })
    }
    console.error('POST /api/jobs error:', error)
    return NextResponse.json({ error: 'Internal server error', data: null }, { status: 500 })
  }
}
```

## Testing

```bash
# Create a job with automatic lead generation
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "title": "Construction Project Manager",
    "location": "Austin, TX",
    "auto_generate_leads": true,
    "max_leads": 25
  }'

# Response:
# {
#   "data": { "id": "...", "title": "..." },
#   "message": "Job created successfully. Lead generation started in background.",
#   "error": null
# }

# Check lead generation progress
curl http://localhost:3000/api/jobs/{jobId}/generate-leads \
  -H "Cookie: session=..."
```

## Environment Variables

No additional environment variables needed. The system uses existing integrations:

```env
APIFY_API_TOKEN=your_token
APOLLO_API_KEY=your_key
LUSHA_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```
