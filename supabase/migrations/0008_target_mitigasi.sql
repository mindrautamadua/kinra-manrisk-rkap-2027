-- Target residual risk per risiko dan rencana aksi mitigasi terstruktur (PIC, biaya, jadwal per triwulan, output).
-- Jalankan di Supabase SQL Editor setelah 0007_cat_arah.sql. Aman dijalankan ulang.

-- Target residual: besaran risiko yang ditargetkan setelah seluruh rencana mitigasi RKAP 2027 dijalankan.
alter table risk_register add column if not exists target_probabilitas numeric;
alter table risk_register add column if not exists target_nilai_dampak numeric;
alter table risk_register add column if not exists target_kategori_dampak text;

-- Satu risiko punya beberapa rencana aksi; kolom teks Rencana Mitigasi tetap dipakai sebagai ringkasan sesuai template.
create table if not exists mitigasi_aksi (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references risk_register(id) on delete cascade,
  urutan int not null default 0,
  aksi text,
  kategori text,                         -- Preventive | Detective | Corrective
  pic text,                              -- unit/fungsi penanggung jawab
  biaya numeric,                         -- rupiah, anggaran RKAP 2027
  jadwal text[] not null default '{}',   -- triwulan pelaksanaan: TW I | TW II | TW III | TW IV
  output text,                           -- keluaran/target terukur
  updated_at timestamptz not null default now()
);
create index if not exists mitigasi_aksi_risk_id on mitigasi_aksi (risk_id);

-- Akses hanya lewat server Next.js (secret key), sama seperti tabel kertas kerja lain.
alter table mitigasi_aksi enable row level security;
revoke all on mitigasi_aksi from anon, authenticated;
grant all on mitigasi_aksi to service_role;
