import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs, candidates, companyUsers } from '@/lib/db/schema'
import { eq, and, isNotNull, desc } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { JobList } from '@/components/jobs/job-list'
import { CreateJobDialog } from '@/components/jobs/create-job-dialog'

export const metadata = {
  title: 'Jobs | VerticalHire',
  description: 'Manage your job postings',
}

export default async function JobsPage() {
  const session = await getSession({ allowGuest: true })

  if (!session) {
    redirect('/login')
  }

  const user = session.user

  // Get the user's company
  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  if (!companyUser) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="size-7 sm:size-8 shrink-0" />
            Jobs
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your job postings and track candidates.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
          <Briefcase className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No company set up yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Set up your company profile in settings to start creating job postings.
          </p>
          <Link href="/settings/company">
            <Button>Go to Company Settings</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all jobs for this company
  const jobsList = await db
    .select()
    .from(jobs)
    .where(eq(jobs.companyId, companyUser.companyId))
    .orderBy(desc(jobs.createdAt))

  // Fetch candidate counts per job
  const candidatesRaw = await db
    .select({ jobId: candidates.jobId })
    .from(candidates)
    .where(
      and(
        eq(candidates.companyId, companyUser.companyId),
        isNotNull(candidates.jobId)
      )
    )

  const candidateCounts: Record<string, number> = {}
  for (const c of candidatesRaw) {
    if (c.jobId) {
      candidateCounts[c.jobId] = (candidateCounts[c.jobId] ?? 0) + 1
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="size-7 sm:size-8 shrink-0" />
            Jobs
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your job postings and track candidates.
          </p>
        </div>
        <div className="sm:shrink-0">
          <CreateJobDialog />
        </div>
      </div>

      {/* Job List */}
      <JobList jobs={jobsList} candidateCounts={candidateCounts} />
    </div>
  )
}
