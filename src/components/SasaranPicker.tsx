"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Flag, X } from "lucide-react";
import { useReadonly } from "@/lib/mode";
import type { SasaranStrategis } from "@/lib/types";

/** Pilih satu atau beberapa Sasaran Strategis RJPP yang terancam oleh risk event ini. */
export function SasaranPicker({ value, options, onSave }: {
  value: string[]; options: SasaranStrategis[]; onSave: (v: string[]) => void;
}) {
  const ro = useReadonly();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = (k: string) => onSave(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const groups = Array.from(new Set(options.map((o) => o.pilar)));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1">
        {value.map((k) => {
          const o = options.find((x) => x.kode === k);
          return (
            <span key={k} title={o ? `${o.pilar}: ${o.nama}` : "Sasaran tidak ditemukan"}
              className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold", o ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
              {k}
              {!ro && <button onClick={() => toggle(k)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}
            </span>
          );
        })}
        {!ro && (
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-600/50 px-1.5 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50">
            <Flag className="h-3 w-3" />{value.length ? "Ubah" : "Kaitkan"}
          </button>
        )}
        {ro && !value.length && <span className="text-slate-300">–</span>}
      </div>
      {open && (
        <div className="scroll-thin absolute top-full right-0 z-30 mt-1 max-h-96 w-96 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-xl">
          {!options.length && <div className="px-2 py-3 text-[12px] text-slate-500">Belum ada Sasaran Strategis. Jalankan migrasi 0006_sasaran_strategis.sql.</div>}
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <div className="px-2 py-1 text-[10.5px] font-bold tracking-wide text-slate-500 uppercase">{g}</div>
              {options.filter((o) => o.pilar === g).map((o) => (
                <label key={o.kode} title={o.target ?? undefined} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-slate-50">
                  <input type="checkbox" checked={value.includes(o.kode)} onChange={() => toggle(o.kode)} className="mt-0.5 accent-emerald-600" />
                  <span><b className="mr-1">{o.kode}</b>{o.nama}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
