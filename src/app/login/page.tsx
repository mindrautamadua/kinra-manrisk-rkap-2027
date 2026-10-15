"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";

/** Hanya izinkan redirect ke path internal agar parameter ?next tidak bisa dipakai untuk open redirect. */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) { window.location.replace(safeNext(params.get("next"))); return; }
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Login gagal.");
      setPassword("");
    } catch { setError("Tidak dapat terhubung ke server."); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-600">Username</span>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required
            maxLength={64} autoCapitalize="none" spellCheck={false}
            className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-9 text-[14px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        </div>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-slate-600">Password</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required maxLength={256}
            className="w-full rounded-lg border border-line bg-white py-2.5 pr-10 pl-9 text-[14px] outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      {error && <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700 ring-1 ring-rose-200">{error}</div>}
      <button type="submit" disabled={busy || !username || !password}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}Masuk
      </button>
    </form>
  );
}

/** Warna sel matriks risiko 5x5 berdasarkan skor kemungkinan x dampak. */
function warnaSel(skor: number) {
  if (skor >= 15) return "#d9473b";
  if (skor >= 10) return "#e8862f";
  if (skor >= 5) return "#e8c547";
  return "#2f8a57";
}

// Posisi partikel tetap (bukan acak) agar render server dan klien sama.
const PARTIKEL = [
  { l: 6, s: 3, d: 14, t: 0 }, { l: 14, s: 2, d: 18, t: 4 }, { l: 23, s: 4, d: 16, t: 9 }, { l: 31, s: 2, d: 20, t: 2 },
  { l: 42, s: 3, d: 15, t: 7 }, { l: 51, s: 2, d: 22, t: 11 }, { l: 60, s: 3, d: 17, t: 5 }, { l: 68, s: 2, d: 19, t: 1 },
  { l: 77, s: 4, d: 21, t: 8 }, { l: 85, s: 2, d: 16, t: 3 }, { l: 93, s: 3, d: 18, t: 12 }, { l: 38, s: 2, d: 24, t: 14 },
];

