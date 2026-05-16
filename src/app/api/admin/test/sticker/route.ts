import { NextResponse } from "next/server";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";
import { searchSticker } from "@/lib/cyberpersona/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withAdminGuard(async () => {
    const body = await request.json().catch(() => ({})) as { keyword?: string };
    const keyword = body.keyword?.trim() || "贴贴";
    const start = Date.now();
    try {
      const result = await searchSticker(keyword, "admin-test");
      return NextResponse.json({
        ok: true,
        status: "ok",
        stickerUrl: result.url,
        sourceUrl: result.sourceUrl,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "表情包接口测试失败",
        durationMs: Date.now() - start,
      });
    }
  });
}
