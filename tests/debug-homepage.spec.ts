import { test } from '@playwright/test'

test('debug homepage', async ({ page }) => {
  await page.goto('https://foundryhire-mobile.vercel.app')
  await page.waitForLoadState('networkidle')

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/homepage-debug.png', fullPage: true })

  // Get page HTML
  const html = await page.content()
  const fs = require('fs')
  fs.writeFileSync('tests/screenshots/homepage.html', html)

  // Log all visible links
  const links = await page.locator('a').all()
  console.log(`Found ${links.length} links on the page`)

  for (const link of links.slice(0, 20)) {
    const text = await link.textContent()
    const href = await link.getAttribute('href')
    const isVisible = await link.isVisible()
    console.log(`Link: "${text?.trim()}" | href: ${href} | visible: ${isVisible}`)
  }

  // Check for any errors in console
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()))
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message))
})
