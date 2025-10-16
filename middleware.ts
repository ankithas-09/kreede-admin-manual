// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "admin_token";
const RAW_SECRET = process.env.JWT_SECRET || "";

// Edge-safe verify using `jose`
async function verifyJWT(token: string) {
  if (!RAW_SECRET) return null;
  try {
    const secret = new TextEncoder().encode(RAW_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload; // { sub, email, name, iat, exp, ... }
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect these paths
  const protectedPaths = ["/dashboard", "/admin"];
  const isProtected =
    protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyJWT(token) : null;

  if (!payload) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/admin/:path*"],
};
