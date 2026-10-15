# Perencanaan Manajemen Risiko RKAP 2027 — PT KINRA

Aplikasi Next.js + Supabase yang mengikuti model **Kertas Kerja Bantu Perencanaan Manajemen Risiko RKAP 2027** (template PT DAM v.2) dengan master **Taksonomi Risiko PTPN Group**. Tanpa login.

## Menjalankan

1. Jalankan `supabase/migrations/0001_init.sql` lalu `0002_challenge_session.sql` di Supabase Dashboard › SQL Editor.
2. Isi `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://llwikeclckwhsamenjmx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
   ```
3. `npm install && npm run dev`, buka http://localhost:3000/setup, klik **Isi Data Awal**.

## Isi aplikasi (mengikuti lembar Excel)

| Lembar | Halaman |
| --- | --- |
| Sampul, Petunjuk | `/sampul`, `/petunjuk` |
| RAS | `/ras` — sikap & pernyataan selera risiko, pemeriksaan otomatis terhadap sikap Induk |
| Kriteria Dampak, Risk Driver | `/kriteria-dampak`, `/risk-driver` |
| Risk Register | `/risk-register` — Risk Event dipilih dari Taksonomi PTPN Group (T3) |
| Risiko Utama | `/risiko-utama` — otomatis dari kategori dampak Moderat ke atas |
| RAM, Rekap, CAT | `/ram`, `/rekap`, `/cat` |
| 1a … U10 | `/parameter/[kode]` — lembar Excel asli (sel, merge, warna, rumus) dihitung ulang langsung oleh HyperFormula |

## Fitur challenge session

| Halaman | Fungsi |
| --- | --- |
| `/kesiapan` | Pemeriksaan otomatis: parameter K/O/M tanpa pengendalian, risiko duplikat, kolom wajib kosong, kategori dampak tidak wajar, RAS, keterkaitan, dll. |
| `/challenge` | Log masukan challenger (PIC, tenggat, status) + ekspor notulen. Tombol **Catat Masukan** tersedia di setiap halaman dan otomatis merujuk halaman yang sedang dibuka. |
| `/keterkaitan` | Matriks Risk Register × parameter RAM; kolom *Parameter RAM Terkait* juga ada di Risk Register. |
| `/snapshot` | Bekukan versi data dan bandingkan dengan kondisi terkini. |
| Tombol **Mode Presentasi** (header) | Mengunci semua isian di semua layar; Log Challenge & snapshot tetap bisa dipakai. |

## Data

- `seed/` dan `public/templates/` dihasilkan dari file Excel oleh `scripts/extract_excel.py`:
  ```
  python3 scripts/extract_excel.py "<kertas kerja>.xlsx" "Taksonomi Risiko PTPN Group.xlsx" seed
  mv seed/sheets/*.json public/templates/ && rmdir seed/sheets
  ```
- Isian sel kuning tiap lembar parameter disimpan di tabel `parameter_sheet.inputs`; ringkasan hasil/status di `parameter_sheet.summary` (dipakai Rekap, RAM, Dashboard).

> Keamanan: karena tanpa login, policy RLS membuka baca/tulis untuk siapa pun yang memegang anon key. Gunakan di jaringan internal atau tambahkan autentikasi sebelum dipublikasikan.
