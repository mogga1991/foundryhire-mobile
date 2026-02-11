'use client'

import { useState } from 'react'
import { Plus, X, GripVertical, Clock, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { QuestionTemplate } from '@/app/api/question-templates/route'

interface InterviewTemplateBuilderProps {
  availableQuestions: QuestionTemplate[]
}

export function InterviewTemplateBuilder({ availableQuestions }: InterviewTemplateBuilderProps) {
  const [templateName, setTemplateName] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionTemplate[]>([])

  const totalDuration = selectedQuestions.reduce((sum, q) => sum + q.expectedDuration, 0)

  const addQuestion = (question: QuestionTemplate) => {
    if (!selectedQuestions.find(q => q.id === question.id)) {
      setSelectedQuestions([...selectedQuestions, question])
    }
  }

  const removeQuestion = (id: string) => {
    setSelectedQuestions(selectedQuestions.filter(q => q.id !== id))
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...selectedQuestions]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    if (targetIndex >= 0 && targetIndex < newQuestions.length) {
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]]
      setSelectedQuestions(newQuestions)
    }
  }

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name')
      return
    }

    const template = {
      name: templateName,
      questions: selectedQuestions.map(q => q.id),
      totalDuration,
    }

    // In production, save this to the database
    console.log('Saving template:', template)
    alert('Template saved successfully!')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interview Template Builder</h2>
        <p className="text-sm text-muted-foreground">
          Create structured interview plans from your question bank
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Question Bank */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Question Bank</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {availableQuestions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No questions available. Create some questions first!
                </CardContent>
              </Card>
            ) : (
              availableQuestions.map((question) => (
                <Card
                  key={question.id}
                  className={cn(
                    'cursor-pointer hover:bg-accent/50 transition-colors',
                    selectedQuestions.find(q => q.id === question.id) && 'opacity-50'
                  )}
                  onClick={() => addQuestion(question)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-tight">
                          {question.question}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {question.category.replace('_', ' ')}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {question.expectedDuration} min
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          addQuestion(question)
                        }}
                        disabled={!!selectedQuestions.find(q => q.id === question.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Selected Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Interview Template</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Total: {totalDuration} min
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Senior Frontend Interview"
                className="mt-1"
              />
            </div>

            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
              {selectedQuestions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Select questions from the bank to build your interview
                  </CardContent>
                </Card>
              ) : (
                selectedQuestions.map((question, index) => (
                  <Card key={question.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1 mt-1">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => moveQuestion(index, 'up')}
                            disabled={index === 0}
                          >
                            ▲
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => moveQuestion(index, 'down')}
                            disabled={index === selectedQuestions.length - 1}
                          >
                            ▼
                          </Button>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              Q{index + 1}
                            </span>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeQuestion(question.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm leading-tight">{question.question}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {question.category.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {question.difficulty}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {question.expectedDuration} min
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {selectedQuestions.length > 0 && (
              <Button
                className="w-full gap-2"
                onClick={saveTemplate}
                disabled={!templateName.trim()}
              >
                <Save className="h-4 w-4" />
                Save Template
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
