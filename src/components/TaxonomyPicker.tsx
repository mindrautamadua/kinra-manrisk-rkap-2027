"use client";
import { useMemo, useState } from "react";
import { Search, X, ChevronRight } from "lucide-react";
import clsx from "clsx";
import type { Taksonomi } from "@/lib/types";

export interface T3Option { kategori: string; aspek: string; risiko_korporat: string; definisi: string; kode: string; spesifik: Taksonomi[] }

/** Kelompokkan taksonomi T4 menjadi pilihan Risiko Korporat (T3). */
export function groupT3(tax: Taksonomi[]): T3Option[] {
  const map = new Map<string, T3Option>();
  for (const t of tax) {
    const k = `${t.kategori}|${t.risiko_korporat}`;
    if (!map.has(k)) map.set(k, { kategori: t.kategori, aspek: t.aspek ?? "", risiko_korporat: t.risiko_korporat ?? "", definisi: t.def_risiko_korporat ?? "", kode: t.kode, spesifik: [] });
    map.get(k)!.spesifik.push(t);
  }
  return [...map.values()];
}

export function TaxonomyPicker({ options, kategori, current, onPick, onClose }: {
  options: T3Option[]; kategori: string | null; current?: string | null;
  onPick: (o: T3Option) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [kat, setKat] = useState(kategori ?? "");
  const [focus, setFocus] = useState<T3Option | null>(options.find((o) => o.risiko_korporat === current && (!kategori || o.kategori === kategori)) ?? null);
  const kats = useMemo(() => Array.from(new Set(options.map((o) => o.kategori))), [options]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return options.filter((o) => (!kat || o.kategori === kat) && (!s ||
      o.risiko_korporat.toLowerCase().includes(s) || o.definisi.toLowerCase().includes(s) || o.aspek.toLowerCase().includes(s) ||
      o.spesifik.some((x) => (x.risiko_spesifik ?? "").toLowerCase().includes(s))));
  }, [options, q, kat]);
  const byAspek = useMemo(() => {
    const m = new Map<string, T3Option[]>();
    for (const o of list) { const k = `${o.kategori} › ${o.aspek}`; m.set(k, [...(m.get(k) ?? []), o]); }
    return [...m.entries()];
  }, [list]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Taksonomi Risiko PTPN Group</div>
            <div className="text-[16px] font-bold">Pilih Risk Event (Risiko Korporat T3)</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line bg-paper/60 px-5 py-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari risiko korporat, aspek, atau risiko spesifik…"
              className="w-full rounded-lg border border-line bg-white py-2 pr-3 pl-9 text-[13px] outline-none focus:border-brand-500" />
          </div>
          <select value={kat} onChange={(e) => setKat(e.target.value)} className="rounded-lg border border-line bg-white px-3 text-[13px]">
            <option value="">Semua kategori</option>
            {kats.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_1.1fr]">
          <div className="scroll-thin overflow-y-auto border-r border-line">
            {byAspek.map(([aspek, items]) => (
              <div key={aspek}>
                <div className="sticky top-0 z-10 bg-brand-50 px-5 py-1.5 text-[11px] font-bold text-brand-800">{aspek}</div>
                {items.map((o) => (
                  <button key={o.kategori + o.risiko_korporat} onClick={() => setFocus(o)}
                    className={clsx("flex w-full items-center gap-2 border-b border-line/70 px-5 py-2.5 text-left text-[13px] transition",
                      focus === o ? "bg-amber-50" : "hover:bg-slate-50", o.risiko_korporat === current && "font-bold")}>
                    <span className="flex-1">{o.risiko_korporat}</span>
                    <span className="text-[11px] text-slate-400">{o.spesifik.length}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                ))}
              </div>
            ))}
            {list.length === 0 && <div className="p-10 text-center text-sm text-slate-400">Tidak ada hasil.</div>}
          </div>
          <div className="scroll-thin overflow-y-auto bg-paper/40 p-5">
            {focus ? (
              <div>
                <div className="text-[11px] font-semibold text-slate-500">{focus.kategori} › {focus.aspek}</div>
                <h3 className="mt-1 text-[18px] leading-snug font-bold">{focus.risiko_korporat}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">{focus.definisi}</p>
                <button onClick={() => onPick(focus)} className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800">
                  Gunakan sebagai Risk Event
                </button>
                <div className="mt-6 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Risiko Spesifik (T4)</div>
                <ul className="mt-2 space-y-2">
                  {focus.spesifik.map((s) => (
                    <li key={s.kode} className="rounded-lg border border-line bg-white p-3">
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{s.kode}</span>
                        <span className="text-[12.5px] font-semibold">{s.risiko_spesifik}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{s.def_risiko_spesifik}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <div className="grid h-full place-items-center text-sm text-slate-400">Pilih risiko korporat di sebelah kiri.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
