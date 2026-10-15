import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { UMUM } from "@/lib/isi-ai-prompt";
import { SHEET_AI, TIPE_ANGKA, type BarisAi, type KolomAi, type LembarRequest, type LembarResponse } from "@/lib/sheet-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const BERSAMA = `Format jawaban:
- tabel: untuk setiap tabel, satu objek per baris yang sudah ada (nomor baris sama) ditambah baris baru pada nomor yang disediakan. Baris baru boleh lebih sedikit dari nomor yang disediakan; jangan mengisi baris kosong hanya untuk memenuhi jumlah.
- Baris yang sudah ada: salin nilai yang sudah terisi apa adanya; lengkapi yang kosong.
- Kolom bertipe rp/angka: bilangan, rupiah penuh untuk rp; kolom bersatuan "Rp juta" dalam juta. persen: dalam satuan persen (13,5% ditulis 13.5). tanggal: "YYYY-MM-DD". Kosong = null.
- ATURAN ANGKA: setiap angka dan tanggal hanya boleh berasal dari uraian pengguna, nilai yang sudah ada, konteks, atau hasil hitungan eksplisit dari angka-angka itu. Tidak boleh memakai angka karangan, rata-rata industri, atau perkiraan sendiri. Bila tidak dapat diturunkan, isi null.
- Kolom catatan (bila ada) menjelaskan rumus setiap angka yang Anda hitung, mis. "Biaya lainnya = 10% × nilai pengadaan Rp24.000.000.000 (uraian pengguna)"; bila nominal kosong, sebutkan data yang perlu dihimpun.
- sel: penjelasan_hasil 2-4 kalimat tentang hasil pengukuran (pakai angka hanya dari konteks; bila belum lengkap gunakan "[...]"). rasionalisasi_*: dasar usulan batas dengan merujuk data historis, sikap risiko RAS, dan kemampuan entitas menanggung kerugian; nilai usulan hanya bila ada di konteks, bila tidak "[...]". Sel angka (ebitda, hurdle_entitas) hanya dari uraian pengguna, selain itu null.`;

const USUL = `Baris baru adalah skenario hipotetis: usulkan skenario yang realistis untuk karakter usaha entitas, spesifik, tidak duplikat dengan yang sudah ada, dan relevan dengan risiko terkait di konteks bila ada.`;
const EKSTRAK = `Tabel ini berisi DATA FAKTA. Baris baru HANYA boleh berasal dari entitas (proyek/perkara) yang disebut pengguna di uraian. DILARANG mengarang proyek, perkara, nomor perkara, pihak, nilai, atau tanggal. Bila uraian tidak menyebut entitas baru, jangan tambahkan baris. Untuk baris yang sudah ada, hanya lengkapi dari uraian pengguna.`;

const KHUSUS: Record<string, string> = {
  "5c": `Lembar 5c Rasio Kerugian Operasional: Kegagalan Manusia (Fraud) = (Total potensi kerugian - penggantian dari pelaku) ÷ EBITDA RKAP 2027. Kolom mengikuti Risk.RAM-data.OperasionalRisk template PT DAM v.2. Pencurian oleh pihak luar tidak dihitung.
fraud: area = fungsi/unit, proses = proses bisnis spesifik, beneficiary = Internal (pelaku/penerima manfaat orang dalam) atau External, kejadian = modus fraud spesifik. ${USUL}
Klasifikasi: kenaikan biaya/harga beli akibat fraud masuk biaya_lainnya; kehilangan_pendapatan hanya untuk pendapatan yang tidak diterima (mis. sewa/tarif di bawah ketentuan).`,
  "5d": `Lembar 5d Rasio Kerugian Operasional: Kecelakaan Kerja dan Bencana = (Total potensi kerugian - insurance coverage) ÷ EBITDA RKAP 2027. Probabilitas dicatat sebagai data pendukung, tidak dikalikan.
