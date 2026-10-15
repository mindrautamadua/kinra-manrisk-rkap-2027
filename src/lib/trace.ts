import { REKAP } from "./static";
import type { ParameterSheet, RamTambahan } from "./types";
import type { ParamOption } from "@/components/ParamPicker";

/** Daftar parameter RAM (standar, klaster, unik, dan unik tambahan) untuk keterkaitan risiko. */
export function paramOptions(params: ParameterSheet[], tambahan: RamTambahan[]): ParamOption[] {
  return [
    ...REKAP.map((r) => ({
      kode: r.kode, parameter: r.parameter, kategori: r.kategori,
      diterapkan: r.grup === "Parameter Standar" || params.find((p) => p.code === r.kode)?.diterapkan === "Ya",
    })),
    ...tambahan.filter((t) => t.kode).map((t) => ({ kode: t.kode!, parameter: t.parameter ?? "", kategori: t.kategori, diterapkan: true })),
  ];
}
