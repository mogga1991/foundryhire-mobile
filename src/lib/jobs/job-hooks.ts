/**
 * Job Lifecycle Hooks
 *
 * These hooks are triggered during job lifecycle events to perform
 * automated actions like lead generation, notifications, etc.
 */

import { triggerLeadGenerationForJob } from './auto-lead-generation'

/**
 * Hook to run after a job is created
 *
 * This can be called from the job creation API to automatically
 * trigger lead generation when a new job is posted.
 *
 * @param jobId - The ID of the newly created job
 * @param companyId - The ID of the company
 * @param options - Configuration options
 */
export async function onJobCreated(
  jobId: string,
  companyId: string,
  options?: {
    autoGenerateLeads?: boolean
    maxLeads?: number
  }
) {
  const { autoGenerateLeads = false, maxLeads = 20 } = options || {}

  console.log('[Job Hooks] Job created:', jobId)

  // Automatically generate leads if enabled
  if (autoGenerateLeads) {
    console.log('[Job Hooks] Auto-generating leads...')

    try {
      const stats = await triggerLeadGenerationForJob(jobId, companyId, maxLeads)

      console.log('[Job Hooks] Lead generation complete:', {
        leadsGenerated: stats.totalLeadsGenerated,
        saved: stats.savedToDatabase,
      })

      return { leadGenerationStats: stats }
    } catch (error) {
      console.error('[Job Hooks] Lead generation failed:', error)
      // Don't fail the job creation if lead generation fails
      return { leadGenerationError: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  return {}
}

/**
 * Hook to run when a job is published (status changes to 'active')
 *
 * @param jobId - The ID of the job being published
 * @param companyId - The ID of the company
 * @param options - Configuration options
 */
export async function onJobPublished(
  jobId: string,
  companyId: string,
  options?: {
    generateLeadsOnPublish?: boolean
    maxLeads?: number
  }
) {
  const { generateLeadsOnPublish = true, maxLeads = 30 } = options || {}

  console.log('[Job Hooks] Job published:', jobId)

  // Generate leads when job is published (if not already done)
  if (generateLeadsOnPublish) {
    console.log('[Job Hooks] Generating leads for published job...')

    try {
      const stats = await triggerLeadGenerationForJob(jobId, companyId, maxLeads)

      console.log('[Job Hooks] Lead generation complete:', {
        leadsGenerated: stats.totalLeadsGenerated,
        saved: stats.savedToDatabase,
      })

      return { leadGenerationStats: stats }
    } catch (error) {
      console.error('[Job Hooks] Lead generation failed:', error)
      return { leadGenerationError: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  return {}
}
