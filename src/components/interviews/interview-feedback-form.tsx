'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Send } from 'lucide-react'

interface InterviewFeedbackFormProps {
  interviewId: string
}

const recommendations = [
  { value: 'strong_hire', label: 'Strong Hire', color: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'hire', label: 'Hire', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'maybe', label: 'Maybe', color: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
  { value: 'no_hire', label: 'No Hire', color: 'border-red-400 bg-red-50 text-red-600' },
  { value: 'strong_no_hire', label: 'Strong No', color: 'border-red-600 bg-red-100 text-red-800' },
]

export function InterviewFeedbackForm({ interviewId }: InterviewFeedbackFormProps) {
  const [rating, setRating] = useState<number>(0)
  const [recommendation, setRecommendation] = useState<string>('')
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/interviews/${interviewId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, recommendation, feedbackText }),
      })
      if (!res.ok) throw new Error('Failed to submit feedback')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <p className="text-green-600 font-medium">Feedback submitted successfully!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Add Your Feedback</h4>

      {/* Rating */}
      <div className="space-y-2">
        <Label>Rating (1-10)</Label>
        <div className="flex gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                rating >= n
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="space-y-2">
        <Label>Recommendation</Label>
        <div className="flex flex-wrap gap-2">
          {recommendations.map((rec) => (
            <button
              key={rec.value}
              onClick={() => setRecommendation(rec.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition ${
                recommendation === rec.value
                  ? rec.color
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {rec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Text */}
      <div className="space-y-2">
        <Label>Comments</Label>
        <Textarea
          placeholder="Share your thoughts on the candidate's performance..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="gap-2">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit Feedback
          </>
        )}
      </Button>
    </div>
  )
}
