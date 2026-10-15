// Seed database Supabase dari seed/*.json (hanya tabel yang masih kosong).
// Jalankan: node --env-file=.env.local scripts/seed.mjs
// Butuh migrasi supabase/migrations/0001_init.sql sudah dijalankan.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi");
const sb = createClient(url, key, { auth: { persistSession: false } });

const load = (f) => JSON.parse(readFileSync(new URL(`../seed/${f}`, import.meta.url), "utf8"));
const kk = load("kertas-kerja.json");
const params = load("parameter-seed.json");
const tax = load("taksonomi.json");

function must(res, table) {
  if (res.error) throw new Error(`${table}: ${res.error.message}`);
  return res.data;
}
async function insertChunks(table, rows, size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    must(await sb.from(table).insert(rows.slice(i, i + size)), table);
    console.log(`${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
  }
}
async function isEmpty(table) {
  const r = await sb.from(table).select("*", { count: "exact" }).limit(1);
  if (r.error) throw new Error(`${table}: ${r.error.message}. Pastikan migrasi 0001_init.sql sudah dijalankan.`);
  return (r.count ?? 0) === 0;
}

if (await isEmpty("app_settings")) {
  must(await sb.from("app_settings").insert([{ key: "sampul", value: kk.sampul }, { key: "notes", value: kk.notes }]), "app_settings");
  console.log("app_settings: sampul & catatan");
}
if (await isEmpty("kategori_risiko")) await insertChunks("kategori_risiko", kk.kategori);
if (await isEmpty("taksonomi")) await insertChunks("taksonomi", tax, 100);
if (await isEmpty("kriteria_dampak")) await insertChunks("kriteria_dampak", kk.kriteria);
if (await isEmpty("risk_driver")) await insertChunks("risk_driver", kk.drivers);
if (await isEmpty("ras")) await insertChunks("ras", kk.ras);
if ((await isEmpty("ras_tambahan")) && kk.ras_tambahan.length) await insertChunks("ras_tambahan", kk.ras_tambahan);
if (await isEmpty("risk_register")) {
  const rows = kk.register.filter((r) => r.kategori).map((r) => ({
    ...r,
    taksonomi_kode: tax.find((t) => t.kategori === r.kategori && t.risiko_korporat === r.risk_event)?.kode ?? null,
  }));
  await insertChunks("risk_register", rows);
}
if (await isEmpty("parameter_sheet")) await insertChunks("parameter_sheet", params, 4);
if (await isEmpty("ram_pengendalian")) {
  const rows = kk.ram
    .filter((r) => r.kode && (r.inisiatif || r.kebijakan || r.program || r.anggaran))
    .map((r) => ({ kode: r.kode, inisiatif: r.inisiatif, kebijakan: r.kebijakan, program: r.program, anggaran: r.anggaran }));
  if (rows.length) await insertChunks("ram_pengendalian", rows);
}
if ((await isEmpty("cat_aksi")) && kk.cat.length) await insertChunks("cat_aksi", kk.cat.map((r, i) => ({ ...r, urutan: i + 1 })));
console.log("Selesai ✔");
