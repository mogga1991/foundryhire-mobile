'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardStep {
  id: number
  title: string
  description: string
}

interface CampaignWizardProps {
  steps: WizardStep[]
  currentStep: number
  children: React.ReactNode
}

export function CampaignWizard({ steps, currentStep, children }: CampaignWizardProps) {
  return (
    <div className="space-y-8">
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id
            const isCurrent = currentStep === step.id
            const isLast = index === steps.length - 1

            return (
              <li
                key={step.id}
                className={cn('relative', !isLast && 'flex-1')}
              >
                <div className="flex items-center">
                  <div
                    className={cn(
                      'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                      isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'border-primary bg-background text-primary'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.id
                    )}
                  </div>

                  {!isLast && (
                    <div
                      className={cn(
                        'ml-2 mr-2 h-0.5 w-full transition-colors',
                        isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    />
                  )}
                </div>

                <div className="mt-2">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isCurrent || isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      <div>{children}</div>
    </div>
  )
}
