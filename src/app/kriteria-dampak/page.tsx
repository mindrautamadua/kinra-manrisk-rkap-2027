"use client";
import { ErrorBox, Loading, Section, SheetPage, TableWrap, useLoad } from "@/components/ui";
import { api } from "@/lib/data";
import { note } from "@/lib/static";
import { DAMPAK_STYLE } from "@/lib/format";
import { KATEGORI_DAMPAK } from "@/lib/types";

export default function KriteriaPage() {
  const q = useLoad(async () => ({ kategori: await api.kategori(), kriteria: await api.kriteria() }));
  const d = q.data;
  return (
    <SheetPage title="Taksonomi dan Kriteria Dampak Risiko - PT KINRA" code="Kriteria Dampak" note={note("Kriteria Dampak")}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <Section letter="A" title="Definisi Kategori Risiko">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {d.kategori.map((k) => (
                <div key={k.no} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex items-baseline gap-2"><span className="text-[11px] font-bold text-brand-600">{k.no}</span><span className="text-[13.5px] font-bold">{k.nama}</span></div>
                  <div className="text-[11px] text-slate-400 italic">{k.nama_en}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{k.definisi}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section letter="B" title="Kriteria Dampak Risiko">
            <TableWrap>
              <table className="kk-table min-w-[1200px]">
                <thead><tr>
                  <th className="w-36">Kategori Risiko</th><th className="w-8">No</th><th className="w-48">Kriteria Dampak</th><th className="w-48">Perhitungan</th>
                  {KATEGORI_DAMPAK.map((k) => <th key={k}><span className={`rounded px-1.5 py-0.5 ${DAMPAK_STYLE[k]}`}>{k}</span></th>)}
                </tr></thead>
                <tbody>
                  {d.kriteria.map((r, i) => {
                    const first = i === 0 || d.kriteria[i - 1].kategori !== r.kategori;
                    const span = d.kriteria.filter((x) => x.kategori === r.kategori).length;
                    return (
                      <tr key={r.id}>
                        {first && <td rowSpan={span} className="group">{r.kategori}</td>}
                        <td className="text-center">{r.kode}</td><td className="font-semibold">{r.kriteria}</td><td className="text-slate-600">{r.perhitungan}</td>
                        <td>{r.sangat_rendah}</td><td>{r.rendah}</td><td>{r.moderat}</td><td>{r.tinggi}</td><td>{r.sangat_tinggi}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </>
      )}
    </SheetPage>
  );
}
