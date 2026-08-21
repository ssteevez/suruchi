import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SECURITY: only the public URL and the anon key may ever appear here.
// The anon key is safe to ship ONLY because Row Level Security restricts
// every table to allowlisted, authenticated users (see supabase/schema.sql).
// NEVER reference SUPABASE_SERVICE_ROLE_KEY in any VITE_* variable or any
// file that reaches the browser bundle.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars were present at build time. */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

/**
 * Shared client. Null when not configured — callers must check
 * isSupabaseConfigured (the admin shows a setup screen instead of
 * silently falling back to localStorage).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
