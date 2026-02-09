/**
 * Mistral AI Integration
 *
 * Wrapper for Mistral AI API with JSON parsing support
 */

import { Mistral } from '@mistralai/mistralai'

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || ''

const mistral = new Mistral({
  apiKey: MISTRAL_API_KEY,
})

/**
 * Generate JSON from a prompt using Mistral AI
 * Compatible with Claude generateJSON interface
 */
export async function generateJSON<T = any>(prompt: string): Promise<T> {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not configured')
  }

  try {
    const chatResponse = await mistral.chat.complete({
      model: 'mistral-large-latest', // Best model for structured output
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      responseFormat: {
        type: 'json_object', // Force JSON output
      },
      temperature: 0.1, // Low temperature for consistent structured output
    })

    const content = chatResponse.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from Mistral AI')
    }

    // Ensure content is a string (it should be for JSON mode)
    if (typeof content !== 'string') {
      throw new Error('Unexpected content format from Mistral AI')
    }

    // Parse the JSON response
    const parsed = JSON.parse(content)
    return parsed as T
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Mistral AI error: ${error.message}`)
    }
    throw new Error('Mistral AI error: Unknown error')
  }
}

/**
 * Generate text completion from Mistral AI
 */
export async function generateText(prompt: string): Promise<string> {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not configured')
  }

  try {
    const chatResponse = await mistral.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    const content = chatResponse.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from Mistral AI')
    }

    // Ensure content is a string
    if (typeof content !== 'string') {
      throw new Error('Unexpected content format from Mistral AI')
    }

    return content
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Mistral AI error: ${error.message}`)
    }
    throw new Error('Mistral AI error: Unknown error')
  }
}

/**
 * Score a candidate using Mistral AI
 */
export async function scoreCandidate(
  candidateInfo: string,
  jobCriteria: string
): Promise<{ score: number; reasons: string[] }> {
  const prompt = `You are a recruitment AI. Score this candidate for the job on a scale of 0-100.

JOB REQUIREMENTS:
${jobCriteria}

CANDIDATE:
${candidateInfo}

Return ONLY a JSON object:
{
  "score": <number 0-100>,
  "reasons": ["reason 1", "reason 2", "reason 3"]
}

Be objective and specific in your reasoning.`

  return generateJSON(prompt)
}

export { mistral }
