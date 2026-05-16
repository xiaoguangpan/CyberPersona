import { NextResponse } from "next/server";
import { updateUserStatus } from "@/lib/cyberpersona/app-store";
import type { AdminUserRow } from "@/lib/types";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return withAdminGuard(async () => {
    try {
      const body = await request.json() as { status?: AdminUserRow["status"] };
      if (body.status !== "active" && body.status !== "disabled" && body.status !== "deleted") {
        return NextResponse.json({ ok: false, message: "状态不合法" }, { status: 400 });
      }
      await updateUserStatus(params.id, body.status);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新用户状态失败";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  });
}
