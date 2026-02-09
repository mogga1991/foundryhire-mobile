import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function generateCompletion(prompt: string, maxTokens: number = 1024): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function generateJSON<T>(prompt: string, maxTokens: number = 1024): Promise<T> {
  const text = await generateCompletion(
    prompt + '\n\nReturn ONLY valid JSON. No markdown, no code blocks, just the JSON object.',
    maxTokens
  )
  // Strip any markdown code blocks if present
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as T
}

export { anthropic }
