"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Camera, GitCompareArrows, Minus, Plus, Trash2 } from "lucide-react";
import { Button, Card, ErrorBox, Loading, SheetPage, useLoad, useSaver } from "@/components/ui";
import { captureSnapshot, snapshotApi } from "@/lib/data";
import { diffSnapshot, type SectionDiff } from "@/lib/diff";
import type { Snapshot, SnapshotData } from "@/lib/types";

const KINI = "__kini__";
const fmt = (v: unknown) => {
  if (v == null || v === "") return "–";
  if (Array.isArray(v)) return v.join(", ") || "–";
  if (typeof v === "number") return Math.abs(v) <= 1 && !Number.isInteger(v) ? `${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%` : v.toLocaleString("id-ID");
  const s = String(v);
  return s.length > 220 ? s.slice(0, 220) + "…" : s;
};
const tgl = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SnapshotPage() {
  const q = useLoad(snapshotApi.list);
  const saver = useSaver();
  const list = useMemo(() => q.data ?? [], [q.data]);
  const [nama, setNama] = useState("");
  const [catatan, setCatatan] = useState("");
  const [base, setBase] = useState("");
  const [target, setTarget] = useState(KINI);
  const [diff, setDiff] = useState<SectionDiff[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setNama(`Versi Challenge Session ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`); }, []);
  useEffect(() => { if (!base && list.length) setBase(list[0].id); }, [list, base]);

  const ambil = () => saver.run(async () => {
    const data = await captureSnapshot();
    const row = await snapshotApi.add(nama.trim() || "Snapshot", catatan.trim() || null, data);
    q.setData([row, ...list]); setBase(row.id); setCatatan("");
  });
  const hapus = (s: Snapshot) => {
    if (!confirm(`Hapus snapshot "${s.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    q.setData(list.filter((x) => x.id !== s.id));
    if (base === s.id) setBase("");
    saver.run(() => snapshotApi.remove(s.id));
  };

  const load = async (id: string): Promise<SnapshotData> => (id === KINI ? captureSnapshot() : (await snapshotApi.get(id)).data!);
  const bandingkan = async () => {
    if (!base) return;
    setBusy(true); setErr("");
    try { const [a, b] = await Promise.all([load(base), load(target)]); setDiff(diffSnapshot(a, b)); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const total = useMemo(() => diff?.reduce((a, s) => a + s.items.length, 0) ?? 0, [diff]);
  const label = (id: string) => (id === KINI ? "Kondisi saat ini" : list.find((s) => s.id === id)?.nama ?? "");

  return (
    <SheetPage title="Snapshot Versi & Perbandingan" code="Challenge Session" actions={saver.indicator}
      note="Bekukan kondisi kertas kerja (RAS, Risk Register, isian seluruh lembar parameter, RAM, CAT) sebelum challenge session. Setelah sesi, bandingkan snapshot dengan kondisi saat ini untuk melihat apa saja yang berubah akibat masukan challenger.">
      {q.loading ? <Loading variant="list" /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-center gap-2 font-bold"><Camera className="h-4 w-4 text-brand-600" />Ambil snapshot baru</div>
              <input value={nama} onChange={(e) => setNama(e.target.value)} className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand-500" />
              <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="Catatan (opsional), mis. sebelum challenge session"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand-500" />
              <Button className="mt-3 w-full justify-center" onClick={ambil}><Camera className="h-4 w-4" />Bekukan Kondisi Sekarang</Button>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3 font-bold">Daftar snapshot ({list.length})</div>
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li key={s.id} className={clsx("group flex items-start gap-3 px-5 py-3", base === s.id && "bg-brand-50/60")}>
                    <button onClick={() => setBase(s.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-[13px] font-semibold">{s.nama}</div>
                      <div className="text-[11.5px] text-slate-500">{tgl(s.created_at)}{s.catatan ? ` · ${s.catatan}` : ""}</div>
                    </button>
                    <button onClick={() => hapus(s)} title="Hapus snapshot" className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
                {!list.length && <li className="px-5 py-8 text-center text-[13px] text-slate-400">Belum ada snapshot.</li>}
              </ul>
            </Card>
          </div>

          <div>
            <Card className="mb-5 flex flex-wrap items-end gap-3 p-5">
              <label className="min-w-[220px] flex-1"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Versi dasar</span>
                <select value={base} onChange={(e) => setBase(e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px]">
                  <option value="">Pilih snapshot…</option>{list.map((s) => <option key={s.id} value={s.id}>{s.nama} · {tgl(s.created_at)}</option>)}
                </select></label>
              <GitCompareArrows className="mb-2.5 h-5 w-5 text-slate-400" />
              <label className="min-w-[220px] flex-1"><span className="mb-1 block text-[12px] font-semibold text-slate-600">Dibandingkan dengan</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px]">
                  <option value={KINI}>Kondisi saat ini</option>{list.filter((s) => s.id !== base).map((s) => <option key={s.id} value={s.id}>{s.nama} · {tgl(s.created_at)}</option>)}
                </select></label>
              <Button onClick={bandingkan} disabled={!base || busy}>{busy ? "Membandingkan…" : "Bandingkan"}</Button>
            </Card>
            {err && <ErrorBox error={err} />}
            {diff && (
              <div className="space-y-4">
                <div className="text-[13px] text-slate-600"><b className="text-ink">{total}</b> perubahan dari <b>{label(base)}</b> ke <b>{label(target)}</b></div>
                {diff.map((sec) => (
                  <Card key={sec.id} className="overflow-hidden">
                    <div className="flex items-center gap-3 border-b border-line bg-paper/50 px-5 py-2.5">
                      <h3 className="text-[13.5px] font-bold">{sec.title}</h3>
                      <span className={clsx("rounded-full px-2 text-[11px] font-bold", sec.items.length ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>{sec.items.length || "Tidak berubah"}</span>
                    </div>
                    {sec.items.length > 0 && (
                      <ul className="divide-y divide-line">
                        {sec.items.map((it) => (
                          <li key={it.key} className="px-5 py-3">
                            <div className="flex items-center gap-2 text-[13px] font-semibold">
                              {it.kind === "tambah" && <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 text-[11px] text-emerald-800"><Plus className="h-3 w-3" />Baru</span>}
                              {it.kind === "hapus" && <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 text-[11px] text-rose-800"><Minus className="h-3 w-3" />Dihapus</span>}
                              {it.kind === "ubah" && <span className="rounded bg-amber-100 px-1.5 text-[11px] text-amber-800">Diubah</span>}
                              {it.label}
                            </div>
                            {it.changes.length > 0 && (
                              <table className="mt-2 w-full text-[12px]">
                                <tbody>
                                  {it.changes.map((c) => (
                                    <tr key={c.field} className="align-top">
                                      <td className="w-44 py-1 pr-3 font-medium text-slate-500">{c.field}</td>
                                      <td className="py-1 pr-3 text-rose-700 line-through decoration-rose-300">{c.field === "Sel isian berubah" ? "" : fmt(c.before)}</td>
                                      <td className="py-1 text-emerald-800">{fmt(c.after)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SheetPage>
  );
}
