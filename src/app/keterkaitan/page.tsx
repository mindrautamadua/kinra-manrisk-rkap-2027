"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check } from "lucide-react";
import { Card, DampakBadge, ErrorBox, Loading, Migrasi2, SheetPage, Stat, StatusBadge, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { buildRam, KATEGORI_URUT, perluPengendalian } from "@/lib/ram";
import { isTopRisk, statusStyle } from "@/lib/format";
import { useReadonly } from "@/lib/mode";
import type { RiskRegister } from "@/lib/types";

export default function KeterkaitanPage() {
  const q = useLoad(async () => {
    const [register, params, ras, pengendalian, tambahan] = await Promise.all([api.register(), api.params(), api.ras(), api.pengendalian(), api.ramTambahan()]);
    return { register, ram: buildRam(params, ras, pengendalian, tambahan), siap: register.length === 0 || register.some((r) => "parameter_ram" in r) };
  });
  const saver = useSaver();
  const ro = useReadonly();
  const [semua, setSemua] = useState(false);
  const d = q.data;

  const cols = useMemo(() => (d?.ram ?? []).filter((r) => r.kode && (semua || r.diterapkan)), [d, semua]);
  const register = d?.register ?? [];
  const linked = (r: RiskRegister, kode: string) => (r.parameter_ram ?? []).includes(kode);

  const toggle = (r: RiskRegister, kode: string) => {
    if (ro) return;
    const next = linked(r, kode) ? (r.parameter_ram ?? []).filter((x) => x !== kode) : [...(r.parameter_ram ?? []), kode];
    q.setData({ ...d!, register: register.map((x) => (x.id === r.id ? { ...x, parameter_ram: next } : x)) });
    saver.run(() => api.update<RiskRegister>("risk_register", "id", r.id, { parameter_ram: next }));
  };

  const risikoTanpa = register.filter((r) => !(r.parameter_ram ?? []).length);
  const paramTanpa = cols.filter((c) => c.diterapkan && !register.some((r) => linked(r, c.kode)));
  const paramMasalahTanpa = paramTanpa.filter((c) => perluPengendalian(c.status));
  const kats = KATEGORI_URUT.filter((k) => cols.some((c) => c.kategori === k));

  return (
    <SheetPage title="Keterkaitan Risk Register – Parameter RAM" code="Challenge Session" wide
      note="Parameter unik yang diusulkan wajib menangkap risk driver dari beberapa risk event dalam Risk Register (catatan lembar RAM). Matriks ini menunjukkan risk event mana yang dipantau oleh parameter RAM mana. Klik sel untuk mengaitkan atau melepas."
      actions={<>{saver.indicator}
        <label className="flex items-center gap-2 text-[12.5px] text-slate-600"><input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} className="accent-brand-600" />Tampilkan parameter yang tidak diterapkan</label></>}>
      {q.loading ? <Loading variant="stats-table" /> : q.error ? <ErrorBox error={q.error} /> : d && !d.siap ? <Migrasi2 /> : d && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Risiko terkait parameter" value={`${register.length - risikoTanpa.length}/${register.length}`} accent="bg-brand-600" />
            <Stat label="Parameter ditopang risiko" value={`${cols.filter((c) => c.diterapkan).length - paramTanpa.length}/${cols.filter((c) => c.diterapkan).length}`} accent="bg-sky-500" />
            <Stat label="Risiko tanpa parameter" value={risikoTanpa.length} sub={`${risikoTanpa.filter((r) => isTopRisk(r.kategori_dampak)).length} di antaranya risiko utama`} accent="bg-amber-400" />
            <Stat label="Parameter K/O/M tanpa risiko" value={paramMasalahTanpa.length} sub={paramMasalahTanpa.map((c) => c.kode).join(", ") || "Semua tertopang"} accent="bg-rose-500" />
          </div>

          <Card className="scroll-thin mb-6 overflow-auto">
            <table className="border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="sticky top-0 left-0 z-20 min-w-[320px] border-r border-b border-line bg-brand-800 px-3 py-2 text-left font-semibold text-white">Risk Event</th>
                  {kats.map((k) => (
                    <th key={k} colSpan={cols.filter((c) => c.kategori === k).length} className="sticky top-0 z-10 border-r border-b border-white/15 bg-brand-800 px-2 py-1.5 text-center text-[11px] font-semibold whitespace-nowrap text-white">
                      {k.replace("Risiko ", "")}
                    </th>
                  ))}
                  <th rowSpan={2} className="sticky top-0 z-10 border-b border-line bg-brand-800 px-2 text-center text-[11px] font-semibold text-white">Jumlah</th>
                </tr>
                <tr>
                  {kats.map((k) => cols.filter((c) => c.kategori === k).map((c) => (
                    <th key={c.key} title={`${c.kode} ${c.parameter} · ${c.status}`} className="sticky top-[29px] z-10 h-24 min-w-[40px] border-r border-b border-line bg-paper px-1 align-bottom">
                      <Link href={c.tambahan ? "/ram" : `/parameter/${c.kode}`} className="flex flex-col items-center gap-1 pb-1">
                        <span className={clsx("h-2.5 w-2.5 rounded-full", statusStyle(c.status).dot)} />
                        <span className="text-[11px] font-bold text-brand-800 [writing-mode:vertical-rl] rotate-180">{c.kode}</span>
                      </Link>
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {KATEGORI_URUT.filter((k) => register.some((r) => r.kategori === k)).map((k) => (
                  <Fragment key={k}>
                    <tr><td colSpan={cols.length + 2} className="sticky left-0 border-b border-line bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800">{k}</td></tr>
                    {register.filter((r) => r.kategori === k).map((r) => {
                      const n = (r.parameter_ram ?? []).length;
                      return (
                        <tr key={r.id} className="group">
                          <td className="sticky left-0 z-[5] border-r border-b border-line bg-white px-3 py-2 group-hover:bg-paper">
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-slate-400">#{register.indexOf(r) + 1}</span>
                              <div className="min-w-0">
                                <div className="font-semibold">{r.risk_event ?? "(tanpa risk event)"}</div>
                                <div className="mt-0.5"><DampakBadge k={r.kategori_dampak} /></div>
                              </div>
                            </div>
                          </td>
                          {kats.map((kk) => cols.filter((c) => c.kategori === kk).map((c) => {
                            const on = linked(r, c.kode);
                            return (
                              <td key={c.key} onClick={() => toggle(r, c.kode)}
                                className={clsx("border-r border-b border-line text-center align-middle", c.kategori === r.kategori && "bg-brand-50/50", !ro && "cursor-pointer hover:bg-amber-50")}>
                                {on && <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white"><Check className="h-3 w-3" /></span>}
                              </td>
                            );
                          }))}
                          <td className={clsx("border-b border-line px-2 text-center font-bold", n ? "text-brand-700" : "bg-amber-50 text-amber-700")}>{n}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                {!register.length && <tr><td colSpan={cols.length + 2} className="py-10 text-center text-slate-400">Risk Register masih kosong.</td></tr>}
                <tr>
                  <td className="sticky left-0 z-[5] border-r border-line bg-paper px-3 py-2 text-[11px] font-bold text-slate-600">Jumlah risiko terkait</td>
                  {kats.map((kk) => cols.filter((c) => c.kategori === kk).map((c) => {
                    const n = register.filter((r) => linked(r, c.kode)).length;
                    return <td key={c.key} className={clsx("border-r border-line px-1 py-2 text-center font-bold", n ? "bg-paper text-brand-700" : c.diterapkan ? "bg-amber-50 text-amber-700" : "bg-paper text-slate-300")}>{n}</td>;
                  }))}
                  <td className="bg-paper" />
                </tr>
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-bold">Risk event tanpa parameter RAM</h2>
              {risikoTanpa.length ? (
                <ul className="divide-y divide-line text-[12.5px]">
                  {risikoTanpa.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1"><b>#{register.indexOf(r) + 1}</b> {r.risk_event ?? "(tanpa risk event)"}<span className="block text-[11px] text-slate-400">{r.kategori}</span></span>
                      <DampakBadge k={r.kategori_dampak} />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-emerald-700">Semua risk event sudah dikaitkan.</p>}
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-bold">Parameter diterapkan tanpa risk event</h2>
              {paramTanpa.length ? (
                <ul className="divide-y divide-line text-[12.5px]">
                  {paramTanpa.map((c) => (
                    <li key={c.key} className="flex items-center gap-3 py-2">
                      <b className="w-9 text-brand-700">{c.kode}</b><span className="flex-1">{c.parameter}<span className="block text-[11px] text-slate-400">{c.kategori}</span></span>
                      <StatusBadge status={c.status} size="sm" />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-emerald-700">Semua parameter tertopang risk event.</p>}
            </Card>
          </div>
        </>
      )}
    </SheetPage>
  );
}
