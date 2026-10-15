"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, Info, Loader2 } from "lucide-react";
import { supabaseConfigured } from "@/lib/supabase";
import { DAMPAK_STYLE, polaritas, SIKAP_STYLE, statusStyle } from "@/lib/format";
import { useReadonly } from "@/lib/mode";

// ---------- data loading ----------
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try { setData(await fn()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, setData, error, loading, reload: run };
}

/** Menjalankan aksi simpan dan menampilkan indikator status. */
export function useSaver() {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setState("saving");
    try {
      await fn(); setState("saved");
      clearTimeout(timer.current); timer.current = setTimeout(() => setState("idle"), 1800);
    } catch (e) { setState("error"); setMsg((e as Error).message); }
  }, []);
  const indicator = (
    <span className={clsx("inline-flex items-center gap-1.5 text-[12px] transition", state === "idle" && "opacity-0")}>
      {state === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyimpan…</>}
      {state === "saved" && <><Check className="h-3.5 w-3.5 text-brand-600" />Tersimpan</>}
      {state === "error" && <span className="text-rose-600" title={msg}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />Gagal: {msg.slice(0, 60)}</span>}
    </span>
  );
  return { run, indicator, state };
}

// ---------- layout ----------
export function SheetPage({ code, title, note, actions, children, wide, offline }: {
  code?: string; title: string; note?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean; offline?: boolean;
}) {
  return (
    <div className={clsx("rise mx-auto", wide ? "max-w-none" : "max-w-[1400px]")}>
      <div className="mb-5 flex flex-wrap items-end gap-4 print:hidden">
        <div className="min-w-0 flex-1">
          {code && <div className="mb-1 text-[11px] font-bold tracking-[0.16em] text-brand-600 uppercase">{code}</div>}
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[26px]">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {note && <Note>{note}</Note>}
      {!supabaseConfigured && !offline ? <NotConfigured /> : children}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6 rounded-xl border border-amber-200/70 bg-amber-50/60 text-[12.5px] text-amber-950/85">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-semibold">
        <Info className="h-4 w-4 text-amber-600" /> Catatan
        <ChevronDown className={clsx("ml-auto h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-amber-200/70 px-4 py-3 leading-relaxed whitespace-pre-line">{children}</div>}
    </div>
  );
}

export function Section({ letter, title, right, children, className }: {
  letter?: string; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={clsx("mb-8", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {letter && <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-800 text-[12px] font-bold text-white">{letter}</span>}
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("glass rounded-2xl", className)}>{children}</div>;
}

export function TableWrap({ children, maxH }: { children: React.ReactNode; maxH?: string }) {
  return <div className={clsx("scroll-thin overflow-auto rounded-lg", maxH)} style={{ maxHeight: maxH ? undefined : "none" }}>{children}</div>;
}

// ---------- skeleton (placeholder saat memuat) ----------
export type SkeletonVariant = "table" | "stats-table" | "dashboard" | "split" | "list" | "form" | "sheet" | "deck";

/** Placeholder berbentuk layout halaman selama data dimuat. */
export function Loading({ label = "Memuat data…", variant = "table" }: { label?: string; variant?: SkeletonVariant }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {variant === "table" && <SkeletonTable />}
      {variant === "stats-table" && <><SkeletonStats /><SkeletonSection><SkeletonTable /></SkeletonSection></>}
      {variant === "dashboard" && <SkeletonDashboard />}
      {variant === "split" && <SkeletonSplit />}
      {variant === "list" && <SkeletonList />}
      {variant === "form" && <SkeletonForm />}
      {variant === "sheet" && <SkeletonSheet />}
      {variant === "deck" && <SkeletonDeck />}
      <div className="mt-4 flex items-center gap-2 text-[12px] text-slate-500"><Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />{label}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("rounded-md bg-slate-200/70 motion-safe:animate-pulse", className)} />;
}

/** Lebar baris bervariasi tetapi deterministik agar tidak berubah setiap render. */
const W = ["w-11/12", "w-3/4", "w-full", "w-2/3", "w-5/6", "w-1/2"];

export function SkeletonStats({ n = 4 }: { n?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <Card key={i} className="relative overflow-hidden p-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-slate-200" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}

function SkeletonSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <Skeleton className="h-7 w-7" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="ml-auto h-8 w-52 rounded-lg" />
      </div>
      {children}
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="grid gap-4 bg-brand-800 px-3 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, c) => <div key={c} className="h-3 w-2/3 rounded bg-white/20 motion-safe:animate-pulse" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-4 border-t border-line px-3 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className={clsx("h-3", W[(r + c) % W.length])} />)}
        </div>
      ))}
    </div>
  );
}

