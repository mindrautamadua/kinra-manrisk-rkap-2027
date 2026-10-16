"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowDown, ArrowUpRight, Brain, CheckCircle2, Compass, Gauge, Lightbulb, ListChecks, Map as MapIcon, Printer, RotateCcw, Scale, ShieldCheck,
  Target, ThumbsDown, ThumbsUp, TrendingUp, Wrench,
} from "lucide-react";
import { Button, Card, SheetPage } from "@/components/ui";

// ---------- konten ----------
const TOC = [
  { id: "inti", label: "Gagasan Inti" },
  { id: "analogi", label: "Analogi Sederhana" },
  { id: "alur", label: "Alur Berpikir 7 Pertanyaan" },
  { id: "kalimat", label: "Cara Menulis Risiko" },
  { id: "keterkaitan", label: "Semua Lembar Saling Terkait" },
  { id: "salah-kaprah", label: "Salah Kaprah vs Benar" },
  { id: "prinsip", label: "Prinsip Pegangan" },
  { id: "periksa", label: "Periksa Diri" },
  { id: "istilah", label: "Kamus Istilah" },
];

const ANALOGI = [
  { icon: MapIcon, perjalanan: "Tujuan: tiba di kampung sebelum Lebaran", rkap: "Sasaran strategis dan target RKAP 2027" },
  { icon: Gauge, perjalanan: "Seberapa berani: boleh ngebut atau harus santai karena bawa anak kecil?", rkap: "Risk Appetite Statement (RAS) per kategori risiko" },
  { icon: Compass, perjalanan: "Apa yang bisa menghambat: macet, ban bocor, cuaca buruk, uang habis", rkap: "Risk Driver dan Risk Register" },
  { icon: Scale, perjalanan: "Mana yang paling berbahaya: ban bocor di tol malam hari lebih serius dari macet sebentar", rkap: "Probabilitas × dampak, Risiko Utama" },
  { icon: Wrench, perjalanan: "Persiapan: servis mobil, bawa ban serep, berangkat lebih awal", rkap: "Rencana mitigasi dan rencana aksi (PIC, biaya, jadwal)" },
  { icon: ShieldCheck, perjalanan: "Rambu batas: bensin di bawah ¼ wajib isi, jam 22.00 wajib istirahat", rkap: "Risk Acceptance Matrix (RAM) dan Corporate Action Threshold (CAT)" },
];

