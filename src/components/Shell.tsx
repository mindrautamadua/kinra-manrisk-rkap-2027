"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  LayoutDashboard, Presentation, FileText, BookOpen, Target, Gauge, Network, ListChecks, Flame, Grid3x3, Briefcase, Sigma,
  Library, Database, ChevronDown, Menu, X, PanelLeftClose, PanelLeftOpen, Table2,
  ClipboardCheck, MessagesSquare, GitCompareArrows, Workflow, Lock, LockOpen, MessageSquarePlus, LifeBuoy, HelpCircle,
} from "lucide-react";
import { useMode } from "@/lib/mode";
import { ChallengeModal, refFromPath } from "./ChallengeForm";
import { REKAP } from "@/lib/static";
import { SHEETS } from "@/lib/nav";

const MAIN = [
  { href: "/sampul", label: "Sampul", icon: FileText },
  { href: "/petunjuk", label: "Petunjuk Pengisian", icon: BookOpen },
  { href: "/ras", label: "Risk Appetite Statement", icon: Target },
  { href: "/kriteria-dampak", label: "Kriteria Dampak", icon: Gauge },
  { href: "/risk-driver", label: "Risk Driver", icon: Network },
  { href: "/risk-register", label: "Risk Register", icon: ListChecks },
  { href: "/risiko-utama", label: "Risiko Utama", icon: Flame },
  { href: "/ram", label: "Risk Acceptance Matrix", icon: Grid3x3 },
  { href: "/cat", label: "Corporate Action Threshold", icon: Briefcase },
  { href: "/rekap", label: "Rekap Parameter", icon: Sigma },
  { href: "/executive-summary", label: "Executive Summary", icon: Presentation },
];

const CHALLENGE = [
  { href: "/kesiapan", label: "Cek Kesiapan", icon: ClipboardCheck },
  { href: "/challenge", label: "Log Challenge", icon: MessagesSquare },
  { href: "/keterkaitan", label: "Keterkaitan Risiko–RAM", icon: Workflow },
  { href: "/snapshot", label: "Snapshot Versi", icon: GitCompareArrows },
];

