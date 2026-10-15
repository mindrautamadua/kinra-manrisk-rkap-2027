-- Data Keuangan RKAP 2027: ringkasan pos kunci dari Kertas Kerja RKAP (Laba Rugi Konsolidasi).
-- Satu baris = satu versi unggahan (Draft II, Draft III, Final, ...). Hanya satu versi yang aktif dan dipakai lembar parameter.
-- Jalankan di Supabase SQL Editor setelah 0004_program_strategis.sql. Aman dijalankan ulang.

create table if not exists rkap_keuangan (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nama text not null,                 -- contoh: Draft II
  sumber text,                        -- nama file dan sheet asal
  catatan text,
  aktif boolean not null default false,
  ebitda_basis text not null default 'holding',  -- holding | komite
  data jsonb not null default '{}'::jsonb         -- { pos: { <kode>: { tahun, bulan[12], pembanding{} } } }
);

-- Paling banyak satu versi aktif.
create unique index if not exists rkap_keuangan_satu_aktif on rkap_keuangan (aktif) where aktif;

-- Akses hanya lewat server Next.js (secret key), sama seperti tabel kertas kerja lain.
alter table rkap_keuangan enable row level security;
revoke all on rkap_keuangan from anon, authenticated;
grant all on rkap_keuangan to service_role;
