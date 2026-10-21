"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import clsx from "clsx";
import { Card, DampakBadge, ErrorBox, Loading, SheetPage, SikapBadge, Stat, StatusBadge, useLoad } from "@/components/ui";
import { RiskMatrix } from "@/components/RiskMatrix";
import { api } from "@/lib/data";
import { buildRam, KATEGORI_URUT } from "@/lib/ram";
import { alasanStatus, ARTI_STATUS, isTopRisk, nilaiParam, persen, rupiah, statusStyle } from "@/lib/format";
import { elInheren } from "@/lib/target-risiko";
import type { RiskRegister } from "@/lib/types";

const STATUSES = ["Hijau", "Merah", "Data belum lengkap"];

export default function Dashboard() {
  const q = useLoad(async () => {
    const [register, params, ras, pengendalian, tambahan, sampul] = await Promise.all([api.register(), api.params(), api.ras(), api.pengendalian(), api.ramTambahan(), api.sampul()]);
    return { register, ras, sampul, ram: buildRam(params, ras, pengendalian, tambahan) };
  });
  const [sel, setSel] = useState<RiskRegister | null>(null);
  const d = q.data;

  return (
    <SheetPage title="Dashboard Manajemen Risiko RKAP 2027" code={d?.sampul.nama_entitas ?? "PT KINRA"}>
      {q.loading ? <Loading variant="dashboard" /> : q.error ? <ErrorBox error={q.error} /> : d && (() => {
        const aktif = d.ram.filter((r) => r.diterapkan);
        const count = (s: string) => aktif.filter((r) => (s === "Data belum lengkap" ? !["Hijau", "Merah"].includes(r.status) : r.status === s)).length;
        const utama = d.register.filter((r) => isTopRisk(r.kategori_dampak));
        const el = d.register.reduce((a, r) => a + (elInheren(r) ?? 0), 0);
        const dampak = d.register.reduce((a, r) => a + Number(r.nilai_dampak ?? 0), 0);
        const attention = aktif.filter((r) => r.status === "Merah");
        const maxKat = Math.max(1, ...KATEGORI_URUT.map((k) => d.register.filter((r) => r.kategori === k).length));
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label="Risiko Korporat" value={d.register.length} sub={`${utama.length} risiko utama (top risk)`} accent="bg-brand-600" />
              <Stat label="Parameter RAM Aktif" value={aktif.length} sub={`${count("Merah")} merah · ${count("Hijau")} hijau`} accent="bg-rose-500" />
              <Stat label="Total Nilai Dampak" value={rupiah(dampak, true)} sub="Risk Register, rupiah penuh" accent="bg-sky-500" />
              <Stat label="Total Expected Loss" value={rupiah(el, true)} sub="Risk Register, rupiah penuh" accent="bg-amber-500" />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold">Status Pengukuran Parameter RAM</h2>
                  <Link href="/ram" className="flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">Buka RAM<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                </div>
                <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                  {STATUSES.map((s) => { const n = count(s); return n ? <div key={s} className={statusStyle(s).dot} style={{ width: `${(n / aktif.length) * 100}%` }} title={`${s}: ${n}`} /> : null; })}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {STATUSES.map((s) => (
                    <div key={s} className="rounded-lg bg-paper/70 px-3 py-2" title={ARTI_STATUS[s]}>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className={clsx("h-2 w-2 rounded-full", statusStyle(s).dot)} />{s === "Data belum lengkap" ? "Belum lengkap" : s}</div>
                      <div className="text-[20px] font-extrabold tabnum">{count(s)}</div>
                      <div className="text-[10.5px] leading-tight text-slate-400">{ARTI_STATUS[s]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 text-[12px] font-bold tracking-wider text-slate-500 uppercase">Perlu perhatian</div>
                <div className="mt-2 divide-y divide-line">
                  {attention.map((r) => (
                    <Link key={r.key} href={r.tambahan ? "/ram" : `/parameter/${r.kode}`} className="flex items-center gap-3 py-2.5 hover:bg-paper/60">
                      <span className="w-10 font-mono text-[12px] font-bold text-brand-700">{r.kode}</span>
                      <span className="flex-1 text-[13px]">{r.parameter}<span className="block text-[11px] text-slate-400">{r.kategori}</span>
                        {(() => { const why = alasanStatus(r.status, r.hasil, r.limit, r.appetite, r.tolerance, r.satuan); return why && <span className="mt-0.5 block text-[11px] font-medium text-rose-700">{why}</span>; })()}</span>
                      <span className="text-right text-[12px] tabnum">{nilaiParam(r.hasil, r.satuan)}<span className="block text-[10.5px] text-slate-400">tol. {nilaiParam(r.tolerance, r.satuan)}</span></span>
                      <StatusBadge status={r.status} size="sm" />
                    </Link>
                  ))}
                  {attention.length === 0 && <div className="py-6 text-center text-[13px] text-slate-400">Seluruh parameter dalam limit.</div>}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold">Peta Risiko Utama</h2>
                    <Link href="/risiko-utama" className="flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">Detail<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  </div>
                  <RiskMatrix rows={d.register} onSelect={setSel} />
                  {sel && (
                    <div className="mt-4 rounded-xl bg-paper p-4 text-[12.5px]">
                      <div className="flex items-center gap-2"><b>#{sel.urutan} {sel.risk_event}</b><DampakBadge k={sel.kategori_dampak} /></div>
                      <div className="mt-1 text-slate-600">{sel.kategori} · Probabilitas {persen(sel.probabilitas, 0)} · Dampak {rupiah(sel.nilai_dampak, true)}</div>
                      {sel.rencana_mitigasi && <div className="mt-2 whitespace-pre-line text-slate-700"><b>Mitigasi:</b> {sel.rencana_mitigasi}</div>}
                    </div>
                  )}
                </Card>
                <Card className="p-5">
                  <h2 className="mb-4 font-bold">Risiko per Kategori</h2>
                  <div className="space-y-2.5">
                    {KATEGORI_URUT.map((k) => {
                      const all = d.register.filter((r) => r.kategori === k).length;
                      const top = utama.filter((r) => r.kategori === k).length;
                      return (
                        <div key={k} className="grid grid-cols-[minmax(0,150px)_1fr_44px] items-center gap-3 text-[12.5px]">
                          <span className="truncate text-slate-700">{k.replace("Risiko ", "")}</span>
                          <div className="relative h-5 rounded bg-slate-100">
                            <div className="absolute inset-y-0 left-0 rounded bg-brand-200" style={{ width: `${(all / maxKat) * 100}%` }} />
                            <div className="absolute inset-y-0 left-0 rounded bg-brand-600" style={{ width: `${(top / maxKat) * 100}%` }} />
                          </div>
                          <span className="text-right tabnum"><b>{top}</b>/{all}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-600" />Risiko utama</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand-200" />Risiko korporat</span></div>
                </Card>
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold">Sikap Risiko (RAS)</h2>
                    <Link href="/ras" className="flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">Buka RAS<ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  </div>
                  <table className="w-full text-[12.5px]">
                    <thead><tr className="text-left text-[11px] text-slate-500 uppercase"><th className="pb-2 font-semibold">Kategori</th><th className="pb-2 font-semibold">PTPN III</th><th className="pb-2 font-semibold">PT KINRA</th></tr></thead>
                    <tbody className="divide-y divide-line">
                      {d.ras.map((r) => <tr key={r.id}><td className="py-2 pr-2">{r.kategori}</td><td className="py-2"><SikapBadge sikap={r.sikap_induk} /></td><td className="py-2"><SikapBadge sikap={r.sikap} /></td></tr>)}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          </div>
        );
      })()}
    </SheetPage>
  );
}
