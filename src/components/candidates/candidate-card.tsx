'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MapPin, Briefcase, Linkedin, FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Candidate } from '@/lib/types'

// ============================================================================
// Types
// ============================================================================

interface CandidateCardProps {
  candidate: Candidate
  jobId: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  if (score >= 60) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

function getScoreBorderColor(score: number | null): string {
  if (score === null) return 'border-muted'
  if (score >= 80) return 'border-emerald-300 dark:border-emerald-700'
  if (score >= 60) return 'border-amber-300 dark:border-amber-700'
  return 'border-red-300 dark:border-red-700'
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'new':
      return 'default'
    case 'contacted':
      return 'secondary'
    case 'responded':
      return 'outline'
    case 'interviewing':
      return 'default'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function getSourceIcon(source: string | null) {
  switch (source) {
    case 'linkedin':
      return <Linkedin className="size-3" />
    case 'indeed':
      return <FileText className="size-3" />
    case 'manual':
      return <User className="size-3" />
    default:
      return <User className="size-3" />
  }
}

function getSourceLabel(source: string | null): string {
  switch (source) {
    case 'linkedin':
      return 'LinkedIn'
    case 'indeed':
      return 'Indeed'
    case 'manual':
      return 'Manual'
    case 'csv':
      return 'CSV Import'
    case 'referral':
      return 'Referral'
    default:
      return source || 'Direct'
  }
}

// ============================================================================
// CandidateCard Component
// ============================================================================

export function CandidateCard({ candidate, jobId }: CandidateCardProps) {
  const router = useRouter()

  const handleClick = () => {
    router.push(`/jobs/${jobId}/candidates/${candidate.id}`)
  }

  const displaySkills = (candidate.skills || []).slice(0, 3)
  const remainingSkills = (candidate.skills || []).length - 3

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20 py-0"
      onClick={handleClick}
    >
      <CardContent className="flex items-center gap-4 py-4 px-6">
        {/* Avatar */}
        <Avatar className="size-12 shrink-0">
          {candidate.profileImageUrl && (
            <AvatarImage src={candidate.profileImageUrl} alt={`${candidate.firstName} ${candidate.lastName}`} />
          )}
          <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
            {getInitials(candidate.firstName, candidate.lastName)}
          </AvatarFallback>
        </Avatar>

        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">
              {candidate.firstName} {candidate.lastName}
            </h3>
            <Badge variant={getStatusBadgeVariant(candidate.status)} className="text-[10px] shrink-0">
              {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
            </Badge>
          </div>

          {/* Title & Company */}
          {(candidate.currentTitle || candidate.currentCompany) && (
            <p className="text-sm text-muted-foreground truncate mb-1.5">
              {candidate.currentTitle}
              {candidate.currentTitle && candidate.currentCompany && ' @ '}
              {candidate.currentCompany}
            </p>
          )}

          {/* Meta Info Row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {candidate.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {candidate.location}
              </span>
            )}
            {candidate.experienceYears !== null && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3" />
                {candidate.experienceYears} yrs exp
              </span>
            )}
            {candidate.source && (
              <span className="inline-flex items-center gap-1">
                {getSourceIcon(candidate.source)}
                {getSourceLabel(candidate.source)}
              </span>
            )}
          </div>
        </div>

        {/* Skills Badges */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {displaySkills.map((skill) => (
            <Badge key={skill} variant="outline" className="text-[10px] font-normal">
              {skill}
            </Badge>
          ))}
          {remainingSkills > 0 && (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              +{remainingSkills}
            </Badge>
          )}
        </div>

        {/* AI Match Score */}
        <div
          className={cn(
            'flex items-center justify-center size-12 rounded-full border-2 shrink-0',
            getScoreColor(candidate.aiScore),
            getScoreBorderColor(candidate.aiScore)
          )}
        >
          <span className="text-sm font-bold">
            {candidate.aiScore !== null ? candidate.aiScore : '--'}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
