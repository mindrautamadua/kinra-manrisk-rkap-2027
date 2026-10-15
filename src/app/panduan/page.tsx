"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowUpRight, BarChart3, BookOpen, CheckCircle2, ChevronDown, ClipboardCheck, Database, Download, HelpCircle, Layers,
  Lightbulb, Lock, MessageSquarePlus, Printer, Search, ShieldAlert, Sparkles, Users,
} from "lucide-react";
import { Button, Card, SheetPage } from "@/components/ui";

// ---------- konten ----------
const TOC = [
  { id: "tentang", label: "Tentang Aplikasi", icon: BookOpen },
  { id: "manfaat", label: "Manfaat", icon: Sparkles },
  { id: "tampilan", label: "Mengenal Tampilan", icon: Layers },
  { id: "memulai", label: "Memulai (Admin)", icon: Database },
  { id: "pengisian", label: "Urutan Pengisian", icon: ClipboardCheck },
  { id: "challenge", label: "Challenge Session", icon: Users },
  { id: "ekspor", label: "Ekspor & Cetak", icon: Download },
  { id: "tips", label: "Tips", icon: Lightbulb },
  { id: "faq", label: "Pertanyaan Umum", icon: HelpCircle },
];

const PERAN = {
  penyusun: {
    label: "Tim Penyusun",
    sub: "Manajemen Risiko & PIC unit",
    items: [
      ["Satu sumber data", "Semua orang mengisi data yang sama secara daring. Tidak ada lagi file Excel berversi-versi yang dikirim lewat email lalu digabung manual."],
      ["Perhitungan otomatis", "Rumus lembar parameter asli dihitung ulang langsung. Status Hijau/Kuning/Oranye/Merah, Risiko Utama, RAM, dan Rekap terisi sendiri dari data yang diinput."],
      ["Konsisten dengan standar Induk", "Risk Event dipilih dari Taksonomi PTPN Group, risk driver dari daftar baku 98 driver, dan sikap RAS dicek agar tidak lebih longgar dari sikap Induk (PTPN III)."],
      ["Lebih sedikit kesalahan", "Cek Kesiapan menemukan kolom wajib kosong, risiko duplikat, parameter merah tanpa rencana pengendalian, dan ketidakwajaran lain sebelum dilihat reviewer."],
      ["Draf isian dibantu AI", "Tombol ✦ di RAS, Risk Register, RAM, dan CAT menyusun draf kolom teks (root cause, mitigasi, pernyataan selera risiko, rencana pengendalian, aksi korporasi) dari uraian bebas. Draf direviu dulu sebelum disimpan."],
      ["Hemat waktu menyusun paparan", "Executive Summary (RAS, RAM, Top Risk) tersusun otomatis dalam format slide dan bisa langsung dicetak ke PDF."],
    ],
  },
  challenger: {
    label: "Challenger / Reviewer",
    sub: "Peninjau kertas kerja",
    items: [
      ["Masukan tercatat rapi", "Setiap masukan dicatat dengan halaman rujukan, PIC, tenggat, prioritas, dan status, lalu bisa diekspor sebagai notulen Excel."],
      ["Jejak perubahan jelas", "Snapshot membekukan data sebelum challenge session dan menunjukkan apa saja yang berubah sesudahnya."],
      ["Reviu kualitas berbantuan AI", "Selain cek kelengkapan, AI menilai kualitas isi (root cause dangkal, mitigasi tidak spesifik) dan menyarankan pertanyaan untuk reviewer."],
    ],
  },
  pimpinan: {
    label: "Pimpinan",
    sub: "Penerima paparan",
    items: [
      ["Gambaran cepat", "Dashboard menampilkan jumlah risiko, top risk, total nilai dampak dan expected loss, status parameter RAM, serta peta risiko dalam satu layar."],
      ["Keterkaitan risiko–target", "Matriks Keterkaitan menunjukkan risiko korporat mana yang mengancam parameter RAM mana, sehingga prioritas mitigasi lebih mudah diputuskan."],
      ["Paparan aman", "Mode Presentasi mengunci semua isian sehingga data tidak berubah tanpa sengaja saat ditampilkan di rapat."],
    ],
  },
} as const;
type Peran = keyof typeof PERAN;

