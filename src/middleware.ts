import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/api/auth/login"];

/** Semua halaman, data templat, dan API wajib login kecuali halaman login itu sendiri. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = PUBLIC.includes(pathname);
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
    }
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(to);
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session && pathname === "/login") {
    const to = req.nextUrl.clone();
    to.pathname = "/"; to.search = "";
    return NextResponse.redirect(to);
  }
  return NextResponse.next();
}

export const config = {
  // Aset statis Next dan logo dibiarkan publik agar halaman login tampil; public/templates tetap butuh login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|kinra-mark.png|kinra-logo.png).*)"],
};
