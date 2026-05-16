import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionCookieName, loginUser } from "@/lib/cyberpersona/app-store";
import { sessionCookieOptions } from "@/lib/cyberpersona/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loginUser(body);
    cookies().set(getSessionCookieName(), result.session.token, sessionCookieOptions(result.session.expiresAt));
    return NextResponse.json({ ok: true, user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