type Jenis = "Diisi" | "Otomatis" | "Sebagian" | "Referensi";
const LANGKAH: { lembar: string; href: string; jenis: Jenis; isi: string }[] = [
  { lembar: "Sampul", href: "/sampul", jenis: "Diisi", isi: "Isi identitas entitas, posisi data, tanggal penyusunan, dan versi." },
  { lembar: "RAS", href: "/ras", jenis: "Diisi", isi: "Pilih sikap risiko dan tulis pernyataan selera risiko per kategori. Sikap entitas harus sama atau lebih ketat dari sikap Induk; aplikasi memberi tanda bila lebih longgar. Pernyataan tambahan dicatat di bagian B." },
  { lembar: "Kriteria Dampak", href: "/kriteria-dampak", jenis: "Referensi", isi: "Baca definisi kategori risiko dan kriteria dampak sebagai acuan." },
  { lembar: "Risk Driver", href: "/risk-driver", jenis: "Sebagian", isi: "Periksa 98 risk driver baku per kategori. Driver khusus entitas ditambahkan di bagian B." },
  { lembar: "Risk Register", href: "/risk-register", jenis: "Diisi", isi: "Klik Tambah Risiko. Pilih Risk Event dari Taksonomi PTPN Group, lalu isi driver, deskripsi, root cause, probabilitas, dampak, kategori dampak, existing control, rencana dan kategori mitigasi, serta parameter RAM terkait. Tagging Top Risk terisi sendiri." },
  { lembar: "Risiko Utama", href: "/risiko-utama", jenis: "Otomatis", isi: "Terisi otomatis dari risiko berkategori dampak Moderat ke atas. Cukup diperiksa." },
  { lembar: "Rekap Parameter", href: "/rekap", jenis: "Sebagian", isi: "Pada parameter klaster dan unik, isi kolom Diterapkan (Ya/Tidak). Gunakan Hitung Ulang Semua bila perlu menyegarkan seluruh hasil." },
  { lembar: "Lembar Parameter 1a–U10", href: "/parameter/1a", jenis: "Diisi", isi: "Buka tiap parameter yang diterapkan, isi sel kuning (rincian data RKAP bagian C, konfirmasi eksposur bagian D, sumber data bagian E, dasar usulan threshold bagian F bila ada). Hasil dan status langsung terhitung. Gunakan tombol panah untuk pindah parameter." },
  { lembar: "RAM", href: "/ram", jenis: "Sebagian", isi: "Terisi otomatis dari RAS, Rekap, dan lembar parameter. Isi rencana pengendalian untuk parameter berstatus Kuning/Oranye/Merah, dan tambahkan parameter unik bila ada." },
  { lembar: "CAT", href: "/cat", jenis: "Diisi", isi: "Klik Tambah Aksi Korporasi untuk setiap rencana aksi korporasi RKAP 2027 beserta data rinci dan parameter akumulasi transaksinya." },
  { lembar: "Executive Summary", href: "/executive-summary", jenis: "Otomatis", isi: "Periksa slide RAS, RAM, dan Top Risk yang tersusun otomatis, lalu Cetak / PDF." },
];
const JENIS_STYLE: Record<Jenis, string> = {
  Diisi: "bg-cell-input text-amber-900 ring-amber-300",
  Otomatis: "bg-cell-calc text-sky-900 ring-sky-300",
  Sebagian: "bg-brand-50 text-brand-800 ring-brand-200",
  Referensi: "bg-cell-label text-slate-600 ring-slate-300",
};

const BAGIAN = [
  ["A", "Identitas parameter: kode, nama, kategori, formula, satuan, arah pembacaan"],
  ["B", "Risk threshold: limit, appetite, tolerance"],
  ["C", "Rincian data RKAP 2027 sebagai dasar perhitungan"],
  ["D", "Hasil pengukuran, status, konfirmasi eksposur, dan penjelasan"],
  ["E", "Sumber dan posisi data"],
  ["F", "Dasar usulan threshold (data historis bulanan dan rasionalisasi), hanya untuk parameter yang batasnya diusulkan entitas"],
];

