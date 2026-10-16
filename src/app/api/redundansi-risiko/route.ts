import { NextResponse } from "next/server";
import { callStructured } from "@/lib/openai";
import { PROFIL_KINRA } from "@/lib/isi-ai-prompt";
import { JENIS_REDUNDAN, KOLOM_UBAH, type OpsiTindakan, type HasilRedundansi, type KelompokRedundan, type RedundansiRequest } from "@/lib/redundansi-risiko";

export const runtime = "nodejs";
export const maxDuration = 180;

const SYSTEM = `Anda reviewer senior manajemen risiko (Lini 2) di PTPN III (Persero) yang menguji REDUNDANSI Risk Register RKAP 2027 milik PT KINRA sebelum challenge session.

${PROFIL_KINRA}

Tugas: temukan kelompok Risk Event yang redundan, yaitu menggambarkan peristiwa risiko yang sama atau saling menumpuk sehingga register menghitung eksposur dua kali, memecah kepemilikan risiko, atau mengaburkan prioritas.

Jenis kelompok:
- "Duplikat": peristiwa, penyebab utama, dan dampaknya pada dasarnya sama walaupun kata-katanya berbeda atau kategori taksonominya berbeda. Sebaiknya digabung menjadi satu risiko.
- "Tumpang tindih": peristiwanya berbeda, tetapi cakupannya beririsan besar (penyebab, segmen/fasilitas, atau dampak finansial yang sama) sehingga perlu dipertegas batasnya atau digabung.
- "Sebab-akibat": satu risiko sebenarnya adalah root cause atau dampak dari risiko lain di register, sehingga lebih tepat dijadikan root cause/deskripsi dampak risiko tersebut, bukan risk event tersendiri.

Aturan:
- Nilai berdasarkan makna peristiwa risiko, root cause, dan deskripsi dampak, bukan kemiripan kata semata. Kesamaan kategori atau Risk Driver saja BUKAN redundansi.
- Risiko yang hanya sama segmennya tetapi peristiwanya jelas berbeda (mis. gangguan pasokan air baku vs. piutang tenant air bersih) TIDAK redundan.
- ids: 2 atau lebih id risiko dalam satu kelompok. Satu risiko boleh muncul di lebih dari satu kelompok hanya bila jenisnya berbeda.
- alasan: 1-2 kalimat, sebut nomor risiko (#n) dan bagian yang sama secara konkret.
- saran: 1-2 kalimat tindakan konkret: risiko mana yang dipertahankan, apa yang dipindahkan (root cause/dampak/mitigasi) dari risiko lain, atau batas cakupan masing-masing.
- pertahankan: id risiko yang sebaiknya dipertahankan (uraian paling lengkap dan paling sesuai konteks KINRA) untuk "Duplikat" dan "Sebab-akibat"; "" bila semua tetap dipertahankan dengan pembedaan.
- opsi: 1-2 opsi tindakan yang bisa langsung dieksekusi ke register, sesuai saran. Pola yang dipakai:
  * "Pertegas batas": tulis ulang deskripsi (dan bila perlu root_cause/deskripsi_dampak) setiap anggota agar cakupannya tidak beririsan; hapus = [].
  * "Gabungkan ke #n": risiko yang dipertahankan menerima gabungan deskripsi, root_cause, deskripsi_dampak, existing_control, dan rencana_mitigasi dari anggota lain (tanpa kehilangan informasi penting, tanpa pengulangan); anggota lain masuk hapus.
  * "Jadikan root cause/dampak #n" (untuk Sebab-akibat): pindahkan peristiwa risiko penyebab ke root_cause (atau akibat ke deskripsi_dampak) risiko yang dipertahankan, lalu hapus risiko tersebut.
  label: nama singkat opsi dengan nomor risiko (#n). penjelasan: 1 kalimat akibat eksekusinya.
  ubah: satu entri per risiko yang isiannya berubah. Setiap kolom berisi TEKS LENGKAP PENGGANTI isian lama (bukan tambahan/selisih), gaya penulisan sama dengan isian register; isi "" bila kolom itu tidak diubah. Jangan masukkan risiko yang dihapus ke ubah.
  hapus: id risiko yang dihapus; minimal satu anggota kelompok harus tetap ada.
- ringkasan: 1-3 kalimat kesimpulan tingkat register. Bila tidak ada redundansi, kelompok = [] dan katakan register sudah bebas redundansi.
- Jangan mengarang kelompok demi terlihat ada temuan. Bahasa Indonesia formal, ringkas. Maksimal 12 kelompok, urutkan dari yang paling jelas redundan.`;

