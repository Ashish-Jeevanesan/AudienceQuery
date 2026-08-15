/**
 * @file supabase-admin.ts
 * @description Initializes and exports the Supabase admin client for backend use.
 * This uses the service_role_key and should NEVER be exposed to the frontend.
 * It bypasses RLS policies for admin operations.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing Supabase credentials. Check your .env file:\n' +
    '  VITE_SUPABASE_URL\n' +
    '  SUPABASE_SERVICE_ROLE_KEY'
  )
}

/**
 * Supabase admin client for backend use.
 * Uses the service_role_key which bypasses RLS policies.
 * IMPORTANT: This should only be used on the server side.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
