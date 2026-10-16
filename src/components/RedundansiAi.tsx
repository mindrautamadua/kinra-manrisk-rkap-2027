"use client";
import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Copy, GitMerge, Layers, Loader2, Play, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "./ui";
import {
  isianUbah, KOLOM_UBAH, simpanRedundansi, type HasilRedundansi, type JenisRedundan, type KelompokRedundan, type OpsiTindakan,
  type RedundansiRequest,
} from "@/lib/redundansi-risiko";

export const GAYA_JENIS: Record<JenisRedundan, { icon: React.ElementType; chip: string }> = {
  Duplikat: { icon: Copy, chip: "bg-rose-50 text-rose-700 ring-rose-600/25" },
  "Tumpang tindih": { icon: Layers, chip: "bg-amber-50 text-amber-800 ring-amber-500/30" },
  "Sebab-akibat": { icon: GitMerge, chip: "bg-sky-50 text-sky-800 ring-sky-600/25" },
};

/** Lencana redundansi pada baris register: jenis terberat dan nomor risiko pasangannya. */
export function RedundansiBadge({ kelompok, id, nomor, sidikKini, onClick }: {
  kelompok: KelompokRedundan[]; id: string;
  nomor: (id: string) => number | null;
  sidikKini: (id: string) => string | null;
  onClick: () => void;
}) {
  const aktif = kelompok.filter((x) => !x.diterapkan);
  if (aktif.length === 0) return null;
  const k = aktif[0];
  const g = GAYA_JENIS[k.jenis];
  const pasangan = [...new Set(aktif.flatMap((x) => x.ids))].filter((x) => x !== id).map(nomor).filter((n): n is number => n != null).sort((a, b) => a - b);
  if (pasangan.length === 0) return null;
  const usang = aktif.some((x) => x.ids.some((m) => { const s = sidikKini(m); return s != null && s !== x.sidik[m]; }));
  return (
    <button onClick={onClick} title={`${usang ? "(Usang: isian berubah sejak diperiksa)\n" : ""}${aktif.map((x) => x.alasan).join("\n")}`}
      className={clsx("mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1", g.chip, usang && "opacity-50")}>
      <g.icon className="h-3 w-3" />{k.jenis} {pasangan.map((n) => `#${n}`).join(", ")}{usang && " · usang"}
    </button>
  );
}

/**
 * Cek redundansi seluruh Risk Register: kelompok risk event yang duplikat, tumpang tindih, atau sebenarnya
 * sebab/akibat risiko lain. Hasil disimpan di browser; kelompok ditandai usang bila isian anggotanya berubah.
 */
