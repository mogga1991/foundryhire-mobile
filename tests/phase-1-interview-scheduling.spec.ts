import { test, expect } from '@playwright/test'

// Phase 1: Interview Scheduling Tests

test.describe('Interview Scheduling - API Routes Exist', () => {
  test('POST /api/interviews/suggest-times route exists', async ({ request }) => {
    const response = await request.post('/api/interviews/suggest-times', {
      data: { candidateId: 'test-id' },
    })
    expect(response.status()).not.toBe(404)
  })

  test('POST /api/interviews route exists', async ({ request }) => {
    const response = await request.post('/api/interviews', {
      data: {
        candidateId: 'test-id',
        scheduledAt: new Date().toISOString(),
      },
    })
    expect(response.status()).not.toBe(404)
  })

  test('GET /api/interviews route exists', async ({ request }) => {
    const response = await request.get('/api/interviews')
    expect(response.status()).not.toBe(404)
  })
})

test.describe('Interview Scheduling - UI Pages', () => {
  test('/login redirects to dashboard', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('candidate list page is accessible without auth pages', async ({ page }) => {
    await page.goto('/candidates')
    await expect(page).toHaveURL(/(candidates|dashboard)/)
  })
})

test.describe('Interview Scheduling - Component Integration', () => {
  test('schedule interview API returns non-404 response', async ({ request }) => {
    const response = await request.post('/api/interviews/suggest-times', {
      headers: { 'Content-Type': 'application/json' },
      data: { candidateId: 'nonexistent-id' },
    })
    expect(response.status()).not.toBe(404)
  })

  test('interviews create API accepts POST requests', async ({ request }) => {
    const response = await request.post('/api/interviews', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        candidateId: 'nonexistent-id',
        scheduledAt: new Date().toISOString(),
        durationMinutes: 30,
      },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('interviews list API accepts GET requests', async ({ request }) => {
    const response = await request.get('/api/interviews')
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })
})
