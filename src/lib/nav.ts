import { REKAP } from "./static";

export const SHEETS = [
  { href: "/sampul", label: "Sampul" },
  { href: "/petunjuk", label: "Petunjuk" },
  { href: "/data-keuangan", label: "Data Keuangan" },
  { href: "/ras", label: "RAS" },
  { href: "/kriteria-dampak", label: "Kriteria Dampak" },
  { href: "/risk-driver", label: "Risk Driver" },
  { href: "/risk-register", label: "Risk Register" },
  { href: "/risiko-utama", label: "Risiko Utama" },
  { href: "/ram", label: "RAM" },
  { href: "/cat", label: "CAT" },
  { href: "/rekap", label: "Rekap" },
  { href: "/program-strategis", label: "Program Strategis" },
  { href: "/executive-summary", label: "Executive Summary" },
  ...REKAP.map((r) => ({ href: `/parameter/${r.kode}`, label: r.kode })),
];
