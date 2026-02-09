'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Sparkles, FileSearch, ListChecks, Briefcase, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const parsingSteps = [
  {
    label: 'Analyzing document',
    icon: Sparkles,
    delay: 0,
  },
  {
    label: 'Extracting job details',
    icon: FileSearch,
    delay: 2000,
  },
  {
    label: 'Parsing requirements',
    icon: ListChecks,
    delay: 4000,
  },
  {
    label: 'Identifying skills',
    icon: Briefcase,
    delay: 6000,
  },
]

export function AIParsingLoader() {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95 // Stop at 95%, complete when actually done
        return prev + 2
      })
    }, 200)

    // Update current step
    const stepTimers = parsingSteps.map((step, index) => {
      return setTimeout(() => {
        setCurrentStep(index)
      }, step.delay)
    })

    return () => {
      clearInterval(progressInterval)
      stepTimers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
              <Sparkles className="h-8 w-8 text-white animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold">AI Analysis in Progress</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we extract job information...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {progress}% complete
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {parsingSteps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-3 transition-all',
                    isActive && 'bg-purple-50 dark:bg-purple-950/20',
                    isCompleted && 'opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-purple-600',
                      isCompleted && 'bg-green-600',
                      !isActive && !isCompleted && 'bg-muted'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    ) : (
                      <StepIcon
                        className={cn(
                          'h-4 w-4',
                          isActive && 'text-white animate-pulse',
                          !isActive && 'text-muted-foreground'
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isActive && 'text-purple-900 dark:text-purple-100',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Footer Note */}
          <p className="text-xs text-center text-muted-foreground">
            This usually takes 10-15 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
