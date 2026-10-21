"use client";
import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import { Button, Card, EditCell, ErrorBox, Loading, SelectCell, SheetPage, useLoad, useSaver } from "@/components/ui";
import { api } from "@/lib/data";
import { isTopRisk, rupiah } from "@/lib/format";
import { buildRam } from "@/lib/ram";
import { PILAR_GRCS, type Milestone, type ProgramStrategis } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

type Field = { key: keyof ProgramStrategis; label: string; kind?: "number"; hint?: string; span?: 2 };

/** Urutan blok mengikuti kartu 7.4 pada PPT Executive Summary. */
const BLOK: Field[][] = [
  [{ key: "inisiatif_rjpp", label: "Inisiatif Strategi RJPP" }, { key: "objective_scorecard", label: "Objective Scorecard" }, { key: "program_kerja", label: "Program Kerja", span: 2 }],
  [{ key: "pemimpin", label: "Pemimpin Program" }, { key: "pemilik", label: "Pemilik Program" }, { key: "bulan_mulai", label: "Bulan Mulai", hint: "Januari 2027" }, { key: "bulan_selesai", label: "Bulan Selesai", hint: "Desember 2027" }],
  [{ key: "deskripsi", label: "Deskripsi Program" }, { key: "tujuan_kualitatif", label: "Tujuan & Hasil Kerja – Kualitatif", hint: "Satu poin per baris" },
    { key: "tujuan_kuantitatif", label: "Tujuan & Hasil Kerja – Kuantitatif", hint: "Satu poin per baris" }, { key: "target", label: "Target Program" }],
  [{ key: "opex", label: "Anggaran OPEX (Rp)", kind: "number" }, { key: "capex", label: "Anggaran CAPEX (Rp)", kind: "number" },
    { key: "risiko_implementasi", label: "Risiko Implementasi", hint: "Satu poin per baris" }, { key: "mitigasi", label: "Mitigasi Risiko", hint: "Satu poin per baris" }],
];

/** Kolom teks yang dibantu AI; anggaran OPEX/CAPEX tetap diisi pengguna. Milestone dipertukarkan dengan AI sebagai teks satu baris per milestone. */
const AI_FIELDS = [{ key: "nama", label: "Nama Program atau Inisiatif Strategis" },
  ...BLOK.flat().filter((f) => !f.kind).map((f) => ({ key: f.key, label: f.label })),
  { key: "milestone", label: "Milestone 2027 (satu per baris: \"Bulan 2027 – capaian\")" }];

const BULAN_2027 = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((b) => `${b} 2027`);
const milestoneKeTeks = (m?: Milestone[] | null) => (m ?? []).map((x) => `${x.bulan} – ${x.uraian}`).join("\n");
/** "Maret 2027 – Uraian" per baris → daftar milestone; baris tanpa bulan dikenali disimpan dengan bulan kosong. */
const teksKeMilestone = (t: string): Milestone[] => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const m = l.match(/^([A-Za-z]+\s+20\d\d)\s*[–:-]\s*(.+)$/);
  const bulan = m ? BULAN_2027.find((b) => b.toLowerCase() === m[1].toLowerCase()) ?? m[1] : "";
  return { bulan, uraian: m ? m[2].trim() : l.replace(/^[-•\d.)\s]+/, "") };
});
const CONTOH = {
  pilar: "Risk Management", nama: "Pengembangan Pemodelan Risiko Berbasis Statistik",
  inisiatif_rjpp: "Penguatan Implementasi Enterprise Risk Management (Go Secure)", objective_scorecard: "Ketersediaan Model Risiko atas Taksonomi Risiko DAM",
  program_kerja: "Pengembangan Model Risiko Berbasis Statistik", pemimpin: "Divisi Manajemen Risiko", pemilik: "PT Perkebunan Nusantara III (Persero)",
  bulan_mulai: "Januari 2027", bulan_selesai: "Desember 2027",
  deskripsi: "Program ini dilaksanakan untuk mendukung kuantifikasi risiko dengan mempertimbangkan data historis berbasis statistik.",
  tujuan_kualitatif: "Peningkatan mutu penilaian risiko dengan metode kuantitatif.\nMeningkatkan kompetensi Lini 2 dalam membangun model risiko.",
  tujuan_kuantitatif: "100% tersedia 8 model risiko sesuai taksonomi Risiko Danantara.", target: "8 model risiko sesuai taksonomi DAM.",
  risiko_implementasi: "Pengetahuan mengenai model risiko masih relatif kurang.\nData historis kurang memadai.",
  mitigasi: "Meningkatkan pemahaman mengenai risk modeling dengan pelatihan dan FGD.\nBekerja sama dengan divisi terkait dan pihak ketiga untuk mengumpulkan data historis.",
};

