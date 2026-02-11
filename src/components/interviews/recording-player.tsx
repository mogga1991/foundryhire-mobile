'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Loader2,
  AlertCircle,
  Download,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { cn } from '@/lib/utils'

interface TranscriptSegment {
  speaker: string
  text: string
  timestamp?: string
  startTime: number // in seconds
  endTime: number // in seconds
}

interface RecordingPlayerProps {
  recordingUrl: string
  transcript?: string
  keyMoments?: Array<{
    timestamp: string
    quote: string
    significance: string
    sentiment: string
  }>
  duration?: number // in seconds
}

export function RecordingPlayer({
  recordingUrl,
  transcript,
  keyMoments = [],
  duration,
}: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(duration || 0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPiPSupported, setIsPiPSupported] = useState(false)

  // Parse transcript into segments with timestamps
  const transcriptSegments = useMemo<TranscriptSegment[]>(() => {
    if (!transcript) return []

    const segments: TranscriptSegment[] = []
    const lines = transcript.split('\n').filter(line => line.trim())

    let currentSpeaker = ''
    let currentText = ''
    let currentTimestamp: string | undefined
    let currentStartTime = 0

    lines.forEach((line) => {
      // Match patterns like "[00:01:23] Speaker:" or "Speaker:"
      const speakerMatch = line.match(/^(?:\[([^\]]+)\]\s*)?([A-Za-z\s]+):\s*(.*)/)

      if (speakerMatch) {
        // Save previous segment if exists
        if (currentSpeaker && currentText) {
          segments.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            timestamp: currentTimestamp,
            startTime: currentStartTime,
            endTime: currentStartTime + 10, // Estimate 10 seconds per segment
          })
        }

        // Start new segment
        currentTimestamp = speakerMatch[1]
        currentSpeaker = speakerMatch[2].trim()
        currentText = speakerMatch[3] + ' '

        // Parse timestamp to seconds
        if (currentTimestamp) {
          const parts = currentTimestamp.split(':').map(Number)
          if (parts.length === 3) {
            currentStartTime = parts[0] * 3600 + parts[1] * 60 + parts[2]
          } else if (parts.length === 2) {
            currentStartTime = parts[0] * 60 + parts[1]
          }
        }
      } else {
        // Continue current segment
        currentText += line + ' '
      }
    })

    // Add last segment
    if (currentSpeaker && currentText) {
      segments.push({
        speaker: currentSpeaker,
        text: currentText.trim(),
        timestamp: currentTimestamp,
        startTime: currentStartTime,
        endTime: currentStartTime + 10,
      })
    }

    return segments
  }, [transcript])

  // Find current active transcript segment
  const activeSegmentIndex = useMemo(() => {
    return transcriptSegments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime < seg.endTime
    )
  }, [transcriptSegments, currentTime])

  // Parse key moments to get timestamps in seconds
  const keyMomentTimestamps = useMemo(() => {
    return keyMoments.map((moment) => {
      const parts = moment.timestamp.split(':').map(Number)
      let seconds = 0
      if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
      } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1]
      }
      return { ...moment, timeInSeconds: seconds }
    })
  }, [keyMoments])

  useEffect(() => {
    if (videoRef.current) {
      setIsPiPSupported('pictureInPictureEnabled' in document)
    }

    // Keyboard shortcuts handler
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'ArrowLeft':
          e.preventDefault()
          skip(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          skip(10)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration)
      setLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    const handleError = () => {
      setError('Failed to load video. The recording may be unavailable.')
      setLoading(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return
    videoRef.current.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressBarRef.current) return

    const rect = progressBarRef.current.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * videoDuration

    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const seekToTime = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const skip = (seconds: number) => {
    if (!videoRef.current) return
    const newTime = Math.max(0, Math.min(videoDuration, currentTime + seconds))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
  }

  const toggleFullscreen = async () => {
    if (!videoRef.current) return

    try {
      if (!isFullscreen) {
        await videoRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Fullscreen error:', err)
      }
    }
  }

  const togglePiP = async () => {
    if (!videoRef.current || !isPiPSupported) return

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('PiP error:', err)
      }
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

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

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Recording</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href={recordingUrl} download>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Recording
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Video Player - 2/3 width */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardContent className="p-0">
            {/* Video Container */}
            <div
              className="relative bg-black rounded-t-lg overflow-hidden"
              style={{ aspectRatio: '16/9' }}
              role="region"
              aria-label="Interview recording player"
            >
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                  <div className="text-center text-white">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-400">Loading recording...</p>
                  </div>
                </div>
              )}

              <video
                ref={videoRef}
                src={recordingUrl}
                className="w-full h-full"
                onClick={togglePlay}
              />

              {/* Key Moment Indicators on Progress Bar */}
              {keyMomentTimestamps.length > 0 && videoDuration > 0 && (
                <div className="absolute bottom-16 left-0 right-0 px-4">
                  <div className="relative h-1">
                    {keyMomentTimestamps.map((moment, idx) => (
                      <button
                        key={idx}
                        onClick={() => seekToTime(moment.timeInSeconds)}
                        className="absolute w-3 h-3 bg-orange-500 rounded-full -translate-y-1 hover:scale-125 transition group"
                        style={{ left: `${(moment.timeInSeconds / videoDuration) * 100}%` }}
                        title={moment.significance}
                      >
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded">
                          {moment.timestamp} - {moment.significance}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {/* Progress Bar */}
                <div
                  ref={progressBarRef}
                  className="w-full h-1.5 bg-gray-600 rounded-full mb-4 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  onClick={handleSeek}
                  role="slider"
                  aria-label="Seek video position"
                  aria-valuemin={0}
                  aria-valuemax={videoDuration}
                  aria-valuenow={currentTime}
                  aria-valuetext={`${formatTime(currentTime)} of ${formatTime(videoDuration)}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      skip(-5)
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      skip(5)
                    }
                  }}
                >
                  <div
                    className="h-full bg-orange-500 rounded-full relative group-hover:bg-orange-400 transition"
                    style={{ width: `${(currentTime / videoDuration) * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      onClick={() => skip(-10)}
                      aria-label="Skip backward 10 seconds"
                    >
                      <SkipBack className="h-4 w-4" />
                      <VisuallyHidden>Skip backward 10 seconds</VisuallyHidden>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      <VisuallyHidden>{isPlaying ? 'Pause video' : 'Play video'}</VisuallyHidden>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      onClick={() => skip(10)}
                      aria-label="Skip forward 10 seconds"
                    >
                      <SkipForward className="h-4 w-4" />
                      <VisuallyHidden>Skip forward 10 seconds</VisuallyHidden>
                    </Button>

                    <div className="flex items-center gap-2 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        onClick={toggleMute}
                        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        <VisuallyHidden>{isMuted ? 'Unmute video' : 'Mute video'}</VisuallyHidden>
                      </Button>

                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        aria-label="Volume control"
                        aria-valuemin={0}
                        aria-valuemax={1}
                        aria-valuenow={volume}
                        aria-valuetext={`Volume ${Math.round(volume * 100)}%`}
                      />
                    </div>

                    <span className="text-white text-sm ml-4 font-mono" aria-live="polite" aria-atomic="true">
                      {formatTime(currentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Playback Speed */}
                    <select
                      value={playbackRate}
                      onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                      className="bg-gray-700 text-white text-sm px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      aria-label="Playback speed"
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1">1x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2x</option>
                    </select>

                    {isPiPSupported && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                        onClick={togglePiP}
                        aria-label="Picture-in-Picture"
                        title="Picture-in-Picture"
                      >
                        <Minimize className="h-4 w-4" />
                        <VisuallyHidden>Picture-in-Picture</VisuallyHidden>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      onClick={toggleFullscreen}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                      <Maximize className="h-4 w-4" />
                      <VisuallyHidden>{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</VisuallyHidden>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download Link */}
        <div className="flex justify-end">
          <a href={recordingUrl} download>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download Recording
            </Button>
          </a>
        </div>
      </div>

      {/* Synced Transcript - 1/3 width */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Synced Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {transcriptSegments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transcript available for this recording.
                </p>
              ) : (
                transcriptSegments.map((segment, idx) => {
                  const isActive = idx === activeSegmentIndex
                  const segmentRef = useRef<HTMLDivElement>(null)

                  // Auto-scroll to active segment
                  useEffect(() => {
                    if (isActive && segmentRef.current) {
                      segmentRef.current.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      })
                    }
                  }, [isActive])

                  return (
                    <div
                      key={idx}
                      ref={segmentRef}
                      onClick={() => seekToTime(segment.startTime)}
                      className={cn(
                        'p-3 rounded-lg cursor-pointer transition-colors border',
                        isActive
                          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-500'
                          : 'bg-muted/30 hover:bg-muted/50 border-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSpeakerColor(segment.speaker)}>
                          {segment.speaker}
                        </Badge>
                        {segment.timestamp && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {segment.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{segment.text}</p>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
