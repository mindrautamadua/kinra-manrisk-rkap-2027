"use client";
import { Fragment, useMemo, useState } from "react";
import { AlertTriangle, Check, Download, Library, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  Button, DampakBadge, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, Stat, TableWrap, useLoad, useSaver,
} from "@/components/ui";
import { TaxonomyPicker, groupT3, type T3Option } from "@/components/TaxonomyPicker";
import { ParamPicker } from "@/components/ParamPicker";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import type { FieldSpec } from "@/lib/isi-ai";
import { paramOptions } from "@/lib/trace";
import { useReadonly } from "@/lib/mode";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import { exportRegister } from "@/lib/export";
import { cariKriteria, cekKualitas, ebitdaRkap, labelLevel, saranDampak, type Isu, type SaranDampak } from "@/lib/kualitas-register";
import { KATEGORI_DAMPAK, KATEGORI_MITIGASI, type RiskRegister } from "@/lib/types";

export default function RiskRegisterPage() {
  const q = useLoad(async () => {
    const [register, kategori, drivers, kriteria, tax, params, tambahan] = await Promise.all([
      api.register(), api.kategori(), api.drivers(), api.kriteria(), api.taksonomi(), api.params(), api.ramTambahan(),
    ]);
    return { register, kategori, drivers, kriteria, t3: groupT3(tax), popts: paramOptions(params, tambahan), ebitda: ebitdaRkap(params) };
  });
  const saver = useSaver();
  const ro = useReadonly();
  const [picker, setPicker] = useState<RiskRegister | null>(null);
  const [ai, setAi] = useState<RiskRegister | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [hanyaIsu, setHanyaIsu] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const d = q.data;

  /** Saran kategori dampak & isu kualitas per baris, dihitung ulang setiap data berubah. */
  const mutu = useMemo(() => {
    const m = new Map<string, { saran: SaranDampak | null; isu: Isu[] }>();
    for (const r of d?.register ?? []) {
      const saran = saranDampak(r, cariKriteria(d!.kriteria, r), d!.ebitda);
      m.set(r.id, { saran, isu: cekKualitas(r, saran) });
    }
    return m;
  }, [d]);
  const jumlahIsu = [...mutu.values()].filter((x) => x.isu.length).length;

  const rows = useMemo(() => (d?.register ?? []).filter((r) =>
    (!filter || r.kategori === filter) && (!hanyaIsu || !!mutu.get(r.id)?.isu.length) &&
    (!search || [r.risk_event, r.deskripsi, r.root_cause, r.rencana_mitigasi].some((x) => (x ?? "").toLowerCase().includes(search.toLowerCase())))), [d, filter, search, hanyaIsu, mutu]);

  const patch = (id: string, p: Partial<RiskRegister>) => {
    q.setData({ ...d!, register: d!.register.map((r) => (r.id === id ? { ...r, ...p } : r)) });
    saver.run(() => api.update<RiskRegister>("risk_register", "id", id, { ...p, updated_at: new Date().toISOString() } as Partial<RiskRegister>));
  };
  const add = () => saver.run(async () => {
    const urutan = Math.max(0, ...d!.register.map((r) => r.urutan)) + 1;
    const row = await api.insert<RiskRegister>("risk_register", { urutan, kategori: filter || null });
    q.setData({ ...d!, register: [...d!.register, row] });
  });
  const del = (r: RiskRegister) => {
    if (!confirm(`Hapus risiko "${r.risk_event ?? "tanpa nama"}"?`)) return;
    q.setData({ ...d!, register: d!.register.filter((x) => x.id !== r.id) });
    saver.run(() => api.remove("risk_register", "id", r.id));
  };
  const pick = (o: T3Option) => {
    if (!picker) return;
    patch(picker.id, { kategori: o.kategori, risk_event: o.risiko_korporat, deskripsi: o.definisi, taksonomi_kode: o.kode,
      ...(picker.kategori !== o.kategori ? { risk_driver: null, kriteria_dampak: null } : {}) });
    setPicker(null);
  };

  const bukaAi = (r: RiskRegister) => {
    if (!r.risk_event) { alert("Pilih Risk Event dari taksonomi terlebih dahulu, agar AI punya dasar penyusunan."); return; }
    setAi(r);
  };
  const aiFields = (r: RiskRegister): FieldSpec[] => {
    const drivers = d!.drivers.filter((x) => x.kategori === r.kategori).map((x) => x.driver);
    const krit = d!.kriteria.filter((x) => x.kategori === r.kategori).map((x) => `${x.kode}. ${x.kriteria}`);
    return [
      ...(drivers.length ? [{ key: "risk_driver", label: "Risk Driver", options: drivers }] : []),
      { key: "root_cause", label: "Root Cause" },
      { key: "deskripsi_dampak", label: "Deskripsi Dampak Risiko" },
      ...(krit.length ? [{ key: "kriteria_dampak", label: "Kriteria Dampak Acuan", options: krit }] : []),
      { key: "existing_control", label: "Existing Control" },
      { key: "rencana_mitigasi", label: "Rencana Mitigasi" },
      { key: "kategori_mitigasi", label: "Kategori Mitigasi", options: KATEGORI_MITIGASI },
    ];
  };
  const aiKonteks = (r: RiskRegister) => ({
    kategori: r.kategori, definisi_kategori: d!.kategori.find((k) => k.nama === r.kategori)?.definisi,
    taksonomi_kode: r.taksonomi_kode, risk_event: r.risk_event, deskripsi_risk_event: r.deskripsi,
    probabilitas: r.probabilitas, nilai_dampak_rp: r.nilai_dampak, kategori_dampak: r.kategori_dampak,
    parameter_ram_terkait: (r.parameter_ram ?? []).map((k) => { const o = d!.popts.find((x) => x.kode === k); return o ? `${k} ${o.parameter}` : k; }),
    contoh_baris: {
      risk_event: "Penurunan harga CPO", root_cause: "Kelebihan pasokan minyak nabati global", deskripsi_dampak: "Penurunan marjin penjualan CPO",
      existing_control: "Kontrak penjualan berjangka", rencana_mitigasi: "Menambah porsi kontrak penjualan berharga tetap", kategori_mitigasi: "Preventive",
    },
  });

  const total = d?.register.length ?? 0;
  const top = d?.register.filter((r) => isTopRisk(r.kategori_dampak)).length ?? 0;
  const el = d?.register.reduce((a, r) => a + Number(r.expected_loss ?? 0), 0) ?? 0;
  const dampak = d?.register.reduce((a, r) => a + Number(r.nilai_dampak ?? 0), 0) ?? 0;

  return (
    <SheetPage title="Risk Register RKAP 2027 - PT KINRA" code="Risk Register" note={note("Risk Register")} wide
      actions={<>{saver.indicator}<Button variant="outline" onClick={() => d && exportRegister(d.register)}><Download className="h-4 w-4" />Excel</Button><Button edit onClick={add}><Plus className="h-4 w-4" />Tambah Risiko</Button></>}>
      {q.loading ? <Loading variant="stats-table" /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Risiko Korporat" value={total} accent="bg-brand-600" />
            <Stat label="Top Risk (Risiko Utama)" value={top} sub="Dampak Moderat ke atas" accent="bg-orange-500" />
            <Stat label="Total Nilai Dampak" value={rupiah(dampak, true)} accent="bg-sky-500" />
            <Stat label="Total Expected Loss" value={rupiah(el, true)} accent="bg-rose-500" />
          </div>
          <Section letter="A" title="Risk Register" right={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setHanyaIsu((x) => !x)} disabled={!jumlahIsu && !hanyaIsu}
                className={clsx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] disabled:opacity-50", hanyaIsu ? "border-amber-400 bg-amber-50 text-amber-900" : "border-line bg-white")}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Perlu perbaikan ({jumlahIsu})
              </button>
              <div className="relative">
                <Search className="absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…" className="w-52 rounded-lg border border-line bg-white py-1.5 pr-3 pl-8 text-[13px] outline-none focus:border-brand-500" />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-line bg-white px-2 text-[13px]">
                <option value="">Semua kategori</option>
                {d.kategori.map((k) => <option key={k.no}>{k.nama}</option>)}
              </select>
            </div>}>
            <TableWrap>
              <table className="kk-table min-w-[2820px]">
                <thead><tr>
                  <th className="sticky left-0 z-[3] w-12">No</th>
                  <th className="w-40">Taksonomi Risiko</th><th className="w-48">Risk Driver</th><th className="w-56">Risk Event</th>
                  <th className="w-72">Deskripsi Risk Event</th><th className="w-60">Root Cause</th><th className="w-24">Probabilitas Kejadian (0%-100%)</th>
                  <th className="w-52">Deskripsi Dampak Risiko</th><th className="w-40">Nilai Dampak Risiko (Rp)</th><th className="w-52">Kriteria Dampak Acuan</th>
                  <th className="w-32">Kategori Dampak Risiko</th><th className="w-20">Tagging Top Risk</th><th className="w-40">Expected Loss (Rp)</th>
                  <th className="w-56">Existing Control</th><th className="w-56">Rencana Mitigasi</th><th className="w-32">Kategori Mitigasi</th><th className="w-52">Parameter RAM Terkait</th><th className="w-12" />
                </tr></thead>
                <tbody>
                  <tr className="example">
                    <td className="sticky left-0">Contoh</td><td>Risiko Pasar</td><td>Perubahan harga komoditas</td><td>Penurunan harga CPO</td><td>Harga CPO turun di bawah asumsi RKAP 2027.</td>
                    <td>Kelebihan pasokan minyak nabati global</td><td className="text-right">30%</td><td>Penurunan marjin penjualan CPO</td><td className="text-right">450.000.000.000</td>
                    <td>b. Dampak perubahan harga komoditas terhadap penurunan margin</td><td>Moderat</td><td>Ya</td><td className="text-right">135.000.000.000</td>
                    <td>Kontrak penjualan berjangka</td><td>Menambah porsi kontrak penjualan berharga tetap</td><td>Preventive</td><td>K1</td><td />
                  </tr>
                  {rows.map((r, i) => {
                    const drivers = d.drivers.filter((x) => x.kategori === r.kategori).map((x) => x.driver);
                    const krit = d.kriteria.filter((x) => x.kategori === r.kategori).map((x) => `${x.kode}. ${x.kriteria}`);
                    const driverUnknown = r.risk_driver && !drivers.includes(r.risk_driver);
                    const el = r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;
                    const { saran, isu } = mutu.get(r.id) ?? { saran: null, isu: [] };
                    const kriteria = cariKriteria(d.kriteria, r);
                    const dampakSalah = !!saran && !!r.kategori_dampak && r.kategori_dampak !== saran.level;
                    return (
                      <Fragment key={r.id}>
                      <tr>
                        <td className="sticky left-0 z-[1] text-center font-semibold">
                          {i + 1}
                          {isu.length > 0 && (
                            <button onClick={() => setBuka(buka === r.id ? null : r.id)} title={isu.map((x) => `${x.kolom}: ${x.pesan}`).join("\n")}
                              className={clsx("mx-auto mt-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold", buka === r.id ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-800 hover:bg-amber-200")}>
                              <AlertTriangle className="h-3 w-3" />{isu.length}
                            </button>
                          )}
                        </td>
                        <td className="input"><SelectCell value={r.kategori} options={d.kategori.map((k) => k.nama)} onSave={(v) => patch(r.id, { kategori: v, risk_driver: null, kriteria_dampak: null })} /></td>
                        <td className={clsx("input", driverUnknown && "!bg-rose-100")}>
                          <SelectCell value={r.risk_driver} options={driverUnknown ? [r.risk_driver!, ...drivers] : drivers} placeholder={r.kategori ? "Pilih driver…" : "Pilih kategori dulu"} onSave={(v) => patch(r.id, { risk_driver: v })} />
                        </td>
                        <td className="input">
                          <button onClick={() => !ro && setPicker(r)} disabled={ro} className="group flex w-full items-start gap-1.5 text-left">
                            <Library className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                            <span className={clsx("font-semibold group-hover:underline", !r.risk_event && "font-normal text-slate-400 italic")}>{r.risk_event ?? "Pilih dari taksonomi…"}</span>
                          </button>
                          {r.taksonomi_kode && <div className="mt-1 font-mono text-[10px] text-slate-400">{r.taksonomi_kode}</div>}
                        </td>
                        <td className="input text-[12px]"><EditCell value={r.deskripsi} onSave={(v) => patch(r.id, { deskripsi: v as string })} /></td>
                        <td className="input"><EditCell value={r.root_cause} onSave={(v) => patch(r.id, { root_cause: v as string })} /></td>
                        <td className="input"><EditCell kind="percent" value={r.probabilitas} display={(v) => persen(v as number, 0)} onSave={(v) => patch(r.id, { probabilitas: v as number })} /></td>
                        <td className="input"><EditCell value={r.deskripsi_dampak} onSave={(v) => patch(r.id, { deskripsi_dampak: v as string })} /></td>
                        <td className="input"><EditCell kind="number" value={r.nilai_dampak} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { nilai_dampak: v as number })} /></td>
                        <td className="input"><SelectCell value={r.kriteria_dampak} options={krit} placeholder={r.kategori ? "Pilih kriteria…" : "Pilih kategori dulu"} onSave={(v) => patch(r.id, { kriteria_dampak: v })} /></td>
                        <td className={clsx("input", dampakSalah && "!bg-rose-100")}>
                          <SelectCell value={r.kategori_dampak} options={kriteria ? labelLevel(kriteria) : KATEGORI_DAMPAK} onSave={(v) => patch(r.id, { kategori_dampak: v })} />
                          {r.kategori_dampak && <div className="mt-1"><DampakBadge k={r.kategori_dampak} /></div>}
                          {saran && (
                            <div className="mt-1.5 text-[11px] leading-snug" title={saran.sumber}>
                              {r.kategori_dampak === saran.level ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />Sesuai kriteria ({saran.ukuran})</span>
                              ) : (
                                <>
                                  <span className={dampakSalah ? "font-semibold text-rose-700" : "text-slate-600"}>Sesuai kriteria: {saran.level}</span>
                                  <span className="text-slate-500"> ({saran.ukuran})</span>
                                  <button data-edit onClick={() => patch(r.id, { kategori_dampak: saran.level })} className="ml-1 font-semibold text-brand-700 hover:underline">pakai</button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={clsx("calc text-center font-bold", isTopRisk(r.kategori_dampak) ? "text-orange-700" : "text-slate-500")}>{r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Ya" : "Tidak") : ""}</td>
                        <td className="input"><EditCell kind="number" value={r.expected_loss} placeholder={el != null ? `≈ ${rupiah(el).replace("Rp ", "")}` : "Opsional"} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { expected_loss: v as number })} /></td>
                        <td className="input"><EditCell value={r.existing_control} onSave={(v) => patch(r.id, { existing_control: v as string })} /></td>
                        <td className="input"><EditCell value={r.rencana_mitigasi} onSave={(v) => patch(r.id, { rencana_mitigasi: v as string })} /></td>
                        <td className="input"><SelectCell value={r.kategori_mitigasi} options={KATEGORI_MITIGASI} onSave={(v) => patch(r.id, { kategori_mitigasi: v })} /></td>
                        <td className={clsx("input", !(r.parameter_ram ?? []).length && "!bg-amber-100/70")}>
                          <ParamPicker value={r.parameter_ram ?? []} options={d.popts} kategori={r.kategori} onSave={(v) => patch(r.id, { parameter_ram: v })} />
                        </td>
                        <td><div className="flex flex-col items-center gap-2"><AiRowButton onClick={() => bukaAi(r)} /><button data-edit onClick={() => del(r)} className="text-slate-400 hover:text-rose-600" title="Hapus"><Trash2 className="h-4 w-4" /></button></div></td>
                      </tr>
                      {buka === r.id && isu.length > 0 && (
                        <tr>
                          <td colSpan={18} className="!bg-amber-50/70 !py-2">
                            <div className="sticky left-12 max-w-[900px] space-y-1 pl-2 text-[12px]">
                              {isu.map((x, j) => (
                                <div key={j} className="flex gap-2"><span className="w-36 shrink-0 font-semibold text-amber-900">{x.kolom}</span><span className="text-slate-700">{x.pesan}</span></div>
                              ))}
                              {saran && <div className="pt-1 text-[11px] text-slate-500">Dasar saran kategori dampak: {saran.sumber}.</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={18} className="py-10 text-center text-slate-400">Belum ada risiko. Klik “Tambah Risiko”.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          {ai && (
            <AiFillModal jenis="risiko" subjek={`Risiko #${d.register.indexOf(ai) + 1} ${ai.risk_event}`} fields={aiFields(ai)} nilai={ai} konteks={aiKonteks(ai)}
              onApply={(p) => patch(ai.id, p)} onClose={() => setAi(null)}
              placeholder="Contoh: Risiko ini muncul karena pasokan TBS dari kebun plasma sering terlambat saat musim hujan. Saat ini sudah ada kontrak pasokan dan monitoring harian." />
          )}
          {picker && <TaxonomyPicker options={d.t3} kategori={picker.kategori} current={picker.risk_event} onPick={pick} onClose={() => setPicker(null)} />}
        </>
      )}
    </SheetPage>
  );
}
