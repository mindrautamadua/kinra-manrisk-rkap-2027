"use client";
import { Card, EditCell, ErrorBox, Loading, SheetPage, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import type { Sampul } from "@/lib/types";

const FIELDS: { key: keyof Sampul; label: string; hint: string }[] = [
  { key: "nama_entitas", label: "Nama Entitas", hint: "" },
  { key: "posisi_data", label: "Posisi Data", hint: "Diisi waktu posisi data yang digunakan" },
  { key: "tanggal_penyusunan", label: "Tanggal Penyusunan", hint: "Diisi tanggal penyusunan" },
  { key: "versi", label: "Versi", hint: "" },
];

export default function SampulPage() {
  const { data, setData, error, loading } = useLoad(api.sampul);
  const saver = useSaver();
  const save = (k: keyof Sampul, v: string | number | null) => {
    const next = { ...data!, [k]: v == null ? null : String(v) };
    setData(next);
    saver.run(() => api.saveSampul(next));
  };
  return (
    <SheetPage title="Sampul" code="Lembar" actions={saver.indicator}>
      {loading ? <Loading variant="form" /> : error ? <ErrorBox error={error} /> : data && (
        <Card className="relative mx-auto max-w-4xl overflow-hidden">
          <div className="relative bg-brand-900 px-10 pt-14 pb-12 text-white">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-gold via-amber-300 to-transparent" />
            <div className="text-[12px] font-bold tracking-[0.25em] text-gold uppercase">{data.nama_entitas}</div>
            <h1 className="mt-4 text-3xl leading-tight font-extrabold md:text-4xl">Kertas Kerja Perencanaan<br />Manajemen Risiko</h1>
            <p className="mt-3 text-lg text-brand-100">Rencana Kerja dan Anggaran Perusahaan (RKAP) 2027</p>
          </div>
          <div className="divide-y divide-line px-10 py-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[200px_1fr] items-start gap-4 py-3.5">
                <div className="pt-0.5 text-[13px] font-semibold text-slate-600">{f.label}</div>
                <div className="rounded-md bg-cell-input px-2 py-1 text-[14px]">
                  <EditCell value={data[f.key] as string} placeholder={f.hint || "Isi…"} onSave={(v) => save(f.key, v)} />
                </div>
              </div>
            ))}
          </div>
          {data.catatan && <p className="border-t border-line bg-paper/60 px-10 py-5 text-[12.5px] leading-relaxed text-slate-600">{data.catatan}</p>}
        </Card>
      )}
    </SheetPage>
  );
}
