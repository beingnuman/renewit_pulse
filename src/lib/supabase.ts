import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
