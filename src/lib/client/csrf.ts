/**
 * Client-side helper for CSRF protection (double-submit cookie pattern).
 *
 * Usage:
 * 1) Call getCsrfToken() to set the httpOnly cookie and receive a token.
 * 2) Include returned token in `x-csrf-token` header for mutation requests.
 */

export async function getCsrfToken(): Promise<string> {
  const csrfRes = await fetch('/api/csrf', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  })

  if (!csrfRes.ok) {
    throw new Error('Failed to initialize secure request')
  }

  const csrfData = (await csrfRes.json()) as { token?: string }
  if (!csrfData.token) {
    throw new Error('Missing CSRF token')
  }

  return csrfData.token
}

