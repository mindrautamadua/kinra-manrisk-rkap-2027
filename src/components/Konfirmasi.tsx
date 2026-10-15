"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, Info, Trash2 } from "lucide-react";

export interface OpsiKonfirmasi {
  judul: string;
  /** Teks penjelasan; boleh multi-baris. */
  pesan?: ReactNode;
  /** Nama objek yang terdampak, ditampilkan menonjol (mis. nama risiko yang dihapus). */
  objek?: string;
  /** Label tombol aksi. Default: "Hapus" untuk bahaya, "Lanjutkan" untuk lainnya. */
  aksi?: string;
  nada?: "bahaya" | "peringatan" | "info";
}

type Antrian = OpsiKonfirmasi & { selesai: (ok: boolean) => void };
let tampilkan: ((o: Antrian) => void) | null = null;

/** Pengganti window.confirm(): tampilkan dialog konfirmasi dan tunggu jawaban pengguna. */
export function konfirmasi(o: OpsiKonfirmasi): Promise<boolean> {
  return new Promise((selesai) => {
    if (!tampilkan) { selesai(window.confirm([o.judul, o.objek, typeof o.pesan === "string" ? o.pesan : ""].filter(Boolean).join("\n\n"))); return; }
    tampilkan({ ...o, selesai });
  });
}

const GAYA = {
  bahaya: { ikon: Trash2, lingkar: "bg-rose-100 text-rose-600", tombol: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500/40" },
  peringatan: { ikon: AlertTriangle, lingkar: "bg-amber-100 text-amber-600", tombol: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/40" },
  info: { ikon: Info, lingkar: "bg-brand-100 text-brand-700", tombol: "bg-brand-700 hover:bg-brand-800 focus-visible:ring-brand-500/40" },
} as const;

/** Dipasang sekali di layout; merender dialog yang diminta lewat konfirmasi(). */
export function KonfirmasiHost() {
  const [cur, setCur] = useState<Antrian | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    tampilkan = (o) => setCur((prev) => { prev?.selesai(false); return o; });
    return () => { tampilkan = null; };
  }, []);

  useEffect(() => {
    if (!cur) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); jawab(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  const jawab = (ok: boolean) => { cur?.selesai(ok); setCur(null); };
  if (!cur) return null;

  const nada = cur.nada ?? "bahaya";
  const g = GAYA[nada];
  const Ikon = g.ikon;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="konfirmasi-judul">
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={() => jawab(false)} />
      <div className="rise relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex gap-4 px-6 pt-6 pb-5">
          <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", g.lingkar)}><Ikon className="h-5 w-5" /></div>
          <div className="min-w-0 pt-0.5">
            <h2 id="konfirmasi-judul" className="text-[16px] font-bold text-ink">{cur.judul}</h2>
            {cur.objek && <div className="mt-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-[13px] font-semibold break-words text-slate-800">{cur.objek}</div>}
            {cur.pesan && <div className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-slate-600">{cur.pesan}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-slate-50/70 px-6 py-3">
          <button onClick={() => jawab(false)} className="rounded-lg border border-line bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Batal</button>
          <button ref={okRef} onClick={() => jawab(true)} className={clsx("rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-sm outline-none focus-visible:ring-4", g.tombol)}>
            {cur.aksi ?? (nada === "bahaya" ? "Hapus" : "Lanjutkan")}
          </button>
        </div>
      </div>
    </div>
  );
}
