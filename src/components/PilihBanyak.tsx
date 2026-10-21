"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useReadonly } from "@/lib/mode";
import { FloatingPanel } from "./FloatingPanel";

/** Pilih beberapa nilai dari daftar tetap; tampil sebagai chip di sel tabel. */
export function PilihBanyak({ value, options, onSave, label, kosong = "Pilih" }: {
  value: string[]; options: readonly { value: string; label: string }[]; onSave: (v: string[]) => void;
  /** Teks chip; default label opsi. */
  label?: (v: string) => string;
  kosong?: string;
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
  const teks = (v: string) => label?.(v) ?? options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) => onSave(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col items-start gap-1">
        {value.map((v) => (
          <span key={v} className="flex w-full items-start justify-between gap-1.5 rounded-md bg-sky-100 px-1.5 py-1 text-left text-[11px] leading-snug text-sky-900">
            <span>{teks(v)}</span>
            {!ro && <button onClick={() => toggle(v)} className="mt-0.5 shrink-0 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}
          </span>
        ))}
        {!ro && (
          <button onClick={() => setOpen((x) => !x)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-sky-600/50 px-1.5 py-0.5 text-[11px] text-sky-800 hover:bg-sky-50">
            <Plus className="h-3 w-3" />{value.length ? "Ubah" : kosong}
          </button>
        )}
        {ro && !value.length && <span className="text-slate-300">–</span>}
      </div>
      {open && (
        <FloatingPanel anchor={ref} panelRef={panelRef} align="right" width={320} maxHeight={360}>
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-slate-50">
              <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} className="mt-0.5 accent-sky-700" />
              <span>{o.label}</span>
            </label>
          ))}
        </FloatingPanel>
      )}
    </div>
  );
}
