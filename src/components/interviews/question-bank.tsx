'use client'

import { useState } from 'react'
import { Plus, Search, Edit2, Trash2, Clock, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { QuestionTemplate } from '@/app/api/question-templates/route'

const categoryColors: Record<string, string> = {
  behavioral: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  technical: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  situational: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  culture_fit: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  problem_solving: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
}

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

interface QuestionBankProps {
  onSelectQuestion?: (question: QuestionTemplate) => void
}

export function QuestionBank({ onSelectQuestion }: QuestionBankProps) {
  const [questions, setQuestions] = useState<QuestionTemplate[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionTemplate | null>(null)

  // Form state
  const [formData, setFormData] = useState<{
    question: string
    category: 'behavioral' | 'technical' | 'situational' | 'culture_fit' | 'problem_solving'
    difficulty: 'easy' | 'medium' | 'hard'
    targetCompetency: string
    expectedDuration: number
    evaluationCriteria: string
    sampleAnswer: string
    tags: string[]
  }>({
    question: '',
    category: 'behavioral',
    difficulty: 'medium',
    targetCompetency: '',
    expectedDuration: 5,
    evaluationCriteria: '',
    sampleAnswer: '',
    tags: [],
  })

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = categoryFilter === 'all' || q.category === categoryFilter
    const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter

    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const handleCreateQuestion = async () => {
    try {
      const response = await fetch('/api/question-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to create question')

      const { template } = await response.json()
      setQuestions([...questions, template])
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error creating question:', error)
      }
    }
  }

  const handleUpdateQuestion = async () => {
    if (!editingQuestion) return

    try {
      const response = await fetch(`/api/question-templates/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to update question')

      const { template } = await response.json()
      setQuestions(questions.map(q => q.id === template.id ? template : q))
      setEditingQuestion(null)
      resetForm()
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating question:', error)
      }
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const response = await fetch(`/api/question-templates/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete question')

      setQuestions(questions.filter(q => q.id !== id))
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting question:', error)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      question: '',
      category: 'behavioral',
      difficulty: 'medium',
      targetCompetency: '',
      expectedDuration: 5,
      evaluationCriteria: '',
      sampleAnswer: '',
      tags: [],
    })
  }

  const openEditDialog = (question: QuestionTemplate) => {
    setEditingQuestion(question)
    setFormData({
      question: question.question,
      category: question.category,
      difficulty: question.difficulty,
      targetCompetency: question.targetCompetency,
      expectedDuration: question.expectedDuration,
      evaluationCriteria: question.evaluationCriteria,
      sampleAnswer: question.sampleAnswer || '',
      tags: question.tags,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Question Bank</h2>
          <p className="text-sm text-muted-foreground">
            Manage reusable interview questions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Question Template</DialogTitle>
            </DialogHeader>
            <QuestionForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateQuestion}
              onCancel={() => {
                setIsCreateDialogOpen(false)
                resetForm()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="behavioral">Behavioral</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="situational">Situational</SelectItem>
            <SelectItem value="culture_fit">Culture Fit</SelectItem>
            <SelectItem value="problem_solving">Problem Solving</SelectItem>
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Questions Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredQuestions.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery || categoryFilter !== 'all' || difficultyFilter !== 'all'
                  ? 'No questions match your filters'
                  : 'No questions yet. Create your first question to get started!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredQuestions.map((question) => (
            <Card key={question.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={categoryColors[question.category]}>
                        {question.category.replace('_', ' ')}
                      </Badge>
                      <Badge className={difficultyColors[question.difficulty]}>
                        {question.difficulty}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {question.expectedDuration} min
                      </div>
                    </div>
                    <CardTitle className="text-base leading-tight">
                      {question.question}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(question)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Target Competency
                  </p>
                  <p className="text-sm">{question.targetCompetency}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Evaluation Criteria
                  </p>
                  <p className="text-sm line-clamp-2">{question.evaluationCriteria}</p>
                </div>
                {question.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {question.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {onSelectQuestion && (
                  <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectQuestion(question)}
                  >
                    Use This Question
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      {editingQuestion && (
        <Dialog open={!!editingQuestion} onOpenChange={() => setEditingQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Question Template</DialogTitle>
            </DialogHeader>
            <QuestionForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleUpdateQuestion}
              onCancel={() => {
                setEditingQuestion(null)
                resetForm()
              }}
              isEdit
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface QuestionFormProps {
  formData: any
  setFormData: (data: any) => void
  onSubmit: () => void
  onCancel: () => void
  isEdit?: boolean
}

function QuestionForm({ formData, setFormData, onSubmit, onCancel, isEdit }: QuestionFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="question">Question *</Label>
        <Textarea
          id="question"
          value={formData.question}
          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          placeholder="Enter the interview question..."
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="behavioral">Behavioral</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="situational">Situational</SelectItem>
              <SelectItem value="culture_fit">Culture Fit</SelectItem>
              <SelectItem value="problem_solving">Problem Solving</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="difficulty">Difficulty *</Label>
          <Select
            value={formData.difficulty}
            onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
          >
            <SelectTrigger id="difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="targetCompetency">Target Competency *</Label>
          <Input
            id="targetCompetency"
            value={formData.targetCompetency}
            onChange={(e) => setFormData({ ...formData, targetCompetency: e.target.value })}
            placeholder="e.g., Technical Skills"
            required
          />
        </div>

        <div>
          <Label htmlFor="expectedDuration">Expected Duration (minutes) *</Label>
          <Input
            id="expectedDuration"
            type="number"
            min="1"
            max="60"
            value={formData.expectedDuration}
            onChange={(e) => setFormData({ ...formData, expectedDuration: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="evaluationCriteria">Evaluation Criteria *</Label>
        <Textarea
          id="evaluationCriteria"
          value={formData.evaluationCriteria}
          onChange={(e) => setFormData({ ...formData, evaluationCriteria: e.target.value })}
          placeholder="What to look for in the candidate's answer..."
          rows={3}
          required
        />
      </div>

      <div>
        <Label htmlFor="sampleAnswer">Sample Answer (Optional)</Label>
        <Textarea
          id="sampleAnswer"
          value={formData.sampleAnswer}
          onChange={(e) => setFormData({ ...formData, sampleAnswer: e.target.value })}
          placeholder="Ideal answer or key points..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags.join(', ')}
          onChange={(e) => setFormData({
            ...formData,
            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
          })}
          placeholder="e.g., leadership, problem-solving"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {isEdit ? 'Update' : 'Create'} Question
        </Button>
      </DialogFooter>
    </div>
  )
}
