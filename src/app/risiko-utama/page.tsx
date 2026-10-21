"use client";
import { useState } from "react";
import clsx from "clsx";
import { Card, DampakBadge, ErrorBox, Loading, Section, SheetPage, StatusBadge, TableWrap, useLoad } from "@/components/ui";
import { RiskMatrix } from "@/components/RiskMatrix";
import { CakupanTopRiskPanel } from "@/components/CakupanTopRisk";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import { buildRam } from "@/lib/ram";
import { peringkatRisiko } from "@/lib/peringkat-risiko";
import type { RiskRegister } from "@/lib/types";

export default function RisikoUtamaPage() {
  const q = useLoad(async () => {
    const [register, kategori, cakupan, ras, params, pengendalian, tambahan] = await Promise.all([
      api.register(), api.kategori(), api.cakupanTopRisk(), api.ras(), api.params(), api.pengendalian(), api.ramTambahan(),
    ]);
    return { register, kategori, cakupan, peringkat: peringkatRisiko(register, ras, buildRam(params, ras, pengendalian, tambahan)) };
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
          <Section letter="C" title="Dasar Pemeringkatan Risiko Utama">
            <p className="mb-2 text-[12.5px] text-slate-600">
              Penetapan Risiko Utama mengikuti aturan template PT DAM v.2: kategori dampak Moderat, Tinggi, atau Sangat Tinggi. Seluruh risiko diperingkat objektif menurut
              expected loss inheren (probabilitas × nilai dampak), lalu dikaitkan dengan batas selera sikap RAS kategorinya dan status terburuk parameter RAM yang tertaut.
              Risiko yang tidak menjadi Risiko Utama tetap tercatat di Risk Register dan dipantau sesuai materialitasnya.
            </p>
            <TableWrap>
              <table className="kk-table min-w-[1200px]">
                <thead><tr>
                  <th className="w-16">Peringkat</th><th className="w-12">No</th><th>Risk Event</th><th className="w-36 text-right">Expected Loss Inheren</th><th className="w-32">Kategori Dampak</th>
                  <th className="w-44">Sikap RAS (batas selera)</th><th className="w-28">Terhadap Selera</th><th className="w-32">Status RAM Terburuk</th><th className="w-28">Risiko Utama</th><th className="w-60">Pemantauan</th>
                </tr></thead>
                <tbody>
                  {d.peringkat.map((p) => (
                    <tr key={p.r.id} className={clsx(!p.utama && "bg-slate-50/70")}>
                      <td className="calc text-center font-bold">{p.peringkat}</td><td className="calc text-center">#{p.no}</td>
                      <td className="calc font-semibold">{p.r.risk_event}<div className="text-[11px] font-normal text-slate-500">{p.r.kategori}</div></td>
                      <td className="calc text-right tabnum">{p.el == null ? "–" : rupiah(p.el, true)}</td>
                      <td className="calc"><DampakBadge k={p.r.kategori_dampak} /></td>
                      <td className="calc text-[12px]">{p.sikap ?? "–"}{p.batas && <span className="text-slate-500"> (≤ {p.batas})</span>}</td>
                      <td className={clsx("calc text-[12px] font-semibold", p.terhadapSelera === "Di atas selera" ? "text-rose-700" : "text-emerald-700")}>{p.terhadapSelera ?? "–"}</td>
                      <td className="calc">{p.ram ? <span className="inline-flex items-center gap-1"><StatusBadge status={p.ram.status} size="sm" /><span className="text-[11px] text-slate-500">{p.ram.kode}</span></span> : <span className="text-[11px] text-slate-400">Belum diukur</span>}</td>
                      <td className="calc text-center font-bold">{p.utama ? <span className="text-orange-700">Ya</span> : <span className="text-slate-500">Tidak</span>}</td>
                      <td className="calc text-[12px]">{p.pemantauan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          <Section letter="D" title="Cakupan Topik Risiko Wajib">
            <CakupanTopRiskPanel register={d.register} keputusan={d.cakupan} onChange={(cakupan) => q.setData({ ...d, cakupan })} />
          </Section>
        </>
      )}
    </SheetPage>
  );
}
