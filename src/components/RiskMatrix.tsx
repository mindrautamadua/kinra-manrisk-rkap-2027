"use client";
import clsx from "clsx";
import { KATEGORI_DAMPAK, type RiskRegister } from "@/lib/types";

const PROB = [
  { label: "Sangat Besar", sub: "> 80%", min: 0.8 },
  { label: "Besar", sub: "60–80%", min: 0.6 },
  { label: "Sedang", sub: "40–60%", min: 0.4 },
  { label: "Kecil", sub: "20–40%", min: 0.2 },
  { label: "Sangat Kecil", sub: "≤ 20%", min: -1 },
];
const probLevel = (p: number) => 5 - PROB.findIndex((x) => p > x.min); // 1..5

// Skor = level probabilitas × level dampak (indikatif, untuk visualisasi)
const tone = (s: number) =>
  s >= 15 ? "bg-rose-600 text-white" : s >= 10 ? "bg-orange-500 text-white" : s >= 5 ? "bg-amber-300 text-amber-950" : s >= 3 ? "bg-lime-300 text-lime-950" : "bg-emerald-500 text-white";

export function RiskMatrix({ rows, onSelect }: { rows: RiskRegister[]; onSelect?: (r: RiskRegister) => void }) {
  const placed = rows.filter((r) => r.probabilitas != null && r.kategori_dampak);
  return (
    <div>
      <div className="grid grid-cols-[88px_repeat(5,minmax(0,1fr))] gap-1.5">
        {PROB.map((p, pi) => (
          <div key={p.label} className="contents">
            <div className="flex flex-col justify-center pr-2 text-right">
              <div className="text-[11.5px] font-semibold text-slate-700">{p.label}</div>
              <div className="text-[10.5px] text-slate-400">{p.sub}</div>
            </div>
            {KATEGORI_DAMPAK.map((k, ki) => {
              const lvP = 5 - pi, lvD = ki + 1;
              const here = placed.filter((r) => probLevel(Number(r.probabilitas)) === lvP && r.kategori_dampak === k);
              return (
                <div key={k} className={clsx("relative flex min-h-[64px] flex-wrap content-start gap-1 rounded-lg p-1.5", tone(lvP * lvD), here.length === 0 && "opacity-35")}>
                  {here.map((r) => (
                    <button key={r.id} onClick={() => onSelect?.(r)} title={r.risk_event ?? ""}
                      className="grid h-6 min-w-6 place-items-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-black/10 transition hover:scale-110">
                      {r.urutan}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        <div />
        {KATEGORI_DAMPAK.map((k) => <div key={k} className="pt-1 text-center text-[11px] font-semibold text-slate-600">{k}</div>)}
      </div>
      <div className="mt-2 flex justify-between pl-[88px] text-[10.5px] text-slate-400">
        <span>↑ Probabilitas kejadian</span><span>Kategori dampak →</span>
      </div>
    </div>
  );
}
