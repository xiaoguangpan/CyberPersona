import { NextResponse } from "next/server";
import { setUserAdmin } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";
import { requireAdminUser } from "@/lib/cyberpersona/api-auth";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withAdminGuard(async () => {
    try {
      const me = await requireAdminUser();
      const body = (await request.json().catch(() => null)) as { isAdmin?: boolean } | null;
      if (!body || typeof body.isAdmin !== "boolean") {
        return NextResponse.json({ ok: false, message: "缺少 isAdmin 参数" }, { status: 400 });
      }
      await setUserAdmin(params.id, body.isAdmin, me.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新管理员权限失败";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  });
}
