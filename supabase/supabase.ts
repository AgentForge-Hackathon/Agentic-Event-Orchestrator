import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config.js';

/**
 * Server-side Supabase client using the service role key.
 * Use this for admin operations (e.g., reading user profiles).
 * NEVER expose this client or key to the frontend.
 */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Create a Supabase client scoped to a specific user's JWT.
 * Use this for operations that should respect row-level security.
 */
export function createSupabaseClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
