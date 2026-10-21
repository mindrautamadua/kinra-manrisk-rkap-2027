"use client";
import { useState } from "react";
import Link from "next/link";
import { Calculator, Download, ExternalLink } from "lucide-react";
import { Button, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, StatusBadge, TableWrap, useLoad, useSaver } from "@/components/ui";
import { REKAP } from "@/lib/static";
import { api } from "@/lib/data";
import { nilaiParam } from "@/lib/format";
import { exportRekap } from "@/lib/export";
import type { ParameterSheet } from "@/lib/types";

export default function RekapPage() {
  const q = useLoad(api.params);
  const saver = useSaver();
  const [busy, setBusy] = useState(false);
  const params = q.data ?? [];

  const patchParam = (code: string, patch: Partial<ParameterSheet>) => {
    q.setData(params.map((p) => (p.code === code ? { ...p, ...patch } : p)));
    saver.run(() => api.update<ParameterSheet>("parameter_sheet", "code", code, patch));
  };
  const setDiterapkan = (code: string, v: string | null) => patchParam(code, { diterapkan: v });
  // Parameter yang dinyatakan tidak diterapkan disajikan terpisah beserta justifikasinya (arahan Challenge Session 6f).
  const tidak = REKAP.filter((r) => r.grup !== "Parameter Standar" && params.find((x) => x.code === r.kode)?.diterapkan === "Tidak");
  const tanpaAlasan = tidak.filter((r) => !params.find((x) => x.code === r.kode)?.alasan_tidak_diterapkan?.trim()).length;

  /** Hitung ulang seluruh lembar parameter dengan mesin rumus, lalu simpan ringkasannya. */
  const recompute = async () => {
    setBusy(true);
    await saver.run(async () => {
      const { Workbook, loadAllTemplates } = await import("@/lib/engine");
      const [templates, sampul] = await Promise.all([loadAllTemplates(), api.sampul()]);
      const wb = new Workbook(templates, Object.fromEntries(params.map((p) => [p.code, p.inputs])), sampul.nama_entitas);
      const next = params.map((p) => ({ ...p, summary: wb.summary(p.code) }));
      wb.destroy();
      for (const p of next) await api.update<ParameterSheet>("parameter_sheet", "code", p.code, { summary: p.summary });
      q.setData(next);
    });
    setBusy(false);
  };

  const groups = Array.from(new Set(REKAP.map((r) => r.grup)));
  return (
    <SheetPage title="Rekap Parameter RAM RKAP 2027 - PT KINRA" code="Rekap"
      actions={<>{saver.indicator}
        <Button variant="outline" onClick={() => exportRekap(params)}><Download className="h-4 w-4" />Excel</Button>
        <Button edit onClick={recompute} disabled={busy || !q.data}><Calculator className="h-4 w-4" />{busy ? "Menghitung…" : "Hitung Ulang Semua"}</Button></>}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (<>
        <Section letter="A" title="Parameter yang Diukur">
        <TableWrap>
          <table className="kk-table min-w-[1200px]">
            <thead><tr>
              <th className="w-10">No</th><th className="w-14">Kode</th><th>Parameter</th><th className="w-44">Kategori Risiko</th><th className="w-20">Satuan</th>
              <th className="w-24 text-right">Limit</th><th className="w-24 text-right">Appetite</th><th className="w-24 text-right">Tolerance</th>
              <th className="w-32 text-right">Hasil Pengukuran RKAP 2027</th><th className="w-40">Status Pengukuran</th><th className="w-28">Diterapkan</th><th className="w-20">Lembar</th>
            </tr></thead>
            <tbody>
              {groups.map((g) => (
                <FragmentGroup key={g} title={g}>
                  {REKAP.filter((r) => r.grup === g && !tidak.includes(r)).map((r) => {
                    const p = params.find((x) => x.code === r.kode);
                    const s = p?.summary ?? {};
                    const standar = g === "Parameter Standar";
                    return (
                      <tr key={r.kode}>
                        <td className="text-center">{r.no}</td><td className="font-bold text-brand-700">{r.kode}</td><td>{r.parameter}</td>
                        <td className="text-[12px]">{r.kategori}</td><td>{r.satuan}</td>
                        <td className="calc text-right tabnum">{nilaiParam(s.limit, r.satuan)}</td>
                        <td className="calc text-right tabnum">{nilaiParam(s.appetite, r.satuan)}</td>
                        <td className="calc text-right tabnum">{nilaiParam(s.tolerance, r.satuan)}</td>
                        <td className="calc text-right font-semibold tabnum">{nilaiParam(s.hasil, r.satuan)}</td>
                        <td className="calc"><StatusBadge status={s.status} size="sm" /></td>
                        <td className={standar ? "calc" : "input"}>{standar ? "Ya" : <SelectCell value={p?.diterapkan} options={["Ya", "Tidak"]} onSave={(v) => setDiterapkan(r.kode, v)} />}</td>
                        <td><Link href={`/parameter/${r.kode}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">Buka<ExternalLink className="h-3 w-3" /></Link></td>
                      </tr>
                    );
                  })}
                </FragmentGroup>
              ))}
            </tbody>
          </table>
        </TableWrap>
        </Section>

        <Section letter="B" title={`Parameter Tidak Diterapkan (${tidak.length})`}
          right={tanpaAlasan ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[12px] font-semibold text-amber-800">{tanpaAlasan} belum ada justifikasi</span> : undefined}>
          <p className="mb-2 text-[12.5px] text-slate-500">Parameter yang dinyatakan tidak relevan dengan kegiatan usaha disajikan terpisah dan wajib disertai dasar pertimbangan. Ubah kolom Diterapkan menjadi &quot;Ya&quot; untuk mengembalikannya ke bagian A.</p>
          <TableWrap>
            <table className="kk-table min-w-[1000px]">
              <thead><tr>
                <th className="w-14">Kode</th><th className="w-72">Parameter</th><th className="w-44">Kategori Risiko</th><th className="w-28">Diterapkan</th>
                <th>Dasar Pertimbangan / Justifikasi Tidak Diterapkan</th><th className="w-20">Lembar</th>
              </tr></thead>
              <tbody>
                {tidak.map((r) => {
                  const p = params.find((x) => x.code === r.kode);
                  return (
                    <tr key={r.kode}>
                      <td className="font-bold text-brand-700">{r.kode}</td><td>{r.parameter}</td><td className="text-[12px]">{r.kategori}</td>
                      <td className="input"><SelectCell value={p?.diterapkan} options={["Ya", "Tidak"]} onSave={(v) => setDiterapkan(r.kode, v)} /></td>
                      <td className={p?.alasan_tidak_diterapkan?.trim() ? "input" : "input !bg-amber-100/70"}>
                        <EditCell value={p?.alasan_tidak_diterapkan} placeholder="Mengapa parameter ini tidak relevan dengan kegiatan usaha PT KINRA…" onSave={(v) => patchParam(r.kode, { alasan_tidak_diterapkan: v as string })} />
                      </td>
                      <td><Link href={`/parameter/${r.kode}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">Buka<ExternalLink className="h-3 w-3" /></Link></td>
                    </tr>
                  );
                })}
                {!tidak.length && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Semua parameter diterapkan.</td></tr>}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      </>)}
    </SheetPage>
  );
}

function FragmentGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <><tr><td colSpan={12} className="group">{title}</td></tr>{children}</>;
}
