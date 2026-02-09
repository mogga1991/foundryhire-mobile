'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from 'lucide-react'
import { useState } from 'react'
import { ScheduleInterviewModal } from './schedule-interview-modal'

interface ScheduleInterviewButtonProps {
  candidateId: string
  candidateName: string
  jobId?: string | null
  companyId: string
  variant?: 'default' | 'outline'
  className?: string
}

export function ScheduleInterviewButton({
  candidateId,
  candidateName,
  jobId,
  companyId,
  variant = 'outline',
  className,
}: ScheduleInterviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setIsOpen(true)}
        data-testid="schedule-interview-btn"
      >
        <Calendar className="mr-2 h-4 w-4" />
        Schedule Interview
      </Button>

      <ScheduleInterviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        candidateId={candidateId}
        candidateName={candidateName}
        jobId={jobId}
        companyId={companyId}
      />
    </>
  )
}