/** Risiko utama dan parameter RAM yang perlu dikendalikan, sebagai dasar usulan program. */
async function muatKonteks() {
  const [register, params, ras, pengendalian, tambahan] = await Promise.all([api.register(), api.params(), api.ras(), api.pengendalian(), api.ramTambahan()]);
  return {
    risiko_utama: register.filter((r) => r.risk_event && isTopRisk(r.kategori_dampak))
      .map((r) => ({ kategori: r.kategori, risk_event: r.risk_event, kategori_dampak: r.kategori_dampak, rencana_mitigasi: r.rencana_mitigasi })),
    ram_perlu_pengendalian: buildRam(params, ras, pengendalian, tambahan).filter((r) => r.diterapkan && ["Kuning", "Oranye", "Merah"].includes(r.status))
      .map((r) => ({ kode: r.kode, parameter: r.parameter, kategori: r.kategori, status: r.status, inisiatif: r.pengendalian?.inisiatif, program: r.pengendalian?.program })),
  };
}

const butuhMigrasi = (e: string) => /program_strategis|schema cache|tidak diizinkan/i.test(e);

export default function ProgramStrategisPage() {
  const q = useLoad(api.program);
  const saver = useSaver();
  const rows = q.data ?? [];
  const patch = (id: string, p: Partial<ProgramStrategis>) => {
    q.setData(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
    saver.run(() => api.update<ProgramStrategis>("program_strategis", "id", id, { ...p, updated_at: new Date().toISOString() } as Partial<ProgramStrategis>));
  };
  const add = (pilar: string) => saver.run(async () => {
    const row = await api.insert<ProgramStrategis>("program_strategis", { pilar, urutan: rows.length + 1 });
    q.setData([...rows, row]);
  });
  // ai: null = tertutup, "baru:<pilar>" = program baru, selain itu id program yang dibantu.
  const [ai, setAi] = useState<string | null>(null);
  const [konteks, setKonteks] = useState<Awaited<ReturnType<typeof muatKonteks>> | null>(null);
  const bukaAi = (target: string) => {
    setAi(target);
    if (!konteks) muatKonteks().then(setKonteks).catch(() => setKonteks({ risiko_utama: [], ram_perlu_pengendalian: [] }));
  };
  const aiRow = rows.find((r) => r.id === ai);
  const aiPilar = aiRow?.pilar ?? ai?.replace(/^baru:/, "") ?? "Risk Management";
  const applyAi = async (raw: Record<string, string>) => {
    const { milestone, ...rest } = raw;
    const p: Partial<ProgramStrategis> = { ...rest, ...(milestone != null ? { milestone: teksKeMilestone(milestone) } : {}) };
    if (aiRow) { patch(aiRow.id, p); return; }
    const row = await api.insert<ProgramStrategis>("program_strategis", { pilar: aiPilar, urutan: rows.length + 1, ...p });
    q.setData([...rows, row]);
  };
  const del = async (r: ProgramStrategis) => {
    if (!(await konfirmasi({ judul: "Hapus program strategis?", objek: r.nama || "(tanpa nama)" }))) return;
    q.setData(rows.filter((x) => x.id !== r.id));
    saver.run(() => api.remove("program_strategis", "id", r.id));
  };

  return (
    <SheetPage title="Program atau Inisiatif Strategis GRCS RKAP 2027" code="7.4 Program Strategis"
      note="Satu kartu = satu slide 7.4 pada Executive Summary. Isi minimal satu program per pilar GRCS (Governance, Risk Management, Compliance, Sustainability)."
      actions={<>{saver.indicator}<Button edit variant="outline" onClick={() => bukaAi("baru:Risk Management")}><Sparkles className="h-4 w-4" />Isi dengan AI</Button><Button edit onClick={() => add("Risk Management")}><Plus className="h-4 w-4" />Tambah Program</Button></>}>
      {q.loading ? <Loading /> : q.error ? (
        butuhMigrasi(q.error)
          ? <ErrorBox error="Tabel program_strategis belum ada. Jalankan supabase/migrations/0004_program_strategis.sql di SQL Editor Supabase, lalu muat ulang halaman." />
          : <ErrorBox error={q.error} />
      ) : (
        <div className="space-y-8">
          {PILAR_GRCS.map((pilar) => {
            const list = rows.filter((r) => r.pilar === pilar);
            return (
              <section key={pilar}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-[15px] font-bold text-ink">{pilar}</h2>
                  <span className="text-[12px] text-slate-500">{list.length} program</span>
                  <Button edit variant="ghost" className="ml-auto" onClick={() => bukaAi(`baru:${pilar}`)}><Sparkles className="h-4 w-4" />Usulkan dengan AI</Button>
                  <Button edit variant="ghost" onClick={() => add(pilar)}><Plus className="h-4 w-4" />Tambah</Button>
                </div>
                {list.length === 0 && (
                  <Card className="px-5 py-6 text-center text-[13px] text-slate-400">Belum ada program pilar {pilar}. Slide 7.4 ({pilar}) akan tampil kosong.</Card>
                )}
                <div className="space-y-4">
                  {list.map((r) => <ProgramCard key={r.id} r={r} patch={(p) => patch(r.id, p)} onDelete={() => del(r)} onAi={() => bukaAi(r.id)} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {ai && (
        <AiFillModal jenis="program" fields={AI_FIELDS} nilai={aiRow ? { ...aiRow, milestone: milestoneKeTeks(aiRow.milestone) } : {}} onApply={applyAi} onClose={() => setAi(null)}
          subjek={aiRow ? `${aiRow.pilar} · ${aiRow.nama || "(tanpa nama)"}` : `Program baru pilar ${aiPilar}`}
          konteks={{ pilar: aiPilar, contoh_kartu: CONTOH, ...(konteks ?? {}),
            program_lain: rows.filter((r) => r.id !== ai && r.nama).map((r) => ({ pilar: r.pilar, nama: r.nama, program_kerja: r.program_kerja })) }}
          placeholder={`Contoh: Tahun 2027 kami ingin memperkuat ${aiPilar === "Compliance" ? "sistem manajemen anti-penyuapan" : aiPilar === "Governance" ? "penerapan GCG dan kebijakan organ perusahaan" : aiPilar === "Sustainability" ? "pelaporan emisi dan pengelolaan limbah kebun" : "kuantifikasi risiko dengan model statistik"}, dipimpin divisi terkait, Januari–Desember 2027.`} />
      )}
    </SheetPage>
  );
}

function ProgramCard({ r, patch, onDelete, onAi }: { r: ProgramStrategis; patch: (p: Partial<ProgramStrategis>) => void; onDelete: () => void; onAi: () => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper/60 px-4 py-3">
        <div className="w-44"><SelectCell value={r.pilar} options={PILAR_GRCS} onSave={(v) => v && patch({ pilar: v })} className="font-semibold" /></div>
        <div className="min-w-[280px] flex-1 text-[15px] font-bold">
          <EditCell value={r.nama} placeholder="Nama program atau inisiatif strategis" onSave={(v) => patch({ nama: v as string | null })} />
        </div>
        <AiRowButton onClick={onAi} />
        <button data-edit onClick={onDelete} className="text-slate-400 hover:text-rose-600" title="Hapus program"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4">
        {BLOK.flat().map((f) => (
          <div key={f.key} className={`border-b border-line px-4 py-3 md:border-r ${f.span === 2 ? "md:col-span-2" : ""}`}>
            <div className="mb-1 text-[11px] font-bold tracking-wide text-brand-700 uppercase">{f.label}</div>
            <div className="rounded bg-cell-input px-1.5 py-1 text-[13px]">
              <EditCell value={r[f.key] as string | number | null} kind={f.kind ?? "text"} placeholder={f.hint ?? "Isi…"}
                display={f.kind ? (v) => rupiah(v as number) : undefined}
                onSave={(v) => patch({ [f.key]: v } as Partial<ProgramStrategis>)} />
            </div>
          </div>
        ))}
      </div>
      <MilestoneEditor list={r.milestone ?? []} onChange={(m) => patch({ milestone: m })} />
    </Card>
  );
}

/** Milestone sepanjang 2027: capaian yang direncanakan per bulan (arahan Challenge Session 7d). */
function MilestoneEditor({ list, onChange }: { list: Milestone[]; onChange: (m: Milestone[]) => void }) {
  const ubah = (i: number, p: Partial<Milestone>) => onChange(list.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const urut = (m: Milestone[]) => [...m].sort((a, b) => (BULAN_2027.indexOf(a.bulan) + 99) % 99 - (BULAN_2027.indexOf(b.bulan) + 99) % 99);
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="text-[11px] font-bold tracking-wide text-brand-700 uppercase">Milestone 2027</div>
        {!list.length && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Belum ada milestone</span>}
        <Button edit variant="ghost" className="ml-auto" onClick={() => onChange([...list, { bulan: "", uraian: "" }])}><Plus className="h-4 w-4" />Tambah milestone</Button>
      </div>
      {list.length > 0 && (
        <table className="kk-table">
          <thead><tr><th className="w-44">Bulan Target</th><th>Capaian / Hasil Kerja yang Direncanakan</th><th className="w-10" /></tr></thead>
          <tbody>
            {list.map((m, i) => (
              <tr key={i}>
                <td className="input"><SelectCell value={m.bulan || null} options={BULAN_2027} onSave={(v) => onChange(urut(list.map((x, j) => (j === i ? { ...x, bulan: v ?? "" } : x))))} /></td>
                <td className="input"><EditCell value={m.uraian || null} placeholder="Mis. Draf kebijakan anti-suap disetujui Direksi" onSave={(v) => ubah(i, { uraian: (v as string) ?? "" })} /></td>
                <td className="text-center"><button data-edit onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" title="Hapus milestone"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
