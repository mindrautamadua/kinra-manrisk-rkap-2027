-- Perencanaan Manajemen Risiko RKAP 2027 - PT KINRA
-- Jalankan sekali di Supabase SQL Editor (atau `supabase db push`).
-- Aplikasi tanpa login: akses memakai anon/publishable key dengan policy terbuka.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists kategori_risiko (
  no int primary key,
  nama text not null unique,
  nama_en text,
  definisi text
);

create table if not exists taksonomi (
  kode text primary key,
  kategori text not null,
  def_kategori text,
  aspek text,
  def_aspek text,
  risiko_korporat text,
  def_risiko_korporat text,
  risiko_spesifik text,
  def_risiko_spesifik text,
  jumlah_unit int default 0
);
create index if not exists taksonomi_kategori_idx on taksonomi (kategori);

create table if not exists kriteria_dampak (
  id serial primary key,
  kategori text not null,
  kode text not null,
  kriteria text not null,
  perhitungan text,
  sangat_rendah text,
  rendah text,
  moderat text,
  tinggi text,
  sangat_tinggi text
);

create table if not exists risk_driver (
  id serial primary key,
  kategori text not null,
  driver text not null,
  bentuk text,
  tambahan boolean not null default false
);

create table if not exists ras (
  id serial primary key,
  no int not null,
  kategori text not null,
  sikap_induk text,
  pernyataan_induk text,
  sikap text,
  pernyataan text,
  rasionalisasi text
);

create table if not exists ras_tambahan (
  id serial primary key,
  kategori text,
  sikap text,
  pernyataan text,
  rasionalisasi text
);

create table if not exists risk_register (
  id uuid primary key default gen_random_uuid(),
  urutan int not null default 0,
  kategori text,
  taksonomi_kode text,
  risk_driver text,
  risk_event text,
  deskripsi text,
  root_cause text,
  probabilitas numeric,
  deskripsi_dampak text,
  nilai_dampak numeric,
  kriteria_dampak text,
  kategori_dampak text,
  expected_loss numeric,
  existing_control text,
  rencana_mitigasi text,
  kategori_mitigasi text,
  updated_at timestamptz not null default now()
);

-- Input sel kuning setiap lembar parameter (1a s.d. U10) + ringkasan hasil terakhir
create table if not exists parameter_sheet (
  code text primary key,
  title text,
  grup text,
  urutan int,
  diterapkan text,
  inputs jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists ram_pengendalian (
  kode text primary key,
  inisiatif text,
  kebijakan text,
  program text,
  anggaran numeric
);

create table if not exists ram_tambahan (
  id uuid primary key default gen_random_uuid(),
  kategori text not null,
  kode text,
  parameter text,
  formula text,
  satuan text,
  limit_v numeric,
  appetite_v numeric,
  tolerance_v numeric,
  arah text default 'Makin tinggi makin buruk',
  hasil numeric,
  inisiatif text,
  kebijakan text,
  program text,
  anggaran numeric
);

create table if not exists cat_aksi (
  id uuid primary key default gen_random_uuid(),
  urutan int not null default 0,
  jenis text,
  nama text,
  rencana_detail text,
  dasar_kewenangan text,
  rencana_waktu text,
  parameter text,
  formula text,
  hasil numeric,
  rasionalisasi_parameter text,
  limit_v numeric,
  appetite_v numeric,
  tolerance_v numeric,
  rasionalisasi_threshold text
);

-- RLS: aplikasi internal tanpa login -> izinkan anon membaca & menulis.
do $$
declare t text;
begin
  foreach t in array array['app_settings','kategori_risiko','taksonomi','kriteria_dampak','risk_driver','ras','ras_tambahan',
                           'risk_register','parameter_sheet','ram_pengendalian','ram_tambahan','cat_aksi']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open_access" on %I', t);
    execute format('create policy "open_access" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
