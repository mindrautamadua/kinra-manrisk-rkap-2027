"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Download, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { Button, ErrorBox, Loading, SheetPage, Stat, TableWrap, useLoad, useSaver } from "@/components/ui";
import { ChallengeModal } from "@/components/ChallengeForm";
import { challengeApi } from "@/lib/data";
import { exportChallenge } from "@/lib/export";
import { PRIORITAS, STATUS_LOG, STATUS_MANUAL, type ChallengeLog } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

const STATUS_CLS: Record<string, string> = {
  Terbuka: "bg-rose-50 text-rose-700 ring-rose-600/20", "Dalam proses": "bg-amber-50 text-amber-800 ring-amber-500/30", Selesai: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};
const PRIO_CLS: Record<string, string> = { Tinggi: "text-rose-700", Sedang: "text-amber-700", Rendah: "text-slate-500" };

const refHref = (l: Pick<ChallengeLog, "ref_type" | "ref_id">) =>
  l.ref_type === "parameter" ? `/parameter/${l.ref_id}` : l.ref_type === "lembar" ? l.ref_id ?? "/" : l.ref_type === "risiko" ? "/risk-register" : null;

export default function ChallengePage() {
  const q = useLoad(challengeApi.list);
  const saver = useSaver();
  const [baru, setBaru] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [fPrio, setFPrio] = useState("");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => q.data ?? [], [q.data]);

  const { reload } = q;
  useEffect(() => {
    window.addEventListener("challenge-log-updated", reload);
    return () => window.removeEventListener("challenge-log-updated", reload);
  }, [reload]);

  const list = useMemo(() => rows.filter((r) => (!fStatus || r.status === fStatus) && (!fPrio || r.prioritas === fPrio) &&
    (!search || [r.masukan, r.ref_label, r.challenger, r.pic, r.tanggapan].some((x) => (x ?? "").toLowerCase().includes(search.toLowerCase())))), [rows, fStatus, fPrio, search]);

  const patch = (id: string, p: Partial<ChallengeLog>) => {
    q.setData(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
    saver.run(() => challengeApi.update(id, p));
  };
  const del = async (r: ChallengeLog) => {
    if (!(await konfirmasi({ judul: "Hapus catatan masukan?" }))) return;
    q.setData(rows.filter((x) => x.id !== r.id));
    saver.run(() => challengeApi.remove(r.id));
  };
  const n = (s: string) => rows.filter((r) => r.status === s).length;
  const lewat = rows.filter((r) => r.status !== "Selesai" && r.tenggat && r.tenggat < new Date().toISOString().slice(0, 10)).length;

  return (
    <SheetPage title="Log Challenge Session RKAP 2027" code="Challenge Session" wide
      actions={<>{saver.indicator}
        <Button variant="outline" onClick={() => exportChallenge(list)} disabled={!list.length}><Download className="h-4 w-4" />Notulen Excel</Button>
        <Button onClick={() => setBaru(true)}><Plus className="h-4 w-4" />Catat Masukan</Button></>}>
      {q.loading ? <Loading variant="stats-table" /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total masukan" value={rows.length} accent="bg-brand-600" sub={`${rows.filter((r) => r.prioritas === "Tinggi").length} prioritas tinggi`} />
            <Stat label="Terbuka" value={n("Terbuka")} accent="bg-rose-500" />
            <Stat label="Dalam proses" value={n("Dalam proses")} accent="bg-amber-400" />
            <Stat label="Selesai" value={n("Selesai")} accent="bg-emerald-500" sub={lewat ? `${lewat} lewat tenggat` : "Tidak ada yang lewat tenggat"} />
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari masukan, PIC, rujukan…" className="w-64 rounded-lg border border-line bg-white py-1.5 pr-3 pl-8 text-[13px] outline-none focus:border-brand-500" />
            </div>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-lg border border-line bg-white px-2 text-[13px]"><option value="">Semua status</option>{STATUS_LOG.map((s) => <option key={s}>{s}</option>)}</select>
            <select value={fPrio} onChange={(e) => setFPrio(e.target.value)} className="rounded-lg border border-line bg-white px-2 text-[13px]"><option value="">Semua prioritas</option>{PRIORITAS.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <TableWrap>
            <table className="kk-table min-w-[1500px]">
              <thead><tr>
                <th className="w-10">No</th><th className="w-12">Done</th><th className="w-28">Waktu</th><th className="w-56">Terkait</th><th>Masukan Challenger</th><th className="w-32">Challenger</th>
                <th className="w-24">Prioritas</th><th className="w-64">Tanggapan / Komitmen</th><th className="w-32">PIC</th><th className="w-32">Tenggat</th><th className="w-32">Status</th><th className="w-8" />
              </tr></thead>
              <tbody>
                {list.map((r, i) => {
                  const href = refHref(r);
                  const telat = r.status !== "Selesai" && r.tenggat && r.tenggat < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={r.id}>
                      <td className="text-center">{list.length - i}</td>
                      <td className="text-center"><input type="checkbox" checked={r.status === "Selesai"} readOnly disabled
                        title={r.status === "Selesai" ? "Selesai berdasarkan Validasi AI" : "Dicentang otomatis oleh Validasi AI di lembar terkait"} className="h-4 w-4 accent-emerald-600" /></td>
                      <td className="text-[11.5px] text-slate-500 tabnum">{new Date(r.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="text-[12px]">
                        {href ? <Link href={href} className="inline-flex items-start gap-1 font-semibold text-brand-700 hover:underline">{r.ref_label}<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /></Link> : <span className="font-semibold">{r.ref_label ?? "Umum"}</span>}
                      </td>
                      <td className={clsx("input", r.status === "Selesai" && "text-slate-400 line-through")}><Txt value={r.masukan} onSave={(v) => v && patch(r.id, { masukan: v })} /></td>
                      <td className="input"><Txt value={r.challenger} onSave={(v) => patch(r.id, { challenger: v })} /></td>
                      <td className="input"><Sel value={r.prioritas} options={PRIORITAS} className={clsx("font-semibold", PRIO_CLS[r.prioritas])} onSave={(v) => patch(r.id, { prioritas: v })} /></td>
                      <td className="input"><Txt value={r.tanggapan} onSave={(v) => patch(r.id, { tanggapan: v })} placeholder="Tanggapan…" /></td>
                      <td className="input"><Txt value={r.pic} onSave={(v) => patch(r.id, { pic: v })} placeholder="PIC…" /></td>
                      <td className={clsx("input", telat && "!bg-rose-100")}>
                        <input type="date" value={r.tenggat ?? ""} onChange={(e) => patch(r.id, { tenggat: e.target.value || null })} className="w-full bg-transparent text-[12px] outline-none" />
                      </td>
                      <td>
                        {/* Selesai hanya dari Validasi AI; dari status Selesai pengguna masih boleh membuka kembali. */}
                        <select value={r.status} onChange={(e) => patch(r.id, { status: e.target.value })} title="Status Selesai hanya diberikan melalui Validasi AI"
                          className={clsx("w-full cursor-pointer rounded-full px-2 py-0.5 text-[11.5px] font-bold ring-1 ring-inset outline-none", STATUS_CLS[r.status])}>
                          {STATUS_LOG.map((s) => <option key={s} disabled={!(STATUS_MANUAL as readonly string[]).includes(s)}>{s}</option>)}
                        </select>
                        {r.validasi_ai && <div className="mt-1 text-[10.5px] text-slate-500" title={r.validasi_ai.alasan}>AI: {r.validasi_ai.putusan === "verifikasi_manual" ? "perlu dicek manual" : r.validasi_ai.putusan}</div>}
                      </td>
                      <td><button onClick={() => del(r)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={12} className="py-12 text-center text-slate-400">{rows.length ? "Tidak ada yang cocok dengan filter." : "Belum ada masukan. Klik “Catat Masukan” atau tombol kuning di kanan bawah dari halaman mana pun."}</td></tr>}
              </tbody>
            </table>
          </TableWrap>
          {baru && <ChallengeModal initial={{ type: "umum", id: "", label: "Umum" }} onClose={() => setBaru(false)} onSaved={(row) => q.setData([row, ...rows])} />}
        </>
      )}
    </SheetPage>
  );
}

/** Sel teks Log Challenge: tetap dapat diedit walau mode presentasi aktif. */
function Txt({ value, onSave, placeholder = "–" }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null) {
    return <textarea autoFocus value={draft} rows={Math.max(2, Math.ceil(draft.length / 60))} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { const v = draft.trim() || null; setDraft(null); if (v !== value) onSave(v); }}
      onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); }}
      className="w-full resize-y rounded-md border border-brand-500 bg-white px-1.5 py-1 text-[12.5px] outline-none" />;
  }
  return <div role="button" tabIndex={0} onClick={() => setDraft(value ?? "")} className="min-h-[22px] cursor-text whitespace-pre-line">{value || <span className="text-slate-400 italic">{placeholder}</span>}</div>;
}

function Sel({ value, options, onSave, className }: { value: string; options: readonly string[]; onSave: (v: string) => void; className?: string }) {
  return <select value={value} onChange={(e) => onSave(e.target.value)} className={clsx("w-full cursor-pointer bg-transparent text-[12.5px] outline-none", className)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
}
