'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Copy, ChevronDown, ChevronRight, Sparkles, MessageCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { cn } from '@/lib/utils'

interface TranscriptViewerProps {
  transcript: string
  keyMoments?: Array<{
    timestamp: string
    quote: string
    significance: string
    sentiment: string
  }>
  competencyScores?: Record<string, { score: number; evidence: string[] }>
}

interface TranscriptSegment {
  speaker: string
  text: string
  timestamp?: string
  startIndex: number
  endIndex: number
}

interface Match {
  segmentIndex: number
  start: number
  end: number
}

export function TranscriptViewer({ transcript, keyMoments = [], competencyScores }: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [collapsedSegments, setCollapsedSegments] = useState<Set<number>>(new Set())
  const [selectedMoment, setSelectedMoment] = useState<number | null>(null)
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Parse transcript into segments by speaker
  const segments = useMemo(() => {
    const parsed: TranscriptSegment[] = []
    const lines = transcript.split('\n').filter(line => line.trim())

    let currentSpeaker = ''
    let currentText = ''
    let currentTimestamp: string | undefined
    let segmentStartIndex = 0

    lines.forEach((line, idx) => {
      // Match patterns like "Interviewer:" or "Candidate:" or "[00:01:23] Speaker:"
      const speakerMatch = line.match(/^(?:\[([^\]]+)\]\s*)?([A-Za-z\s]+):\s*(.*)/)

      if (speakerMatch) {
        // Save previous segment if exists
        if (currentSpeaker && currentText) {
          parsed.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: currentTimestamp,
            startIndex: segmentStartIndex,
            endIndex: segmentStartIndex + currentText.length,
          })
        }

        // Start new segment
        currentTimestamp = speakerMatch[1]
        currentSpeaker = speakerMatch[2].trim()
        currentText = speakerMatch[3] + '\n'
        segmentStartIndex = transcript.indexOf(line)
      } else {
        // Continue current segment
        currentText += line + '\n'
      }
    })

    // Add last segment
    if (currentSpeaker && currentText) {
      parsed.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        timestamp: currentTimestamp,
        startIndex: segmentStartIndex,
        endIndex: segmentStartIndex + currentText.length,
      })
    }

    return parsed
  }, [transcript])

  // Find matches for search query
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return []

    const results: Match[] = []
    const query = searchQuery.toLowerCase()

    segments.forEach((segment, segmentIndex) => {
      const text = segment.text.toLowerCase()
      let startPos = 0

      while (true) {
        const index = text.indexOf(query, startPos)
        if (index === -1) break

        results.push({
          segmentIndex,
          start: index,
          end: index + query.length,
        })

        startPos = index + 1
      }
    })

    return results
  }, [searchQuery, segments])

  // Highlight text with search matches
  const highlightText = (text: string, segmentIndex: number) => {
    if (!searchQuery.trim()) return text

    const segmentMatches = matches.filter(m => m.segmentIndex === segmentIndex)
    if (segmentMatches.length === 0) return text

    const parts: Array<{ text: string; isMatch: boolean; matchIndex?: number }> = []
    let lastIndex = 0

    segmentMatches.forEach((match, idx) => {
      const globalMatchIndex = matches.findIndex(m =>
        m.segmentIndex === segmentIndex && m.start === match.start
      )

      if (match.start > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.start), isMatch: false })
      }
      parts.push({
        text: text.slice(match.start, match.end),
        isMatch: true,
        matchIndex: globalMatchIndex,
      })
      lastIndex = match.end
    })

    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isMatch: false })
    }

    return (
      <>
        {parts.map((part, idx) => (
          part.isMatch ? (
            <mark
              key={idx}
              className={cn(
                'bg-yellow-200 dark:bg-yellow-900/50 rounded px-0.5',
                part.matchIndex === currentMatchIndex && 'ring-2 ring-yellow-500'
              )}
            >
              {part.text}
            </mark>
          ) : (
            <span key={idx}>{part.text}</span>
          )
        ))}
      </>
    )
  }

  // Navigate to next/previous match
  const navigateMatch = (direction: 'next' | 'prev') => {
    if (matches.length === 0) return

    const newIndex = direction === 'next'
      ? (currentMatchIndex + 1) % matches.length
      : (currentMatchIndex - 1 + matches.length) % matches.length

    setCurrentMatchIndex(newIndex)

    // Scroll to the match
    const match = matches[newIndex]
    const ref = segmentRefs.current.get(match.segmentIndex)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Scroll to key moment
  const scrollToMoment = (momentIndex: number) => {
    setSelectedMoment(momentIndex)
    const moment = keyMoments[momentIndex]

    // Find segment containing the quote
    const segmentIndex = segments.findIndex(seg =>
      seg.text.toLowerCase().includes(moment.quote.toLowerCase())
    )

    if (segmentIndex !== -1) {
      const ref = segmentRefs.current.get(segmentIndex)
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Toggle segment collapse
  const toggleCollapse = (index: number) => {
    const newCollapsed = new Set(collapsedSegments)
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index)
    } else {
      newCollapsed.add(index)
    }
    setCollapsedSegments(newCollapsed)
  }

  // Copy transcript to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript)
  }

  // Get speaker color
  const getSpeakerColor = (speaker: string) => {
    const normalized = speaker.toLowerCase()
    if (normalized.includes('interviewer') || normalized.includes('recruiter')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    }
    if (normalized.includes('candidate')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }

  // Get sentiment color
  const getSentimentColor = (sentiment: string) => {
    const normalized = sentiment.toLowerCase()
    if (normalized.includes('positive')) {
      return 'bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500'
    }
    if (normalized.includes('negative') || normalized.includes('concern')) {
      return 'bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500'
    }
    return 'bg-gray-50 dark:bg-gray-900/20'
  }

  // Get sentiment icon
  const getSentimentIcon = (sentiment: string) => {
    const normalized = sentiment.toLowerCase()
    if (normalized.includes('positive')) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    if (normalized.includes('negative')) {
      return <TrendingDown className="h-4 w-4 text-red-600" />
    }
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  // Check if segment is highlighted by a key moment
  const getSegmentKeyMoment = (segment: TranscriptSegment) => {
    return keyMoments.find(moment =>
      segment.text.toLowerCase().includes(moment.quote.toLowerCase())
    )
  }

  // Keyboard shortcuts for search navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Only handle navigation if search input is focused and there are matches
      if (document.activeElement === searchInputRef.current && matches.length > 0) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (e.shiftKey) {
            navigateMatch('prev')
          } else {
            navigateMatch('next')
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [matches.length, currentMatchIndex])

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3" role="search">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentMatchIndex(0)
              }}
              className="pl-9"
              aria-label="Search transcript"
              aria-describedby={matches.length > 0 ? 'search-results-count' : undefined}
            />
          </div>
          {matches.length > 0 && (
            <div className="flex items-center gap-2">
              <span
                id="search-results-count"
                className="text-sm text-muted-foreground whitespace-nowrap"
                aria-live="polite"
                aria-atomic="true"
              >
                {currentMatchIndex + 1} / {matches.length}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateMatch('prev')}
                  disabled={matches.length === 0}
                  aria-label="Previous match"
                >
                  ↑
                  <VisuallyHidden>Previous match</VisuallyHidden>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateMatch('next')}
                  disabled={matches.length === 0}
                  aria-label="Next match"
                >
                  ↓
                  <VisuallyHidden>Next match</VisuallyHidden>
                </Button>
              </div>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>

      {/* Key Moments Sidebar */}
      {keyMoments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Key Moments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {keyMoments.map((moment, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToMoment(idx)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selectedMoment === idx && 'bg-accent ring-2 ring-ring'
                  )}
                  aria-label={`Jump to key moment at ${moment.timestamp}: ${moment.significance}`}
                  tabIndex={0}
                >
                  <div className="flex items-start gap-2 mb-1">
                    {getSentimentIcon(moment.sentiment)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {moment.timestamp && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {moment.timestamp}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {moment.sentiment}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{moment.significance}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript Segments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transcript segments found. The transcript may be in an unsupported format.
              </p>
            ) : (
              segments.map((segment, idx) => {
                const isCollapsed = collapsedSegments.has(idx)
                const keyMoment = getSegmentKeyMoment(segment)

                return (
                  <div
                    key={idx}
                    ref={(el) => {
                      if (el) segmentRefs.current.set(idx, el)
                    }}
                    className={cn(
                      'rounded-lg p-4 transition-colors',
                      keyMoment ? getSentimentColor(keyMoment.sentiment) : 'bg-muted/30'
                    )}
                    role="article"
                    aria-label={`${segment.speaker} at ${segment.timestamp || 'unknown time'}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleCollapse(idx)}
                        className="mt-1 hover:bg-accent rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSpeakerColor(segment.speaker)}>
                            {segment.speaker}
                          </Badge>
                          {segment.timestamp && (
                            <span className="text-xs font-mono text-muted-foreground">
                              {segment.timestamp}
                            </span>
                          )}
                          {keyMoment && (
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              Key Moment
                            </Badge>
                          )}
                        </div>

                        {!isCollapsed && (
                          <>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {highlightText(segment.text, idx)}
                            </div>

                            {keyMoment && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Why this matters:
                                </p>
                                <p className="text-sm text-foreground/90">
                                  {keyMoment.significance}
                                </p>
                              </div>
                            )}
                          </>
                        )}

                        {isCollapsed && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {segment.text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Competency Evidence (if available) */}
      {competencyScores && Object.keys(competencyScores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supporting Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(competencyScores).map(([key, data]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </h4>
                    <Badge variant="secondary">{data.score}/100</Badge>
                  </div>
                  {data.evidence && data.evidence.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      {data.evidence.map((item, idx) => (
                        <li key={idx} className="list-disc">
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
