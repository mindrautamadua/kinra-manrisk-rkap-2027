// Unggah dokumen referensi strategis ke Supabase Storage (bucket privat "referensi"):
// PDF asli, ringkasan terstruktur, dan transkrip per halaman. Dokumen berlabel rahasia sehingga
// sumbernya disimpan di folder referensi-lokal/ (di-gitignore), bukan di repo.
//
// Jalankan setiap kali PDF atau transkrip diperbarui:
//   node --env-file=.env.local scripts/referensi-unggah.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "referensi";
const DIR = "referensi-lokal";
const PDF = {
  "renstra.pdf": "Rencana strategis pengembangan kawasan 2026–2030, termasuk target pengembangan lahan, occupancy, nilai capex, tenant, dan milestone utama.pdf",
  "dkmr.pdf": "Presentasi DKMR RKAP 2027_PT KINRA.pdf",
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib ada (jalankan dengan --env-file=.env.local).");
const sb = createClient(url, key, { auth: { persistSession: false } });

// ---------- transkrip markdown → JSON per halaman ----------
// Transkrip Renstra tidak menandai seksi per halaman; seksi diambil dari halaman pembatas bab.
const BAB_RENSTRA = [
  [1, "Bab I Latar Belakang"], [25, "Bab II Aspirasi 2030"], [30, "Bab III Strategi & Sasaran"],
  [45, "Bab IV Program & Inisiatif"], [51, "Bab V Roadmap & Keuangan"], [77, "Manajemen Risiko"], [82, "Penutup"],
];
const babRenstra = (hal) => BAB_RENSTRA.filter(([h]) => hal >= h).at(-1)[1];

const halaman = [];
for (const dok of ["renstra", "dkmr"]) {
  const parts = readFileSync(`${DIR}/${dok}.md`, "utf8").split(/^## Hal /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const head = p.slice(0, nl).trim();
    const m = head.match(/^(\d+)\s*[—-]\s*(.*?)(?:\s*\[([^\]]+)\])?$/);
    if (!m) throw new Error(`Judul halaman tidak dikenali di ${dok}.md: ${head}`);
    halaman.push({ dok, hal: Number(m[1]), judul: m[2].trim(), seksi: m[3] ?? (dok === "renstra" ? babRenstra(Number(m[1])) : null), isi: p.slice(nl + 1).trim() });
  }
}

// ---------- unggah ----------
const { data: buckets, error: eList } = await sb.storage.listBuckets();
if (eList) throw eList;
if (!buckets.some((b) => b.name === BUCKET)) {
  const { error } = await sb.storage.createBucket(BUCKET, { public: false });
  if (error) throw error;
  console.log(`Bucket privat "${BUCKET}" dibuat.`);
}

const files = [
  ["referensi-halaman.json", Buffer.from(JSON.stringify(halaman)), "application/json"],
  ["referensi-strategis.json", readFileSync(`${DIR}/referensi-strategis.json`), "application/json"],
  ...Object.entries(PDF).map(([nama, src]) => [nama, readFileSync(src), "application/pdf"]),
];
for (const [nama, body, contentType] of files) {
  const { error } = await sb.storage.from(BUCKET).upload(nama, body, { contentType, upsert: true });
  if (error) throw new Error(`${nama}: ${error.message}`);
  console.log(`✓ ${nama} (${(body.length / 1e6).toFixed(2)} MB)`);
}
console.log(`${halaman.length} halaman transkrip diunggah.`);
