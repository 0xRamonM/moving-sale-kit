import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";

function token() {
  return createHmac("sha256", process.env.SESSION_SECRET!).update("admin").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(password: string) {
  return safeEqual(password, process.env.ADMIN_PASSWORD!);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  return !!value && safeEqual(value, token());
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function startSession() {
  (await cookies()).set(COOKIE, token(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
