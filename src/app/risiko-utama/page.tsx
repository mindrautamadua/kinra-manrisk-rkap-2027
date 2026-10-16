"use client";
import { useState } from "react";
import clsx from "clsx";
import { Card, DampakBadge, ErrorBox, Loading, Section, SheetPage, TableWrap, useLoad } from "@/components/ui";
import { RiskMatrix } from "@/components/RiskMatrix";
import { CakupanTopRiskPanel } from "@/components/CakupanTopRisk";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import type { RiskRegister } from "@/lib/types";

export default function RisikoUtamaPage() {
  const q = useLoad(async () => {
    const [register, kategori, cakupan] = await Promise.all([api.register(), api.kategori(), api.cakupanTopRisk()]);
    return { register, kategori, cakupan };
  });
  const [sel, setSel] = useState<RiskRegister | null>(null);
  const [peta, setPeta] = useState<"inheren" | "target">("inheren");
  const d = q.data;
  const utama = (d?.register ?? []).filter((r) => isTopRisk(r.kategori_dampak)).map((r, i) => ({ ...r, urutan: i + 1 }));
  /** Kolom target ada bila migrasi 0008 sudah dijalankan. */
  const adaTarget = utama.some((r) => "target_kategori_dampak" in r);
  const titik = peta === "target" ? utama.map((r) => ({ ...r, probabilitas: r.target_probabilitas ?? null, kategori_dampak: r.target_kategori_dampak ?? null })) : utama;
  const tanpaTarget = utama.filter((r) => r.target_probabilitas == null || !r.target_kategori_dampak).length;

  return (
    <SheetPage title="Daftar Risiko Utama RKAP 2027 - PT KINRA" code="Risiko Utama" note={note("Risiko Utama")}>
      {q.loading ? <Loading variant="split" /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
            <Section letter="A" title="Jumlah Risiko per Kategori Risiko">
              <table className="kk-table">
                <thead><tr><th className="w-10">No</th><th>Kategori Risiko</th><th className="w-24 text-right">Risiko Korporat</th><th className="w-24 text-right">Risiko Utama</th></tr></thead>
                <tbody>
                  {d.kategori.map((k) => (
                    <tr key={k.no}>
                      <td className="text-center">{k.no}</td><td>{k.nama}</td>
                      <td className="calc text-right tabnum">{d.register.filter((r) => r.kategori === k.nama).length}</td>
                      <td className="calc text-right font-bold tabnum">{utama.filter((r) => r.kategori === k.nama).length}</td>
                    </tr>
                  ))}
                  <tr><td /><td className="font-bold">Total</td><td className="calc text-right font-bold">{d.register.length}</td><td className="calc text-right font-bold">{utama.length}</td></tr>
                </tbody>
              </table>
            </Section>
            <Section title="Peta Risiko Utama (indikatif)" right={adaTarget && (
              <div className="flex rounded-lg border border-line bg-white p-0.5 text-[12.5px]">
                {(["inheren", "target"] as const).map((k) => (
                  <button key={k} onClick={() => { setPeta(k); setSel(null); }}
                    className={clsx("rounded-md px-2.5 py-1 font-semibold", peta === k ? "bg-brand-700 text-white" : "text-slate-600")}>
                    {k === "inheren" ? "Inheren" : "Target residual"}
                  </button>
                ))}
              </div>
            )}>
              <Card className="p-5">
                <RiskMatrix rows={titik} onSelect={(r) => setSel(utama.find((x) => x.id === r.id) ?? null)} />
                {peta === "target" && tanpaTarget > 0 && <div className="mt-3 text-[12px] text-amber-700">{tanpaTarget} risiko utama belum punya target residual sehingga tidak tampil di peta.</div>}
                {sel && (
                  <div className="mt-4 rounded-lg bg-paper p-3 text-[12.5px]">
                    <b>{sel.urutan}. {sel.risk_event}</b> — {sel.kategori} · Inheren: prob. {persen(sel.probabilitas, 0)}, {sel.kategori_dampak}
                    {adaTarget && <> · Target: {sel.target_kategori_dampak ? `prob. ${persen(sel.target_probabilitas ?? null, 0)}, ${sel.target_kategori_dampak}` : "belum diisi"}</>}
                  </div>
                )}
              </Card>
            </Section>
          </div>
          <Section letter="B" title="Daftar Risiko Utama">
            <TableWrap>
              <table className="kk-table min-w-[1300px]">
                <thead><tr><th className="w-10">No</th><th className="w-40">Taksonomi Risiko</th><th className="w-56">Risk Event</th><th>Deskripsi Risk Event</th>
                  <th className="w-24 text-right">Probabilitas Kejadian</th><th className="w-40 text-right">Nilai Dampak Risiko (Rp)</th><th className="w-32">Kategori Dampak Risiko</th><th className="w-72">Rencana Mitigasi</th>
                  {adaTarget && <><th className="w-24 text-right">Target Probabilitas</th><th className="w-32">Target Kategori Dampak</th></>}</tr></thead>
                <tbody>
                  {utama.map((r) => (
                    <tr key={r.id}>
                      <td className="calc text-center font-bold">{r.urutan}</td><td className="calc">{r.kategori}</td><td className="calc font-semibold">{r.risk_event}</td>
                      <td className="calc text-[12px] text-slate-700">{r.deskripsi}</td><td className="calc text-right tabnum">{persen(r.probabilitas, 0)}</td>
                      <td className="calc text-right tabnum">{rupiah(r.nilai_dampak).replace("Rp ", "")}</td><td className="calc"><DampakBadge k={r.kategori_dampak} /></td>
                      <td className="calc whitespace-pre-line">{r.rencana_mitigasi}</td>
                      {adaTarget && <><td className="calc text-right tabnum">{persen(r.target_probabilitas ?? null, 0)}</td><td className="calc">{r.target_kategori_dampak ? <DampakBadge k={r.target_kategori_dampak} /> : <span className="text-[11px] text-amber-700">Belum diisi</span>}</td></>}
                    </tr>
                  ))}
                  {utama.length === 0 && <tr><td colSpan={adaTarget ? 10 : 8} className="py-8 text-center text-slate-400">Belum ada risiko dengan kategori dampak Moderat ke atas.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          <Section letter="C" title="Cakupan Topik Risiko Wajib">
            <CakupanTopRiskPanel register={d.register} keputusan={d.cakupan} onChange={(cakupan) => q.setData({ ...d, cakupan })} />
          </Section>
        </>
      )}
    </SheetPage>
  );
}
