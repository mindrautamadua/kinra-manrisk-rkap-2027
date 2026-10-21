-- Deskripsi Program versi ringkas untuk kartu 7.4 Executive Summary (satu slide per program).
-- Jalankan di Supabase SQL Editor setelah 0013_rasionalisasi_threshold_ram.sql. Aman dijalankan ulang.
-- Kolom deskripsi tetap menyimpan teks lengkap; slide memakai deskripsi_ringkas bila terisi.

alter table program_strategis add column if not exists deskripsi_ringkas text;
