'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Video,
  Phone,
  MapPin,
  Target,
  Award,
  FileText,
  Users,
  TrendingUp,
  Star,
  Clock,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Interview {
  id: string
  scheduledAt: Date
  durationMinutes: number | null
  status: string
  interviewType: string
  location: string | null
  phoneNumber: string | null
  aiSummary: string | null
  aiSentimentScore: number | null
  candidateId: string | null
  candidateFirstName: string | null
  candidateLastName: string | null
  candidateCurrentTitle: string | null
  candidateAiScore: number | null
  candidateEnrichmentScore: number | null
  candidateExperienceYears: number | null
  candidateResumeUrl: string | null
  candidateLinkedinUrl: string | null
  candidateDataCompleteness: number | null
  candidateSkills: string[] | null
  jobTitle: string | null
  jobId: string | null
  jobSkillsRequired: string[] | null
}

interface InterviewCalendarProps {
  interviews: Interview[]
}

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-600', dotColor: 'bg-blue-500' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
  pending: { label: 'Pending', color: 'text-amber-600', dotColor: 'bg-amber-500' },
  in_progress: { label: 'In Progress', color: 'text-purple-600', dotColor: 'bg-purple-500' },
  completed: { label: 'Completed', color: 'text-green-600', dotColor: 'bg-green-500' },
}

const interviewTypeConfig = {
  video: { icon: Video, label: 'Video', color: 'text-blue-600', bg: 'bg-blue-50' },
  phone: { icon: Phone, label: 'Phone', color: 'text-green-600', bg: 'bg-green-50' },
  in_person: { icon: MapPin, label: 'In-Person', color: 'text-orange-600', bg: 'bg-orange-50' },
}

