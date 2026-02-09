'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PenSquare, Sparkles } from 'lucide-react'

interface JobCreationChoiceProps {
  onSelectManual: () => void
  onSelectAI: () => void
}

export function JobCreationChoice({ onSelectManual, onSelectAI }: JobCreationChoiceProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create New Job Posting</h1>
        <p className="text-muted-foreground text-lg">
          Choose how you'd like to create this job
        </p>
      </div>

      {/* Two Option Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Entry Card */}
        <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all cursor-pointer group">
          <CardHeader className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
              <PenSquare className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-2xl">Manual Entry</CardTitle>
              <CardDescription className="text-base mt-2">
                Fill out all fields step by step
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Complete control over every field</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>Guided 4-step form process</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>AI-assisted description generation</span>
              </li>
            </ul>
            <Button
              onClick={onSelectManual}
              size="lg"
              className="w-full group-hover:shadow-md transition-shadow"
            >
              Start Manual Form
            </Button>
          </CardContent>
        </Card>

        {/* AI Upload Card */}
        <Card className="relative overflow-hidden border-2 hover:border-purple-500/50 transition-all cursor-pointer group bg-gradient-to-br from-background to-purple-50/20 dark:to-purple-950/10">
          <CardHeader className="space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                AI-Powered Upload
                <span className="text-xs font-normal px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  Faster
                </span>
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Upload job description and let AI extract information
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">✨</span>
                <span>Upload PDF, DOC, or DOCX file</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">✨</span>
                <span>AI automatically fills form fields</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">✨</span>
                <span>Review and complete missing fields</span>
              </li>
            </ul>
            <Button
              onClick={onSelectAI}
              size="lg"
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 group-hover:shadow-md transition-shadow"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <p className="text-center text-sm text-muted-foreground">
        Both methods use the same form interface. Choose what works best for you.
      </p>
    </div>
  )
}
