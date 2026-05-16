import { cookies } from "next/headers";
import { getSessionCookieName, getUserBySession } from "@/lib/cyberpersona/app-store";

export async function currentUser() {
  const token = cookies().get(getSessionCookieName())?.value;
  return getUserBySession(token);
}

export async function requireCurrentUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdminUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

export function sessionCookieOptions(expiresAt?: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt ? new Date(expiresAt) : undefined,
  };
}