type Langkah = { tanya: string; maksud: string; hasil: string; lembar: { label: string; href: string }[]; jebakan: string };
const ALUR: Langkah[] = [
  {
    tanya: "Apa yang ingin kita capai tahun 2027?",
    maksud: "Manajemen risiko selalu dimulai dari sasaran, bukan dari daftar hal buruk. Tanpa sasaran yang jelas, kita tidak tahu risiko mana yang penting.",
    hasil: "Daftar sasaran strategis RJPP dan angka target RKAP (pendapatan, laba, investasi, okupansi kawasan, dsb.).",
    lembar: [{ label: "Sasaran Strategis RJPP", href: "/sasaran-strategis" }, { label: "Data Keuangan RKAP", href: "/data-keuangan" }],
    jebakan: "Langsung mengisi Risk Register tanpa membaca target RKAP.",
  },
  {
    tanya: "Seberapa besar risiko yang boleh kita ambil?",
    maksud: "Setiap perusahaan punya batas keberanian berbeda per jenis risiko. Kepatuhan hukum biasanya nol toleransi; pengembangan bisnis boleh lebih berani.",
    hasil: "Sikap risiko (Zero Tolerance / Conservative / Moderate / Aggressive) dan pernyataan selera risiko per kategori. Sikap entitas tidak boleh lebih longgar dari Induk.",
    lembar: [{ label: "Risk Appetite Statement", href: "/ras" }],
    jebakan: "Menyalin RAS Induk apa adanya tanpa menimbang kondisi PT KINRA.",
  },
  {
    tanya: "Pakai ukuran apa untuk menilai besar-kecilnya risiko?",
    maksud: "Supaya semua orang menilai dengan penggaris yang sama. \"Dampak besar\" bagi satu orang bisa \"kecil\" bagi yang lain bila tidak ada kriteria.",
    hasil: "Skala dampak (Sangat Rendah sampai Sangat Tinggi) dalam rupiah dan kriteria non-keuangan.",
    lembar: [{ label: "Kriteria Dampak", href: "/kriteria-dampak" }],
    jebakan: "Menebak kategori dampak berdasarkan perasaan, bukan nilai rupiah.",
  },
  {
    tanya: "Apa saja yang bisa menggagalkan sasaran itu?",
    maksud: "Cari peristiwa yang benar-benar bisa terjadi di bisnis kita, lengkap dengan penyebab dan akibatnya pada target.",
    hasil: "Risk event dari Taksonomi PTPN Group, dengan risk driver, root cause, dan dampak yang tertulis jelas.",
    lembar: [{ label: "Risk Driver", href: "/risk-driver" }, { label: "Risk Register", href: "/risk-register" }, { label: "Taksonomi", href: "/taksonomi" }],
    jebakan: "Menulis risiko umum yang berlaku untuk perusahaan mana pun, atau menulis penyebab sebagai risiko.",
  },
  {
    tanya: "Seberapa besar dan mana yang paling penting?",
    maksud: "Tidak semua risiko perlu perhatian yang sama. Besar risiko = peluang terjadi × besar kerugian (expected loss). Fokuskan energi pada yang terbesar.",
    hasil: "Probabilitas, nilai dampak, kategori dampak, dan daftar Risiko Utama (Moderat ke atas) sebagai kandidat Top Risk.",
    lembar: [{ label: "Risk Register", href: "/risk-register" }, { label: "Risiko Utama", href: "/risiko-utama" }],
    jebakan: "Semua risiko dinilai Moderat supaya aman, sehingga prioritas tidak terlihat.",
  },
  {
    tanya: "Apa yang akan kita lakukan, dan sampai level berapa risikonya turun?",
    maksud: "Mitigasi harus menyerang akar penyebab, punya penanggung jawab, waktu, biaya, dan hasil yang bisa dicek. Lalu tetapkan target sisa risiko (residual) yang masih dalam selera risiko.",
    hasil: "Rencana mitigasi (Preventive / Detective / Corrective), rencana aksi terstruktur, dan target residual risk.",
    lembar: [{ label: "Risk Register", href: "/risk-register" }, { label: "Program Strategis GRCS", href: "/program-strategis" }],
    jebakan: "Mitigasi berbunyi \"meningkatkan koordinasi\" atau \"melakukan monitoring\" tanpa PIC, waktu, dan target.",
  },
  {
    tanya: "Bagaimana kita tahu masih di jalur aman?",
    maksud: "Pasang rambu berupa angka. Bila indikator melewati batas, ada tindakan yang sudah disepakati sebelumnya. Aksi korporasi besar juga punya batas persetujuan.",
    hasil: "Parameter RAM dengan threshold (limit, appetite, tolerance) dan statusnya, rencana pengendalian untuk status Kuning ke atas, serta CAT.",
    lembar: [{ label: "Rekap Parameter", href: "/rekap" }, { label: "Lembar Parameter", href: "/parameter/1a" }, { label: "RAM", href: "/ram" }, { label: "CAT", href: "/cat" }],
    jebakan: "Parameter RAM berstatus Merah tetapi tidak ada risiko di Risk Register yang menjelaskannya.",
  },
];

const RUMUS = [
  { bagian: "Karena …", isi: "Penyebab (root cause / risk driver)", warna: "bg-sky-50 text-sky-900 ring-sky-200" },
  { bagian: "mungkin terjadi …", isi: "Peristiwa risiko (risk event)", warna: "bg-amber-50 text-amber-900 ring-amber-200" },
  { bagian: "sehingga …", isi: "Dampak pada sasaran, sebaiknya dalam rupiah", warna: "bg-rose-50 text-rose-900 ring-rose-200" },
];

