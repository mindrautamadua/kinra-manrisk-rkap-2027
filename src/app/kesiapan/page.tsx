"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { AlertOctagon, AlertTriangle, ArrowUpRight, CheckCircle2, Info, MessageSquarePlus, RefreshCw } from "lucide-react";
import { Button, Card, ErrorBox, Loading, SheetPage, useLoad } from "@/components/ui";
import { ChallengeModal, type RefItem } from "@/components/ChallengeForm";
import { api } from "@/lib/data";
import { buildRam } from "@/lib/ram";
import { periksa, SEV_ORDER, type Severity, type Temuan } from "@/lib/kesiapan";

const SEV: Record<Severity, { label: string; icon: React.ElementType; chip: string; bar: string }> = {
  kritis: { label: "Kritis", icon: AlertOctagon, chip: "bg-rose-50 text-rose-700 ring-rose-600/20", bar: "bg-rose-600" },
  perhatian: { label: "Perhatian", icon: AlertTriangle, chip: "bg-amber-50 text-amber-800 ring-amber-500/30", bar: "bg-amber-400" },
  info: { label: "Info", icon: Info, chip: "bg-sky-50 text-sky-800 ring-sky-500/25", bar: "bg-sky-400" },
};

export default function KesiapanPage() {
  const q = useLoad(async () => {
    const [sampul, ras, register, params, pengendalian, tambahan, drivers, cat] = await Promise.all([
      api.sampul(), api.ras(), api.register(), api.params(), api.pengendalian(), api.ramTambahan(), api.drivers(), api.cat(),
    ]);
    const ram = buildRam(params, ras, pengendalian, tambahan);
    const adaKeterkaitan = register.length === 0 || register.some((r) => "parameter_ram" in r);
    return periksa({ sampul, ras, register, params, ram, drivers, cat, adaKeterkaitan });
  });
  const [sev, setSev] = useState<Severity | "">("");
  const [catat, setCatat] = useState<RefItem | null>(null);
  const checks = useMemo(() => q.data ?? [], [q.data]);

  const temuan = useMemo(() => checks.flatMap((c) => c.temuan), [checks]);
  const lulus = checks.filter((c) => c.temuan.length === 0).length;
  const skor = checks.length ? Math.round((lulus / checks.length) * 100) : 0;
  const hit = (s: Severity) => temuan.filter((t) => t.severity === s).length;
  const areas = Array.from(new Set(checks.map((c) => c.area)));

  return (
    <SheetPage title="Cek Kesiapan Challenge Session" code="Challenge Session"
      actions={<Button variant="outline" onClick={q.reload}><RefreshCw className="h-4 w-4" />Periksa Ulang</Button>}>
      {q.loading ? <Loading variant="stats-table" label="Memeriksa seluruh kertas kerja…" /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          <div className="mb-6 grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
            <Card className="flex items-center gap-5 p-5">
              <Gauge value={skor} />
              <div>
                <div className="text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">Skor kesiapan</div>
                <div className="mt-1 text-[13px] text-slate-600"><b className="text-ink">{lulus}</b> dari {checks.length} pemeriksaan lulus</div>
                <div className="mt-1 text-[12px] text-slate-500">{hit("kritis") ? "Selesaikan temuan kritis sebelum sesi." : "Tidak ada temuan kritis."}</div>
              </div>
            </Card>
            {SEV_ORDER.map((s) => {
              const S = SEV[s];
              return (
                <button key={s} onClick={() => setSev(sev === s ? "" : s)}
                  className={clsx("relative overflow-hidden rounded-2xl border bg-white p-5 text-left transition", sev === s ? "border-brand-600 ring-2 ring-brand-500/20" : "border-line hover:border-brand-500/50")}>
                  <div className={clsx("absolute inset-y-0 left-0 w-1", S.bar)} />
                  <div className="flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase"><S.icon className="h-4 w-4" />{S.label}</div>
                  <div className="mt-2 text-[28px] leading-none font-extrabold tabnum">{hit(s)}</div>
                  <div className="mt-2 text-[11.5px] text-slate-500">{sev === s ? "Filter aktif · klik untuk lepas" : "Klik untuk memfilter"}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {areas.map((area) => {
              const list = checks.filter((c) => c.area === area);
              return (
                <Card key={area} className="overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-line bg-paper/50 px-5 py-3">
                    <h2 className="text-[14px] font-bold">{area}</h2>
                    <span className="text-[12px] text-slate-500">{list.filter((c) => !c.temuan.length).length}/{list.length} lulus</span>
                  </div>
                  <div className="divide-y divide-line">
                    {list.map((c) => {
                      const items = c.temuan.filter((t) => !sev || t.severity === sev);
                      if (sev && !items.length) return null;
                      return (
                        <div key={c.id} className="px-5 py-3">
                          <div className="flex items-center gap-2 text-[13px] font-semibold">
                            {c.temuan.length ? <span className={clsx("h-2.5 w-2.5 rounded-full", SEV[worst(c.temuan)].bar)} /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                            <span className={clsx(!c.temuan.length && "text-slate-500")}>{c.nama}</span>
                            {c.temuan.length > 0 && <span className="text-[11.5px] font-normal text-slate-400">{c.temuan.length} temuan</span>}
                          </div>
                          {items.length > 0 && (
                            <ul className="mt-2 space-y-1.5 pl-5">
                              {items.map((t) => <Item key={t.id} t={t} onCatat={() => setCatat(t.ref ?? { type: "lembar", id: t.href, label: t.area })} />)}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
          {catat && <ChallengeModal initial={catat} onClose={() => setCatat(null)} />}
        </>
      )}
    </SheetPage>
  );
}

const worst = (t: Temuan[]): Severity => SEV_ORDER.find((s) => t.some((x) => x.severity === s)) ?? "info";

function Item({ t, onCatat }: { t: Temuan; onCatat: () => void }) {
  const S = SEV[t.severity];
  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-paper/70">
      <span className={clsx("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset", S.chip)}>{S.label}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">{t.judul}</div>
        {t.detail && <div className="text-[11.5px] text-slate-500">{t.detail}</div>}
      </div>
      <button onClick={onCatat} title="Catat sebagai item Log Challenge" className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-brand-700">
        <MessageSquarePlus className="h-4 w-4" />
      </button>
      <Link href={t.href} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 hover:bg-white">
        Perbaiki<ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const color = value >= 85 ? "#1f6e43" : value >= 60 ? "#d97706" : "#e11d48";
  return (
    <svg width="78" height="78" viewBox="0 0 78 78" className="shrink-0">
      <circle cx="39" cy="39" r={r} fill="none" stroke="#ecebe4" strokeWidth="8" />
      <circle cx="39" cy="39" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 39 39)" />
      <text x="39" y="44" textAnchor="middle" fontSize="17" fontWeight="800" fill="#13201a">{value}%</text>
    </svg>
  );
}
