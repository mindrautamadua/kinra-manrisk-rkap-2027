# Perencanaan Manajemen Risiko RKAP 2027 — PT KINRA

Aplikasi Next.js + Supabase yang mengikuti model **Kertas Kerja Bantu Perencanaan Manajemen Risiko RKAP 2027** (template PT DAM v.2) dengan master **Taksonomi Risiko PTPN Group**. Akses wajib login (tabel `app_user`).

## Menjalankan

1. Jalankan `supabase/migrations/0001_init.sql`, `0002_challenge_session.sql`, lalu `0003_login.sql` di Supabase Dashboard › SQL Editor.
2. Isi `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://llwikeclckwhsamenjmx.supabase.co
   SUPABASE_SECRET_KEY=<secret / service_role key — server saja>
   AUTH_SECRET=<openssl rand -base64 48>
   ```
   Di Vercel, isi variabel yang sama di Project Settings › Environment Variables.
   Buat akun: `node scripts/buat-user.mjs admin "Nama Admin"`, lalu jalankan SQL yang dicetak di SQL Editor.
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

> Keamanan: login memakai tabel `app_user` (password di-hash scrypt, akun terkunci 15 menit setelah 5 kali gagal, sesi cookie httpOnly bertanda tangan HMAC berlaku 8 jam). Browser tidak mengakses tabel langsung: semua query lewat `/api/db` yang memeriksa sesi lalu memakai secret key di server. Akses anon ke tabel ditutup oleh `0003_login.sql`.
