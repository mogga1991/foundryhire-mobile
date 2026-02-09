'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Award,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface ResumeAnalysisData {
  summary: string
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  certifications: string[]
  greenFlags: string[]
  redFlags: string[]
  recommendation: string
}

interface ResumeAnalysisProps {
  analysis: ResumeAnalysisData
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRecommendationConfig(recommendation: string) {
  switch (recommendation) {
    case 'strong_fit':
      return {
        label: 'Strong Fit',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      }
    case 'good_fit':
      return {
        label: 'Good Fit',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      }
    case 'potential_fit':
      return {
        label: 'Potential Fit',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      }
    case 'weak_fit':
      return {
        label: 'Weak Fit',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      }
    case 'not_a_fit':
      return {
        label: 'Not a Fit',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      }
    default:
      return {
        label: recommendation,
        className: 'bg-muted text-muted-foreground',
      }
  }
}

// ============================================================================
// ResumeAnalysis Component
// ============================================================================

export function ResumeAnalysis({ analysis }: ResumeAnalysisProps) {
  const recommendationConfig = getRecommendationConfig(analysis.recommendation)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" />
            Resume Analysis
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
              recommendationConfig.className
            )}
          >
            {recommendationConfig.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary */}
        <div>
          <h4 className="text-sm font-medium mb-2">Summary</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {analysis.summary}
          </p>
        </div>

        <Separator />

        {/* Skills */}
        <div>
          <h4 className="text-sm font-medium mb-2">Skills ({analysis.skills.length})</h4>
          <div className="flex flex-wrap gap-1.5">
            {analysis.skills.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs font-normal">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Experience Timeline */}
        {analysis.experience.length > 0 && (
          <>
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <Briefcase className="size-3.5" />
                Experience
              </h4>
              <div className="space-y-3">
                {analysis.experience.map((exp, index) => (
                  <div key={index} className="relative pl-4 border-l-2 border-muted pb-3 last:pb-0">
                    <div className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {exp.company} &middot; {exp.duration}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {exp.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Education */}
        {analysis.education.length > 0 && (
          <>
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <GraduationCap className="size-3.5" />
                Education
              </h4>
              <div className="space-y-2">
                {analysis.education.map((edu, index) => (
                  <div key={index}>
                    <p className="text-sm font-medium">{edu.degree}</p>
                    <p className="text-xs text-muted-foreground">
                      {edu.institution} &middot; {edu.year}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Certifications */}
        {analysis.certifications.length > 0 && (
          <>
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Award className="size-3.5" />
                Certifications
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.certifications.map((cert) => (
                  <Badge key={cert} variant="secondary" className="text-xs font-normal">
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Green Flags */}
        {analysis.greenFlags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-emerald-700 dark:text-emerald-400">
              Green Flags
            </h4>
            <ul className="space-y-1.5">
              {analysis.greenFlags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {analysis.redFlags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-orange-700 dark:text-orange-400">
              Red Flags
            </h4>
            <ul className="space-y-1.5">
              {analysis.redFlags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <AlertCircle className="size-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
