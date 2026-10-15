"use client";
import { useState } from "react";
import { Card, DampakBadge, ErrorBox, Loading, Section, SheetPage, TableWrap, useLoad } from "@/components/ui";
import { RiskMatrix } from "@/components/RiskMatrix";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import type { RiskRegister } from "@/lib/types";

export default function RisikoUtamaPage() {
  const q = useLoad(async () => ({ register: await api.register(), kategori: await api.kategori() }));
  const [sel, setSel] = useState<RiskRegister | null>(null);
  const d = q.data;
  const utama = (d?.register ?? []).filter((r) => isTopRisk(r.kategori_dampak)).map((r, i) => ({ ...r, urutan: i + 1 }));

  return (
    <SheetPage title="Daftar Risiko Utama RKAP 2027 - PT KINRA" code="Risiko Utama" note={note("Risiko Utama")}>
      {q.loading ? <Loading variant="split" /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
            <Section letter="A" title="Jumlah Risiko per Kategori Risiko">
              <table className="kk-table">
                <thead><tr><th className="w-10">No</th><th>Kategori Risiko</th><th className="w-24 text-right">Risiko Korporat</th><th className="w-24 text-right">Risiko Utama</th></tr></thead>
                <tbody>
                  {d.kategori.map((k) => (
                    <tr key={k.no}>
                      <td className="text-center">{k.no}</td><td>{k.nama}</td>
                      <td className="calc text-right tabnum">{d.register.filter((r) => r.kategori === k.nama).length}</td>
                      <td className="calc text-right font-bold tabnum">{utama.filter((r) => r.kategori === k.nama).length}</td>
                    </tr>
                  ))}
                  <tr><td /><td className="font-bold">Total</td><td className="calc text-right font-bold">{d.register.length}</td><td className="calc text-right font-bold">{utama.length}</td></tr>
                </tbody>
              </table>
            </Section>
            <Section title="Peta Risiko Utama (indikatif)">
              <Card className="p-5">
                <RiskMatrix rows={utama} onSelect={setSel} />
                {sel && <div className="mt-4 rounded-lg bg-paper p-3 text-[12.5px]"><b>{sel.urutan}. {sel.risk_event}</b> — {sel.kategori} · Prob. {persen(sel.probabilitas, 0)} · {sel.kategori_dampak}</div>}
              </Card>
            </Section>
          </div>
          <Section letter="B" title="Daftar Risiko Utama">
            <TableWrap>
              <table className="kk-table min-w-[1300px]">
                <thead><tr><th className="w-10">No</th><th className="w-40">Taksonomi Risiko</th><th className="w-56">Risk Event</th><th>Deskripsi Risk Event</th>
                  <th className="w-24 text-right">Probabilitas Kejadian</th><th className="w-40 text-right">Nilai Dampak Risiko (Rp)</th><th className="w-32">Kategori Dampak Risiko</th><th className="w-72">Rencana Mitigasi</th></tr></thead>
                <tbody>
                  {utama.map((r) => (
                    <tr key={r.id}>
                      <td className="calc text-center font-bold">{r.urutan}</td><td className="calc">{r.kategori}</td><td className="calc font-semibold">{r.risk_event}</td>
                      <td className="calc text-[12px] text-slate-700">{r.deskripsi}</td><td className="calc text-right tabnum">{persen(r.probabilitas, 0)}</td>
                      <td className="calc text-right tabnum">{rupiah(r.nilai_dampak).replace("Rp ", "")}</td><td className="calc"><DampakBadge k={r.kategori_dampak} /></td>
                      <td className="calc whitespace-pre-line">{r.rencana_mitigasi}</td>
                    </tr>
                  ))}
                  {utama.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-slate-400">Belum ada risiko dengan kategori dampak Moderat ke atas.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </>
      )}
    </SheetPage>
  );
}
