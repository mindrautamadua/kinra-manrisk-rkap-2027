-- Kolom tambahan untuk menjawab arahan surat tindak lanjut Challenge Session RKAP 2027.
-- Jalankan di Supabase SQL Editor setelah 0009_bukti_mitigasi.sql. Aman dijalankan ulang.

-- 2f: dasar penetapan probabilitas dan dampak (data historis, proyeksi RKAP 2027, analisis skenario).
alter table risk_register add column if not exists dasar_penilaian text;

-- 6f: justifikasi parameter RAM yang dinyatakan tidak diterapkan.
alter table parameter_sheet add column if not exists alasan_tidak_diterapkan text;

-- 5e: indikator keberhasilan rencana pengendalian RAM (parameter standar/klaster/unik dan parameter tambahan).
alter table ram_pengendalian add column if not exists indikator text;
alter table ram_tambahan add column if not exists indikator text;

-- 7d: milestone program/inisiatif strategis GRCS sepanjang 2027, berupa [{ "bulan": "Maret 2027", "uraian": "..." }].
alter table program_strategis add column if not exists milestone jsonb not null default '[]'::jsonb;
