-- 7.4 Program atau Inisiatif Strategis GRCS (Governance, Risk Management, Compliance, Sustainability).
-- Satu baris = satu kartu program pada Executive Summary. Jalankan di Supabase SQL Editor setelah 0003_login.sql. Aman dijalankan ulang.

create table if not exists program_strategis (
  id uuid primary key default gen_random_uuid(),
  urutan int not null default 0,
  pilar text not null default 'Risk Management',   -- Governance | Risk Management | Compliance | Sustainability
  nama text,                                        -- nama program atau inisiatif strategis
  inisiatif_rjpp text,
  objective_scorecard text,
  program_kerja text,
  pemimpin text,
  pemilik text,
  bulan_mulai text,                                 -- contoh: Januari 2027
  bulan_selesai text,
  deskripsi text,
  tujuan_kualitatif text,                           -- satu poin per baris
  tujuan_kuantitatif text,
  target text,
  opex numeric,                                     -- rupiah
  capex numeric,
  risiko_implementasi text,
  mitigasi text,
  updated_at timestamptz not null default now()
);

-- Akses hanya lewat server Next.js (secret key), sama seperti tabel kertas kerja lain.
alter table program_strategis enable row level security;
revoke all on program_strategis from anon, authenticated;
grant all on program_strategis to service_role;
