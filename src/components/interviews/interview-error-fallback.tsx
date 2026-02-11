'use client'

import { AlertTriangle, RefreshCw, Video, FileText, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface InterviewErrorFallbackProps {
  section: 'video' | 'transcript' | 'analytics' | 'general'
  error?: Error
  onReset?: () => void
  className?: string
}

const sectionConfig = {
  video: {
    icon: Video,
    title: 'Video Player Error',
    description: 'There was a problem loading the interview recording.',
    actions: [
      { label: 'Reload video', primary: true },
      { label: 'Download recording', primary: false, href: '#download' },
    ],
  },
  transcript: {
    icon: FileText,
    title: 'Transcript Error',
    description: 'There was a problem loading the interview transcript.',
    actions: [
      { label: 'Refresh transcript', primary: true },
      { label: 'View raw text', primary: false },
    ],
  },
  analytics: {
    icon: BarChart3,
    title: 'Analytics Error',
    description: 'There was a problem loading the analytics data.',
    actions: [
      { label: 'Reload analytics', primary: true },
      { label: 'Refresh page', primary: false },
    ],
  },
  general: {
    icon: AlertTriangle,
    title: 'Error Loading Section',
    description: 'There was a problem loading this section of the interview.',
    actions: [
      { label: 'Try again', primary: true },
    ],
  },
}

export function InterviewErrorFallback({
  section,
  error,
  onReset,
  className,
}: InterviewErrorFallbackProps) {
  const config = sectionConfig[section]
  const Icon = config.icon

  const handleReset = () => {
    if (onReset) {
      onReset()
    } else {
      window.location.reload()
    }
  }

  return (
    <Card className={cn('border-destructive/50', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Icon className="h-5 w-5" />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {config.description}
          </p>

          {error && process.env.NODE_ENV === 'development' && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Technical details (dev only)
              </summary>
              <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-24">
                {error.message}
              </pre>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            {config.actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.primary ? 'default' : 'outline'}
                size="sm"
                onClick={action.primary ? handleReset : undefined}
                className="gap-2"
              >
                {action.primary && <RefreshCw className="h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            If this problem continues, please contact support.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
