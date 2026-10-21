"use client";
import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ExternalLink, FileText, Search } from "lucide-react";
import { ErrorBox, Loading, Section, SelectCell, SheetPage, Stat, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { isTopRisk, rupiah } from "@/lib/format";
import { buildRam, type RamRow } from "@/lib/ram";
import { ebitda } from "@/lib/rkap";
import { elTarget } from "@/lib/target-risiko";
import {
  miliar, muatReferensi, namaDok, saranPadanan, selisih, urlPdf, type HalamanRef, type KodeDok, type PadananReferensi, type Referensi,
} from "@/lib/referensi";
import type { MitigasiAksi, RiskRegister, RkapKeuangan } from "@/lib/types";

const TAB = [
  { k: "kawasan", label: "Target Kawasan 2026–2030" },
  { k: "rjpp", label: "Profil Risiko RJPP" },
  { k: "dkmr", label: "Pembanding DKMR 2027" },
  { k: "isi", label: "Isi Dokumen" },
] as const;
type Tab = (typeof TAB)[number]["k"];

interface DataApp { register: RiskRegister[]; aksi: MitigasiAksi[] | null; rkap: RkapKeuangan | null; ram: RamRow[]; padanan: PadananReferensi }
type Simpan = (kunci: string, v: PadananReferensi[string] | null) => void;

/** Eksposur inheren: expected_loss bila terisi (> 0), selain itu probabilitas × nilai dampak. */
const eksInheren = (r: RiskRegister) =>
  Number(r.expected_loss) > 0 ? Number(r.expected_loss) : r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;

export default function ReferensiStrategisPage() {
  const [tab, setTab] = useState<Tab>("kawasan");
  const [buka, setBuka] = useState<{ dok: KodeDok; hal: number } | null>(null);
  const q = useLoad(async (): Promise<DataApp> => {
    const [register, aksi, rkap, params, ras, pengendalian, tambahan, padanan] = await Promise.all([
      api.register(), api.mitigasiAksi(), api.rkapAktif().catch(() => null), api.params(), api.ras(), api.pengendalian(), api.ramTambahan(),
      api.padananReferensi().catch(() => ({}) as PadananReferensi),
    ]);
    return { register, aksi, rkap, ram: buildRam(params, ras, pengendalian, tambahan), padanan };
  });
  const qr = useLoad(muatReferensi);
  const R = qr.data?.ref;
  const saver = useSaver();
  const simpan: Simpan = (kunci, v) => {
    const padanan = { ...q.data!.padanan };
    if (v) padanan[kunci] = v; else delete padanan[kunci];
    q.setData({ ...q.data!, padanan });
    saver.run(() => api.savePadananReferensi(padanan));
  };
  const lihat = (dok: KodeDok, hal: number) => { setBuka({ dok, hal }); setTab("isi"); };

  return (
    <SheetPage title="Referensi Strategis RKAP 2027" code="Master Data" actions={saver.indicator}
      note={"Ringkasan dua dokumen acuan penyusunan Rencana Manajemen Risiko 2027: Rencana Strategis Pengembangan Kawasan 2026–2030 (Draft RJPP) dan Presentasi DKMR RKAP 2027. Angka disalin apa adanya dari dokumen beserta nomor halamannya. Inkonsistensi di dokumen sumber ditandai ⚠ dan tidak dikoreksi.\n\nData DKMR dipakai sebagai pembanding, bukan input: angka aplikasi tetap bersumber dari lembar kerja masing-masing."}>
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TAB.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={clsx("rounded-lg px-3.5 py-2 text-[13px] font-semibold transition", tab === t.k ? "bg-white text-brand-800 shadow-sm" : "text-slate-600 hover:text-ink")}>
            {t.label}
          </button>
        ))}
      </div>
      {qr.loading ? <Loading variant="stats-table" /> : qr.error ? <ErrorBox error={qr.error} /> : R && qr.data && (
        <>
          {tab === "kawasan" && <TabKawasan R={R} lihat={lihat} rkap={q.data?.rkap ?? null} />}
          {tab === "rjpp" && (q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : q.data && <TabRjpp R={R} d={q.data} lihat={lihat} simpan={simpan} />)}
          {tab === "dkmr" && (q.loading ? <Loading variant="stats-table" /> : q.error ? <ErrorBox error={q.error} /> : q.data && <TabDkmr R={R} d={q.data} lihat={lihat} simpan={simpan} />)}
          {tab === "isi" && <TabIsi R={R} halaman={qr.data.halaman} buka={buka} />}
        </>
      )}
    </SheetPage>
  );
}

