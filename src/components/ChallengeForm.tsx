"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MessageSquarePlus, Search, X } from "lucide-react";
import { Button } from "./ui";
import { api, challengeApi } from "@/lib/data";
import { REKAP } from "@/lib/static";
import { SHEETS } from "@/lib/nav";
import { PRIORITAS, STATUS_MANUAL, type ChallengeLog, type RiskRegister } from "@/lib/types";

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

/** Pilihan rujukan yang bisa dicari (ketik untuk menyaring kode, nama parameter, atau risiko). */
function RefCombobox({ options, value, onChange }: { options: { group: string; items: RefItem[] }[]; value: RefItem; onChange: (r: RefItem) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return options
      .map((g) => ({ ...g, items: g.items.filter((x) => { const s = `${g.group} ${x.label}`.toLowerCase(); return terms.every((t) => s.includes(t)); }) }))
      .filter((g) => g.items.length);
  }, [options, q]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const pick = (r: RefItem) => { onChange(r); setOpen(false); setQ(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && !(e.metaKey || e.ctrlKey)) { e.preventDefault(); if (flat[active]) pick(flat[active]); }
    else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); setQ(""); }
  };

  let i = -1;
  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${input} pr-9 pl-9`} value={open ? q : value.label} placeholder={open ? value.label : "Cari parameter, lembar, atau risiko…"}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => { setOpen(false); setQ(""); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
          role="combobox" aria-controls="ref-listbox" aria-expanded={open} aria-autocomplete="list"
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && (
        <div ref={listRef} id="ref-listbox" role="listbox" className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-xl">
          {groups.length === 0 && <div className="px-3 py-2 text-[12.5px] text-slate-500">Tidak ada yang cocok dengan “{q}”.</div>}
          {groups.map((g) => (
            <div key={g.group}>
              <div className="sticky top-0 bg-white px-3 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.12em] text-slate-400 uppercase">{g.group}</div>
              {g.items.map((x) => {
                const n = ++i; const sel = refKey(x) === refKey(value);
                return (
                  <div key={refKey(x)} data-i={n} role="option" aria-selected={sel}
                    onMouseDown={(e) => { e.preventDefault(); pick(x); }} onMouseEnter={() => setActive(n)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${n === active ? "bg-brand-50 text-brand-900" : ""}`}>
                    <Check className={`h-3.5 w-3.5 shrink-0 text-brand-600 ${sel ? "" : "invisible"}`} />
                    <span>{x.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <div className="md:col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Terkait dengan</span>
            <RefCombobox options={options} value={ref} onChange={setRef} />
          </div>
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
            <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUS_MANUAL.map((p) => <option key={p}>{p}</option>)}</select></label>
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
