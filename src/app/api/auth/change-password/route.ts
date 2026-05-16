import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changeOwnPassword, getSessionCookieName } from "@/lib/cyberpersona/app-store";
import { requireCurrentUser } from "@/lib/cyberpersona/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const body = (await request.json().catch(() => null)) as
      | { currentPassword?: string; newPassword?: string; confirmPassword?: string }
      | null;
    if (!body) return NextResponse.json({ ok: false, message: "请求格式错误" }, { status: 400 });
    const currentPassword = (body.currentPassword ?? "").trim();
    const newPassword = (body.newPassword ?? "").trim();
    const confirmPassword = (body.confirmPassword ?? "").trim();
    if (!currentPassword) return NextResponse.json({ ok: false, message: "请填写当前密码" }, { status: 400 });
    if (!newPassword) return NextResponse.json({ ok: false, message: "请填写新密码" }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ ok: false, message: "两次输入的新密码不一致" }, { status: 400 });
    const token = cookies().get(getSessionCookieName())?.value;
    await changeOwnPassword(user.id, currentPassword, newPassword, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "修改密码失败";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
