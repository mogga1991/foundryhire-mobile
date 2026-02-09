import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Linkedin, Twitter, Instagram, Database, Search } from "lucide-react"

const sourceBadgeVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      variant: {
        linkedin: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        twitter: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
        apify: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
        apollo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        lusha: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        manual: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        upload: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Source icon mapping
const sourceIcons: Record<string, React.ElementType> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  apify: Database,
  apollo: Search,
  lusha: Database,
  manual: Database,
  upload: Database,
}

// Source label mapping for display
const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter",
  instagram: "Instagram",
  apify: "Apify",
  apollo: "Apollo",
  lusha: "Lusha",
  manual: "Manual",
  upload: "Upload",
}

export interface SourceBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof sourceBadgeVariants> {
  source?: string
  showIcon?: boolean
  showText?: boolean
  iconOnly?: boolean
}

function SourceBadge({
  className,
  variant,
  source,
  showIcon = true,
  showText = true,
  iconOnly = false,
  children,
  ...props
}: SourceBadgeProps) {
  // Determine variant from source prop if not explicitly set
  const badgeVariant = variant || (source?.toLowerCase() as any) || "default"

  // Get icon component
  const IconComponent = sourceIcons[badgeVariant] || Database

  // Get display label
  const displayLabel = sourceLabels[badgeVariant] || source || "Unknown"

  // If iconOnly, only show text
  if (iconOnly) {
    showIcon = true
    showText = false
  }

  return (
    <span
      data-slot="source-badge"
      data-variant={badgeVariant}
      className={cn(
        sourceBadgeVariants({ variant: badgeVariant }),
        iconOnly && "px-1.5",
        className
      )}
      {...props}
    >
      {showIcon && <IconComponent className="size-3 shrink-0" />}
      {showText && (children || displayLabel)}
    </span>
  )
}

export { SourceBadge, sourceBadgeVariants }
