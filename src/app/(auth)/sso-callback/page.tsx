import { redirect } from 'next/navigation'

type SSOCallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value ?? null
}

export default async function SSOCallbackPage({ searchParams }: SSOCallbackPageProps) {
  const params = await searchParams
  const query = new URLSearchParams()

  const code = firstQueryValue(params.code)
  const errorDescription = firstQueryValue(params.error_description)
  const next = firstQueryValue(params.next)

  if (code) {
    query.set('code', code)
  }

  if (errorDescription) {
    query.set('error_description', errorDescription)
  }

  if (next?.startsWith('/') && !next.startsWith('//')) {
    query.set('next', next)
  }

  const target = query.toString()
    ? `/api/auth/callback?${query.toString()}`
    : '/api/auth/callback'

  redirect(target)
}
