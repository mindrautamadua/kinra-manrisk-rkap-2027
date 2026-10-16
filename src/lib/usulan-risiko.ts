/** Kontrak permintaan/hasil usulan Risk Event baru oleh AI. */
export interface KandidatTaksonomi { kode: string; kategori: string; aspek: string; risiko_korporat: string; definisi: string }
export interface UsulanRisikoRequest {
  entitas: string;
  instruksi: string;
  /** Risiko korporat taksonomi yang BELUM ada di register. */
  kandidat: KandidatTaksonomi[];
  sasaran: { kode: string; pilar: string; nama: string; target: string | null }[];
  /** Ringkasan RKAP 2027: pos keuangan kunci dan program strategis. */
  rkap: Record<string, unknown>;
  /** Risk event yang sudah ada di register, agar tidak diusulkan ulang. */
  register: { risk_event: string | null; root_cause: string | null }[];
  /** Tema risiko material KINRA yang belum tercakup, dari hasil Cek Relevansi AI terakhir. */
  celah: { tema: string; alasan: string }[];
}
export interface UsulanRisiko {
  kode: string; deskripsi: string; root_cause: string; deskripsi_dampak: string; sasaran: string[]; alasan: string;
}
export interface UsulanRisikoResponse { usulan: UsulanRisiko[]; catatan: string; model: string }
