import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = url.startsWith("http") && key.length > 20 && !key.startsWith("isi-");

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local");
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** Lempar error Supabase sebagai Error biasa agar mudah ditangani UI. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
