"use client";
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

/**
 * Panel dropdown yang dirender ke document.body (portal) dengan posisi fixed,
 * supaya tidak tertimpa sel/baris tabel lain yang membentuk stacking context sendiri.
 */
export function FloatingPanel({ anchor, panelRef, align = "left", width, maxHeight, className, children }: {
  anchor: RefObject<HTMLElement | null>; panelRef: RefObject<HTMLDivElement | null>;
  align?: "left" | "right"; width: number; maxHeight: number; className?: string; children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 4, margin = 8;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = align === "right" ? r.right - width : r.left;
      left = Math.max(margin, Math.min(left, vw - width - margin));
      const below = vh - r.bottom - gap - margin;
      const above = r.top - gap - margin;
      // Buka ke atas bila ruang di bawah sempit dan ruang di atas lebih lega.
      if (below < Math.min(maxHeight, 240) && above > below) {
        const h = Math.min(maxHeight, above);
        setPos({ bottom: vh - r.top + gap, left, maxH: h });
      } else {
        setPos({ top: r.bottom + gap, left, maxH: Math.min(maxHeight, below) });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, align, width, maxHeight]);

  if (!pos) return null;
  return createPortal(
    <div ref={panelRef} style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width, maxHeight: pos.maxH }}
      className={clsx("scroll-thin z-50 overflow-y-auto rounded-xl border border-line bg-white p-2 shadow-xl", className)}>
      {children}
    </div>,
    document.body,
  );
}
