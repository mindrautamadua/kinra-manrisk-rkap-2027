"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import clsx from "clsx";
import { Button, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, SikapBadge, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { cekSikap } from "@/lib/format";
import { note } from "@/lib/static";
import { SIKAP, type Ras, type RasTambahan, type KategoriRisiko } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

export default function RasPage() {
  const q = useLoad(async () => ({ ras: await api.ras(), tambahan: await api.rasTambahan(), kategori: await api.kategori() }));
  const saver = useSaver();
  const d = q.data;

  const patchRas = (id: number, p: Partial<Ras>) => {
    q.setData({ ...d!, ras: d!.ras.map((r) => (r.id === id ? { ...r, ...p } : r)) });
    saver.run(() => api.update<Ras>("ras", "id", id, p));
  };
  const patchTambahan = (id: number, p: Partial<RasTambahan>) => {
    q.setData({ ...d!, tambahan: d!.tambahan.map((r) => (r.id === id ? { ...r, ...p } : r)) });
    saver.run(() => api.update<RasTambahan>("ras_tambahan", "id", id, p));
  };
  const addTambahan = () => saver.run(async () => {
    const row = await api.insert<RasTambahan>("ras_tambahan", { kategori: null });
    q.setData({ ...d!, tambahan: [...d!.tambahan, row] });
  });
  const delTambahan = async (id: number) => {
    if (!(await konfirmasi({ judul: "Hapus pernyataan tambahan?" }))) return;
    q.setData({ ...d!, tambahan: d!.tambahan.filter((r) => r.id !== id) });
    saver.run(() => api.remove("ras_tambahan", "id", id));
  };

  // Bantuan AI untuk baris RAS (bagian A) atau pernyataan tambahan (bagian B).
  const [ai, setAi] = useState<{ bagian: "A"; row: Ras } | { bagian: "B"; row: RasTambahan } | null>(null);
  const sikapBoleh = (induk?: string | null) => SIKAP.filter((x) => !induk || cekSikap(x, induk) === "Sesuai");
  const aiProps = (a: NonNullable<typeof ai>) => {
    const induk = a.bagian === "A" ? a.row : d!.ras.find((r) => r.kategori === a.row.kategori);
    return {
      subjek: `${a.bagian === "A" ? "RAS" : "RAS Tambahan"} ${a.row.kategori ?? ""}`,
      fields: [
        { key: "sikap", label: "Sikap Risiko", options: sikapBoleh(induk?.sikap_induk) },
        { key: "pernyataan", label: "Pernyataan Selera Risiko" },
        { key: "rasionalisasi", label: "Rasionalisasi Sikap Risiko" },
      ],
      konteks: {
        bagian: a.bagian === "A" ? "Pernyataan utama per kategori" : "Pernyataan tambahan (melengkapi pernyataan utama, topik lebih spesifik)",
        kategori: a.row.kategori, definisi_kategori: d!.kategori.find((k) => k.nama === a.row.kategori)?.definisi,
        sikap_induk: induk?.sikap_induk, pernyataan_induk: induk?.pernyataan_induk,
        pernyataan_entitas_lain: d!.ras.filter((r) => r.id !== a.row.id && r.pernyataan).map((r) => ({ kategori: r.kategori, sikap: r.sikap, pernyataan: r.pernyataan })),
      },
    };
  };
  const applyAi = (p: Record<string, string>) => {
    if (!ai) return;
    if (ai.bagian === "A") patchRas(ai.row.id, p); else patchTambahan(ai.row.id, p);
  };

  const span = (i: number) => {
    const rows = d!.ras;
    if (i > 0 && rows[i - 1].kategori === rows[i].kategori) return 0;
    let n = 1; while (rows[i + n]?.kategori === rows[i].kategori) n++;
    return n;
  };

  return (
    <SheetPage title="Pernyataan Selera Risiko RKAP 2027 - PT KINRA" code="RAS" note={note("RAS")} actions={saver.indicator}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <Section letter="A" title="Pernyataan Selera Risiko per Kategori Risiko">
            <TableWrap>
              <table className="kk-table min-w-[1300px]">
                <thead><tr>
                  <th className="w-10">No</th><th className="w-36">Kategori Risiko</th><th className="w-28">Sikap Risiko PTPN III (Persero)</th>
                  <th className="w-[22%]">Pernyataan Selera Risiko Induk Perusahaan</th><th className="w-36">Sikap Risiko (PT KINRA)</th>
                  <th className="w-[24%]">Pernyataan Selera Risiko (PT KINRA)</th><th>Rasionalisasi Sikap Risiko (PT KINRA)</th><th className="w-28">Pemeriksaan Sikap Risiko</th><th className="w-10" />
                </tr></thead>
                <tbody>
                  {d.ras.map((r, i) => {
                    const s = span(i), cek = cekSikap(r.sikap, r.sikap_induk);
                    return (
                      <tr key={r.id}>
                        {s > 0 && <td rowSpan={s} className="text-center font-semibold">{r.no}</td>}
                        {s > 0 && <td rowSpan={s} className="font-semibold">{r.kategori}</td>}
                        <td><SikapBadge sikap={r.sikap_induk} /></td>
                        <td className="text-[11.5px] leading-relaxed text-slate-600">{r.pernyataan_induk}</td>
                        <td className="input"><SelectCell value={r.sikap} options={SIKAP} onSave={(v) => patchRas(r.id, { sikap: v })} /></td>
                        <td className="input"><EditCell value={r.pernyataan} onSave={(v) => patchRas(r.id, { pernyataan: v as string })} /></td>
                        <td className="input"><EditCell value={r.rasionalisasi} onSave={(v) => patchRas(r.id, { rasionalisasi: v as string })} /></td>
                        <td className={clsx("calc font-semibold", cek === "Sesuai" ? "text-emerald-700" : "text-rose-700")}>{cek || "–"}</td>
                        <td className="text-center"><AiRowButton onClick={() => setAi({ bagian: "A", row: r })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Section>

          <Section letter="B" title="Pernyataan Selera Risiko Tambahan" right={<Button edit variant="outline" onClick={addTambahan}><Plus className="h-4 w-4" />Tambah</Button>}>
            <TableWrap>
              <table className="kk-table min-w-[1000px]">
                <thead><tr><th className="w-14">No</th><th className="w-56">Kategori Risiko</th><th className="w-40">Sikap Risiko</th><th>Pernyataan Selera Risiko Tambahan</th><th>Rasionalisasi</th><th className="w-10" /></tr></thead>
                <tbody>
                  <tr className="example"><td>Contoh</td><td>Risiko Operasional</td><td>Zero Tolerance</td><td>Entitas tidak menoleransi kecelakaan kerja fatal pada kegiatan pabrik.</td><td>Keselamatan kerja menjadi prasyarat keberlangsungan operasi pabrik.</td><td /></tr>
                  {d.tambahan.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-center">{i + 1}</td>
                      <td className="input"><SelectCell value={r.kategori} options={d.kategori.map((k: KategoriRisiko) => k.nama)} onSave={(v) => patchTambahan(r.id, { kategori: v })} /></td>
                      <td className="input"><SelectCell value={r.sikap} options={SIKAP} onSave={(v) => patchTambahan(r.id, { sikap: v })} /></td>
                      <td className="input"><EditCell value={r.pernyataan} onSave={(v) => patchTambahan(r.id, { pernyataan: v as string })} /></td>
                      <td className="input"><EditCell value={r.rasionalisasi} onSave={(v) => patchTambahan(r.id, { rasionalisasi: v as string })} /></td>
                      <td><div className="flex flex-col items-center gap-2"><AiRowButton onClick={() => r.kategori ? setAi({ bagian: "B", row: r }) : alert("Pilih kategori risiko terlebih dahulu.")} /><button data-edit onClick={() => delTambahan(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></td>
                    </tr>
                  ))}
                  {d.tambahan.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Belum ada pernyataan tambahan.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          {ai && (
            <AiFillModal jenis="ras" {...aiProps(ai)} nilai={ai.row} onApply={applyAi} onClose={() => setAi(null)}
              placeholder="Contoh: Kami tidak menerima keterlambatan pembayaran pokok/bunga pinjaman, tapi masih menerima fluktuasi kurs dalam batas wajar karena sebagian pendapatan dalam USD." />
          )}
        </>
      )}
    </SheetPage>
  );
}