function SkeletonCardBlock({ className, lines = 5 }: { className?: string; lines?: number }) {
  return (
    <Card className={clsx("p-5", className)}>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={clsx("h-3", W[i % W.length])} />)}
      </div>
    </Card>
  );
}

function SkeletonMatrix() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-5 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 25 }, (_, i) => <Skeleton key={i} className="aspect-square rounded" />)}
      </div>
    </Card>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="relative overflow-hidden p-5">
            <div className="absolute inset-y-0 left-0 w-1 bg-slate-200" />
            <Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-20" /><Skeleton className="mt-3 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <SkeletonCardBlock lines={7} />
        <SkeletonMatrix />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonCardBlock lines={6} />
        <SkeletonCardBlock lines={6} />
      </div>
    </div>
  );
}

function SkeletonSplit() {
  return (
    <>
      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <SkeletonTable rows={8} cols={3} />
        <SkeletonMatrix />
      </div>
      <SkeletonSection><SkeletonTable rows={6} cols={7} /></SkeletonSection>
    </>
  );
}

function SkeletonList() {
  return (
    <>
      <SkeletonStats />
      <Skeleton className="mb-4 h-10 w-full rounded-lg" />
      <div className="space-y-6">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="bg-brand-800 px-5 py-3.5">
              <div className="h-4 w-48 rounded bg-white/25 motion-safe:animate-pulse" />
              <div className="mt-2 h-3 w-3/4 rounded bg-white/15 motion-safe:animate-pulse" />
            </div>
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex items-center gap-3 border-t border-line px-5 py-3">
                <Skeleton className="h-3 w-16" /><Skeleton className={clsx("h-3", W[(i + j) % W.length])} />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}

function SkeletonForm() {
  return (
    <Card className="mx-auto max-w-4xl overflow-hidden">
      <div className="bg-brand-800 px-8 py-8">
        <div className="h-3 w-32 rounded bg-white/20 motion-safe:animate-pulse" />
        <div className="mt-3 h-6 w-2/3 rounded bg-white/25 motion-safe:animate-pulse" />
      </div>
      <div className="divide-y divide-line px-8 py-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="grid grid-cols-[200px_1fr] items-center gap-4 py-4">
            <Skeleton className="h-3 w-32" /><Skeleton className={clsx("h-4", W[i % W.length])} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkeletonSheet() {
  return (
    <>
      <div className="mb-5 grid gap-3 lg:grid-cols-[1.3fr_repeat(3,minmax(0,0.6fr))_1fr]">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-6 w-20" /></Card>
        ))}
      </div>
      <Card className="overflow-hidden p-3">
        <div className="grid grid-cols-[32px_repeat(10,minmax(0,1fr))] gap-px bg-line">
          {Array.from({ length: 11 * 14 }, (_, i) => {
            const r = Math.floor(i / 11), c = i % 11;
            const head = r === 0 || c === 0;
            return <div key={i} className={clsx("h-6", head ? "bg-[#eceee8]" : (r * 7 + c) % 5 === 0 ? "bg-cell-input" : "bg-white")}>
              {!head && (r + c) % 3 !== 0 && <Skeleton className="m-1.5 h-3" />}
            </div>;
          })}
        </div>
      </Card>
    </>
  );
}

function SkeletonDeck() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }, (_, i) => (
        <Card key={i} className="mx-auto aspect-video w-full max-w-5xl overflow-hidden">
          <div className="flex h-full flex-col p-8">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
            <div className="mt-8 grid flex-1 grid-cols-[1fr_300px] gap-6">
              <div className="space-y-3">{Array.from({ length: 8 }, (_, j) => <Skeleton key={j} className={clsx("h-3", W[(i + j) % W.length])} />)}</div>
              <Skeleton className="h-full rounded-xl" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Error karena tabel/kolom dari migrasi 0002 belum ada di database. */
export const butuhMigrasi2 = (e?: string | null) => !!e && /challenge_log|snapshot|parameter_ram|schema cache/i.test(e);

export function ErrorBox({ error }: { error: string }) {
  if (butuhMigrasi2(error)) return <Migrasi2 />;
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <div className="font-semibold">Gagal memuat data</div>
      <div className="mt-1 text-[13px]">{error}</div>
      <div className="mt-2 text-[12px]">Pastikan migrasi SQL sudah dijalankan dan data sudah diinisialisasi di <Link className="font-semibold underline" href="/setup">Inisialisasi Data</Link>.</div>
    </div>
  );
}