const SESI: { fase: string; tone: string; langkah: { judul: string; href?: string; isi: string }[] }[] = [
  {
    fase: "Sebelum sesi", tone: "border-t-sky-500",
    langkah: [
      { judul: "Cek Kesiapan", href: "/kesiapan", isi: "Aplikasi memeriksa seluruh kertas kerja dan mengelompokkan temuan menjadi Kritis, Perhatian, dan Info per area. Klik temuan untuk menuju halaman yang perlu diperbaiki, lalu Periksa Ulang. Targetkan nol temuan Kritis." },
      { judul: "Review Kualitas (AI)", href: "/kesiapan", isi: "Penilaian mutu isi RAS, Risk Register, dan rencana pengendalian RAM. Tiap temuan berisi masalah, saran perbaikan, dan pertanyaan yang mungkin diajukan reviewer. Aktif bila admin sudah mengisi kunci OpenAI." },
      { judul: "Keterkaitan Risiko–RAM", href: "/keterkaitan", isi: "Pastikan setiap risiko korporat terhubung ke parameter RAM yang relevan. Halaman ini hanya untuk peninjauan; kaitan diisi dari kolom Parameter RAM Terkait di Risk Register." },
      { judul: "Snapshot Versi", href: "/snapshot", isi: "Klik Bekukan Kondisi Sekarang dan beri nama, misalnya \"Sebelum Challenge Session 1\"." },
    ],
  },
  {
    fase: "Saat sesi", tone: "border-t-gold",
    langkah: [
      { judul: "Aktifkan Mode Presentasi", isi: "Klik tombol Mode Presentasi di header. Semua isian di semua layar terkunci; Log Challenge dan Snapshot tetap bisa dipakai." },
      { judul: "Tampilkan bahan", href: "/executive-summary", isi: "Tampilkan Dashboard, Executive Summary, atau lembar yang sedang dibahas." },
      { judul: "Catat Masukan", isi: "Klik tombol Catat Masukan (kanan bawah, ada di setiap halaman). Masukan otomatis merujuk ke halaman yang sedang dibuka. Isi challenger, PIC, prioritas, dan tenggat." },
    ],
  },
  {
    fase: "Sesudah sesi", tone: "border-t-brand-600",
    langkah: [
      { judul: "Matikan Mode Presentasi", isi: "Buka kunci isian agar revisi bisa dilakukan." },
      { judul: "Tindak lanjut di Log Challenge", href: "/challenge", isi: "Saring per status (Terbuka / Dalam proses / Selesai), prioritas, atau kata kunci. Klik rujukan untuk menuju objek yang perlu direvisi, lalu isi tanggapan dan ubah status." },
      { judul: "Unduh Notulen Excel", href: "/challenge", isi: "Simpan sebagai bukti hasil sesi." },
      { judul: "Bandingkan Snapshot", href: "/snapshot", isi: "Pilih versi dasar dan pembandingnya, lalu klik Bandingkan untuk menunjukkan perubahan yang sudah dilakukan." },
    ],
  },
];

const EKSPOR = [
  { halaman: "Risk Register", href: "/risk-register", tombol: "Excel", hasil: "Daftar seluruh risiko korporat" },
  { halaman: "RAM", href: "/ram", tombol: "Excel", hasil: "Risk Acceptance Matrix" },
  { halaman: "Rekap Parameter", href: "/rekap", tombol: "Excel", hasil: "Rekap 32 parameter beserta status" },
  { halaman: "Log Challenge", href: "/challenge", tombol: "Notulen Excel", hasil: "Notulen masukan dan tindak lanjut" },
  { halaman: "Executive Summary", href: "/executive-summary", tombol: "Cetak / PDF", hasil: "Slide paparan RAS, RAM, Top Risk" },
];

const TIPS = [
  "Isi hanya sel kuning. Sel biru dihitung otomatis dan akan berubah sendiri.",
  "Bila status parameter tertulis \"Data belum lengkap\", lengkapi sel kuning bagian C atau isi konfirmasi eksposur di bagian D.",
  "Gunakan Taksonomi PTPN Group (menu Master Data) untuk mencari Risk Event yang paling tepat sebelum menambah risiko.",
  "Ambil snapshot sebelum perubahan besar agar selalu ada titik pembanding.",
  "Tombol ✦ (Isi dengan AI) di RAS, Risk Register, RAM, dan CAT membuat draf kolom teks. Ceritakan konteksnya dengan bahasa bebas, periksa draf, centang kolom yang dipakai, lalu Terapkan. AI tidak mengisi angka; bagian bertanda [...] wajib dilengkapi sendiri.",
];

