import { NextResponse } from "next/server";
import { currentUser, sessionCookieOptions } from "@/lib/cyberpersona/api-auth";
import { getSessionCookieName } from "@/lib/cyberpersona/app-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("[auth/me] failed to read current user", error);
    const response = NextResponse.json({ ok: false, message: "登录状态已失效，请重新登录" }, { status: 401 });
    response.cookies.set(getSessionCookieName(), "", sessionCookieOptions(new Date(0).toISOString()));
    return response;
  }
}
