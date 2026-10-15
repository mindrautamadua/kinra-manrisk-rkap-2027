-- Login aplikasi memakai tabel sendiri (bukan Supabase Auth).
-- Semua akses data kini lewat server Next.js (route /api/db) memakai secret key,
-- sehingga akses langsung anon/publishable key ke tabel ditutup.

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username = lower(username) and length(username) between 3 and 64),
  nama text not null default '',
  password_hash text not null,
  aktif boolean not null default true,
  gagal_login int not null default 0,
  terkunci_sampai timestamptz,
  login_terakhir timestamptz,
  created_at timestamptz not null default now()
);

-- RLS aktif tanpa policy: anon/authenticated tidak bisa membaca hash password.
alter table app_user enable row level security;
revoke all on app_user from anon, authenticated;

-- Tutup akses anon ke tabel kertas kerja.
do $$
declare t text;
begin
  foreach t in array array['app_settings','kategori_risiko','taksonomi','kriteria_dampak','risk_driver','ras','ras_tambahan',
                           'risk_register','parameter_sheet','ram_pengendalian','ram_tambahan','cat_aksi','challenge_log','snapshot']
  loop
    execute format('drop policy if exists "open_access" on %I', t);
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
