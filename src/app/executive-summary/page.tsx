"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Printer } from "lucide-react";
import { Button, ErrorBox, Loading, SheetPage, useLoad } from "@/components/ui";
import { api } from "@/lib/data";
import { cekSikap, isTopRisk, nilaiParam, rupiah, statusStyle } from "@/lib/format";
import { buildRam, KATEGORI_URUT, type RamRow } from "@/lib/ram";
import { PILAR_GRCS, SIKAP, type KategoriRisiko, type ProgramStrategis, type Ras, type RiskRegister } from "@/lib/types";

/** Ukuran logis satu slide (16:9), sama seperti PPT Executive Summary. */
const W = 1280;
const H = 720;

const DEF_SIKAP: Record<string, string> = {
  "Zero Tolerance": "Tidak bersedia mengambil risiko, tidak memperkenankan pelanggaran atau penyimpangan, dan mengutamakan keberlangsungan operasi dengan kepatuhan mutlak dan pengendalian yang ketat.",
  Conservative: "Bersedia mengambil risiko pada tingkat rendah dan terkontrol, dengan prioritas pada keberlangsungan usaha, perlindungan aset, dan pencapaian target yang berkelanjutan.",
  Moderate: "Bersedia mengambil risiko yang seimbang dengan manfaat atau nilai yang diharapkan, sepanjang masih dalam kapasitas risiko perusahaan.",
  Aggressive: "Bersedia mengambil risiko relatif tinggi untuk pertumbuhan, transformasi, atau penciptaan nilai yang lebih besar, sepanjang masih dalam kapasitas risiko perusahaan.",
};

const STATUS_HEX: Record<string, string> = { Hijau: "#00B050", Kuning: "#F2C200", Oranye: "#F07D00", Merah: "#C01E13" };
const DAMPAK_HEX: Record<string, string> = { "Sangat Rendah": "#2E7D32", Rendah: "#7CB342", Moderat: "#F2C200", Tinggi: "#F07D00", "Sangat Tinggi": "#C01E13" };

/** "Conservative to Moderate" → [1, 2] (indeks pada SIKAP). */
function rentang(s?: string | null): [number, number] | null {
  if (!s) return null;
  const idx = s.split(/\s+to\s+/i).map((x) => SIKAP.indexOf(x.trim() as (typeof SIKAP)[number])).filter((i) => i >= 0);
  return idx.length ? [Math.min(...idx), Math.max(...idx)] : null;
}

/** Nama Inggris dari "Risiko Strategis (Strategic Risk)". */
const namaEn = (k?: KategoriRisiko) => k?.nama_en?.match(/\(([^()]*(?:\([^()]*\))?[^()]*)\)\s*$/)?.[1] ?? "";

