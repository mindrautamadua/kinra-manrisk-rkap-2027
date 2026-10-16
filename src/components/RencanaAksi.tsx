"use client";
import clsx from "clsx";
import { AlertTriangle, ListChecks, Plus, Scissors, Trash2, X } from "lucide-react";
import { Button, EditCell, SelectCell } from "./ui";
import { rupiah } from "@/lib/format";
import { kurangAksi, type RingkasTarget } from "@/lib/target-risiko";
import { KATEGORI_MITIGASI, TRIWULAN, type MitigasiAksi, type RiskRegister } from "@/lib/types";

/** Pecah teks Rencana Mitigasi menjadi butir aksi: per baris, atau per penomoran "1." / "a)" / "-" dalam satu paragraf. */
export function pecahMitigasi(teks: string | null | undefined): string[] {
  const s = (teks ?? "").trim();
  if (!s) return [];
  const baris = s.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const butir = baris.length > 1 ? baris : s.split(/\s(?=(?:\d{1,2}|[a-z])[.)]\s)/i);
  return butir.map((x) => x.replace(/^(?:[-•*]|\d{1,2}[.)]|[a-z][.)])\s*/i, "").trim()).filter(Boolean);
}

/** Rentang jadwal ringkas, mis. ["TW I","TW II","TW III"] → "TW I-III 2027". */
export function teksJadwal(j: string[]) {
  const idx = TRIWULAN.map((t, i) => (j.includes(t) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return "";
  const rom = ["I", "II", "III", "IV"];
  const runtun = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return `TW ${runtun && idx.length > 1 ? `${rom[idx[0]]}-${rom[idx[idx.length - 1]]}` : idx.map((i) => rom[i]).join(", ")} 2027`;
}

/** Teks Rencana Mitigasi (kolom template) yang disusun dari rencana aksi terstruktur. */
export function susunMitigasi(aksi: MitigasiAksi[]) {
  return aksi.filter((a) => a.aksi?.trim()).map((a, i) => {
    const rinci = [a.pic, teksJadwal(a.jadwal), a.output && `target: ${a.output}`].filter(Boolean).join("; ");
    return `${i + 1}. ${a.aksi!.trim()}${rinci ? ` (${rinci})` : ""}`;
  }).join("\n");
}

/** Editor rencana aksi mitigasi satu risiko: uraian, kategori, PIC, biaya, jadwal triwulan, dan output. */
export function RencanaAksiModal({ judul, risiko, aksi, ringkas, ro, onTambah, onUbah, onHapus, onPakaiTeks, onClose }: {
  judul: string;
  risiko: RiskRegister;
  aksi: MitigasiAksi[];
  ringkas: RingkasTarget;
  ro: boolean;
  onTambah: (rows: Partial<MitigasiAksi>[]) => void;
  onUbah: (id: string, p: Partial<MitigasiAksi>) => void;
  onHapus: (id: string) => void;
  /** Tulis ulang kolom teks Rencana Mitigasi dari rencana aksi. */
  onPakaiTeks: (teks: string) => void;
  onClose: () => void;
}) {
  const butirTeks = pecahMitigasi(risiko.rencana_mitigasi);
  const teksBaru = susunMitigasi(aksi);
  const penurunan = ringkas.elInheren != null && ringkas.elTarget != null ? ringkas.elInheren - ringkas.elTarget : null;
  const baru = (aksiTeks: string | null = null): Partial<MitigasiAksi> => ({ aksi: aksiTeks, kategori: risiko.kategori_mitigasi, jadwal: [] });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <ListChecks className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Rencana Aksi Mitigasi</div>
            <div className="truncate text-[16px] font-bold">{judul}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5 text-[13px]">
          <div className="grid gap-3 sm:grid-cols-4">
            <Angka label="Expected loss inheren" nilai={ringkas.elInheren} />
            <Angka label="Expected loss target" nilai={ringkas.elTarget} />
            <Angka label="Penurunan expected loss" nilai={penurunan} />
            <Angka label="Total biaya mitigasi" nilai={ringkas.biaya} warn={penurunan != null && ringkas.biaya > penurunan} />
          </div>

          {aksi.length === 0 && butirTeks.length > 0 && !ro && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
              <span className="text-slate-700">Teks Rencana Mitigasi berisi {butirTeks.length} butir. Jadikan baris rencana aksi, lalu lengkapi PIC, biaya, jadwal, dan output.</span>
              <Button variant="outline" onClick={() => onTambah(butirTeks.map(baru))} className="ml-auto"><Scissors className="h-3.5 w-3.5" />Pecah jadi {butirTeks.length} aksi</Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="kk-table min-w-[1040px]">
              <thead><tr>
                <th className="w-8">No</th><th>Rencana Aksi</th><th className="w-32">Kategori</th><th className="w-44">PIC / Unit</th>
                <th className="w-36">Biaya (Rp)</th><th className="w-44">Jadwal 2027</th><th className="w-56">Output / Target Terukur</th><th className="w-8" />
              </tr></thead>
              <tbody>
                {aksi.map((a, i) => {
                  const kurang = kurangAksi(a);
                  return (
                    <tr key={a.id}>
                      <td className="text-center font-semibold">
                        {i + 1}
                        {kurang.length > 0 && <span title={`Belum ada ${kurang.join(", ")}`}><AlertTriangle className="mx-auto mt-1 h-3.5 w-3.5 text-amber-500" /></span>}
                      </td>
                      <td className="input"><EditCell value={a.aksi} onSave={(v) => onUbah(a.id, { aksi: v as string })} placeholder="Uraian tindakan…" /></td>
                      <td className="input"><SelectCell value={a.kategori} options={KATEGORI_MITIGASI} onSave={(v) => onUbah(a.id, { kategori: v })} /></td>
                      <td className={clsx("input", !a.pic?.trim() && "!bg-amber-100/60")}><EditCell value={a.pic} onSave={(v) => onUbah(a.id, { pic: v as string })} placeholder="Divisi/Bagian…" /></td>
                      <td className={clsx("input", a.biaya == null && "!bg-amber-100/60")}>
                        <EditCell kind="number" value={a.biaya} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => onUbah(a.id, { biaya: v as number })} placeholder="0 bila tanpa biaya" />
                      </td>
                      <td className={clsx("input", !a.jadwal.length && "!bg-amber-100/60")}>
                        <div className="flex flex-wrap gap-1">
                          {TRIWULAN.map((t) => {
                            const on = a.jadwal.includes(t);
                            return (
                              <button key={t} disabled={ro} onClick={() => onUbah(a.id, { jadwal: TRIWULAN.filter((x) => (x === t ? !on : a.jadwal.includes(x))) })}
                                className={clsx("rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1", on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-500 ring-line hover:ring-brand-500")}>
                                {t.replace("TW ", "")}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className={clsx("input", !a.output?.trim() && "!bg-amber-100/60")}><EditCell value={a.output} onSave={(v) => onUbah(a.id, { output: v as string })} placeholder="Mis. 100% tenant terkontrak…" /></td>
                      <td>{!ro && <button onClick={() => onHapus(a.id)} className="text-slate-400 hover:text-rose-600" title="Hapus aksi"><Trash2 className="h-4 w-4" /></button>}</td>
                    </tr>
                  );
                })}
                {aksi.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-400">Belum ada rencana aksi.</td></tr>}
              </tbody>
            </table>
          </div>
          {!ro && <Button variant="outline" onClick={() => onTambah([baru()])}><Plus className="h-3.5 w-3.5" />Tambah aksi</Button>}

          {aksi.length > 0 && (
            <section className="rounded-xl bg-paper px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Teks Rencana Mitigasi (kolom template)</h3>
                {!ro && teksBaru && teksBaru !== (risiko.rencana_mitigasi ?? "").trim() && (
                  <button onClick={() => onPakaiTeks(teksBaru)} className="ml-auto text-[12px] font-semibold text-brand-700 hover:underline">Perbarui dari rencana aksi</button>
                )}
              </div>
              <div className="mt-1 whitespace-pre-line text-slate-700">{risiko.rencana_mitigasi || <span className="text-slate-400 italic">Kosong</span>}</div>
              {teksBaru && teksBaru !== (risiko.rencana_mitigasi ?? "").trim() && (
                <div className="mt-2 border-t border-line pt-2">
                  <div className="text-[11px] font-semibold text-slate-500">Usulan dari rencana aksi:</div>
                  <div className="mt-0.5 whitespace-pre-line text-slate-800">{teksBaru}</div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-line px-6 py-3 text-[11.5px] text-slate-500">
          Biaya isi 0 bila aksi tidak memerlukan anggaran tambahan. Jadwal adalah rencana pelaksanaan; realisasinya dipantau terpisah.
        </div>
      </div>
    </div>
  );
}

function Angka({ label, nilai, warn }: { label: string; nilai: number | null; warn?: boolean }) {
  return (
    <div className={clsx("rounded-xl border px-3 py-2", warn ? "border-amber-300 bg-amber-50" : "border-line")}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={clsx("font-bold tabnum", warn && "text-amber-800")}>{nilai == null ? "–" : rupiah(nilai, true)}</div>
    </div>
  );
}
