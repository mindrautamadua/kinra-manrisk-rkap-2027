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

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-brand-900 px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kinra-mark.png" alt="KINRA" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-wide text-white">KINRA <span className="font-medium text-brand-200/70">Sei Mangkei</span></div>
            <div className="text-[12px] font-medium text-brand-200/70">Manajemen Risiko · RKAP 2027</div>
          </div>
        </div>
        <div className="rounded-2xl bg-paper p-6 shadow-xl">
          <h1 className="text-[18px] font-bold text-ink">Masuk</h1>
          <p className="mt-1 mb-5 text-[12.5px] text-slate-500">Gunakan akun yang diberikan administrator.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
        <p className="mt-5 text-center text-[11px] text-brand-200/50">Akses terbatas untuk pengguna PT KINRA yang berwenang.</p>
      </div>
    </div>
  );
}