const FAQ = [
  ["Apakah perubahan perlu disimpan manual?", "Tidak. Setiap perubahan sel tersimpan otomatis. Indikator simpan tampil di kanan atas halaman."],
  ["Kenapa saya tidak bisa mengedit?", "Kemungkinan Mode Presentasi sedang aktif (ada pita merah di bawah header). Klik tombol Mode Presentasi di header untuk membuka kunci."],
  ["Kenapa risiko saya tidak muncul di Risiko Utama?", "Risiko Utama hanya memuat risiko dengan kategori dampak Moderat, Tinggi, atau Sangat Tinggi. Periksa kolom kategori dampak di Risk Register."],
  ["Kenapa parameter tidak muncul di RAM?", "Pastikan kolom Diterapkan di Rekap Parameter bernilai \"Ya\" untuk parameter klaster/unik."],
  ["Tombol Review Kualitas (AI) atau Isi dengan AI tidak berfungsi?", "Kedua fitur ini membutuhkan kunci OpenAI yang dipasang admin. Pemeriksaan kesiapan otomatis dan pengisian manual tetap berjalan tanpa AI."],
  ["Apakah hasil AI langsung tersimpan?", "Tidak. AI hanya membuat draf di jendela terpisah. Data baru tersimpan setelah Anda memilih kolom dan klik Terapkan. Tombol AI tersembunyi saat Mode Presentasi aktif."],
  ["Bagaimana menciutkan sidebar?", "Klik tombol di bawah sidebar atau tekan Ctrl/⌘ + B. Pilihan ini diingat oleh browser."],
  ["Apa arti warna sel?", "Kuning: diisi entitas. Biru: terhitung otomatis, jangan diisi. Abu-abu: label atau baris contoh yang tidak ikut dihitung."],
];

