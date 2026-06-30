import { NextResponse, type NextRequest } from "next/server";

const DEVICE_COOKIE = "edu_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Ensure every visitor has a stable device id cookie before they ever sign in, so the device-trust
// session hook can read it (the hook must not set cookies itself). Set once on first visit.
// (Next 16 "proxy" convention - formerly "middleware".)
export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(DEVICE_COOKIE)?.value) {
    res.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"] };