kecelakaan: area/fungsi rawan kecelakaan kerja (pabrik, workshop, konstruksi, utilitas, transportasi), proses = aktivitas berisiko. bencana: kebakaran, banjir, gempa, longsor, ledakan, kegagalan struktur; untuk entitas klaster Food & Agriculture cuaca ekstrem dikecualikan. aset = aset yang berpotensi terdampak. ${USUL}
Probabilitas hanya dari uraian pengguna; bila tidak ada, null.`,
  "6a": `Lembar 6a Project IRR vs Hurdle Rate = rata-rata IRR proyek ÷ rata-rata Hurdle Rate proyek. IRR diisi dari kajian kelayakan; Hurdle Rate wajib per proyek. Nilai investasi dan proyeksi pendapatan dalam Rp JUTA (bila pengguna menulis rupiah penuh atau miliar, konversikan ke juta dan sebutkan di catatan). ${EKSTRAK}`,
  "6b": `Lembar 6b Schedule Overrun Ratio = durasi rencana ÷ durasi perkiraan (dihitung otomatis dari tanggal). Daftar proyek ditetapkan per 1 Januari 2027. Perkiraan selesai adalah perkiraan terkini pada RKAP 2027; alasan keterlambatan ditulis di catatan. ${EKSTRAK}`,
  "8a": `Lembar 8a Rasio Kerugian Gugatan Hukum = potensi kerugian perkara terbuka ÷ EBITDA RKAP 2027. Potensi kerugian = potensi pembayaran - recovery - cadangan; perkara berstatus Selesai tidak dihitung; tuntutan balik tidak ikut dihitung. Tipe, status, dan lembaga wajib salah satu dari daftar pilihan. ${EKSTRAK}`,
};

const MAX_KONTEKS = 40_000;
const ANGKA = new Set(TIPE_ANGKA);

function skemaKolom(k: KolomAi) {
  if (k.tipe === "pilihan") return { type: "string", enum: ["", ...(k.options ?? [])], description: k.label };
  if (k.tipe === "teks") return { type: "string", description: k.label };
  if (k.tipe === "tanggal") return { type: ["string", "null"], description: `${k.label} (YYYY-MM-DD)` };
  return { type: ["number", "null"], description: `${k.label} (${k.tipe})` };
}

export async function POST(req: Request) {
  let input: LembarRequest;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const cfg = SHEET_AI[input.code];
  if (!cfg || !input.tabel) return NextResponse.json({ error: "Lembar tidak didukung." }, { status: 400 });

  const schema = {
    type: "object", additionalProperties: false, required: ["tabel", "sel", "catatan"],
    properties: {
      tabel: {
        type: "object", additionalProperties: false, required: cfg.tabel.map((t) => t.id),
        properties: Object.fromEntries(cfg.tabel.map((t) => {
          const props = { baris: { type: "integer" }, ...Object.fromEntries(t.kolom.map((k) => [k.key, skemaKolom(k)])) };
          return [t.id, { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(props), properties: props } }];
        })),
      },
      sel: {
        type: "object", additionalProperties: false, required: cfg.sel.map((s) => s.key),
        properties: Object.fromEntries(cfg.sel.map((s) => [s.key, s.tipe === "teks" ? { type: "string", description: s.label } : { type: ["number", "null"], description: `${s.label} (${s.tipe})` }])),
      },
      catatan: { type: "string" },
    },
  };

  const instruksi = input.instruksi?.trim() ?? "";
  const user = [
    `Entitas: ${input.entitas}`,
    `Uraian pengguna: ${instruksi || "(tidak ada; tidak ada angka atau data baru dari pengguna)"}`,
    ...cfg.tabel.map((t) => `Tabel ${t.id} (${t.judul}). Kolom: ${JSON.stringify(t.kolom.map((k) => ({ key: k.key, label: k.label, tipe: k.tipe })))}
Baris yang sudah ada: ${JSON.stringify(input.tabel[t.id]?.ada ?? [])}
Nomor baris untuk baris baru: ${JSON.stringify(input.tabel[t.id]?.barisBaru ?? [])}`),
    `Nilai sel saat ini: ${JSON.stringify(input.sel ?? {})}`,
    `Konteks lembar (JSON): ${JSON.stringify(input.konteks ?? {}).slice(0, MAX_KONTEKS)}`,
  ].join("\n\n");

  const r = await callStructured<Omit<LembarResponse, "model">>({
    system: `${UMUM}\n\n${KHUSUS[cfg.code]}\n\n${BERSAMA}`, user, name: `isi_lembar_${cfg.code}`, schema, effort: "medium",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  // Pengaman di luar prompt: tanpa angka di uraian, angka/tanggal baru pasti karangan model; data fakta tanpa uraian tidak boleh bertambah.
  const adaAngka = /\d/.test(instruksi);
  const tabel: Record<string, BarisAi[]> = {};
  for (const t of cfg.tabel) {
    const ada = input.tabel[t.id]?.ada ?? [];
    const boleh = new Set([...ada.map((b) => b.baris), ...(t.usulBaru || instruksi ? input.tabel[t.id]?.barisBaru ?? [] : [])]);
    tabel[t.id] = (r.data.tabel?.[t.id] ?? []).filter((b) => boleh.has(b.baris)).map((b) => {
      if (adaAngka) return b;
      const lama = ada.find((x) => x.baris === b.baris);
      return { ...b, ...Object.fromEntries(t.kolom.filter((k) => ANGKA.has(k.tipe)).map((k) => [k.key, lama?.[k.key] ?? null])) };
    });
  }
  const sel = Object.fromEntries(cfg.sel.map((s) => [s.key, s.tipe !== "teks" && !adaAngka ? (input.sel?.[s.key] ?? null) : r.data.sel?.[s.key] ?? null]));
  const out: LembarResponse = { tabel, sel, catatan: r.data.catatan, model: r.model };
  return NextResponse.json(out);
}