const CONTOH: { buruk: string; kenapa: string; baik: string }[] = [
  {
    buruk: "Risiko keuangan.",
    kenapa: "Ini nama kategori, bukan risiko. Tidak ada penyebab, peristiwa, maupun dampak.",
    baik: "Karena calon tenant menunda investasi akibat kepastian pasokan energi belum terjamin, mungkin terjadi penjualan/sewa lahan kawasan di bawah rencana, sehingga pendapatan 2027 berkurang sekitar Rp X miliar dari target RKAP.",
  },
  {
    buruk: "Kurangnya SDM.",
    kenapa: "Ini penyebab, belum risiko. Perlu dijelaskan apa yang terjadi dan apa akibatnya pada target.",
    baik: "Karena posisi kunci teknik belum terisi, mungkin terjadi keterlambatan penyelesaian proyek infrastruktur kawasan, sehingga capaian investasi 2027 hanya Y% dan tenant baru tertunda masuk.",
  },
  {
    buruk: "Mitigasi: meningkatkan koordinasi dengan pihak terkait.",
    kenapa: "Tidak jelas siapa, kapan, berapa biayanya, dan bagaimana mengukur berhasil atau tidaknya.",
    baik: "Kepala Divisi Pemasaran menandatangani MoU pasokan energi dengan penyedia sebelum Maret 2027 (biaya Rp Z juta); keberhasilan diukur dari minimal 2 LOI tenant baru pada semester I.",
  },
];

const RANTAI = [
  { label: "Sasaran RJPP & Target RKAP", href: "/sasaran-strategis" },
  { label: "RAS", href: "/ras" },
  { label: "Risk Register", href: "/risk-register" },
  { label: "Risiko Utama / Top Risk", href: "/risiko-utama" },
  { label: "RAM & Parameter", href: "/ram" },
  { label: "Executive Summary", href: "/executive-summary" },
];
const KAITAN = [
  ["Sasaran → Risiko", "Setiap risiko utama menjawab: sasaran mana yang terancam? Bila tidak ada sasaran yang terancam, risiko itu mungkin tidak relevan."],
  ["RAS → Target residual", "Sisa risiko setelah mitigasi harus masuk selera risiko kategorinya. Sikap Conservative berarti target residual paling tinggi Rendah."],
  ["Risiko → Parameter RAM", "Risiko utama dikaitkan ke parameter RAM yang akan bergerak bila risiko itu terjadi, dan sebaliknya parameter berstatus buruk perlu dijelaskan oleh risiko."],
  ["Kriteria Dampak → Kategori", "Nilai dampak rupiah di Risk Register harus jatuh di kategori yang sesuai dengan Kriteria Dampak, bukan dipilih bebas."],
  ["Mitigasi → Anggaran", "Rencana aksi yang butuh biaya harus tertampung di RKAP. Mitigasi tanpa anggaran hanyalah niat."],
];

const SALAH_KAPRAH: [string, string][] = [
  ["Manajemen risiko = mengisi template supaya lolos reviu.", "Manajemen risiko = cara memastikan target RKAP tercapai. Template hanya alat bantu berpikir."],
  ["Makin banyak risiko yang ditulis, makin bagus.", "Lebih baik 10–15 risiko yang tajam dan relevan daripada 50 risiko generik."],
  ["Risiko harus dibuat kecil agar terlihat aman.", "Risiko dinilai jujur. Risiko besar yang diakui dan dimitigasi jauh lebih baik daripada yang disembunyikan."],
  ["Risiko adalah urusan unit Manajemen Risiko.", "Pemilik risiko adalah unit yang menjalankan bisnisnya. Unit Manajemen Risiko memfasilitasi dan menantang (challenge)."],
  ["Setiap lembar diisi sendiri-sendiri.", "Semua lembar adalah satu cerita: sasaran, selera risiko, risiko, mitigasi, dan indikator harus nyambung."],
  ["Mitigasi = kegiatan rutin yang sudah ada.", "Kegiatan rutin adalah existing control. Mitigasi adalah tindakan tambahan untuk menurunkan risiko ke target residual."],
];

