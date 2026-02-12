import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export function createSupabaseAdminClient() {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

