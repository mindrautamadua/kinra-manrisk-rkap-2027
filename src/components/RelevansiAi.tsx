"use client";
import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Compass, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import { Button } from "./ui";
import {
  simpanRelevansi, type HasilRelevansi, type PenilaianRelevansi, type RelevansiRequest, type Tingkat,
} from "@/lib/relevansi-risiko";

export const GAYA_TINGKAT: Record<Tingkat, { icon: React.ElementType; chip: string }> = {
  Relevan: { icon: CheckCircle2, chip: "bg-emerald-50 text-emerald-800 ring-emerald-600/25" },
  "Perlu dikontekstualkan": { icon: AlertTriangle, chip: "bg-amber-50 text-amber-800 ring-amber-500/30" },
  "Kurang relevan": { icon: XCircle, chip: "bg-rose-50 text-rose-700 ring-rose-600/25" },
};

/** Lencana relevansi pada baris register; redup bila isian berubah sejak dinilai. */
export function RelevansiBadge({ p, usang, onClick }: { p: PenilaianRelevansi; usang: boolean; onClick: () => void }) {
  if (p.diterapkan && !usang) {
    return (
      <button onClick={onClick} title={`Usulan Deskripsi Risk Event dari AI sudah dipakai. Penilaian awal: ${p.relevansi}. Jalankan ulang untuk menilai isian terbaru.`}
        className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-600/25">
        <CheckCircle2 className="h-3 w-3" />Usulan AI dipakai
      </button>
    );
  }
  const g = GAYA_TINGKAT[p.relevansi];
  return (
    <button onClick={onClick} title={`${usang ? "(Usang: isian berubah sejak dinilai)\n" : ""}${p.alasan}`}
      className={clsx("mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1", g.chip, usang && "opacity-50")}>
      <g.icon className="h-3 w-3" />{p.relevansi}{usang && " · usang"}
    </button>
  );
}

/**
 * Uji relevansi seluruh Risk Register terhadap konteks bisnis KINRA (pos RKAP 2027, Sasaran RJPP,
 * Program Strategis). Hasil disimpan di browser; penilaian per risiko ditandai usang bila isiannya berubah.
 */
