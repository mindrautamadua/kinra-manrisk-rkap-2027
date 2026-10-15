import { SheetPage, Section, Card } from "@/components/ui";
import { PETUNJUK, note } from "@/lib/static";

const WARNA = [
  { cls: "bg-cell-input ring-amber-300", label: "Diisi entitas." },
  { cls: "bg-cell-calc ring-sky-300", label: "Terhitung otomatis dari data yang diisi." },
  { cls: "bg-cell-label ring-slate-300", label: "Label atau baris contoh. Baris contoh tidak ikut dihitung." },
];
const BAGIAN = [
  ["A", "Identitas parameter: kode, nama, kategori risiko, formula, satuan, arah pembacaan, dan ketentuan penghitungan."],
  ["B", "Risk threshold: limit, appetite, dan tolerance beserta nilai batas yang dipakai untuk menentukan status."],
  ["C", "Rincian data RKAP 2027 yang menjadi dasar perhitungan parameter."],
  ["D", "Hasil pengukuran RKAP 2027, status pengukuran, konfirmasi eksposur, dan penjelasannya."],
  ["E", "Sumber data dan posisi data yang dipakai."],
  ["F", "Dasar usulan risk threshold: data historis bulanan dan rasionalisasi. Hanya untuk parameter yang batasnya diusulkan entitas."],
];

export default function PetunjukPage() {
  return (
    <SheetPage title="Petunjuk Pengisian" code="Lembar" offline>
      <Card className="mb-8 p-6 text-[13px] leading-relaxed whitespace-pre-line text-slate-700">{note("Petunjuk")}</Card>
      <div className="grid gap-8 lg:grid-cols-2">
        <Section letter="A" title="Keterangan Warna Sel">
          <table className="kk-table"><thead><tr><th className="w-32">Warna</th><th>Keterangan</th></tr></thead>
            <tbody>{WARNA.map((w) => <tr key={w.label}><td><span className={`block h-5 w-20 rounded ring-1 ${w.cls}`} /></td><td>{w.label}</td></tr>)}</tbody>
          </table>
        </Section>
        <Section letter="B" title="Susunan Lembar Parameter">
          <table className="kk-table"><thead><tr><th className="w-20">Bagian</th><th>Isi</th></tr></thead>
            <tbody>{BAGIAN.map(([b, i]) => <tr key={b}><td className="text-center font-bold">{b}</td><td>{i}</td></tr>)}</tbody>
          </table>
        </Section>
      </div>
      <Section letter="C" title="Urutan Pengisian">
        <table className="kk-table"><thead><tr><th className="w-44">Lembar</th><th>Isi dan Cara Pengisian</th></tr></thead>
          <tbody>{PETUNJUK.map((p) => <tr key={p.lembar}><td className="font-semibold">{p.lembar}</td><td>{p.isi}</td></tr>)}</tbody>
        </table>
      </Section>
    </SheetPage>
  );
}
