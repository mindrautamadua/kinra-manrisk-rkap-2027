"use client";
import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { Button } from "./ui";
import { api, challengeApi } from "@/lib/data";
import { REKAP } from "@/lib/static";
import { SHEETS } from "@/lib/nav";
import { PRIORITAS, STATUS_LOG, type ChallengeLog, type RiskRegister } from "@/lib/types";

export interface RefItem { type: string; id: string; label: string }

/** Rujukan otomatis dari halaman yang sedang dibuka. */
export function refFromPath(path: string): RefItem {
  const m = path.match(/^\/parameter\/([^/]+)/);
  if (m) {
    const r = REKAP.find((x) => x.kode === decodeURIComponent(m[1]));
    return { type: "parameter", id: m[1], label: `Parameter ${m[1]}${r ? ` – ${r.parameter}` : ""}` };
  }
  const s = SHEETS.find((x) => x.href === path);
  if (s) return { type: "lembar", id: path, label: `Lembar ${s.label}` };
  return { type: "umum", id: "", label: "Umum" };
}

export const refKey = (r: { type: string; id: string | null }) => `${r.type}|${r.id ?? ""}`;

export function useRefOptions() {
  const [register, setRegister] = useState<RiskRegister[]>([]);
  useEffect(() => { api.register().then(setRegister).catch(() => {}); }, []);
  return useMemo<{ group: string; items: RefItem[] }[]>(() => [
    { group: "Umum", items: [{ type: "umum", id: "", label: "Umum" }] },
    { group: "Lembar", items: SHEETS.filter((s) => !s.href.startsWith("/parameter/")).map((s) => ({ type: "lembar", id: s.href, label: `Lembar ${s.label}` })) },
    { group: "Parameter RAM", items: REKAP.map((r) => ({ type: "parameter", id: r.kode, label: `Parameter ${r.kode} – ${r.parameter}` })) },
    { group: "Risiko", items: register.map((r, i) => ({ type: "risiko", id: r.id, label: `Risiko #${i + 1} ${r.risk_event ?? "(tanpa nama)"}` })) },
  ], [register]);
}

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

/** Formulir catat masukan challenger. */
export function ChallengeModal({ initial, onClose, onSaved }: { initial: RefItem; onClose: () => void; onSaved?: (row: ChallengeLog) => void }) {
  const options = useRefOptions();
  const [ref, setRef] = useState<RefItem>(initial);
  const [f, setF] = useState({ masukan: "", challenger: "", prioritas: "Sedang", pic: "", tenggat: "", status: "Terbuka", tanggapan: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Nama challenger/PIC terakhir diingat untuk mempercepat pencatatan berikutnya.
  useEffect(() => {
    try { setF((x) => ({ ...x, challenger: localStorage.getItem("cl-challenger") ?? "" })); } catch {}
  }, []);

  const save = async () => {
    if (!f.masukan.trim()) { setErr("Masukan wajib diisi."); return; }
    setBusy(true); setErr("");
    try {
      const row = await challengeApi.add({
        ref_type: ref.type, ref_id: ref.id || null, ref_label: ref.label, masukan: f.masukan.trim(), challenger: f.challenger || null,
        prioritas: f.prioritas, pic: f.pic || null, tenggat: f.tenggat || null, status: f.status, tanggapan: f.tanggapan || null,
      });
      try { localStorage.setItem("cl-challenger", f.challenger); } catch {}
      onSaved?.(row); onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErr(/challenge_log|schema cache/.test(m) ? "Tabel challenge_log belum ada. Jalankan supabase/migrations/0002_challenge_session.sql di SQL Editor." : m);
    }
    setBusy(false);
  };

  const all = options.flatMap((g) => g.items);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <MessageSquarePlus className="h-5 w-5 text-brand-600" />
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Log Challenge</div>
            <div className="text-[16px] font-bold">Catat masukan challenger</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Terkait dengan</span>
            <select className={input} value={refKey(ref)} onChange={(e) => setRef(all.find((x) => refKey(x) === e.target.value) ?? ref)}>
              {!all.some((x) => refKey(x) === refKey(ref)) && <option value={refKey(ref)}>{ref.label}</option>}
              {options.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((x) => <option key={refKey(x)} value={refKey(x)}>{x.label}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Masukan / pertanyaan challenger *</span>
            <textarea autoFocus rows={4} className={input} value={f.masukan} onChange={(e) => setF({ ...f, masukan: e.target.value })}
              placeholder="Contoh: Dasar penetapan tolerance 5% untuk 1b belum dijelaskan; minta data historis 2023–2026." />
          </label>
          <label><span className="mb-1 block text-[12px] font-semibold text-slate-600">Challenger</span>
            <input className={input} value={f.challenger} onChange={(e) => setF({ ...f, challenger: e.target.value })} placeholder="Nama / unit" /></label>
          <label><span className="mb-1 block text-[12px] font-semibold text-slate-600">Prioritas</span>
            <select className={input} value={f.prioritas} onChange={(e) => setF({ ...f, prioritas: e.target.value })}>{PRIORITAS.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label><span className="mb-1 block text-[12px] font-semibold text-slate-600">PIC tindak lanjut</span>
            <input className={input} value={f.pic} onChange={(e) => setF({ ...f, pic: e.target.value })} placeholder="Nama / divisi" /></label>
          <label><span className="mb-1 block text-[12px] font-semibold text-slate-600">Tenggat</span>
            <input type="date" className={input} value={f.tenggat} onChange={(e) => setF({ ...f, tenggat: e.target.value })} /></label>
          <label className="md:col-span-2"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Tanggapan / komitmen (opsional)</span>
            <textarea rows={2} className={input} value={f.tanggapan} onChange={(e) => setF({ ...f, tanggapan: e.target.value })} /></label>
          <label><span className="mb-1 block text-[12px] font-semibold text-slate-600">Status</span>
            <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_LOG.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        {err && <div className="mx-6 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div>}
        <div className="flex items-center justify-between border-t border-line bg-paper/50 px-6 py-3">
          <span className="text-[11.5px] text-slate-500">Ctrl/⌘ + Enter untuk simpan</span>
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Batal</Button><Button onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan Masukan"}</Button></div>
        </div>
      </div>
    </div>
  );
}
