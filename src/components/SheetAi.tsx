"use client";
import { Fragment, useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "./ui";
import { api } from "@/lib/data";
import { dateToSerial } from "@/lib/engine";
import type { BarisAi, KolomAi, LembarRequest, LembarResponse, SheetAiConfig, TipeKolom } from "@/lib/sheet-ai";
import type { CellValue } from "@/lib/types";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const kosong = (v: unknown) => v == null || v === "";

/** Nilai sel -> satuan yang dipakai model (persen dalam satuan persen, tanggal ISO). */
function keAi(v: CellValue, tipe: TipeKolom): string | number | null {
  if (kosong(v)) return null;
  if (tipe === "persen" && typeof v === "number") return Math.round(v * 1e6) / 1e4;
  if (tipe === "tanggal" && typeof v === "number") return new Date(EXCEL_EPOCH + v * 86400000).toISOString().slice(0, 10);
  return v as string | number;
}

/** Jawaban model -> nilai sel. null bila kosong atau tidak valid. */
function dariAi(v: unknown, tipe: TipeKolom): CellValue {
  if (kosong(v)) return null;
  if (tipe === "teks" || tipe === "pilihan") return String(v).trim() || null;
  if (tipe === "tanggal") {
    const m = String(v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? dateToSerial(new Date(+m[1], +m[2] - 1, +m[3])) : null;
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return tipe === "persen" ? n / 100 : tipe === "rp" ? Math.round(n) : n;
}

function tampil(v: unknown, tipe: TipeKolom) {
  if (kosong(v)) return "";
  const id = (n: number, d = 0) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(n);
  if (tipe === "rp") return `Rp${id(Number(v))}`;
  if (tipe === "angka") return id(Number(v), 2);
  if (tipe === "persen") return `${id(Number(v), 2)}%`;
  if (tipe === "tanggal") return String(v).split("-").reverse().join("-");
  return String(v);
}

const isTeks = (k: KolomAi) => k.tipe === "teks" || k.tipe === "pilihan";

/**
 * Isi lembar parameter dengan AI sesuai konfigurasi SHEET_AI: tabel (skenario/proyek/perkara) dan sel tunggal
 * (EBITDA, penjelasan hasil, rasionalisasi batas). Sel tabel yang sudah terisi tidak pernah ditimpa.
 */
export function SheetAiModal({ cfg, get, onApply, onClose }: {
  cfg: SheetAiConfig;
  get: (addr: string) => CellValue;
  onApply: (cells: Record<string, CellValue>) => void;
  onClose: () => void;
}) {
  const barisRange = (t: SheetAiConfig["tabel"][number]) => Array.from({ length: t.sampai - t.dari + 1 }, (_, i) => t.dari + i);
  const ada = Object.fromEntries(cfg.tabel.map((t) => [t.id, barisRange(t).filter((r) => t.kolom.some((k) => isTeks(k) && !kosong(get(k.col + r))))]));
  const barisKosong = Object.fromEntries(cfg.tabel.map((t) => [t.id, barisRange(t).filter((r) => t.kolom.every((k) => kosong(get(k.col + r))))]));

  const [entitas, setEntitas] = useState("PT KINRA");
  const [ekstra, setEkstra] = useState<Record<string, unknown>>({});
  const [instruksi, setInstruksi] = useState("");
  const [jumlahBaru, setJumlahBaru] = useState<Record<string, number>>(() => Object.fromEntries(cfg.tabel.map((t) => [t.id,
    Math.min(t.usulBaru ? (ada[t.id].length ? 2 : 4) : 10, barisKosong[t.id].length)])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hasil, setHasil] = useState<LembarResponse | null>(null);
  const [pakai, setPakai] = useState<Record<string, boolean>>({});
  const [teks, setTeks] = useState<Record<string, string>>({});

  const kategori = get("E9");
  useEffect(() => {
    api.sampul().then((s) => s.nama_entitas && setEntitas(s.nama_entitas)).catch(() => {});
    Promise.all([api.register(), api.ras()]).then(([reg, ras]) => setEkstra({
      sikap_ras: ras.filter((r) => r.kategori === kategori).map((r) => ({ sikap: r.sikap, pernyataan: r.pernyataan })),
      risiko_terkait: reg.filter((x) => (x.parameter_ram ?? []).includes(cfg.code))
        .map((x) => ({ risk_event: x.risk_event, root_cause: x.root_cause, rencana_mitigasi: x.rencana_mitigasi })),
    })).catch(() => {});
  }, [cfg.code, kategori]);

  const ekstrakSaja = cfg.tabel.every((t) => !t.usulBaru);

  const buat = async () => {
    setBusy(true); setErr("");
    try {
      const req: LembarRequest = {
        code: cfg.code, entitas, instruksi,
        tabel: Object.fromEntries(cfg.tabel.map((t) => [t.id, {
          ada: ada[t.id].map((r) => ({ baris: r, ...Object.fromEntries(t.kolom.map((k) => [k.key, keAi(get(k.col + r), k.tipe)])) }) as BarisAi),
          barisBaru: barisKosong[t.id].slice(0, jumlahBaru[t.id] ?? 0),
        }])),
        sel: Object.fromEntries(cfg.sel.map((s) => [s.key, keAi(get(s.addr), s.tipe)])),
        konteks: { ...Object.fromEntries(Object.entries(cfg.konteks).map(([k, a]) => [k, get(a)])), ...ekstra },
      };
      const res = await fetch("/api/isi-ai/lembar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const out = body as LembarResponse;
      setHasil(out);
      setTeks(Object.fromEntries(cfg.sel.filter((s) => s.tipe === "teks").map((s) => [s.key, String(out.sel[s.key] ?? "")])));
      setPakai({
        ...Object.fromEntries(cfg.tabel.flatMap((t) => (out.tabel[t.id] ?? []).map((b) => [`${t.id}:${b.baris}`, true]))),
        ...Object.fromEntries(cfg.sel.map((s) => [s.key, kosong(get(s.addr)) && !kosong(out.sel[s.key])])),
      });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  /** Sel baru untuk satu baris: hanya sel yang masih kosong. */
  const selBaris = (t: SheetAiConfig["tabel"][number], b: BarisAi) => {
    const out: Record<string, CellValue> = {};
    for (const k of t.kolom) {
      const addr = k.col + b.baris;
      const v = dariAi(b[k.key], k.tipe);
      if (v != null && kosong(get(addr)) && (k.tipe !== "pilihan" || k.options?.includes(String(v)))) out[addr] = v;
    }
    return out;
  };

  const kumpulkan = () => {
    const cells: Record<string, CellValue> = {};
    if (!hasil) return cells;
    for (const t of cfg.tabel) for (const b of hasil.tabel[t.id] ?? []) if (pakai[`${t.id}:${b.baris}`]) Object.assign(cells, selBaris(t, b));
    for (const s of cfg.sel) {
      if (!pakai[s.key]) continue;
      const v = dariAi(s.tipe === "teks" ? teks[s.key] : hasil.sel[s.key], s.tipe);
      if (v != null) cells[s.addr] = v;
    }
    return cells;
  };

  const terapkan = () => {
    const cells = kumpulkan();
    if (!Object.keys(cells).length) { setErr("Tidak ada sel yang akan diisi dari pilihan ini."); return; }
    onApply(cells);
    onClose();
  };
  const jumlahSel = Object.keys(kumpulkan()).length;
  const totalBaris = hasil ? cfg.tabel.reduce((n, t) => n + (hasil.tabel[t.id]?.length ?? 0), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={(e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !busy) { if (hasil) terapkan(); else void buat(); }
    }}>
      <div className="absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <Sparkles className="h-5 w-5 text-brand-600" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.14em] text-brand-600 uppercase">Isi dengan AI</div>
            <div className="truncate text-[16px] font-bold">{cfg.code} · {cfg.judul}</div>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-slate-600">
              {ekstrakSaja
                ? "Tempel atau ketik datanya. AI hanya menyusun dari data yang Anda tulis dan tidak menambah proyek/perkara sendiri."
                : "Uraian dan angka dasar. Nominal Rp hanya dihitung dari angka yang Anda tulis di sini."}
            </span>
            <textarea autoFocus rows={5} className={input} value={instruksi} onChange={(e) => setInstruksi(e.target.value)} placeholder={cfg.placeholder} />
          </label>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {cfg.tabel.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-[12.5px] text-slate-600">
                {t.usulBaru ? `Usulan ${t.judul.toLowerCase()} baru` : `Maks. baris baru ${t.judul.toLowerCase()}`}
                <input type="number" min={0} max={barisKosong[t.id].length} value={jumlahBaru[t.id]}
                  onChange={(e) => setJumlahBaru({ ...jumlahBaru, [t.id]: Math.max(0, Math.min(barisKosong[t.id].length, Number(e.target.value) || 0)) })}
                  className="w-16 rounded-lg border border-line px-2 py-1 text-[13px]" />
                <span className="text-slate-400">(sisa {barisKosong[t.id].length})</span>
              </label>
            ))}
            <Button onClick={buat} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{hasil ? "Buat Ulang Draf" : "Buat Draf"}
            </Button>
          </div>
          <div className="text-[11.5px] text-slate-500">
            {cfg.tabel.map((t) => `${ada[t.id].length} ${t.judul.toLowerCase()} sudah ada`).join(" · ")}. Hanya sel tabel yang masih kosong yang diisi; isian Anda tidak ditimpa.
            Tanpa angka di uraian, kolom angka dan tanggal dibiarkan kosong.
          </div>

          {hasil && (
            <>
              {hasil.catatan && (
                <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950 ring-1 ring-amber-300/60">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="whitespace-pre-line"><b>Perlu diverifikasi:</b> {hasil.catatan}</div>
                </div>
              )}
              {totalBaris > 0 && (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {cfg.tabel.map((t) => (hasil.tabel[t.id]?.length ?? 0) > 0 && (
                    <Fragment key={t.id}>
                      {cfg.tabel.length > 1 && <div className="bg-paper/60 px-4 py-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">{t.judul}</div>}
                      {hasil.tabel[t.id].map((b) => {
                        const id = `${t.id}:${b.baris}`;
                        const baru = !ada[t.id].includes(b.baris);
                        const info = t.kolom.filter((k) => isTeks(k) && k.key !== t.kunci && k.key !== "catatan" && !kosong(b[k.key]));
                        const angka = t.kolom.filter((k) => !isTeks(k) && !kosong(b[k.key]));
                        return (
                          <label key={id} className={clsx("grid cursor-pointer grid-cols-[24px_1fr] gap-x-2 px-4 py-3", !pakai[id] && "opacity-60")}>
                            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={!!pakai[id]} onChange={(e) => setPakai({ ...pakai, [id]: e.target.checked })} />
                            <div className="min-w-0 text-[12.5px]">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-400">Baris {b.baris}</span>
                                <span className={clsx("rounded px-1.5 text-[10.5px] font-bold", baru ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600")}>{baru ? "BARU" : "LENGKAPI"}</span>
                                <span className="text-[11px] text-slate-400">{Object.keys(selBaris(t, b)).length} sel akan diisi</span>
                              </div>
                              <div className="mt-0.5 font-semibold">{String(b[t.kunci] ?? "")}</div>
                              {info.length > 0 && <div className="text-[11.5px] text-slate-500">{info.map((k) => String(b[k.key])).join(" · ")}</div>}
                              {angka.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabnum">
                                  {angka.map((k) => <span key={k.key}><span className="text-slate-500">{k.label}:</span> {tampil(b[k.key], k.tipe)}</span>)}
                                </div>
                              )}
                              {!kosong(b.catatan) && <div className="mt-1 text-[11.5px] whitespace-pre-line text-slate-600">{String(b.catatan)}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              )}
              <div className="divide-y divide-line rounded-xl border border-line">
                {cfg.sel.map((s) => {
                  const lama = get(s.addr);
                  const nilai = hasil.sel[s.key];
                  if (s.tipe !== "teks" && kosong(nilai)) return null;
                  return (
                    <div key={s.key} className={clsx("grid grid-cols-[24px_1fr] gap-x-2 px-4 py-3", !pakai[s.key] && "opacity-60")}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={!!pakai[s.key]} onChange={(e) => setPakai({ ...pakai, [s.key]: e.target.checked })} />
                      <div className="min-w-0">
                        <div className="mb-1 text-[12px] font-semibold text-slate-700">{s.label} <span className="font-normal text-slate-400">({s.addr})</span></div>
                        {s.tipe === "teks"
                          ? <textarea rows={3} className={input} value={teks[s.key] ?? ""} onChange={(e) => setTeks({ ...teks, [s.key]: e.target.value })} />
                          : <div className="text-[13px] font-semibold tabnum">{tampil(nilai, s.tipe)}</div>}
                        {!kosong(lama) && <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">Saat ini: {tampil(keAi(lama, s.tipe), s.tipe)} · dicentang = menimpa</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">Draf oleh {hasil.model}. Periksa kembali sebelum diterapkan.</div>
            </>
          )}
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</div>}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-paper/50 px-6 py-3">
          <span className="text-[11.5px] text-slate-500">Ctrl/⌘ + Enter untuk {hasil ? "terapkan" : "buat draf"}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Batal</Button>
            <Button onClick={terapkan} disabled={!hasil || busy || !jumlahSel}>Terapkan {jumlahSel ? `${jumlahSel} sel` : ""}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
