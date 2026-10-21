"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, CheckCircle2, CircleAlert, X } from "lucide-react";
import { ArahBadge, StatusBadge } from "@/components/ui";
import { alasanStatus, ATURAN_KHUSUS, cekUrutanBatas, NARASI_STATUS, nilaiParam, polaritas } from "@/lib/format";
import type { RamRow } from "@/lib/ram";

/** Risk threshold PTPN III hanya dua warna: Hijau sampai Tolerance, Merah setelahnya. Limit dan Appetite tetap ditandai sebagai acuan. */
const ZONA = [
  { status: "Hijau", warna: "bg-emerald-500 flex-[3]" },
  { status: "Merah", warna: "bg-rose-600 flex-1" },
] as const;

/** Konsekuensi tiap status sesuai catatan lembar RAM (pedoman PT DAM). */
const TINDAKAN: Record<string, { tingkat: string; isi: string }> = {
  Merah: {
    tingkat: "Eskalasi dan intervensi PT DAM",
    isi: "Kondisi dieskalasi dan memerlukan intervensi PT DAM. Rencana pemulihan harus konkret dan terukur untuk mengembalikan hasil ke dalam batas toleransi, dan parameter wajib ditopang risk event di Risk Register.",
  },
};

const BATAS = [
  { key: "limit", label: "Limit" },
  { key: "appetite", label: "Appetite" },
  { key: "tolerance", label: "Tolerance" },
] as const;

