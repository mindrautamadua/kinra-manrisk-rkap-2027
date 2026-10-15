import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Klien Supabase sisi server dengan secret/service role key. Jangan pernah diimpor dari komponen client. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let client: SupabaseClient | null = null;
export function adminDb(): SupabaseClient {
  if (!SUPABASE_URL || !SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY belum diisi.");
  if (!client) client = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
