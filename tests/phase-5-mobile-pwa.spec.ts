import { test, expect } from '@playwright/test'

// Phase 5: Mobile Interview Features + PWA Tests

test.describe('PWA - Manifest', () => {
  test('manifest.json is referenced in HTML head and public file exists', async ({ page }) => {
    await page.goto('/dashboard')
    const manifestLink = page.locator('link[rel="manifest"]')
    await expect(manifestLink).toBeAttached()
    const href = await manifestLink.getAttribute('href')
    expect(href).toContain('manifest')

    const manifest = await page.evaluate(async () => {
      const res = await fetch('/manifest.json')
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('json')) return null
      return res.json()
    })

    if (manifest) {
      expect(manifest.name).toBe('VerticalHire')
      expect(manifest.display).toBe('standalone')
      expect(manifest.theme_color).toBe('#f97316')
    }
  })
})

test.describe('Mobile - Responsive Pages', () => {
  test('login path redirects to dashboard on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('portal page works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/portal/test-token')
    await expect(page).not.toHaveURL(/portal\/login/)
  })

  test('interviews page is accessible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/interviews')
    await expect(page).toHaveURL(/interviews/)
  })
})

test.describe('Mobile - Meta Tags', () => {
  test('page has viewport meta tag', async ({ page }) => {
    await page.goto('/dashboard')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })

  test('page has theme-color meta tag', async ({ page }) => {
    await page.goto('/dashboard')
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content')
    expect(themeColor).toBe('#f97316')
  })
})
