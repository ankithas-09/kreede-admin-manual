import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "admin_token";

if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

// Keep options minimal so we don't rely on external typings in CI
type MinimalSignOptions = { expiresIn?: string | number };

export function signToken(
  payload: Record<string, unknown>,
  options: MinimalSignOptions = { expiresIn: "7d" }
) {
  // Use `any` at the call site only to avoid importing types from jsonwebtoken.
  return (jwt as any).sign(payload, JWT_SECRET, options) as string;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    return ((jwt as any).verify(token, JWT_SECRET) as unknown) as T;
  } catch {
    return null;
  }
}

export const authCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
};