const PRINSIP = [
  { icon: Target, judul: "Mulai dari sasaran", isi: "Risiko selalu \"risiko terhadap sesuatu\". Tanyakan dulu: target apa yang bisa gagal?" },
  { icon: TrendingUp, judul: "Angka, bukan kata sifat", isi: "\"Besar\", \"signifikan\", \"cukup\" tidak bisa diuji. Pakai rupiah, persen, tanggal." },
  { icon: Brain, judul: "Serang akar penyebab", isi: "Mitigasi yang hanya memadamkan gejala membuat risiko yang sama muncul lagi tahun depan." },
  { icon: CheckCircle2, judul: "Satu risiko, satu pemilik", isi: "Setiap risiko dan aksi punya PIC yang jelas, bukan \"seluruh unit terkait\"." },
  { icon: Scale, judul: "Jujur dan wajar", isi: "Penilaian harus bisa dipertanggungjawabkan di depan challenger: datanya apa, dasarnya apa." },
  { icon: ShieldCheck, judul: "Konsisten lintas lembar", isi: "Bila satu angka berubah, periksa lembar lain yang terkait. Cek Kesiapan membantu menemukannya." },
];

const PERIKSA = [
  "Saya tahu tiga sasaran/target RKAP 2027 terpenting yang dijaga oleh unit saya.",
  "Setiap risiko yang saya tulis memuat penyebab, peristiwa, dan dampak pada target.",
  "Nilai dampak saya nyatakan dalam rupiah dan kategorinya sesuai Kriteria Dampak.",
  "Probabilitas didasarkan pada data atau pengalaman, bukan tebakan.",
  "Setiap mitigasi punya PIC, jadwal, biaya, dan ukuran keberhasilan.",
  "Target residual risk saya sudah masuk selera risiko kategorinya di RAS.",
  "Biaya mitigasi sudah dimasukkan ke anggaran RKAP.",
  "Risiko utama saya terhubung ke parameter RAM yang relevan.",
  "Parameter RAM berstatus Kuning/Oranye/Merah sudah punya rencana pengendalian.",
  "Saya siap menjawab pertanyaan challenger: \"apa datanya?\" dan \"kenapa angkanya segitu?\"",
];

const ISTILAH: [string, string][] = [
  ["Risiko", "Kemungkinan terjadinya sesuatu yang membuat sasaran tidak tercapai."],
  ["Risk event", "Peristiwa risikonya itu sendiri, misalnya \"keterlambatan proyek\"."],
  ["Risk driver / root cause", "Pemicu atau akar penyebab yang membuat peristiwa risiko bisa terjadi."],
  ["Probabilitas", "Seberapa mungkin peristiwa terjadi dalam setahun."],
  ["Dampak", "Seberapa besar kerugian bila peristiwa terjadi, sebaiknya dalam rupiah."],
  ["Expected loss", "Probabilitas × nilai dampak. Perkiraan kerugian rata-rata, dipakai untuk mengurutkan risiko."],
  ["Risiko inheren", "Besar risiko dengan kontrol yang ada sekarang, sebelum mitigasi tambahan."],
  ["Target residual risk", "Besar risiko yang diharapkan tersisa setelah mitigasi dijalankan."],
  ["Existing control", "Pengendalian yang sudah berjalan saat ini."],
  ["Mitigasi Preventive / Detective / Corrective", "Mencegah terjadi / mendeteksi lebih dini / memperbaiki setelah terjadi."],
  ["Risk appetite (selera risiko)", "Jumlah dan jenis risiko yang bersedia diambil untuk mencapai sasaran."],
  ["Risk tolerance / limit", "Batas penyimpangan yang masih bisa diterima / batas maksimal yang tidak boleh dilewati."],
  ["RAM", "Risk Acceptance Matrix: indikator keuangan/operasional dengan batas-batasnya dan status Hijau sampai Merah."],
  ["CAT", "Corporate Action Threshold: batas nilai aksi korporasi yang memerlukan persetujuan tertentu."],
  ["Top risk", "Risiko terpenting yang dipaparkan kepada pimpinan dan Induk."],
  ["GRCS", "Governance, Risk Management, Compliance, Sustainability: empat pilar program strategis."],
];

const KUNCI_PERIKSA = "kerangka-berpikir-periksa";

