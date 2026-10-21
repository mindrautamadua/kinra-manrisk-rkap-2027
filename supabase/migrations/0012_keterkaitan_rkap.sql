-- Keterkaitan risiko dengan RKAP 2027 (arahan surat tindak lanjut Challenge Session butir 2a):
-- proses bisnis, pos/target keuangan RKAP yang terdampak, serta program kerja/asumsi RKAP terkait.
-- Jalankan di Supabase SQL Editor setelah 0011. Aman dijalankan ulang.
alter table risk_register add column if not exists proses_bisnis text[] not null default '{}';
-- Kode pos laba rugi pada Data Keuangan RKAP (mis. pendapatan_listrik, ebitda_holding).
alter table risk_register add column if not exists pos_rkap text[] not null default '{}';
alter table risk_register add column if not exists program_kerja_rkap text;
