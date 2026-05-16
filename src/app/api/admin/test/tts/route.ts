import { NextResponse } from "next/server";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withAdminGuard(async () => {
    const body = await request.json().catch(() => ({})) as { text?: string };
    const text = body.text?.trim() || "你好，我在。";
    const start = Date.now();
    const settings = await getProviderSettings();
    const apiKey = settings.tts.apiKey;
    const baseUrl = (settings.tts.baseUrl || "https://api.xiaomimimo.com/v1").replace(/\/+$/, "");
    if (!apiKey) {
      return NextResponse.json({ ok: false, status: "unconfigured", message: "TTS 未配置：缺少 apiKey" });
    }
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.tts.model || "mimo-v2.5-tts",
          messages: [
            { role: "user", content: "20多岁女性，声音清甜明亮，吐字轻快跳跃。" },
            { role: "assistant", content: text },
          ],
          audio: { format: settings.tts.format || "wav" },
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return NextResponse.json({ ok: false, status: "error", message: `TTS 接口返回 ${response.status}`, detail: detail.slice(0, 800) });
      }
      const data = await response.json() as { choices?: Array<{ message?: { audio?: { data?: string } } }> };
      const audioBase64 = data.choices?.[0]?.message?.audio?.data;
      if (!audioBase64) {
        return NextResponse.json({ ok: false, status: "error", message: "TTS 响应未包含音频数据" });
      }
      return NextResponse.json({
        ok: true,
        status: "ok",
        durationMs: Date.now() - start,
        audioDataUrl: `data:audio/${settings.tts.format || "wav"};base64,${audioBase64}`,
      });
    } catch (error) {
      return NextResponse.json({ ok: false, status: "error", message: error instanceof Error ? error.message : "TTS 测试失败" });
    }
  });
}