function getMatchLevel(score: number | null): { label: string; color: string; bgColor: string; textColor: string } {
  if (!score) return { label: 'Not Scored', color: 'border-gray-300', bgColor: 'bg-gray-50', textColor: 'text-gray-600' }
  if (score >= 85) return { label: 'Excellent Match', color: 'border-emerald-400', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' }
  if (score >= 70) return { label: 'Strong Match', color: 'border-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-700' }
  if (score >= 55) return { label: 'Good Fit', color: 'border-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700' }
  return { label: 'Potential Fit', color: 'border-slate-300', bgColor: 'bg-slate-50', textColor: 'text-slate-600' }
}

function getScoreColor(score: number | null): string {
  if (!score) return 'text-gray-400'
  if (score >= 85) return 'text-emerald-600'
  if (score >= 70) return 'text-blue-600'
  if (score >= 55) return 'text-amber-600'
  return 'text-slate-600'
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []

  // Add padding days from previous month
  const startPadding = firstDay.getDay()
  for (let i = startPadding - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    days.push(date)
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add padding days from next month
  const endPadding = 6 - lastDay.getDay()
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

export function InterviewCalendar({ interviews }: InterviewCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const days = getDaysInMonth(year, month)

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Group interviews by date
  const interviewsByDate = new Map<string, Interview[]>()
  interviews.forEach((interview) => {
    const dateKey = new Date(interview.scheduledAt).toDateString()
    if (!interviewsByDate.has(dateKey)) {
      interviewsByDate.set(dateKey, [])
    }
    interviewsByDate.get(dateKey)!.push(interview)
  })

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  const handleDateClick = (date: Date) => {
    if (date.getMonth() === month) {
      setSelectedDate(date)
      setViewMode('list')
    }
  }

  const selectedDateInterviews = selectedDate
    ? interviewsByDate.get(selectedDate.toDateString()) || []
    : []

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => date.getMonth() === month

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">{monthName}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 text-xs font-medium"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </button>
          <button
            onClick={() => {
              setViewMode('list')
              if (!selectedDate) setSelectedDate(new Date())
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-4 w-4" />
            Day View
          </button>
        </div>
      </div>

      {/* Calendar or List View */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-3 text-center text-xs font-semibold text-slate-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const dateKey = date.toDateString()
              const dayInterviews = interviewsByDate.get(dateKey) || []
              const hasInterviews = dayInterviews.length > 0
              const today = isToday(date)
              const currentMonth = isCurrentMonth(date)

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  className={`min-h-[100px] p-2 border-b border-r border-slate-200 text-left hover:bg-slate-50 transition-colors ${
                    !currentMonth ? 'bg-slate-50/50' : ''
                  } ${today ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        !currentMonth
                          ? 'text-slate-400'
                          : today
                          ? 'flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs'
                          : 'text-slate-700'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {hasInterviews && (
                      <span className="text-xs font-semibold text-slate-500">
                        {dayInterviews.length}
                      </span>
                    )}
                  </div>

                  {/* Interview dots/indicators */}
                  {hasInterviews && (
                    <div className="space-y-1">
                      {dayInterviews.slice(0, 3).map((interview) => {
                        const time = new Date(interview.scheduledAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                        const cfg = statusConfig[interview.status] || statusConfig.scheduled

                        return (
                          <div
                            key={interview.id}
                            className={`text-xs px-1.5 py-0.5 rounded truncate ${
                              interview.candidateAiScore && interview.candidateAiScore >= 80
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                : 'bg-blue-100 text-blue-700 border border-blue-300'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <div className={`h-1 w-1 rounded-full ${cfg.dotColor} flex-shrink-0`}></div>
                              <span className="font-medium truncate">
                                {time} {interview.candidateFirstName || 'Candidate'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {dayInterviews.length > 3 && (
                        <div className="text-xs text-slate-500 pl-1.5">
                          +{dayInterviews.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        // Day List View
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {selectedDate?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <p className="text-sm text-slate-600">
                {selectedDateInterviews.length} interview{selectedDateInterviews.length !== 1 ? 's' : ''} scheduled
              </p>
            </div>
          </div>

          {selectedDateInterviews.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No interviews scheduled for this day</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateInterviews
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((interview) => {
                  const scheduled = new Date(interview.scheduledAt)
                  const cfg = statusConfig[interview.status] || statusConfig.scheduled
                  const typeConfig = interviewTypeConfig[interview.interviewType as keyof typeof interviewTypeConfig] || interviewTypeConfig.video
                  const TypeIcon = typeConfig.icon
                  const matchLevel = getMatchLevel(interview.candidateAiScore)

                  const candidateSkills = interview.candidateSkills || []
                  const requiredSkills = interview.jobSkillsRequired || []
                  const skillsMatch = requiredSkills.length > 0
                    ? candidateSkills.filter(s => requiredSkills.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))).length
                    : 0
                  const skillMatchPercent = requiredSkills.length > 0 ? Math.round((skillsMatch / requiredSkills.length) * 100) : 0

                  return (
                    <Link
                      key={interview.id}
                      href={`/interviews/${interview.id}`}
                      className="block bg-white border border-slate-200 rounded-lg hover:border-orange-400 hover:shadow-md transition-all group"
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Time Column */}
                          <div className="flex-shrink-0 text-center w-16">
                            <div className="text-xs font-medium text-slate-500 mb-1">
                              {scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${typeConfig.bg}`}>
                              <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                            </div>
                          </div>

                          {/* Main Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h3 className="font-semibold text-slate-900 text-base">
                                    {interview.candidateFirstName || 'Unknown'} {interview.candidateLastName || 'Candidate'}
                                  </h3>
                                  <div className="flex items-center gap-1">
                                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`}></div>
                                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  <span>{interview.candidateCurrentTitle || 'Candidate'}</span>
                                  {interview.jobTitle && (
                                    <>
                                      <span className="text-slate-400">•</span>
                                      <span>Applying for {interview.jobTitle}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Match Score Badge */}
                              {interview.candidateAiScore && (
                                <div className={`flex-shrink-0 px-3 py-2 rounded-lg border-2 ${matchLevel.color} ${matchLevel.bgColor}`}>
                                  <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-slate-600" />
                                    <div className="text-right">
                                      <div className={`text-2xl font-bold leading-none mb-0.5 ${getScoreColor(interview.candidateAiScore)}`}>
                                        {interview.candidateAiScore}
                                      </div>
                                      <div className={`text-xs font-medium ${matchLevel.textColor}`}>
                                        {matchLevel.label}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Candidate Insights Bar */}
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                              {interview.candidateExperienceYears && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded text-xs">
                                  <Award className="h-3.5 w-3.5 text-slate-600" />
                                  <span className="font-medium text-slate-700">{interview.candidateExperienceYears}yr exp</span>
                                </div>
                              )}

                              {interview.candidateResumeUrl && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded text-xs border border-emerald-200">
                                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                                  <span className="font-medium text-emerald-700">Resume</span>
                                </div>
                              )}

                              {interview.candidateLinkedinUrl && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded text-xs border border-blue-200">
                                  <Users className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="font-medium text-blue-700">LinkedIn</span>
                                </div>
                              )}

                              {interview.candidateDataCompleteness && interview.candidateDataCompleteness >= 70 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 rounded text-xs border border-purple-200">
                                  <TrendingUp className="h-3.5 w-3.5 text-purple-600" />
                                  <span className="font-medium text-purple-700">{interview.candidateDataCompleteness}% Complete</span>
                                </div>
                              )}

                              {requiredSkills.length > 0 && (
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs ${
                                  skillMatchPercent >= 70 ? 'bg-emerald-50 border border-emerald-200' :
                                  skillMatchPercent >= 50 ? 'bg-amber-50 border border-amber-200' :
                                  'bg-slate-50 border border-slate-200'
                                }`}>
                                  <Star className={`h-3.5 w-3.5 ${
                                    skillMatchPercent >= 70 ? 'text-emerald-600' :
                                    skillMatchPercent >= 50 ? 'text-amber-600' :
                                    'text-slate-600'
                                  }`} />
                                  <span className={`font-medium ${
                                    skillMatchPercent >= 70 ? 'text-emerald-700' :
                                    skillMatchPercent >= 50 ? 'text-amber-700' :
                                    'text-slate-700'
                                  }`}>
                                    {skillsMatch}/{requiredSkills.length} skills
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded text-xs ml-auto">
                                <Clock className="h-3.5 w-3.5 text-slate-600" />
                                <span className="font-medium text-slate-700">{interview.durationMinutes || 30}min</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
