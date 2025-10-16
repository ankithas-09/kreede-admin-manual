import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "admin_token";

if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

// Minimal local sign options (instead of importing SignOptions)
interface MinimalSignOptions {
  expiresIn?: string | number;
}

// Helper to narrow jwt type for .sign and .verify
type JwtSignFn = (payload: string | Buffer | object, secret: string, options?: MinimalSignOptions) => string;
type JwtVerifyFn = (token: string, secret: string) => unknown;

const jwtSign: JwtSignFn = (jwt as unknown as { sign: JwtSignFn }).sign;
const jwtVerify: JwtVerifyFn = (jwt as unknown as { verify: JwtVerifyFn }).verify;

export function signToken(
  payload: Record<string, unknown>,
  options: MinimalSignOptions = { expiresIn: "7d" }
): string {
  return jwtSign(payload, JWT_SECRET, options);
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwtVerify(token, JWT_SECRET) as T;
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
