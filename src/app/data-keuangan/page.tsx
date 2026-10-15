"use client";
import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Check, CheckCircle2, FileUp, Link2, RefreshCw, Trash2, X } from "lucide-react";
import { Button, Card, EditCell, ErrorBox, Loading, Section, SheetPage, Stat, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { angka, persen, rupiah } from "@/lib/format";
import {
  BULAN, GRUP, LABEL_SUMBER, POS, TAUTAN, bacaKertasKerja, ebitda, nilaiTautan, periksa, samaNilai, terapkanKeParameter, type HasilBaca,
} from "@/lib/rkap";
import type { ParameterSheet, RkapKeuangan } from "@/lib/types";

const butuhMigrasi = (e: string) => /rkap_keuangan|schema cache|tidak diizinkan/i.test(e);
const tebakNama = (f: string) => { const m = f.match(/draft\s+([ivx]+|\d+)/i); return m ? `Draft ${m[1].toUpperCase()}` : f.replace(/\.xlsx?$/i, ""); };
const jutaan = (v: number | null | undefined) => (v == null ? "–" : angka(v / 1e6));
const tumbuh = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b === 0 ? null : a / b - 1);

export default function DataKeuanganPage() {
  const q = useLoad(async () => {
    const [list, params] = await Promise.all([api.rkapList(), api.params()]);
    return { list, params };
  });
  const saver = useSaver();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<(HasilBaca & { file: string; nama: string }) | null>(null);
  const [bacaErr, setBacaErr] = useState<string | null>(null);
  const [pilih, setPilih] = useState<string | null>(null);
  const [bulanan, setBulanan] = useState(false);

  const list = q.data?.list ?? [];
  const aktif = list.find((r) => r.aktif) ?? null;
  const tampil = list.find((r) => r.id === pilih) ?? aktif ?? list[0] ?? null;

  const unggah = async (f: File) => {
    setBacaErr(null);
    try { setDraft({ ...(await bacaKertasKerja(f)), file: f.name, nama: tebakNama(f.name) }); }
    catch (e) { setBacaErr((e as Error).message); }
  };

  const simpan = (jadikanAktif: boolean) => draft && saver.run(async () => {
    if (jadikanAktif && aktif) await api.update<RkapKeuangan>("rkap_keuangan", "id", aktif.id, { aktif: false });
    const row = await api.insert<RkapKeuangan>("rkap_keuangan", {
      nama: draft.nama || "Tanpa nama", sumber: `${draft.file} · ${draft.data.sheet}`, aktif: jadikanAktif, data: draft.data,
    });
    setDraft(null); setPilih(row.id);
    await q.reload();
  });

  const aktifkan = (r: RkapKeuangan) => saver.run(async () => {
    if (aktif) await api.update<RkapKeuangan>("rkap_keuangan", "id", aktif.id, { aktif: false });
    await api.update<RkapKeuangan>("rkap_keuangan", "id", r.id, { aktif: true });
    await q.reload();
  });
  const hapus = (r: RkapKeuangan) => {
    if (!confirm(`Hapus versi "${r.nama}"? Isian lembar parameter yang sudah diterapkan tidak ikut berubah.`)) return;
    saver.run(async () => { await api.remove("rkap_keuangan", "id", r.id); if (pilih === r.id) setPilih(null); await q.reload(); });
  };
  const patchRow = (r: RkapKeuangan, p: Partial<RkapKeuangan>) => {
    q.setData(q.data && { ...q.data, list: list.map((x) => (x.id === r.id ? { ...x, ...p } : x)) });
    saver.run(() => api.update<RkapKeuangan>("rkap_keuangan", "id", r.id, p));
  };
  const terapkan = (codes?: string[]) => aktif && saver.run(async () => {
    await terapkanKeParameter(aktif, codes);
    await q.reload();
  });

  return (
    <SheetPage code="Master Data" title="Data Keuangan RKAP 2027"
      note={`Ringkasan Laba Rugi Konsolidasi dari Kertas Kerja RKAP (sheet "BD RL_REKAP KONSOLIDASI SMNT"). Satu unggahan = satu versi (Draft II, Draft III, Final). Versi aktif menjadi sumber angka EBITDA dan total pendapatan pada lembar parameter, sehingga angka kertas kerja manajemen risiko sama dengan RKAP keuangan.\n\nSemua nilai disimpan dalam rupiah penuh. Tabel menampilkan Rp juta.`}
      actions={<>
        {saver.indicator}
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); e.target.value = ""; }} />
        <Button edit onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" />Unggah Kertas Kerja RKAP</Button>
      </>}>
      {bacaErr && <div className="mb-4"><ErrorBox error={bacaErr} /></div>}
      {draft && <Pratinjau draft={draft} setNama={(nama) => setDraft({ ...draft, nama })} onSimpan={simpan} onBatal={() => setDraft(null)} adaAktif={!!aktif} />}

      {q.loading ? <Loading variant="dashboard" /> : q.error ? (
        butuhMigrasi(q.error)
          ? <ErrorBox error="Tabel rkap_keuangan belum ada. Jalankan supabase/migrations/0005_rkap_keuangan.sql di SQL Editor Supabase, lalu muat ulang halaman." />
          : <ErrorBox error={q.error} />
      ) : !tampil ? (
        !draft && (
          <Card className="px-6 py-10 text-center">
            <FileUp className="mx-auto h-8 w-8 text-brand-600" />
            <div className="mt-3 text-[15px] font-bold">Belum ada data RKAP</div>
            <p className="mx-auto mt-1 max-w-lg text-[13px] text-slate-500">Unggah file Kertas Kerja RKAP 2027 (.xlsx). Aplikasi membaca sheet Laba Rugi Konsolidasi, menampilkan pratinjau dan hasil cek konsistensi, lalu menyimpannya sebagai satu versi.</p>
          </Card>
        )
      ) : (
        <>
          <Versi list={list} tampil={tampil} onPilih={setPilih} onAktifkan={aktifkan} onHapus={hapus} />
          <Ringkasan r={tampil} onBasis={(b) => patchRow(tampil, { ebitda_basis: b })} />
          {tampil.aktif
            ? <Tautan r={tampil} params={q.data?.params ?? []} onTerapkan={terapkan} />
            : <Card className="mb-8 px-4 py-3 text-[12.5px] text-amber-900">Versi ini tidak aktif. Lembar parameter hanya mengambil angka dari versi aktif.</Card>}
          <Section letter="C" title="Laba Rugi Konsolidasi" right={
            <label className="flex items-center gap-2 text-[12px] text-slate-600">
              <input type="checkbox" checked={bulanan} onChange={(e) => setBulanan(e.target.checked)} />Tampilkan bulanan 2027
            </label>}>
            <TabelLR r={tampil} bulanan={bulanan} onEdit={(kode, v) => patchRow(tampil, {
              data: { ...tampil.data, pos: { ...tampil.data.pos, [kode]: { ...tampil.data.pos[kode], tahun: v } } },
            })} />
            <p className="mt-2 text-[11.5px] text-slate-500">Dalam Rp juta. Kolom RKAP 2027 dapat dikoreksi manual (klik angka); koreksi hanya berlaku untuk versi ini.</p>
          </Section>
        </>
      )}
    </SheetPage>
  );
}

