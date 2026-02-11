/**
 * Deepgram Speech-to-Text Integration
 *
 * Provides transcription services using Deepgram's pre-recorded API
 * when Zoom native transcripts are not available.
 */

import { createClient } from '@deepgram/sdk'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'

const logger = createLogger('deepgram')

export interface TranscriptSegment {
  speaker: number // Speaker ID (0, 1, etc.)
  text: string
  start: number // seconds
  end: number // seconds
  confidence: number
}

export interface TranscriptionResult {
  transcript: string // Full formatted transcript
  segments: TranscriptSegment[] // Speaker-segmented
  confidence: number
  duration: number
  words: number
}

export interface TranscriptionOptions {
  language?: string // Default: 'en'
  model?: string // Default: 'nova-2'
  smartFormat?: boolean // Default: true
  paragraphs?: boolean // Default: true
  diarize?: boolean // Default: true (speaker detection)
  utterances?: boolean // Default: true
}

/**
 * Validate Deepgram configuration
 */
export function validateDeepgramConfig(): boolean {
  const apiKey = env.DEEPGRAM_API_KEY
  if (!apiKey) {
    logger.warn({ message: 'DEEPGRAM_API_KEY environment variable not set' })
    return false
  }
  return true
}

/**
 * Get Deepgram client instance
 */
function getDeepgramClient() {
  const apiKey = env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required')
  }
  return createClient(apiKey)
}

/**
 * Transcribe audio from a URL using Deepgram's pre-recorded API
 */
export async function transcribeAudio(
  audioUrl: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  logger.info({ message: 'Starting Deepgram transcription', audioUrl })

  const {
    language = 'en',
    model = 'nova-2',
    smartFormat = true,
    paragraphs = true,
    diarize = true,
    utterances = true,
  } = options

  const deepgram = getDeepgramClient()

  let lastError: Error | null = null
  const maxRetries = 1

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info({ message: 'Retrying Deepgram transcription', attempt, audioUrl })
      }

      // Use pre-recorded transcription API
      const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        {
          model,
          language,
          smart_format: smartFormat,
          paragraphs,
          diarize,
          utterances,
          punctuate: true,
          tier: 'nova', // Use nova tier for best quality
        }
      )

      if (error) {
        throw new Error(`Deepgram API error: ${error.message || JSON.stringify(error)}`)
      }

      if (!result?.results?.channels?.[0]) {
        throw new Error('Invalid Deepgram response structure')
      }

      const channel = result.results.channels[0]
      const alternatives = channel.alternatives?.[0]

      if (!alternatives) {
        throw new Error('No transcription alternatives in response')
      }

      // Extract segments with speaker diarization
      const segments: TranscriptSegment[] = []

      // Utterances are at the top level of results, not under alternatives
      if (utterances && result.results.utterances) {
        // Use utterances for speaker-segmented transcription
        for (const utterance of result.results.utterances) {
          segments.push({
            speaker: utterance.speaker ?? 0,
            text: utterance.transcript || '',
            start: utterance.start ?? 0,
            end: utterance.end ?? 0,
            confidence: utterance.confidence ?? 0,
          })
        }
      } else if (alternatives.words) {
        // Fallback to word-level segmentation if no utterances
        let currentSpeaker = 0
        let currentText = ''
        let currentStart = 0
        let currentConfidences: number[] = []

        for (const word of alternatives.words) {
          const speaker = word.speaker ?? 0

          if (speaker !== currentSpeaker && currentText) {
            // Speaker changed, save current segment
            segments.push({
              speaker: currentSpeaker,
              text: currentText.trim(),
              start: currentStart,
              end: word.start ?? 0,
              confidence: currentConfidences.length > 0
                ? currentConfidences.reduce((a, b) => a + b, 0) / currentConfidences.length
                : 0,
            })
            currentText = ''
            currentConfidences = []
          }

          if (!currentText) {
            currentStart = word.start ?? 0
            currentSpeaker = speaker
          }

          currentText += (currentText ? ' ' : '') + (word.word || word.punctuated_word || '')
          if (word.confidence) {
            currentConfidences.push(word.confidence)
          }
        }

        // Add final segment
        if (currentText) {
          const lastWord = alternatives.words[alternatives.words.length - 1]
          segments.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            start: currentStart,
            end: lastWord.end ?? 0,
            confidence: currentConfidences.length > 0
              ? currentConfidences.reduce((a, b) => a + b, 0) / currentConfidences.length
              : 0,
          })
        }
      }

      // Format full transcript with speaker labels
      const formattedTranscript = segments
        .map((seg) => `Speaker ${seg.speaker}: ${seg.text}`)
        .join('\n\n')

      // Calculate metrics
      const transcript = alternatives.transcript || ''
      const confidence = alternatives.confidence ?? 0
      const duration = result.metadata?.duration ?? 0
      const words = alternatives.words?.length ?? 0

      logger.info({
        message: 'Deepgram transcription completed',
        audioUrl,
        duration,
        words,
        confidence,
        segments: segments.length,
      })

      return {
        transcript: formattedTranscript || transcript,
        segments,
        confidence,
        duration,
        words,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a 5xx error that should be retried
      const shouldRetry =
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504')

      if (shouldRetry && attempt < maxRetries) {
        logger.warn({
          message: 'Deepgram API error, will retry',
          error: lastError.message,
          attempt: attempt + 1,
        })
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      // For non-5xx errors or final retry, throw immediately
      logger.error({
        message: 'Deepgram transcription failed',
        audioUrl,
        error: lastError.message,
        attempt: attempt + 1,
      })

      throw lastError
    }
  }

  // Should never reach here, but TypeScript requires it
  throw lastError || new Error('Transcription failed after retries')
}

/**
 * Parse timestamp from Deepgram segment (in seconds) to human-readable format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
