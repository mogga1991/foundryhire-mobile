import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      variant: {
        hot: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        warm: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        cold: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        contacted: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
        interview: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
        applied: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        screening: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        offer: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        hired: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
        rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
        withdrawn: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      },
    },
    defaultVariants: {
      variant: "new",
    },
  }
)

// Status label mapping for display
const statusLabels: Record<string, string> = {
  hot: "Hot Lead",
  warm: "Warm Lead",
  cold: "Cold Lead",
  new: "New",
  contacted: "Contacted",
  interview: "Interview",
  applied: "Applied",
  screening: "Screening",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status?: string
}

function StatusBadge({
  className,
  variant,
  status,
  children,
  ...props
}: StatusBadgeProps) {
  // Determine variant from status prop if not explicitly set
  const badgeVariant = variant || (status?.toLowerCase() as any) || "new"

  // Get display label
  const displayLabel = children || statusLabels[badgeVariant] || status || "Unknown"

  return (
    <span
      data-slot="status-badge"
      data-variant={badgeVariant}
      className={cn(statusBadgeVariants({ variant: badgeVariant }), className)}
      {...props}
    >
      {displayLabel}
    </span>
  )
}

export { StatusBadge, statusBadgeVariants }
