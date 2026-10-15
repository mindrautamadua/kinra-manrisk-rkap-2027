import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Dipakai UI untuk menampilkan pesan "belum dikonfigurasi". */
export const supabaseConfigured = url.startsWith("http");

let client: SupabaseClient | null = null;
/**
 * Klien browser yang diarahkan ke proxy /api/db (lihat src/app/api/db). Proxy memeriksa sesi login
 * dan meneruskan query ke Supabase dengan secret key, sehingga browser tidak memegang akses tabel.
 */
export function sb(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("Supabase belum dikonfigurasi. Isi NEXT_PUBLIC_SUPABASE_URL di .env.local");
  if (!client) {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    client = createClient(`${origin}/api/db`, "proxy", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          const res = await fetch(input, { ...init, credentials: "same-origin" });
          if (res.status === 401 && typeof window !== "undefined") {
            window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }
          return res;
        },
      },
    });
  }
  return client;
}

/** Lempar error Supabase sebagai Error biasa agar mudah ditangani UI. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