/** Posisi hasil pada skala zona (0–100%). Zona digambar sama lebar; posisi di dalam zona diinterpolasi dari nilai batas. */
function posisi(x: number, l: number, a: number, t: number, naik: boolean) {
  // "Keburukan": makin besar makin buruk, apa pun arah parameternya.
  const [b, bl, ba, bt] = naik ? [-x, -l, -a, -t] : [x, l, a, t];
  const span = Math.abs(bt - bl) || Math.abs(bl) || 1;
  const frac = (v: number, lo: number, hi: number) => (hi === lo ? 0.5 : Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
  const clamp = (v: number) => Math.min(0.92, Math.max(0.08, v));
  if (b < bl) return (clamp(1 - (bl - b) / span)) * 25;
  if (b < ba) return (1 + frac(b, bl, ba)) * 25;
  if (b <= bt) return (2 + frac(b, ba, bt)) * 25;
  return (3 + clamp((b - bt) / span)) * 25;
}

/** Dialog penjelasan rinci kenapa sebuah parameter berstatus Merah. */
export function PenjelasanStatus({ r, onClose }: { r: RamRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = polaritas(r.arah);
  const nilai = { limit: r.limit, appetite: r.appetite, tolerance: r.tolerance } as Record<string, unknown>;
  const lengkap = [r.hasil, r.limit, r.appetite, r.tolerance].every((v) => typeof v === "number");
  const x = r.hasil as number;
  const v = (n: unknown) => nilaiParam(n, r.satuan);
  const selisih = (d: number) => `${v(Math.abs(d))}${r.satuan === "%" ? " (poin persentase)" : ""}`;
  const alasan = alasanStatus(r.status, r.hasil, r.limit, r.appetite, r.tolerance, r.satuan, r.arah, r.tambahan ? null : r.kode);
  const urutan = cekUrutanBatas(r.limit, r.appetite, r.tolerance, r.arah);
  const khusus = r.tambahan ? null : ATURAN_KHUSUS[r.kode];
  const tindakan = TINDAKAN[r.status];
  const src = r.tambahan ?? r.pengendalian;
  const isiCtl = [
    { label: "Inisiatif Strategis", ok: !!src?.inisiatif?.trim() },
    { label: "Kebijakan", ok: !!src?.kebijakan?.trim() },
    { label: "Program Kerja", ok: !!src?.program?.trim() },
  ];

  // Target perbaikan: hanya Tolerance yang menentukan warna; syarat lolos mengikuti hitungStatus (maximize ≥ Tolerance, minimize ≤ Tolerance).
  const target = lengkap ? BATAS.filter((t) => t.key === "tolerance").map((t) => {
    const b = nilai[t.key] as number;
    const syarat = p.naik ? "≥" : "≤";
    const lolos = p.naik ? x >= b : x <= b;
    return { ...t, jadi: "Hijau", b, syarat, lolos, d: b - x };
  }).filter((t) => !t.lolos) : [];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="penjelasan-judul">
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">Penjelasan status · {r.kategori}</div>
            <h2 id="penjelasan-judul" className="mt-0.5 text-[16px] font-bold text-ink">{r.kode ? `${r.kode} · ` : ""}{r.parameter || "Parameter unik"}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /><ArahBadge arah={r.arah} /></div>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md p-1 text-slate-400 hover:bg-paper hover:text-ink"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 px-6 py-5 text-[13px] leading-relaxed text-slate-700">
          <section>
            <h3 className="mb-1.5 text-[13px] font-bold text-ink">Kenapa {r.status}?</h3>
            <p>{NARASI_STATUS[r.status]}</p>
            {alasan && <p className="mt-1 font-semibold text-rose-700">{alasan}.</p>}
            {urutan && <p className="mt-1 font-semibold text-amber-700">{urutan}. Periksa kembali isian batas agar status terbaca benar.</p>}
            <p className="mt-2 text-slate-600">
              Parameter ini dibaca <b>{p.label.toLowerCase()}</b>, sehingga status memburuk ketika hasil {p.naik ? "turun di bawah" : "naik melewati"} batas.
              Hasil pengukuran RKAP 2027 adalah <b>{v(r.hasil)}</b>, sedangkan batasnya Limit {v(r.limit)}, Appetite {v(r.appetite)}, dan Tolerance {v(r.tolerance)}.
            </p>
          </section>

          {lengkap && (
            <section>
              <h3 className="mb-2 text-[13px] font-bold text-ink">Posisi hasil terhadap batas</h3>
              <div className="relative pt-7 pb-9">
                <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${posisi(x, r.limit as number, r.appetite as number, r.tolerance as number, p.naik)}%` }}>
                  <div className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">Hasil {v(x)}</div>
                  <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink" />
                </div>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {ZONA.map((z) => <div key={z.status} className={clsx(z.warna, z.status !== r.status && "opacity-35")} />)}
                </div>
                <div className="absolute inset-x-0 bottom-0 flex text-[11px]">
                  {BATAS.map((t, i) => (
                    <div key={t.key} className="absolute -translate-x-1/2 text-center whitespace-nowrap" style={{ left: `${(i + 1) * 25}%` }}>
                      <div className="mx-auto mb-0.5 h-2 w-px bg-slate-400" />
                      <div className="font-semibold text-slate-600">{t.label}</div>
                      <div className="text-slate-500">{v(nilai[t.key])}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400"><span>← lebih baik</span><span>lebih buruk →</span></div>
            </section>
          )}

          {target.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[13px] font-bold text-ink">Seberapa jauh dari batas</h3>
              <ul className="space-y-1.5">
                {target.map((t) => (
                  <li key={t.key} className="flex items-start gap-2 rounded-lg bg-paper/70 px-3 py-2">
                    <StatusBadge status={t.jadi} size="sm" />
                    <span>Agar menjadi {t.jadi}, hasil perlu {p.naik ? "naik" : "turun"} hingga {t.syarat} {t.label} {v(t.b)}, yaitu {p.naik ? "bertambah" : "berkurang"} sekitar <b>{selisih(t.d)}</b>.</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tindakan && (
            <section>
              <h3 className="mb-1.5 text-[13px] font-bold text-ink">Konsekuensi: {tindakan.tingkat}</h3>
              <p>{tindakan.isi}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {isiCtl.map((c) => (
                  <li key={c.label} className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold", c.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>
                    {c.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}{c.label} {c.ok ? "sudah diisi" : "belum diisi"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-line bg-paper/50 px-4 py-3">
            <h3 className="mb-1 text-[12.5px] font-bold text-ink">Dari mana angka hasil?</h3>
            <p className="text-[12.5px] text-slate-600">Formula: {r.formula || "–"}</p>
            {khusus && <p className="mt-1 text-[12.5px] text-slate-600">Kasus khusus kertas kerja: Merah bila {khusus.replace(/^./, (c) => c.toLowerCase())}.</p>}
            {r.tambahan ? (
              <p className="mt-1 text-[12.5px] text-slate-600">Parameter unik tambahan: hasil pengukuran diisi langsung pada tabel RAM.</p>
            ) : (
              <Link href={`/parameter/${r.kode}`} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700 hover:underline">
                Buka Lembar Parameter {r.kode} untuk melihat rincian data dan perhitungannya<ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
