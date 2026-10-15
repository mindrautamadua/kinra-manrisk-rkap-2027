"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Flag, X } from "lucide-react";
import { useReadonly } from "@/lib/mode";
import { FloatingPanel } from "./FloatingPanel";
import { AiKaitkanButton, SaranKaitanBox } from "./SaranKaitanAi";
import { useSaranKaitan, type RisikoRingkas } from "@/lib/kaitkan-ai";
import type { SasaranStrategis } from "@/lib/types";

/** Pilih satu atau beberapa Sasaran Strategis RJPP yang terancam oleh risk event ini. */
export function SasaranPicker({ value, options, onSave, risiko }: {
  value: string[]; options: SasaranStrategis[]; onSave: (v: string[]) => void;
  /** Risk event baris ini; bila diisi, tombol AI muncul untuk memilihkan item yang relevan. */
  risiko?: RisikoRingkas;
}) {
  const ro = useReadonly();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const ai = useSaranKaitan("sasaran");
  const mintaAi = () => { if (!risiko) return; setOpen(true); ai.minta(risiko, options.map((o) => ({ kode: o.kode, pilar: o.pilar, nama: o.nama, target: o.target }))); };
  const terapkan = (kode: string[]) => onSave([...value, ...kode.filter((k) => !value.includes(k))]);
  const saranKode = new Set(ai.hasil?.saran.map((s) => s.kode));

  const toggle = (k: string) => onSave(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const groups = Array.from(new Set(options.map((o) => o.pilar)));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col items-start gap-1">
        {value.map((k) => {
          const o = options.find((x) => x.kode === k);
          return (
            <span key={k} title={o ? `${o.pilar}: ${o.nama}` : "Sasaran tidak ditemukan"}
              className={clsx("flex w-full items-start justify-between gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug", o ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
              <span><b className="mr-1">{k}</b>{o && <span className="font-normal">{o.nama}</span>}</span>
              {!ro && <button onClick={() => toggle(k)} className="mt-0.5 shrink-0 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}
            </span>
          );
        })}
        {!ro && (
          <div className="flex gap-1">
            <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-600/50 px-1.5 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50">
              <Flag className="h-3 w-3" />{value.length ? "Ubah" : "Kaitkan"}
            </button>
            {risiko && <AiKaitkanButton onClick={mintaAi} loading={ai.loading} />}
          </div>
        )}
        {ro && !value.length && <span className="text-slate-300">–</span>}
      </div>
      {open && (
        <FloatingPanel anchor={ref} panelRef={panelRef} align="right" width={384} maxHeight={384}>
          <SaranKaitanBox loading={ai.loading} hasil={ai.hasil} error={ai.error} value={value} nama={(k) => options.find((o) => o.kode === k)?.nama} onApply={terapkan} />
          {!options.length && <div className="px-2 py-3 text-[12px] text-slate-500">Belum ada Sasaran Strategis. Jalankan migrasi 0006_sasaran_strategis.sql.</div>}
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <div className="px-2 py-1 text-[10.5px] font-bold tracking-wide text-slate-500 uppercase">{g}</div>
              {options.filter((o) => o.pilar === g).map((o) => (
                <label key={o.kode} title={o.target ?? undefined} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-slate-50">
                  <input type="checkbox" checked={value.includes(o.kode)} onChange={() => toggle(o.kode)} className="mt-0.5 accent-emerald-600" />
                  <span><b className="mr-1">{o.kode}</b>{o.nama}</span>{saranKode.has(o.kode) && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-700">AI</span>}
                </label>
              ))}
            </div>
          ))}
        </FloatingPanel>
      )}
    </div>
  );
}
