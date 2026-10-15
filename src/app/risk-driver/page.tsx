"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, TableWrap, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { note } from "@/lib/static";
import type { RiskDriver } from "@/lib/types";

export default function RiskDriverPage() {
  const q = useLoad(async () => ({ drivers: await api.drivers(), kategori: await api.kategori() }));
  const saver = useSaver();
  const d = q.data;
  const base = d?.drivers.filter((x) => !x.tambahan) ?? [];
  const extra = d?.drivers.filter((x) => x.tambahan) ?? [];

  const patch = (id: number, p: Partial<RiskDriver>) => {
    q.setData({ ...d!, drivers: d!.drivers.map((r) => (r.id === id ? { ...r, ...p } : r)) });
    saver.run(() => api.update<RiskDriver>("risk_driver", "id", id, p));
  };
  const add = () => saver.run(async () => {
    const row = await api.insert<RiskDriver>("risk_driver", { kategori: d!.kategori[0].nama, driver: "Risk driver baru", tambahan: true });
    q.setData({ ...d!, drivers: [...d!.drivers, row] });
  });
  const del = (id: number) => {
    if (!confirm("Hapus risk driver tambahan ini?")) return;
    q.setData({ ...d!, drivers: d!.drivers.filter((r) => r.id !== id) });
    saver.run(() => api.remove("risk_driver", "id", id));
  };

  return (
    <SheetPage title="Risk Driver - PT KINRA" code="Risk Driver" note={note("Risk Driver")} actions={saver.indicator}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <Section letter="A" title={`Risk Driver per Kategori Risiko (${base.length})`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.kategori.map((k) => {
                const items = base.filter((x) => x.kategori === k.nama);
                return (
                  <div key={k.no} className="overflow-hidden rounded-xl border border-line bg-white">
                    <div className="flex items-center gap-2 bg-brand-800 px-4 py-2.5 text-white">
                      <span className="text-[11px] font-bold text-gold">{k.no}</span><span className="text-[13px] font-bold">{k.nama}</span>
                      <span className="ml-auto rounded-full bg-white/15 px-2 text-[11px]">{items.length}</span>
                    </div>
                    <ul className="divide-y divide-line text-[12.5px]">
                      {items.map((x) => (
                        <li key={x.id} className="flex items-start gap-2 px-4 py-2">
                          <span className="flex-1">{x.driver}</span>
                          {x.bentuk && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600">{x.bentuk}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section letter="B" title="Risk Driver Tambahan Entitas" right={<Button edit variant="outline" onClick={add}><Plus className="h-4 w-4" />Tambah</Button>}>
            <TableWrap>
              <table className="kk-table">
                <thead><tr><th className="w-14">No</th><th className="w-72">Kategori Risiko</th><th>Risk Driver Tambahan Entitas</th><th className="w-10" /></tr></thead>
                <tbody>
                  <tr className="example"><td>Contoh</td><td>Risiko Operasional</td><td>Pendudukan lahan oleh pihak lain</td><td /></tr>
                  {extra.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-center">{i + 1}</td>
                      <td className="input"><SelectCell value={r.kategori} options={d.kategori.map((k) => k.nama)} onSave={(v) => { if (v) patch(r.id, { kategori: v }); }} /></td>
                      <td className="input"><EditCell value={r.driver} onSave={(v) => { if (v) patch(r.id, { driver: String(v) }); }} /></td>
                      <td><button data-edit onClick={() => del(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                  {extra.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">Belum ada risk driver tambahan.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </>
      )}
    </SheetPage>
  );
}
