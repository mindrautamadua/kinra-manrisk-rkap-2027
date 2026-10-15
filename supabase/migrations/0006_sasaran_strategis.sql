-- Sasaran Strategis RJPP 2026-2030 PT KINRA dan tagging Risk Register ke sasaran tersebut.
-- Induk: 3 Pilar (Performance Driven, Stability and Growth, New Business Expansion) + grup Fondasi (Sasaran Korporasi).
-- Jalankan di Supabase SQL Editor setelah 0005_rkap_keuangan.sql. Aman dijalankan ulang (data yang sudah diedit tidak ditimpa).

create table if not exists sasaran_strategis (
  kode text primary key,                  -- PD-1 | SG-1 | NB-1 | FD-1 ...
  urutan int not null default 0,
  pilar text not null,                    -- Performance Driven | Stability and Growth | New Business Expansion | Fondasi
  nama text not null,
  target text,                            -- target/KPI 2030 sesuai RJPP
  rujukan text,                           -- halaman RJPP
  updated_at timestamptz not null default now()
);

-- Satu risiko boleh mengancam beberapa sasaran.
alter table risk_register add column if not exists sasaran_strategis text[] not null default '{}';

insert into sasaran_strategis (kode, urutan, pilar, nama, target, rujukan) values
  ('PD-1', 1, 'Performance Driven', 'Meningkatkan pemasaran lahan sebagai penggerak utama pendapatan KEK Sei Mangkei',
    'Pemasaran lahan 110 Ha (2026), 80 Ha (2027), 80 Ha (2028), 90 Ha (2029), 100 Ha (2030)', 'RJPP Bab 3.2.2, hal. 54'),
  ('PD-2', 2, 'Performance Driven', 'Menarik tenant hilirisasi sawit, karet, dan industri pendukung melalui marketing 4P terintegrasi',
    'Portofolio sekitar 20-23 produk turunan CPO dan PKO (pangan, oleokimia, energi)', 'RJPP Bab 3.2.2, hal. 54'),
  ('PD-3', 3, 'Performance Driven', 'Menjaga loyalitas dan retensi tenant melalui CRM, survei kepuasan, dan SLA layanan',
    'Survei kepuasan tenant minimal 81%', 'RJPP Bab 3.2.2, hal. 54'),
  ('PD-4', 4, 'Performance Driven', 'Mengembangkan tenant baru yang terhubung dalam rantai pasok dan membentuk klaster industri hijau',
    'Kontribusi sekitar 1,61% terhadap investasi nasional di sektor terkait', 'RJPP Bab 3.2.2, hal. 54'),
  ('PD-5', 5, 'Performance Driven', 'Memperkuat marketing intelligence dan pemetaan geo-economic',
    'Potensi investasi kumulatif sekitar Rp129 triliun dan lebih dari 80.000 lapangan kerja hingga 2032', 'RJPP Bab 3.2.2, hal. 54'),

  ('SG-1', 6, 'Stability and Growth', 'Meningkatkan kinerja keuangan perusahaan',
    'Pendapatan Rp319,4 M (2026) menjadi Rp715,3 M (2030); EBITDA Rp68,1 M menjadi Rp147,9 M; laba bersih Rp53,3 M menjadi Rp101,1 M', 'RJPP Bab 3.2.4, hal. 57'),
  ('SG-2', 7, 'Stability and Growth', 'Meningkatkan kapasitas layanan utilitas kawasan',
    'Air bersih 62,560 juta m3/tahun, pengolahan limbah 46,619 juta m3/tahun, listrik 490,177 MW/tahun pada 2030', 'RJPP Bab 3.2.4, hal. 58'),
  ('SG-3', 8, 'Stability and Growth', 'Menjaga stabilitas bisnis utilitas eksisting dan arus kas operasional',
    'Utilitas eksisting (listrik, air, limbah, fasilitas penunjang) memenuhi SLA tenant; arus kas operasional positif', 'RJPP Bab 3.2.4, hal. 58'),
  ('SG-4', 9, 'Stability and Growth', 'Mendorong pertumbuhan melalui ekspansi kapasitas utilitas, okupansi lahan, dan kemitraan pembiayaan',
    'Ekspansi kapasitas utilitas bersama mitra strategis; peningkatan okupansi lahan dan utilisasi utilitas', 'RJPP Bab 3.2.4, hal. 58'),
  ('SG-5', 10, 'Stability and Growth', 'Memperkuat green dan daya saing kawasan',
    'Utilitas berkonsep green (efisiensi energi, energi terbarukan, SDA berkelanjutan); IT terintegrasi untuk monitoring, billing, dan kontrol utilitas', 'RJPP Bab 3.2.4, hal. 58'),

  ('NB-1', 11, 'New Business Expansion', 'Menumbuhkan pendapatan dari bisnis baru',
    'Revenue bisnis baru sekitar Rp70 M dan net income sekitar Rp15 M pada 2030', 'RJPP Pilar New Business Expansion, hal. 61'),
  ('NB-2', 12, 'New Business Expansion', 'Mengembangkan Standard Factory Building (SFB) dan zona Industri Kecil Menengah (IKM)',
    'SFB 50.000-75.000 m2 dengan okupansi minimal 80% pada 2030; zona IKM dengan utilitas lengkap', 'RJPP Pilar New Business Expansion, hal. 61'),
  ('NB-3', 13, 'New Business Expansion', 'Mengembangkan layanan pendukung kawasan (perparkiran dan MICE)',
    'Parkir terintegrasi 400-500 unit kendaraan; fasilitas MICE 500-1.000 orang', 'RJPP Pilar New Business Expansion, hal. 61'),
  ('NB-4', 14, 'New Business Expansion', 'Menyediakan perumahan dan akomodasi terintegrasi kawasan',
    '1.000-1.500 unit hunian (apartemen, rumah, asrama) beserta fasilitas komersial pendukung', 'RJPP Pilar New Business Expansion, hal. 62'),
  ('NB-5', 15, 'New Business Expansion', 'Memperkuat kemitraan strategis dan sistem IT bisnis baru',
    'Strategic partner terpilih untuk SFB, MICE, dan perumahan; sistem IT terintegrasi untuk pelanggan, reservasi, dan billing', 'RJPP Pilar New Business Expansion, hal. 62'),

  ('FD-1', 16, 'Fondasi', 'Mempertahankan eksistensi perusahaan', null, 'RJPP Bab 4.3.1, hal. 73'),
  ('FD-2', 17, 'Fondasi', 'Menerapkan prinsip Good Corporate Governance dalam pengelolaan perusahaan',
    'Transparansi, kemandirian, akuntabilitas, kewajaran, partisipasi, dan keadilan', 'RJPP Bab 4.3.1, hal. 73'),
  ('FD-3', 18, 'Fondasi', 'Meningkatkan citra perusahaan', null, 'RJPP Bab 4.3.1, hal. 73'),
  ('FD-4', 19, 'Fondasi', 'Mereview struktur SDM dan mengoptimalkan potensi karyawan serta sumber daya yang ada', null, 'RJPP Bab 4.3.1, hal. 73')
on conflict (kode) do nothing;

-- Akses hanya lewat server Next.js (secret key), sama seperti tabel kertas kerja lain.
alter table sasaran_strategis enable row level security;
revoke all on sasaran_strategis from anon, authenticated;
grant all on sasaran_strategis to service_role;
