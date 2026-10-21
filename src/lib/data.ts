"use client";
import { sb, must } from "./supabase";
import type { CakupanTopRisk } from "./cakupan-top-risk";
import type { PadananReferensi } from "./referensi";
import type {
  ChallengeLog, MitigasiAksi, ModePresentasi, Snapshot, SnapshotData,
  CatAksi, KategoriRisiko, ProgramStrategis, KriteriaDampak, ParameterSheet, RamPengendalian, RamTambahan, Ras, RasTambahan, RiskDriver,
  RiskRegister, RkapKeuangan, Sampul, SasaranStrategis, Taksonomi,
} from "./types";

// ---------- mode presentasi: kunci semua penulisan kecuali Log Challenge ----------
let readonly = false;
export const setReadonlyFlag = (v: boolean) => { readonly = v; };
const BEBAS_KUNCI = new Set(["challenge_log", "snapshot"]);
function guard(table: string) {
  if (readonly && !BEBAS_KUNCI.has(table)) throw new Error("Mode presentasi aktif: data dikunci. Matikan mode presentasi untuk mengubah.");
}

export const api = {
  async sampul(): Promise<Sampul> {
    const rows = must(await sb().from("app_settings").select("value").eq("key", "sampul"));
    return (rows[0]?.value ?? { nama_entitas: "PT KINRA", versi: "1" }) as Sampul;
  },
  async saveSampul(v: Sampul) {
    guard("app_settings");
    must(await sb().from("app_settings").upsert({ key: "sampul", value: v, updated_at: new Date().toISOString() }));
  },
  /** Keputusan manual daftar periksa cakupan Top Risk (lembar Risiko Utama). */
  async cakupanTopRisk(): Promise<CakupanTopRisk> {
    const rows = must(await sb().from("app_settings").select("value").eq("key", "cakupan_top_risk"));
    return (rows[0]?.value ?? {}) as CakupanTopRisk;
  },
  async saveCakupanTopRisk(v: CakupanTopRisk) {
    guard("app_settings");
    must(await sb().from("app_settings").upsert({ key: "cakupan_top_risk", value: v, updated_at: new Date().toISOString() }));
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
  sasaran: async () => must(await sb().from("sasaran_strategis").select("*").order("urutan")) as SasaranStrategis[],
  /** Pemetaan manual risiko di dokumen referensi (RJPP/DKMR) ke Risk Register (lembar Referensi Strategis). */
  async padananReferensi(): Promise<PadananReferensi> {
    const rows = must(await sb().from("app_settings").select("value").eq("key", "padanan_referensi"));
    return (rows[0]?.value ?? {}) as PadananReferensi;
  },
  async savePadananReferensi(v: PadananReferensi) {
    guard("app_settings");
    must(await sb().from("app_settings").upsert({ key: "padanan_referensi", value: v, updated_at: new Date().toISOString() }));
  },
  program: async () => must(await sb().from("program_strategis").select("*").order("urutan")) as ProgramStrategis[],
  /** null bila migrasi 0008 belum dijalankan. */
  mitigasiAksi: async () => {
    const r = await sb().from("mitigasi_aksi").select("*").order("urutan");
    return r.error ? null : (r.data as MitigasiAksi[]);
  },
  rkapList: async () => must(await sb().from("rkap_keuangan").select("*").order("created_at", { ascending: false })) as RkapKeuangan[],
  rkapAktif: async () => (must(await sb().from("rkap_keuangan").select("*").eq("aktif", true)) as RkapKeuangan[])[0] ?? null,
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
    guard(table);
    must(await sb().from(table).update(patch as Record<string, unknown>).eq(key, id));
  },
  async insert<T extends object>(table: string, row: Partial<T>) {
    guard(table);
    return (must(await sb().from(table).insert(row as Record<string, unknown>).select()) as T[])[0];
  },
  async remove(table: string, key: string, id: string | number) {
    guard(table);
    must(await sb().from(table).delete().eq(key, id));
  },
  async upsert<T extends object>(table: string, row: Partial<T>) {
    guard(table);
    must(await sb().from(table).upsert(row as Record<string, unknown>));
  },
};

export const challengeApi = {
  list: async () => must(await sb().from("challenge_log").select("*").order("created_at", { ascending: false })) as ChallengeLog[],
  add: async (row: Partial<ChallengeLog>) => (must(await sb().from("challenge_log").insert(row).select()) as ChallengeLog[])[0],
  update: async (id: string, patch: Partial<ChallengeLog>) => { must(await sb().from("challenge_log").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)); },
  remove: async (id: string) => { must(await sb().from("challenge_log").delete().eq("id", id)); },
};

export const snapshotApi = {
  list: async () => must(await sb().from("snapshot").select("id,created_at,nama,catatan").order("created_at", { ascending: false })) as Snapshot[],
  get: async (id: string) => (must(await sb().from("snapshot").select("*").eq("id", id)) as Snapshot[])[0],
  add: async (nama: string, catatan: string | null, data: SnapshotData) =>
    (must(await sb().from("snapshot").insert({ nama, catatan, data }).select("id,created_at,nama,catatan")) as Snapshot[])[0],
  remove: async (id: string) => { must(await sb().from("snapshot").delete().eq("id", id)); },
};

export const modeApi = {
  async get(): Promise<ModePresentasi> {
    const rows = must(await sb().from("app_settings").select("value").eq("key", "presentasi"));
    return (rows[0]?.value ?? { aktif: false }) as ModePresentasi;
  },
  async set(v: ModePresentasi) {
    must(await sb().from("app_settings").upsert({ key: "presentasi", value: v, updated_at: new Date().toISOString() }));
  },
};

/** Seluruh data yang dibekukan pada snapshot. */
export async function captureSnapshot(): Promise<SnapshotData> {
  const [sampul, ras, ras_tambahan, register, params, pengendalian, ram_tambahan, cat, aksi] = await Promise.all([
    api.sampul(), api.ras(), api.rasTambahan(), api.register(), api.params(), api.pengendalian(), api.ramTambahan(), api.cat(), api.mitigasiAksi(),
  ]);
  return {
    sampul, ras, ras_tambahan, register, pengendalian, ram_tambahan, cat, ...(aksi ? { mitigasi_aksi: aksi } : {}),
    params: params.map(({ code, diterapkan, summary, inputs }) => ({ code, diterapkan, summary, inputs })),
  };
}

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