const GROUPS = Array.from(new Set(REKAP.map((r) => r.grup)));

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [paramOpen, setParamOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [catat, setCatat] = useState(false);
  const mode = useMode();
  const tabsRef = useRef<HTMLDivElement>(null);

  // Status sidebar (lebar/ciut) diingat per browser; Ctrl/Cmd + B untuk toggle.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = () => setCollapsed((v) => {
    try { localStorage.setItem("sidebar-collapsed", v ? "0" : "1"); } catch {}
    return !v;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleCollapsed(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    tabsRef.current?.querySelector("[data-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path]);

  const active = (href: string) => path === href || (href !== "/" && path.startsWith(href + "/"));

  const nav = (mini: boolean) => (
    <nav className="flex h-full flex-col">
      <Link href="/" className={clsx("block pt-5 pb-4", mini ? "px-2" : "px-3")} title="Dashboard">
        {mini ? (
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white p-1 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kinra-mark.png" alt="KINRA" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition hover:bg-white/5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kinra-mark.png" alt="KINRA" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[15px] font-bold tracking-wide text-white">KINRA <span className="font-medium text-brand-200/70">Sei Mangkei</span></div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-brand-200/70">Manajemen Risiko · RKAP 2027</div>
            </div>
          </div>
        )}
      </Link>
      <div className={clsx("scroll-thin flex-1 overflow-x-hidden overflow-y-auto pb-6", mini ? "space-y-3 px-2" : "space-y-6 px-3")}>
        <div>
          <NavItem href="/" label="Dashboard" icon={LayoutDashboard} active={path === "/"} mini={mini} />
          <NavItem href="/panduan" label="Panduan Penggunaan" icon={LifeBuoy} active={active("/panduan")} mini={mini} />
        </div>
        <div>
          <SectionLabel mini={mini}>Challenge Session</SectionLabel>
          {CHALLENGE.map((m) => <NavItem key={m.href} {...m} active={active(m.href)} mini={mini} />)}
        </div>
        <div>
          <SectionLabel mini={mini}>Kertas Kerja</SectionLabel>
          {MAIN.map((m) => <NavItem key={m.href} {...m} active={active(m.href)} mini={mini} />)}
        </div>
        {mini ? (
          <div>
            <SectionLabel mini>Lembar Parameter</SectionLabel>
            <NavItem href={path.startsWith("/parameter/") ? path : "/parameter/1a"} label="Lembar Parameter (1a–U10)" icon={Table2} active={path.startsWith("/parameter/")} mini />
          </div>
        ) : (
        <div>
          <button onClick={() => setParamOpen((v) => !v)} className="flex w-full items-center justify-between pr-2">
            <SectionLabel>Lembar Parameter</SectionLabel>
            <ChevronDown className={clsx("h-3.5 w-3.5 text-brand-200/60 transition", !paramOpen && "-rotate-90")} />
          </button>
          {paramOpen && GROUPS.map((g) => (
            <div key={g} className="mb-3">
              <div className="px-3 pb-1 text-[10.5px] font-semibold text-brand-200/50">{g.replace("Parameter ", "")}</div>
              <div className="grid grid-cols-4 gap-1 px-2">
                {REKAP.filter((r) => r.grup === g).map((r) => (
                  <Link key={r.kode} href={`/parameter/${r.kode}`} title={r.parameter}
                    className={clsx("rounded-md py-1.5 text-center text-[12px] font-semibold transition",
                      active(`/parameter/${r.kode}`) ? "bg-gold text-brand-900" : "bg-white/5 text-brand-100 hover:bg-white/15")}>
                    {r.kode}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        )}
        <div>
          <SectionLabel mini={mini}>Master Data</SectionLabel>
          <NavItem href="/taksonomi" label="Taksonomi PTPN Group" icon={Library} active={active("/taksonomi")} mini={mini} />
          <NavItem href="/setup" label="Inisialisasi Data" icon={Database} active={active("/setup")} mini={mini} />
        </div>
      </div>
      <button onClick={toggleCollapsed} title={mini ? "Perluas sidebar (Ctrl/⌘ + B)" : "Ciutkan sidebar (Ctrl/⌘ + B)"}
        className={clsx("hidden items-center gap-2 border-t border-white/10 py-3 text-[12px] font-medium text-brand-200/70 transition hover:bg-white/5 hover:text-white lg:flex",
          mini ? "justify-center" : "px-5")}>
        {mini ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />Ciutkan menu</>}
      </button>
      {!mini && (
        <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-brand-200/60 lg:hidden">
          Template Risk Management RKAP 2027 (v.2) PT DAM · RAS PTPN III (Persero)
        </div>
      )}
    </nav>
  );
  const w = collapsed ? "lg:w-[76px]" : "lg:w-[264px]";

  return (
    <div className="min-h-screen">
      <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden bg-brand-900 transition-[width] duration-200 lg:block print:!hidden", w)}>{nav(collapsed)}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-brand-900">{nav(false)}</aside>
        </div>
      )}
      <div className={clsx("transition-[padding] duration-200 print:!pl-0", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-20 flex h-14 items-center print:hidden gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 hover:bg-black/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button className="-ml-2 hidden rounded-lg p-2 text-slate-500 hover:bg-black/5 hover:text-ink lg:block" onClick={toggleCollapsed}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} title={collapsed ? "Perluas sidebar (Ctrl/⌘ + B)" : "Ciutkan sidebar (Ctrl/⌘ + B)"}>
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kinra-mark.png" alt="KINRA" className="h-7 w-7 shrink-0 object-contain lg:hidden" />
          <div className="min-w-0 truncate text-[13px] text-slate-500">
            <span className="font-semibold text-ink">Kertas Kerja Perencanaan Manajemen Risiko</span>
            <span className="mx-2 text-slate-300">/</span>RKAP 2027<span className="mx-2 text-slate-300">/</span>PT KINRA
          </div>
          <div className="ml-auto hidden items-center gap-3 text-[11px] text-slate-500 xl:flex">
            <Legend color="bg-cell-input ring-amber-300" label="Diisi entitas" />
            <Legend color="bg-cell-calc ring-sky-300" label="Terhitung otomatis" />
            <Legend color="bg-cell-label ring-slate-300" label="Contoh" />
          </div>
          <Link href="/panduan" title="Panduan Penggunaan" aria-label="Panduan Penggunaan"
            className="ml-auto shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-black/5 hover:text-brand-700 xl:ml-2">
            <HelpCircle className="h-5 w-5" />
          </Link>
          <button onClick={mode.toggle} disabled={mode.busy}
            title={mode.readonly ? "Mode presentasi aktif: semua data terkunci. Klik untuk membuka kunci." : "Kunci semua isian di semua layar selama presentasi"}
            className={clsx("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition",
              mode.readonly ? "bg-rose-600 text-white shadow-sm hover:bg-rose-700" : "border border-line bg-white text-slate-600 hover:border-brand-500 hover:text-brand-700")}>
            {mode.readonly ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Mode Presentasi</span>
            <span className={clsx("rounded px-1 text-[10px] font-bold", mode.readonly ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{mode.readonly ? "ON" : "OFF"}</span>
          </button>
        </header>
        {mode.readonly && (
          <div className="flex items-center gap-2 bg-rose-600 px-4 py-1.5 text-[12px] font-medium text-white md:px-8 print:hidden">
            <Lock className="h-3.5 w-3.5" />Mode presentasi aktif — seluruh data kertas kerja terkunci di semua layar. Masukan challenger tetap dapat dicatat.
          </div>
        )}
        <main className="px-4 pt-6 pb-24 md:px-8 print:!p-0">{children}</main>
        {/* Catat masukan challenger dari halaman mana pun */}
        <button onClick={() => setCatat(true)} title="Catat masukan challenger untuk halaman ini"
          className="fixed right-5 bottom-14 z-30 flex items-center gap-2 rounded-full bg-gold px-4 py-3 text-[13px] font-bold text-brand-900 shadow-lg ring-1 ring-black/10 transition hover:-translate-y-0.5 hover:shadow-xl print:hidden">
          <MessageSquarePlus className="h-4.5 w-4.5" /><span className="hidden md:inline">Catat Masukan</span>
        </button>
        {catat && <ChallengeModal initial={refFromPath(path)} onClose={() => setCatat(false)} onSaved={() => window.dispatchEvent(new Event("challenge-log-updated"))} />}
        {/* Tab lembar ala Excel */}
        <div className={clsx("fixed right-0 bottom-0 left-0 z-20 border-t border-line bg-[#e9e8e1] transition-[left] duration-200 print:hidden", collapsed ? "lg:left-[76px]" : "lg:left-[264px]")}>
          <div ref={tabsRef} className="scroll-thin flex overflow-x-auto px-2">
            <Link href="/" data-active={path === "/"} className={tabCls(path === "/")}>Dashboard</Link>
            {SHEETS.map((s) => (
              <Link key={s.href} href={s.href} data-active={active(s.href)} className={tabCls(active(s.href))}>{s.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const tabCls = (on: boolean) =>
  clsx("shrink-0 border-r border-[#d3d2c9] px-3.5 py-2 text-[12px] whitespace-nowrap transition",
    on ? "-mt-px border-t-2 border-t-brand-600 bg-white font-bold text-brand-700" : "text-slate-600 hover:bg-white/60");

function SectionLabel({ children, mini }: { children: React.ReactNode; mini?: boolean }) {
  if (mini) return <div className="mx-3 mb-2 border-t border-white/10" title={String(children)} />;
  return <div className="px-3 pb-2 text-[10.5px] font-bold tracking-[0.14em] text-brand-200/50 uppercase">{children}</div>;
}

function NavItem({ href, label, icon: Icon, active, mini }: { href: string; label: string; icon: React.ElementType; active: boolean; mini?: boolean }) {
  return (
    <Link href={href} title={mini ? label : undefined} aria-label={label} className={clsx("group mb-0.5 flex items-center gap-3 rounded-lg py-2 text-[13px] font-medium transition",
      mini ? "justify-center px-0" : "px-3",
      active ? "bg-white text-brand-900 shadow-sm" : "text-brand-100/85 hover:bg-white/10 hover:text-white")}>
      <Icon className={clsx("h-4 w-4 shrink-0", active ? "text-brand-600" : "text-brand-200/60 group-hover:text-brand-100")} />
      {!mini && <span className="truncate">{label}</span>}
    </Link>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={clsx("h-3 w-3 rounded-sm ring-1", color)} />{label}</span>;
}