// ---------- komponen kecil ----------
function Hal({ dok, hal, lihat }: { dok: KodeDok; hal: number | string; lihat: (d: KodeDok, h: number) => void }) {
  const n = typeof hal === "number" ? hal : Number(String(hal).match(/\d+/)?.[0]);
  return (
    <button onClick={() => n && lihat(dok, n)} title={`Buka ${namaDok(dok)} hal ${hal}`}
      className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-slate-600 hover:bg-brand-50 hover:text-brand-700">
      hal {hal}
    </button>
  );
}

function Peringatan({ judul, list, dok, lihat }: { judul: string; list: { hal?: string; isi: string }[]; dok?: KodeDok; lihat: (d: KodeDok, h: number) => void }) {
  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-[12.5px] text-amber-950">
      <div className="mb-1.5 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 text-amber-600" />{judul}</div>
      <ul className="space-y-1">
        {list.map((p, i) => (
          <li key={i} className="flex gap-2"><span>⚠</span><span className="flex-1">{p.isi}</span>{p.hal && dok && <Hal dok={dok} hal={p.hal} lihat={lihat} />}</li>
        ))}
      </ul>
    </div>
  );
}

const BELUM = "status:belum_ada", TAK = "status:tidak_relevan";
/** Pilihan padanan risiko referensi di Risk Register; saran otomatis hanya ditawarkan, tidak disimpan sampai dipilih. */
function Padanan({ kunci, acuan, d, simpan }: { kunci: string; acuan: string; d: DataApp; simpan: Simpan }) {
  const p = d.padanan[kunci];
  const nilai = p?.risk_id ?? (p?.status ? `status:${p.status}` : null);
  const opsi = [
    ...d.register.filter((r) => r.risk_event).map((r, i) => ({ value: r.id, label: `#${i + 1} ${r.risk_event}` })),
    { value: BELUM, label: "— Belum ada di Risk Register" }, { value: TAK, label: "— Tidak relevan untuk 2027" },
  ];
  const saran = !nilai ? saranPadanan(acuan, d.register, (r) => r.risk_event) : null;
  const putus = (v: string | null) =>
    simpan(kunci, !v ? null : v.startsWith("status:") ? { status: v.slice(7) as "belum_ada" | "tidak_relevan" } : { risk_id: v });
  const hilang = p?.risk_id && !d.register.some((r) => r.id === p.risk_id);
  return (
    <div className={clsx("rounded-md", nilai === BELUM && "bg-rose-50", !nilai && "bg-amber-50/80", hilang && "bg-rose-50")}>
      <SelectCell value={nilai} options={opsi} onSave={putus} placeholder="Belum diperiksa…" />
      {hilang && <div className="px-1 text-[11px] text-rose-700">Risiko yang dipilih sudah dihapus dari Register.</div>}
      {saran && (
        <button data-edit onClick={() => putus(saran.id)} className="px-1 text-left text-[11px] text-brand-700 hover:underline">
          Saran: {saran.risk_event} (klik untuk pakai)
        </button>
      )}
    </div>
  );
}
const statusPadanan = (d: DataApp, kunci: string) => {
  const p = d.padanan[kunci];
  return p?.risk_id && d.register.some((r) => r.id === p.risk_id) ? "ada" : p?.status ?? "belum";
};

