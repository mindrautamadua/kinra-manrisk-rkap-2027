"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";
import type { SaranMitigasiRequest, SaranMitigasiResponse, OpsiMitigasi } from "@/lib/saran-mitigasi";

/**
 * Tombol AI pada sel Rencana Mitigasi: menilai mitigasi saat ini dan memberi beberapa opsi
 * yang bisa dipakai (mengganti) atau ditambahkan. Tidak ada yang tersimpan tanpa klik.
 */
export function MitigasiAi({ risiko, current, onApply }: {
  risiko: SaranMitigasiRequest["risiko"]; current: string | null;
  onApply: (rencana: string, kategori: string, mode: "ganti" | "tambah") => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasil, setHasil] = useState<SaranMitigasiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const minta = async () => {
    setOpen(true);
    if (!risiko.risk_event) { setError("Pilih Risk Event dari taksonomi terlebih dahulu."); return; }
    setLoading(true); setError(null); setHasil(null);
    try {
      const res = await fetch("/api/saran-mitigasi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ risiko } satisfies SaranMitigasiRequest) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Gagal meminta masukan AI.");
      setHasil(body as SaranMitigasiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal meminta masukan AI.");
    } finally {
      setLoading(false);
    }
  };
  const pakai = (o: OpsiMitigasi, mode: "ganti" | "tambah") => { onApply(o.rencana, o.kategori, mode); setOpen(false); };

  return (
    <div ref={ref} className="mt-1.5">
      <button data-edit onClick={() => (open && hasil ? setOpen(false) : minta())} disabled={loading} title="Minta masukan rencana mitigasi dari AI"
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-violet-500/50 px-1.5 py-0.5 text-[11px] text-violet-700 hover:bg-violet-50 disabled:opacity-60">
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}Masukan AI
      </button>
      {open && (
        <FloatingPanel anchor={ref} panelRef={panelRef} align="left" width={440} maxHeight={480}>
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-800"><Sparkles className="h-3.5 w-3.5" />Masukan Rencana Mitigasi</span>
            {!loading && <button onClick={minta} title="Minta ulang" className="rounded p-1 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-3.5 w-3.5" /></button>}
          </div>
          {loading && <div className="flex items-center gap-1.5 px-1 py-3 text-[12px] text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyusun masukan…</div>}
          {error && <div className="rounded-md bg-rose-50 px-2 py-1.5 text-[12px] text-rose-700">{error}</div>}
          {hasil && (
            <div className="space-y-2 text-[12px]">
              {hasil.evaluasi && (
                <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-950 ring-1 ring-amber-300/60">
                  <b>Penilaian mitigasi saat ini:</b> {hasil.evaluasi}
                </div>
              )}
              {hasil.opsi.map((o, i) => (
                <div key={i} className="rounded-lg border border-violet-200 bg-violet-50/50 p-2.5">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-slate-500">OPSI {i + 1}</span>
                    <span className="rounded bg-white px-1.5 text-[10.5px] font-semibold text-violet-700 ring-1 ring-violet-200">{o.kategori}</span>
                  </div>
                  <div className="leading-snug text-slate-800">{o.rencana}</div>
                  <div className="mt-1 text-[11px] text-slate-500 italic">{o.alasan}</div>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => pakai(o, "ganti")} className="rounded-md bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-700">
                      {current?.trim() ? "Ganti dengan ini" : "Pakai"}
                    </button>
                    {current?.trim() && (
                      <button onClick={() => pakai(o, "tambah")} className="rounded-md border border-violet-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">Tambahkan</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="px-1 text-[10.5px] text-slate-400">Masukan oleh {hasil.model}. Lengkapi bagian &quot;[...]&quot; sebelum final.</div>
            </div>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}
