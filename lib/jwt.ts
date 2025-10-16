import jwt, { type SignOptions, type Secret } from "jsonwebtoken";

const JWT_SECRET: Secret = process.env.JWT_SECRET as string;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "admin_token";

if (!JWT_SECRET) throw new Error("JWT_SECRET not set");

export function signToken(payload: object, options: SignOptions = { expiresIn: "7d" }) {
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
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
