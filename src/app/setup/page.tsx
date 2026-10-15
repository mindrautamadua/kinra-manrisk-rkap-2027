"use client";
import { useState } from "react";
import { Database, Play, RefreshCw } from "lucide-react";
import { Button, Card, SheetPage, useLoad } from "@/components/ui";
import { dbStatus } from "@/lib/data";
import { seedDatabase } from "@/lib/seed";

const LABEL: Record<string, string> = {
  kategori_risiko: "Kategori Risiko", taksonomi: "Taksonomi PTPN Group", kriteria_dampak: "Kriteria Dampak",
  risk_driver: "Risk Driver", ras: "RAS", risk_register: "Risk Register", parameter_sheet: "Lembar Parameter",
};

export default function SetupPage() {
  const status = useLoad(dbStatus);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setLog([]);
    try { await seedDatabase((m) => setLog((l) => [...l, m])); }
    catch (e) { setLog((l) => [...l, `✖ ${(e as Error).message}`]); }
    setBusy(false); status.reload();
  };

  return (
    <SheetPage title="Inisialisasi Data" code="Pengaturan">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-brand-600" />
            <h2 className="font-bold">Langkah awal</h2>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-slate-700">
            <li>Buka Supabase Dashboard › SQL Editor, jalankan isi file <code className="rounded bg-slate-100 px-1">supabase/migrations/0001_init.sql</code>.</li>
            <li>Isi <code className="rounded bg-slate-100 px-1">.env.local</code> dengan URL &amp; anon key project, lalu jalankan ulang aplikasi.</li>
            <li>Klik <b>Isi Data Awal</b>. Data diambil dari Kertas Kerja Bantu Excel &amp; Taksonomi Risiko PTPN Group. Hanya tabel yang masih kosong yang diisi, jadi aman diulang.</li>
          </ol>
          <div className="mt-5 flex gap-2">
            <Button onClick={run} disabled={busy}><Play className="h-4 w-4" />{busy ? "Memproses…" : "Isi Data Awal"}</Button>
            <Button variant="outline" onClick={status.reload}><RefreshCw className="h-4 w-4" />Cek Status</Button>
          </div>
          {log.length > 0 && (
            <pre className="scroll-thin mt-5 max-h-72 overflow-auto rounded-lg bg-brand-900 p-4 font-mono text-[11.5px] leading-relaxed text-brand-100">{log.join("\n")}</pre>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="font-bold">Status Tabel</h2>
          <table className="kk-table mt-4">
            <thead><tr><th>Tabel</th><th className="text-right">Jumlah Baris</th></tr></thead>
            <tbody>
              {status.error && <tr><td colSpan={2} className="text-rose-600">{status.error}</td></tr>}
              {Object.entries(status.data ?? {}).map(([k, v]) => (
                <tr key={k}><td>{LABEL[k] ?? k}</td><td className={typeof v === "number" ? "text-right tabnum" : "text-rose-600"}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </SheetPage>
  );
}
