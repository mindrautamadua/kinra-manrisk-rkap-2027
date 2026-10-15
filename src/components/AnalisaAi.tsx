"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertOctagon, AlertTriangle, Brain, CheckCircle2, Info, Loader2, MessageCircleQuestion, RefreshCw, X } from "lucide-react";
import { Button } from "./ui";
import { lompat } from "./Kewajaran";
import type { AnalisaRequest, HasilAnalisa, PenilaianAi, TemuanAnalisa } from "@/lib/analisa-ai";

const SEV: Record<TemuanAnalisa["severity"], { label: string; icon: React.ElementType; chip: string }> = {
  kritis: { label: "Kritis", icon: AlertOctagon, chip: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  perhatian: { label: "Perhatian", icon: AlertTriangle, chip: "bg-amber-50 text-amber-800 ring-amber-500/30" },
  info: { label: "Info", icon: Info, chip: "bg-sky-50 text-sky-800 ring-sky-500/25" },
};
const NILAI: Record<PenilaianAi, string> = {
  Wajar: "bg-emerald-50 text-emerald-800 ring-emerald-600/25",
  "Perlu klarifikasi": "bg-amber-50 text-amber-800 ring-amber-500/30",
  "Tidak wajar": "bg-rose-50 text-rose-700 ring-rose-600/25",
};

const kunci = (code: string) => `analisa-ai:${code}`;
function bacaSimpan(code: string): HasilAnalisa | null {
  try { const s = localStorage.getItem(kunci(code)); return s ? (JSON.parse(s) as HasilAnalisa) : null; } catch { return null; }
}

/**
 * Analisa AI satu lembar parameter. Hasil terakhir disimpan di browser per lembar; bila isian
 * berubah sejak analisa (sidik berbeda), pengguna diberi tahu agar menjalankan ulang.
 */
export function AnalisaAiModal({ code, judul, sidik, buildRequest, onClose }: {
  code: string; judul: string; sidik: string; buildRequest: () => AnalisaRequest; onClose: () => void;
}) {
  const [hasil, setHasil] = useState<HasilAnalisa | null>(() => bacaSimpan(code));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const jalankan = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/analisa-parameter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...buildRequest(), sidik }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      setHasil(body as HasilAnalisa);
      try { localStorage.setItem(kunci(code), JSON.stringify(body)); } catch { /* penyimpanan browser tidak tersedia */ }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (!bacaSimpan(code)) void jalankan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const usang = hasil && hasil.sidik !== sidik;
  const keSel = (a: string) => { onClose(); setTimeout(() => lompat(a), 50); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Brain className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Analisa AI</div>
            <div className="truncate text-[16px] font-bold">{code} · {judul}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
          {busy && <div className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Menganalisa isian lembar, jejak hitungan, dan temuan uji kewajaran…</div>}
          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{err}</div>}
          {usang && !busy && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800">
              <AlertTriangle className="h-4 w-4" />Isian lembar berubah sejak analisa ini dibuat. Jalankan ulang untuk hasil terbaru.
            </div>
          )}

          {hasil && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1", NILAI[hasil.penilaian])}>
                  {hasil.penilaian === "Wajar" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{hasil.penilaian}
                </span>
                <span className="text-[11.5px] text-slate-400">{new Date(hasil.waktu).toLocaleString("id-ID")} · {hasil.model}</span>
              </div>
              <p className="leading-relaxed text-slate-800">{hasil.ringkasan}</p>

              <section>
                <h3 className="mb-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Bagaimana hasil terbentuk</h3>
                <p className="leading-relaxed text-slate-700">{hasil.cara_hitung}</p>
              </section>

              {hasil.temuan.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Temuan</h3>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {hasil.temuan.map((t, i) => {
                      const s = SEV[t.severity];
                      return (
                        <li key={i} className="flex gap-3 px-4 py-3">
                          <span className={clsx("mt-0.5 inline-flex h-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", s.chip)}><s.icon className="h-3 w-3" />{s.label}</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{t.judul}</div>
                            <div className="mt-0.5 text-slate-600">{t.penjelasan}</div>
                            {t.saran && <div className="mt-1 text-slate-700"><b>Saran:</b> {t.saran}</div>}
                            {t.sel.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {[...new Set(t.sel)].slice(0, 16).map((a) => /^[A-Z]{1,3}\d+$/.test(a)
                                  ? <button key={a} onClick={() => keSel(a)} className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10.5px] text-slate-600 hover:bg-brand-100 hover:text-brand-800">{a}</button>
                                  : <span key={a} className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10.5px] text-slate-500">{a}</span>)}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Dampak ke status</h3>
                <p className="leading-relaxed text-slate-700">{hasil.dampak_status}</p>
              </section>

              {hasil.pertanyaan_reviewer.length > 0 && (
                <section>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase"><MessageCircleQuestion className="h-3.5 w-3.5" />Pertanyaan yang mungkin diajukan reviewer</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-slate-700">{hasil.pertanyaan_reviewer.map((q, i) => <li key={i}>{q}</li>)}</ol>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-3">
          <p className="text-[11.5px] text-slate-500">Hasil AI adalah bahan reviu, bukan keputusan. Temuan berlabel aturan pada panel Uji Kewajaran tetap menjadi acuan utama.</p>
          <Button variant="outline" onClick={jalankan} disabled={busy} className="ml-auto shrink-0"><RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />{hasil ? "Analisa ulang" : "Analisa"}</Button>
        </div>
      </div>
    </div>
  );
}
