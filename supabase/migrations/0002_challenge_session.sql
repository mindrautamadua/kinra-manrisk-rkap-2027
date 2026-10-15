-- Fitur challenge session: log masukan, snapshot versi, mode presentasi, keterkaitan risiko-parameter.
-- Jalankan di Supabase SQL Editor setelah 0001_init.sql. Aman dijalankan ulang.

-- 1. Log Challenge: masukan challenger beserta tindak lanjutnya
create table if not exists challenge_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ref_type text not null default 'umum',      -- umum | lembar | parameter | risiko
  ref_id text,                                -- path halaman / kode parameter / id risiko
  ref_label text,
  masukan text not null,
  challenger text,
  prioritas text not null default 'Sedang',   -- Tinggi | Sedang | Rendah
  tanggapan text,
  pic text,
  tenggat date,
  status text not null default 'Terbuka'      -- Terbuka | Dalam proses | Selesai
);
create index if not exists challenge_log_status_idx on challenge_log (status);

-- 2. Snapshot versi data (dibekukan sebelum/sesudah challenge session)
create table if not exists snapshot (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nama text not null,
  catatan text,
  data jsonb not null
);

-- 3. Keterkaitan Risk Register -> parameter RAM (kode 1a..U10 atau kode parameter unik tambahan)
alter table risk_register add column if not exists parameter_ram text[] not null default '{}';

-- 4. Mode presentasi disimpan di app_settings (key = 'presentasi'); tidak perlu tabel baru.

do $$
declare t text;
begin
  foreach t in array array['challenge_log','snapshot'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open_access" on %I', t);
    execute format('create policy "open_access" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant select, insert, update, delete on challenge_log, snapshot to anon, authenticated;
