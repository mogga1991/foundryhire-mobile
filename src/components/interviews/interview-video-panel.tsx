'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  MessageSquare,
  MoreHorizontal,
  PhoneOff,
  CheckCircle2,
  Circle,
  MonitorPlay,
  Calendar,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Import Zoom component with SSR disabled
const ZoomMeetingEmbed = dynamic(
  () => import('./zoom-meeting-embed').then(mod => ({ default: mod.ZoomMeetingEmbed })),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full h-full bg-gray-900 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading meeting...</p>
          </div>
        </div>
      </div>
    )
  }
)

interface InterviewQuestion {
  id: string
  question: string
  answer?: string
  completed: boolean
}

interface InterviewVideoPanelProps {
  interview: {
    id: string
    status: string
    scheduledAt: string
    durationMinutes: number | null
    zoomMeetingId: string | null
    zoomJoinUrl: string | null
    zoomStartUrl: string | null
    recordingUrl: string | null
  }
  candidateName: string
  candidateEmail: string
  candidateInitials: string
  interviewerName: string
  interviewerEmail: string
  isHost: boolean
  questions: InterviewQuestion[]
}

export function InterviewVideoPanel({
  interview,
  candidateName,
  candidateEmail,
  candidateInitials,
  interviewerName,
  interviewerEmail,
  isHost,
  questions,
}: InterviewVideoPanelProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'timeline' | 'clips'>('questions')
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  const isLive = interview.status === 'in_progress'
  const isScheduled = interview.status === 'scheduled'
  const isCompleted = interview.status === 'completed'
  const scheduledDate = new Date(interview.scheduledAt)

  const interviewerInitials = interviewerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ME'

  // Check if we should embed Zoom meeting
  const shouldEmbedZoom = isLive && interview.zoomMeetingId
  const userName = isHost ? interviewerName : candidateName
  const userEmail = isHost ? interviewerEmail : candidateEmail

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Video Area - 3/5 width */}
      <div className="lg:col-span-3">
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video">
          {/* Live/Recording indicator */}
          {isLive && (
            <div className="absolute top-4 right-4 z-10">
              <Badge className="bg-red-600 text-white gap-1.5 animate-pulse px-3 py-1">
                <MonitorPlay className="h-3.5 w-3.5" />
                Live Recording
              </Badge>
            </div>
          )}

          {isCompleted && interview.recordingUrl && (
            <div className="absolute top-4 right-4 z-10">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Video className="h-3.5 w-3.5" />
                Recording Available
              </Badge>
            </div>
          )}

          {/* Participant badges */}
          <div className="absolute top-4 left-4 z-10">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
              <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white">
                {interviewerInitials}
              </div>
              <span className="text-white text-xs font-medium">{interviewerName}</span>
            </div>
          </div>

          {/* Main video area - Zoom SDK embed or placeholder */}
          {shouldEmbedZoom ? (
            <ZoomMeetingEmbed
              meetingNumber={interview.zoomMeetingId!}
              userName={userName}
              userEmail={userEmail}
              role={isHost ? 1 : 0}
              onMeetingEnd={() => {
                console.log('Meeting ended')
              }}
              onMeetingError={(error) => {
                console.error('Meeting error:', error)
              }}
            />
          ) : isLive ? (
            <div className="h-full flex items-center justify-center">
              {/* Fallback placeholder if Zoom not configured */}
              <div className="grid grid-cols-2 gap-2 w-full h-full p-4">
                <div className="bg-gray-800 rounded-xl flex items-center justify-center relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
                    {interviewerInitials}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1.5">
                      {micOn ? (
                        <div className="h-4 w-4 text-green-400 flex items-center justify-center">
                          <div className="h-3 w-0.5 bg-green-400 rounded-full animate-pulse mx-px" />
                          <div className="h-4 w-0.5 bg-green-400 rounded-full animate-pulse mx-px" style={{ animationDelay: '150ms' }} />
                          <div className="h-2.5 w-0.5 bg-green-400 rounded-full animate-pulse mx-px" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <MicOff className="h-3 w-3 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-xl flex items-center justify-center relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                    {candidateInitials}
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold text-white">
                        {candidateInitials}
                      </div>
                      <span className="text-white text-[10px] font-medium">{candidateName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isCompleted && interview.recordingUrl ? (
            <div className="h-full flex flex-col items-center justify-center text-white">
              <Video className="h-16 w-16 mb-4 text-gray-400" />
              <p className="font-medium mb-2">Interview Recording</p>
              <a
                href={interview.recordingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-medium transition text-sm"
              >
                Watch Recording
              </a>
            </div>
          ) : isScheduled ? (
            <div className="h-full flex flex-col items-center justify-center text-white">
              <Calendar className="h-16 w-16 mb-4 text-gray-500" />
              <p className="font-medium mb-1">Scheduled Interview</p>
              <p className="text-gray-400 text-sm mb-4">
                {scheduledDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {scheduledDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              {interview.zoomStartUrl && (
                <a
                  href={interview.zoomStartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-medium transition text-sm flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Start Video Call
                </a>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <Video className="h-16 w-16" />
            </div>
          )}

          {/* Video controls bar - only show for fallback placeholder, not when Zoom is embedded */}
          {isLive && !shouldEmbedZoom && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-12 pb-4 px-4">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setMicOn(!micOn)}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                    micOn ? 'bg-gray-700/80 hover:bg-gray-600/80 text-white' : 'bg-red-500/90 text-white'
                  }`}
                >
                  {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => setCamOn(!camOn)}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition ${
                    camOn ? 'bg-gray-700/80 hover:bg-gray-600/80 text-white' : 'bg-red-500/90 text-white'
                  }`}
                >
                  {camOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
                </button>
                <button className="h-11 w-11 rounded-full bg-gray-700/80 hover:bg-gray-600/80 flex items-center justify-center text-white transition">
                  <MessageSquare className="h-5 w-5" />
                </button>
                <button className="h-11 w-11 rounded-full bg-gray-700/80 hover:bg-gray-600/80 flex items-center justify-center text-white transition">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                <button className="h-11 w-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition">
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Key Meeting Notes - below video, matching reference UI */}
        {isCompleted && (
          <div className="mt-4 bg-white dark:bg-gray-900 border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Key Meeting Notes &ndash; {candidateName}
              </h3>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {interview.durationMinutes ?? 30} min
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Question List Sidebar - 2/5 width, matching reference UI */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="border-b">
          <div className="flex">
            {[
              { key: 'questions' as const, label: 'Question List' },
              { key: 'timeline' as const, label: 'Timeline' },
              { key: 'clips' as const, label: 'Highlight Clips' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 px-3 text-sm font-medium transition border-b-2 ${
                  activeTab === tab.key
                    ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[600px] overflow-y-auto">
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {questions.length > 0 ? (
                questions.map((q, i) => (
                  <div key={q.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-500 text-white text-xs font-bold shrink-0 mt-0.5">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{q.question}</p>
                          {q.answer && (
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                              {q.answer}
                            </p>
                          )}
                        </div>
                      </div>
                      {q.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No questions added yet</p>
                  <p className="text-xs mt-1">Questions will appear here during the interview</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Timeline will be available after the interview</p>
            </div>
          )}

          {activeTab === 'clips' && (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Highlight clips will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
