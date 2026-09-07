import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getAccessToken } from '@/lib/api-client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** PostgREST-compatible client — uses Nest JWT when self-hosted. */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options = {}) => {
      const headers = new Headers(options.headers);
      headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
      const token = getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
  },
});