export function Migrasi2() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <div className="font-bold">Fitur challenge session butuh migrasi database</div>
      <p className="mt-1 text-[13px]">Jalankan isi file <code className="rounded bg-white px-1">supabase/migrations/0002_challenge_session.sql</code> di Supabase Dashboard › SQL Editor, lalu muat ulang halaman ini.</p>
    </div>
  );
}

export function NotConfigured() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-950">
      <div className="text-base font-bold">Supabase belum dikonfigurasi</div>
      <p className="mt-2">Isi <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> pada file <code className="rounded bg-white px-1">.env.local</code>, lalu jalankan ulang <code className="rounded bg-white px-1">npm run dev</code>.</p>
    </div>
  );
}

/** `edit`: tombol yang mengubah data, disembunyikan saat mode presentasi aktif. */
export function Button({ children, onClick, variant = "primary", disabled, className, type = "button", edit, title }: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "outline"; disabled?: boolean; className?: string; type?: "button" | "submit"; edit?: boolean; title?: string;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} data-edit={edit || undefined} title={title} className={clsx(
      "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition disabled:opacity-50",
      variant === "primary" && "bg-brand-700 text-white shadow-sm hover:bg-brand-800",
      variant === "outline" && "border border-line bg-white text-ink hover:border-brand-500 hover:text-brand-700",
      variant === "ghost" && "text-slate-600 hover:bg-black/5",
      variant === "danger" && "text-rose-600 hover:bg-rose-50",
      className)}>
      {children}
    </button>
  );
}

// ---------- badges ----------
export function StatusBadge({ status, size = "md" }: { status?: string | null; size?: "sm" | "md" }) {
  const s = statusStyle(status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset", s.chip,
      size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]")}>
      <span className={clsx("h-2 w-2 rounded-full", s.dot)} />{s.label}
    </span>
  );
}
/** Penanda polaritas parameter: makin tinggi makin baik (maximize) atau makin rendah makin baik (minimize). */
export function ArahBadge({ arah, className }: { arah?: string | null; className?: string }) {
  const p = polaritas(arah);
  const Ikon = p.naik ? ArrowUp : ArrowDown;
  return (
    <span title={`${p.label}. ${p.detail}.`} className={clsx("inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-slate-600", className)}>
      <Ikon className="h-3 w-3" />{p.label}
    </span>
  );
}
export function SikapBadge({ sikap }: { sikap?: string | null }) {
  if (!sikap) return <span className="text-slate-400">–</span>;
  return <span className={clsx("inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", SIKAP_STYLE[sikap] ?? "bg-slate-100")}>{sikap}</span>;
}
export function DampakBadge({ k }: { k?: string | null }) {
  if (!k) return <span className="text-slate-400">–</span>;
  return <span className={clsx("inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", DAMPAK_STYLE[k] ?? "bg-slate-100")}>{k}</span>;
}

// ---------- sel yang dapat diedit ----------
type EditProps = {
  value: string | number | null | undefined;
  onSave: (v: string | number | null) => void | Promise<void>;
  kind?: "text" | "number" | "percent";
  placeholder?: string;
  className?: string;
  display?: (v: string | number | null | undefined) => React.ReactNode;
};

