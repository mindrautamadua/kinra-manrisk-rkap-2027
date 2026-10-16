"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "./ui";
import { api } from "@/lib/data";
import type { FieldSpec, IsiRequest, IsiResponse, JenisIsi } from "@/lib/isi-ai";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

/** Tombol kecil di baris tabel untuk membuka bantuan AI. Disembunyikan saat mode presentasi. */
export function AiRowButton({ onClick, title = "Isi dengan AI" }: { onClick: () => void; title?: string }) {
  return (
    <button data-edit onClick={onClick} title={title} aria-label={title} className="rounded-md p-0.5 text-brand-600 hover:bg-brand-50 hover:text-brand-800">
      <Sparkles className="h-4 w-4" />
    </button>
  );
}

export interface AiFillProps {
  jenis: JenisIsi;
  /** Judul objek, mis. "Risiko #3 Penurunan Harga CPO". */
  subjek: string;
  fields: FieldSpec[];
  /** Baris saat ini; hanya kolom di `fields` yang dibaca. */
  nilai: object;
  konteks: Record<string, unknown>;
  placeholder: string;
  /** Hanya kolom yang dicentang pengguna yang dikirim. */
  onApply: (patch: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
  /** Instruksi awal yang sudah terisi, mis. daftar isu yang harus diperbaiki. */
  instruksiAwal?: string;
  /** Label kecil di kepala modal; default "Isi dengan AI". */
  judul?: string;
}

/**
 * Formulir draf AI: pengguna menguraikan maksudnya, AI menyusun draf per kolom,
 * pengguna menyunting dan memilih kolom yang diterapkan. Tidak ada yang tersimpan tanpa klik Terapkan.
 */
export function AiFillModal({ jenis, subjek, fields, nilai, konteks, placeholder, onApply, onClose, instruksiAwal = "", judul = "Isi dengan AI" }: AiFillProps) {
  const [entitas, setEntitas] = useState("PT KINRA");
  const [instruksi, setInstruksi] = useState(instruksiAwal);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasil, setHasil] = useState<IsiResponse | null>(null);
  const [draf, setDraf] = useState<Record<string, string>>({});
  const [pakai, setPakai] = useState<Record<string, boolean>>({});

  const cur = (k: string) => { const v = (nilai as Record<string, unknown>)[k]; return v == null ? "" : String(v); };

  useEffect(() => { api.sampul().then((s) => s.nama_entitas && setEntitas(s.nama_entitas)).catch(() => {}); }, []);

  const buat = async () => {
    setBusy(true); setErr("");
    try {
      const req: IsiRequest = {
        jenis, entitas, instruksi, konteks, fields,
        nilai: Object.fromEntries(fields.map((f) => [f.key, cur(f.key) || null])),
      };
      const res = await fetch("/api/isi-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const out = body as IsiResponse;
      setHasil(out);
      setDraf(out.saran);
      // Kolom yang tidak berubah dari nilai saat ini tidak perlu dicentang.
      setPakai(Object.fromEntries(fields.map((f) => [f.key, !!out.saran[f.key] && out.saran[f.key] !== cur(f.key)])));
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const terapkan = async () => {
    const patch = Object.fromEntries(fields.filter((f) => pakai[f.key]).map((f) => [f.key, draf[f.key] ?? ""]));
    if (!Object.keys(patch).length) { setErr("Centang minimal satu kolom untuk diterapkan."); return; }
    setBusy(true);
    try { await onApply(patch); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  const dipilih = fields.filter((f) => pakai[f.key]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !busy) void (hasil ? terapkan() : buat());
    }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">{judul}</div>
            <div className="truncate text-[16px] font-bold">{subjek}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Ceritakan dengan bahasa bebas (opsional, makin rinci makin tepat)</span>
            <textarea autoFocus rows={3} className={input} value={instruksi} onChange={(e) => setInstruksi(e.target.value)} placeholder={placeholder} />
          </label>
          <div className="flex items-center gap-3">
            <Button onClick={buat} disabled={busy}>{busy && !hasil ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{hasil ? "Buat Ulang Draf" : "Buat Draf"}</Button>
            <span className="text-[11.5px] text-slate-500">AI tidak mengisi angka. Nilai numerik tetap diisi dari data riil.</span>
          </div>

          {hasil && (
            <>
              {hasil.catatan && (
                <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950 ring-1 ring-amber-300/60">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="whitespace-pre-line"><b>Perlu diverifikasi:</b> {hasil.catatan}</div>
                </div>
              )}
              <div className="divide-y divide-line rounded-xl border border-line">
                {fields.map((f) => {
                  const lama = cur(f.key);
                  return (
                    <div key={f.key} className={clsx("grid grid-cols-[24px_1fr] gap-x-2 px-4 py-3", !pakai[f.key] && "opacity-60")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={!!pakai[f.key]} onChange={(e) => setPakai({ ...pakai, [f.key]: e.target.checked })} />
                      <div className="min-w-0">
                        <div className="mb-1 text-[12px] font-semibold text-slate-700">{f.label}</div>
                        {f.options?.length ? (
                          <select className={input} value={draf[f.key] ?? ""} onChange={(e) => setDraf({ ...draf, [f.key]: e.target.value })}>
                            {f.options.map((o) => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <textarea rows={Math.min(6, Math.max(2, Math.ceil((draf[f.key]?.length ?? 0) / 90)))} className={input} value={draf[f.key] ?? ""}
                            onChange={(e) => setDraf({ ...draf, [f.key]: e.target.value })} />
                        )}
                        {lama && <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">Saat ini: {lama}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">Draf oleh {hasil.model}. Periksa kembali sebelum diterapkan.</div>
            </>
          )}
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div>}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-paper/50 px-6 py-3">
          <span className="text-[11.5px] text-slate-500">Ctrl/⌘ + Enter untuk {hasil ? "terapkan" : "buat draf"}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={terapkan} disabled={!hasil || busy || !dipilih}>Terapkan {dipilih ? `${dipilih} kolom` : ""}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