function LatarAnimasi() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#175636_0%,#0c2a1c_45%,#07190f_100%)]" />
      <div className="login-blob a top-[-10%] left-[-10%] h-[55vh] w-[55vh] bg-[#2f8a57]/45" />
      <div className="login-blob b right-[-12%] bottom-[-15%] h-[65vh] w-[65vh] bg-[#1f6e43]/50" />
      <div className="login-blob c top-[30%] left-[35%] h-[40vh] w-[40vh] bg-[#c9a227]/15" />
      <div className="login-grid absolute inset-0" />
      {PARTIKEL.map((p, i) => (
        <span key={i} className="login-dot" style={{ left: `${p.l}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `-${p.t}s` }} />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/.45)_100%)]" />
    </div>
  );
}

/** Visual dekoratif: matriks risiko 5x5 dan tren parameter terhadap threshold. */
function VisualRisiko() {
  return (
    <div className="login-float relative w-full max-w-[460px]">
      <div className="login-scan relative overflow-hidden rounded-2xl border border-white/10 bg-white/[.04] p-5 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-[0.18em] text-brand-200/80 uppercase">Peta Risiko 2027</div>
          <div className="flex items-center gap-1.5 text-[11px] text-brand-200/70">
            <span className="relative flex h-2 w-2"><span className="login-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            RKAP 2027
          </div>
        </div>
        <div className="flex gap-5">
          <div className="grid shrink-0 grid-cols-5 gap-1.5">
            {Array.from({ length: 25 }, (_, i) => {
              const kemungkinan = 5 - Math.floor(i / 5), dampak = (i % 5) + 1;
              return (
                <div key={i} className="login-cell h-7 w-7 rounded-md" style={{ background: warnaSel(kemungkinan * dampak), animationDelay: `${((i * 7) % 25) * 0.13}s` }} />
              );
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <svg viewBox="0 0 200 110" className="w-full overflow-visible">
              <line x1="0" x2="200" y1="22" y2="22" stroke="#d9473b" strokeOpacity=".7" strokeDasharray="4 4" />
              <line x1="0" x2="200" y1="44" y2="44" stroke="#e8862f" strokeOpacity=".7" strokeDasharray="4 4" />
              <line x1="0" x2="200" y1="66" y2="66" stroke="#e8c547" strokeOpacity=".7" strokeDasharray="4 4" />
              <text x="200" y="18" textAnchor="end" fontSize="7" fill="#f3b3ad">Limit</text>
              <text x="200" y="40" textAnchor="end" fontSize="7" fill="#f5c79d">Tolerance</text>
              <text x="200" y="62" textAnchor="end" fontSize="7" fill="#f2e2a3">Appetite</text>
              <path d="M0 95 C 20 92, 30 70, 50 74 S 80 92, 100 80 S 130 50, 150 60 S 180 84, 200 76 L 200 110 L 0 110 Z" fill="url(#login-area)" opacity=".5" />
              <path className="login-draw" pathLength={1} d="M0 95 C 20 92, 30 70, 50 74 S 80 92, 100 80 S 130 50, 150 60 S 180 84, 200 76" fill="none" stroke="#a9d3b8" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="200" cy="76" r="3.5" fill="#a9d3b8"><animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" /></circle>
              <defs><linearGradient id="login-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2f8a57" /><stop offset="1" stopColor="#2f8a57" stopOpacity="0" /></linearGradient></defs>
            </svg>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Identifikasi", "Register"], ["Ukur", "RAM"], ["Selaraskan", "RJPP"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[.06] px-2 py-1.5 ring-1 ring-white/10">
                  <div className="text-[13px] font-bold text-white">{v}</div>
                  <div className="truncate text-[9.5px] font-medium text-brand-200/60">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-900">
      <LatarAnimasi />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-10">
        <div className="login-in hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-[11.5px] font-semibold text-brand-100 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9a227]" />Kawasan Industri Sei Mangkei
          </div>
          <h2 className="text-[40px] leading-[1.08] font-extrabold tracking-tight text-white">
            Kendalikan risiko,<br />
            <span className="bg-gradient-to-r from-brand-200 via-emerald-200 to-[#e9d27a] bg-clip-text text-transparent">wujudkan sasaran RKAP 2027.</span>
          </h2>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-brand-100/70">
            Kertas kerja perencanaan manajemen risiko terintegrasi: Risk Register, Risk Acceptance Matrix, dan keterkaitan Sasaran Strategis RJPP 2026–2030.
          </p>
          <div className="mt-8"><VisualRisiko /></div>
        </div>

        <div className="mx-auto w-full max-w-[400px]">
          <div className="login-in mb-6 flex items-center justify-center gap-3 lg:justify-start" style={{ animationDelay: ".1s" }}>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kinra-mark.png" alt="KINRA" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="text-[17px] font-bold tracking-wide text-white">KINRA <span className="font-medium text-brand-200/70">Sei Mangkei</span></div>
              <div className="text-[12px] font-medium text-brand-200/70">Manajemen Risiko · RKAP 2027</div>
            </div>
          </div>
          <div className="login-in relative rounded-2xl p-px shadow-2xl shadow-black/40" style={{ animationDelay: ".2s" }}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/40 via-white/5 to-[#c9a227]/40" />
            <div className="relative rounded-[15px] bg-paper/95 p-7 backdrop-blur-xl">
              <h1 className="text-[20px] font-bold text-ink">Selamat datang</h1>
              <p className="mt-1 mb-6 text-[12.5px] text-slate-500">Masuk dengan akun yang diberikan administrator.</p>
              <Suspense><LoginForm /></Suspense>
            </div>
          </div>
          <p className="login-in mt-5 text-center text-[11px] text-brand-200/50" style={{ animationDelay: ".3s" }}>Akses terbatas untuk pengguna PT KINRA yang berwenang.</p>
        </div>
      </div>
    </div>
  );
}
