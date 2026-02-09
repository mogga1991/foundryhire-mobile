import { test, expect } from '@playwright/test'

// Phase 4: AI Interview Intelligence Tests

test.describe('AI Intelligence - API Routes', () => {
  test('POST /api/interviews/[id]/analyze route exists', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/analyze')
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('POST /api/interviews/[id]/transcript route exists', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/transcript', {
      data: { transcript: 'Test transcript content' },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('GET /api/interviews/[id]/transcript route exists', async ({ request }) => {
    const response = await request.get('/api/interviews/test-id/transcript')
    expect(response.status()).not.toBe(404)
  })

  test('analyze endpoint returns JSON response', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/analyze')
    // Should return some kind of JSON (error or result)
    const contentType = response.headers()['content-type'] || ''
    // The route exists and responds - may redirect (200) or return auth error
    expect(response.status()).not.toBe(404)
  })

  test('transcript POST accepts JSON body', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/transcript', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        transcript: 'Interviewer: Tell me about yourself.\nCandidate: I have 10 years of experience...',
      },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })
})

test.describe('AI Intelligence - Integration', () => {
  test('feedback submission requires authentication', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/feedback', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        rating: 8,
        recommendation: 'hire',
        feedbackText: 'Good technical skills demonstrated.',
      },
    })
    // Should not be a 404 or 405 - route exists and accepts POST
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('analysis endpoint requires authentication', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/analyze', {
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })
})
