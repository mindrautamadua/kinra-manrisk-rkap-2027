"use client";
import { useState } from "react";
import { AlertTriangle, Compass, Loader2, Plus, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui";
import type { UsulanRisikoRequest, UsulanRisikoResponse, UsulanRisiko, KandidatTaksonomi } from "@/lib/usulan-risiko";
import type { CelahRisiko } from "@/lib/relevansi-risiko";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

/**
 * Modal usulan Risk Event baru: AI memilih risiko taksonomi yang belum ada di register
 * dan relevan dengan konteks KINRA (RJPP/RKAP, celah hasil Cek Relevansi), pengguna mencentang yang akan ditambahkan.
 */
export function UsulanRisikoModal({ buatRequest, kandidat, namaSasaran, celah, onCekRelevansi, onTambah, onClose }: {
  celah: CelahRisiko[];
  onCekRelevansi: () => void;
  buatRequest: (instruksi: string) => Promise<UsulanRisikoRequest>;
  kandidat: KandidatTaksonomi[];
  namaSasaran: (kode: string) => string | undefined;
  onTambah: (usulan: UsulanRisiko[]) => Promise<void>;
  onClose: () => void;
}) {
  const [instruksi, setInstruksi] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasil, setHasil] = useState<UsulanRisikoResponse | null>(null);
  const [pilih, setPilih] = useState<Record<string, boolean>>({});

  const buat = async () => {
    setBusy(true); setErr("");
    try {
      const req = await buatRequest(instruksi);
      const res = await fetch("/api/usulan-risiko", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const out = body as UsulanRisikoResponse;
      setHasil(out);
      setPilih(Object.fromEntries(out.usulan.map((u) => [u.kode, false])));
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const dipilih = hasil?.usulan.filter((u) => pilih[u.kode]) ?? [];
  const tambah = async () => {
    if (!dipilih.length) { setErr("Centang minimal satu usulan."); return; }
    setBusy(true);
    try { await onTambah(dipilih); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Usulan AI</div>
            <div className="truncate text-[16px] font-bold">Risk Event Baru sesuai RJPP &amp; RKAP 2027</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Arahan tambahan (opsional — kosongkan agar AI menentukan fokus dari konteks KINRA)</span>
            <textarea autoFocus rows={2} className={input} value={instruksi} onChange={(e) => setInstruksi(e.target.value)}
              placeholder="Contoh: Fokus pada risiko pengembangan bisnis baru SFB dan perumahan kawasan, serta risiko kepatuhan." />
          </label>
          <div className="rounded-xl bg-paper px-4 py-3 text-[12.5px]">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-700"><Compass className="h-3.5 w-3.5 text-brand-600" />Celah risiko KINRA dari Cek Relevansi AI</div>
            {celah.length ? (
              <>
                <p className="mb-2 text-slate-500">AI otomatis memprioritaskan celah ini. Klik untuk menjadikannya arahan khusus.</p>
                <div className="flex flex-wrap gap-1.5">
                  {celah.map((c) => (
                    <button key={c.tema} title={c.alasan} onClick={() => setInstruksi((x) => (x.includes(c.tema) ? x : x.trim() ? `${x.trim()}; ${c.tema}` : `Fokus pada ${c.tema}`))}
                      className="rounded-full bg-white px-2.5 py-1 text-[12px] text-brand-800 ring-1 ring-brand-300 hover:bg-brand-50">+ {c.tema}</button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500">Belum ada. AI tetap menentukan fokus dari pos RKAP, sasaran RJPP, dan program strategis KINRA. Untuk usulan yang lebih tepat sasaran, <button onClick={onCekRelevansi} className="font-semibold text-brand-700 hover:underline">jalankan Cek Relevansi AI</button> lebih dulu.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={buat} disabled={busy || !kandidat.length}>
              {busy && !hasil ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{hasil ? "Buat Ulang Usulan" : "Buat Usulan"}
            </Button>
            <span className="text-[11.5px] text-slate-500">
              {kandidat.length ? `AI memilih dari ${kandidat.length} risiko taksonomi yang belum ada di register, sesuai konteks bisnis KINRA: Sasaran Strategis RJPP, Data Keuangan dan Program Strategis RKAP 2027${celah.length ? ", serta celah hasil Cek Relevansi" : ""}.` : "Semua risiko taksonomi sudah ada di register."}
            </span>
          </div>
          {busy && !hasil && <div className="flex items-center gap-2 text-[12.5px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Menganalisis RJPP, RKAP, dan taksonomi… (±30 detik)</div>}

          {hasil && (
            <>
              {hasil.catatan && (
                <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950 ring-1 ring-amber-300/60">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div><b>Perlu diverifikasi:</b> {hasil.catatan}</div>
                </div>
              )}
              {!hasil.usulan.length && <div className="text-[13px] text-slate-500">AI tidak menemukan risiko baru yang cukup relevan.</div>}
              <div className="space-y-2">
                {hasil.usulan.map((u) => {
                  const t = kandidat.find((k) => k.kode === u.kode);
                  return (
                    <label key={u.kode} className={clsx("grid cursor-pointer grid-cols-[24px_1fr] gap-x-2 rounded-xl border px-4 py-3 transition",
                      pilih[u.kode] ? "border-brand-500 bg-brand-50/40" : "border-line hover:border-brand-300")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={!!pilih[u.kode]} onChange={(e) => setPilih({ ...pilih, [u.kode]: e.target.checked })} />
                      <div className="min-w-0 text-[12.5px]">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[14px] font-bold text-ink">{t?.risiko_korporat}</span>
                          <span className="text-[11px] text-slate-500">{t?.kategori} · <span className="font-mono">{u.kode}</span></span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-brand-800 italic">{u.alasan}</div>
                        <dl className="mt-2 grid grid-cols-[120px_1fr] gap-x-2 gap-y-1 text-slate-700">
                          <dt className="font-semibold text-slate-500">Deskripsi</dt><dd>{u.deskripsi}</dd>
                          <dt className="font-semibold text-slate-500">Root Cause</dt><dd className="whitespace-pre-line">{u.root_cause}</dd>
                          <dt className="font-semibold text-slate-500">Dampak</dt><dd>{u.deskripsi_dampak}</dd>
                          {u.sasaran.length > 0 && <>
                            <dt className="font-semibold text-slate-500">Sasaran RJPP</dt>
                            <dd className="flex flex-wrap gap-1">{u.sasaran.map((s) => (
                              <span key={s} title={namaSasaran(s)} className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800"><b>{s}</b> {namaSasaran(s)}</span>
                            ))}</dd>
                          </>}
                        </dl>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">Usulan oleh {hasil.model}. Probabilitas, nilai dampak, dan kontrol diisi setelah ditambahkan.</div>
            </>
          )}
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div>}
        </div>

        {hasil && hasil.usulan.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
            <span className="mr-auto text-[12px] text-slate-500">{dipilih.length} dari {hasil.usulan.length} dipilih</span>
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={tambah} disabled={busy || !dipilih.length}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Tambahkan ke Register
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
