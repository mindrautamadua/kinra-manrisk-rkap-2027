import type { SnapshotData } from "./types";

export interface FieldChange { field: string; before: unknown; after: unknown }
export interface ItemChange { key: string; label: string; kind: "tambah" | "hapus" | "ubah"; changes: FieldChange[] }
export interface SectionDiff { id: string; title: string; items: ItemChange[] }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function byKey<T>(title: string, id: string, a: T[], b: T[], key: (x: T) => string, label: (x: T) => string, fields: [keyof T, string][]): SectionDiff {
  const items: ItemChange[] = [];
  const ma = new Map(a.map((x) => [key(x), x])), mb = new Map(b.map((x) => [key(x), x]));
  for (const [k, x] of mb) {
    const old = ma.get(k);
    if (!old) { items.push({ key: k, label: label(x), kind: "tambah", changes: [] }); continue; }
    const changes = fields.filter(([f]) => !same(old[f], x[f])).map(([f, l]) => ({ field: l, before: old[f], after: x[f] }));
    if (changes.length) items.push({ key: k, label: label(x), kind: "ubah", changes });
  }
  for (const [k, x] of ma) if (!mb.has(k)) items.push({ key: k, label: label(x), kind: "hapus", changes: [] });
  return { id, title, items };
}

/** Bandingkan dua kondisi data (a = versi lama, b = versi baru). */
export function diffSnapshot(a: SnapshotData, b: SnapshotData): SectionDiff[] {
  const sampul = byKey("Sampul", "sampul", [a.sampul], [b.sampul], () => "sampul", () => "Sampul",
    [["nama_entitas", "Nama Entitas"], ["posisi_data", "Posisi Data"], ["tanggal_penyusunan", "Tanggal Penyusunan"], ["versi", "Versi"]]);

  const ras = byKey("RAS", "ras", a.ras, b.ras, (x) => String(x.id), (x) => x.kategori,
    [["sikap", "Sikap Risiko"], ["pernyataan", "Pernyataan Selera Risiko"], ["rasionalisasi", "Rasionalisasi"]]);

  const reg = byKey("Risk Register", "register", a.register, b.register, (x) => x.id, (x) => x.risk_event ?? "(tanpa risk event)", [
    ["kategori", "Taksonomi Risiko"], ["risk_driver", "Risk Driver"], ["risk_event", "Risk Event"], ["deskripsi", "Deskripsi"], ["root_cause", "Root Cause"],
    ["probabilitas", "Probabilitas"], ["deskripsi_dampak", "Deskripsi Dampak"], ["nilai_dampak", "Nilai Dampak (Rp)"], ["kriteria_dampak", "Kriteria Dampak"],
    ["kategori_dampak", "Kategori Dampak"], ["expected_loss", "Expected Loss (Rp)"], ["existing_control", "Existing Control"],
    ["rencana_mitigasi", "Rencana Mitigasi"], ["kategori_mitigasi", "Kategori Mitigasi"], ["parameter_ram", "Parameter RAM Terkait"],
  ]);

  // Lembar parameter: ringkasan hasil + jumlah sel isian yang berubah
  const pa = new Map(a.params.map((p) => [p.code, p]));
  const paramItems: ItemChange[] = [];
  for (const p of b.params) {
    const o = pa.get(p.code);
    if (!o) continue;
    const ch: FieldChange[] = [];
    if (!same(o.diterapkan, p.diterapkan)) ch.push({ field: "Diterapkan", before: o.diterapkan, after: p.diterapkan });
    for (const [f, l] of [["hasil", "Hasil Pengukuran"], ["status", "Status"], ["limit", "Limit"], ["appetite", "Appetite"], ["tolerance", "Tolerance"]] as const)
      if (!same(o.summary?.[f], p.summary?.[f])) ch.push({ field: l, before: o.summary?.[f], after: p.summary?.[f] });
    const keys = new Set([...Object.keys(o.inputs ?? {}), ...Object.keys(p.inputs ?? {})]);
    const sel = [...keys].filter((k) => !same(o.inputs?.[k] ?? null, p.inputs?.[k] ?? null));
    if (sel.length) ch.push({ field: "Sel isian berubah", before: null, after: `${sel.length} sel (${sel.slice(0, 8).join(", ")}${sel.length > 8 ? ", …" : ""})` });
    if (ch.length) paramItems.push({ key: p.code, label: p.code, kind: "ubah", changes: ch });
  }

  const peng = byKey("Rencana Pengendalian RAM", "pengendalian", a.pengendalian, b.pengendalian, (x) => x.kode, (x) => `Parameter ${x.kode}`,
    [["inisiatif", "Inisiatif Strategis"], ["kebijakan", "Kebijakan"], ["program", "Program Kerja"], ["anggaran", "Anggaran (Rp miliar)"]]);
  const tamb = byKey("Parameter Unik Tambahan RAM", "ram_tambahan", a.ram_tambahan, b.ram_tambahan, (x) => x.id, (x) => `${x.kode ?? ""} ${x.parameter ?? ""}`.trim(), [
    ["kode", "Kode"], ["parameter", "Parameter"], ["formula", "Formula"], ["limit_v", "Limit"], ["appetite_v", "Appetite"], ["tolerance_v", "Tolerance"], ["hasil", "Hasil"],
    ["inisiatif", "Inisiatif"], ["kebijakan", "Kebijakan"], ["program", "Program Kerja"], ["anggaran", "Anggaran"],
  ]);
  const cat = byKey("CAT", "cat", a.cat, b.cat, (x) => x.id, (x) => x.nama ?? "(tanpa nama)", [
    ["jenis", "Jenis"], ["nama", "Nama"], ["rencana_waktu", "Rencana Waktu"], ["parameter", "Parameter"], ["hasil", "Hasil"],
    ["limit_v", "Limit"], ["appetite_v", "Appetite"], ["tolerance_v", "Tolerance"],
  ]);

  return [sampul, ras, reg, { id: "params", title: "Lembar Parameter", items: paramItems }, peng, tamb, cat];
}
