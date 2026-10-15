"use client";
import { sb, must } from "./supabase";

type Log = (msg: string) => void;

async function insertChunks(table: string, rows: object[], log: Log, size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    must(await sb().from(table).insert(rows.slice(i, i + size)));
    log(`${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}

async function isEmpty(table: string) {
  const r = await sb().from(table).select("*", { count: "exact" }).limit(1);
  if (r.error) throw new Error(`${table}: ${r.error.message}. Pastikan migrasi supabase/migrations/0001_init.sql sudah dijalankan.`);
  return (r.count ?? 0) === 0;
}

/** Isi database dari data kertas kerja Excel & taksonomi (hanya tabel yang masih kosong). */
export async function seedDatabase(log: Log) {
  const kk = (await import("../../seed/kertas-kerja.json")).default as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const params = (await import("../../seed/parameter-seed.json")).default as object[];

  if (await isEmpty("app_settings")) {
    must(await sb().from("app_settings").insert([{ key: "sampul", value: kk.sampul }, { key: "notes", value: kk.notes }]));
    log("app_settings: sampul & catatan");
  }
  if (await isEmpty("kategori_risiko")) await insertChunks("kategori_risiko", kk.kategori, log);
  if (await isEmpty("taksonomi")) {
    log("Memuat taksonomi PTPN Group…");
    const tax = (await import("../../seed/taksonomi.json")).default as object[];
    await insertChunks("taksonomi", tax, log, 100);
  }
  if (await isEmpty("kriteria_dampak")) await insertChunks("kriteria_dampak", kk.kriteria, log);
  if (await isEmpty("risk_driver")) await insertChunks("risk_driver", kk.drivers, log);
  if (await isEmpty("ras")) await insertChunks("ras", kk.ras, log);
  if (await isEmpty("ras_tambahan") && kk.ras_tambahan.length) await insertChunks("ras_tambahan", kk.ras_tambahan, log);
  if (await isEmpty("risk_register")) {
    const tax = (await import("../../seed/taksonomi.json")).default as { kode: string; kategori: string; risiko_korporat: string }[];
    const rows = (kk.register as Record<string, unknown>[]).filter((r) => r.kategori).map((r) => ({
      ...r,
      taksonomi_kode: tax.find((t) => t.kategori === r.kategori && t.risiko_korporat === r.risk_event)?.kode ?? null,
    }));
    await insertChunks("risk_register", rows, log);
  }
  if (await isEmpty("parameter_sheet")) await insertChunks("parameter_sheet", params, log, 4);
  if (await isEmpty("ram_pengendalian")) {
    const rows = (kk.ram as Record<string, unknown>[])
      .filter((r) => r.kode && (r.inisiatif || r.kebijakan || r.program || r.anggaran))
      .map((r) => ({ kode: r.kode, inisiatif: r.inisiatif, kebijakan: r.kebijakan, program: r.program, anggaran: r.anggaran }));
    if (rows.length) await insertChunks("ram_pengendalian", rows, log);
  }
  if (await isEmpty("cat_aksi") && kk.cat.length) {
    await insertChunks("cat_aksi", (kk.cat as object[]).map((r, i) => ({ ...r, urutan: i + 1 })), log);
  }
  log("Selesai ✔");
}
