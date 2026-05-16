import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName, logoutSession } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";

export async function POST() {
  const name = getSessionCookieName();
  const token = cookies().get(name)?.value;
  await logoutSession(token);
  cookies().set(name, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
