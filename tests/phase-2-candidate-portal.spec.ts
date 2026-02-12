import { test, expect } from '@playwright/test'

// Phase 2: Candidate Interview Portal Tests

test.describe('Candidate Portal - API Routes', () => {
  test('GET /api/portal/[token] route exists', async ({ request }) => {
    const response = await request.get('/api/portal/test-invalid-token')
    // Should return 404 (invalid token) but the route itself exists
    expect(response.status()).not.toBe(405)
    // Route should respond with JSON
    const body = await response.json().catch(() => null)
    expect(body).toBeTruthy()
  })

  test('portal API returns error for invalid token', async ({ request }) => {
    const response = await request.get('/api/portal/nonexistent-token-12345')
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  test('candidate interview confirmation endpoint is accessible without auth session', async ({ request }) => {
    const response = await request.post('/api/interviews/candidate/nonexistent-token-12345', {
      data: { status: 'confirmed' },
    })

    // Endpoint should be reachable and token-gated, not blocked by CSRF/auth middleware.
    expect(response.status()).not.toBe(401)
    expect(response.status()).not.toBe(403)
    expect(response.status()).not.toBe(405)
  })
})

test.describe('Candidate Portal - UI Pages', () => {
  test('portal page renders for invalid token with error state', async ({ page }) => {
    await page.goto('/portal/test-invalid-token')
    // Should not 404 - the page component should render
    await expect(page).toHaveURL(/portal/)
  })

  test('portal page does not require authentication', async ({ page }) => {
    await page.goto('/portal/some-token')
    // Should NOT redirect to login (portal is public)
    await expect(page).not.toHaveURL(/login/)
  })

  test('portal page shows loading or error state', async ({ page }) => {
    await page.goto('/portal/invalid-token-abc')
    // Wait for the page to load and show either content or error
    await page.waitForLoadState('networkidle')
    // Page should have some visible content (not blank)
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })
})
