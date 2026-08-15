/**
 * @file src/supabaseClient.ts
 * @description Initializes and exports the Supabase client for frontend use.
 * This client is used for anonymous access and should use the anon key.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Check your .env file.')
}

/**
 * Supabase client for frontend use.
 * Uses the anon key for public/authenticated access.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