export async function POST(req: Request) {
  let d: RedundansiRequest;
  try { d = await req.json(); } catch { return NextResponse.json({ error: "Data tidak valid." }, { status: 400 }); }
  const risiko = (d?.risiko ?? []).filter((r) => r.id && r.risk_event);
  if (risiko.length < 2) return NextResponse.json({ error: "Minimal dua risiko berisi Risk Event untuk diperiksa." }, { status: 400 });

  const ids = risiko.map((r) => r.id);
  const schema = {
    type: "object", additionalProperties: false, required: ["ringkasan", "kelompok"],
    properties: {
      ringkasan: { type: "string" },
      kelompok: {
        type: "array",
        items: {
          type: "object", additionalProperties: false, required: ["ids", "jenis", "alasan", "saran", "pertahankan", "opsi"],
          properties: {
            ids: { type: "array", items: { type: "string", enum: ids } },
            jenis: { type: "string", enum: [...JENIS_REDUNDAN] },
            alasan: { type: "string" },
            saran: { type: "string" },
            pertahankan: { type: "string", enum: [...ids, ""] },
            opsi: {
              type: "array",
              items: {
                type: "object", additionalProperties: false, required: ["label", "penjelasan", "ubah", "hapus"],
                properties: {
                  label: { type: "string" },
                  penjelasan: { type: "string" },
                  ubah: {
                    type: "array",
                    items: {
                      type: "object", additionalProperties: false, required: ["id", ...KOLOM_UBAH.map((k) => k.key)],
                      properties: { id: { type: "string", enum: ids }, ...Object.fromEntries(KOLOM_UBAH.map((k) => [k.key, { type: "string" }])) },
                    },
                  },
                  hapus: { type: "array", items: { type: "string", enum: ids } },
                },
              },
            },
          },
        },
      },
    },
  };

  const user = `Entitas: ${d.entitas}\n\nRisk Register (JSON): ${JSON.stringify(risiko, (k, v) => (k === "sidik" ? undefined : v))}`;
  const r = await callStructured<{ ringkasan: string; kelompok: (Omit<KelompokRedundan, "sidik" | "opsi" | "diterapkan"> & { opsi: OpsiTindakan[] })[] }>({
    system: SYSTEM, user, name: "redundansi_risiko", schema, effort: "medium",
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const sidik = new Map(risiko.map((x) => [x.id, x.sidik]));
  const kelompok: KelompokRedundan[] = r.data.kelompok
    .map((k) => ({ ...k, ids: [...new Set(k.ids.filter((id) => sidik.has(id)))] }))
    .filter((k) => k.ids.length >= 2)
    .map((k) => ({
      ...k, pertahankan: k.ids.includes(k.pertahankan) ? k.pertahankan : "",
      opsi: rapikanOpsi(k.opsi, k.ids),
      sidik: Object.fromEntries(k.ids.map((id) => [id, sidik.get(id)!])),
    }))
    .slice(0, 12);
  const out: HasilRedundansi = { ringkasan: r.data.ringkasan, kelompok, model: r.model, waktu: new Date().toISOString() };
  return NextResponse.json(out);
}

/** Batasi opsi pada anggota kelompok, buang entri kosong, dan pastikan minimal satu anggota tetap ada. */
function rapikanOpsi(opsi: OpsiTindakan[], ids: string[]): OpsiTindakan[] {
  return opsi
    .map((o) => {
      const hapus = [...new Set(o.hapus.filter((id) => ids.includes(id)))];
      const ubah = o.ubah.filter((u) => ids.includes(u.id) && !hapus.includes(u.id) && KOLOM_UBAH.some((k) => u[k.key].trim()));
      return { ...o, hapus, ubah };
    })
    .filter((o) => o.hapus.length < ids.length && (o.ubah.length > 0 || o.hapus.length > 0))
    .slice(0, 2);
}
