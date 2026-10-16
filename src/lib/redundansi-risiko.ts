/** Kontrak permintaan/hasil Cek Redundansi AI: risk event yang duplikat atau tumpang tindih. */
export interface RedundansiRequest {
  entitas: string;
  risiko: {
    id: string; no: number; kategori: string | null; taksonomi_kode: string | null; risk_driver: string | null;
    risk_event: string | null; deskripsi: string | null; root_cause: string | null; deskripsi_dampak: string | null;
    existing_control: string | null; rencana_mitigasi: string | null; sidik: string;
  }[];
}

export const JENIS_REDUNDAN = ["Duplikat", "Tumpang tindih", "Sebab-akibat"] as const;
export type JenisRedundan = (typeof JENIS_REDUNDAN)[number];

/** Kolom register yang boleh diubah oleh opsi tindakan AI. */
export const KOLOM_UBAH = [
  { key: "deskripsi", label: "Deskripsi Risk Event" },
  { key: "root_cause", label: "Root Cause" },
  { key: "deskripsi_dampak", label: "Deskripsi Dampak" },
  { key: "existing_control", label: "Existing Control" },
  { key: "rencana_mitigasi", label: "Rencana Mitigasi" },
] as const;
export type KolomUbah = (typeof KOLOM_UBAH)[number]["key"];

/** Isian baru satu risiko; "" berarti kolom itu tidak diubah. */
export type UbahRisiko = { id: string } & Record<KolomUbah, string>;

/** Opsi tindak lanjut yang bisa langsung dieksekusi ke register. */
export interface OpsiTindakan {
  label: string; penjelasan: string;
  ubah: UbahRisiko[];
  /** id risiko yang dihapus setelah isiannya dipindahkan. */
  hapus: string[];
}

/** Kolom yang benar-benar diubah oleh satu entri UbahRisiko. */
export function isianUbah(u: UbahRisiko): Partial<Record<KolomUbah, string>> {
  return Object.fromEntries(KOLOM_UBAH.filter((k) => u[k.key].trim()).map((k) => [k.key, u[k.key].trim()]));
}

export interface KelompokRedundan {
  ids: string[]; jenis: JenisRedundan; alasan: string; saran: string;
  /** Opsi eksekusi saran; kosong pada hasil lama. */
  opsi?: OpsiTindakan[];
  /** Label opsi yang sudah diterapkan. */
  diterapkan?: string;
  /** id risiko yang sebaiknya dipertahankan; "" bila semua tetap dipertahankan dengan pembedaan. */
  pertahankan: string;
  /** Sidik isian tiap anggota saat dinilai. */
  sidik: Record<string, string>;
}
export interface HasilRedundansi { ringkasan: string; kelompok: KelompokRedundan[]; model: string; waktu: string }

const KUNCI = "redundansi-risiko";
export function bacaRedundansi(): HasilRedundansi | null {
  try { const s = localStorage.getItem(KUNCI); return s ? (JSON.parse(s) as HasilRedundansi) : null; } catch { return null; }
}
export function simpanRedundansi(h: HasilRedundansi) {
  try { localStorage.setItem(KUNCI, JSON.stringify(h)); } catch { /* penyimpanan browser tidak tersedia */ }
}
