import { isTopRisk } from "./format";
import type { RiskRegister } from "./types";

/** Topik risiko yang wajib ditelaah masuk Top Risks (Catatan Challenge Session RKAP 2027, bagian 3). */
export interface TopikCakupan {
  id: string; label: string; telaah: string;
  /** Pola pada judul risk event untuk deteksi awal (deskripsi/root cause tidak dipakai agar tidak terlalu longgar). */
  pola: RegExp;
  /** Seluruh risiko pada kategori ini otomatis dianggap cocok. */
  kategori?: string[];
  /** Pola teks hanya berlaku untuk risiko pada kategori ini. */
  wajibKategori?: string[];
  /** Parameter RAM yang semestinya tertaut ke risiko topik ini. */
  parameter?: string;
}

export const TOPIK_CAKUPAN: TopikCakupan[] = [
  { id: "pasar", label: "Risiko Pasar (market risk)", telaah: "Relevansi risk event dan risk driver pasar terhadap kegiatan usaha PT KINRA.",
    pola: /(risiko pasar|market risk|harga komoditas|nilai tukar|\bkurs\b|suku bunga)/i, kategori: ["Risiko Pasar"] },
  { id: "likuiditas", label: "Risiko Likuiditas", telaah: "Konsistensi dengan parameter Operating Cash Flow Ratio (3b) di RAM.",
    pola: /(likuid|arus kas|cash ?flow|kekurangan kas|kas operasi)/i, parameter: "3b" },
  { id: "jasa", label: "Penyediaan Jasa (Risiko Operasional)", telaah: "Risiko penyediaan jasa kawasan (air bersih, listrik, limbah, layanan tenant) bila material.",
    pola: /(jasa|layanan|pelayanan|\bSLA\b|pasokan (air|listrik|gas|uap)|gangguan (air|listrik|utilitas)|utilitas)/i, wajibKategori: ["Risiko Operasional"] },
  { id: "investasi", label: "Keterlambatan Pelaksanaan Investasi", telaah: "Dampak keterlambatan terhadap target dan jadwal investasi.",
    pola: /(terlambat|keterlambatan|delay|mundur|overrun).*(investasi|proyek|pembangunan|konstruksi)|(investasi|proyek|pembangunan|konstruksi).*(terlambat|keterlambatan|delay|mundur|overrun)/i },
  { id: "fraud", label: "Fraud", telaah: "Kecurangan, korupsi, suap, penyalahgunaan wewenang.",
    pola: /(fraud|kecurangan|korupsi|gratifikasi|suap|persekongkolan|penyalahgunaan|penggelapan)/i },
  { id: "esg", label: "Environmental, Social, and Governance (ESG)", telaah: "Isu lingkungan, sosial kemasyarakatan, dan tata kelola keberlanjutan.",
    pola: /(\bESG\b|lingkungan|sosial|keberlanjutan|sustainab|emisi|pencemaran|masyarakat)/i },
  { id: "pdp_cyber", label: "Perlindungan Data Pribadi & Keamanan Siber (PDP/Cyber)", telaah: "Serangan siber, kebocoran data, kepatuhan UU PDP.",
    pola: /(siber|cyber|data pribadi|\bPDP\b|keamanan informasi|peretas|ransomware|kebocoran data)/i },
];

/** Keputusan manual per topik, disimpan di app_settings (key "cakupan_top_risk"). */
export interface KeputusanTopik {
  /** Risiko yang dipilih manual sebagai penutup topik; menggantikan deteksi otomatis bila ada. */
  risk_ids?: string[];
  tidak_material?: boolean;
  alasan?: string;
}
export type CakupanTopRisk = Record<string, KeputusanTopik>;

export type StatusCakupan = "Tercakup" | "Tidak material" | "Belum Top Risk" | "Belum ada";

export interface HasilCakupan {
  topik: TopikCakupan; status: StatusCakupan; manual: boolean;
  /** Risiko utama penutup topik (manual atau terdeteksi). */
  top: RiskRegister[];
  /** Risiko di Risk Register yang cocok tetapi kategori dampaknya di bawah Moderat. */
  lain: RiskRegister[];
  catatan: string[];
}

function cocok(t: TopikCakupan, r: RiskRegister) {
  if (!r.risk_event) return false;
  const kat = r.kategori ?? "";
  if (t.kategori?.includes(kat)) return true;
  if (t.wajibKategori && !t.wajibKategori.includes(kat)) return false;
  return t.pola.test(r.risk_event);
}

export function nilaiCakupan(register: RiskRegister[], keputusan: CakupanTopRisk): HasilCakupan[] {
  return TOPIK_CAKUPAN.map((t) => {
    const k = keputusan[t.id] ?? {};
    const manualIds = (k.risk_ids ?? []).filter((id) => register.some((r) => r.id === id));
    const manual = manualIds.length > 0;
    const kandidat = manual ? register.filter((r) => manualIds.includes(r.id)) : register.filter((r) => cocok(t, r));
    const top = kandidat.filter((r) => isTopRisk(r.kategori_dampak));
    const lain = kandidat.filter((r) => !isTopRisk(r.kategori_dampak));
    const status: StatusCakupan = k.tidak_material ? "Tidak material" : top.length ? "Tercakup" : lain.length ? "Belum Top Risk" : "Belum ada";
    const catatan: string[] = [];
    if (k.tidak_material && !k.alasan?.trim()) catatan.push("Alasan tidak material belum diisi.");
    if (t.parameter && top.length && !top.some((r) => (r.parameter_ram ?? []).includes(t.parameter!))) {
      catatan.push(`Belum ada risiko utama topik ini yang tertaut ke parameter ${t.parameter} di RAM.`);
    }
    return { topik: t, status, manual, top, lain, catatan };
  });
}
