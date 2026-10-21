-- Rasionalisasi dan dasar perhitungan risk threshold RAM (arahan surat tindak lanjut Challenge Session 5c).
-- Jalankan di Supabase SQL Editor setelah 0012_keterkaitan_rkap.sql. Aman dijalankan ulang.

-- Parameter standar/klaster/unik: disimpan per kode bersama rencana pengendalian.
alter table ram_pengendalian add column if not exists rasionalisasi text;
-- Parameter unik tambahan.
alter table ram_tambahan add column if not exists rasionalisasi text;
