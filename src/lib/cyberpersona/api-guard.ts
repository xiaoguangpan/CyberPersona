import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/cyberpersona/api-auth";

export async function withAdminGuard<T>(handler: () => Promise<T>) {
  try {
    await requireAdminUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未授权";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, message: "未登录" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, message: "无权限访问" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
  return handler();
}
