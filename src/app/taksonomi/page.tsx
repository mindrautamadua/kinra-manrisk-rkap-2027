"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, LayoutList, Network, Search } from "lucide-react";
import clsx from "clsx";
import { Card, ErrorBox, Loading, SheetPage, Stat, useLoad } from "@/components/ui";
import { groupT3 } from "@/components/TaxonomyPicker";
import { api } from "@/lib/data";
import type { Taksonomi } from "@/lib/types";

export default function TaksonomiPage() {
  const q = useLoad(api.taksonomi);
  const [kat, setKat] = useState("");
  const [s, setS] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"daftar" | "hirarki">("daftar");
  useEffect(() => { try { if (localStorage.getItem("taksonomi-view") === "hirarki") setView("hirarki"); } catch {} }, []);
  const gantiView = (v: "daftar" | "hirarki") => { setView(v); try { localStorage.setItem("taksonomi-view", v); } catch {} };
  const tax = useMemo(() => q.data ?? [], [q.data]);
  const kats = useMemo(() => Array.from(new Set(tax.map((t) => t.kategori))), [tax]);
  const t3 = useMemo(() => groupT3(tax).filter((o) => (!kat || o.kategori === kat) && (!s ||
    [o.risiko_korporat, o.definisi, o.aspek, ...o.spesifik.map((x) => `${x.kode} ${x.risiko_spesifik}`)].join(" ").toLowerCase().includes(s.toLowerCase()))), [tax, kat, s]);
  const byKat = useMemo(() => {
    const m = new Map<string, Map<string, typeof t3>>();
    for (const o of t3) {
      if (!m.has(o.kategori)) m.set(o.kategori, new Map());
      const a = m.get(o.kategori)!;
      a.set(o.aspek, [...(a.get(o.aspek) ?? []), o]);
    }
    return [...m.entries()];
  }, [t3]);

  return (
    <SheetPage title="Taksonomi Risiko PTPN Group" code="Master Data">
      {q.loading ? <Loading variant="list" /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Kategori (T1)" value={kats.length} accent="bg-brand-600" />
            <Stat label="Aspek (T2)" value={new Set(tax.map((t) => t.aspek)).size} accent="bg-sky-500" />
            <Stat label="Risiko Korporat (T3)" value={groupT3(tax).length} accent="bg-amber-500" />
            <Stat label="Risiko Spesifik (T4)" value={tax.length} accent="bg-rose-500" />
          </div>
          <div className="sticky top-14 z-10 -mx-1 mb-4 flex flex-wrap gap-2 bg-paper/90 px-1 py-2 backdrop-blur">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input value={s} onChange={(e) => setS(e.target.value)} placeholder="Cari kode RA-, risiko korporat, risiko spesifik…" className="w-full rounded-lg border border-line bg-white py-2 pr-3 pl-9 text-[13px] outline-none focus:border-brand-500" />
            </div>
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-line">
              {([["daftar", "Daftar", LayoutList], ["hirarki", "Hirarki", Network]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => gantiView(v)} className={clsx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold", view === v ? "bg-brand-800 text-white" : "text-slate-600 hover:bg-slate-50")}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setKat("")} className={clsx("rounded-full px-3 py-1.5 text-[12px] font-semibold", !kat ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-line")}>Semua</button>
              {kats.map((k) => <button key={k} onClick={() => setKat(k)} className={clsx("rounded-full px-3 py-1.5 text-[12px] font-semibold", kat === k ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-line")}>{k.replace("Risiko ", "")}</button>)}
            </div>
          </div>
          {view === "hirarki" ? <Hirarki byKat={byKat} tax={tax} cari={!!s} /> : (
          <div className="space-y-6">
            {byKat.map(([k, aspek]) => (
              <Card key={k} className="overflow-hidden">
                <div className="bg-brand-800 px-5 py-3 text-white">
                  <div className="text-[15px] font-bold">{k}</div>
                  <p className="mt-1 line-clamp-2 text-[12px] text-brand-100/80">{tax.find((t) => t.kategori === k)?.def_kategori}</p>
                </div>
                {[...aspek.entries()].map(([a, items]) => (
                  <div key={a} className="border-t border-line">
                    <div className="bg-brand-50 px-5 py-2">
                      <div className="text-[12.5px] font-bold text-brand-800">{a}</div>
                      <p className="line-clamp-1 text-[11.5px] text-slate-500">{tax.find((t) => t.aspek === a)?.def_aspek}</p>
                    </div>
                    {items.map((o) => {
                      const id = o.kategori + o.risiko_korporat;
                      return (
                        <div key={id} className="border-t border-line/60">
                          <button onClick={() => setOpen(open === id ? null : id)} className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-slate-50">
                            <ChevronRight className={clsx("mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition", open === id && "rotate-90")} />
                            <div className="flex-1">
                              <div className="text-[13px] font-semibold">{o.risiko_korporat}</div>
                              {open === id && <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{o.definisi}</p>}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 text-[11px] text-slate-600">{o.spesifik.length} T4</span>
                          </button>
                          {open === id && (
                            <div className="grid gap-2 px-12 pb-4 md:grid-cols-2">
                              {o.spesifik.map((x) => (
                                <div key={x.kode} className="rounded-lg border border-line bg-paper/50 p-3">
                                  <div className="flex items-center gap-2"><span className="rounded bg-white px-1.5 font-mono text-[10.5px] ring-1 ring-line">{x.kode}</span></div>
                                  <div className="mt-1.5 text-[12.5px] font-semibold">{x.risiko_spesifik}</div>
                                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600">{x.def_risiko_spesifik}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </Card>
            ))}
          </div>
          )}
        </>
      )}
    </SheetPage>
  );
}

type GrupT3 = ReturnType<typeof groupT3>;

const LEVEL = {
  T1: "bg-brand-600 text-white", T2: "bg-sky-500 text-white", T3: "bg-amber-500 text-white", T4: "bg-rose-500 text-white",
} as const;

/** Tampilan pohon T1 › T2 › T3 › T4. Saat mencari, semua cabang yang cocok terbuka. */
function Hirarki({ byKat, tax, cari }: { byKat: [string, Map<string, GrupT3>][]; tax: Taksonomi[]; cari: boolean }) {
  const [buka, setBuka] = useState<Set<string>>(() => new Set(byKat.map(([k]) => k)));
  const semuaKunci = useMemo(() => byKat.flatMap(([k, aspek]) => [k, ...[...aspek.entries()].flatMap(([a, items]) => [`${k}|${a}`, ...items.map((o) => `${k}|${a}|${o.risiko_korporat}`)])]), [byKat]);
  const terbuka = (key: string) => cari || buka.has(key);
  const toggle = (key: string) => setBuka((b) => { const n = new Set(b); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const nT4 = (items: GrupT3) => items.reduce((n, o) => n + o.spesifik.length, 0);

  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500">
        {(Object.keys(LEVEL) as (keyof typeof LEVEL)[]).map((l) => (
          <span key={l} className="inline-flex items-center gap-1"><span className={clsx("rounded px-1 font-bold", LEVEL[l])}>{l}</span>
            {{ T1: "Kategori", T2: "Aspek", T3: "Risiko Korporat", T4: "Risiko Spesifik" }[l]}</span>
        ))}
        {!cari && (
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => setBuka(new Set(semuaKunci))} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"><ChevronsUpDown className="h-3.5 w-3.5" />Buka semua</button>
            <button onClick={() => setBuka(new Set())} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"><ChevronsDownUp className="h-3.5 w-3.5" />Tutup semua</button>
          </div>
        )}
      </div>
      {!byKat.length && <div className="py-10 text-center text-[13px] text-slate-400">Tidak ada yang cocok.</div>}
      <ul className="text-[13px]">
        {byKat.map(([k, aspek]) => {
          const items = [...aspek.values()].flat();
          return (
            <Node key={k} level="T1" label={k} def={tax.find((t) => t.kategori === k)?.def_kategori} open={terbuka(k)} onToggle={() => toggle(k)}
              meta={`${aspek.size} aspek · ${items.length} T3 · ${nT4(items)} T4`}>
              {[...aspek.entries()].map(([a, its]) => {
                const ka = `${k}|${a}`;
                return (
                  <Node key={ka} level="T2" label={a} def={tax.find((t) => t.aspek === a)?.def_aspek} open={terbuka(ka)} onToggle={() => toggle(ka)}
                    meta={`${its.length} T3 · ${nT4(its)} T4`}>
                    {its.map((o) => {
                      const ko = `${ka}|${o.risiko_korporat}`;
                      return (
                        <Node key={ko} level="T3" label={o.risiko_korporat} def={o.definisi} open={terbuka(ko)} onToggle={() => toggle(ko)} meta={`${o.spesifik.length} T4`}>
                          {o.spesifik.map((x) => <Node key={x.kode} level="T4" kode={x.kode} label={x.risiko_spesifik ?? ""} def={x.def_risiko_spesifik} />)}
                        </Node>
                      );
                    })}
                  </Node>
                );
              })}
            </Node>
          );
        })}
      </ul>
    </Card>
  );
}

function Node({ level, label, def, kode, meta, open, onToggle, children }: {
  level: keyof typeof LEVEL; label: string; def?: string | null; kode?: string; meta?: string; open?: boolean; onToggle?: () => void; children?: React.ReactNode;
}) {
  const [lihatDef, setLihatDef] = useState(false);
  const daun = !children;
  return (
    <li className={clsx(level !== "T1" && "relative pl-3.5 before:absolute before:top-[13px] before:left-0 before:w-3 before:border-t before:border-slate-300")}>
      <div className="group flex items-start gap-2 rounded-md py-1 pr-2 hover:bg-slate-50">
        <button onClick={daun ? () => setLihatDef((v) => !v) : onToggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <ChevronRight className={clsx("mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition", daun && "invisible", open && "rotate-90")} />
          <span className={clsx("mt-px shrink-0 rounded px-1 text-[10px] leading-4 font-bold", LEVEL[level])}>{level}</span>
          {kode && <span className="mt-px shrink-0 rounded bg-white px-1.5 font-mono text-[10.5px] leading-4 ring-1 ring-line">{kode}</span>}
          <span className={clsx("min-w-0", level === "T1" ? "font-bold text-ink" : level === "T4" ? "text-slate-700" : "font-semibold text-ink")}>{label}</span>
        </button>
        {meta && <span className="shrink-0 rounded-full bg-slate-100 px-2 text-[11px] text-slate-600">{meta}</span>}
        {!daun && def && (
          <button onClick={() => setLihatDef((v) => !v)} className="shrink-0 text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 hover:text-brand-700 focus:opacity-100">
            {lihatDef ? "sembunyikan" : "definisi"}
          </button>
        )}
      </div>
      {lihatDef && def && <p className="mb-1.5 ml-6 rounded-md bg-paper/70 px-3 py-2 text-[12px] leading-relaxed text-slate-600">{def}</p>}
      {open && children && <ul className="ml-2 border-l border-slate-300">{children}</ul>}
    </li>
  );
}
