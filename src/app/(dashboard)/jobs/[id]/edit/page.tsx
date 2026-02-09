'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JobForm } from '@/components/jobs/job-form'
import { useJob } from '@/hooks/use-jobs'

export default function EditJobPage() {
  const params = useParams()
  const id = params.id as string
  const { data: job, loading, error } = useJob(id)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/jobs/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to Job</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Job Not Found</h1>
            <p className="text-muted-foreground text-sm">
              {error || 'The job you are trying to edit could not be found.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/jobs/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to Job</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Job</h1>
          <p className="text-muted-foreground text-sm">
            Update the details for {job.title}.
          </p>
        </div>
      </div>

      <JobForm
        jobId={id}
        initialData={{
          title: job.title,
          location: job.location ?? '',
          department: job.department ?? '',
          employment_type: job.employmentType ?? 'Full-time',
          experience_level: job.experienceLevel ?? '',
          salary_min: job.salaryMin ?? undefined,
          salary_max: job.salaryMax ?? undefined,
          salary_currency: job.salaryCurrency ?? 'USD',
          skills_required: job.skillsRequired ?? [],
          skills_preferred: job.skillsPreferred ?? [],
          description: job.description ?? '',
          status: job.status as 'draft' | 'active',
        }}
      />
    </div>
  )
}
