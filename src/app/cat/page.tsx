"use client";
import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import { Button, EditCell, ErrorBox, Loading, Section, SheetPage, StatusBadge, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { hitungStatus, nilaiParam } from "@/lib/format";
import { note } from "@/lib/static";
import type { CatAksi } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

const TEXT: [keyof CatAksi, string, string][] = [
  ["jenis", "Jenis Aksi Korporasi", "w-40"], ["nama", "Nama Aksi Korporasi", "w-52"], ["rencana_detail", "Rencana Detail", "w-64"],
  ["dasar_kewenangan", "Dasar Kewenangan (Anggaran Dasar)", "w-52"], ["rencana_waktu", "Rencana Waktu", "w-32"],
  ["parameter", "Parameter Akumulasi Transaksi", "w-44"], ["formula", "Formula", "w-48"],
];

/** Kolom teks yang dibantu AI; angka (hasil, threshold) tetap diisi pengguna. */
const AI_FIELDS = [...TEXT.map(([key, label]) => ({ key, label })),
  { key: "rasionalisasi_parameter", label: "Rasionalisasi Pemilihan Parameter" }, { key: "rasionalisasi_threshold", label: "Rasionalisasi Nilai Risk Threshold" }];
const CONTOH = {
  jenis: "Mengagunkan aset", nama: "Pengagunan HGU kebun untuk fasilitas kredit investasi",
  rencana_detail: "Pengikatan hak tanggungan atas HGU dan bangunan pabrik untuk fasilitas kredit investasi hilirisasi",
  dasar_kewenangan: "Anggaran Dasar Pasal tentang tindakan Direksi yang memerlukan persetujuan", rencana_waktu: "Triwulan II 2027",
  parameter: "Loan to Value (LTV)", formula: "Total utang ÷ total nilai agunan",
};

export default function CatPage() {
  const q = useLoad(api.cat);
  const saver = useSaver();
  const rows = q.data ?? [];
  const patch = (id: string, p: Partial<CatAksi>) => {
    q.setData(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
    saver.run(() => api.update<CatAksi>("cat_aksi", "id", id, p));
  };
  const add = () => saver.run(async () => {
    const row = await api.insert<CatAksi>("cat_aksi", { urutan: rows.length + 1 });
    q.setData([...rows, row]);
  });
  const del = async (id: string) => {
    if (!(await konfirmasi({ judul: "Hapus rencana aksi korporasi?", pesan: "Baris ini akan dihapus dari lembar CAT." }))) return;
    q.setData(rows.filter((r) => r.id !== id));
    saver.run(() => api.remove("cat_aksi", "id", id));
  };
  // ai: null = tertutup, "baru" = baris baru, selain itu id baris yang dibantu.
  const [ai, setAi] = useState<string | null>(null);
  const aiRow = rows.find((r) => r.id === ai);
  const applyAi = async (p: Record<string, string>) => {
    if (aiRow) { patch(aiRow.id, p); return; }
    const row = await api.insert<CatAksi>("cat_aksi", { urutan: rows.length + 1, ...p });
    q.setData([...rows, row]);
  };

  return (
    <SheetPage title="Corporate Action Threshold (CAT) RKAP 2027 - PT KINRA" code="CAT" note={note("CAT")} wide
      actions={<>{saver.indicator}<Button edit variant="outline" onClick={() => setAi("baru")}><Sparkles className="h-4 w-4" />Isi dengan AI</Button><Button edit onClick={add}><Plus className="h-4 w-4" />Tambah Aksi Korporasi</Button></>}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <Section letter="A" title="Daftar Rencana Aksi Korporasi dan Parameter Akumulasi Transaksi">
          <TableWrap>
            <table className="kk-table min-w-[2300px]">
              <thead><tr>
                <th className="w-12">No</th>{TEXT.map(([k, l, w]) => <th key={k} className={w}>{l}</th>)}
                <th className="w-28">Hasil Pengukuran (Risiko Inheren)</th><th className="w-52">Rasionalisasi Pemilihan Parameter</th>
                <th className="w-24">Limit</th><th className="w-24">Appetite</th><th className="w-24">Tolerance</th><th className="w-32">Status</th>
                <th className="w-52">Rasionalisasi Nilai Risk Threshold</th><th className="w-10" />
              </tr></thead>
              <tbody>
                <tr className="example">
                  <td>Contoh</td><td>Mengagunkan aset</td><td>Pengagunan HGU kebun untuk fasilitas kredit investasi</td>
                  <td>Pengikatan hak tanggungan atas HGU dan bangunan pabrik untuk fasilitas kredit investasi hilirisasi</td>
                  <td>Anggaran Dasar Pasal tentang tindakan Direksi yang memerlukan persetujuan</td><td>Triwulan II 2027</td><td>Loan to Value (LTV)</td>
                  <td>Total utang ÷ total nilai agunan</td><td className="text-right">55%</td><td>LTV membatasi akumulasi utang beragunan terhadap nilai agunan.</td>
                  <td className="text-right">60%</td><td className="text-right">70%</td><td className="text-right">80%</td><td>Hijau</td>
                  <td>Mengacu pada persyaratan kreditur dan kapasitas pembayaran utang.</td><td />
                </tr>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-center">{i + 1}</td>
                    {TEXT.map(([k]) => <td key={k} className="input"><EditCell value={r[k] as string} onSave={(v) => patch(r.id, { [k]: v })} /></td>)}
                    <td className="input"><EditCell kind="percent" value={r.hasil} display={(v) => nilaiParam(v, "%")} onSave={(v) => patch(r.id, { hasil: v as number })} /></td>
                    <td className="input"><EditCell value={r.rasionalisasi_parameter} onSave={(v) => patch(r.id, { rasionalisasi_parameter: v as string })} /></td>
                    {(["limit_v", "appetite_v", "tolerance_v"] as const).map((f) => (
                      <td key={f} className="input"><EditCell kind="percent" value={r[f]} display={(v) => nilaiParam(v, "%")} onSave={(v) => patch(r.id, { [f]: v as number })} /></td>
                    ))}
                    <td className="calc"><StatusBadge size="sm" status={r.hasil == null ? "" : hitungStatus(r.hasil, r.limit_v, r.appetite_v, r.tolerance_v, "Makin tinggi makin buruk")} /></td>
                    <td className="input"><EditCell value={r.rasionalisasi_threshold} onSave={(v) => patch(r.id, { rasionalisasi_threshold: v as string })} /></td>
                    <td><div className="flex flex-col items-center gap-2"><AiRowButton onClick={() => setAi(r.id)} /><button data-edit onClick={() => del(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={17} className="py-10 text-center text-slate-400">Belum ada rencana aksi korporasi RKAP 2027.</td></tr>}
              </tbody>
            </table>
          </TableWrap>
          <p className="mt-3 text-[12px] text-slate-500">Parameter akumulasi transaksi juga dimasukkan sebagai parameter unik pada RAM (menu RAM › Tambah parameter unik).</p>
        </Section>
      )}
      {ai && (
        <AiFillModal jenis="cat" subjek={aiRow ? `Aksi Korporasi #${rows.indexOf(aiRow) + 1} ${aiRow.nama ?? ""}` : "Rencana aksi korporasi baru"}
          fields={AI_FIELDS} nilai={aiRow ?? {}} onApply={applyAi} onClose={() => setAi(null)}
          konteks={{ contoh_baris: CONTOH, aksi_lain: rows.filter((r) => r.id !== ai && r.nama).map((r) => ({ jenis: r.jenis, nama: r.nama, parameter: r.parameter })) }}
          placeholder="Contoh: Tahun 2027 kami berencana mengambil kredit investasi dari bank untuk pembangunan pabrik hilirisasi, dengan jaminan HGU kebun dan bangunan pabrik." />
      )}
    </SheetPage>
  );
}
