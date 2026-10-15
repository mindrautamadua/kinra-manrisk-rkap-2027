"use client";
import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { Button, DampakBadge, EditCell, ErrorBox, Loading, Section, SheetPage, Stat, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { isTopRisk } from "@/lib/format";
import { PILAR_RJPP, type RiskRegister, type SasaranStrategis } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

const PREFIX: Record<string, string> = { "Performance Driven": "PD", "Stability and Growth": "SG", "New Business Expansion": "NB", Fondasi: "FD" };
const KET: Record<string, string> = {
  "Performance Driven": "Pilar 1: okupansi lahan, akuisisi tenant, kualitas layanan, dan ekosistem industri.",
  "Stability and Growth": "Pilar 2: keuangan, utilitas kawasan, stabilitas bisnis, pertumbuhan, green dan daya saing.",
  "New Business Expansion": "Pilar 3: bisnis baru di luar core business (SFB, IKM, parkir, MICE, perumahan).",
  Fondasi: "Sasaran Korporasi RJPP Bab 4.3.1, untuk risiko kepatuhan, GCG, reputasi, dan SDM.",
};

export default function SasaranStrategisPage() {
  const q = useLoad(async () => {
    const [sasaran, register] = await Promise.all([api.sasaran(), api.register()]);
    return { sasaran, register };
  });
  const saver = useSaver();
  const d = q.data;

  const nomor = useMemo(() => new Map((d?.register ?? []).map((r, i) => [r.id, i + 1])), [d]);
  const risikoDari = (kode: string) => (d?.register ?? []).filter((r) => (r.sasaran_strategis ?? []).includes(kode));
  const tanpaRisiko = (d?.sasaran ?? []).filter((s) => !risikoDari(s.kode).length);
  const risikoTanpa = (d?.register ?? []).filter((r) => !(r.sasaran_strategis ?? []).length);

  const patch = (kode: string, p: Partial<SasaranStrategis>) => {
    q.setData({ ...d!, sasaran: d!.sasaran.map((s) => (s.kode === kode ? { ...s, ...p } : s)) });
    saver.run(() => api.update<SasaranStrategis>("sasaran_strategis", "kode", kode, { ...p, updated_at: new Date().toISOString() } as Partial<SasaranStrategis>));
  };
  const add = (pilar: string) => saver.run(async () => {
    const pre = PREFIX[pilar];
    const n = Math.max(0, ...d!.sasaran.filter((s) => s.kode.startsWith(pre + "-")).map((s) => Number(s.kode.split("-")[1]) || 0)) + 1;
    const urutan = Math.max(0, ...d!.sasaran.map((s) => s.urutan)) + 1;
    const row = await api.insert<SasaranStrategis>("sasaran_strategis", { kode: `${pre}-${n}`, urutan, pilar, nama: "Sasaran baru" });
    q.setData({ ...d!, sasaran: [...d!.sasaran, row] });
  });
  const del = async (s: SasaranStrategis) => {
    const n = risikoDari(s.kode).length;
    if (!(await konfirmasi({ judul: "Hapus sasaran strategis?", objek: `${s.kode} ${s.nama}`, pesan: n ? `${n} risiko masih ditagging ke sasaran ini dan tagnya akan tampil merah.` : undefined }))) return;
    q.setData({ ...d!, sasaran: d!.sasaran.filter((x) => x.kode !== s.kode) });
    saver.run(() => api.remove("sasaran_strategis", "kode", s.kode));
  };

  const RisikoChip = ({ r }: { r: RiskRegister }) => (
    <div className="flex items-start gap-1.5 text-[12px] leading-snug">
      <span className="font-mono text-[11px] text-slate-400">#{nomor.get(r.id)}</span>
      <span className={clsx(isTopRisk(r.kategori_dampak) && "font-semibold")}>{r.risk_event ?? "Tanpa nama"}</span>
      {r.kategori_dampak && <DampakBadge k={r.kategori_dampak} />}
    </div>
  );

  return (
    <SheetPage title="Sasaran Strategis RJPP 2026-2030 - PT KINRA" code="Master Data" actions={saver.indicator}
      note="Sasaran Strategis diambil dari dokumen RJPP 2026-2030 (draft): Target Utama 2030 setiap pilar strategis, ditambah Sasaran Korporasi sebagai Fondasi. Setiap risiko pada Risk Register ditagging ke sasaran yang terancam bila risiko terjadi.">
      {q.loading ? <Loading variant="stats-table" /> : q.error ? (
        /sasaran_strategis/i.test(q.error) ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <div className="font-bold">Fitur Sasaran Strategis butuh migrasi database</div>
            <p className="mt-1 text-[13px]">Jalankan isi file <code className="rounded bg-white px-1">supabase/migrations/0006_sasaran_strategis.sql</code> di Supabase Dashboard › SQL Editor, lalu muat ulang halaman ini.</p>
          </div>
        ) : <ErrorBox error={q.error} />
      ) : d && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sasaran Strategis" value={d.sasaran.length} sub={`${PILAR_RJPP.length - 1} pilar + Fondasi`} accent="bg-brand-600" />
            <Stat label="Sasaran Tercakup Risiko" value={d.sasaran.length - tanpaRisiko.length} accent="bg-emerald-500" />
            <Stat label="Sasaran Tanpa Risiko" value={tanpaRisiko.length} sub="Periksa apakah ada risiko yang belum teridentifikasi" accent="bg-amber-500" />
            <Stat label="Risiko Belum Ditagging" value={risikoTanpa.length} sub={`dari ${d.register.length} risiko`} accent="bg-rose-500" />
          </div>

          {PILAR_RJPP.map((pilar, gi) => {
            const list = d.sasaran.filter((s) => s.pilar === pilar);
            return (
              <Section key={pilar} letter={String.fromCharCode(65 + gi)} title={pilar}
                right={<Button edit variant="outline" onClick={() => add(pilar)}><Plus className="h-4 w-4" />Tambah Sasaran</Button>}>
                <p className="mb-2 text-[12.5px] text-slate-500">{KET[pilar]}</p>
                <TableWrap>
                  <table className="kk-table min-w-[1100px]">
                    <thead><tr>
                      <th className="w-16">Kode</th><th className="w-72">Sasaran Strategis</th><th className="w-80">Target / KPI 2030</th>
                      <th className="w-40">Rujukan RJPP</th><th>Risiko Terkait</th><th className="w-12" />
                    </tr></thead>
                    <tbody>
                      {list.map((s) => {
                        const risiko = risikoDari(s.kode);
                        return (
                          <tr key={s.kode}>
                            <td className="text-center font-bold">{s.kode}</td>
                            <td className="input font-semibold"><EditCell value={s.nama} onSave={(v) => patch(s.kode, { nama: (v as string) || s.nama })} /></td>
                            <td className="input text-[12px]"><EditCell value={s.target} onSave={(v) => patch(s.kode, { target: v as string })} /></td>
                            <td className="input text-[12px]"><EditCell value={s.rujukan} onSave={(v) => patch(s.kode, { rujukan: v as string })} /></td>
                            <td className={clsx(!risiko.length && "!bg-amber-100/70")}>
                              {risiko.length ? <div className="space-y-1">{risiko.map((r) => <RisikoChip key={r.id} r={r} />)}</div>
                                : <span className="text-[12px] text-amber-800 italic">Belum ada risiko ditagging</span>}
                            </td>
                            <td className="text-center"><button data-edit onClick={() => del(s)} className="text-slate-400 hover:text-rose-600" title="Hapus"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                      {!list.length && <tr><td colSpan={6} className="py-6 text-center text-slate-400">Belum ada sasaran pada pilar ini.</td></tr>}
                    </tbody>
                  </table>
                </TableWrap>
              </Section>
            );
          })}

          <Section letter={String.fromCharCode(65 + PILAR_RJPP.length)} title="Risiko yang Belum Ditagging ke Sasaran Strategis">
            {risikoTanpa.length ? (
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="grid gap-1.5 md:grid-cols-2">{risikoTanpa.map((r) => <RisikoChip key={r.id} r={r} />)}</div>
                <Link href="/risk-register" className="mt-3 inline-block text-[12.5px] font-semibold text-brand-700 hover:underline">Lengkapi di Risk Register →</Link>
              </div>
            ) : <p className="text-[13px] text-emerald-700">Semua risiko sudah ditagging ke minimal satu Sasaran Strategis.</p>}
          </Section>
        </>
      )}
    </SheetPage>
  );
}
