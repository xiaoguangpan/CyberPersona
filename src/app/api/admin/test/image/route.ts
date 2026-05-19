import { NextResponse } from "next/server";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";
import { generateConsistentPersonaImage } from "@/lib/cyberpersona/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withAdminGuard(async () => {
    const body = await request.json().catch(() => ({})) as { prompt?: string };
    const prompt = body.prompt?.trim() || "young asian woman, simple portrait, soft natural light, neutral background";
    const start = Date.now();
    try {
      const result = await generateConsistentPersonaImage({ prompt, source: "admin-test-image" });
      const durationMs = Date.now() - start;
      return NextResponse.json({
        ok: !result.fallback,
        status: result.fallback ? "fallback" : "ok",
        imageUrl: result.url,
        durationMs,
        message: result.fallback ? "未配置或返回失败，已使用本地 SVG 兜底。详情请查看 AI 调用记录。" : undefined,
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "Image API 测试失败",
      });
    }
  });
}
