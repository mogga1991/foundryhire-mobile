import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const matchScoreBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      variant: {
        hot: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
        warm: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
        cold: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      },
    },
    defaultVariants: {
      variant: "cold",
    },
  }
)

export interface MatchScoreBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof matchScoreBadgeVariants> {
  score: number
  showLabel?: boolean
}

function getScoreVariant(score: number): "hot" | "warm" | "cold" {
  if (score >= 75) return "hot"
  if (score >= 50) return "warm"
  return "cold"
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Hot"
  if (score >= 50) return "Warm"
  return "Cold"
}

function MatchScoreBadge({
  className,
  variant,
  score,
  showLabel = false,
  children,
  ...props
}: MatchScoreBadgeProps) {
  // Clamp score between 0 and 100
  const clampedScore = Math.min(100, Math.max(0, score))

  // Determine variant from score if not explicitly set
  const badgeVariant = variant || getScoreVariant(clampedScore)

  return (
    <span
      data-slot="match-score-badge"
      data-variant={badgeVariant}
      data-score={clampedScore}
      className={cn(matchScoreBadgeVariants({ variant: badgeVariant }), className)}
      {...props}
    >
      {children || (
        <>
          {clampedScore}%
          {showLabel && ` ${getScoreLabel(clampedScore)}`}
        </>
      )}
    </span>
  )
}

export { MatchScoreBadge, matchScoreBadgeVariants, getScoreVariant, getScoreLabel }
