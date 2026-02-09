'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface SkillsMatchProps {
  requiredSkills: string[]
  candidateSkills: string[]
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[^a-z0-9\s+#]/g, '')
}

function isSkillMatch(required: string, candidateSkills: string[]): boolean {
  const normalizedRequired = normalizeSkill(required)
  return candidateSkills.some((cs) => {
    const normalizedCandidate = normalizeSkill(cs)
    return (
      normalizedCandidate === normalizedRequired ||
      normalizedCandidate.includes(normalizedRequired) ||
      normalizedRequired.includes(normalizedCandidate)
    )
  })
}

// ============================================================================
// SkillsMatch Component
// ============================================================================

export function SkillsMatch({ requiredSkills, candidateSkills }: SkillsMatchProps) {
  const matchedCount = requiredSkills.filter((skill) =>
    isSkillMatch(skill, candidateSkills)
  ).length
  const matchPercent =
    requiredSkills.length > 0
      ? Math.round((matchedCount / requiredSkills.length) * 100)
      : 0

  const getProgressColor = (percent: number): string => {
    if (percent >= 80) return '[&>[data-slot=progress-indicator]]:bg-emerald-500'
    if (percent >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500'
    return '[&>[data-slot=progress-indicator]]:bg-red-500'
  }

  const getPercentColor = (percent: number): string => {
    if (percent >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (percent >= 50) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4" />
          Skills Match
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Match Percentage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {matchedCount} of {requiredSkills.length} required skills matched
            </span>
            <span className={cn('font-semibold', getPercentColor(matchPercent))}>
              {matchPercent}%
            </span>
          </div>
          <Progress
            value={matchPercent}
            className={cn('h-2.5', getProgressColor(matchPercent))}
          />
        </div>

        {/* Skills List */}
        <div className="space-y-1.5">
          {requiredSkills.map((skill) => {
            const matched = isSkillMatch(skill, candidateSkills)
            return (
              <div
                key={skill}
                className={cn(
                  'flex items-center gap-2 py-1.5 px-2 rounded-md text-sm',
                  matched
                    ? 'bg-emerald-50 dark:bg-emerald-950/20'
                    : 'bg-red-50 dark:bg-red-950/20'
                )}
              >
                {matched ? (
                  <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="size-4 text-red-500 dark:text-red-400 shrink-0" />
                )}
                <span
                  className={cn(
                    matched
                      ? 'text-emerald-800 dark:text-emerald-300'
                      : 'text-red-800 dark:text-red-300'
                  )}
                >
                  {skill}
                </span>
              </div>
            )
          })}
        </div>

        {requiredSkills.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No required skills specified for this job.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
