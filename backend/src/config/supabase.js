import { createClient } from '@supabase/supabase-js';

let supabaseClient;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const {
    SUPABASE_SECRET_KEY: secretKey,
    SUPABASE_SERVICE_ROLE_KEY: legacyServiceRoleKey,
    SUPABASE_URL: url,
  } = process.env;
  const serverKey = secretKey ?? legacyServiceRoleKey;

  if (!url || !serverKey) {
    const error = new Error(
      'SUPABASE_URL and SUPABASE_SECRET_KEY must be configured (SUPABASE_SERVICE_ROLE_KEY is supported temporarily).',
    );
    error.statusCode = 500;
    throw error;
  }

  supabaseClient = createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}
