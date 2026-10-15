"use client";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import { EditCell, ErrorBox, Loading, SelectCell, SheetPage, SikapBadge, StatusBadge, TableWrap, Button, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { angka, nilaiParam } from "@/lib/format";
import { buildRam, KATEGORI_URUT, perluPengendalian, type RamRow } from "@/lib/ram";
import { note } from "@/lib/static";
import { exportRam } from "@/lib/export";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import type { IsiRequest, IsiResponse } from "@/lib/isi-ai";
import type { RamPengendalian, RamTambahan } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

const ARAH = ["Makin tinggi makin buruk", "Makin rendah makin buruk"];
const AI_FIELDS = [{ key: "inisiatif", label: "Inisiatif Strategis" }, { key: "kebijakan", label: "Kebijakan" }, { key: "program", label: "Program Kerja" }] as const;
type AiField = (typeof AI_FIELDS)[number]["key"];
const AI_PARALEL = 3;

const nilaiCtl = (r: RamRow, f: AiField | "anggaran") => (r.tambahan ? r.tambahan[f] : r.pengendalian?.[f]) ?? null;

export default function RamPage() {
  const q = useLoad(async () => {
    const [params, ras, pengendalian, tambahan, register] = await Promise.all([api.params(), api.ras(), api.pengendalian(), api.ramTambahan(), api.register()]);
    return { params, ras, pengendalian, tambahan, register };
  });
  const saver = useSaver();
  const d = q.data;
  const rows = d ? buildRam(d.params, d.ras, d.pengendalian, d.tambahan) : [];

  const savePengendalian = (kode: string, p: Partial<RamPengendalian>) => {
    const cur = d!.pengendalian.find((x) => x.kode === kode) ?? { kode, inisiatif: null, kebijakan: null, program: null, anggaran: null };
    const next = { ...cur, ...p };
    q.setData({ ...d!, pengendalian: [...d!.pengendalian.filter((x) => x.kode !== kode), next] });
    saver.run(() => api.upsert("ram_pengendalian", next));
  };
  const patchTambahan = (id: string, p: Partial<RamTambahan>) => {
    q.setData({ ...d!, tambahan: d!.tambahan.map((x) => (x.id === id ? { ...x, ...p } : x)) });
    saver.run(() => api.update<RamTambahan>("ram_tambahan", "id", id, p));
  };
  const addTambahan = (kategori: string) => saver.run(async () => {
    const row = await api.insert<RamTambahan>("ram_tambahan", { kategori, parameter: "Parameter unik baru", satuan: "%" });
    q.setData({ ...d!, tambahan: [...d!.tambahan, row] });
  });
  const delTambahan = async (id: string) => {
    if (!(await konfirmasi({ judul: "Hapus parameter unik tambahan?" }))) return;
    q.setData({ ...d!, tambahan: d!.tambahan.filter((x) => x.id !== id) });
    saver.run(() => api.remove("ram_tambahan", "id", id));
  };

  // Ukur lebar kolom No/Taksonomi/Kode agar offset kolom beku pas dengan layout tabel.
  const tableRef = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const t = tableRef.current;
    if (!t) return;
    const ukur = () => {
      const no = t.querySelector<HTMLElement>("th.fz-no")?.offsetWidth ?? 0;
      const tax = t.querySelector<HTMLElement>("th.fz-tax")?.offsetWidth ?? 0;
      const kode = t.querySelector<HTMLElement>("td.fz-kode")?.offsetWidth ?? 0;
      t.style.setProperty("--fz-tax", `${no}px`);
      t.style.setProperty("--fz-kode", `${no + tax}px`);
      t.style.setProperty("--fz-param", `${no + tax + kode}px`);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(t);
    return () => ro.disconnect();
  }, [d]);

  const [ai, setAi] = useState<RamRow | null>(null);
  const aiKonteks = (r: RamRow) => ({
    kategori_risiko: r.kategori, kode: r.kode, parameter: r.parameter, formula: r.formula, satuan: r.satuan,
    arah: r.tambahan?.arah ?? undefined, sikap_ras: r.sikap, status: r.status,
    limit: nilaiParam(r.limit, r.satuan), appetite: nilaiParam(r.appetite, r.satuan), tolerance: nilaiParam(r.tolerance, r.satuan), hasil_rkap_2027: nilaiParam(r.hasil, r.satuan),
    risiko_terkait: d!.register.filter((x) => r.kode && (x.parameter_ram ?? []).includes(r.kode))
      .map((x) => ({ risk_event: x.risk_event, root_cause: x.root_cause, rencana_mitigasi: x.rencana_mitigasi, kategori_dampak: x.kategori_dampak })),
  });
  const applyAi = (p: Record<string, string>) => {
    if (!ai) return;
    if (ai.tambahan) patchTambahan(ai.tambahan.id, p); else savePengendalian(ai.kode, p);
  };

  /** Isi massal: susun draf AI untuk semua parameter berstatus Kuning/Oranye/Merah. Hanya kolom kosong yang diisi. */
  const [massal, setMassal] = useState<{ selesai: number; total: number; gagal: string[] } | null>(null);
  const targetMassal = rows.filter((r) => r.diterapkan && perluPengendalian(r.status) && AI_FIELDS.some((f) => !nilaiCtl(r, f.key)));
  const isiMassal = async () => {
    const target = targetMassal;
    if (!target.length) return;
    if (!(await konfirmasi({ judul: `Susun draf AI untuk ${target.length} parameter?`, pesan: "AI akan menyusun draf Inisiatif Strategis, Kebijakan, dan Program Kerja untuk parameter berstatus Kuning/Oranye/Merah.\n\nHanya kolom yang masih kosong yang diisi; isian yang sudah ada tidak diubah. Anggaran tetap diisi manual.", aksi: "Susun Draf", nada: "info" }))) return;
    const entitas = await api.sampul().then((s) => s.nama_entitas || "PT KINRA").catch(() => "PT KINRA");
    const gagal: string[] = [];
    let selesai = 0;
    setMassal({ selesai, total: target.length, gagal });
    const antrian = [...target];
    const kerja = async () => {
      for (let r = antrian.shift(); r; r = antrian.shift()) {
        const kosong = AI_FIELDS.filter((f) => !nilaiCtl(r!, f.key));
        try {
          const req: IsiRequest = {
            jenis: "ram", entitas, instruksi: "", konteks: aiKonteks(r), fields: [...kosong],
            nilai: Object.fromEntries(kosong.map((f) => [f.key, null])),
          };
          const res = await fetch("/api/isi-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error ?? res.statusText);
          const patch = Object.fromEntries(kosong.map((f) => [f.key, (body as IsiResponse).saran[f.key] ?? ""]).filter(([, v]) => v)) as Partial<Record<AiField, string>>;
          await simpanAi(r, patch);
        } catch (e) { gagal.push(`${r.kode || r.parameter}: ${(e as Error).message}`); }
        selesai++;
        setMassal({ selesai, total: target.length, gagal: [...gagal] });
      }
    };
    await Promise.all(Array.from({ length: Math.min(AI_PARALEL, target.length) }, kerja));
    if (!gagal.length) setTimeout(() => setMassal(null), 2500);
  };
  /** Simpan hasil isi massal dengan pembaruan fungsional agar hasil paralel tidak saling menimpa. */
  const simpanAi = async (r: RamRow, patch: Partial<Record<AiField, string>>) => {
    if (!Object.keys(patch).length) return;
    const t = r.tambahan;
    if (t) {
      q.setData((prev) => prev && { ...prev, tambahan: prev.tambahan.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) });
      await api.update<RamTambahan>("ram_tambahan", "id", t.id, patch);
    } else {
      q.setData((prev) => {
        if (!prev) return prev;
        const cur = prev.pengendalian.find((x) => x.kode === r.kode) ?? { kode: r.kode, inisiatif: null, kebijakan: null, program: null, anggaran: null };
        return { ...prev, pengendalian: [...prev.pengendalian.filter((x) => x.kode !== r.kode), { ...cur, ...patch }] };
      });
      // Upsert parsial: hanya kolom yang diisi AI yang ditulis, anggaran tidak tersentuh.
      await api.upsert<RamPengendalian>("ram_pengendalian", { kode: r.kode, ...patch });
    }
  };

  const ctl = (r: RamRow, field: AiField | "anggaran") => {
    const val = nilaiCtl(r, field);
    const need = perluPengendalian(r.status) && !val;
    const save = (v: string | number | null) => r.tambahan ? patchTambahan(r.tambahan.id, { [field]: v }) : savePengendalian(r.kode, { [field]: v });
    return (
      <td className={clsx("input", need && "!bg-rose-100")}>
        <EditCell kind={field === "anggaran" ? "number" : "text"} value={val} placeholder={need ? "Wajib diisi" : "–"}
          display={field === "anggaran" ? (v) => angka(v as number, 2) : undefined} onSave={save} />
      </td>
    );
  };

  return (
    <SheetPage title="Risk Acceptance Matrix RKAP 2027 - PT KINRA" code="RAM" note={note("RAM")} wide
      actions={<>{saver.indicator}{massal ? (
        <span className={clsx("inline-flex items-center gap-1.5 text-[12px]", massal.gagal.length && "text-rose-600")} title={massal.gagal.join("\n")}>
          {massal.selesai < massal.total ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-brand-600" />}
          AI {massal.selesai}/{massal.total}{massal.gagal.length ? ` · ${massal.gagal.length} gagal` : ""}
          {massal.selesai === massal.total && massal.gagal.length > 0 && <button onClick={() => setMassal(null)} className="ml-1 underline">tutup</button>}
        </span>
      ) : d && targetMassal.length > 0 && (
        <Button edit variant="outline" onClick={isiMassal} title="Isi kolom Rencana Pengendalian yang masih kosong untuk semua parameter berstatus Kuning/Oranye/Merah">
          <Sparkles className="h-4 w-4" />Isi Pengendalian dengan AI ({targetMassal.length})
        </Button>
      )}<Button variant="outline" onClick={() => exportRam(rows)}><Download className="h-4 w-4" />Excel</Button></>}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <TableWrap>
          <table ref={tableRef} className="kk-table min-w-[2300px]">
            <thead>
              <tr>
                <th rowSpan={2} className="fz fz-no w-10">No</th><th rowSpan={2} className="fz fz-tax w-36">Taksonomi Risiko</th><th rowSpan={2} colSpan={2} className="fz fz-kode fz-edge w-72">Parameter Pengukuran</th>
                <th rowSpan={2} className="w-72">Formula</th><th rowSpan={2} className="w-20">Unit Satuan Formula</th><th rowSpan={2} className="w-28">Kategori Parameter</th>
                <th colSpan={3} className="text-center">Risk Threshold</th><th rowSpan={2} className="w-32">Sikap Risiko Sesuai RAS</th>
                <th rowSpan={2} className="w-32">Hasil Pengukuran Risiko pada RKAP 2027 (Risiko Inheren)</th><th rowSpan={2} className="w-36">Status Pengukuran</th>
                <th colSpan={4} className="text-center">Rencana Pengendalian</th><th rowSpan={2} className="w-10" />
              </tr>
              <tr>
                <th className="top-[33px] w-24">Limit</th><th className="top-[33px] w-24">Appetite</th><th className="top-[33px] w-24">Tolerance</th>
                <th className="top-[33px] w-56">Inisiatif Strategis</th><th className="top-[33px] w-56">Kebijakan</th><th className="top-[33px] w-56">Program Kerja</th><th className="top-[33px] w-28">Anggaran (Rp miliar)</th>
              </tr>
            </thead>
            <tbody>
              {KATEGORI_URUT.map((kat, ki) => {
                const list = rows.filter((r) => r.kategori === kat);
                return (
                  <Fragment key={kat}>
                    {list.map((r, i) => {
                      const t = r.tambahan;
                      const off = !r.diterapkan;
                      return (
                        <tr key={r.key} className={clsx(off && "row-off")}>
                          {i === 0 && <td rowSpan={list.length + 1} className="group fz fz-no text-center">{ki + 1}</td>}
                          {i === 0 && <td rowSpan={list.length + 1} className="group fz fz-tax">{kat}</td>}
                          {t ? (
                            <>
                              <td className="input fz fz-kode w-14"><EditCell value={t.kode} placeholder="Kode" onSave={(v) => patchTambahan(t.id, { kode: v as string })} /></td>
                              <td className="input fz fz-param fz-edge"><EditCell value={t.parameter} onSave={(v) => patchTambahan(t.id, { parameter: v as string })} /></td>
                              <td className="input text-[12px]"><EditCell value={t.formula} onSave={(v) => patchTambahan(t.id, { formula: v as string })} /></td>
                              <td className="input"><EditCell value={t.satuan} onSave={(v) => patchTambahan(t.id, { satuan: v as string })} /></td>
                              <td className="calc text-[12px]">Parameter Unik<SelectCell className="mt-1 text-[11px]" value={t.arah} options={ARAH} onSave={(v) => patchTambahan(t.id, { arah: v })} /></td>
                              {(["limit_v", "appetite_v", "tolerance_v"] as const).map((f) => (
                                <td key={f} className="input"><EditCell kind={t.satuan === "%" ? "percent" : "number"} value={t[f]} display={(v) => nilaiParam(v, t.satuan)} onSave={(v) => patchTambahan(t.id, { [f]: v })} /></td>
                              ))}
                              <td className="calc"><SikapBadge sikap={r.sikap} /></td>
                              <td className="input"><EditCell kind={t.satuan === "%" ? "percent" : "number"} value={t.hasil} display={(v) => nilaiParam(v, t.satuan)} onSave={(v) => patchTambahan(t.id, { hasil: v as number })} /></td>
                            </>
                          ) : (
                            <>
                              <td className="fz fz-kode w-14 font-bold"><Link className="text-brand-700 hover:underline" href={`/parameter/${r.kode}`}>{r.kode}</Link></td>
                              <td className="fz fz-param fz-edge font-semibold"><span>{r.parameter}</span></td>
                              <td className="text-[12px] text-slate-600">{r.formula}</td><td>{r.satuan}</td><td className="text-[12px]">{r.kategoriParameter}</td>
                              <td className="calc text-right tabnum">{nilaiParam(r.limit, r.satuan)}</td>
                              <td className="calc text-right tabnum">{nilaiParam(r.appetite, r.satuan)}</td>
                              <td className="calc text-right tabnum">{nilaiParam(r.tolerance, r.satuan)}</td>
                              <td className="calc">{r.sikap.includes("·") ? <span className="text-[11.5px] font-semibold">{r.sikap}</span> : <SikapBadge sikap={r.sikap} />}</td>
                              <td className="calc text-right font-semibold tabnum">{nilaiParam(r.hasil, r.satuan)}</td>
                            </>
                          )}
                          <td className="calc"><StatusBadge status={r.status} size="sm" /></td>
                          {ctl(r, "inisiatif")}{ctl(r, "kebijakan")}{ctl(r, "program")}{ctl(r, "anggaran")}
                          <td><div className="flex flex-col items-center gap-2">
                            {r.diterapkan && <AiRowButton title="Susun rencana pengendalian dengan AI" onClick={() => setAi(r)} />}
                            {t && <button data-edit onClick={() => delTambahan(t.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                          </div></td>
                        </tr>
                      );
                    })}
                    <tr>
                      {list.length === 0 && <><td className="group fz fz-no text-center">{ki + 1}</td><td className="group fz fz-tax">{kat}</td></>}
                      <td colSpan={17} className="!bg-paper/60 py-1.5">
                        <div className="fz fz-kode w-max">
                          <button data-edit onClick={() => addTambahan(kat)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">
                            <Plus className="h-3.5 w-3.5" />Tambah parameter unik
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      {ai && (
        <AiFillModal jenis="ram" subjek={`Parameter ${ai.kode} ${ai.parameter} · ${ai.status}`} konteks={aiKonteks(ai)}
          fields={[...AI_FIELDS]}
          nilai={ai.tambahan ?? ai.pengendalian ?? {}} onApply={applyAi} onClose={() => setAi(null)}
          placeholder="Contoh: Hasil DER naik karena rencana pinjaman pabrik baru. Kami ingin menjaganya lewat restrukturisasi tenor dan penambahan setoran modal dari Induk." />
      )}
    </SheetPage>
  );
}
