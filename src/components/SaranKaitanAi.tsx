"use client";
import { Check, Loader2, Sparkles } from "lucide-react";
import type { KaitkanResponse } from "@/lib/kaitkan-ai";

export function AiKaitkanButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} title="Pilihkan item yang relevan dengan AI"
      className="inline-flex items-center gap-1 rounded-md border border-dashed border-violet-500/50 px-1.5 py-0.5 text-[11px] text-violet-700 hover:bg-violet-50 disabled:opacity-60">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}AI
    </button>
  );
}

/** Kotak saran AI di bagian atas panel picker. */
export function SaranKaitanBox({ loading, hasil, error, value, nama, onApply }: {
  loading: boolean; hasil: KaitkanResponse | null; error: string | null; value: string[];
  nama: (kode: string) => string | undefined; onApply: (kode: string[]) => void;
}) {
  if (!loading && !hasil && !error) return null;
  const baru = hasil?.saran.map((s) => s.kode).filter((k) => !value.includes(k)) ?? [];
  return (
    <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-[12px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 font-bold text-violet-800"><Sparkles className="h-3.5 w-3.5" />Saran AI</span>
        {hasil && baru.length > 0 && (
          <button onClick={() => onApply(baru)} className="rounded-md bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-violet-700">
            Terapkan {baru.length === hasil.saran.length ? "semua" : `${baru.length} baru`}
          </button>
        )}
      </div>
      {loading && <div className="flex items-center gap-1.5 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Menganalisis risk event…</div>}
      {error && <div className="text-rose-700">{error}</div>}
      {hasil && !hasil.saran.length && <div className="text-slate-500">AI tidak menemukan item yang cukup relevan.</div>}
      {hasil?.saran.map((s) => (
        <div key={s.kode} className="flex items-start gap-1.5 py-1">
          {value.includes(s.kode)
            ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            : <button onClick={() => onApply([s.kode])} title="Tambahkan" className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-violet-400 text-[10px] leading-none text-violet-700 hover:bg-violet-100">+</button>}
          <div>
            <div><b className="mr-1">{s.kode}</b>{nama(s.kode)}</div>
            <div className="text-[11px] text-slate-600 italic">{s.alasan}</div>
          </div>
        </div>
      ))}
      {hasil?.catatan && <div className="mt-1 text-[11px] text-slate-500">{hasil.catatan}</div>}
    </div>
  );
}
