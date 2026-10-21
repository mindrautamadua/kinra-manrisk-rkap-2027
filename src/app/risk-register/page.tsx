"use client";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Compass, Copy, Download, Library, ListChecks, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  Button, DampakBadge, EditCell, ErrorBox, Loading, Section, SelectCell, SheetPage, Stat, TableWrap, useLoad, useSaver,
} from "@/components/ui";
import { TaxonomyPicker, groupT3, type T3Option } from "@/components/TaxonomyPicker";
import { ParamPicker } from "@/components/ParamPicker";
import { SasaranPicker } from "@/components/SasaranPicker";
import { PilihBanyak } from "@/components/PilihBanyak";
import { labelPos, POS_PILIHAN, PROSES_BISNIS, type KeterkaitanRequest, type KeterkaitanResponse } from "@/lib/keterkaitan-rkap";
import type { DasarPenilaianRequest, DasarPenilaianResponse } from "@/lib/dasar-penilaian";
import { MitigasiAi } from "@/components/MitigasiAi";
import { UsulanRisikoModal } from "@/components/UsulanRisiko";
import type { UsulanRisiko, UsulanRisikoRequest } from "@/lib/usulan-risiko";
import { RelevansiAiModal, RelevansiBadge } from "@/components/RelevansiAi";
import { bacaRelevansi, sidikRisiko, simpanRelevansi, type HasilRelevansi, type RelevansiRequest } from "@/lib/relevansi-risiko";
import { RedundansiAiModal, RedundansiBadge } from "@/components/RedundansiAi";
import {
  bacaRedundansi, isianUbah, JENIS_REDUNDAN, simpanRedundansi, type HasilRedundansi, type KelompokRedundan, type OpsiTindakan, type RedundansiRequest,
} from "@/lib/redundansi-risiko";
import { RencanaAksiModal } from "@/components/RencanaAksi";
import { elInheren, ringkasTarget, type RingkasTarget } from "@/lib/target-risiko";
import { angkaKas, POS } from "@/lib/rkap-baca";
import { AiFillModal, AiRowButton } from "@/components/AiFill";
import type { FieldSpec } from "@/lib/isi-ai";
import { ringkasRisiko } from "@/lib/kaitkan-ai";
import { paramOptions } from "@/lib/trace";
import { useReadonly } from "@/lib/mode";
import { api } from "@/lib/data";
import { isTopRisk, persen, rupiah } from "@/lib/format";
import { note } from "@/lib/static";
import { exportRegister } from "@/lib/export";
import { cariKriteria, cekKualitas, ebitdaRkap, labelLevel, saranDampak, type Isu, type SaranDampak } from "@/lib/kualitas-register";
import { KATEGORI_DAMPAK, KATEGORI_MITIGASI, type MitigasiAksi, type RiskRegister } from "@/lib/types";
import { konfirmasi } from "@/components/Konfirmasi";

