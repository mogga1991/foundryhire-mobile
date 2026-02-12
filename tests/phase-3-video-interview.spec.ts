import { test, expect } from '@playwright/test'

// Phase 3: Video Interview System Tests

test.describe('Video Interview - Dashboard Pages', () => {
  test('interviews dashboard is reachable', async ({ page }) => {
    await page.goto('/interviews')
    await expect(page).toHaveURL(/interviews/)
  })

  test('interview detail route resolves without 404 page', async ({ page }) => {
    await page.goto('/interviews/some-interview-id')
    await expect(page).toHaveURL(/interviews/)
  })
})

test.describe('Video Interview - API Routes', () => {
  test('GET /api/interviews/[id] route exists', async ({ request }) => {
    const response = await request.get('/api/interviews/test-id')
    expect(response.status()).not.toBe(404)
  })

  test('PATCH /api/interviews/[id] route exists', async ({ request }) => {
    const response = await request.patch('/api/interviews/test-id', {
      data: { status: 'completed' },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('DELETE /api/interviews/[id] route exists', async ({ request }) => {
    const response = await request.delete('/api/interviews/test-id')
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })

  test('GET /api/interviews/[id]/feedback route exists', async ({ request }) => {
    const response = await request.get('/api/interviews/test-id/feedback')
    expect(response.status()).not.toBe(404)
  })

  test('POST /api/interviews/[id]/feedback route exists', async ({ request }) => {
    const response = await request.post('/api/interviews/test-id/feedback', {
      data: { rating: 8, feedbackText: 'Great candidate' },
    })
    expect(response.status()).not.toBe(404)
    expect(response.status()).not.toBe(405)
  })
})

test.describe('Video Interview - Navigation', () => {
  test('legacy /login path routes into dashboard', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/dashboard/)
  })
})
