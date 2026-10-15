"use client";
import { sb, must } from "./supabase";
import type {
  CatAksi, KategoriRisiko, KriteriaDampak, ParameterSheet, RamPengendalian, RamTambahan, Ras, RasTambahan, RiskDriver,
  RiskRegister, Sampul, Taksonomi,
} from "./types";

export const api = {
  async sampul(): Promise<Sampul> {
    const rows = must(await sb().from("app_settings").select("value").eq("key", "sampul"));
    return (rows[0]?.value ?? { nama_entitas: "PT KINRA", versi: "1" }) as Sampul;
  },
  async saveSampul(v: Sampul) {
    must(await sb().from("app_settings").upsert({ key: "sampul", value: v, updated_at: new Date().toISOString() }));
  },
  kategori: async () => must(await sb().from("kategori_risiko").select("*").order("no")) as KategoriRisiko[],
  kriteria: async () => must(await sb().from("kriteria_dampak").select("*").order("id")) as KriteriaDampak[],
  drivers: async () => must(await sb().from("risk_driver").select("*").order("id")) as RiskDriver[],
  ras: async () => must(await sb().from("ras").select("*").order("id")) as Ras[],
  rasTambahan: async () => must(await sb().from("ras_tambahan").select("*").order("id")) as RasTambahan[],
  register: async () => must(await sb().from("risk_register").select("*").order("urutan")) as RiskRegister[],
  params: async () => must(await sb().from("parameter_sheet").select("*").order("urutan")) as ParameterSheet[],
  param: async (code: string) => (must(await sb().from("parameter_sheet").select("*").eq("code", code)) as ParameterSheet[])[0],
  pengendalian: async () => must(await sb().from("ram_pengendalian").select("*")) as RamPengendalian[],
  ramTambahan: async () => must(await sb().from("ram_tambahan").select("*").order("kategori")) as RamTambahan[],
  cat: async () => must(await sb().from("cat_aksi").select("*").order("urutan")) as CatAksi[],
  async taksonomi(): Promise<Taksonomi[]> {
    const out: Taksonomi[] = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await sb().from("taksonomi").select("*").order("kode").range(from, from + 999)) as Taksonomi[];
      out.push(...page);
      if (page.length < 1000) break;
    }
    return out;
  },

  async update<T extends object>(table: string, key: string, id: string | number, patch: Partial<T>) {
    must(await sb().from(table).update(patch as Record<string, unknown>).eq(key, id));
  },
  async insert<T extends object>(table: string, row: Partial<T>) {
    return (must(await sb().from(table).insert(row as Record<string, unknown>).select()) as T[])[0];
  },
  async remove(table: string, key: string, id: string | number) {
    must(await sb().from(table).delete().eq(key, id));
  },
  async upsert<T extends object>(table: string, row: Partial<T>) {
    must(await sb().from(table).upsert(row as Record<string, unknown>));
  },
};

/** Status inisialisasi database. */
export async function dbStatus() {
  const tables = ["kategori_risiko", "taksonomi", "kriteria_dampak", "risk_driver", "ras", "risk_register", "parameter_sheet"];
  const out: Record<string, number | string> = {};
  for (const t of tables) {
    const r = await sb().from(t).select("*", { count: "exact", head: true });
    out[t] = r.error ? `error: ${r.error.message}` : r.count ?? 0;
  }
  return out;
}
