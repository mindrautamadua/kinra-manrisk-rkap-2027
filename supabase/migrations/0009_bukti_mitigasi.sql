-- Bukti dukung (evidence) per rencana aksi mitigasi, tindak lanjut challenge session RKAP 2027 (Top Risks).
-- Jalankan di Supabase SQL Editor setelah 0008_target_mitigasi.sql. Aman dijalankan ulang.

-- Tautan atau rujukan dokumen pendukung: TOR, RAB, SK, kontrak, notulen, dsb. Satu baris per dokumen.
alter table mitigasi_aksi add column if not exists bukti text;
