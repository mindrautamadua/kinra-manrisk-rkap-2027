-- Polaritas parameter akumulasi transaksi pada lembar CAT.
-- "Makin tinggi makin buruk" (minimize, default, contoh: Loan to Value) atau "Makin rendah makin buruk" (maximize).
-- Jalankan di Supabase SQL Editor setelah 0006_sasaran_strategis.sql. Aman dijalankan ulang.

alter table cat_aksi add column if not exists arah text not null default 'Makin tinggi makin buruk';
