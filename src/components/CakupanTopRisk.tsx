"use client";
import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Check, ChevronDown, CircleDashed, MinusCircle, Pencil, X } from "lucide-react";
import { Button, Card, DampakBadge, useSaver } from "./ui";
import { api } from "@/lib/data";
import { useReadonly } from "@/lib/mode";
import { nilaiCakupan, type CakupanTopRisk, type HasilCakupan, type KeputusanTopik, type StatusCakupan } from "@/lib/cakupan-top-risk";
import type { RiskRegister } from "@/lib/types";

const STATUS: Record<StatusCakupan, { cls: string; icon: typeof Check }> = {
  Tercakup: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", icon: Check },
  "Tidak material": { cls: "bg-slate-100 text-slate-700 ring-slate-400/30", icon: MinusCircle },
  "Belum Top Risk": { cls: "bg-amber-50 text-amber-800 ring-amber-500/30", icon: AlertTriangle },
  "Belum ada": { cls: "bg-rose-50 text-rose-700 ring-rose-600/20", icon: CircleDashed },
};

/** Daftar periksa topik risiko wajib Top Risks: terdeteksi otomatis dari Risk Register, dapat dikoreksi manual atau dinyatakan tidak material. */
export function CakupanTopRiskPanel({ register, keputusan, onChange }: {
  register: RiskRegister[]; keputusan: CakupanTopRisk; onChange: (v: CakupanTopRisk) => void;
}) {
  const saver = useSaver();
  const [edit, setEdit] = useState<string | null>(null);
  const hasil = nilaiCakupan(register, keputusan);
  const beres = hasil.filter((h) => h.status === "Tercakup" || (h.status === "Tidak material" && !h.catatan.length)).length;

  const simpan = (id: string, k: KeputusanTopik | null) => {
    const v = { ...keputusan };
    if (k) v[id] = k; else delete v[id];
    onChange(v);
    saver.run(() => api.saveCakupanTopRisk(v));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1 text-[12.5px] text-slate-600">
          Topik risiko yang diminta challenge session untuk ditelaah masuk Top Risks. Deteksi awal dari teks Risk Register; periksa dan koreksi bila perlu.
          Topik yang tidak dimasukkan wajib dinyatakan tidak material beserta alasannya.
        </div>
        {saver.indicator}
        <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-bold", beres === hasil.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
          {beres}/{hasil.length} topik terjawab
        </span>
      </div>
      <ul className="divide-y divide-line">
        {hasil.map((h) => (
          <Baris key={h.topik.id} h={h} register={register} k={keputusan[h.topik.id] ?? {}} terbuka={edit === h.topik.id}
            onBuka={() => setEdit(edit === h.topik.id ? null : h.topik.id)} onSimpan={(k) => simpan(h.topik.id, k)} />
        ))}
      </ul>
    </Card>
  );
}

function Baris({ h, register, k, terbuka, onBuka, onSimpan }: {
  h: HasilCakupan; register: RiskRegister[]; k: KeputusanTopik; terbuka: boolean; onBuka: () => void; onSimpan: (k: KeputusanTopik | null) => void;
}) {
  const ro = useReadonly();
  const s = STATUS[h.status];
  const no = (r: RiskRegister) => register.indexOf(r) + 1;
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <span className={clsx("inline-flex w-36 shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-inset", s.cls)}>
          <s.icon className="h-3.5 w-3.5" />{h.status}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">{h.topik.label}</div>
          <div className="text-[12px] text-slate-500">{h.topik.telaah}</div>
          {h.status !== "Tidak material" && (h.top.length > 0 || h.lain.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...h.top, ...h.lain].map((r) => (
                <span key={r.id} className={clsx("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] ring-1", h.top.includes(r) ? "bg-white ring-line" : "bg-amber-50/60 ring-amber-300/60")}>
                  <b>#{no(r)}</b> {r.risk_event} <DampakBadge k={r.kategori_dampak} />
                </span>
              ))}
              {!h.manual && <span className="self-center text-[11px] text-slate-400 italic">terdeteksi otomatis</span>}
            </div>
          )}
          {h.status === "Belum Top Risk" && <div className="mt-1 text-[12px] text-amber-800">Ada di Risk Register tetapi kategori dampaknya di bawah Moderat. Telaah ulang dampaknya atau nyatakan tidak material.</div>}
          {h.status === "Tidak material" && <div className="mt-1 text-[12px] text-slate-600"><span className="font-semibold">Alasan: </span>{k.alasan?.trim() || <span className="text-rose-600">belum diisi</span>}</div>}
          {h.catatan.filter((c) => !c.startsWith("Alasan")).map((c) => <div key={c} className="mt-1 flex items-center gap-1 text-[12px] text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />{c}</div>)}
        </div>
        {!ro && (
          <button onClick={onBuka} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">
            {terbuka ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}{terbuka ? "Tutup" : "Koreksi"}
          </button>
        )}
      </div>
      {terbuka && !ro && <Editor h={h} register={register} k={k} onSimpan={onSimpan} />}
    </li>
  );
}

function Editor({ h, register, k, onSimpan }: { h: HasilCakupan; register: RiskRegister[]; k: KeputusanTopik; onSimpan: (k: KeputusanTopik | null) => void }) {
  const [mode, setMode] = useState<"risiko" | "tidak">(k.tidak_material ? "tidak" : "risiko");
  const [ids, setIds] = useState<string[]>(k.risk_ids?.length ? k.risk_ids : [...h.top, ...h.lain].map((r) => r.id));
  const [alasan, setAlasan] = useState(k.alasan ?? "");
  const [pilih, setPilih] = useState(false);
  const isi = register.filter((r) => r.risk_event);

  return (
    <div className="mt-3 ml-0 rounded-xl border border-line bg-paper/60 p-4 text-[12.5px] md:ml-39">
      <div className="mb-3 flex gap-1 rounded-lg bg-white p-0.5 ring-1 ring-line sm:inline-flex">
        {([["risiko", "Ditutup oleh risiko"], ["tidak", "Tidak material"]] as const).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={clsx("rounded-md px-3 py-1 font-semibold", mode === m ? "bg-brand-800 text-white" : "text-slate-600")}>{l}</button>
        ))}
      </div>
      {mode === "risiko" ? (
        <div className="relative">
          <button onClick={() => setPilih(!pilih)} className="flex w-full items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left">
            <span className="flex-1">{ids.length ? `${ids.length} risiko dipilih` : "Pilih risiko dari Risk Register…"}</span><ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {pilih && (
            <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-xl">
              {isi.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-brand-50">
                  <input type="checkbox" checked={ids.includes(r.id)} onChange={() => setIds(ids.includes(r.id) ? ids.filter((x) => x !== r.id) : [...ids, r.id])} className="accent-brand-600" />
                  <b>#{register.indexOf(r) + 1}</b><span className="flex-1">{r.risk_event}</span><DampakBadge k={r.kategori_dampak} />
                </label>
              ))}
            </div>
          )}
        </div>
      ) : (
        <textarea rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan risiko ini tidak material bagi PT KINRA pada 2027, mis. tidak ada eksposur valas, nilai dampak di bawah kriteria Moderat…"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500" />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => onSimpan(mode === "tidak" ? { tidak_material: true, alasan: alasan.trim() } : { risk_ids: ids })}
          disabled={mode === "tidak" ? !alasan.trim() : !ids.length}>Simpan</Button>
        {!!(k.risk_ids?.length || k.tidak_material) && <Button variant="ghost" onClick={() => onSimpan(null)}>Kembalikan ke deteksi otomatis</Button>}
      </div>
    </div>
  );
}