// ---------- halaman ----------
export default function KerangkaBerpikirPage() {
  const [aktif, setAktif] = useState(TOC[0].id);
  const [cek, setCek] = useState<boolean[]>(() => PERIKSA.map(() => false));

  // Centang daftar periksa diingat per browser
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KUNCI_PERIKSA) || "null");
      if (Array.isArray(v)) setCek(PERIKSA.map((_, i) => !!v[i]));
    } catch {}
  }, []);
  const ubahCek = (next: boolean[]) => {
    setCek(next);
    try { localStorage.setItem(KUNCI_PERIKSA, JSON.stringify(next)); } catch {}
  };

  // Sorot bagian daftar isi sesuai posisi gulir
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setAktif(vis[0].target.id);
    }, { rootMargin: "-80px 0px -65% 0px" });
    TOC.forEach((t) => { const el = document.getElementById(t.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const jumlahCek = cek.filter(Boolean).length;

  return (
    <SheetPage title="Kerangka Berpikir Perencanaan Manajemen Risiko" code="Pola Pikir · RKAP 2027" offline
      actions={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Cetak</Button>}>
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
          {/* 1. Inti */}
          <Bab id="inti" no={1} title="Gagasan Inti">
            <Card className="overflow-hidden">
              <div className="bg-brand-900 px-6 py-7 text-white">
                <div className="text-[11px] font-bold tracking-[0.16em] text-gold uppercase">Satu kalimat untuk diingat</div>
                <p className="mt-3 max-w-3xl text-[18px] leading-snug font-semibold text-white md:text-[20px]">
                  Perencanaan manajemen risiko adalah memikirkan <span className="text-gold">apa yang bisa menggagalkan target RKAP 2027</span>, lalu menyiapkan langkah dan rambu agar target itu tetap tercapai.
                </p>
              </div>
              <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[["Bukan sekadar mengisi formulir", "Template adalah alat bantu berpikir"], ["Bukan mencari kesalahan", "Melindungi target bersama"], ["Bukan urusan satu unit", "Setiap pemilik proses adalah pemilik risiko"]].map(([a, b]) => (
                  <div key={a} className="px-5 py-4"><div className="text-[13px] font-bold text-ink">{a}</div><div className="text-[12px] text-slate-500">{b}</div></div>
                ))}
              </div>
            </Card>
          </Bab>

          {/* 2. Analogi */}
          <Bab id="analogi" no={2} title="Analogi Sederhana: Merencanakan Mudik">
            <p className="text-[13px] leading-relaxed text-slate-600">Menyusun RKAP manajemen risiko mirip merencanakan perjalanan mudik keluarga. Kita tidak menunggu ban bocor dulu baru berpikir; kita bersiap sebelum berangkat.</p>
            <Card className="divide-y divide-line">
              <div className="hidden grid-cols-[40px_1fr_1fr] gap-4 px-5 py-2.5 text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase md:grid">
                <span /><span>Saat merencanakan mudik</span><span>Dalam RKAP manajemen risiko</span>
              </div>
              {ANALOGI.map((a) => (
                <div key={a.rkap} className="grid gap-2 px-5 py-3.5 md:grid-cols-[40px_1fr_1fr] md:items-center md:gap-4">
                  <a.icon className="h-5 w-5 text-brand-600" />
                  <div className="text-[13px] text-slate-700">{a.perjalanan}</div>
                  <div className="text-[13px] font-semibold text-ink">{a.rkap}</div>
                </div>
              ))}
            </Card>
          </Bab>

          {/* 3. Alur */}
          <Bab id="alur" no={3} title="Alur Berpikir: 7 Pertanyaan Berurutan">
            <p className="text-[13px] leading-relaxed text-slate-600">Jawab pertanyaan berikut secara berurutan. Setiap jawaban menjadi bahan pertanyaan berikutnya, dan setiap pertanyaan punya lembar kertas kerjanya sendiri.</p>
            <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-line">
              {ALUR.map((l, i) => (
                <li key={l.tanya} className="relative flex gap-4">
                  <Step n={i + 1} />
                  <Card className="flex-1 p-5">
                    <div className="text-[15px] font-bold text-ink">{l.tanya}</div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">{l.maksud}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-950 ring-1 ring-emerald-200">
                        <div className="mb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-emerald-700 uppercase">Hasil yang diharapkan</div>{l.hasil}
                      </div>
                      <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] leading-relaxed text-rose-950 ring-1 ring-rose-200">
                        <div className="mb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-rose-700 uppercase">Jebakan umum</div>{l.jebakan}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-slate-400">Dikerjakan di:</span>
                      {l.lembar.map((x) => (
                        <Link key={x.href} href={x.href} className="group inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 font-semibold text-brand-700 hover:border-brand-500">
                          {x.label}<ArrowUpRight className="h-3 w-3 text-slate-400 group-hover:text-brand-600" />
                        </Link>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
            <Callout icon={Lightbulb}>
              Setelah ketujuh pertanyaan terjawab, jalankan <Link href="/kesiapan" className="font-semibold underline">Cek Kesiapan</Link> lalu periksa <Link href="/executive-summary" className="font-semibold underline">Executive Summary</Link>. Bila ringkasan itu bisa dibaca pimpinan sebagai satu cerita yang utuh, perencanaan sudah berada di jalur yang benar.
            </Callout>
          </Bab>

          {/* 4. Kalimat risiko */}
          <Bab id="kalimat" no={4} title="Cara Menulis Risiko yang Baik">
            <p className="text-[13px] leading-relaxed text-slate-600">Gunakan rumus tiga bagian. Bila salah satu bagian tidak bisa diisi, risikonya belum dipahami dengan baik.</p>
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
              {RUMUS.map((r, i) => (
                <div key={r.bagian} className="contents">
                  <div className={clsx("flex-1 rounded-xl px-4 py-3 ring-1", r.warna)}>
                    <div className="text-[15px] font-bold">{r.bagian}</div>
                    <div className="text-[12px] opacity-80">{r.isi}</div>
                  </div>
                  {i < RUMUS.length - 1 && <ArrowDown className="mx-auto h-4 w-4 shrink-0 text-slate-400 md:-rotate-90" />}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {CONTOH.map((c) => (
                <Card key={c.buruk} className="grid gap-0 overflow-hidden md:grid-cols-2">
                  <div className="border-b border-line p-4 md:border-r md:border-b-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-rose-600 uppercase"><ThumbsDown className="h-3.5 w-3.5" />Kurang tepat</div>
                    <div className="mt-1.5 text-[13.5px] font-semibold text-ink">“{c.buruk}”</div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{c.kenapa}</p>
                  </div>
                  <div className="bg-emerald-50/50 p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-emerald-700 uppercase"><ThumbsUp className="h-3.5 w-3.5" />Lebih baik</div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{c.baik}</p>
                  </div>
                </Card>
              ))}
            </div>
            <p className="text-[11.5px] text-slate-400">Angka X, Y, Z adalah ilustrasi. Ganti dengan angka dari data RKAP dan kondisi nyata.</p>
          </Bab>

          {/* 5. Keterkaitan */}
          <Bab id="keterkaitan" no={5} title="Semua Lembar Adalah Satu Cerita">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                {RANTAI.map((r, i) => (
                  <div key={r.href} className="flex items-center gap-2">
                    <Link href={r.href} className="rounded-lg bg-brand-800 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-700">{r.label}</Link>
                    {i < RANTAI.length - 1 && <ArrowDown className="h-4 w-4 -rotate-90 text-slate-400" />}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-slate-600">Reviewer akan membaca dari kiri ke kanan dan dari kanan ke kiri. Setiap angka di Executive Summary harus bisa ditelusuri balik sampai ke sasaran yang dilindunginya.</p>
            </Card>
            <div className="grid gap-3 md:grid-cols-2">
              {KAITAN.map(([j, i]) => (
                <div key={j} className="rounded-xl border border-line bg-white p-4">
                  <div className="text-[13px] font-bold text-ink">{j}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{i}</p>
                </div>
              ))}
            </div>
            <GoLink href="/keterkaitan">Lihat Keterkaitan Risiko–RAM</GoLink>
          </Bab>

          {/* 6. Salah kaprah */}
          <Bab id="salah-kaprah" no={6} title="Salah Kaprah vs Pola Pikir yang Benar">
            <Card className="divide-y divide-line overflow-hidden">
              {SALAH_KAPRAH.map(([salah, benar]) => (
                <div key={salah} className="grid md:grid-cols-2">
                  <div className="flex gap-2.5 px-5 py-3.5 text-[12.5px] leading-relaxed text-slate-500 md:border-r md:border-line">
                    <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /><span className="line-through decoration-rose-300">{salah}</span>
                  </div>
                  <div className="flex gap-2.5 bg-emerald-50/40 px-5 py-3.5 text-[12.5px] leading-relaxed font-medium text-ink">
                    <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{benar}
                  </div>
                </div>
              ))}
            </Card>
          </Bab>

          {/* 7. Prinsip */}
          <Bab id="prinsip" no={7} title="Enam Prinsip Pegangan">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {PRINSIP.map((p) => (
                <Card key={p.judul} className="p-5">
                  <p.icon className="h-5 w-5 text-brand-600" />
                  <div className="mt-2 text-[14px] font-bold text-ink">{p.judul}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{p.isi}</p>
                </Card>
              ))}
            </div>
          </Bab>

          {/* 8. Periksa diri */}
          <Bab id="periksa" no={8} title="Periksa Diri Sebelum Challenge Session">
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <ListChecks className="h-5 w-5 text-brand-600" />
                <div className="text-[13px] font-bold text-ink">{jumlahCek} dari {PERIKSA.length} terpenuhi</div>
                <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={clsx("h-full rounded-full transition-all", jumlahCek === PERIKSA.length ? "bg-emerald-500" : "bg-gold")} style={{ width: `${(jumlahCek / PERIKSA.length) * 100}%` }} />
                </div>
                {jumlahCek > 0 && (
                  <button onClick={() => ubahCek(PERIKSA.map(() => false))} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-ink print:hidden">
                    <RotateCcw className="h-3.5 w-3.5" />Ulangi
                  </button>
                )}
              </div>
              <ul className="grid gap-1 md:grid-cols-2">
                {PERIKSA.map((p, i) => (
                  <li key={p}>
                    <label className="flex cursor-pointer gap-3 rounded-lg px-2 py-2 text-[12.5px] leading-relaxed text-slate-700 hover:bg-black/[0.03]">
                      <input type="checkbox" checked={cek[i]} onChange={() => ubahCek(cek.map((v, j) => (j === i ? !v : v)))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600" />
                      <span className={clsx(cek[i] && "text-slate-400 line-through")}>{p}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] text-slate-400">Centang hanya tersimpan di browser ini sebagai catatan pribadi.</p>
            </Card>
            {jumlahCek === PERIKSA.length && (
              <Callout icon={CheckCircle2}>Semua terpenuhi. Lanjutkan dengan <Link href="/kesiapan" className="font-semibold underline">Cek Kesiapan</Link> untuk pemeriksaan otomatis atas seluruh kertas kerja.</Callout>
            )}
          </Bab>

          {/* 9. Istilah */}
          <Bab id="istilah" no={9} title="Kamus Istilah dalam Bahasa Sehari-hari">
            <Card className="divide-y divide-line">
              {ISTILAH.map(([k, a]) => (
                <div key={k} className="grid gap-1 px-5 py-3 md:grid-cols-[240px_1fr] md:gap-4">
                  <div className="text-[13px] font-bold text-ink">{k}</div>
                  <div className="text-[12.5px] leading-relaxed text-slate-600">{a}</div>
                </div>
              ))}
            </Card>
            <Card className="flex flex-wrap items-center gap-4 p-5 print:hidden">
              <Lightbulb className="h-6 w-6 text-gold" />
              <div className="flex-1 text-[13px] text-slate-600">Sudah paham kerangkanya? Lihat cara memakai aplikasi di Panduan Penggunaan, atau mulai dari sasaran strategis.</div>
              <GoLink href="/panduan">Panduan Penggunaan</GoLink>
              <GoLink href="/sasaran-strategis">Mulai dari Sasaran</GoLink>
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

function Callout({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12.5px] leading-relaxed text-sky-950">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
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
