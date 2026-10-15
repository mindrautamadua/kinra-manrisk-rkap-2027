"use client";
import { useMemo, useState } from "react";
import { Download, Library, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  Button, DampakBadge, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, Stat, TableWrap, useLoad, useSaver,
} from "@/components/ui";
import { TaxonomyPicker, groupT3, type T3Option } from "@/components/TaxonomyPicker";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import { exportRegister } from "@/lib/export";
import { KATEGORI_DAMPAK, KATEGORI_MITIGASI, type RiskRegister } from "@/lib/types";

export default function RiskRegisterPage() {
  const q = useLoad(async () => {
    const [register, kategori, drivers, kriteria, tax] = await Promise.all([api.register(), api.kategori(), api.drivers(), api.kriteria(), api.taksonomi()]);
    return { register, kategori, drivers, kriteria, t3: groupT3(tax) };
  });
  const saver = useSaver();
  const [picker, setPicker] = useState<RiskRegister | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const d = q.data;

  const rows = useMemo(() => (d?.register ?? []).filter((r) =>
    (!filter || r.kategori === filter) &&
    (!search || [r.risk_event, r.deskripsi, r.root_cause, r.rencana_mitigasi].some((x) => (x ?? "").toLowerCase().includes(search.toLowerCase())))), [d, filter, search]);

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

  const total = d?.register.length ?? 0;
  const top = d?.register.filter((r) => isTopRisk(r.kategori_dampak)).length ?? 0;
  const el = d?.register.reduce((a, r) => a + Number(r.expected_loss ?? 0), 0) ?? 0;
  const dampak = d?.register.reduce((a, r) => a + Number(r.nilai_dampak ?? 0), 0) ?? 0;

  return (
    <SheetPage title="Risk Register RKAP 2027 - PT KINRA" code="Risk Register" note={note("Risk Register")} wide
      actions={<>{saver.indicator}<Button variant="outline" onClick={() => d && exportRegister(d.register)}><Download className="h-4 w-4" />Excel</Button><Button onClick={add}><Plus className="h-4 w-4" />Tambah Risiko</Button></>}>
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
              <table className="kk-table min-w-[2600px]">
                <thead><tr>
                  <th className="sticky left-0 z-[3] w-12">No</th>
                  <th className="w-40">Taksonomi Risiko</th><th className="w-48">Risk Driver</th><th className="w-56">Risk Event</th>
                  <th className="w-72">Deskripsi Risk Event</th><th className="w-60">Root Cause</th><th className="w-24">Probabilitas Kejadian (0%-100%)</th>
                  <th className="w-52">Deskripsi Dampak Risiko</th><th className="w-40">Nilai Dampak Risiko (Rp)</th><th className="w-52">Kriteria Dampak Acuan</th>
                  <th className="w-32">Kategori Dampak Risiko</th><th className="w-20">Tagging Top Risk</th><th className="w-40">Expected Loss (Rp)</th>
                  <th className="w-56">Existing Control</th><th className="w-56">Rencana Mitigasi</th><th className="w-32">Kategori Mitigasi</th><th className="w-10" />
                </tr></thead>
                <tbody>
                  <tr className="example">
                    <td className="sticky left-0">Contoh</td><td>Risiko Pasar</td><td>Perubahan harga komoditas</td><td>Penurunan harga CPO</td><td>Harga CPO turun di bawah asumsi RKAP 2027.</td>
                    <td>Kelebihan pasokan minyak nabati global</td><td className="text-right">30%</td><td>Penurunan marjin penjualan CPO</td><td className="text-right">450.000.000.000</td>
                    <td>b. Dampak perubahan harga komoditas terhadap penurunan margin</td><td>Moderat</td><td>Ya</td><td className="text-right">135.000.000.000</td>
                    <td>Kontrak penjualan berjangka</td><td>Menambah porsi kontrak penjualan berharga tetap</td><td>Preventive</td><td />
                  </tr>
                  {rows.map((r, i) => {
                    const drivers = d.drivers.filter((x) => x.kategori === r.kategori).map((x) => x.driver);
                    const krit = d.kriteria.filter((x) => x.kategori === r.kategori).map((x) => `${x.kode}. ${x.kriteria}`);
                    const driverUnknown = r.risk_driver && !drivers.includes(r.risk_driver);
                    const el = r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;
                    return (
                      <tr key={r.id}>
                        <td className="sticky left-0 z-[1] text-center font-semibold">{i + 1}</td>
                        <td className="input"><SelectCell value={r.kategori} options={d.kategori.map((k) => k.nama)} onSave={(v) => patch(r.id, { kategori: v, risk_driver: null, kriteria_dampak: null })} /></td>
                        <td className={clsx("input", driverUnknown && "!bg-rose-100")}>
                          <SelectCell value={r.risk_driver} options={driverUnknown ? [r.risk_driver!, ...drivers] : drivers} placeholder={r.kategori ? "Pilih driver…" : "Pilih kategori dulu"} onSave={(v) => patch(r.id, { risk_driver: v })} />
                        </td>
                        <td className="input">
                          <button onClick={() => setPicker(r)} className="group flex w-full items-start gap-1.5 text-left">
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
                        <td className="input">
                          <SelectCell value={r.kategori_dampak} options={KATEGORI_DAMPAK} onSave={(v) => patch(r.id, { kategori_dampak: v })} />
                          {r.kategori_dampak && <div className="mt-1"><DampakBadge k={r.kategori_dampak} /></div>}
                        </td>
                        <td className={clsx("calc text-center font-bold", isTopRisk(r.kategori_dampak) ? "text-orange-700" : "text-slate-500")}>{r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Ya" : "Tidak") : ""}</td>
                        <td className="input"><EditCell kind="number" value={r.expected_loss} placeholder={el != null ? `≈ ${rupiah(el).replace("Rp ", "")}` : "Opsional"} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { expected_loss: v as number })} /></td>
                        <td className="input"><EditCell value={r.existing_control} onSave={(v) => patch(r.id, { existing_control: v as string })} /></td>
                        <td className="input"><EditCell value={r.rencana_mitigasi} onSave={(v) => patch(r.id, { rencana_mitigasi: v as string })} /></td>
                        <td className="input"><SelectCell value={r.kategori_mitigasi} options={KATEGORI_MITIGASI} onSave={(v) => patch(r.id, { kategori_mitigasi: v })} /></td>
                        <td><button onClick={() => del(r)} className="text-slate-400 hover:text-rose-600" title="Hapus"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={17} className="py-10 text-center text-slate-400">Belum ada risiko. Klik “Tambah Risiko”.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          {picker && <TaxonomyPicker options={d.t3} kategori={picker.kategori} current={picker.risk_event} onPick={pick} onClose={() => setPicker(null)} />}
        </>
      )}
    </SheetPage>
  );
}
