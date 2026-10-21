"use client";
import { memo, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { colName, expandRange, formatCell, isInputCell, parseAddr, parseInput, type Workbook } from "@/lib/engine";
import { statusBiner } from "@/lib/format";
import type { CellValue, SheetTemplate, TemplateCell } from "@/lib/types";

const px = (w: number) => Math.round(w * 7 + 6);

/** Warna template Excel dipetakan ke palet aplikasi (merah kepala tabel -> hijau korporat). */
const BG_MAP: Record<string, string> = { C00000: "123F29", F2F2F2: "F1F1EE", FFFFCC: "FFFBD6", DDEBF7: "E4EEF9" };
const FC_MAP: Record<string, string> = { C00000: "175636" };

/** Status kertas kerja diberi warna seperti conditional formatting Excel. */
const STATUS_CELL: Record<string, string> = {
  Hijau: "!bg-emerald-500 !text-white", Merah: "!bg-rose-600 !text-white",
  "On-track": "!text-emerald-700 font-semibold", "Off-track": "!text-rose-700 font-semibold",
};

export interface GridLayout {
  spans: Map<string, { rs: number; cs: number }>;
  covered: Set<string>;
  lists: Map<string, string[]>;
  sections: { letter: string; title: string; row: number }[];
  maxCol: number;
}

export function buildLayout(t: SheetTemplate): GridLayout {
  const spans = new Map<string, { rs: number; cs: number }>();
  const covered = new Set<string>();
  let maxCol = t.maxCol;
  for (const m of t.merges) {
    const [a, b] = m.split(":");
    const p = parseAddr(a), q = parseAddr(b);
    if (p.row > t.maxRow) continue;
    maxCol = Math.max(maxCol, q.col);
    spans.set(a, { rs: q.row - p.row + 1, cs: q.col - p.col + 1 });
    for (let r = p.row; r <= q.row; r++) for (let c = p.col; c <= q.col; c++) if (r !== p.row || c !== p.col) covered.add(colName(c) + r);
  }
  const lists = new Map<string, string[]>();
  for (const v of t.validations) {
    const m = v.list.match(/^"(.*)"$/);
    if (!m) continue;
    const opts = m[1].split(",");
    for (const a of expandRange(v.sqref)) lists.set(a, opts);
  }
  const sections: GridLayout["sections"] = [];
  for (let r = 1; r <= t.maxRow; r++) {
    const a = t.cells[`A${r}`]?.v;
    if (typeof a === "string" && /^[A-F]$/.test(a)) sections.push({ letter: a, title: String(t.cells[`B${r}`]?.v ?? ""), row: r });
  }
  return { spans, covered, lists, sections, maxCol };
}

export const SheetGrid = memo(function SheetGrid({ t, layout, wb, version, onEdit, showHeaders = true, readonly = false }: {
  t: SheetTemplate; layout: GridLayout; wb: Workbook; version: number;
  onEdit: (addr: string, v: CellValue) => void; showHeaders?: boolean; readonly?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const cols = useMemo(() => Array.from({ length: layout.maxCol }, (_, i) => colName(i + 1)), [layout.maxCol]);

  const start = (addr: string, c: TemplateCell) => {
    const v = wb.get(t.code, addr);
    let s = "";
    if (typeof v === "number") s = c.nf && /[dy]/i.test(c.nf.replace(/"[^"]*"/g, "")) && !/0/.test(c.nf) ? formatCell(v, c.nf) : String(v).replace(".", ",");
    else if (v != null) s = String(v);
    setDraft(s); setEditing(addr);
  };
  const commit = (addr: string, c: TemplateCell, raw?: string) => {
    setEditing(null);
    const val = parseInput(raw ?? draft, c.nf);
    const cur = wb.get(t.code, addr);
    if ((cur ?? null) !== val && !(cur === "" && val === null)) onEdit(addr, val);
  };

  const rows = [];
  for (let r = 1; r <= t.maxRow; r++) {
    const tds = [];
    if (showHeaders) tds.push(<td key="h" className="xl-rowhead sticky left-0 z-[1] w-9 border-r border-[#d6d8d0]">{r}</td>);
    for (const col of cols) {
      const addr = col + r;
      if (layout.covered.has(addr)) continue;
      const c = t.cells[addr];
      const span = layout.spans.get(addr);
      const isInp = isInputCell(c);
      const inp = isInp && !readonly;
      const list = layout.lists.get(addr);
      void version; // nilai diambil ulang setiap kali workbook berubah
      const raw = c ? (c.f || isInp ? wb.get(t.code, addr) : c.v ?? null) : null;
      const v = c?.f ? statusBiner(raw) : raw; // rumus asli masih bisa menghasilkan Kuning/Oranye
      const text = formatCell(v as CellValue, c?.nf);
      const isEditing = editing === addr;
      const style: React.CSSProperties = {};
      if (c?.bg) style.background = `#${BG_MAP[c.bg] ?? c.bg}`;
      if (c?.fc) style.color = `#${(c.bg === "C00000" ? null : FC_MAP[c.fc]) ?? c.fc}`;
      if (c?.sz && c.sz > 10) style.fontSize = `${c.sz + 2}px`;
      const align = c?.ha === "center" || c?.ha === "centerContinuous" ? "center" : c?.ha === "right" ? "right" : c?.ha === "left" ? "left" : typeof v === "number" ? "right" : undefined;
      if (align) style.textAlign = align;
      const status = typeof v === "string" ? STATUS_CELL[v] : undefined;

      tds.push(
        <td key={addr} rowSpan={span?.rs} colSpan={span?.cs} style={style}
          title={inp ? `${addr} · diisi entitas` : c?.f ? `${addr} · ${c.f}` : undefined}
          onClick={inp && !isEditing ? () => start(addr, c!) : undefined}
          className={clsx(c?.bd && "bd", c?.b && "font-bold", c?.i && "italic", inp && "inp", isEditing && "sel", status,
            c?.w ? "whitespace-pre-wrap break-words" : "whitespace-nowrap", !c?.w && !c?.bg && !isEditing && "ov", typeof v === "number" && "tabnum")}>
          {isEditing ? (
            list ? (
              <select autoFocus defaultValue={String(v ?? "")} onBlur={() => setEditing(null)}
                onChange={(e) => commit(addr, c!, e.target.value)} className="w-full bg-white text-[12px] outline-none">
                <option value="">—</option>{list.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (c?.w && String(draft).length > 40) || (span && span.cs > 3) ? (
              <textarea ref={(el) => { inputRef.current = el; }} autoFocus value={draft} rows={Math.max(2, Math.ceil(draft.length / 80))}
                onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(addr, c!)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit(addr, c!); }}
                className="w-full resize-y bg-white text-[12px] outline-none" />
            ) : (
              <input ref={(el) => { inputRef.current = el; }} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(addr, c!)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(addr, c!); } }}
                className="w-full bg-white text-[12px] outline-none" style={{ textAlign: align }} />
            )
          ) : text}
        </td>,
      );
    }
    rows.push(<tr key={r} id={`r${r}`}>{tds}</tr>);
  }

  return (
    <table className="xl-grid bg-white" style={{ width: (showHeaders ? 36 : 0) + cols.reduce((a, c) => a + px(t.widths[c] ?? 13), 0) }}>
      <colgroup>
        {showHeaders && <col style={{ width: 36 }} />}
        {cols.map((c) => <col key={c} style={{ width: px(t.widths[c] ?? 13) }} />)}
      </colgroup>
      {showHeaders && (
        <thead>
          <tr>
            <th className="xl-colhead sticky top-0 left-0 z-[3] border-r border-b border-[#d6d8d0]" />
            {cols.map((c) => <th key={c} className="xl-colhead sticky top-0 z-[2] border-r border-b border-[#d6d8d0] py-0.5 font-medium">{c}</th>)}
          </tr>
        </thead>
      )}
      <tbody>{rows}</tbody>
    </table>
  );
});

