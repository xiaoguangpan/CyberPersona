import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/cyberpersona/app-store";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return withAdminGuard(async () => {
    try {
      await deleteUser(params.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除用户失败";
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
  });
}