export function RedundansiAiModal({ hasil, onHasil, buildRequest, nomor, sidikKini, fokus, ro, onHapus, onTerapkan, onClose }: {
  hasil: HasilRedundansi | null;
  onHasil: (h: HasilRedundansi) => void;
  buildRequest: () => Promise<RedundansiRequest>;
  /** Nomor urut & nama risiko saat ini, null bila risiko sudah dihapus. */
  nomor: (id: string) => { no: number; nama: string } | null;
  sidikKini: (id: string) => string | null;
  fokus?: string | null;
  ro: boolean;
  onHapus: (id: string) => void;
  /** Eksekusi opsi tindakan ke register (termasuk konfirmasi); hasil diperbarui oleh pemanggil. */
  onTerapkan: (k: KelompokRedundan, o: OpsiTindakan) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<JenisRedundan | "">("");
  const [proses, setProses] = useState<string | null>(null);
  const terapkan = async (k: KelompokRedundan, o: OpsiTindakan, kunci: string) => {
    setProses(kunci);
    try { await onTerapkan(k, o); } finally { setProses(null); }
  };

  const jalankan = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/redundansi-risiko", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await buildRequest()) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const h = body as HasilRedundansi;
      simpanRedundansi(h); onHasil(h);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  /** Kelompok yang masih punya minimal dua anggota di register; anggota terhapus dianggap sudah ditindaklanjuti. */
  const daftar = (hasil?.kelompok ?? [])
    .map((k) => ({ k, anggota: k.ids.map((id) => ({ id, n: nomor(id) })).filter((x): x is { id: string; n: { no: number; nama: string } } => !!x.n).sort((a, b) => a.n.no - b.n.no) }));
  const aktif = daftar.filter((x) => x.anggota.length >= 2);
  const selesai = daftar.length - aktif.length;
  const usang = (k: KelompokRedundan) => k.ids.some((id) => { const s = sidikKini(id); return s != null && s !== k.sidik[id]; });
  const jumlahUsang = aktif.filter((x) => usang(x.k)).length;
  const hitung = (j: JenisRedundan) => aktif.filter((x) => x.k.jenis === j).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Copy className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Cek Redundansi AI</div>
            <div className="truncate text-[16px] font-bold">Duplikasi & Tumpang Tindih Risk Event</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
          {!hasil && !busy && (
            <p className="text-slate-600">AI membandingkan seluruh Risk Event beserta root cause, dampak, kontrol, dan mitigasinya untuk menemukan risiko yang duplikat, tumpang tindih cakupannya, atau sebenarnya merupakan penyebab/dampak risiko lain. Redundansi membuat eksposur terhitung dua kali dan kepemilikan risiko terpecah.</p>
          )}
          {busy && <div className="flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Membandingkan Risk Event antar baris register… (±30-60 detik)</div>}
          {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{err}</div>}
          {hasil && jumlahUsang > 0 && !busy && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />{jumlahUsang} kelompok berisi risiko yang berubah sejak diperiksa (ditandai usang). Jalankan ulang untuk hasil terbaru.
            </div>
          )}
          {hasil && selesai > 0 && !busy && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />{selesai} kelompok sudah ditindaklanjuti (anggotanya dihapus dari register).
            </div>
          )}

          {hasil && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFilter("")} className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", !filter ? "bg-brand-700 text-white ring-brand-700" : "ring-line")}>Semua ({aktif.length})</button>
                {(Object.keys(GAYA_JENIS) as JenisRedundan[]).map((j) => {
                  const g = GAYA_JENIS[j];
                  return (
                    <button key={j} onClick={() => setFilter(filter === j ? "" : j)} className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", g.chip, filter === j && "ring-2")}>
                      <g.icon className="h-3.5 w-3.5" />{j} ({hitung(j)})
                    </button>
                  );
                })}
                <span className="ml-auto text-[11.5px] text-slate-400">{new Date(hasil.waktu).toLocaleString("id-ID")} · {hasil.model}</span>
              </div>
              <p className="leading-relaxed text-slate-800">{hasil.ringkasan}</p>

              {aktif.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800"><CheckCircle2 className="h-4 w-4" />Tidak ada kelompok redundan yang tersisa.</div>
              ) : (
                <ul className="space-y-3">
                  {aktif.filter((x) => !filter || x.k.jenis === filter).map(({ k, anggota }, i) => {
                    const g = GAYA_JENIS[k.jenis];
                    const terfokus = !!fokus && k.ids.includes(fokus);
                    return (
                      <li key={i} ref={terfokus ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                        className={clsx("rounded-xl border border-line px-4 py-3", terfokus && "bg-brand-50/50 ring-1 ring-brand-200")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", g.chip)}><g.icon className="h-3 w-3" />{k.jenis}</span>
                          {usang(k) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-500">usang</span>}
                          {k.diterapkan && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-emerald-600/25"><CheckCircle2 className="h-3 w-3" />Diterapkan: {k.diterapkan}</span>}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {anggota.map(({ id, n }) => {
                            const dipertahankan = k.pertahankan === id;
                            const bisaHapus = !ro && !!k.pertahankan && !dipertahankan;
                            return (
                              <li key={id} className="flex items-start gap-2">
                                <span className="w-7 shrink-0 text-right font-bold text-slate-400">#{n.no}</span>
                                <span className={clsx("min-w-0 flex-1", dipertahankan ? "font-semibold" : "text-slate-700")}>{n.nama}</span>
                                {dipertahankan && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-emerald-600/25">pertahankan</span>}
                                {bisaHapus && (
                                  <button onClick={() => onHapus(id)} title="Hapus risiko ini dari register (minta konfirmasi)"
                                    className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-rose-600 hover:underline">
                                    <Trash2 className="h-3 w-3" />Hapus
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <div className="mt-2 text-slate-600">{k.alasan}</div>
                        <div className="mt-2 rounded-lg bg-brand-50/60 px-3 py-2 ring-1 ring-brand-200/60">
                          <div className="text-[11px] font-bold tracking-wider text-brand-700 uppercase">Saran tindak lanjut</div>
                          <div className="mt-0.5 text-slate-800">{k.saran}</div>
                        </div>
                        {!k.diterapkan && (k.opsi ?? []).length > 0 && (
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {k.opsi!.map((o, j) => {
                              const kunci = `${i}-${j}`;
                              const no = (id: string) => `#${nomor(id)?.no ?? "?"}`;
                              return (
                                <div key={j} className="flex flex-col rounded-lg border border-line px-3 py-2">
                                  <div className="font-semibold text-slate-800">{o.label}</div>
                                  <div className="mt-0.5 text-[12px] text-slate-600">{o.penjelasan}</div>
                                  <details className="mt-1.5 text-[12px]">
                                    <summary className="cursor-pointer font-semibold text-brand-700 select-none">Lihat perubahan</summary>
                                    <div className="mt-1.5 space-y-2">
                                      {o.ubah.map((u) => (
                                        <div key={u.id}>
                                          <div className="font-bold text-slate-500">{no(u.id)} diubah</div>
                                          {KOLOM_UBAH.filter((c) => isianUbah(u)[c.key]).map((c) => (
                                            <div key={c.key} className="mt-0.5"><span className="text-slate-500">{c.label}:</span> <span className="whitespace-pre-line text-slate-800">{u[c.key]}</span></div>
                                          ))}
                                        </div>
                                      ))}
                                      {o.hapus.length > 0 && <div className="font-bold text-rose-600">{o.hapus.map(no).join(", ")} dihapus</div>}
                                    </div>
                                  </details>
                                  {!ro && (
                                    <Button variant="outline" onClick={() => terapkan(k, o, kunci)} disabled={!!proses || usang(k)}
                                      title={usang(k) ? "Isian berubah sejak diperiksa. Periksa ulang dulu." : undefined} className="mt-2 self-start">
                                      {proses === kunci ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Terapkan
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-3">
          <p className="text-[11.5px] text-slate-500">Sebelum menghapus, pindahkan root cause, dampak, atau mitigasi yang masih berguna ke risiko yang dipertahankan.</p>
          <Button variant="outline" onClick={jalankan} disabled={busy} className="ml-auto shrink-0"><RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />{hasil ? "Periksa ulang" : "Mulai pemeriksaan"}</Button>
        </div>
      </div>
    </div>
  );
}
