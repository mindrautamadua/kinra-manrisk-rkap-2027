import kk from "../../seed/kertas-kerja.json";

export interface RekapRef {
  no: number; kode: string; parameter: string; kategori: string; satuan: string; grup: string; diterapkan: string | null;
  ref_limit: string | null; ref_appetite: string | null; ref_tolerance: string | null; ref_hasil: string | null; ref_status: string | null;
}

type KK = {
  rekap: RekapRef[];
  notes: Record<string, string>;
  petunjuk: { lembar: string; isi: string }[];
  ram: { row: number; kategori_no: number | null; kode: string | null; parameter: string | null; formula: string | null; satuan: string | null; kategori_parameter: string | null }[];
};
const data = kk as unknown as KK;

/** Catatan asli dari kertas kerja Excel, tanpa label "Catatan:". */
export const note = (sheet: string) => (data.notes[sheet] ?? "").replace(/^Catatan:\s*/, "");
export const PETUNJUK = data.petunjuk;
export const RAM_LAYOUT = data.ram;
export const REKAP = data.rekap;

/** Parameter standar/klaster/unik yang polaritasnya "Makin rendah makin buruk" (sel E13 template parameter); selain ini "Makin tinggi makin buruk". */
const ARAH_MAKSIMAL = new Set(["1a", "3a", "3b", "6a", "6b", "K2", "K3", "U1", "U9"]);
export const arahParameter = (kode: string) => (ARAH_MAKSIMAL.has(kode) ? "Makin rendah makin buruk" : "Makin tinggi makin buruk");
