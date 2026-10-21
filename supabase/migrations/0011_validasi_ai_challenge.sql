-- Hasil Validasi AI terakhir per masukan challenge session. Status "Selesai" hanya diberikan server
-- (route /api/validasi-challenge) bila putusan AI "terpenuhi", atau lewat konfirmasi manual bila putusan
-- "verifikasi_manual". Jalankan di Supabase SQL Editor setelah 0010. Aman dijalankan ulang.
-- Isi: { "putusan": "terpenuhi|belum|verifikasi_manual", "alasan": "...", "kekurangan": "...", "model": "...", "waktu": "ISO" }
alter table challenge_log add column if not exists validasi_ai jsonb;