export function RelevansiAiModal({ hasil, onHasil, buildRequest, nomor, sidikKini, fokus, ro, onPakaiDeskripsi, onClose }: {
  hasil: HasilRelevansi | null;
  onHasil: (h: HasilRelevansi) => void;
  buildRequest: () => Promise<RelevansiRequest>;
  /** Nomor urut & nama risiko saat ini, null bila risiko sudah dihapus. */
  nomor: (id: string) => { no: number; nama: string } | null;
  sidikKini: (id: string) => string | null;
  fokus?: string | null;
  ro: boolean;
  onPakaiDeskripsi: (id: string, deskripsi: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Tingkat | "">("");

  const jalankan = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/relevansi-risiko", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await buildRequest()) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const h = body as HasilRelevansi;
      simpanRelevansi(h); onHasil(h);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const daftar = (hasil?.penilaian ?? [])
    .map((p) => ({ p, n: nomor(p.id) }))
    .filter((x): x is { p: PenilaianRelevansi; n: { no: number; nama: string } } => !!x.n)
    .sort((a, b) => a.n.no - b.n.no);
  const hitung = (t: Tingkat) => daftar.filter((x) => x.p.relevansi === t).length;
  const jumlahUsang = daftar.filter((x) => sidikKini(x.p.id) !== x.p.sidik).length;
  const jumlahDipakai = daftar.filter((x) => x.p.diterapkan && sidikKini(x.p.id) === x.p.sidik).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Compass className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Cek Relevansi AI</div>
            <div className="truncate text-[16px] font-bold">Relevansi Risk Register terhadap Konteks KINRA</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
          {!hasil && !busy && (
            <p className="text-slate-600">AI menilai setiap Risk Event terhadap profil bisnis KINRA sebagai pengelola Kawasan Industri Sei Mangkei: pos pendapatan dan laba RKAP 2027, Sasaran Strategis RJPP 2026-2030, dan Program Strategis. Risiko yang uraiannya masih generik atau tidak sesuai bisnis KINRA akan ditandai beserta usulan perbaikannya.</p>
          )}
          {busy && <div className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Menilai relevansi register terhadap RKAP, RJPP, dan program strategis… (±30-60 detik)</div>}
          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{err}</div>}
          {hasil && jumlahUsang > 0 && !busy && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />{jumlahUsang} risiko berubah sejak dinilai (ditandai usang). Jalankan ulang untuk hasil terbaru.
            </div>
          )}
          {hasil && jumlahDipakai > 0 && !busy && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Usulan deskripsi sudah dipakai pada {jumlahDipakai} risiko. Klik “Nilai ulang” untuk memastikan relevansinya setelah perubahan.
            </div>
          )}

          {hasil && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFilter("")} className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", !filter ? "bg-brand-700 text-white ring-brand-700" : "ring-line")}>Semua ({daftar.length})</button>
                {(Object.keys(GAYA_TINGKAT) as Tingkat[]).map((t) => {
                  const g = GAYA_TINGKAT[t];
                  return (
                    <button key={t} onClick={() => setFilter(filter === t ? "" : t)} className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", g.chip, filter === t && "ring-2")}>
                      <g.icon className="h-3.5 w-3.5" />{t} ({hitung(t)})
                    </button>
                  );
                })}
                <span className="ml-auto text-[11.5px] text-slate-400">{new Date(hasil.waktu).toLocaleString("id-ID")} · {hasil.model}</span>
              </div>
              <p className="leading-relaxed text-slate-800">{hasil.ringkasan}</p>

              <ul className="divide-y divide-line rounded-xl border border-line">
                {daftar.filter((x) => !filter || x.p.relevansi === filter).map(({ p, n }) => {
                  const g = GAYA_TINGKAT[p.relevansi];
                  const usang = sidikKini(p.id) !== p.sidik;
                  const dipakai = !!p.diterapkan && !usang;
                  return (
                    <li key={p.id} ref={fokus === p.id ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                      className={clsx("flex gap-3 px-4 py-3", fokus === p.id && "bg-brand-50/50")}>
                      <span className="w-6 shrink-0 pt-0.5 text-right font-bold text-slate-400">{n.no}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{n.nama}</span>
                          <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", g.chip)}><g.icon className="h-3 w-3" />{p.relevansi}</span>
                          {usang && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">usang</span>}
                          {dipakai && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-emerald-600/25">usulan dipakai</span>}
                        </div>
                        <div className="mt-0.5 text-slate-600">{p.alasan}</div>
                        {p.masalah && <div className="mt-1 text-slate-700"><b>Masalah:</b> {p.masalah}</div>}
                        {p.kaitan.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">{p.kaitan.map((k) => <span key={k} className="rounded bg-slate-100 px-1.5 py-px text-[10.5px] text-slate-600">{k}</span>)}</div>
                        )}
                        {p.saran_deskripsi && (
                          <div className="mt-2 rounded-lg bg-brand-50/60 px-3 py-2 ring-1 ring-brand-200/60">
                            <div className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">Usulan Deskripsi Risk Event</div>
                            <div className="mt-0.5 text-slate-800">{p.saran_deskripsi}</div>
                            {!ro && (
                              <button disabled={dipakai} onClick={() => onPakaiDeskripsi(p.id, p.saran_deskripsi)}
                                className="mt-1 text-[12px] font-semibold text-brand-700 hover:underline disabled:text-emerald-700 disabled:no-underline">
                                {dipakai ? "✓ Dipakai" : "Pakai deskripsi ini"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {hasil.celah.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Risiko material KINRA yang belum tercakup</h3>
                  <ul className="space-y-1.5">
                    {hasil.celah.map((c, i) => <li key={i} className="rounded-lg bg-paper px-3 py-2"><b>{c.tema}</b> <span className="text-slate-600">— {c.alasan}</span></li>)}
                  </ul>
                  <p className="mt-1 text-[11.5px] text-slate-500">Gunakan tombol “Usulan Risiko AI” untuk menambahkan risiko dari taksonomi.</p>
                </section>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-3">
          <p className="text-[11.5px] text-slate-500">Hasil AI adalah bahan reviu, bukan keputusan. Verifikasi dengan pemilik risiko sebelum mengubah register.</p>
          <Button variant="outline" onClick={jalankan} disabled={busy} className="ml-auto shrink-0"><RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />{hasil ? "Nilai ulang" : "Mulai penilaian"}</Button>
        </div>
      </div>
    </div>
  );
}
