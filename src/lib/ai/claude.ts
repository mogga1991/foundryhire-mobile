import Anthropic from '@anthropic-ai/sdk'
import { createLogger } from '@/lib/logger'
import { captureError } from '@/lib/monitoring/sentry'
import { logAiMetric } from '@/lib/monitoring/api-metrics'
import { env } from '@/lib/env'

const logger = createLogger('claude')

const MODEL = 'claude-sonnet-4-5-20250929'

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY!,
})

export async function generateCompletion(prompt: string, maxTokens: number = 1024): Promise<string> {
  const startTime = Date.now()
  const promptLength = prompt.length

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })

    const durationMs = Date.now() - startTime
    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Log token usage and performance
    logAiMetric({
      operation: 'generateCompletion',
      model: MODEL,
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
      durationMs,
      success: true,
    })

    logger.debug({
      message: 'AI completion generated',
      promptLength,
      responseLength: text.length,
      durationMs,
      inputTokens: message.usage?.input_tokens,
      outputTokens: message.usage?.output_tokens,
    })

    return text
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logAiMetric({
      operation: 'generateCompletion',
      model: MODEL,
      durationMs,
      success: false,
      error: errorMessage,
    })

    captureError(error, {
      component: 'claude',
      action: 'generateCompletion',
      metadata: { promptLength, maxTokens, model: MODEL },
    })

    throw error
  }
}

export async function generateJSON<T>(prompt: string, maxTokens: number = 1024): Promise<T> {
  const startTime = Date.now()

  try {
    const text = await generateCompletion(
      prompt + '\n\nReturn ONLY valid JSON. No markdown, no code blocks, just the JSON object.',
      maxTokens
    )
    // Strip any markdown code blocks if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as T

    const durationMs = Date.now() - startTime
    logger.debug({
      message: 'AI JSON generated and parsed',
      durationMs,
    })

    return parsed
  } catch (error) {
    const durationMs = Date.now() - startTime

    // If this is a JSON parse error (not an API error), capture it specifically
    if (error instanceof SyntaxError) {
      captureError(error, {
        component: 'claude',
        action: 'generateJSON:parse',
        metadata: { maxTokens, model: MODEL, durationMs },
      })
    }

    throw error
  }
}

export { anthropic }
