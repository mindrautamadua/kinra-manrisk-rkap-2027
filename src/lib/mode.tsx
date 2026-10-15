"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { modeApi, setReadonlyFlag } from "./data";
import { supabaseConfigured } from "./supabase";

interface ModeCtx { readonly: boolean; sejak: string | null; toggle: () => Promise<void>; busy: boolean }
const Ctx = createContext<ModeCtx>({ readonly: false, sejak: null, toggle: async () => {}, busy: false });

/**
 * Mode presentasi berlaku global (disimpan di app_settings) agar semua layar yang
 * terbuka saat challenge session ikut terkunci. Status disegarkan berkala.
 */
export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [readonly, setReadonly] = useState(false);
  const [sejak, setSejak] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const diLogin = usePathname() === "/login";

  const apply = useCallback((aktif: boolean, waktu: string | null) => {
    setReadonly(aktif); setSejak(waktu); setReadonlyFlag(aktif);
    document.documentElement.toggleAttribute("data-ro", aktif);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || diLogin) return;
    let alive = true;
    const load = () => modeApi.get().then((m) => alive && apply(!!m.aktif, m.sejak ?? null)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [apply, diLogin]);

  const toggle = useCallback(async () => {
    const next = !readonly;
    if (!next && !confirm("Matikan mode presentasi? Data akan dapat diubah kembali dari semua layar.")) return;
    setBusy(true);
    try {
      const waktu = next ? new Date().toISOString() : null;
      await modeApi.set({ aktif: next, sejak: waktu });
      apply(next, waktu);
    } catch (e) { alert(`Gagal mengubah mode: ${(e as Error).message}`); }
    setBusy(false);
  }, [readonly, apply]);

  return <Ctx.Provider value={{ readonly, sejak, toggle, busy }}>{children}</Ctx.Provider>;
}

export const useMode = () => useContext(Ctx);
export const useReadonly = () => useContext(Ctx).readonly;
