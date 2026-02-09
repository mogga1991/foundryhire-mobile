'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar,
  Clock,
  Building2,
  MapPin,
  Briefcase,
  Video,
  CheckCircle2,
  Sparkles,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink,
  BookOpen,
  Target,
  Users,
  Phone,
} from 'lucide-react'

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  optimalityScore: number
  reasoning: string
  status: string
  formattedDate: string
  formattedTime: string
}

interface PortalData {
  interview: {
    id: string
    candidateName: string
    candidateEmail: string | null
    companyName: string
    scheduledAt: string | null
    durationMinutes: number
    interviewType: string
    location: string | null
    phoneNumber: string | null
    status: string
    zoomJoinUrl: string | null
    questions: Array<{ id: string; question: string; completed: boolean }>
  }
  timeSlots?: TimeSlot[]
  candidate: {
    firstName: string
    lastName: string
  }
  job: {
    title: string
    location: string | null
    department: string | null
    description: string | null
    requirements: string[] | null
    skillsRequired: string[] | null
  } | null
  company: {
    name: string
    website: string | null
  }
}

export default function CandidatePortalPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'prepare' | 'tips'>('overview')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    async function fetchPortalData() {
      try {
        // Try the new interview-specific endpoint first
        let res = await fetch(`/api/interviews/candidate/${token}`)
        if (!res.ok) {
          // Fallback to old portal endpoint
          res = await fetch(`/api/portal/${token}`)
        }
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to load')
        }
        const portalData = await res.json()
        setData(portalData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    fetchPortalData()
  }, [token])

  const handleConfirmTimeSlot = async () => {
    if (!selectedTimeSlot) return

    setIsConfirming(true)
    try {
      const res = await fetch(`/api/interviews/candidate/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlotId: selectedTimeSlot }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to confirm time slot')
      }

      // Refresh data to show confirmed interview
      const refreshRes = await fetch(`/api/interviews/candidate/${token}`)
      if (refreshRes.ok) {
        const refreshedData = await refreshRes.json()
        setData(refreshedData)
        setSelectedTimeSlot(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm')
    } finally {
      setIsConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your interview details...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Link Expired or Invalid</h1>
          <p className="text-gray-600 mb-4">
            {error || 'This interview portal link is no longer valid.'}
          </p>
          <p className="text-sm text-gray-500">
            Please contact the hiring team for a new link.
          </p>
        </div>
      </div>
    )
  }

  const { interview, candidate, job, company } = data
  const scheduledDate = interview.scheduledAt ? new Date(interview.scheduledAt) : null
  const now = new Date()
  const isUpcoming = scheduledDate && scheduledDate > now
  const isPast = scheduledDate && scheduledDate < now
  const timeUntil = isUpcoming && scheduledDate ? getTimeUntil(scheduledDate) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">{company.name}</h1>
              <p className="text-xs text-gray-500">Interview Portal</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {candidate.firstName} {candidate.lastName}
            </p>
            {interview.status === 'scheduled' && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                Confirmed
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Time Slot Selection (if not scheduled) */}
        {interview.status === 'pending' && data.timeSlots && data.timeSlots.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select Your Interview Time
              </h2>
              <p className="text-gray-600">
                Choose a time that works best for you. We've suggested optimal times based on typical scheduling patterns.
              </p>
            </div>

            <div className="grid gap-3 mb-6">
              {data.timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedTimeSlot(slot.id)}
                  disabled={slot.status !== 'suggested'}
                  className={`flex items-center justify-between p-4 border-2 rounded-xl transition text-left w-full ${
                    selectedTimeSlot === slot.id
                      ? 'border-orange-500 bg-orange-50'
                      : slot.status === 'suggested'
                      ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <Calendar className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{slot.formattedDate}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                        {slot.formattedTime}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {selectedTimeSlot === slot.id && (
                      <CheckCircle2 className="h-6 w-6 text-orange-500" />
                    )}
                    {slot.optimalityScore >= 80 && selectedTimeSlot !== slot.id && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        <Sparkles className="h-3 w-3" />
                        Optimal
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirmTimeSlot}
              disabled={!selectedTimeSlot || isConfirming}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm Interview Time
                </>
              )}
            </button>
          </div>
        )}

        {/* Interview Status Banner */}
        {isUpcoming && timeUntil && interview.scheduledAt && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mb-8 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">Your Interview is Coming Up</h2>
                <p className="text-orange-100">
                  {timeUntil} &middot; {scheduledDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })} at {scheduledDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {interview.zoomJoinUrl && (
                <a
                  href={interview.zoomJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-orange-50 transition shrink-0"
                >
                  <Video className="h-5 w-5" />
                  Join Video Call
                </a>
              )}
            </div>
          </div>
        )}

        {isPast && interview.status === 'completed' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <h2 className="text-lg font-bold text-green-900">Interview Completed</h2>
                <p className="text-green-700">Thank you for your time. The team will be in touch soon.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
          {[
            { key: 'overview' as const, label: 'Overview', icon: FileText },
            { key: 'prepare' as const, label: 'Prepare', icon: BookOpen },
            { key: 'tips' as const, label: 'Interview Tips', icon: Target },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Interview Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Interview Details
              </h3>
              <div className="space-y-4">
                {scheduledDate && (
                  <>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium">{scheduledDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}</p>
                        <p className="text-sm text-gray-500">Date</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="font-medium">{scheduledDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        })}</p>
                        <p className="text-sm text-gray-500">{interview.durationMinutes} minutes</p>
                      </div>
                    </div>
                  </>
                )}
                <div className="flex items-start gap-3">
                  {interview.interviewType === 'video' && <Video className="h-5 w-5 text-gray-400 mt-0.5" />}
                  {interview.interviewType === 'phone' && <Phone className="h-5 w-5 text-gray-400 mt-0.5" />}
                  {interview.interviewType === 'in_person' && <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />}
                  <div>
                    <p className="font-medium">
                      {interview.interviewType === 'video' && 'Video Interview'}
                      {interview.interviewType === 'phone' && 'Phone Interview'}
                      {interview.interviewType === 'in_person' && 'In-Person Interview'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {interview.interviewType === 'video' && (interview.zoomJoinUrl ? 'Link will be active at interview time' : 'Link will be provided')}
                      {interview.interviewType === 'phone' && `Call: ${interview.phoneNumber || 'Number will be provided'}`}
                      {interview.interviewType === 'in_person' && (interview.location || 'Location will be provided')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Company & Role Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-orange-500" />
                About the Role
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-lg">{job?.title || 'Interview'}</p>
                  <p className="text-sm text-gray-500">{company.name}</p>
                </div>
                {job?.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                )}
                {job?.department && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    {job.department}
                  </div>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-orange-600 hover:underline"
                  >
                    Visit Company Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Job Description (full width) */}
            {job?.description && (
              <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  Role Description
                </h3>
                <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                  {job.description}
                </p>
              </div>
            )}

            {/* Requirements */}
            {job?.requirements && job.requirements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">Requirements</h3>
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills */}
            {job?.skillsRequired && job.skillsRequired.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">Key Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.skillsRequired.map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-orange-50 text-orange-700 border border-orange-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prepare Tab */}
        {activeTab === 'prepare' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                Interview Preparation Checklist
              </h3>
              <p className="text-sm text-gray-500 mb-6">Complete these steps to be fully prepared</p>

              <div className="space-y-4">
                {[
                  { title: 'Research the company', description: `Learn about ${company.name}, their mission, and recent projects`, icon: Building2 },
                  { title: 'Review the job description', description: 'Understand the key responsibilities and requirements', icon: FileText },
                  { title: 'Prepare your examples', description: 'Think of specific examples that demonstrate your skills', icon: Target },
                  { title: 'Test your technology', description: 'Check your camera, microphone, and internet connection', icon: Video },
                  { title: 'Prepare questions to ask', description: 'Have 3-5 thoughtful questions ready for the interviewer', icon: Users },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Practice Questions */}
            {interview.questions && interview.questions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">Practice Questions</h3>
                <div className="space-y-3">
                  {interview.questions.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-500 text-white text-xs font-bold shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className="text-sm font-medium text-gray-800 pt-0.5">{q.question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tips Tab */}
        {activeTab === 'tips' && (
          <div className="space-y-6">
            {[
              {
                title: 'Before the Interview',
                items: [
                  'Join the call 5 minutes early to ensure everything works',
                  'Find a quiet, well-lit space with a neutral background',
                  'Dress professionally, even for a video call',
                  'Have a copy of your resume and the job description handy',
                  'Close unnecessary browser tabs and applications',
                ],
              },
              {
                title: 'During the Interview',
                items: [
                  'Maintain eye contact by looking at the camera, not the screen',
                  'Speak clearly and at a moderate pace',
                  'Use the STAR method (Situation, Task, Action, Result) for behavioral questions',
                  'Take a moment to think before answering complex questions',
                  'Show enthusiasm and ask thoughtful questions',
                ],
              },
              {
                title: 'After the Interview',
                items: [
                  'Send a thank-you email within 24 hours',
                  'Reflect on the questions asked and your answers',
                  'Note any follow-up items or information you need to provide',
                  'Be patient - the hiring process takes time',
                ],
              },
            ].map((section) => (
              <div key={section.title} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4">{section.title}</h3>
                <ul className="space-y-3">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-sm text-gray-400">
        Powered by VerticalHire
      </footer>
    </div>
  )
}

function getTimeUntil(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (diffDays > 0) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} and ${diffHours} hour${diffHours !== 1 ? 's' : ''} away`
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} away`
  }
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} away`
}