/** Kemas kelompok baris ke beberapa slide berdasarkan bobot tinggi baris. */
function kemas<T>(groups: { key: string; items: T[] }[], weight: (t: T) => number, max: number, headWeight = 1) {
  const pages: { key: string; items: T[] }[][] = [];
  let cur: { key: string; items: T[] }[] = [];
  let used = 0;
  for (const g of groups) {
    const rest = [...g.items];
    if (!rest.length) {
      if (used + headWeight > max && cur.length) { pages.push(cur); cur = []; used = 0; }
      cur.push({ key: g.key, items: [] }); used += headWeight;
      continue;
    }
    while (rest.length) {
      const chunk: T[] = [];
      let w = headWeight;
      while (rest.length && (used + w + weight(rest[0]) <= max || (!chunk.length && !cur.length))) { w += weight(rest[0]); chunk.push(rest.shift()!); }
      if (!chunk.length) { pages.push(cur); cur = []; used = 0; continue; }
      cur.push({ key: g.key, items: chunk }); used += w;
      if (rest.length) { pages.push(cur); cur = []; used = 0; }
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

export default function ExecutiveSummaryPage() {
  const q = useLoad(async () => {
    const [sampul, ras, kategori, register, params, pengendalian, tambahan] = await Promise.all([
      api.sampul(), api.ras(), api.kategori(), api.register(), api.params(), api.pengendalian(), api.ramTambahan(),
    ]);
    // Tabel program_strategis (migrasi 0004) mungkin belum dibuat: deck tetap tampil dengan slide 7.4 kosong.
    const program = await api.program().catch(() => [] as ProgramStrategis[]);
    return { sampul, ras, kategori, register, program, ram: buildRam(params, ras, pengendalian, tambahan) };
  });
  const d = q.data;

  return (
    <SheetPage title="Executive Summary RKAP 2027" code="Executive Summary" wide
      actions={<Button onClick={() => window.print()}><Printer className="h-4 w-4" />Cetak / PDF</Button>}>
      <style>{`@media print { @page { size: ${W}px ${H}px; margin: 0; } }`}</style>
      {q.loading ? <Loading variant="deck" /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <Deck entitas={d.sampul.nama_entitas || "PT KINRA"} ras={d.ras} kategori={d.kategori} register={d.register} ram={d.ram} program={d.program} />
      )}
    </SheetPage>
  );
}

function Deck({ entitas, ras, kategori, register, ram, program }: { entitas: string; ras: Ras[]; kategori: KategoriRisiko[]; register: RiskRegister[]; ram: RamRow[]; program: ProgramStrategis[] }) {
  const kat = (nama: string) => kategori.find((k) => k.nama === nama);

  // 7.1 RAS detail: bobot baris mengikuti panjang teks terpanjang (≈ satu baris tabel per 480 karakter).
  const rasGroups = Array.from(new Set(ras.map((r) => r.kategori))).map((k) => ({ key: k, items: ras.filter((r) => r.kategori === k) }));
  const rasPages = kemas(rasGroups, (r) => Math.max(1, Math.max(...[r.pernyataan_induk, r.pernyataan, r.rasionalisasi].map((t) => t?.length ?? 0)) / 480), 3.4, 0);

  // 7.2 RAM detail: hanya parameter yang diterapkan.
  const ramGroups = KATEGORI_URUT.map((k) => ({ key: k, items: ram.filter((r) => r.kategori === k && r.diterapkan) }));
  const ramPages = kemas(ramGroups, () => 1, 12, 1);

  // 7.3 Top risk: semua taksonomi tampil, risiko utama per taksonomi.
  const utama = register.filter((r) => r.risk_event && isTopRisk(r.kategori_dampak));
  const topGroups = KATEGORI_URUT.map((k) => ({ key: k, items: utama.filter((r) => r.kategori === k) }));
  const topPages = kemas(topGroups, (r) => 1 + Math.min(3, Math.floor((r.rencana_mitigasi?.length ?? 0) / 140)), 10, 1);

  // 7.4 Program strategis: satu slide per program, urut pilar GRCS; pilar tanpa program tetap punya slide kosong.
  const progSlides = PILAR_GRCS.flatMap((pilar): { pilar: string; p: ProgramStrategis | null }[] => {
    const list = program.filter((p) => p.pilar === pilar);
    return list.length ? list.map((p) => ({ pilar, p })) : [{ pilar, p: null }];
  });

  const judul = (pages: { key: string }[][], i: number) =>
    `(${i + 1}/${pages.length}) ${gabung(pages[i].map((g) => g.key))}`;

  const slides: React.ReactNode[] = [
    <Cover key="cover" entitas={entitas} />,
    <Slide key="ras0" title={`7.1 Risk Appetite Statement (RAS) (${entitas})`} sub={`(1/${rasPages.length + 1}) Seluruh sikap risiko ${entitas} berada dalam rentang PTPN III (Persero)`} entitas={entitas}>
      <RasMatrix ras={ras} entitas={entitas} kat={kat} />
    </Slide>,
    ...rasPages.map((p, i) => (
      <Slide key={`ras${i}`} title={`7.1 Risk Appetite Statement (RAS) (${entitas})`} sub={`(${i + 2}/${rasPages.length + 1}) ${gabung(p.map((g) => g.key))}`} entitas={entitas}>
        <RasDetail groups={p} ras={ras} entitas={entitas} kat={kat} />
      </Slide>
    )),
    <Slide key="ram0" title={`7.2 Risk Acceptance Matrix (RAM) (${entitas})`} sub={`(1/${ramPages.length + 1}) Ringkasan: ${ram.filter((r) => r.diterapkan).length} parameter pengukuran menjaga delapan taksonomi risiko`} entitas={entitas}>
      <RamRingkasan ram={ram} />
    </Slide>,
    ...ramPages.map((p, i) => (
      <Slide key={`ram${i}`} title={`7.2 Risk Acceptance Matrix (RAM) (${entitas})`} sub={`(${i + 2}/${ramPages.length + 1}) ${gabung(p.map((g) => g.key))}`} entitas={entitas}>
        <RamDetail groups={p} />
      </Slide>
    )),
    ...topPages.map((p, i) => (
      <Slide key={`top${i}`} title={`7.3 Top Risk (${entitas})`} sub={judul(topPages, i)} entitas={entitas}>
        <TopRisk groups={p} kat={kat} />
      </Slide>
    )),
    ...progSlides.map(({ pilar, p }, i) => (
      <Slide key={`prog${i}`} title={`7.4 Program atau Inisiatif Strategis GRCS (${pilar})`} sub={p?.nama || "Belum ada program atau inisiatif strategis"} entitas={entitas}>
        <ProgramKartu p={p} />
      </Slide>
    )),
  ];

  return (
    <div className="space-y-6 print:space-y-0">
      {slides.map((s, i) => <Scaled key={i} n={i + 1} last={i === slides.length - 1}>{s}</Scaled>)}
    </div>
  );
}

/** "Risiko Strategis", "Risiko Pasar", "Risiko Keuangan" → "Risiko Strategis, Pasar, dan Keuangan". */
function gabung(names: string[]) {
  const n = Array.from(new Set(names)).map((x, i) => (i === 0 ? x : x.replace(/^Risiko /, "")));
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")}${n.length > 2 ? "," : ""} dan ${n[n.length - 1]}`;
}

// ---------- kerangka slide ----------
function Scaled({ children, n, last }: { children: React.ReactNode; n: number; last: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="mx-auto w-full max-w-[1280px] print:max-w-none">
      <div className="relative overflow-hidden rounded-lg shadow-[0_2px_14px_rgba(0,0,0,0.12)] ring-1 ring-black/5 print:!h-[720px] print:rounded-none print:shadow-none print:ring-0"
        style={{ height: H * scale }} data-slide={n}>
        <div className="absolute top-0 left-0 origin-top-left print:!transform-none" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
      {!last && <div className="break-after-page" />}
    </div>
  );
}

function Slide({ title, sub, entitas, children }: { title: string; sub: string; entitas: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[#1A1A1A]" style={{ fontFamily: "var(--font-jakarta), Arial, sans-serif" }}>
      <div className="flex items-stretch">
        <div className="w-2.5 bg-[#600000]" />
        <div className="flex-1 px-8 pt-5 pb-3">
          <div className="text-[26px] leading-tight font-extrabold tracking-tight text-[#600000]">{title}</div>
          <div className="mt-1 text-[14px] font-semibold text-[#707070]">{sub}</div>
        </div>
      </div>
      <div className="mx-8 h-[2px] bg-gradient-to-r from-[#600000] via-[#C01E13] to-transparent" />
      <div className="min-h-0 flex-1 overflow-hidden px-8 pt-4 pb-2">{children}</div>
      <div className="flex items-center justify-between border-t border-[#E3E3E3] px-8 py-2 text-[10.5px] text-[#707070]">
        <span>Executive Summary RKAP 2027 · {entitas}</span>
        <span>Perencanaan Governance, Risk Management, Compliance and Sustainability</span>
      </div>
    </div>
  );
}

function Cover({ entitas }: { entitas: string }) {
  return (
    <div className="relative flex h-full w-full items-center overflow-hidden bg-[#600000] text-white">
      <div className="absolute -top-40 -right-40 h-[560px] w-[560px] rounded-full bg-[#290E0E]/50" />
      <div className="absolute -bottom-56 right-40 h-[420px] w-[420px] rounded-full bg-[#C01E13]/30" />
      <div className="relative px-24">
        <div className="text-[150px] leading-none font-extrabold text-white/90">7</div>
        <div className="mt-6 max-w-[760px] text-[40px] leading-tight font-extrabold">Perencanaan Governance, Risk Management, Compliance and Sustainability</div>
        <div className="mt-8 h-1 w-24 bg-[#F9CBC8]" />
        <div className="mt-5 text-[18px] font-semibold text-[#F9CBC8]">Executive Summary RKAP 2027 · {entitas}</div>
      </div>
    </div>
  );
}

// ---------- tabel bergaya PPT ----------
const th = "border border-white/25 bg-[#600000] px-2 py-1.5 text-left align-middle text-[11px] font-bold text-white";
const td = "border border-[#CFCFCF] px-2 py-1.5 align-top";

function Taks({ k, nama }: { k?: KategoriRisiko; nama: string }) {
  return (
    <>
      <div className="font-bold">{nama}</div>
      <div className="text-[10px] text-[#707070] italic">{namaEn(k)}</div>
    </>
  );
}

function SikapPill({ s }: { s?: string | null }) {
  if (!s) return <span className="text-[#BFBFBF]">–</span>;
  return <span className="inline-block rounded bg-[#F2F2F2] px-1.5 py-0.5 text-[10.5px] font-bold text-[#600000] ring-1 ring-[#D9C4C4]">{s}</span>;
}

// ---------- 7.1 RAS ----------
function RasMatrix({ ras, entitas, kat }: { ras: Ras[]; entitas: string; kat: (n: string) => KategoriRisiko | undefined }) {
  return (
    <div className="grid h-full grid-cols-[1fr_330px] gap-6">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className={clsx(th, "w-8 text-center")}>No</th><th className={th}>Taksonomi Risiko</th>
            {SIKAP.map((s) => <th key={s} className={clsx(th, "w-[105px] text-center")}>{s}</th>)}
            <th className={clsx(th, "w-[80px] text-center")}>Cek</th>
          </tr>
        </thead>
        <tbody>
          {ras.map((r, i) => {
            const first = i === 0 || ras[i - 1].kategori !== r.kategori;
            const span = first ? ras.filter((x) => x.kategori === r.kategori).length : 0;
            const induk = rentang(r.sikap_induk), ent = rentang(r.sikap), cek = cekSikap(r.sikap, r.sikap_induk);
            return (
              <tr key={r.id} className={clsx(i % 2 === 1 && "bg-[#FAFAFA]")}>
                {first && <td rowSpan={span} className={clsx(td, "text-center font-bold")}>{r.no}</td>}
                {first && <td rowSpan={span} className={td}><Taks k={kat(r.kategori)} nama={r.kategori} /></td>}
                {SIKAP.map((_, si) => {
                  const inInduk = induk && si >= induk[0] && si <= induk[1];
                  const inEnt = ent && si >= ent[0] && si <= ent[1];
                  return (
                    <td key={si} className={clsx(td, "relative h-9 p-0 align-middle")}>
                      {inInduk && <div className={clsx("absolute inset-y-1.5 bg-[#F9CBC8]", si === induk![0] ? "left-1.5 rounded-l-full" : "left-0", si === induk![1] ? "right-1.5 rounded-r-full" : "right-0")} />}
                      {inEnt && <div className="relative mx-auto h-4 w-4 rounded-full border-2 border-white bg-[#600000] shadow" />}
                    </td>
                  );
                })}
                <td className={clsx(td, "text-center align-middle text-[10.5px] font-bold", cek === "Sesuai" ? "text-[#00A050]" : "text-[#C01E13]")}>{cek || "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-col gap-2.5 text-[11px]">
        <div className="flex items-center gap-4 rounded-md bg-[#F2F2F2] px-3 py-2 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-7 rounded-full bg-[#F9CBC8]" />Rentang sikap risiko PTPN III</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-[#600000]" />Sikap {entitas}</span>
        </div>
        {SIKAP.map((s) => (
          <div key={s} className="rounded-md border-l-4 border-[#600000] bg-[#FAFAFA] px-3 py-2">
            <div className="font-bold text-[#600000]">{s}</div>
            <div className="mt-0.5 leading-snug text-[#404040]">{DEF_SIKAP[s]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RasDetail({ groups, ras, entitas, kat }: { groups: { key: string; items: Ras[] }[]; ras: Ras[]; entitas: string; kat: (n: string) => KategoriRisiko | undefined }) {
  return (
    <table className="w-full table-fixed border-collapse text-[10.5px] leading-snug">
      <thead>
        <tr>
          <th className={clsx(th, "w-8 text-center")}>No</th><th className={clsx(th, "w-[150px]")}>Taksonomi Risiko</th>
          <th className={clsx(th, "w-[150px]")}>Sikap Risiko</th>
          <th className={th}>RAS PTPN III (Persero)</th><th className={th}>RAS ({entitas})</th><th className={th}>Rasionalisasi Sikap Risiko ({entitas})</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => g.items.map((r, i) => (
          <tr key={r.id}>
            {i === 0 && <td rowSpan={g.items.length} className={clsx(td, "text-center font-bold")}>{r.no}</td>}
            {i === 0 && <td rowSpan={g.items.length} className={td}><Taks k={kat(g.key)} nama={g.key} />
              {ras.filter((x) => x.kategori === g.key).length > g.items.length && <div className="mt-1 text-[9.5px] text-[#707070]">(lanjutan)</div>}</td>}
            <td className={td}>
              <div className="text-[9.5px] text-[#707070]">PTPN III (Persero)</div><SikapPill s={r.sikap_induk} />
              <div className="mt-1.5 text-[9.5px] text-[#707070]">{entitas}</div><SikapPill s={r.sikap} />
            </td>
            <td className={clsx(td, "text-[#404040]")}>{r.pernyataan_induk}</td>
            <td className={clsx(td, "bg-[#FFF8F7]")}>{r.pernyataan || <Kosong />}</td>
            <td className={td}>{r.rasionalisasi || <Kosong />}</td>
          </tr>
        )))}
      </tbody>
    </table>
  );
}

const Kosong = () => <span className="text-[#BFBFBF] italic">Belum diisi</span>;

// ---------- 7.2 RAM ----------
function Dot({ status, size = 10 }: { status?: string; size?: number }) {
  const c = STATUS_HEX[status ?? ""];
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: c ?? "#D9D9D9" }} />;
}

function RamRingkasan({ ram }: { ram: RamRow[] }) {
  const aktif = ram.filter((r) => r.diterapkan);
  const grup = (g: string) => aktif.filter((r) => r.kategoriParameter.includes(g)).length;
  const hit = (s: string) => aktif.filter((r) => r.status === s).length;
  const lain = aktif.length - ["Hijau", "Kuning", "Oranye", "Merah"].reduce((a, s) => a + hit(s), 0);
  return (
    <div className="grid h-full grid-cols-[250px_1fr] gap-6">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-[#600000] p-4 text-white">
          <div className="text-[11px] font-bold tracking-[0.14em] text-[#F9CBC8] uppercase">Parameter Pengukuran</div>
          <div className="mt-1 text-[44px] leading-none font-extrabold">{aktif.length}</div>
          <div className="mt-1 text-[11px] text-white/80">parameter diterapkan pada delapan taksonomi risiko</div>
        </div>
        <div className="rounded-lg bg-[#F2F2F2] p-3 text-[11.5px]">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-[#707070] uppercase">Kategori Parameter</div>
          {[["Standar", "ditetapkan PT DAM"], ["Klaster", "Food & Agriculture"], ["Unik", "sesuai karakter usaha"]].map(([g, k]) => (
            <div key={g} className="flex items-baseline gap-2 py-0.5"><b className="w-6 text-right text-[16px] text-[#600000]">{grup(g)}</b><span><b>{g}</b> · <span className="text-[#707070]">{k}</span></span></div>
          ))}
        </div>
        <div className="rounded-lg bg-[#F2F2F2] p-3 text-[11.5px]">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-[#707070] uppercase">Status Pengukuran RKAP 2027</div>
          {["Hijau", "Kuning", "Oranye", "Merah"].map((s) => (
            <div key={s} className="flex items-center gap-2 py-0.5"><Dot status={s} size={12} /><b className="w-6 text-right text-[15px]">{hit(s)}</b>{s}</div>
          ))}
          {lain > 0 && <div className="flex items-center gap-2 py-0.5"><Dot size={12} /><b className="w-6 text-right text-[15px]">{lain}</b>Belum terukur</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 content-start gap-2.5">
        {KATEGORI_URUT.map((k) => {
          const list = ram.filter((r) => r.kategori === k && r.diterapkan);
          return (
            <div key={k} className="rounded-md border border-[#E3E3E3] bg-white">
              <div className="flex items-center justify-between rounded-t-md bg-[#EFEFEF] px-3 py-1.5">
                <b className="text-[12px] text-[#600000]">{k}</b>
                <span className="text-[10.5px] text-[#707070]">Sikap <b className="text-[#1A1A1A]">{list[0]?.sikap.split(" · ")[0] || "–"}</b></span>
              </div>
              <div className="px-3 py-1.5 text-[11px]">
                {list.map((r) => (
                  <div key={r.key} className="flex items-center gap-2 py-[1px]"><Dot status={r.status} /><b className="w-6">{r.kode}</b><span className="truncate">{r.parameter}</span></div>
                ))}
                {!list.length && <div className="text-[#BFBFBF] italic">Tidak ada parameter diterapkan</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RamDetail({ groups }: { groups: { key: string; items: RamRow[] }[] }) {
  return (
    <div className="flex h-full flex-col">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th rowSpan={2} className={clsx(th, "w-11 text-center")}>Kode</th><th rowSpan={2} className={th}>Parameter Pengukuran</th>
            <th rowSpan={2} className={clsx(th, "w-24")}>Kategori Parameter</th><th rowSpan={2} className={clsx(th, "w-14")}>Satuan</th>
            <th colSpan={3} className={clsx(th, "text-center")}>Risk Threshold</th>
            <th rowSpan={2} className={clsx(th, "w-28 text-center")}>Hasil Pengukuran RKAP 2027 (Risiko Inheren)</th>
            <th rowSpan={2} className={clsx(th, "w-28 text-center")}>Status Pengukuran</th>
          </tr>
          <tr>{["Limit", "Appetite", "Tolerance"].map((x) => <th key={x} className={clsx(th, "w-24 text-center")}>{x}</th>)}</tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              <tr>
                <td colSpan={9} className={clsx(td, "bg-[#EFEFEF] py-1 font-bold text-[#600000]")}>
                  {g.key}<span className="ml-4 font-semibold text-[#707070]">Sikap risiko: <span className="text-[#1A1A1A]">{g.items[0]?.sikap || "–"}</span></span>
                </td>
              </tr>
              {g.items.map((r) => {
                const off = !r.diterapkan;
                const st = statusStyle(r.status);
                return (
                  <tr key={r.key} className={clsx(off && "text-[#9A9A9A]")}>
                    <td className={clsx(td, "text-center font-bold")}>{r.kode}</td>
                    <td className={clsx(td, "font-semibold")}>{r.parameter}</td>
                    <td className={clsx(td, "text-[10px] font-bold uppercase")}>{r.kategoriParameter.replace("Parameter ", "")}</td>
                    <td className={td}>{r.satuan}</td>
                    {[r.limit, r.appetite, r.tolerance].map((v, i) => <td key={i} className={clsx(td, "text-center tabnum")}>{off ? "–" : nilaiParam(v, r.satuan)}</td>)}
                    <td className={clsx(td, "text-center font-bold tabnum")}>{off ? "–" : nilaiParam(r.hasil, r.satuan)}</td>
                    <td className={clsx(td, "align-middle")}>
                      <span className="flex items-center justify-center gap-1.5 font-semibold"><Dot status={r.status} />{st.label}</span>
                    </td>
                  </tr>
                );
              })}
              {!g.items.length && <tr><td colSpan={9} className={clsx(td, "text-center text-[#BFBFBF] italic")}>Tidak ada parameter</td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex gap-5 pt-2 text-[10.5px] text-[#707070]">
        <span>Risk threshold diusulkan PTPN III</span>
        {["Hijau", "Kuning", "Oranye", "Merah"].map((s) => <span key={s} className="flex items-center gap-1.5"><Dot status={s} />{s}</span>)}
      </div>
    </div>
  );
}

// ---------- 7.3 Top Risk ----------
function TopRisk({ groups, kat }: { groups: { key: string; items: RiskRegister[] }[]; kat: (n: string) => KategoriRisiko | undefined }) {
  return (
    <table className="w-full table-fixed border-collapse text-[11.5px] leading-snug">
      <thead>
        <tr>
          <th className={clsx(th, "w-[210px]")}>Taksonomi Risiko</th><th className={clsx(th, "w-10 text-center")}>No</th>
          <th className={clsx(th, "w-[300px]")}>Risk Event</th><th className={clsx(th, "w-[120px] text-center")}>Kategori Dampak</th><th className={th}>Rencana Mitigasi</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.key}>
            {g.items.length ? g.items.map((r, i) => (
              <tr key={r.id}>
                {i === 0 && <td rowSpan={g.items.length} className={clsx(td, "bg-[#FAFAFA]")}><Taks k={kat(g.key)} nama={g.key} /></td>}
                <td className={clsx(td, "text-center font-bold")}>{i + 1}</td>
                <td className={clsx(td, "font-semibold")}>{r.risk_event}</td>
                <td className={clsx(td, "text-center align-middle")}>
                  <span className="inline-block rounded px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: DAMPAK_HEX[r.kategori_dampak ?? ""] ?? "#707070" }}>{r.kategori_dampak}</span>
                </td>
                <td className={clsx(td, "whitespace-pre-line")}>{r.rencana_mitigasi || <Kosong />}</td>
              </tr>
            )) : (
              <tr>
                <td className={clsx(td, "bg-[#FAFAFA]")}><Taks k={kat(g.key)} nama={g.key} /></td>
                <td className={clsx(td, "text-center text-[#BFBFBF]")}>–</td>
                <td colSpan={3} className={clsx(td, "text-[#BFBFBF] italic")}>Tidak ada risiko utama</td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

// ---------- 7.4 Program Strategis ----------
/** Teks multi-baris → poin-poin; satu baris tetap paragraf. */
function Poin({ text }: { text?: string | null }) {
  const lines = (text ?? "").split(/\n+/).map((x) => x.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
  if (!lines.length) return null;
  if (lines.length === 1) return <div>{lines[0]}</div>;
  return <ul className="list-disc space-y-0.5 pl-4">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

function ProgramKartu({ p }: { p: ProgramStrategis | null }) {
  if (!p) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-[#D9C4C4] text-[15px] text-[#9A9A9A] italic">
        Belum ada program atau inisiatif strategis untuk pilar ini. Isi di menu Program Strategis GRCS.
      </div>
    );
  }
  const isi = [p.inisiatif_rjpp, p.objective_scorecard, p.program_kerja, p.deskripsi, p.tujuan_kualitatif, p.tujuan_kuantitatif, p.target, p.risiko_implementasi, p.mitigasi];
  const panjang = isi.reduce((a, t) => a + (t?.length ?? 0), 0);
  const fs = panjang > 1800 ? 11 : panjang > 1200 ? 12 : 13.5;
  const hd = "bg-[#600000] px-3 py-1.5 text-[13px] font-bold text-white";
  const cl = "border border-[#CFCFCF] px-3 py-2 align-top";
  const k = (t?: string | null) => <Poin text={t} />;
  const kosong = (...t: (string | number | null | undefined)[]) => t.every((x) => x == null || x === "");
  return (
    <table className="h-full w-full table-fixed border-collapse leading-snug" style={{ fontSize: fs }}>
      <colgroup><col style={{ width: "34%" }} /><col style={{ width: "30%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /></colgroup>
      <tbody>
        <tr><th className={hd + " text-left"}>Inisiatif Strategi RJPP</th><th className={hd + " text-left"}>Objective Scorecard</th><th colSpan={2} className={hd + " text-left"}>Program Kerja</th></tr>
        <tr className="h-[1%]">
          <td className={cl}>{kosong(p.inisiatif_rjpp) ? <Kosong /> : k(p.inisiatif_rjpp)}</td>
          <td className={cl}>{kosong(p.objective_scorecard) ? <Kosong /> : k(p.objective_scorecard)}</td>
          <td colSpan={2} className={cl}>{kosong(p.program_kerja) ? <Kosong /> : k(p.program_kerja)}</td>
        </tr>
        <tr><th className={hd + " text-left"}>Pemimpin Program</th><th className={hd + " text-left"}>Pemilik Program</th><th className={hd + " text-left"}>Bulan Mulai</th><th className={hd + " text-left"}>Bulan Selesai</th></tr>
        <tr className="h-[1%]">
          {[p.pemimpin, p.pemilik, p.bulan_mulai, p.bulan_selesai].map((v, i) => <td key={i} className={cl}>{v || <Kosong />}</td>)}
        </tr>
        <tr><th className={hd + " text-left"}>Deskripsi Program</th><th className={hd + " text-left"}>Tujuan &amp; Hasil Kerja</th><th colSpan={2} className={hd + " text-left"}>Target Program</th></tr>
        <tr>
          <td className={cl}>{kosong(p.deskripsi) ? <Kosong /> : k(p.deskripsi)}</td>
          <td className={cl}>
            {kosong(p.tujuan_kualitatif, p.tujuan_kuantitatif) ? <Kosong /> : (
              <div className="space-y-1.5">
                {!kosong(p.tujuan_kualitatif) && <div><div className="font-bold">Kualitatif :</div><Poin text={p.tujuan_kualitatif} /></div>}
                {!kosong(p.tujuan_kuantitatif) && <div><div className="font-bold">Kuantitatif :</div><Poin text={p.tujuan_kuantitatif} /></div>}
              </div>
            )}
          </td>
          <td colSpan={2} className={cl}>{kosong(p.target) ? <Kosong /> : k(p.target)}</td>
        </tr>
        <tr><th className={hd + " text-left"}>Rencana Anggaran Belanja</th><th className={hd + " text-left"}>Risiko Implementasi</th><th colSpan={2} className={hd + " text-left"}>Mitigasi Risiko</th></tr>
        <tr className="h-[22%]">
          <td className={cl}>
            <div>OPEX : <b className="tabnum">{p.opex ? rupiah(p.opex) : "-"}</b></div>
            <div>CAPEX : <b className="tabnum">{p.capex ? rupiah(p.capex) : "-"}</b></div>
          </td>
          <td className={cl}>{kosong(p.risiko_implementasi) ? <Kosong /> : k(p.risiko_implementasi)}</td>
          <td colSpan={2} className={cl}>{kosong(p.mitigasi) ? <Kosong /> : k(p.mitigasi)}</td>
        </tr>
      </tbody>
    </table>
  );
}
