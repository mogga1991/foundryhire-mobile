'use client'

import { useState } from 'react'
import { Star, CheckCircle2, Loader2, MessageSquare, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PostInterviewFeedbackProps {
  token: string
  onSubmitSuccess?: () => void
}

export function PostInterviewFeedback({ token, onSubmitSuccess }: PostInterviewFeedbackProps) {
  const [overallRating, setOverallRating] = useState(0)
  const [fairProfessional, setFairProfessional] = useState<'yes' | 'no' | 'somewhat' | null>(null)
  const [jobClarityRating, setJobClarityRating] = useState(0)
  const [comfortRating, setComfortRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState('')
  const [wouldRecommend, setWouldRecommend] = useState<'yes' | 'no' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (overallRating === 0) {
      setError('Please provide an overall rating')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/portal/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overallRating,
          fairProfessional,
          jobClarityRating,
          comfortRating,
          feedbackText: feedbackText.trim() || null,
          wouldRecommend,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to submit feedback')
      }

      setIsSubmitted(true)
      onSubmitSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center" role="alert" aria-live="polite">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
            <p className="text-gray-600">
              Your feedback has been submitted. We appreciate you taking the time to share your experience.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-orange-500" />
          Share Your Interview Experience
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Your feedback is anonymous and helps us improve the interview process.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall Experience Rating */}
          <div>
            <label className="block text-sm font-medium mb-3" id="overall-rating-label">
              Overall Experience <span className="text-red-500" aria-label="required">*</span>
            </label>
            <div
              className="flex items-center gap-2"
              role="radiogroup"
              aria-labelledby="overall-rating-label"
              aria-required="true"
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setOverallRating(rating)}
                  className={cn(
                    'transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded',
                    rating <= overallRating ? 'text-orange-500' : 'text-gray-300'
                  )}
                  role="radio"
                  aria-checked={overallRating === rating}
                  aria-label={`Rate ${rating} out of 5 stars`}
                >
                  <Star className="h-8 w-8" fill={rating <= overallRating ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              ))}
              {overallRating > 0 && (
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {overallRating === 5 && 'Excellent'}
                  {overallRating === 4 && 'Good'}
                  {overallRating === 3 && 'Average'}
                  {overallRating === 2 && 'Below Average'}
                  {overallRating === 1 && 'Poor'}
                </span>
              )}
            </div>
          </div>

          {/* Fair and Professional */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Was the interview fair and professional?
            </label>
            <div className="flex gap-3">
              {[
                { value: 'yes' as const, label: 'Yes', color: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' },
                { value: 'somewhat' as const, label: 'Somewhat', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200' },
                { value: 'no' as const, label: 'No', color: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFairProfessional(value)}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg border-2 transition font-medium text-sm',
                    fairProfessional === value
                      ? color
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Job Clarity Rating */}
          <div>
            <label className="block text-sm font-medium mb-3">
              How clear was the job description?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setJobClarityRating(rating)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border-2 transition font-medium text-sm',
                    jobClarityRating === rating
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Not clear</span>
              <span>Very clear</span>
            </div>
          </div>

          {/* Comfort Rating */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Did you feel comfortable expressing yourself?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setComfortRating(rating)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border-2 transition font-medium text-sm',
                    comfortRating === rating
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Not at all</span>
              <span>Very comfortable</span>
            </div>
          </div>

          {/* Free Text Feedback */}
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="feedback-text">
              Additional Feedback (Optional)
            </label>
            <textarea
              id="feedback-text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              maxLength={1000}
              placeholder="Share any additional thoughts about your interview experience..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-sm"
              rows={4}
              aria-describedby="feedback-helper-text"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span id="feedback-helper-text">This is optional and anonymous</span>
              <span aria-live="polite">{feedbackText.length}/1000</span>
            </div>
          </div>

          {/* Would Recommend */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Would you recommend this company to other candidates?
            </label>
            <div className="flex gap-3">
              {[
                { value: 'yes' as const, label: 'Yes', icon: ThumbsUp, color: 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200' },
                { value: 'no' as const, label: 'No', icon: ThumbsUp, color: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200' },
              ].map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWouldRecommend(value)}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg border-2 transition font-medium text-sm flex items-center justify-center gap-2',
                    wouldRecommend === value
                      ? color
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  <Icon className={cn('h-4 w-4', value === 'no' && 'rotate-180')} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || overallRating === 0}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your feedback is completely anonymous and helps us improve the interview process
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