/** Teks/angka yang langsung tersimpan saat fokus keluar (blur), seperti sel kuning di Excel. */
export function EditCell({ value, onSave, kind = "text", placeholder = "Isi…", className, display }: EditProps) {
  const ro = useReadonly();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const toDraft = (v: EditProps["value"]) => {
    if (v == null) return "";
    if (kind === "percent" && typeof v === "number") return String(+(v * 100).toFixed(6)).replace(".", ",");
    if (typeof v === "number") return String(v).replace(".", ",");
    return v;
  };
  useLayoutEffect(() => {
    if (editing && ref.current) { ref.current.style.height = "0"; ref.current.style.height = ref.current.scrollHeight + "px"; }
  }, [editing, draft]);

  const commit = () => {
    setEditing(false);
    let v: string | number | null = draft.trim() === "" ? null : draft;
    if (v != null && kind !== "text") {
      const n = Number(String(v).replace(/\s|Rp|%/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      v = isNaN(n) ? null : kind === "percent" ? n / 100 : n;
    }
    if (v !== (value ?? null)) onSave(v);
  };

  if (editing) {
    return (
      <textarea ref={ref} autoFocus value={draft} rows={1}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (kind !== "text" || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
        }}
        className={clsx("block w-full resize-none rounded-md border border-brand-500 bg-white px-1.5 py-1 text-[12.5px] leading-snug outline-none ring-2 ring-brand-500/20", kind !== "text" && "text-right tabnum", className)} />
    );
  }
  const empty = value == null || value === "";
  if (ro) {
    return (
      <div className={clsx("min-h-[22px] px-0.5 whitespace-pre-line", kind !== "text" && "text-right tabnum", className)}>
        {empty ? <span className="text-slate-300">–</span> : display ? display(value) : String(value)}
      </div>
    );
  }
  return (
    <div role="button" tabIndex={0} onClick={() => { setDraft(toDraft(value)); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === "Enter") { setDraft(toDraft(value)); setEditing(true); } }}
      className={clsx("min-h-[22px] cursor-text rounded px-0.5 whitespace-pre-line hover:ring-1 hover:ring-brand-500/40", kind !== "text" && "text-right tabnum", className)}>
      {empty ? <span className="text-slate-400/80 italic">{placeholder}</span> : display ? display(value) : String(value)}
    </div>
  );
}

export function SelectCell({ value, options, onSave, placeholder = "Pilih…", className }: {
  value: string | null | undefined; options: readonly (string | { value: string; label: string })[];
  onSave: (v: string | null) => void; placeholder?: string; className?: string;
}) {
  const ro = useReadonly();
  if (ro) {
    const label = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)).find((o) => o.value === value)?.label ?? value;
    return <div className={clsx("py-0.5 text-[12.5px]", className)}>{label || <span className="text-slate-300">–</span>}</div>;
  }
  return (
    <select value={value ?? ""} onChange={(e) => onSave(e.target.value || null)}
      className={clsx("w-full cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 text-[12.5px] hover:border-brand-500/40 focus:border-brand-500 focus:outline-none", !value && "text-slate-400 italic", className)}>
      <option value="">{placeholder}</option>
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Ikon info kecil (mis. di header tabel) yang menampilkan penjelasan saat disorot, diklik, atau difokus.
 * Popover dirender ke body dengan posisi tetap agar tidak terpotong oleh tabel yang dapat digulir. */
export function InfoHint({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, left: Math.min(Math.max(12, r.left + r.width / 2 - 150), window.innerWidth - 312) });
  };
  const hide = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos]);
  return (
    <>
      <button ref={ref} type="button" aria-label={title ? `Info ${title}` : "Info"} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={(e) => { e.stopPropagation(); if (pos) hide(); else show(); }}
        className={clsx("inline-flex align-middle rounded-full opacity-70 transition hover:opacity-100 focus:opacity-100 focus:outline-none", className)}>
        <Info className="h-3.5 w-3.5" />
      </button>
      {pos && createPortal(
        <div role="tooltip" style={{ top: pos.top, left: pos.left }}
          className="pointer-events-none fixed z-[100] w-[300px] rounded-xl border border-line bg-white p-3 text-left text-[12px] leading-relaxed font-normal tracking-normal normal-case text-slate-700 shadow-xl">
          {title && <div className="mb-1 text-[12.5px] font-bold text-ink">{title}</div>}
          {children}
        </div>, document.body)}
    </>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <Card className="relative overflow-hidden p-5">
      {accent && <div className={clsx("absolute inset-y-0 left-0 w-1", accent)} />}
      <div className="text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-2 text-[28px] leading-none font-extrabold tracking-tight text-ink tabnum">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-slate-500">{sub}</div>}
    </Card>
  );
}
