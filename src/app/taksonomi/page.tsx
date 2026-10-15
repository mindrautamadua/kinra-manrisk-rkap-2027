"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import clsx from "clsx";
import { Card, ErrorBox, Loading, SheetPage, Stat, useLoad } from "@/components/ui";
import { groupT3 } from "@/components/TaxonomyPicker";
import { api } from "@/lib/data";

export default function TaksonomiPage() {
  const q = useLoad(api.taksonomi);
  const [kat, setKat] = useState("");
  const [s, setS] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setKat("")} className={clsx("rounded-full px-3 py-1.5 text-[12px] font-semibold", !kat ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-line")}>Semua</button>
              {kats.map((k) => <button key={k} onClick={() => setKat(k)} className={clsx("rounded-full px-3 py-1.5 text-[12px] font-semibold", kat === k ? "bg-brand-800 text-white" : "bg-white text-slate-600 ring-1 ring-line")}>{k.replace("Risiko ", "")}</button>)}
            </div>
          </div>
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
                                  <div className="flex items-center gap-2"><span className="rounded bg-white px-1.5 font-mono text-[10.5px] ring-1 ring-line">{x.kode}</span><span className="ml-auto text-[10.5px] text-slate-400">{x.jumlah_unit} unit</span></div>
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
        </>
      )}
    </SheetPage>
  );
}
