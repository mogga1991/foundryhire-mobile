import { env } from '@/lib/env'

const TRACKING_BASE = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Inject open tracking pixel and wrap links for click tracking.
 */
export function injectTracking(params: {
  html: string
  campaignSendId: string
}): string {
  let tracked = params.html

  // Wrap all <a href="..."> links for click tracking
  tracked = tracked.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*?)>/gi,
    (_match, before, url, after) => {
      // Don't wrap unsubscribe links or tracking links
      if (url.includes('/unsubscribe') || url.includes('/api/track/')) return _match
      const trackUrl = `${TRACKING_BASE}/api/track/click?sid=${encodeURIComponent(params.campaignSendId)}&url=${encodeURIComponent(url)}`
      return `<a ${before}href="${trackUrl}"${after}>`
    }
  )

  // Inject open tracking pixel
  const pixel = `<img src="${TRACKING_BASE}/api/track/open?sid=${encodeURIComponent(params.campaignSendId)}" width="1" height="1" style="display:none" alt="" />`
  if (tracked.includes('</body>')) {
    tracked = tracked.replace('</body>', `${pixel}</body>`)
  } else {
    tracked += pixel
  }

  return tracked
}

/**
 * Inject unsubscribe link and List-Unsubscribe header.
 */
export function injectUnsubscribe(params: {
  html: string
  campaignSendId: string
  companyId: string
}): { html: string; headers: Record<string, string> } {
  const unsubUrl = `${TRACKING_BASE}/api/email/unsubscribe?sid=${encodeURIComponent(params.campaignSendId)}&cid=${encodeURIComponent(params.companyId)}`
  const unsubLink = `<p style="font-size:11px;color:#999;text-align:center;margin-top:32px;"><a href="${unsubUrl}" style="color:#999;">Unsubscribe</a></p>`

  let html = params.html
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${unsubLink}</body>`)
  } else {
    html += unsubLink
  }

  return {
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