function Pratinjau({ draft, setNama, onSimpan, onBatal, adaAktif }: {
  draft: HasilBaca & { file: string; nama: string }; setNama: (v: string) => void; onSimpan: (aktif: boolean) => void; onBatal: () => void; adaAktif: boolean;
}) {
  const cek = periksa(draft.data);
  const p = draft.data.pos;
  return (
    <Card className="mb-8 overflow-hidden border-brand-500">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-brand-50 px-4 py-3">
        <div className="text-[14px] font-bold">Pratinjau unggahan</div>
        <div className="text-[12px] text-slate-500">{draft.file} · {draft.data.sheet}</div>
        <button onClick={onBatal} className="ml-auto text-slate-400 hover:text-ink" title="Batal"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Angka kunci RKAP 2027</div>
          <table className="w-full text-[13px]">
            <tbody>
              {(["total_pendapatan", "hpp", "beban_usaha", "laba_operasional", "laba_bersih", "ebitda_holding", "ebitda_komite"] as const).map((k) => (
                <tr key={k} className="border-b border-line/60">
                  <td className="py-1.5 text-slate-600">{POS.find((x) => x.kode === k)!.label}</td>
                  <td className="py-1.5 text-right font-semibold tabnum">{rupiah(p[k]?.tahun, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-[12px] text-slate-500">{Object.keys(p).length} dari {POS.length} pos terbaca · pembanding: {draft.data.pembanding.join(", ") || "–"}</div>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Cek konsistensi</div>
          <ul className="space-y-1.5 text-[12.5px]">
            {cek.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                <span><span className="font-medium">{c.label}</span> <span className="text-slate-500">· {c.detail}</span></span>
              </li>
            ))}
            {draft.peringatan.map((w) => (
              <li key={w} className="flex items-start gap-2 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{w}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <label className="text-[12.5px] font-semibold text-slate-600">Nama versi</label>
        <input value={draft.nama} onChange={(e) => setNama(e.target.value)} className="w-48 rounded-lg border border-line px-2.5 py-1.5 text-[13px] focus:border-brand-500 focus:outline-none" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => onSimpan(false)}>Simpan saja</Button>
          <Button onClick={() => onSimpan(true)}><Check className="h-4 w-4" />Simpan &amp; jadikan aktif</Button>
        </div>
      </div>
      {adaAktif && <div className="border-t border-line bg-paper/60 px-4 py-2 text-[11.5px] text-slate-500">&quot;Jadikan aktif&quot; menggantikan versi aktif saat ini. Lembar parameter diperbarui setelah Anda menekan &quot;Terapkan&quot; pada bagian Keterkaitan.</div>}
    </Card>
  );
}

function Versi({ list, tampil, onPilih, onAktifkan, onHapus }: {
  list: RkapKeuangan[]; tampil: RkapKeuangan; onPilih: (id: string) => void; onAktifkan: (r: RkapKeuangan) => void; onHapus: (r: RkapKeuangan) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {list.map((r) => (
        <div key={r.id} className={clsx("flex items-center gap-2 rounded-full border py-1 pr-2 pl-3 text-[12.5px]",
          r.id === tampil.id ? "border-brand-500 bg-brand-50" : "border-line bg-white")}>
          <button onClick={() => onPilih(r.id)} className="font-semibold" title={r.sumber ?? undefined}>{r.nama}</button>
          <span className="text-[11px] text-slate-500">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
          {r.aktif
            ? <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10.5px] font-bold text-white">AKTIF</span>
            : <button data-edit onClick={() => onAktifkan(r)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 hover:bg-slate-200">Aktifkan</button>}
          <button data-edit onClick={() => onHapus(r)} className="text-slate-400 hover:text-rose-600" title="Hapus versi"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function Ringkasan({ r, onBasis }: { r: RkapKeuangan; onBasis: (b: "holding" | "komite") => void }) {
  const p = r.data.pos;
  const prog = (k: string) => p[k]?.pembanding?.["Prognosa 2026"];
  const sub = (k: string) => {
    const g = tumbuh(p[k]?.tahun, prog(k));
    return g == null ? "–" : <span className={g >= 0 ? "text-emerald-700" : "text-rose-700"}>{g >= 0 ? "+" : ""}{persen(g)} vs Prognosa 2026</span>;
  };
  const segmen = POS.filter((x) => x.segmen && (p[x.kode]?.tahun ?? 0) > 0)
    .map((x) => ({ ...x, v: p[x.kode]!.tahun! }))
    .sort((a, b) => b.v - a.v);
  const total = p.total_pendapatan?.tahun ?? segmen.reduce((a, s) => a + s.v, 0);
  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Pendapatan" value={rupiah(p.total_pendapatan?.tahun, true)} sub={sub("total_pendapatan")} accent="bg-brand-600" />
        <Stat label="Laba Operasional" value={rupiah(p.laba_operasional?.tahun, true)} sub={sub("laba_operasional")} accent="bg-brand-600" />
        <Stat label="EBITDA" value={rupiah(ebitda(r), true)} accent="bg-gold" sub={
          <span className="inline-flex gap-1">
            {(["holding", "komite"] as const).map((b) => (
              <button key={b} data-edit onClick={() => onBasis(b)} className={clsx("rounded px-1.5 py-0.5 text-[11px] font-semibold",
                r.ebitda_basis === b ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                {b === "holding" ? "Versi Holding" : "Versi Komite Audit"}
              </button>
            ))}
          </span>} />
        <Stat label="Laba Bersih" value={rupiah(p.laba_bersih?.tahun, true)} sub={sub("laba_bersih")} accent="bg-brand-600" />
      </div>
      <Section letter="A" title="Komposisi Pendapatan per Segmen 2027" right={<span className="text-[12px] text-slate-500">Dasar Parameter U2 (Konsentrasi Pendapatan)</span>}>
        <Card className="p-4">
          <ul className="space-y-2">
            {segmen.map((s, i) => {
              const share = total ? s.v / total : 0;
              return (
                <li key={s.kode} className="grid grid-cols-[150px_1fr_130px] items-center gap-3 text-[12.5px]" title={`${s.label}: ${rupiah(s.v)} (${persen(share)})`}>
                  <span className={clsx("truncate", i === 0 ? "font-semibold" : "text-slate-600")}>{s.label}</span>
                  <span className="h-3 rounded-r bg-slate-100"><span className="block h-3 rounded-r bg-brand-600" style={{ width: `${Math.max(share * 100, 0.5)}%`, opacity: i === 0 ? 1 : 0.55 }} /></span>
                  <span className="text-right tabnum"><span className="font-semibold">{persen(share)}</span> <span className="text-slate-500">· {rupiah(s.v, true)}</span></span>
                </li>
              );
            })}
          </ul>
          {segmen[0] && total > 0 && segmen[0].v / total > 0.5 && (
            <p className="mt-3 border-t border-line pt-3 text-[12px] text-amber-900">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-amber-600" />
              {segmen[0].label} menyumbang {persen(segmen[0].v / total)} pendapatan. Konsentrasi ini layak tercermin pada risk register dan Parameter U2.
            </p>
          )}
        </Card>
      </Section>
    </>
  );
}

function Tautan({ r, params, onTerapkan }: { r: RkapKeuangan; params: ParameterSheet[]; onTerapkan: (codes?: string[]) => void }) {
  const baris = useMemo(() => TAUTAN.map((t) => {
    const sekarang = params.find((p) => p.code === t.code)?.inputs?.[t.addr];
    const target = nilaiTautan(t, r);
    const status = sekarang == null || sekarang === "" ? "Kosong" : samaNilai(sekarang, target) ? "Sesuai" : "Berbeda";
    return { ...t, sekarang, target, status };
  }), [params, r]);
  const perlu = baris.filter((b) => b.status !== "Sesuai");
  return (
    <Section letter="B" title="Keterkaitan ke Lembar Parameter" right={
      <Button edit disabled={!perlu.length} onClick={() => onTerapkan()}><RefreshCw className="h-4 w-4" />Terapkan ke {perlu.length} sel</Button>}>
      <TableWrap>
        <table className="kk-table w-full text-[12.5px]">
          <thead><tr><th>Lembar</th><th>Sel</th><th>Isian</th><th>Satuan</th><th className="text-right">Nilai di lembar</th><th className="text-right">Nilai RKAP aktif</th><th>Status</th><th /></tr></thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.code + b.addr}>
                <td><Link href={`/parameter/${b.code}`} className="font-semibold text-brand-700 hover:underline">{b.code}</Link></td>
                <td className="font-mono text-[11.5px]">{b.addr}</td>
                <td>{LABEL_SUMBER[b.sumber]}</td>
                <td>{b.satuan}</td>
                <td className="text-right tabnum">{typeof b.sekarang === "number" ? angka(b.sekarang, b.satuan === "Rp juta" ? 2 : 0) : b.sekarang ? <span className="text-rose-700" title="Isian berupa teks, bukan angka">&quot;{String(b.sekarang)}&quot;</span> : "–"}</td>
                <td className="text-right font-semibold tabnum">{angka(b.target, b.satuan === "Rp juta" ? 2 : 0)}</td>
                <td>
                  <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    b.status === "Sesuai" ? "bg-emerald-50 text-emerald-800" : b.status === "Kosong" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800")}>
                    {b.status === "Sesuai" ? <Check className="h-3 w-3" /> : b.status === "Berbeda" ? <AlertTriangle className="h-3 w-3" /> : null}{b.status}
                  </span>
                </td>
                <td>{b.status !== "Sesuai" && <button data-edit onClick={() => onTerapkan([b.code])} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:underline"><Link2 className="h-3 w-3" />Terapkan</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-2 text-[11.5px] text-slate-500">Terapkan menulis nilai RKAP ke sel kuning lembar parameter (sudah dikonversi ke satuan sel) dan menghitung ulang hasil pengukurannya. Isian lain pada lembar tidak berubah.</p>
    </Section>
  );
}

function TabelLR({ r, bulanan, onEdit }: { r: RkapKeuangan; bulanan: boolean; onEdit: (kode: string, v: number | null) => void }) {
  const p = r.data.pos;
  const pemb = r.data.pembanding;
  const acuan = pemb.includes("Prognosa 2026") ? "Prognosa 2026" : pemb[pemb.length - 1];
  return (
    <TableWrap>
      <table className="kk-table w-full text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[240px]">Uraian</th>
            {pemb.map((x) => <th key={x} className="text-right">{x}</th>)}
            <th className="text-right">RKAP 2027</th>
            {acuan && <th className="text-right">Δ vs {acuan}</th>}
            {bulanan && BULAN.map((b) => <th key={b} className="text-right">{b}</th>)}
          </tr>
        </thead>
        <tbody>
          {GRUP.map((g) => (
            <Fragment key={g}>
              <tr><td colSpan={pemb.length + 3 + (bulanan ? 12 : 0)} className="!bg-cell-label text-[11px] font-bold tracking-wide text-slate-600 uppercase">{g}</td></tr>
              {POS.filter((x) => x.grup === g).map((x) => {
                const v = p[x.kode];
                const d = tumbuh(v?.tahun, v?.pembanding?.[acuan]);
                return (
                  <tr key={x.kode} className={clsx(x.total && "font-semibold")}>
                    <td className={clsx("sticky left-0 z-[1]", !x.total && "pl-6")}>{x.label}</td>
                    {pemb.map((k) => <td key={k} className="text-right text-slate-600 tabnum">{jutaan(v?.pembanding?.[k])}</td>)}
                    <td className="bg-cell-input/60 text-right">
                      <EditCell kind="number" value={v?.tahun == null ? null : v.tahun / 1e6} display={(n) => angka(n as number)}
                        onSave={(n) => onEdit(x.kode, n == null ? null : Math.round((n as number) * 1e6))} />
                    </td>
                    {acuan && <td className={clsx("text-right tabnum", d == null ? "text-slate-400" : d >= 0 ? "text-emerald-700" : "text-rose-700")}>{d == null ? "–" : `${d >= 0 ? "+" : ""}${persen(d)}`}</td>}
                    {bulanan && BULAN.map((_, i) => <td key={i} className="text-right text-slate-600 tabnum">{jutaan(v?.bulan?.[i])}</td>)}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
