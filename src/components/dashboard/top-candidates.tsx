'use client'

import { Trophy } from 'lucide-react'

export interface TopCandidateItem {
  id: string
  name: string
  title: string
  score: number
}

interface TopCandidatesProps {
  candidates: TopCandidateItem[]
}

const avatarColors = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-purple-600',
  'bg-blue-600',
  'bg-amber-600',
]

export function TopCandidates({ candidates }: TopCandidatesProps) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          No scored candidates yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          AI-scored candidates will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {candidates.map((candidate, index) => (
        <div key={candidate.id} className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColors[index % avatarColors.length]}`}
          >
            {candidate.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{candidate.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {candidate.title}
            </p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
            {candidate.score}
          </div>
        </div>
      ))}
    </div>
  )
}
