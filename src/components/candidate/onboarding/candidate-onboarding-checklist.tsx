'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface OnboardingTask {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'completed'
  required: boolean
  taskType: string
  dueAt: string | null
}

export function CandidateOnboardingChecklist() {
  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const completed = useMemo(() => tasks.filter((task) => task.status === 'completed').length, [tasks])

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await fetch('/api/candidate/onboarding')
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load onboarding tasks')
      }
      setTasks(payload.tasks ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load onboarding tasks')
    } finally {
      setLoading(false)
    }
  }

  async function markTask(taskId: string, nextStatus: 'pending' | 'completed') {
    setActiveTaskId(taskId)
    try {
      const res = await fetch(`/api/candidate/onboarding/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update task')
      }

      setTasks((prev) => prev.map((task) => (task.id === taskId ? payload.task : task)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update task')
    } finally {
      setActiveTaskId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-900">Onboarding Progress</CardTitle>
          <CardDescription>
            {completed}/{tasks.length} tasks completed
          </CardDescription>
        </CardHeader>
      </Card>

      {loading && <div className="text-sm text-gray-600">Loading onboarding tasks...</div>}

      {!loading && tasks.length === 0 && (
        <Card className="border-orange-200">
          <CardContent className="p-6 text-sm text-gray-600">
            Accept an offer to unlock onboarding requirements.
          </CardContent>
        </Card>
      )}

      {tasks.map((task) => (
        <Card key={task.id} className="border-orange-200">
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {task.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-orange-600" />
                )}
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                {task.required && <Badge variant="secondary">Required</Badge>}
              </div>
              {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
              {task.dueAt && (
                <p className="text-xs text-muted-foreground mt-1">Due {new Date(task.dueAt).toLocaleString()}</p>
              )}
            </div>
            <Button
              size="sm"
              variant={task.status === 'completed' ? 'outline' : 'default'}
              className={task.status === 'completed' ? '' : 'bg-orange-600 hover:bg-orange-700'}
              disabled={activeTaskId === task.id}
              onClick={() => void markTask(task.id, task.status === 'completed' ? 'pending' : 'completed')}
            >
              {activeTaskId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : task.status === 'completed' ? 'Undo' : 'Mark Complete'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
