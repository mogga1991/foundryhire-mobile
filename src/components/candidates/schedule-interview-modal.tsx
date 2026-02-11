'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Sparkles,
  Calendar,
  Clock,
  Video,
  Mail,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  Phone,
  Briefcase,
} from 'lucide-react'

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  optimalityScore: number
  reasoning: string
  formattedDate: string
  formattedTime: string
}

interface ScheduleInterviewModalProps {
  isOpen: boolean
  onClose: () => void
  candidateId: string
  candidateName: string
  jobId?: string | null
  companyId: string
}

type Step = 'details' | 'loading' | 'select-time' | 'custom-time' | 'confirm' | 'success' | 'error'

export function ScheduleInterviewModal({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  jobId,
  companyId,
}: ScheduleInterviewModalProps) {
  const [step, setStep] = useState<Step>('details')
  const [suggestedSlots, setSuggestedSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [interviewType, setInterviewType] = useState<'video' | 'phone' | 'in_person'>('video')
  const [location, setLocation] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch('/api/interviews/suggest-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, jobId }),
      })
      if (!res.ok) throw new Error('Failed to get time suggestions')
      const data = await res.json()
      setSuggestedSlots(data.slots || [])
      setStep('select-time')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
      setStep('error')
    }
  }, [candidateId, jobId])

  useEffect(() => {
    if (isOpen) {
      setSelectedSlot(null)
      setStep('details')
    }
  }, [isOpen])

  const handleSchedule = async (slot: TimeSlot) => {
    setIsScheduling(true)
    setError(null)
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          jobId,
          scheduledAt: slot.startTime,
          durationMinutes: duration,
          interviewType,
          location: interviewType === 'in_person' ? location : null,
          phoneNumber: interviewType === 'phone' ? phoneNumber : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to schedule interview')
      }
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setIsScheduling(false)
    }
  }

  const handleCustomSchedule = async () => {
    if (!customDate || !customTime) return
    const startTime = new Date(`${customDate}T${customTime}`).toISOString()
    const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString()
    const customSlot: TimeSlot = {
      id: 'custom',
      startTime,
      endTime,
      optimalityScore: 0,
      reasoning: 'Custom time selected',
      formattedDate: new Date(startTime).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      formattedTime: new Date(startTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }
    await handleSchedule(customSlot)
  }

  const handleClose = () => {
    onClose()
    // Reset state after animation
    setTimeout(() => {
      setStep('details')
      setSuggestedSlots([])
      setSelectedSlot(null)
      setInterviewType('video')
      setLocation('')
      setPhoneNumber('')
      setCustomDate('')
      setCustomTime('')
      setDuration(30)
      setError(null)
    }, 200)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="schedule-interview-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            Schedule Interview with {candidateName}
          </DialogTitle>
          <DialogDescription>
            Select an AI-suggested time slot or choose a custom time
          </DialogDescription>
        </DialogHeader>

        {/* Interview Details Step */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Interview Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setInterviewType('video')}
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition ${
                    interviewType === 'video'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Video className="h-5 w-5" />
                  <span className="text-sm font-medium">Video Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInterviewType('phone')}
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition ${
                    interviewType === 'phone'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-sm font-medium">Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInterviewType('in_person')}
                  className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition ${
                    interviewType === 'in_person'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Briefcase className="h-5 w-5" />
                  <span className="text-sm font-medium">In Person</span>
                </button>
              </div>
            </div>

            {interviewType === 'phone' && (
              <div className="space-y-2">
                <Label htmlFor="phone-number">
                  Phone Number <span className="text-destructive" aria-label="required">*</span>
                </Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="Enter phone number for the call"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  aria-required="true"
                  aria-invalid={interviewType === 'phone' && !phoneNumber ? 'true' : 'false'}
                />
                {interviewType === 'phone' && !phoneNumber && (
                  <p className="text-xs text-muted-foreground">Phone number is required for phone interviews</p>
                )}
              </div>
            )}

            {interviewType === 'in_person' && (
              <div className="space-y-2">
                <Label htmlFor="location">
                  Location <span className="text-destructive" aria-label="required">*</span>
                </Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Enter meeting location/address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  aria-required="true"
                  aria-invalid={interviewType === 'in_person' && !location ? 'true' : 'false'}
                />
                {interviewType === 'in_person' && !location && (
                  <p className="text-xs text-muted-foreground">Location is required for in-person interviews</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="duration-select">Duration</Label>
              <select
                id="duration-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>

            <Button
              className="w-full"
              onClick={fetchSuggestions}
              disabled={
                (interviewType === 'phone' && !phoneNumber) ||
                (interviewType === 'in_person' && !location)
              }
            >
              Continue to Time Selection
            </Button>
          </div>
        )}

        {/* Loading State */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
            <p className="text-sm text-muted-foreground">AI is finding optimal interview times...</p>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchSuggestions}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => setStep('custom-time')}>
                Choose Custom Time
              </Button>
            </div>
          </div>
        )}

        {/* Time Slot Selection */}
        {step === 'select-time' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span>AI-suggested optimal times based on scheduling patterns</span>
            </div>

            <div className="grid gap-3" data-testid="time-slots-list">
              {suggestedSlots.map((slot) => (
                <button
                  key={slot.id}
                  data-testid="time-slot"
                  onClick={() => {
                    setSelectedSlot(slot)
                    setStep('confirm')
                  }}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{slot.formattedDate}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {slot.formattedTime}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={slot.optimalityScore >= 80 ? 'default' : 'secondary'}
                      className={slot.optimalityScore >= 80 ? 'bg-orange-500 hover:bg-orange-600' : ''}
                    >
                      {slot.optimalityScore}/100 match
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{slot.reasoning}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => setStep('custom-time')}
            >
              Choose Custom Time
            </Button>
          </div>
        )}

        {/* Custom Time Selection */}
        {step === 'custom-time' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('select-time')}
              className="gap-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to suggestions
            </Button>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="custom-date">
                  Date <span className="text-destructive" aria-label="required">*</span>
                </Label>
                <Input
                  id="custom-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  aria-required="true"
                  aria-invalid={!customDate ? 'true' : 'false'}
                />
                {!customDate && (
                  <p className="text-xs text-muted-foreground">Please select a date</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-time">
                  Time <span className="text-destructive" aria-label="required">*</span>
                </Label>
                <Input
                  id="custom-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-required="true"
                  aria-invalid={!customTime ? 'true' : 'false'}
                />
                {!customTime && (
                  <p className="text-xs text-muted-foreground">Please select a time</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <select
                id="duration"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleCustomSchedule}
              disabled={!customDate || !customTime || isScheduling}
            >
              {isScheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule Interview'
              )}
            </Button>
          </div>
        )}

        {/* Confirm Selection */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('select-time')}
              className="gap-1 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to time slots
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium mb-3">Interview Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Date:</strong> {selectedSlot.formattedDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Time:</strong> {selectedSlot.formattedTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span><strong>Duration:</strong> {duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  {interviewType === 'video' && <Video className="h-4 w-4 text-muted-foreground" />}
                  {interviewType === 'phone' && <Phone className="h-4 w-4 text-muted-foreground" />}
                  {interviewType === 'in_person' && <Briefcase className="h-4 w-4 text-muted-foreground" />}
                  <span>
                    <strong>Type:</strong>{' '}
                    {interviewType === 'video' && 'Video call (link will be sent)'}
                    {interviewType === 'phone' && `Phone call to ${phoneNumber}`}
                    {interviewType === 'in_person' && `In person at ${location}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">The candidate will receive:</p>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                  Email invitation with calendar invite
                </li>
                <li className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-green-500" />
                  Video conference link
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                  Access to interview preparation portal
                </li>
              </ul>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('select-time')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => handleSchedule(selectedSlot)}
                disabled={isScheduling}
                className="flex-1"
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Confirm & Send Invitation'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Success State */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8" data-testid="schedule-success">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Interview Scheduled!</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              An invitation has been sent to {candidateName} with all the details.
            </p>
            <Button onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
