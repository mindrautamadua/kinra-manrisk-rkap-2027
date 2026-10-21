"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Bot, ChevronDown, ExternalLink, Loader2, MessagesSquare, Sparkles } from "lucide-react";
import { challengeApi } from "@/lib/data";
import type { ChallengeLog } from "@/lib/types";
import { konfirmasiManual, validasiChallenge, type HasilValidasi } from "@/lib/validasi-challenge";

const PRIO_CLS: Record<string, string> = {
  Tinggi: "bg-rose-50 text-rose-700 ring-rose-600/20", Sedang: "bg-amber-50 text-amber-800 ring-amber-500/30", Rendah: "bg-slate-50 text-slate-600 ring-slate-400/30",
};

/** Masukan Log Challenge yang merujuk ke halaman ini (lembar, parameter, atau risiko pada Risk Register). */
function cocok(l: ChallengeLog, path: string) {
  if (l.ref_type === "lembar") return l.ref_id === path;
  if (l.ref_type === "parameter") return path === `/parameter/${l.ref_id}`;
  if (l.ref_type === "risiko") return path === "/risk-register";
  return false;
}

/** Daftar periksa masukan challenge session untuk lembar yang sedang dibuka; centang = status Selesai, hanya dari Validasi AI. */
export function ChallengePanel() {
  const path = decodeURIComponent(usePathname());
  const [rows, setRows] = useState<ChallengeLog[]>([]);
  const [open, setOpen] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [ai, setAi] = useState<Record<string, HasilValidasi>>({});
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    let aktif = true;
    const load = () => challengeApi.list().then((d) => aktif && setRows(d)).catch(() => {});
    load();
    window.addEventListener("challenge-log-updated", load);
    return () => { aktif = false; window.removeEventListener("challenge-log-updated", load); };
  }, []);

  const list = useMemo(() => rows.filter((l) => cocok(l, path)).sort((a, b) => a.created_at.localeCompare(b.created_at)), [rows, path]);
  if (!list.length) return null;

  const selesai = list.filter((l) => l.status === "Selesai").length;
  const semua = selesai === list.length;
  const terbuka = open ?? !semua;
  const hariIni = new Date().toISOString().slice(0, 10);

  /** AI menilai masukan yang belum selesai terhadap isi lembar; server mencentang yang terpenuhi dan menyimpan hasilnya. */
  const validasi = async () => {
    const belum = list.filter((l) => l.status !== "Selesai");
    if (!belum.length) return;
    setBusy(true); setErr(""); setInfo(""); setOpen(true);
    try {
      const hasil = await validasiChallenge(path, belum[0].ref_label ?? path, belum);
      setAi((a) => ({ ...a, ...Object.fromEntries(hasil.map((h) => [h.id, h])) }));
      const lolos = hasil.filter((h) => h.putusan === "terpenuhi").length;
      window.dispatchEvent(new Event("challenge-log-updated"));
      setInfo(`${lolos} dari ${hasil.length} masukan dinilai terpenuhi${lolos ? " dan dicentang otomatis" : ""}.`);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  /** Hanya untuk putusan AI "perlu dicek manual": pengguna menyertakan bukti, server yang menutup. */
  const konfirmasi = async (l: ChallengeLog) => {
    const bukti = window.prompt("Bukti atau keterangan penyelesaian (mis. nomor undangan rapat dengan Holding, notulen, tautan dokumen):", "");
    if (bukti == null) return;
    setErr("");
    try { await konfirmasiManual(l.id, bukti); window.dispatchEvent(new Event("challenge-log-updated")); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className={clsx("mb-6 rounded-xl border print:hidden", semua ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300/70 bg-amber-50/70")}>
      <div className="flex items-center gap-2 pr-3">
      <button onClick={() => setOpen(!terbuka)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left">
        <MessagesSquare className={clsx("h-4 w-4 shrink-0", semua ? "text-emerald-600" : "text-amber-600")} />
        <span className="text-[13px] font-semibold text-ink">Masukan Challenge Session</span>
        <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-bold", semua ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
          {selesai}/{list.length} selesai
        </span>
        <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-black/10 sm:block">
          <span className={clsx("block h-full rounded-full", semua ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${(selesai / list.length) * 100}%` }} />
        </span>
        <ChevronDown className={clsx("ml-auto h-4 w-4 text-slate-500 transition", terbuka && "rotate-180")} />
      </button>
        {!semua && (
          <button onClick={validasi} disabled={busy} title="AI memeriksa apakah isian lembar ini sudah memenuhi masukan; yang terpenuhi dicentang otomatis"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-600/30 bg-white px-2.5 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{busy ? "Memvalidasi…" : "Validasi AI"}
          </button>
        )}
      </div>
      {terbuka && (
        <div className="border-t border-black/5 px-4 py-2">
          <ul className="divide-y divide-black/5">
            {list.map((l) => {
              const done = l.status === "Selesai";
              const telat = !done && l.tenggat && l.tenggat < hariIni;
              return (
                <li key={l.id} className="flex items-start gap-3 py-2.5">
                  <input type="checkbox" checked={done} readOnly disabled title={done ? "Selesai berdasarkan Validasi AI" : "Dicentang otomatis bila Validasi AI menilai terpenuhi"}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className={clsx("text-[13px] leading-relaxed", done ? "text-slate-400 line-through" : "text-ink")}>{l.masukan}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500">
                      <span className={clsx("rounded-full px-1.5 py-px font-semibold ring-1 ring-inset", PRIO_CLS[l.prioritas])}>{l.prioritas}</span>
                      {l.ref_type === "risiko" && l.ref_label && <span className="font-semibold text-slate-600">{l.ref_label}</span>}
                      {!done && l.status === "Dalam proses" && <span className="font-semibold text-amber-700">Dalam proses</span>}
                      {l.pic && <span>PIC: {l.pic}</span>}
                      {l.tenggat && <span className={clsx(telat && "font-semibold text-rose-600")}>Tenggat {new Date(l.tenggat).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}{telat && " (lewat)"}</span>}
                      {l.tanggapan && <span className="italic">“{l.tanggapan}”</span>}
                    </div>
                    {!done && (ai[l.id] ?? l.validasi_ai) && <HasilAI h={ai[l.id] ?? l.validasi_ai!} />}
                    {!done && (ai[l.id] ?? l.validasi_ai)?.putusan === "verifikasi_manual" && (
                      <button onClick={() => konfirmasi(l)} className="mt-1.5 text-[12px] font-semibold text-brand-700 hover:underline">Konfirmasi selesai dengan bukti…</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {info && <div className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-800">{info}</div>}
          {err && <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</div>}
          <Link href="/challenge" className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">
            Buka Log Challenge<ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

const PUTUSAN = {
  terpenuhi: { label: "AI: terpenuhi", cls: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  belum: { label: "AI: belum terpenuhi", cls: "border-rose-200 bg-rose-50 text-rose-900" },
  verifikasi_manual: { label: "AI: perlu dicek manual", cls: "border-slate-200 bg-slate-50 text-slate-700" },
} as const;

function HasilAI({ h }: { h: Pick<HasilValidasi, "putusan" | "alasan" | "kekurangan"> }) {
  const p = PUTUSAN[h.putusan];
  return (
    <div className={clsx("mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed", p.cls)}>
      <div className="flex items-center gap-1.5 font-bold"><Bot className="h-3.5 w-3.5" />{p.label}</div>
      <div className="mt-0.5">{h.alasan}</div>
      {h.kekurangan && <div className="mt-1"><span className="font-semibold">Yang perlu dilengkapi: </span>{h.kekurangan}</div>}
    </div>
  );
}
