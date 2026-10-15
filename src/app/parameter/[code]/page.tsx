"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Grid2x2, Landmark, RotateCcw, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Card, ErrorBox, Loading, SheetPage, StatusBadge, useSaver } from "@/components/ui";
import { SheetGrid, buildLayout } from "@/components/SheetGrid";
import { SheetAiModal } from "@/components/SheetAi";
import { SHEET_AI } from "@/lib/sheet-ai";
import { REKAP, Workbook, isInputCell, loadTemplate } from "@/lib/engine";
import { api } from "@/lib/data";
import { angka, nilaiParam } from "@/lib/format";
import { LABEL_SUMBER, TAUTAN, nilaiTautan, samaNilai } from "@/lib/rkap";
import { supabaseConfigured } from "@/lib/supabase";
import { useReadonly } from "@/lib/mode";
import type { CellValue, ParameterSheet, RkapKeuangan, SheetTemplate } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

export default function ParameterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const meta = REKAP.find((r) => r.kode === code);
  const idx = REKAP.findIndex((r) => r.kode === code);
  const [tpl, setTpl] = useState<SheetTemplate | null>(null);
  const [row, setRow] = useState<ParameterSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [headers, setHeaders] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const aiCfg = SHEET_AI[code];
  const wbRef = useRef<Workbook | null>(null);
  const inputsRef = useRef<Record<string, CellValue>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saver = useSaver();
  const ro = useReadonly();
  const [rkap, setRkap] = useState<RkapKeuangan | null>(null);
  const tautan = TAUTAN.filter((t) => t.code === code);
  useEffect(() => {
    if (supabaseConfigured && TAUTAN.some((t) => t.code === code)) api.rkapAktif().then(setRkap).catch(() => setRkap(null));
  }, [code]);

  useEffect(() => {
    let alive = true;
    setTpl(null); setRow(null); setError(null);
    (async () => {
      try {
        const [t, sampul, p] = await Promise.all([loadTemplate(code), supabaseConfigured ? api.sampul() : null, supabaseConfigured ? api.param(code) : null]);
        if (!alive) return;
        inputsRef.current = { ...(p?.inputs ?? {}) };
        wbRef.current?.destroy();
        wbRef.current = new Workbook([t], { [code]: inputsRef.current }, sampul?.nama_entitas ?? "PT KINRA");
        setTpl(t); setRow(p ?? null); setVersion((v) => v + 1);
      } catch (e) { if (alive) setError((e as Error).message); }
    })();
    return () => { alive = false; clearTimeout(timer.current); };
  }, [code]);

  const layout = useMemo(() => (tpl ? buildLayout(tpl) : null), [tpl]);
  const wb = wbRef.current;
  const sum = useMemo(() => (wb && version ? wb.summary(code) : null), [wb, version, code]);
  const arah = tpl?.cells["E13"]?.v as string | undefined;

  const persist = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!wbRef.current) return;
      const summary = wbRef.current.summary(code);
      saver.run(() => api.update<ParameterSheet>("parameter_sheet", "code", code, { inputs: inputsRef.current, summary, updated_at: new Date().toISOString() }));
    }, 600);
  }, [code, saver]);

  const onEdit = useCallback((addr: string, v: CellValue) => {
    inputsRef.current = { ...inputsRef.current, [addr]: v };
    wbRef.current!.set(code, addr, v);
    setVersion((x) => x + 1);
    if (supabaseConfigured) persist();
  }, [code, persist]);

  const setDiterapkan = (v: string) => {
    setRow((r) => (r ? { ...r, diterapkan: v } : r));
    saver.run(() => api.update<ParameterSheet>("parameter_sheet", "code", code, { diterapkan: v }));
  };

  const resetInputs = async () => {
    if (!tpl || !(await konfirmasi({ judul: "Kosongkan isian lembar?", pesan: "Seluruh isian (sel kuning) pada lembar ini akan dikosongkan.", aksi: "Kosongkan", nada: "peringatan" }))) return;
    const empty: Record<string, CellValue> = {};
    for (const [a, c] of Object.entries(tpl.cells)) if (isInputCell(c)) empty[a] = null;
    inputsRef.current = empty;
    wbRef.current?.destroy();
    wbRef.current = new Workbook([tpl], { [code]: empty });
    setVersion((x) => x + 1);
    persist();
  };

  if (!meta) return <SheetPage title="Parameter tidak ditemukan"><Link href="/rekap" className="underline">Kembali ke Rekap</Link></SheetPage>;
  const prev = REKAP[idx - 1], next = REKAP[idx + 1];
  const nInputs = tpl ? Object.values(tpl.cells).filter(isInputCell).length : 0;
  const filled = tpl ? Object.entries(tpl.cells).filter(([a, c]) => isInputCell(c) && wb?.get(code, a) != null && wb?.get(code, a) !== "").length : 0;

  return (
    <SheetPage code={`Lembar ${code} · ${meta.grup}`} title={`${meta.parameter}`} wide offline
      actions={<>
        {saver.indicator}
        {prev && <Link href={`/parameter/${prev.kode}`} className="rounded-lg border border-line bg-white p-2 hover:border-brand-500" title={prev.parameter}><ArrowLeft className="h-4 w-4" /></Link>}
        {next && <Link href={`/parameter/${next.kode}`} className="rounded-lg border border-line bg-white p-2 hover:border-brand-500" title={next.parameter}><ArrowRight className="h-4 w-4" /></Link>}
      </>}>
      {error ? <ErrorBox error={error} /> : !tpl || !layout || !wb ? <Loading variant="sheet" label="Menyiapkan kertas kerja & rumus…" /> : (
        <>
          <div className="mb-5 grid gap-3 lg:grid-cols-[1.3fr_repeat(3,minmax(0,0.6fr))_1fr]">
            <Card className="p-4">
              <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Hasil Pengukuran RKAP 2027</div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="text-[28px] font-extrabold tracking-tight tabnum">{nilaiParam(sum?.hasil, meta.satuan)}</div>
                <StatusBadge status={sum?.status} />
              </div>
              <div className="mt-1 text-[11.5px] text-slate-500">{meta.kategori} · {arah}</div>
            </Card>
            {(["limit", "appetite", "tolerance"] as const).map((k) => (
              <Card key={k} className="p-4">
                <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{k}</div>
                <div className="mt-2 text-[20px] font-bold tabnum">{nilaiParam(sum?.[k], meta.satuan)}</div>
              </Card>
            ))}
            <Card className="flex flex-col justify-between gap-2 p-4">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-slate-600">Kelengkapan isian</span>
                <span className="tabnum text-slate-500">{filled}/{nInputs}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500 transition-all" style={{ width: `${nInputs ? (filled / nInputs) * 100 : 0}%` }} /></div>
              {meta.grup !== "Parameter Standar" && row && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-semibold text-slate-600">Diterapkan</span>
                  {ro && <span className="font-bold">{row.diterapkan ?? "–"}</span>}
                  {["Ya", "Tidak"].map((o) => (
                    <button key={o} data-edit onClick={() => setDiterapkan(o)} className={clsx("rounded-md px-2.5 py-0.5 font-semibold", row.diterapkan === o ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{o}</button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {rkap && tautan.map((t) => {
            const target = nilaiTautan(t, rkap);
            const sesuai = samaNilai(wb.get(code, t.addr), target);
            return (
              <div key={t.addr} className={clsx("mb-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-[12.5px]",
                sesuai ? "border-emerald-200 bg-emerald-50/60" : "border-amber-300 bg-amber-50")}>
                <Landmark className={clsx("h-4 w-4", sesuai ? "text-emerald-700" : "text-amber-700")} />
                <span>
                  Sel <b className="font-mono">{t.addr}</b> ({LABEL_SUMBER[t.sumber]}, {t.satuan}) bersumber dari{" "}
                  <Link href="/data-keuangan" className="font-semibold underline">Data Keuangan RKAP · {rkap.nama}</Link>:{" "}
                  <b className="tabnum">{angka(target, t.satuan === "Rp juta" ? 2 : 0)}</b>
                  {sesuai ? " · sudah sesuai." : " · isian lembar berbeda."}
                </span>
                {!sesuai && target != null && (
                  <button data-edit onClick={() => onEdit(t.addr, target)} className="ml-auto rounded-lg bg-brand-700 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-brand-800">Isi dari RKAP</button>
                )}
              </div>
            );
          })}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {layout.sections.map((s) => (
              <button key={s.row} onClick={() => document.getElementById(`r${s.row}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pr-3 pl-1 text-[12px] font-medium hover:border-brand-500">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-800 text-[10.5px] font-bold text-white">{s.letter}</span>{s.title}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {aiCfg && (
                <button data-edit onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-brand-500 bg-brand-700 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-brand-800">
                  <Sparkles className="h-3.5 w-3.5" />Isi dengan AI
                </button>
              )}
              <button onClick={() => setHeaders((h) => !h)} className={clsx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px]", headers ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line bg-white")}>
                <Grid2x2 className="h-3.5 w-3.5" />Header baris/kolom
              </button>
              <button data-edit onClick={resetInputs} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-[12px] text-rose-600 hover:border-rose-400">
                <RotateCcw className="h-3.5 w-3.5" />Kosongkan isian
              </button>
            </div>
          </div>

          <div className="scroll-thin max-h-[calc(100vh-150px)] overflow-auto rounded-xl border border-line bg-white shadow-sm">
            <SheetGrid t={tpl} layout={layout} wb={wb} version={version} onEdit={onEdit} showHeaders={headers} readonly={ro} />
          </div>
          {aiOpen && aiCfg && (
            <SheetAiModal cfg={aiCfg} get={(a) => wb.get(code, a)} onClose={() => setAiOpen(false)}
              onApply={(cells) => { for (const [a, v] of Object.entries(cells)) onEdit(a, v); }} />
          )}
          <p className="mt-2 text-[11.5px] text-slate-500">Klik sel kuning untuk mengisi. Angka boleh memakai format Indonesia (1.250,5) atau persen (12,5%). Sel biru dihitung otomatis dengan rumus yang sama dengan kertas kerja Excel.</p>
        </>
      )}
    </SheetPage>
  );
}
