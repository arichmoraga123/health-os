import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminEmail } from "@/lib/admin";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdminRoute) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const email = token.email as string | undefined;
  if (!isAdminEmail(email)) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return new NextResponse("Forbidden — admin access only", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
