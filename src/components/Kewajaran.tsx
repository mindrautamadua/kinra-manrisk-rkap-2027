"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertOctagon, AlertTriangle, ChevronDown, Eye, EyeOff, Info, ShieldCheck, Sigma } from "lucide-react";
import { parseAddr } from "@/lib/engine";
import type { Langkah, SevKewajaran, TemuanKewajaran } from "@/lib/kewajaran";

const SEV: Record<SevKewajaran, { label: string; icon: React.ElementType; chip: string; text: string }> = {
  kritis: { label: "Kritis", icon: AlertOctagon, chip: "bg-rose-50 text-rose-700 ring-rose-600/20", text: "text-rose-700" },
  perhatian: { label: "Perhatian", icon: AlertTriangle, chip: "bg-amber-50 text-amber-800 ring-amber-500/30", text: "text-amber-700" },
  info: { label: "Info", icon: Info, chip: "bg-sky-50 text-sky-800 ring-sky-500/25", text: "text-sky-700" },
};

/** Gulir ke baris sel pada grid dan sorot sebentar. */
export function lompat(addr: string) {
  const el = document.getElementById(`r${parseAddr(addr).row}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("bg-amber-100");
  setTimeout(() => el.classList.remove("bg-amber-100"), 1600);
}

const SelChip = ({ a }: { a: string }) => (
  <button onClick={() => lompat(a)} className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10.5px] text-slate-600 hover:bg-brand-100 hover:text-brand-800">{a}</button>
);

export function PanelKewajaran({ temuan, jejak }: { temuan: TemuanKewajaran[]; jejak: Langkah | null }) {
  const [buka, setBuka] = useState(false);
  const [tampil, setTampil] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem("kewajaran-tampil") === "0") setTampil(false); } catch {}
  }, []);
  const ubahTampil = () => setTampil((v) => {
    try { localStorage.setItem("kewajaran-tampil", v ? "0" : "1"); } catch {}
    return !v;
  });
  const kritis = temuan.filter((t) => t.severity === "kritis").length;
  const perlu = temuan.filter((t) => t.severity !== "info").length;
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-line bg-white/80">
      <div className={clsx("flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12.5px]", kritis ? "bg-rose-50/70" : perlu ? "bg-amber-50/70" : "bg-emerald-50/60")}>
        <ShieldCheck className={clsx("h-4 w-4", kritis ? "text-rose-700" : perlu ? "text-amber-700" : "text-emerald-700")} />
        <b>Uji Kewajaran Isian</b>
        <span className="text-slate-600">
          {temuan.length === 0 ? "Tidak ditemukan isian yang janggal oleh aturan pemeriksaan." :
            `${temuan.length} temuan${kritis ? `, ${kritis} kritis. Hasil pengukuran berpotensi tidak mencerminkan kondisi sebenarnya.` : "."}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {temuan.length > 0 && (
            <button onClick={ubahTampil} aria-expanded={tampil} className="flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[12px] font-medium hover:border-brand-500">
              {tampil ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{tampil ? "Sembunyikan temuan" : "Tampilkan temuan"}
            </button>
          )}
          {jejak && (
            <button onClick={() => setBuka((b) => !b)} className="flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[12px] font-medium hover:border-brand-500">
              <Sigma className="h-3.5 w-3.5" />Bagaimana angka ini dihitung<ChevronDown className={clsx("h-3.5 w-3.5 transition", buka && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {tampil && temuan.length > 0 && (
        <ul className="divide-y divide-line">
          {temuan.map((t) => {
            const s = SEV[t.severity];
            return (
              <li key={t.id} className="flex gap-3 px-4 py-2.5">
                <span className={clsx("mt-0.5 inline-flex h-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", s.chip)}><s.icon className="h-3 w-3" />{s.label}</span>
                <div className="min-w-0 flex-1 text-[12.5px]">
                  <div className="font-semibold">{t.judul}</div>
                  {t.detail && <div className="mt-0.5 text-slate-600">{t.detail}</div>}
                  {t.sel.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{[...new Set(t.sel)].slice(0, 16).map((a) => <SelChip key={a} a={a} />)}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {buka && jejak && (
        <div className="border-t border-line bg-paper/50 px-4 py-3">
          <p className="mb-2 text-[11.5px] text-slate-500">Urutan rujukan rumus dari hasil pengukuran ke sel sumbernya, memakai nilai isian saat ini. Klik alamat sel untuk menuju barisnya.</p>
          <Pohon n={jejak} root />
        </div>
      )}
    </div>
  );
}

function Pohon({ n, root }: { n: Langkah; root?: boolean }) {
  return (
    <div className={clsx(!root && "ml-4 border-l border-line pl-3")}>
      <div className="flex flex-wrap items-baseline gap-x-2 py-1 text-[12.5px]">
        {n.addr.includes(":") ? <span className="font-mono text-[10.5px] text-slate-500">{n.addr}</span> : <SelChip a={n.addr} />}
        <span className={clsx(root ? "font-bold" : "text-slate-700")}>{n.label}</span>
        <span className="font-semibold tabnum">= {n.nilai}</span>
        {n.rumus && <code className="basis-full truncate font-mono text-[10.5px] text-slate-400" title={n.rumus}>{n.rumus}</code>}
      </div>
      {n.anak.map((a) => <Pohon key={a.addr} n={a} />)}
      {n.ringkas && <div className="ml-4 pl-3 text-[11px] text-slate-400 italic">{n.ringkas}</div>}
    </div>
  );
}