export default function RiskRegisterPage() {
  const q = useLoad(async () => {
    const [register, kategori, drivers, kriteria, tax, params, tambahan, sasaran, ras, aksi, rkap] = await Promise.all([
      api.register(), api.kategori(), api.drivers(), api.kriteria(), api.taksonomi(), api.params(), api.ramTambahan(),
      api.sasaran().catch(() => null), // null = migrasi 0006 belum dijalankan
      api.ras(), api.mitigasiAksi(), // aksi null = migrasi 0008 belum dijalankan
      api.rkapAktif().catch(() => null),
    ]);
    return { register, kategori, drivers, kriteria, t3: groupT3(tax), popts: paramOptions(params, tambahan), ebitda: ebitdaRkap(params), sasaran, ras, aksi, rkap };
  });
  const saver = useSaver();
  const ro = useReadonly();
  const [picker, setPicker] = useState<RiskRegister | null>(null);
  const [ai, setAi] = useState<RiskRegister | null>(null);
  /** Isu kualitas yang sedang diperbaiki dengan AI; null = mode isi biasa. */
  const [aiIsu, setAiIsu] = useState<Isu[] | null>(null);
  const [usulan, setUsulan] = useState(false);
  const [filter, setFilter] = useState("");
  const [filterSasaran, setFilterSasaran] = useState("");
  const [search, setSearch] = useState("");
  const [hanyaIsu, setHanyaIsu] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  /** id risiko yang rencana aksinya sedang dibuka. */
  const [aksiBuka, setAksiBuka] = useState<string | null>(null);
  const [relevansi, setRelevansi] = useState<HasilRelevansi | null>(null);
  /** Modal Cek Relevansi: undefined = tertutup, string = dibuka terfokus pada risiko itu. */
  const [cekRelevansi, setCekRelevansi] = useState<string | null | undefined>(undefined);
  const [redundansi, setRedundansi] = useState<HasilRedundansi | null>(null);
  /** Modal Cek Redundansi: undefined = tertutup, string = dibuka terfokus pada kelompok berisi risiko itu. */
  const [cekRedundansi, setCekRedundansi] = useState<string | null | undefined>(undefined);
  useEffect(() => { setRelevansi(bacaRelevansi()); setRedundansi(bacaRedundansi()); }, []);
  const d = q.data;

  const aksiPer = useMemo(() => {
    const m = new Map<string, MitigasiAksi[]>();
    for (const a of d?.aksi ?? []) m.set(a.risk_id, [...(m.get(a.risk_id) ?? []), a]);
    return m;
  }, [d]);
  /** Saran kategori dampak, ringkasan target residual, dan isu kualitas per baris, dihitung ulang setiap data berubah. */
  const mutu = useMemo(() => {
    const m = new Map<string, { saran: SaranDampak | null; target: RingkasTarget | null; isu: Isu[] }>();
    for (const r of d?.register ?? []) {
      const kriteria = cariKriteria(d!.kriteria, r);
      const saran = saranDampak(r, kriteria, d!.ebitda);
      const aksi = aksiPer.get(r.id) ?? [];
      const target = d!.aksi ? ringkasTarget(r, aksi, d!.ras) : null;
      m.set(r.id, { saran, target, isu: [...cekKualitas(r, saran, aksi.some((a) => a.pic?.trim() && a.jadwal.length)), ...(target?.isu ?? [])] });
    }
    return m;
  }, [d, aksiPer]);
  /** Saran kategori dampak target dari kriteria berbasis EBITDA (besaran di Deskripsi Dampak hanya berlaku untuk inheren). */
  const saranTarget = (r: RiskRegister) => r.target_nilai_dampak == null ? null
    : saranDampak({ ...r, nilai_dampak: r.target_nilai_dampak, deskripsi_dampak: null }, cariKriteria(d!.kriteria, r), d!.ebitda);
  const jumlahIsu = [...mutu.values()].filter((x) => x.isu.length).length;

  const rows = useMemo(() => (d?.register ?? []).filter((r) =>
    (!filter || r.kategori === filter) && (!filterSasaran || (r.sasaran_strategis ?? []).includes(filterSasaran)) && (!hanyaIsu || !!mutu.get(r.id)?.isu.length) &&
    (!search || [r.risk_event, r.deskripsi, r.root_cause, r.rencana_mitigasi].some((x) => (x ?? "").toLowerCase().includes(search.toLowerCase())))), [d, filter, filterSasaran, search, hanyaIsu, mutu]);

  const patch = (id: string, p: Partial<RiskRegister>) => {
    q.setData({ ...d!, register: d!.register.map((r) => (r.id === id ? { ...r, ...p } : r)) });
    saver.run(() => api.update<RiskRegister>("risk_register", "id", id, { ...p, updated_at: new Date().toISOString() } as Partial<RiskRegister>));
  };
  const add = () => saver.run(async () => {
    const urutan = Math.max(0, ...d!.register.map((r) => r.urutan)) + 1;
    const row = await api.insert<RiskRegister>("risk_register", { urutan, kategori: filter || null });
    q.setData({ ...d!, register: [...d!.register, row] });
  });
  const del = async (r: RiskRegister) => {
    if (!(await konfirmasi({ judul: "Hapus risiko?", objek: r.risk_event ?? "Risiko tanpa nama", pesan: "Seluruh isian baris ini (dampak, kontrol, mitigasi, dan kaitan) ikut terhapus dan tidak bisa dibatalkan." }))) return;
    q.setData({ ...d!, register: d!.register.filter((x) => x.id !== r.id) });
    saver.run(() => api.remove("risk_register", "id", r.id));
  };
  const tambahAksi = (risk_id: string, list: Partial<MitigasiAksi>[]) => saver.run(async () => {
    let urutan = Math.max(0, ...(aksiPer.get(risk_id) ?? []).map((a) => a.urutan));
    const baru: MitigasiAksi[] = [];
    for (const a of list) baru.push(await api.insert<MitigasiAksi>("mitigasi_aksi", { ...a, risk_id, urutan: ++urutan }));
    q.setData((x) => x && { ...x, aksi: [...(x.aksi ?? []), ...baru] });
  });
  const ubahAksi = (id: string, p: Partial<MitigasiAksi>) => {
    q.setData((x) => x && { ...x, aksi: (x.aksi ?? []).map((a) => (a.id === id ? { ...a, ...p } : a)) });
    saver.run(() => api.update<MitigasiAksi>("mitigasi_aksi", "id", id, { ...p, updated_at: new Date().toISOString() } as Partial<MitigasiAksi>));
  };
  const hapusAksi = (id: string) => {
    q.setData((x) => x && { ...x, aksi: (x.aksi ?? []).filter((a) => a.id !== id) });
    saver.run(() => api.remove("mitigasi_aksi", "id", id));
  };
  const pick = (o: T3Option) => {
    if (!picker) return;
    patch(picker.id, { kategori: o.kategori, risk_event: o.risiko_korporat, deskripsi: o.definisi, taksonomi_kode: o.kode,
      ...(picker.kategori !== o.kategori ? { risk_driver: null, kriteria_dampak: null } : {}) });
    setPicker(null);
  };

  // Ukur lebar kolom No agar kolom Risk Event beku tepat di sebelahnya.
  const tableRef = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const t = tableRef.current;
    if (!t) return;
    const ukur = () => t.style.setProperty("--fz-event", `${t.querySelector<HTMLElement>("th.fz-no")?.offsetWidth ?? 0}px`);
    ukur();
    const obs = new ResizeObserver(ukur);
    obs.observe(t);
    return () => obs.disconnect();
  }, [d]);

  const label = (kode: string[] | null | undefined, opts: { kode: string; nama: string }[]) =>
    (kode ?? []).map((k) => { const o = opts.find((x) => x.kode === k); return o ? `${k} ${o.nama}` : k; });
  const risikoMitigasi = (r: RiskRegister) => ({
    ...ringkasRisiko(r), existing_control: r.existing_control, kategori_mitigasi: r.kategori_mitigasi,
    parameter_ram_terkait: label(r.parameter_ram, d!.popts.map((o) => ({ kode: o.kode, nama: o.parameter }))),
    sasaran_strategis_terkait: label(r.sasaran_strategis, d!.sasaran ?? []),
  });

  /** Risiko korporat taksonomi yang belum ada di register: kandidat usulan AI. */
  const kandidat = useMemo(() => {
    if (!d) return [];
    const ada = new Set(d.register.flatMap((r) => [r.taksonomi_kode, r.risk_event?.toLowerCase()]).filter(Boolean));
    return d.t3.filter((o) => !ada.has(o.kode) && !ada.has(o.risiko_korporat.toLowerCase()))
      .map((o) => ({ kode: o.kode, kategori: o.kategori, aspek: o.aspek, risiko_korporat: o.risiko_korporat, definisi: o.definisi.slice(0, 300) }));
  }, [d]);
  /** Konteks RKAP dimuat saat diminta saja, agar halaman tidak menunggu data yang jarang dipakai. */
  const muatKonteks = async () => {
    const [sampul, rkap, program] = await Promise.all([
      api.sampul().catch(() => null), api.rkapAktif().catch(() => null), api.program().catch(() => []),
    ]);
    const pos = rkap ? Object.fromEntries(POS.filter((p) => rkap.data.pos[p.kode]?.tahun != null).map((p) => [p.label, rkap.data.pos[p.kode].tahun!])) : null;
    return { sampul, pos, program };
  };
  const buatRelevansiRequest = async (): Promise<RelevansiRequest> => {
    const { sampul, pos, program } = await muatKonteks();
    return {
      entitas: sampul?.nama_entitas || "PT KINRA",
      konteks: {
        keuangan_rkap_2027: pos ?? "(belum ada Data Keuangan RKAP aktif)",
        sasaran: (d!.sasaran ?? []).map((s) => ({ kode: s.kode, pilar: s.pilar, nama: s.nama, target: s.target })),
        program: program.filter((p) => p.nama).map((p) => ({ pilar: p.pilar, nama: p.nama, inisiatif_rjpp: p.inisiatif_rjpp, deskripsi: p.deskripsi })),
      },
      risiko: d!.register.filter((r) => r.risk_event).map((r) => ({
        id: r.id, no: d!.register.indexOf(r) + 1, kategori: r.kategori, taksonomi_kode: r.taksonomi_kode, risk_driver: r.risk_driver,
        risk_event: r.risk_event, deskripsi: r.deskripsi, root_cause: r.root_cause, deskripsi_dampak: r.deskripsi_dampak,
        nilai_dampak: r.nilai_dampak, kategori_dampak: r.kategori_dampak,
        sasaran_terkait: label(r.sasaran_strategis, d!.sasaran ?? []),
        parameter_ram_terkait: label(r.parameter_ram, d!.popts.map((o) => ({ kode: o.kode, nama: o.parameter }))),
        sidik: sidikRisiko(r),
      })),
    };
  };
  /** Pakai usulan deskripsi AI: simpan ke register dan tandai penilaiannya sudah ditindaklanjuti (bukan usang). */
  const pakaiDeskripsi = (id: string, deskripsi: string) => {
    const r = d!.register.find((x) => x.id === id);
    if (!r || !relevansi) return;
    patch(id, { deskripsi });
    const h = { ...relevansi, penilaian: relevansi.penilaian.map((p) => (p.id === id ? { ...p, diterapkan: true, sidik: sidikRisiko({ ...r, deskripsi }) } : p)) };
    setRelevansi(h); simpanRelevansi(h);
  };
  const buatRedundansiRequest = async (): Promise<RedundansiRequest> => ({
    entitas: (await api.sampul().catch(() => null))?.nama_entitas || "PT KINRA",
    risiko: d!.register.filter((r) => r.risk_event).map((r) => ({
      id: r.id, no: d!.register.indexOf(r) + 1, kategori: r.kategori, taksonomi_kode: r.taksonomi_kode, risk_driver: r.risk_driver,
      risk_event: r.risk_event, deskripsi: r.deskripsi, root_cause: r.root_cause, deskripsi_dampak: r.deskripsi_dampak,
      existing_control: r.existing_control, rencana_mitigasi: r.rencana_mitigasi, sidik: sidikRisiko(r),
    })),
  });
  /** Eksekusi opsi tindakan redundansi sekaligus: ubah isian anggota, hapus yang digabung, lalu tandai kelompok diterapkan. */
  const terapkanRedundansi = async (k: KelompokRedundan, o: OpsiTindakan) => {
    const no = (id: string) => `#${d!.register.findIndex((r) => r.id === id) + 1}`;
    const ok = await konfirmasi({
      judul: "Terapkan saran redundansi?", objek: o.label, aksi: "Terapkan", nada: o.hapus.length ? "bahaya" : "peringatan",
      pesan: <>
        {o.penjelasan}
        {o.ubah.length > 0 && <div className="mt-2">Isian diubah: {o.ubah.map((u) => no(u.id)).join(", ")}.</div>}
        {o.hapus.length > 0 && <div className="mt-1 font-semibold text-rose-700">Dihapus permanen: {o.hapus.map(no).join(", ")}.</div>}
      </>,
    });
    if (!ok) return;
    const ubah = new Map(o.ubah.map((u) => [u.id, isianUbah(u)]));
    const register = d!.register.filter((r) => !o.hapus.includes(r.id)).map((r) => (ubah.has(r.id) ? { ...r, ...ubah.get(r.id) } : r));
    q.setData({ ...d!, register });
    const now = new Date().toISOString();
    for (const [id, p] of ubah) saver.run(() => api.update<RiskRegister>("risk_register", "id", id, { ...p, updated_at: now } as Partial<RiskRegister>));
    for (const id of o.hapus) saver.run(() => api.remove("risk_register", "id", id));
    const baru = new Map(register.map((r) => [r.id, r]));
    const h = { ...redundansi!, kelompok: redundansi!.kelompok.map((x) => (x !== k ? x : {
      ...x, diterapkan: o.label, sidik: Object.fromEntries(x.ids.map((id) => [id, baru.has(id) ? sidikRisiko(baru.get(id)!) : x.sidik[id]])),
    })) };
    setRedundansi(h); simpanRedundansi(h);
  };
  /** Keterkaitan RKAP 2027 (arahan 2a): AI mengusulkan proses bisnis, pos RKAP, dan program kerja untuk risiko yang belum terisi. */
  const [isiRkap, setIsiRkap] = useState(false);
  const belumRkap = (d?.register ?? []).filter((r) => r.risk_event && !(r.proses_bisnis ?? []).length && !(r.pos_rkap ?? []).length && !r.program_kerja_rkap?.trim());
  const isiKeterkaitan = async () => {
    const target = belumRkap;
    if (!target.length) return;
    if (!(await konfirmasi({ judul: `Isi Keterkaitan RKAP untuk ${target.length} risiko?`, aksi: "Susun Draf", nada: "info",
      pesan: "AI mengusulkan Proses Bisnis, Pos/Target RKAP 2027, dan Program Kerja/Asumsi RKAP dari data risiko, Data Keuangan RKAP, dan asumsi pada Presentasi DKMR. Hanya risiko yang ketiga kolomnya masih kosong yang diisi. Periksa hasilnya di tabel." }))) return;
    setIsiRkap(true);
    try {
      const req: KeterkaitanRequest = {
        risiko: target.map((r) => ({ id: r.id, kategori: r.kategori, risk_event: r.risk_event, deskripsi: r.deskripsi, root_cause: r.root_cause, deskripsi_dampak: r.deskripsi_dampak,
          sasaran: (r.sasaran_strategis ?? []).map((k) => { const o = d!.sasaran?.find((x) => x.kode === k); return o ? `${k} ${o.nama}` : k; }) })),
        pos: POS_PILIHAN.map((p) => ({ kode: p.kode, label: labelPos(p.kode, d!.rkap) })),
      };
      const res = await fetch("/api/keterkaitan-rkap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const now = new Date().toISOString();
      const saran = new Map((body as KeterkaitanResponse).hasil.map((h) => [h.id, { proses_bisnis: h.proses_bisnis, pos_rkap: h.pos_rkap, program_kerja_rkap: h.program_kerja_rkap }]));
      q.setData((prev) => prev && { ...prev, register: prev.register.map((r) => (saran.has(r.id) ? { ...r, ...saran.get(r.id) } : r)) });
      for (const [id, p] of saran) saver.run(() => api.update<RiskRegister>("risk_register", "id", id, { ...p, updated_at: now } as Partial<RiskRegister>));
    } catch (e) { alert(`Gagal menyusun keterkaitan RKAP: ${(e as Error).message}`); }
    setIsiRkap(false);
  };
  /** Dasar penilaian probabilitas & dampak (arahan 2f): AI menyusun historis, proyeksi RKAP, dan skenario untuk baris yang masih kosong. */
  const [isiDasar, setIsiDasar] = useState(false);
  const belumDasar = (d?.register ?? []).filter((r) => r.risk_event && r.probabilitas != null && !r.dasar_penilaian?.trim());
  const isiDasarPenilaian = async () => {
    const target = belumDasar;
    if (!target.length) return;
    if (!(await konfirmasi({ judul: `Isi Dasar Penilaian untuk ${target.length} risiko?`, aksi: "Susun Draf", nada: "info",
      pesan: "AI menyusun dasar probabilitas dan dampak (historis, proyeksi RKAP 2027, skenario ringan/dasar/berat) dari Renstra, Presentasi DKMR, dan Data Keuangan RKAP. Angka yang tercatat tidak diubah; selisih besar ditandai ⚠. Histori yang tidak tersedia ditulis sebagai [perlu dilengkapi]." }))) return;
    setIsiDasar(true);
    try {
      const rp = (v: number | null | undefined) => (v == null ? null : `Rp${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`);
      const rkap: Record<string, string> = {};
      if (d!.rkap) {
        for (const p of POS) { const v = d!.rkap.data.pos[p.kode]?.tahun; if (v != null) rkap[p.label] = rp(v)!; }
        for (const [k, v] of Object.entries(angkaKas(d!.rkap.data))) if (v != null) rkap[k] = rp(v)!;
      }
      const req: DasarPenilaianRequest = {
        rkap,
        risiko: target.map((r) => ({ id: r.id, no: d!.register.indexOf(r) + 1, kategori: r.kategori, risk_event: r.risk_event, deskripsi: r.deskripsi, root_cause: r.root_cause,
          probabilitas: r.probabilitas, nilai_dampak: r.nilai_dampak, deskripsi_dampak: r.deskripsi_dampak, kriteria_dampak: r.kriteria_dampak, kategori_dampak: r.kategori_dampak,
          pos_rkap: (r.pos_rkap ?? []).map((k) => labelPos(k, d!.rkap)), program_kerja_rkap: r.program_kerja_rkap ?? null })),
      };
      const res = await fetch("/api/dasar-penilaian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? res.statusText);
      const now = new Date().toISOString();
      const saran = new Map((body as DasarPenilaianResponse).hasil.map((h) => [h.id, h.dasar_penilaian]));
      q.setData((prev) => prev && { ...prev, register: prev.register.map((r) => (saran.has(r.id) ? { ...r, dasar_penilaian: saran.get(r.id) } : r)) });
      for (const [id, v] of saran) saver.run(() => api.update<RiskRegister>("risk_register", "id", id, { dasar_penilaian: v, updated_at: now } as Partial<RiskRegister>));
    } catch (e) { alert(`Gagal menyusun dasar penilaian: ${(e as Error).message}`); }
    setIsiDasar(false);
  };
  /** Kelompok redundan per risiko, urut dari jenis terberat (Duplikat lebih dulu). */
  const kelompokRedundan = useMemo(() => {
    const m = new Map<string, KelompokRedundan[]>();
    for (const k of redundansi?.kelompok ?? []) for (const id of k.ids) m.set(id, [...(m.get(id) ?? []), k]);
    const bobot = (k: KelompokRedundan) => JENIS_REDUNDAN.indexOf(k.jenis);
    for (const l of m.values()) l.sort((x, y) => bobot(x) - bobot(y));
    return m;
  }, [redundansi]);
  const nilaiRelevansi = useMemo(() => new Map((relevansi?.penilaian ?? []).map((p) => [p.id, p])), [relevansi]);

  const buatUsulanRequest = async (instruksi: string): Promise<UsulanRisikoRequest> => {
    const { sampul, pos, program } = await muatKonteks();
    return {
      entitas: sampul?.nama_entitas || "PT KINRA", instruksi, kandidat,
      sasaran: (d!.sasaran ?? []).map((s) => ({ kode: s.kode, pilar: s.pilar, nama: s.nama, target: s.target })),
      rkap: {
        keuangan_rp_tahun_2027: pos ?? "(belum ada Data Keuangan RKAP aktif)",
        program_strategis: program.filter((p) => p.nama).map((p) => ({ pilar: p.pilar, nama: p.nama, inisiatif_rjpp: p.inisiatif_rjpp, deskripsi: p.deskripsi })),
      },
      register: d!.register.filter((r) => r.risk_event).map((r) => ({ risk_event: r.risk_event, root_cause: r.root_cause })),
      celah: relevansi?.celah ?? [],
    };
  };
  const tambahUsulan = async (list: UsulanRisiko[]) => {
    let urutan = Math.max(0, ...d!.register.map((r) => r.urutan));
    const baru: RiskRegister[] = [];
    for (const u of list) {
      const t = d!.t3.find((o) => o.kode === u.kode);
      if (!t) continue;
      baru.push(await api.insert<RiskRegister>("risk_register", {
        urutan: ++urutan, kategori: t.kategori, risk_event: t.risiko_korporat, taksonomi_kode: t.kode,
        deskripsi: u.deskripsi, root_cause: u.root_cause, deskripsi_dampak: u.deskripsi_dampak,
        ...(d!.sasaran && u.sasaran.length ? { sasaran_strategis: u.sasaran } : {}),
      }));
    }
    q.setData({ ...d!, register: [...d!.register, ...baru] });
  };

  const bukaAi = (r: RiskRegister, isu: Isu[] | null = null) => {
    if (!r.risk_event) { alert("Pilih Risk Event dari taksonomi terlebih dahulu, agar AI punya dasar penyusunan."); return; }
    setAi(r); setAiIsu(isu);
  };
  /** Isu yang bisa diperbaiki AI (kolom teks); isu angka, target, dan rencana aksi tetap diisi manual. */
  const KOLOM_AI: Record<string, string[]> = {
    "Root Cause": ["root_cause"], "Deskripsi Dampak": ["deskripsi_dampak"], "Rencana Mitigasi": ["rencana_mitigasi", "kategori_mitigasi"],
  };
  const isuAi = (isu: Isu[]) => isu.filter((x) => KOLOM_AI[x.kolom]);
  const fieldsAi = (r: RiskRegister) => {
    const f = aiFields(r);
    if (!aiIsu) return f;
    const keys = new Set(aiIsu.flatMap((x) => KOLOM_AI[x.kolom] ?? []));
    return f.filter((x) => keys.has(x.key));
  };
  const aiFields = (r: RiskRegister): FieldSpec[] => {
    const drivers = d!.drivers.filter((x) => x.kategori === r.kategori).map((x) => x.driver);
    const krit = d!.kriteria.filter((x) => x.kategori === r.kategori).map((x) => `${x.kode}. ${x.kriteria}`);
    return [
      ...(drivers.length ? [{ key: "risk_driver", label: "Risk Driver", options: drivers }] : []),
      { key: "root_cause", label: "Root Cause" },
      { key: "deskripsi_dampak", label: "Deskripsi Dampak Risiko" },
      ...(krit.length ? [{ key: "kriteria_dampak", label: "Kriteria Dampak Acuan", options: krit }] : []),
      { key: "existing_control", label: "Existing Control" },
      { key: "rencana_mitigasi", label: "Rencana Mitigasi" },
      { key: "kategori_mitigasi", label: "Kategori Mitigasi", options: KATEGORI_MITIGASI },
    ];
  };
  const aiKonteks = (r: RiskRegister) => ({
    kategori: r.kategori, definisi_kategori: d!.kategori.find((k) => k.nama === r.kategori)?.definisi,
    taksonomi_kode: r.taksonomi_kode, risk_event: r.risk_event, deskripsi_risk_event: r.deskripsi,
    probabilitas: r.probabilitas, nilai_dampak_rp: r.nilai_dampak, kategori_dampak: r.kategori_dampak,
    parameter_ram_terkait: (r.parameter_ram ?? []).map((k) => { const o = d!.popts.find((x) => x.kode === k); return o ? `${k} ${o.parameter}` : k; }),
    sasaran_strategis_rjpp_terkait: (r.sasaran_strategis ?? []).map((k) => { const o = d!.sasaran?.find((x) => x.kode === k); return o ? `${k} ${o.nama}` : k; }),
    contoh_baris: {
      risk_event: "Penurunan harga CPO", root_cause: "Kelebihan pasokan minyak nabati global", deskripsi_dampak: "Penurunan marjin penjualan CPO",
      existing_control: "Kontrak penjualan berjangka", rencana_mitigasi: "Menambah porsi kontrak penjualan berharga tetap", kategori_mitigasi: "Preventive",
    },
  });

  const total = d?.register.length ?? 0;
  const top = d?.register.filter((r) => isTopRisk(r.kategori_dampak)).length ?? 0;
  const el = d?.register.reduce((a, r) => a + (elInheren(r) ?? 0), 0) ?? 0;
  const dampak = d?.register.reduce((a, r) => a + Number(r.nilai_dampak ?? 0), 0) ?? 0;
  const elT = d?.register.reduce((a, r) => a + (mutu.get(r.id)?.target?.elTarget ?? 0), 0) ?? 0;
  const biaya = (d?.aksi ?? []).reduce((a, x) => a + Number(x.biaya ?? 0), 0);
  const diAtasSelera = [...mutu.values()].filter((x) => x.target?.status === "Di atas selera").length;

  return (
    <SheetPage title="Risk Register RKAP 2027 - PT KINRA" code="Risk Register" note={note("Risk Register")} wide
      actions={<>{saver.indicator}<Button variant="outline" onClick={() => d && exportRegister(d.register, d.aksi)}><Download className="h-4 w-4" />Excel</Button><Button variant="outline" onClick={() => setCekRelevansi(null)} disabled={!d}><Compass className="h-4 w-4" />Cek Relevansi AI</Button><Button variant="outline" onClick={() => setCekRedundansi(null)} disabled={!d}><Copy className="h-4 w-4" />Cek Redundansi AI</Button><Button edit variant="outline" onClick={() => setUsulan(true)} disabled={!d}><Sparkles className="h-4 w-4" />Usulan Risiko AI</Button><Button edit onClick={add}><Plus className="h-4 w-4" />Tambah Risiko</Button></>}>
      {q.loading ? <Loading variant="stats-table" /> : q.error ? <ErrorBox error={q.error} /> : d && (
        <>
          <div className={clsx("mb-6 grid grid-cols-2 gap-3", d.aksi ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
            <Stat label="Risiko Korporat" value={total} accent="bg-brand-600" />
            <Stat label="Top Risk (Risiko Utama)" value={top} sub="Dampak Moderat ke atas" accent="bg-orange-500" />
            <Stat label="Total Nilai Dampak" value={rupiah(dampak, true)} accent="bg-sky-500" />
            <Stat label="Total Expected Loss" value={rupiah(el, true)} sub={d.aksi ? `Target residual ${rupiah(elT, true)}` : undefined} accent="bg-rose-500" />
            {d.aksi && <Stat label="Biaya Mitigasi RKAP 2027" value={rupiah(biaya, true)} sub={diAtasSelera ? `${diAtasSelera} target di atas selera risiko` : "Semua target dalam selera risiko"} accent="bg-violet-500" />}
          </div>
          <Section letter="A" title="Risk Register" right={
            <div className="flex flex-wrap gap-2">
              {!ro && belumDasar.length > 0 && (
                <button onClick={isiDasarPenilaian} disabled={isiDasar} title="Isi Dasar Penilaian Probabilitas & Dampak yang masih kosong dengan AI"
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12.5px] text-amber-900 disabled:opacity-60">
                  <Sparkles className="h-3.5 w-3.5" />{isiDasar ? "Menyusun dasar penilaian…" : `Isi Dasar Penilaian (${belumDasar.length})`}
                </button>
              )}
              {!ro && belumRkap.length > 0 && (
                <button onClick={isiKeterkaitan} disabled={isiRkap} title="Isi Proses Bisnis, Pos/Target RKAP, dan Program Kerja RKAP yang masih kosong dengan AI"
                  className="flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[12.5px] text-sky-900 disabled:opacity-60">
                  <Sparkles className="h-3.5 w-3.5" />{isiRkap ? "Menyusun keterkaitan RKAP…" : `Isi Keterkaitan RKAP (${belumRkap.length})`}
                </button>
              )}
              <button onClick={() => setHanyaIsu((x) => !x)} disabled={!jumlahIsu && !hanyaIsu}
                className={clsx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] disabled:opacity-50", hanyaIsu ? "border-amber-400 bg-amber-50 text-amber-900" : "border-line bg-white")}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Perlu perbaikan ({jumlahIsu})
              </button>
              <div className="relative">
                <Search className="absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…" className="w-52 rounded-lg border border-line bg-white py-1.5 pr-3 pl-8 text-[13px] outline-none focus:border-brand-500" />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-line bg-white px-2 text-[13px]">
                <option value="">Semua kategori</option>
                {d.kategori.map((k) => <option key={k.no}>{k.nama}</option>)}
              </select>
              {!!d.sasaran?.length && (
                <select value={filterSasaran} onChange={(e) => setFilterSasaran(e.target.value)} className="max-w-56 rounded-lg border border-line bg-white px-2 text-[13px]">
                  <option value="">Semua sasaran RJPP</option>
                  {d.sasaran.map((x) => <option key={x.kode} value={x.kode}>{x.kode} {x.nama}</option>)}
                </select>
              )}
            </div>}>
            <TableWrap stickyHeader>
              <table ref={tableRef} className="kk-table min-w-[3600px]">
                <thead><tr>
                  <th className="fz fz-no w-12">No</th>
                  <th className="w-40">Taksonomi Risiko</th><th className="w-48">Risk Driver</th><th className="fz fz-event fz-edge w-56">Risk Event</th>
                  <th className="w-72">Deskripsi Risk Event</th><th className="w-60">Root Cause</th><th className="w-24">Probabilitas Kejadian (0%-100%)</th>
                  <th className="w-52">Deskripsi Dampak Risiko</th><th className="w-40">Nilai Dampak Risiko (Rp)</th><th className="w-52">Kriteria Dampak Acuan</th>
                  <th className="w-32">Kategori Dampak Risiko</th><th className="w-20">Tagging Top Risk</th><th className="w-40">Expected Loss (Rp)</th>
                  <th className="w-64">Dasar Penilaian Probabilitas & Dampak</th>
                  <th className="w-56">Existing Control</th><th className="w-56">Rencana Mitigasi</th><th className="w-32">Kategori Mitigasi</th>
                  <th className="w-24 !bg-brand-800">Target Probabilitas</th><th className="w-40 !bg-brand-800">Target Nilai Dampak (Rp)</th>
                  <th className="w-44 !bg-brand-800">Target Kategori Dampak</th><th className="w-40 !bg-brand-800">Target Expected Loss (Rp)</th>
                  <th className="w-52">Parameter RAM Terkait</th><th className="w-52">Sasaran Strategis RJPP Terkait</th>
                  <th className="w-52 !bg-sky-800">Proses Bisnis</th><th className="w-60 !bg-sky-800">Pos / Target RKAP 2027 Terdampak</th><th className="w-64 !bg-sky-800">Program Kerja / Asumsi RKAP 2027</th><th className="w-12" />
                </tr></thead>
                <tbody>
                  <tr className="example">
                    <td className="fz fz-no">Contoh</td><td>Risiko Pasar</td><td>Perubahan harga komoditas</td><td className="fz fz-event fz-edge">Penurunan harga CPO</td><td>Harga CPO turun di bawah asumsi RKAP 2027.</td>
                    <td>Kelebihan pasokan minyak nabati global</td><td className="text-right">30%</td><td>Penurunan marjin penjualan CPO</td><td className="text-right">450.000.000.000</td>
                    <td>b. Dampak perubahan harga komoditas terhadap penurunan margin</td><td>Moderat</td><td>Ya</td><td className="text-right">135.000.000.000</td>
                    <td>Kontrak penjualan berjangka</td><td>Menambah porsi kontrak penjualan berharga tetap</td><td>Preventive</td>
                    <td className="text-right">15%</td><td className="text-right">300.000.000.000</td><td>Rendah</td><td className="text-right">45.000.000.000</td><td>K1</td><td>SG-1</td><td />
                  </tr>
                  {rows.map((r, i) => {
                    const drivers = d.drivers.filter((x) => x.kategori === r.kategori).map((x) => x.driver);
                    const krit = d.kriteria.filter((x) => x.kategori === r.kategori).map((x) => `${x.kode}. ${x.kriteria}`);
                    const driverUnknown = r.risk_driver && !drivers.includes(r.risk_driver);
                    const el = r.probabilitas != null && r.nilai_dampak != null ? Number(r.probabilitas) * Number(r.nilai_dampak) : null;
                    const { saran, target, isu } = mutu.get(r.id) ?? { saran: null, target: null, isu: [] };
                    const aksi = aksiPer.get(r.id) ?? [];
                    const sT = target && saranTarget(r);
                    const kriteria = cariKriteria(d.kriteria, r);
                    const dampakSalah = !!saran && !!r.kategori_dampak && r.kategori_dampak !== saran.level;
                    return (
                      <Fragment key={r.id}>
                      <tr>
                        <td className="fz fz-no text-center font-semibold">
                          {i + 1}
                          {isu.length > 0 && (
                            <button onClick={() => setBuka(buka === r.id ? null : r.id)} title={isu.map((x) => `${x.kolom}: ${x.pesan}`).join("\n")}
                              className={clsx("mx-auto mt-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold", buka === r.id ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-800 hover:bg-amber-200")}>
                              <AlertTriangle className="h-3 w-3" />{isu.length}
                            </button>
                          )}
                        </td>
                        <td className="input"><SelectCell value={r.kategori} options={d.kategori.map((k) => k.nama)} onSave={(v) => patch(r.id, { kategori: v, risk_driver: null, kriteria_dampak: null })} /></td>
                        <td className={clsx("input", driverUnknown && "!bg-rose-100")}>
                          <SelectCell value={r.risk_driver} options={driverUnknown ? [r.risk_driver!, ...drivers] : drivers} placeholder={r.kategori ? "Pilih driver…" : "Pilih kategori dulu"} onSave={(v) => patch(r.id, { risk_driver: v })} />
                        </td>
                        <td className="input fz fz-event fz-edge">
                          <button onClick={() => !ro && setPicker(r)} disabled={ro} className="group flex w-full items-start gap-1.5 text-left">
                            <Library className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                            <span className={clsx("font-semibold group-hover:underline", !r.risk_event && "font-normal text-slate-400 italic")}>{r.risk_event ?? "Pilih dari taksonomi…"}</span>
                          </button>
                          {r.taksonomi_kode && <div className="mt-1 font-mono text-[10px] text-slate-400">{r.taksonomi_kode}</div>}
                          {nilaiRelevansi.has(r.id) && <RelevansiBadge p={nilaiRelevansi.get(r.id)!} usang={nilaiRelevansi.get(r.id)!.sidik !== sidikRisiko(r)} onClick={() => setCekRelevansi(r.id)} />}
                          {kelompokRedundan.has(r.id) && <RedundansiBadge kelompok={kelompokRedundan.get(r.id)!} id={r.id} onClick={() => setCekRedundansi(r.id)}
                            nomor={(id) => { const i = d.register.findIndex((x) => x.id === id); return i < 0 ? null : i + 1; }}
                            sidikKini={(id) => { const x = d.register.find((y) => y.id === id); return x ? sidikRisiko(x) : null; }} />}
                        </td>
                        <td className="input text-[12px]"><EditCell value={r.deskripsi} onSave={(v) => patch(r.id, { deskripsi: v as string })} /></td>
                        <td className="input"><EditCell value={r.root_cause} onSave={(v) => patch(r.id, { root_cause: v as string })} /></td>
                        <td className="input"><EditCell kind="percent" value={r.probabilitas} display={(v) => persen(v as number, 0)} onSave={(v) => patch(r.id, { probabilitas: v as number })} /></td>
                        <td className="input"><EditCell value={r.deskripsi_dampak} onSave={(v) => patch(r.id, { deskripsi_dampak: v as string })} /></td>
                        <td className="input"><EditCell kind="number" value={r.nilai_dampak} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { nilai_dampak: v as number })} /></td>
                        <td className="input"><SelectCell value={r.kriteria_dampak} options={krit} placeholder={r.kategori ? "Pilih kriteria…" : "Pilih kategori dulu"} onSave={(v) => patch(r.id, { kriteria_dampak: v })} /></td>
                        <td className={clsx("input", dampakSalah && "!bg-rose-100")}>
                          <SelectCell value={r.kategori_dampak} options={kriteria ? labelLevel(kriteria) : KATEGORI_DAMPAK} onSave={(v) => patch(r.id, { kategori_dampak: v })} />
                          {r.kategori_dampak && <div className="mt-1"><DampakBadge k={r.kategori_dampak} /></div>}
                          {saran && (
                            <div className="mt-1.5 text-[11px] leading-snug" title={saran.sumber}>
                              {r.kategori_dampak === saran.level ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />Sesuai kriteria ({saran.ukuran})</span>
                              ) : (
                                <>
                                  <span className={dampakSalah ? "font-semibold text-rose-700" : "text-slate-600"}>Sesuai kriteria: {saran.level}</span>
                                  <span className="text-slate-500"> ({saran.ukuran})</span>
                                  <button data-edit onClick={() => patch(r.id, { kategori_dampak: saran.level })} className="ml-1 font-semibold text-brand-700 hover:underline">pakai</button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={clsx("calc text-center font-bold", isTopRisk(r.kategori_dampak) ? "text-orange-700" : "text-slate-500")}>{r.kategori_dampak ? (isTopRisk(r.kategori_dampak) ? "Ya" : "Tidak") : ""}</td>
                        <td className="input">
                          <EditCell kind="number" value={r.expected_loss} placeholder={el != null ? `≈ ${rupiah(el).replace("Rp ", "")}` : "Opsional"} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { expected_loss: v as number })} />
                          {el != null && !(Number(r.expected_loss) > 0) && (
                            <button data-edit onClick={() => patch(r.id, { expected_loss: Math.round(el) })} className="mt-1 text-[11px] font-semibold text-brand-700 hover:underline"
                              title="Isi dengan probabilitas × nilai dampak">Isi ≈ {rupiah(el, true)}</button>
                          )}
                        </td>
                        <td className={clsx("input", !r.dasar_penilaian && r.probabilitas != null && "!bg-amber-50/70")}>
                          <EditCell value={r.dasar_penilaian} placeholder="Data historis, proyeksi RKAP 2027, analisis skenario…" onSave={(v) => patch(r.id, { dasar_penilaian: v as string })} />
                        </td>
                        <td className="input"><EditCell value={r.existing_control} onSave={(v) => patch(r.id, { existing_control: v as string })} /></td>
                        <td className="input">
                          <EditCell value={r.rencana_mitigasi} onSave={(v) => patch(r.id, { rencana_mitigasi: v as string })} />
                          {!ro && <MitigasiAi risiko={risikoMitigasi(r)} current={r.rencana_mitigasi} onApply={(rencana, kategori, mode) => patch(r.id, mode === "ganti"
                            ? { rencana_mitigasi: rencana, kategori_mitigasi: kategori }
                            : { rencana_mitigasi: `${r.rencana_mitigasi!.trim()}\n${rencana}`, kategori_mitigasi: r.kategori_mitigasi ?? kategori })} />}
                          {d.aksi && (
                            <button onClick={() => setAksiBuka(r.id)}
                              className={clsx("mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ring-1",
                                aksi.length ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-white text-slate-500 ring-line hover:ring-brand-500")}>
                              <ListChecks className="h-3 w-3" />{aksi.length ? `${aksi.length} rencana aksi · ${rupiah(target?.biaya ?? 0, true)}` : "Susun rencana aksi"}
                            </button>
                          )}
                        </td>
                        <td className="input"><SelectCell value={r.kategori_mitigasi} options={KATEGORI_MITIGASI} onSave={(v) => patch(r.id, { kategori_mitigasi: v })} /></td>
                        {target ? (
                          <>
                            <td className="input"><EditCell kind="percent" value={r.target_probabilitas ?? null} display={(v) => persen(v as number, 0)} onSave={(v) => patch(r.id, { target_probabilitas: v as number })} /></td>
                            <td className="input"><EditCell kind="number" value={r.target_nilai_dampak ?? null} display={(v) => rupiah(v as number).replace("Rp ", "")} onSave={(v) => patch(r.id, { target_nilai_dampak: v as number })} /></td>
                            <td className={clsx("input", target.status === "Di atas selera" && "!bg-rose-100")}>
                              <SelectCell value={r.target_kategori_dampak} options={kriteria ? labelLevel(kriteria) : KATEGORI_DAMPAK} onSave={(v) => patch(r.id, { target_kategori_dampak: v })} />
                              {r.target_kategori_dampak && <div className="mt-1"><DampakBadge k={r.target_kategori_dampak} /></div>}
                              {sT && r.target_kategori_dampak !== sT.level && (
                                <div className="mt-1 text-[11px] text-slate-600" title={sT.sumber}>
                                  Sesuai kriteria: {sT.level} <span className="text-slate-500">({sT.ukuran})</span>
                                  <button data-edit onClick={() => patch(r.id, { target_kategori_dampak: sT.level })} className="ml-1 font-semibold text-brand-700 hover:underline">pakai</button>
                                </div>
                              )}
                              {target.status && (
                                <div className={clsx("mt-1 text-[11px] font-semibold", target.status === "Dalam selera" ? "text-emerald-700" : "text-rose-700")}
                                  title={`Sikap RAS kategori ini: ${target.sikap}. Target paling tinggi yang dapat diterima: ${target.batas}.`}>
                                  {target.status === "Dalam selera" ? <Check className="mr-0.5 inline h-3 w-3" /> : <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                                  {target.status} ({target.sikap})
                                </div>
                              )}
                            </td>
                            <td className="calc text-right tabnum">
                              {target.elTarget != null ? rupiah(target.elTarget).replace("Rp ", "") : ""}
                              {target.elTarget != null && target.elInheren ? (
                                <div className={clsx("mt-0.5 text-[11px]", target.elTarget < target.elInheren ? "text-emerald-700" : "text-rose-700")}>
                                  {target.elTarget < target.elInheren ? "↓" : "↑"} {persen(Math.abs(1 - target.elTarget / target.elInheren), 0)} dari inheren
                                </div>
                              ) : null}
                            </td>
                          </>
                        ) : (
                          <td colSpan={4} className="text-[11px] text-slate-400 italic">Jalankan migrasi 0008_target_mitigasi.sql</td>
                        )}
                        <td className={clsx("input", !(r.parameter_ram ?? []).length && "!bg-amber-100/70")}>
                          <ParamPicker value={r.parameter_ram ?? []} options={d.popts} kategori={r.kategori} risiko={ringkasRisiko(r)} onSave={(v) => patch(r.id, { parameter_ram: v })} />
                        </td>
                        <td className={clsx("input", d.sasaran && !(r.sasaran_strategis ?? []).length && "!bg-amber-100/70")}>
                          {d.sasaran ? <SasaranPicker value={r.sasaran_strategis ?? []} options={d.sasaran} risiko={ringkasRisiko(r)} onSave={(v) => patch(r.id, { sasaran_strategis: v })} />
                            : <span className="text-[11px] text-slate-400 italic">Jalankan migrasi 0006_sasaran_strategis.sql</span>}
                        </td>
                        <td className={clsx("input", r.risk_event && !(r.proses_bisnis ?? []).length && "!bg-amber-100/70")}>
                          <PilihBanyak value={r.proses_bisnis ?? []} options={PROSES_BISNIS.map((p) => ({ value: p, label: p }))} kosong="Proses bisnis" onSave={(v) => patch(r.id, { proses_bisnis: v })} />
                        </td>
                        <td className={clsx("input", r.risk_event && !(r.pos_rkap ?? []).length && "!bg-amber-100/70")}>
                          <PilihBanyak value={r.pos_rkap ?? []} options={POS_PILIHAN.map((p) => ({ value: p.kode, label: labelPos(p.kode, d.rkap) }))} kosong="Pos RKAP"
                            label={(k) => labelPos(k, d.rkap)} onSave={(v) => patch(r.id, { pos_rkap: v })} />
                        </td>
                        <td className={clsx("input", r.risk_event && !r.program_kerja_rkap?.trim() && "!bg-amber-100/70")}>
                          <EditCell value={r.program_kerja_rkap ?? null} placeholder="Program kerja / asumsi RKAP 2027 terkait…" onSave={(v) => patch(r.id, { program_kerja_rkap: v as string })} />
                        </td>
                        <td><div className="flex flex-col items-center gap-2"><AiRowButton onClick={() => bukaAi(r)} /><button data-edit onClick={() => del(r)} className="text-slate-400 hover:text-rose-600" title="Hapus"><Trash2 className="h-4 w-4" /></button></div></td>
                      </tr>
                      {buka === r.id && isu.length > 0 && (
                        <tr>
                          <td colSpan={27} className="!bg-amber-50/70 !py-2">
                            <div className="sticky left-12 max-w-[900px] space-y-1 pl-2 text-[12px]">
                              {isu.map((x, j) => (
                                <div key={j} className="flex gap-2"><span className="w-36 shrink-0 font-semibold text-amber-900">{x.kolom}</span><span className="text-slate-700">{x.pesan}</span></div>
                              ))}
                              {saran && <div className="pt-1 text-[11px] text-slate-500">Dasar saran kategori dampak: {saran.sumber}.</div>}
                              {!ro && isuAi(isu).length > 0 && (
                                <div className="flex flex-wrap items-center gap-3 pt-1.5">
                                  <Button variant="outline" onClick={() => bukaAi(r, isuAi(isu))} className="!py-1 !text-[12px]">
                                    <Sparkles className="h-3.5 w-3.5" />Perbaiki dengan AI ({[...new Set(isuAi(isu).map((x) => x.kolom))].join(", ")})
                                  </Button>
                                  {isuAi(isu).length < isu.length && <span className="text-[11px] text-slate-500">Isu angka, target residual, dan rencana aksi diisi manual.</span>}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={27} className="py-10 text-center text-slate-400">Belum ada risiko. Klik “Tambah Risiko”.</td></tr>}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          {ai && (
            <AiFillModal jenis="risiko" subjek={`Risiko #${d.register.indexOf(ai) + 1} ${ai.risk_event}`} fields={fieldsAi(ai)} nilai={ai}
              konteks={{ ...aiKonteks(ai), ...(aiIsu && { catatan_pemeriksaan_kualitas: aiIsu.map((x) => `${x.kolom}: ${x.pesan}`), deskripsi_dampak_saat_ini: ai.deskripsi_dampak, root_cause_saat_ini: ai.root_cause, existing_control: ai.existing_control }) }}
              judul={aiIsu ? "Perbaiki dengan AI" : undefined}
              instruksiAwal={aiIsu ? `Perbaiki isian berikut sesuai catatan pemeriksaan kualitas, tanpa mengubah maksud risikonya:\n${aiIsu.map((x) => `- ${x.kolom}: ${x.pesan}`).join("\n")}` : undefined}
              onApply={(p) => patch(ai.id, p)} onClose={() => { setAi(null); setAiIsu(null); }}
              placeholder="Contoh: Risiko ini muncul karena pasokan TBS dari kebun plasma sering terlambat saat musim hujan. Saat ini sudah ada kontrak pasokan dan monitoring harian." />
          )}
          {usulan && (
            <UsulanRisikoModal kandidat={kandidat} buatRequest={buatUsulanRequest} onTambah={tambahUsulan} onClose={() => setUsulan(false)}
              namaSasaran={(k) => d.sasaran?.find((s) => s.kode === k)?.nama} celah={relevansi?.celah ?? []}
              onCekRelevansi={() => { setUsulan(false); setCekRelevansi(null); }} />
          )}
          {cekRelevansi !== undefined && (
            <RelevansiAiModal hasil={relevansi} onHasil={setRelevansi} buildRequest={buatRelevansiRequest} fokus={cekRelevansi} ro={ro}
              nomor={(id) => { const i = d.register.findIndex((r) => r.id === id); return i < 0 ? null : { no: i + 1, nama: d.register[i].risk_event ?? "" }; }}
              sidikKini={(id) => { const r = d.register.find((x) => x.id === id); return r ? sidikRisiko(r) : null; }}
              onPakaiDeskripsi={pakaiDeskripsi} onClose={() => setCekRelevansi(undefined)} />
          )}
          {cekRedundansi !== undefined && (
            <RedundansiAiModal hasil={redundansi} onHasil={setRedundansi} buildRequest={buatRedundansiRequest} fokus={cekRedundansi} ro={ro}
              nomor={(id) => { const i = d.register.findIndex((r) => r.id === id); return i < 0 ? null : { no: i + 1, nama: d.register[i].risk_event ?? "" }; }}
              sidikKini={(id) => { const r = d.register.find((x) => x.id === id); return r ? sidikRisiko(r) : null; }}
              onHapus={(id) => { const r = d.register.find((x) => x.id === id); if (r) del(r); }} onTerapkan={terapkanRedundansi} onClose={() => setCekRedundansi(undefined)} />
          )}
          {aksiBuka && (() => {
            const r = d.register.find((x) => x.id === aksiBuka);
            const t = r && mutu.get(r.id)?.target;
            return r && t ? (
              <RencanaAksiModal judul={`Risiko #${d.register.indexOf(r) + 1} ${r.risk_event ?? ""}`} risiko={r} aksi={aksiPer.get(r.id) ?? []} ringkas={t} ro={ro}
                onTambah={(list) => tambahAksi(r.id, list)} onUbah={ubahAksi} onHapus={hapusAksi}
                onPakaiTeks={(teks) => patch(r.id, { rencana_mitigasi: teks })} onClose={() => setAksiBuka(null)} />
            ) : null;
          })()}
          {picker && <TaxonomyPicker options={d.t3} kategori={picker.kategori} current={picker.risk_event} onPick={pick} onClose={() => setPicker(null)} />}
        </>
      )}
    </SheetPage>
  );
}
