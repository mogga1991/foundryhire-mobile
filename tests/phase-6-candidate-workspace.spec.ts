import { expect, test } from '@playwright/test'

test.describe('Candidate Workspace - Route Protection', () => {
  test('documents page redirects to candidate login when unauthenticated', async ({ page }) => {
    await page.goto('/portal/documents')
    await expect(page).toHaveURL(/portal\/login/)
  })

  test('offers page redirects to candidate login when unauthenticated', async ({ page }) => {
    await page.goto('/portal/offers')
    await expect(page).toHaveURL(/portal\/login/)
  })

  test('onboarding page redirects to candidate login when unauthenticated', async ({ page }) => {
    await page.goto('/portal/onboarding')
    await expect(page).toHaveURL(/portal\/login/)
  })

  test('interviews page redirects to candidate login when unauthenticated', async ({ page }) => {
    await page.goto('/portal/interviews')
    await expect(page).toHaveURL(/portal\/login/)
  })
})

test.describe('Candidate Workspace - API Authorization', () => {
  test('GET /api/candidate/documents requires candidate auth', async ({ request }) => {
    const response = await request.get('/api/candidate/documents')
    expect(response.status()).toBe(401)
  })

  test('GET /api/candidate/offers requires candidate auth', async ({ request }) => {
    const response = await request.get('/api/candidate/offers')
    expect(response.status()).toBe(401)
  })

  test('GET /api/candidate/onboarding requires candidate auth', async ({ request }) => {
    const response = await request.get('/api/candidate/onboarding')
    expect(response.status()).toBe(401)
  })

  test('POST /api/interviews/[id]/offer requires employer auth', async ({ request }) => {
    const response = await request.post('/api/interviews/00000000-0000-0000-0000-000000000000/offer', {
      data: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })

    expect([401, 403]).toContain(response.status())
  })
})