const fmt = (v: number, d = 2) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// ---------- Tab 1: target kawasan ----------
function TabKawasan({ R, lihat, rkap }: { R: Referensi; lihat: (d: KodeDok, h: number) => void; rkap: RkapKeuangan | null }) {
  const k = R.kawasan;
  const th = k.tahun;
  const i27 = th.indexOf(2027);
  const pendapatanApp = rkap?.data.pos.total_pendapatan?.tahun ?? null;
  const ebitdaApp = rkap ? ebitda(rkap) : null;
  const banding = [
    { label: "Total Pendapatan 2027", rjpp: k.keuangan.baris[0].nilai[i27], app: pendapatanApp, hal: 68 },
    { label: "EBITDA 2027", rjpp: k.keuangan.baris[4].nilai[i27], app: ebitdaApp, hal: 68 },
  ];
  return (
    <>
      <Section letter="A" title="Kondisi Awal 2025" right={<Hal dok="renstra" hal={k.kondisi_2025.hal} lihat={lihat} />}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {k.kondisi_2025.item.map((x) => <Stat key={x.label} label={x.label} value={<span className="text-[22px]">{x.nilai}</span>} sub={x.ket} />)}
        </div>
      </Section>

      <Section letter="B" title="Aspirasi 2030 per Pilar" right={<Hal dok="renstra" hal={k.aspirasi_2030.hal} lihat={lihat} />}>
        <p className="mb-1 text-[13px] text-slate-700"><b>Purpose:</b> {k.aspirasi_2030.purpose}</p>
        <p className="mb-3 text-[13px] text-slate-700">{k.aspirasi_2030.evolusi}</p>
        <TableWrap>
          <table className="kk-table">
            <thead><tr><th className="w-56">Pilar</th><th>Target 2030</th><th className="w-20">Sumber</th></tr></thead>
            <tbody>{k.aspirasi_2030.target_pilar.map((p) => (
              <tr key={p.pilar}><td className="font-semibold">{p.pilar}</td><td>{p.target}</td><td className="text-center"><Hal dok="renstra" hal={p.hal} lihat={lihat} /></td></tr>
            ))}</tbody>
          </table>
        </TableWrap>
        <Link href="/sasaran-strategis" className="mt-2 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline">Bandingkan dengan Sasaran Strategis RJPP →</Link>
      </Section>

      <Section letter="C" title={`Proyeksi Keuangan 2026–2030 (${k.keuangan.satuan})`}>
        <TabelTahun th={th} rows={[...k.keuangan.baris.map((b) => ({ label: b.label, sel: b.nilai.map((v) => fmt(v)), hal: b.hal })),
          ...k.keuangan.rasio.map((b) => ({ label: b.label, sel: b.nilai, hal: b.hal }))]} lihat={lihat} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {banding.map((b) => {
            const s = selisih(b.app != null ? b.app / 1e9 : null, b.rjpp);
            return (
              <div key={b.label} className="glass rounded-xl px-4 py-3 text-[12.5px]">
                <div className="font-bold text-ink">{b.label}: RJPP vs Data Keuangan RKAP</div>
                <div className="mt-1 flex flex-wrap gap-x-5 text-slate-700">
                  <span>RJPP {miliar(b.rjpp)}</span>
                  <span>Aplikasi {b.app != null ? rupiah(b.app, true) : <Link href="/data-keuangan" className="text-brand-700 hover:underline">belum diunggah</Link>}</span>
                  {s != null && <span className={clsx("font-semibold", Math.abs(s) > 0.1 ? "text-amber-700" : "text-emerald-700")}>{s >= 0 ? "+" : ""}{fmt(s * 100, 1)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section letter="D" title="Proyeksi Operasional dan Capex">
        <TabelTahun th={th} rows={[
          ...k.operasional.baris.map((b) => ({ label: `${b.label} (${b.satuan})`, sel: b.nilai.map((v) => fmt(v, v % 1 ? 2 : 0)), hal: b.hal })),
          ...k.capex.versi.map((b) => ({ label: `CAPEX – ${b.label} (Rp M)`, sel: b.nilai.map((v) => fmt(v)), hal: b.hal, warn: true })),
          { label: `${k.capex.opex.label} (Rp M)`, sel: k.capex.opex.nilai.map((v) => fmt(v)), hal: k.capex.opex.hal },
        ]} lihat={lihat} />
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold text-ink">Realisasi vs RKAP 2021–2025 <Hal dok="renstra" hal={k.operasional.historis.hal} lihat={lihat} /></div>
          <TabelTahun th={k.operasional.historis.tahun} rows={k.operasional.historis.baris.map((b) => ({ label: b.label, sel: b.nilai.map((v) => fmt(v, v % 1 ? 2 : 0)) }))} lihat={lihat} />
        </div>
      </Section>

      <Section letter="E" title="Roadmap dan Inisiatif Strategis">
        <div className="mb-3 grid gap-2 md:grid-cols-5">
          {k.roadmap.map((r) => (
            <div key={r.tahun} className="glass rounded-xl px-3 py-2.5 text-[12px]"><div className="text-[15px] font-extrabold text-brand-800">{r.tahun}</div>{r.tema}</div>
          ))}
        </div>
        <TableWrap>
          <table className="kk-table min-w-[800px]">
            <thead><tr><th className="w-16">Tahun</th><th className="w-48">Pilar</th><th>Inisiatif</th><th className="w-20">Sumber</th></tr></thead>
            <tbody>{k.inisiatif.map((x) => (
              <tr key={x.hal}><td className="text-center">{x.tahun}</td><td>{x.pilar}</td><td className="font-semibold">{x.nama}</td><td className="text-center"><Hal dok="renstra" hal={x.hal} lihat={lihat} /></td></tr>
            ))}</tbody>
          </table>
        </TableWrap>
      </Section>

      <Peringatan judul="Inkonsistensi di dokumen Renstra" list={k.peringatan} dok="renstra" lihat={lihat} />
    </>
  );
}

function TabelTahun({ th, rows, lihat }: { th: number[]; rows: { label: string; sel: string[]; hal?: number; warn?: boolean }[]; lihat: (d: KodeDok, h: number) => void }) {
  return (
    <TableWrap>
      <table className="kk-table min-w-[820px]">
        <thead><tr><th className="text-left">Uraian</th>{th.map((t) => <th key={t} className="w-24">{t}</th>)}<th className="w-20">Sumber</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.label}>
            <td className={clsx(!r.label.startsWith("•") && "font-semibold", r.label.startsWith("•") && "pl-5 text-slate-600")}>{r.warn && <span title="Lihat catatan inkonsistensi">⚠ </span>}{r.label.replace(/^•\s*/, "")}</td>
            {r.sel.map((v, i) => <td key={i} className="text-right tabnum">{v}</td>)}
            <td className="text-center">{r.hal && <Hal dok="renstra" hal={r.hal} lihat={lihat} />}</td>
          </tr>
        ))}</tbody>
      </table>
    </TableWrap>
  );
}

// ---------- Tab 2: profil risiko RJPP ----------
function TabRjpp({ R, d, lihat, simpan }: { R: Referensi; d: DataApp; lihat: (d: KodeDok, h: number) => void; simpan: Simpan }) {
  const r = R.risiko_rjpp;
  const st = r.daftar.map((x) => statusPadanan(d, `renstra:${x.no}`));
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Risiko Jangka Panjang" value={r.daftar.length} sub={<Hal dok="renstra" hal={r.hal} lihat={lihat} />} accent="bg-brand-600" />
        <Stat label="Punya Padanan di Register" value={st.filter((s) => s === "ada").length}
          sub={`${st.filter((s) => s === "belum_ada").length} belum ada · ${st.filter((s) => s === "belum").length} belum diperiksa`} accent="bg-emerald-500" />
        <Stat label="Rata-rata Rating" value={`${fmt(r.rating.inheren, 1)} → ${fmt(r.rating.residual, 1)}`} sub="Inheren → residual" accent="bg-amber-500" />
        <Stat label="Kapasitas Risiko RJPP" value={miliar(r.ambang.capacity, 0)} sub={`Toleransi ${miliar(r.ambang.tolerance, 0)} · Selera ${miliar(r.ambang.appetite, 0)} · Batas ${miliar(r.ambang.limit, 0)}`} accent="bg-rose-500" />
      </div>
      <Section letter="A" title="Daftar Risiko Jangka Panjang dan Padanannya di Risk Register 2027">
        <p className="mb-2 text-[12.5px] text-slate-500">Pilih risiko Register yang mewakili tiap risiko RJPP, atau tandai belum ada / tidak relevan untuk 2027. Pilihan tersimpan dan bisa dipakai sebagai bahan Log Challenge. {r.catatan}</p>
        <TableWrap>
          <table className="kk-table min-w-[1200px]">
            <thead><tr>
              <th className="w-10">No</th><th className="w-60">Risiko RJPP</th><th className="w-20">Inheren (P×D)</th><th>Rencana Perlakuan</th>
              <th className="w-56">Biaya</th><th className="w-28">Target</th><th className="w-72">Padanan di Risk Register</th><th className="w-16">Sumber</th>
            </tr></thead>
            <tbody>{r.daftar.map((x) => (
              <tr key={x.no}>
                <td className="text-center">{x.no}</td><td className="font-semibold">{x.nama}</td>
                <td className="text-center tabnum">{x.inheren ? `${x.inheren[0]}×${x.inheren[1]}` : "–"}</td>
                <td className="text-[12px]">{x.perlakuan}<div className="mt-0.5 text-slate-500">Program: {x.program}</div></td>
                <td className="text-[12px]">{x.biaya}</td><td className="text-[12px]">{x.target}</td>
                <td><Padanan kunci={`renstra:${x.no}`} acuan={x.nama} d={d} simpan={simpan} /></td>
                <td className="text-center"><Hal dok="renstra" hal={x.hal} lihat={lihat} /></td>
              </tr>
            ))}</tbody>
          </table>
        </TableWrap>
      </Section>
    </>
  );
}

// ---------- Tab 3: pembanding DKMR ----------
function TabDkmr({ R, d, lihat, simpan }: { R: Referensi; d: DataApp; lihat: (d: KodeDok, h: number) => void; simpan: Simpan }) {
  const k = R.dkmr;
  const utama = d.register.filter((r) => r.risk_event && isTopRisk(r.kategori_dampak));
  const jumlahApp = {
    total: utama.length,
    high: utama.filter((r) => r.kategori_dampak === "Sangat Tinggi" || r.kategori_dampak === "Tinggi").length,
    moderat: utama.filter((r) => r.kategori_dampak === "Moderat").length,
  };
  const jumlah = (f: (r: RiskRegister) => number | null) => utama.reduce((s, r) => s + (f(r) ?? 0), 0);
  const idUtama = new Set(utama.map((r) => r.id));
  const biayaApp = d.aksi ? d.aksi.filter((a) => idUtama.has(a.risk_id)).reduce((s, a) => s + (a.biaya ?? 0), 0) : null;
  const elIn = jumlah(eksInheren), elRes = jumlah(elTarget);
  const tanpaTarget = utama.filter((r) => elTarget(r) == null).length;
  const peristiwa = k.risiko_t4.flatMap((t) => t.peristiwa);
  const stP = peristiwa.map((p) => statusPadanan(d, `dkmr:${p.hal}`));

  const baris: { label: string; dkmr: string; app: string; s: number | null; href: string }[] = [
    { label: "Jumlah risiko utama", dkmr: `${k.jumlah.total} (T4 agregat)`, app: `${jumlahApp.total} risk event`, s: null, href: "/risiko-utama" },
    { label: "• High / Tinggi ke atas", dkmr: String(k.jumlah.high), app: String(jumlahApp.high), s: null, href: "/risiko-utama" },
    { label: "• Moderate to High / Moderat", dkmr: String(k.jumlah.moderate_to_high + k.jumlah.moderate), app: String(jumlahApp.moderat), s: null, href: "/risiko-utama" },
    { label: "Eksposur risiko inheren", dkmr: miliar(k.eksposur.inheren), app: rupiah(elIn, true), s: selisih(elIn / 1e9, k.eksposur.inheren), href: "/risk-register" },
    { label: "Total biaya perlakuan", dkmr: miliar(k.eksposur.biaya_perlakuan), app: biayaApp == null ? "Migrasi 0008 belum dijalankan" : rupiah(biayaApp, true), s: biayaApp == null ? null : selisih(biayaApp / 1e9, k.eksposur.biaya_perlakuan), href: "/risk-register" },
    { label: "Eksposur risiko residual", dkmr: miliar(k.eksposur.residual), app: tanpaTarget === utama.length ? "Target residual belum diisi" : rupiah(elRes, true) + (tanpaTarget ? ` (${tanpaTarget} risiko tanpa target)` : ""), s: tanpaTarget === utama.length ? null : selisih(elRes / 1e9, k.eksposur.residual), href: "/risk-register" },
  ];

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Risk Capacity" value={miliar(k.ambang.capacity)} accent="bg-brand-600" />
        <Stat label="Risk Tolerance" value={miliar(k.ambang.tolerance)} accent="bg-amber-500" />
        <Stat label="Risk Appetite" value={miliar(k.ambang.appetite)} accent="bg-emerald-500" />
        <Stat label="Risk Limit" value={miliar(k.ambang.limit)} sub={<Hal dok="dkmr" hal={k.ambang.hal} lihat={lihat} />} accent="bg-rose-500" />
      </div>

      <Section letter="A" title="Ringkasan DKMR vs Data Aplikasi" right={<Hal dok="dkmr" hal={k.eksposur.hal} lihat={lihat} />}>
        <p className="mb-2 text-[12.5px] text-slate-500">Aplikasi menghitung dari risiko berkategori dampak Moderat ke atas di Risk Register (eksposur = probabilitas × nilai dampak; residual dari target residual). DKMR menyajikan 4 risiko agregat T4, jadi jumlah tidak harus sama, tetapi eksposur dan biaya seharusnya searah.</p>
        <TableWrap>
          <table className="kk-table min-w-[760px]">
            <thead><tr><th className="text-left">Ukuran</th><th className="w-48">DKMR 2027</th><th className="w-56">Aplikasi saat ini</th><th className="w-24">Selisih</th></tr></thead>
            <tbody>{baris.map((b) => (
              <tr key={b.label}>
                <td className={clsx(b.label.startsWith("•") ? "pl-5 text-slate-600" : "font-semibold")}>{b.label.replace(/^•\s*/, "")}</td>
                <td className="text-right tabnum">{b.dkmr}</td>
                <td className="text-right tabnum"><Link href={b.href} className="hover:underline">{b.app}</Link></td>
                <td className={clsx("text-right font-semibold tabnum", b.s == null ? "text-slate-400" : Math.abs(b.s) > 0.1 ? "!bg-amber-100/70 text-amber-800" : "text-emerald-700")}>
                  {b.s == null ? "–" : `${b.s >= 0 ? "+" : ""}${fmt(b.s * 100, 1)}%`}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </TableWrap>
      </Section>

      <Section letter="B" title="Risiko Utama DKMR (T4 → peristiwa risiko) dan Padanannya"
        right={<span className="text-[12px] text-slate-600">{stP.filter((s) => s === "ada").length}/{peristiwa.length} punya padanan · {stP.filter((s) => s === "belum").length} belum diperiksa</span>}>
        <TableWrap>
          <table className="kk-table min-w-[1200px]">
            <thead><tr>
              <th className="w-64">Risiko agregat T4</th><th className="w-36">Inheren → Residual</th><th className="w-60">Peristiwa risiko</th>
              <th className="min-w-72">Rencana perlakuan DKMR</th><th className="w-24">Biaya (Rp jt)</th><th className="w-72">Padanan di Risk Register</th><th className="w-16">Sumber</th>
            </tr></thead>
            <tbody>{k.risiko_t4.map((t) => t.peristiwa.map((p, i) => (
              <tr key={p.hal + p.nama}>
                {i === 0 && (
                  <>
                    <td rowSpan={t.peristiwa.length} className="align-top font-semibold">{t.no}. {t.nama}<div className="mt-1 text-[11.5px] font-normal text-slate-500">{t.kategori} · <Hal dok="dkmr" hal={t.hal} lihat={lihat} /></div></td>
                    <td rowSpan={t.peristiwa.length} className="align-top text-[12px]">{t.inheren}<div className="text-slate-500">→ {t.residual}</div><div className="mt-1 text-slate-500">Rp{fmt(t.eks_inheren, 0)} jt → Rp{fmt(t.eks_residual, 0)} jt</div></td>
                  </>
                )}
                <td className="font-semibold">{p.nama}</td><td className="text-[12px]">{p.perlakuan}</td>
                <td className="text-right tabnum">{fmt(p.biaya, p.biaya % 1 ? 1 : 0)}</td>
                <td><Padanan kunci={`dkmr:${p.hal}`} acuan={p.nama} d={d} simpan={simpan} /></td>
                <td className="text-center"><Hal dok="dkmr" hal={p.hal} lihat={lihat} /></td>
              </tr>
            )))}</tbody>
          </table>
        </TableWrap>
      </Section>

      <Section letter="C" title="Parameter Profil Risiko DKMR vs Risk Acceptance Matrix" right={<Hal dok="dkmr" hal={35} lihat={lihat} />}>
        <TableWrap>
          <table className="kk-table min-w-[1100px]">
            <thead><tr>
              <th className="w-52">Kategori</th><th className="w-64">Parameter DKMR</th><th className="w-20">Limit</th><th className="w-20">Appetite</th><th className="w-20">Tolerance</th>
              <th>Saran parameter RAM (kemiripan nama)</th>
            </tr></thead>
            <tbody>{k.parameter.map((p) => {
              const m = saranPadanan(p.nama, d.ram, (r) => r.parameter);
              return (
                <tr key={p.nama}>
                  <td className="text-[12px]">{p.kategori}</td><td className="font-semibold">{p.nama} <span className="font-normal text-slate-500">({p.satuan})</span></td>
                  <td className="text-center">{p.limit}</td><td className="text-center">{p.appetite}</td>
                  <td className={clsx("text-center", !p.tolerance && "!bg-amber-100/70")}>{p.tolerance ?? "kosong"}</td>
                  <td className="text-[12px]">
                    {m ? (
                      <Link href={`/parameter/${m.kode}`} className="hover:underline">
                        <span className="mr-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-500/30">{m.kode}</span>
                        {m.parameter} {!m.diterapkan && <span className="text-slate-400">(tidak diterapkan)</span>}
                      </Link>
                    ) : <Link href="/ram" className="text-slate-500 italic hover:underline">Tidak ada kemiripan nama; periksa di RAM</Link>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </TableWrap>
      </Section>

      <div className="space-y-3">
        <Peringatan judul="Perbedaan antardokumen" list={R.lintas_dokumen} lihat={lihat} />
        <Peringatan judul="Inkonsistensi di Presentasi DKMR (perlu dibereskan sebelum presentasi)" list={k.peringatan} dok="dkmr" lihat={lihat} />
      </div>
    </>
  );
}

// ---------- Tab 4: isi dokumen ----------
function TabIsi({ R, halaman, buka }: { R: Referensi; halaman: HalamanRef[]; buka: { dok: KodeDok; hal: number } | null }) {
  const [dok, setDok] = useState<KodeDok>(buka?.dok ?? "renstra");
  const [mode, setMode] = useState<"transkrip" | "pdf">("transkrip");
  const [cari, setCari] = useState("");
  const [seksi, setSeksi] = useState<string>("");
  const [aktif, setAktif] = useState<number | null>(buka?.hal ?? null);
  const [halPdf, setHalPdf] = useState<number>(buka?.hal ?? 1);
  const semua = halaman.filter((h) => h.dok === dok);
  const daftarSeksi = Array.from(new Set(semua.map((h) => h.seksi).filter(Boolean))) as string[];
  const list = useMemo(() => {
    const qs = cari.toLowerCase().trim();
    return semua.filter((h) => (!seksi || h.seksi === seksi) && (!qs || `${h.judul} ${h.isi}`.toLowerCase().includes(qs)));
  }, [semua, cari, seksi]);
  const doc = R.dokumen.find((x) => x.kode === dok)!;
  const jumlahCocok = (k: KodeDok) => halaman.filter((h) => h.dok === k && `${h.judul} ${h.isi}`.toLowerCase().includes(cari.toLowerCase().trim())).length;
  const lihatPdf = (hal: number) => { setHalPdf(hal); setMode("pdf"); };
  const tombol = (on: boolean) => clsx("rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ring-1", on ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-slate-700 ring-slate-200 hover:ring-brand-300");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {R.dokumen.map((x) => (
          <button key={x.kode} onClick={() => { setDok(x.kode); setSeksi(""); setAktif(null); setHalPdf(1); }} className={clsx("flex items-center gap-1.5", tombol(dok === x.kode))}>
            <FileText className="h-3.5 w-3.5" />{namaDok(x.kode)} ({cari.trim() && mode === "transkrip" ? `${jumlahCocok(x.kode)} cocok` : `${x.halaman} hal`})
          </button>
        ))}
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {(["transkrip", "pdf"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={clsx("rounded-md px-3 py-1 text-[12.5px] font-semibold", mode === m ? "bg-white text-brand-800 shadow-sm" : "text-slate-600")}>
              {m === "transkrip" ? "Transkrip" : "PDF asli"}
            </button>
          ))}
        </div>
        {mode === "transkrip" ? (
          <>
            <select value={seksi} onChange={(e) => setSeksi(e.target.value)} className="rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] ring-1 ring-slate-200">
              <option value="">Semua bagian</option>
              {daftarSeksi.map((s) => <option key={s}>{s}</option>)}
            </select>
            <label className="flex flex-1 items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200 md:max-w-xs">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kata, angka, risiko…" className="w-full bg-transparent text-[12.5px] outline-none" />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
            Halaman
            <input type="number" min={1} max={doc.halaman} value={halPdf} onChange={(e) => setHalPdf(Math.min(doc.halaman, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16 rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200" />
            dari {doc.halaman}
          </label>
        )}
        <a href={`${urlPdf(dok)}#page=${mode === "pdf" ? halPdf : aktif ?? 1}`} target="_blank" rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />Buka PDF di tab baru
        </a>
      </div>
      {mode === "pdf" ? (
        <div className="glass overflow-hidden rounded-xl">
          {/* key memuat ulang viewer saat dokumen/halaman berganti; #page dipahami penampil PDF bawaan browser */}
          <iframe key={`${dok}-${halPdf}`} src={`${urlPdf(dok)}#page=${halPdf}`} title={doc.judul} className="h-[calc(100vh-14rem)] min-h-[520px] w-full bg-white" />
          <p className="px-4 py-2 text-[11.5px] text-slate-500">Sumber: <i>{doc.file}</i>. Dimuat dari penyimpanan privat; tautan berlaku 15 menit, muat ulang bila kedaluwarsa.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[12px] text-slate-500">Sumber: <i>{doc.file}</i>. Transkrip per halaman; halaman bergambar dibaca ulang dari gambar slide. {list.length} dari {semua.length} halaman.</p>
          <div className="space-y-2">
            {list.map((h) => <KartuHalaman key={h.hal} h={h} buka={aktif === h.hal} toggle={() => setAktif(aktif === h.hal ? null : h.hal)} sorot={cari} lihatPdf={() => lihatPdf(h.hal)} />)}
            {!list.length && <p className="py-8 text-center text-[13px] text-slate-400">Tidak ada halaman yang cocok.</p>}
          </div>
        </>
      )}
    </>
  );
}

function KartuHalaman({ h, buka, toggle, sorot, lihatPdf }: { h: HalamanRef; buka: boolean; toggle: () => void; sorot: string; lihatPdf: () => void }) {
  const kosong = /^(Pembatas|\(halaman kosong\)|Penutup)/i.test(h.isi) || h.isi.length < 40;
  return (
    <div className={clsx("glass rounded-xl", kosong && "opacity-60")} ref={(el) => { if (buka && el) el.scrollIntoView({ block: "nearest" }); }}>
      <button onClick={toggle} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
        <span className="w-12 shrink-0 text-[11.5px] font-bold text-slate-500">Hal {h.hal}</span>
        <span className="flex-1 text-[13px] font-semibold text-ink">{h.judul}</span>
        {h.seksi && <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 md:inline">{h.seksi}</span>}
        {/⚠|tidak sama|berbeda|inkonsisten|identik|\[tidak terbaca\]/i.test(h.isi) && <span title="Ada catatan inkonsistensi/transkrip">⚠</span>}
      </button>
      {buka && (
        <div className="border-t border-slate-200/70 px-4 py-3">
          <button onClick={lihatPdf} className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline">
            <FileText className="h-3.5 w-3.5" />Lihat halaman {h.hal} di PDF asli
          </button>
          <Md teks={h.isi} sorot={sorot} />
        </div>
      )}
    </div>
  );
}

/** Penampil markdown ringkas untuk transkrip: tabel pipa, butir, judul tebal, paragraf. */
function Md({ teks, sorot }: { teks: string; sorot: string }) {
  const blok: React.ReactNode[] = [];
  const baris = teks.split("\n");
  for (let i = 0; i < baris.length; i++) {
    const l = baris[i];
    if (l.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < baris.length && baris[i].trim().startsWith("|")) {
        const sel = baris[i].trim().replace(/^\||\|$/g, "").split("|").map((s) => s.trim());
        if (!sel.every((s) => /^:?-{2,}:?$/.test(s))) rows.push(sel);
        i++;
      }
      i--;
      const [head, ...body] = rows;
      blok.push(
        <TableWrap key={i}>
          <table className="kk-table my-2 text-[12px]">
            <thead><tr>{head.map((c, j) => <th key={j}><Inline t={c} s={sorot} /></th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}><Inline t={c} s={sorot} /></td>)}</tr>)}</tbody>
          </table>
        </TableWrap>,
      );
    } else if (/^\s*[-*]\s/.test(l)) {
      blok.push(<div key={i} className="flex gap-2 pl-2 text-[12.5px]"><span>•</span><span><Inline t={l.replace(/^\s*[-*]\s/, "")} s={sorot} /></span></div>);
    } else if (l.trim()) {
      blok.push(<p key={i} className="my-1 text-[12.5px] leading-relaxed text-slate-800"><Inline t={l} s={sorot} /></p>);
    }
  }
  return <div>{blok}</div>;
}

function Inline({ t, s }: { t: string; s: string }) {
  const parts = t.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        const tebal = p.startsWith("**") && p.endsWith("**");
        const isi = tebal ? p.slice(2, -2) : p;
        return <Fragment key={i}>{tebal ? <b><Sorot t={isi} s={s} /></b> : <Sorot t={isi} s={s} />}</Fragment>;
      })}
    </>
  );
}

function Sorot({ t, s }: { t: string; s: string }) {
  const q = s.trim();
  if (!q) return <>{t}</>;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return <>{t.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-amber-200/70 px-0.5">{p}</mark> : p))}</>;
}