// ---------- halaman ----------
export default function PanduanPage() {
  const [peran, setPeran] = useState<Peran>("penyusun");
  const [aktif, setAktif] = useState(TOC[0].id);
  const [q, setQ] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Sorot bagian daftar isi sesuai posisi gulir
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setAktif(vis[0].target.id);
    }, { rootMargin: "-80px 0px -65% 0px" });
    TOC.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const faq = useMemo(() => {
    const k = q.trim().toLowerCase();
    return FAQ.map((f, i) => ({ f, i })).filter(({ f }) => !k || (f[0] + " " + f[1]).toLowerCase().includes(k));
  }, [q]);

  return (
    <SheetPage title="Panduan Penggunaan" code="Bantuan" offline
      actions={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Cetak Panduan</Button>}>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Daftar isi */}
        <aside className="hidden lg:block print:hidden">
          <nav className="sticky top-20 space-y-0.5">
            <div className="px-3 pb-2 text-[10.5px] font-bold tracking-[0.14em] text-slate-400 uppercase">Daftar Isi</div>
            {TOC.map((t, i) => (
              <a key={t.id} href={`#${t.id}`} className={clsx("flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                aktif === t.id ? "bg-white font-semibold text-brand-800 shadow-sm ring-1 ring-line" : "text-slate-600 hover:bg-black/5 hover:text-ink")}>
                <span className={clsx("w-4 text-[11px] font-bold tabnum", aktif === t.id ? "text-brand-600" : "text-slate-400")}>{i + 1}</span>
                {t.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          {/* 1. Tentang */}
          <Bab id="tentang" no={1} title="Tentang Aplikasi">
            <Card className="overflow-hidden">
              <div className="bg-brand-900 px-6 py-6 text-white">
                <div className="text-[11px] font-bold tracking-[0.16em] text-gold uppercase">Kertas Kerja Digital</div>
                <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-brand-50">
                  Versi web dari <b>Kertas Kerja Bantu Perencanaan Manajemen Risiko RKAP 2027</b> (template PT DAM v.2) dengan master <b>Taksonomi Risiko PTPN Group</b>.
                </p>
              </div>
              <div className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {[["Diisi bersama", "satu data daring"], ["Dihitung otomatis", "rumus Excel asli"], ["Diperiksa", "cek kesiapan + AI"], ["Dipresentasikan", "mode presentasi"]].map(([a, b]) => (
                  <div key={a} className="px-5 py-4"><div className="text-[13px] font-bold text-ink">{a}</div><div className="text-[12px] text-slate-500">{b}</div></div>
                ))}
              </div>
            </Card>
            <p className="text-[13.5px] leading-relaxed text-slate-700">
              Seluruh lembar Excel — Sampul, RAS, Risk Register, RAM, CAT, Rekap, sampai 32 lembar parameter (1a–U10) — tersedia sebagai halaman yang bisa diisi bersama, dihitung otomatis, diperiksa, dan dipresentasikan dari satu tempat.
            </p>
          </Bab>

          {/* 2. Manfaat */}
          <Bab id="manfaat" no={2} title="Manfaat untuk Setiap Peran">
            <div className="flex flex-wrap gap-2 print:hidden" role="tablist">
              {(Object.keys(PERAN) as Peran[]).map((k) => (
                <button key={k} role="tab" aria-selected={peran === k} onClick={() => setPeran(k)}
                  className={clsx("rounded-xl px-4 py-2 text-left transition",
                    peran === k ? "bg-brand-800 text-white shadow-sm" : "border border-line bg-white text-slate-600 hover:border-brand-500")}>
                  <div className="text-[13px] font-bold">{PERAN[k].label}</div>
                  <div className={clsx("text-[11px]", peran === k ? "text-brand-200" : "text-slate-400")}>{PERAN[k].sub}</div>
                </button>
              ))}
            </div>
            {(Object.keys(PERAN) as Peran[]).map((k) => (
              <div key={k} className={clsx("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", peran !== k && "hidden print:grid")}>
                <div className="hidden text-[13px] font-bold text-ink print:block sm:col-span-full">{PERAN[k].label}</div>
                {PERAN[k].items.map(([judul, isi]) => (
                  <Card key={judul} className="p-5">
                    <CheckCircle2 className="h-5 w-5 text-brand-600" />
                    <div className="mt-2 text-[14px] font-bold text-ink">{judul}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{isi}</p>
                  </Card>
                ))}
              </div>
            ))}
          </Bab>

          {/* 3. Tampilan */}
          <Bab id="tampilan" no={3} title="Mengenal Tampilan">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <div className="text-[13px] font-bold text-ink">Sidebar kiri</div>
                <ul className="mt-2 space-y-1.5 text-[12.5px] text-slate-600">
                  <li><b className="text-ink">Dashboard</b> — ringkasan seluruh kertas kerja</li>
                  <li><b className="text-ink">Challenge Session</b> — Cek Kesiapan, Log Challenge, Keterkaitan Risiko–RAM, Snapshot Versi</li>
                  <li><b className="text-ink">Kertas Kerja</b> — Sampul sampai Executive Summary, plus Lembar Parameter 1a–U10</li>
                  <li><b className="text-ink">Master Data</b> — Taksonomi PTPN Group dan Inisialisasi Data</li>
                </ul>
                <p className="mt-3 text-[12px] text-slate-500">Ciutkan dengan tombol di bawah sidebar atau <Kbd>Ctrl/⌘</Kbd> + <Kbd>B</Kbd>.</p>
              </Card>
              <Card className="p-5">
                <div className="text-[13px] font-bold text-ink">Arti warna sel</div>
                <div className="mt-3 space-y-2.5">
                  {[["bg-cell-input ring-amber-300", "Kuning", "Diisi oleh entitas"], ["bg-cell-calc ring-sky-300", "Biru", "Terhitung otomatis — jangan diisi"], ["bg-cell-label ring-slate-300", "Abu-abu", "Label atau baris contoh, tidak ikut dihitung"]].map(([c, w, a]) => (
                    <div key={w} className="flex items-center gap-3 text-[12.5px]">
                      <span className={clsx("h-6 w-14 shrink-0 rounded ring-1", c)} /><b className="w-16 text-ink">{w}</b><span className="text-slate-600">{a}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-5">
                <div className="text-[13px] font-bold text-ink">Tab lembar</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">Deretan tab di bawah layar meniru tab sheet Excel untuk berpindah lembar dengan cepat.</p>
              </Card>
              <Card className="p-5">
                <div className="text-[13px] font-bold text-ink">Penyimpanan otomatis</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">Setiap sel yang diubah tersimpan sendiri. Indikator <i>Menyimpan… / Tersimpan</i> tampil di kanan atas halaman.</p>
              </Card>
            </div>
          </Bab>

          {/* 4. Memulai */}
          <Bab id="memulai" no={4} title="Memulai (sekali saja, oleh admin)">
            <ol className="grid gap-3 md:grid-cols-3">
              {[["Buka Inisialisasi Data", "Menu Master Data → Inisialisasi Data."], ["Cek Status", "Lihat apakah tabel database sudah siap."], ["Isi Data Awal", "Bila masih kosong. Master taksonomi, risk driver, RAS, dan lembar parameter terisi dari template."]].map(([j, i], n) => (
                <Card key={j} className="p-5"><Step n={n + 1} /><div className="mt-2 text-[13.5px] font-bold text-ink">{j}</div><p className="mt-1 text-[12.5px] text-slate-600">{i}</p></Card>
              ))}
            </ol>
            <Callout tone="warn">Jangan menjalankan <b>Isi Data Awal</b> lagi setelah tim mulai mengisi, kecuali memang ingin mengulang dari awal.</Callout>
            <GoLink href="/setup">Buka Inisialisasi Data</GoLink>
          </Bab>

          {/* 5. Pengisian */}
          <Bab id="pengisian" no={5} title="Urutan Pengisian Kertas Kerja">
            <p className="text-[13px] text-slate-600">Ikuti urutan berikut. Lembar yang terisi otomatis cukup diperiksa. Klik nama lembar untuk langsung membukanya.</p>
            <div className="flex flex-wrap gap-2 text-[11.5px]">
              {(Object.keys(JENIS_STYLE) as Jenis[]).map((j) => <span key={j} className={clsx("rounded-md px-2 py-0.5 font-semibold ring-1", JENIS_STYLE[j])}>{j}</span>)}
            </div>
            <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-line">
              {LANGKAH.map((l, i) => (
                <li key={l.lembar} className="relative flex gap-4">
                  <Step n={i + 1} />
                  <Card className="flex-1 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={l.href} className="group inline-flex items-center gap-1 text-[14px] font-bold text-ink hover:text-brand-700">
                        {l.lembar}<ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-600" />
                      </Link>
                      <span className={clsx("ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1", JENIS_STYLE[l.jenis])}>{l.jenis}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{l.isi}</p>
                  </Card>
                </li>
              ))}
            </ol>
            <Card className="p-5">
              <div className="mb-3 text-[13px] font-bold text-ink">Struktur setiap Lembar Parameter</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {BAGIAN.map(([b, i]) => (
                  <div key={b} className="flex gap-3 text-[12.5px]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-800 text-[11px] font-bold text-white">{b}</span>
                    <span className="text-slate-600">{i}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Bab>

          {/* 6. Challenge */}
          <Bab id="challenge" no={6} title="Persiapan dan Pelaksanaan Challenge Session">
            <div className="grid gap-4 xl:grid-cols-3">
              {SESI.map((s) => (
                <Card key={s.fase} className={clsx("border-t-4 p-5", s.tone)}>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-slate-500 uppercase">{s.fase}</div>
                  <ol className="mt-3 space-y-4">
                    {s.langkah.map((l, i) => (
                      <li key={l.judul} className="flex gap-3">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10.5px] font-bold text-slate-600">{i + 1}</span>
                        <div>
                          {l.href
                            ? <Link href={l.href} className="group inline-flex items-center gap-1 text-[13px] font-bold text-ink hover:text-brand-700">{l.judul}<ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-brand-600" /></Link>
                            : <div className="text-[13px] font-bold text-ink">{l.judul}</div>}
                          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{l.isi}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Callout tone="info" icon={Lock}>Mode Presentasi mengunci isian di <b>semua layar</b> yang membuka aplikasi, bukan hanya layar Anda.</Callout>
              <Callout tone="info" icon={MessageSquarePlus}>Tombol <b>Catat Masukan</b> berwarna emas di kanan bawah selalu tersedia, termasuk saat Mode Presentasi aktif.</Callout>
            </div>
          </Bab>

          {/* 7. Ekspor */}
          <Bab id="ekspor" no={7} title="Ekspor dan Cetak">
            <div className="overflow-x-auto">
              <table className="kk-table">
                <thead><tr><th>Halaman</th><th className="w-36">Tombol</th><th>Hasil</th></tr></thead>
                <tbody>{EKSPOR.map((e) => (
                  <tr key={e.halaman}>
                    <td><Link href={e.href} className="font-semibold text-brand-700 hover:underline">{e.halaman}</Link></td>
                    <td><span className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[11.5px] font-semibold">
                      {e.tombol.includes("PDF") ? <Printer className="h-3 w-3" /> : <Download className="h-3 w-3" />}{e.tombol}</span></td>
                    <td>{e.hasil}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Bab>

          {/* 8. Tips */}
          <Bab id="tips" no={8} title="Tips dan Hal yang Perlu Diperhatikan">
            <div className="grid gap-3 md:grid-cols-2">
              {TIPS.map((t) => (
                <div key={t} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-[12.5px] leading-relaxed text-slate-700">
                  <Lightbulb className="h-4.5 w-4.5 shrink-0 text-gold" />{t}
                </div>
              ))}
            </div>
            <Callout tone="danger" icon={ShieldAlert}>
              Aplikasi ini <b>tanpa login</b>: siapa pun yang membuka alamatnya dapat membaca dan mengubah data. Gunakan hanya di jaringan internal dan jangan bagikan alamatnya ke pihak luar.
            </Callout>
          </Bab>

          {/* 9. FAQ */}
          <Bab id="faq" no={9} title="Pertanyaan Umum">
            <div className="relative max-w-md print:hidden">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pertanyaan…"
                className="w-full rounded-lg border border-line bg-white py-2 pr-3 pl-9 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" />
            </div>
            <Card className="divide-y divide-line">
              {faq.length === 0 && <div className="p-5 text-[13px] text-slate-500">Tidak ada pertanyaan yang cocok dengan “{q}”.</div>}
              {faq.map(({ f: [tanya, jawab], i }) => {
                const open = openFaq === i || q.trim() !== "";
                return (
                  <div key={i}>
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={open}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-[13.5px] font-semibold text-ink hover:bg-black/[0.02]">
                      <HelpCircle className="h-4 w-4 shrink-0 text-brand-600" />{tanya}
                      <ChevronDown className={clsx("ml-auto h-4 w-4 shrink-0 text-slate-400 transition print:hidden", open && "rotate-180")} />
                    </button>
                    <div className={clsx("px-5 pb-4 pl-12 text-[12.5px] leading-relaxed text-slate-600", !open && "hidden print:block")}>{jawab}</div>
                  </div>
                );
              })}
            </Card>
            <Card className="flex flex-wrap items-center gap-4 p-5 print:hidden">
              <BarChart3 className="h-6 w-6 text-brand-600" />
              <div className="flex-1 text-[13px] text-slate-600">Siap mulai? Lihat kondisi kertas kerja saat ini di Dashboard atau jalankan Cek Kesiapan.</div>
              <GoLink href="/">Dashboard</GoLink>
              <GoLink href="/kesiapan">Cek Kesiapan</GoLink>
            </Card>
          </Bab>
        </div>
      </div>
    </SheetPage>
  );
}

// ---------- komponen kecil ----------
function Bab({ id, no, title, children }: { id: string; no: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 break-inside-avoid-page">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-800 text-[13px] font-bold text-white">{no}</span>
        <h2 className="text-[18px] font-extrabold tracking-tight text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Step({ n }: { n: number }) {
  return <span className="relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-[12.5px] font-bold text-brand-900 ring-4 ring-paper">{n}</span>;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink">{children}</kbd>;
}

function Callout({ tone, icon: Icon, children }: { tone: "info" | "warn" | "danger"; icon?: React.ElementType; children: React.ReactNode }) {
  const I = Icon ?? (tone === "info" ? HelpCircle : ShieldAlert);
  return (
    <div className={clsx("flex gap-3 rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed",
      tone === "info" && "border-sky-200 bg-sky-50 text-sky-950",
      tone === "warn" && "border-amber-200 bg-amber-50 text-amber-950",
      tone === "danger" && "border-rose-200 bg-rose-50 text-rose-950")}>
      <I className={clsx("mt-0.5 h-4 w-4 shrink-0", tone === "info" ? "text-sky-600" : tone === "warn" ? "text-amber-600" : "text-rose-600")} />
      <div>{children}</div>
    </div>
  );
}

function GoLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-800">
      {children}<ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}
