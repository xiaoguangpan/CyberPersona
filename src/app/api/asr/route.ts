import { NextResponse } from "next/server";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "缺少音频文件 file" }, { status: 400 });
  }

  const settings = await getProviderSettings();
  const apiKey = settings.asr.apiKey;
  const baseUrl = settings.asr.baseUrl?.replace(/\/+$/, "");
  if (!settings.asr.enabled || !apiKey || !baseUrl) {
    return NextResponse.json(
      { ok: false, code: "asr_not_configured", message: "未启用独立 ASR 服务。若 LLM 已使用原生多模态音频输入，可跳过 ASR。" },
      { status: 503 },
    );
  }

  const model = settings.asr.model || "faster-whisper";
  const upstreamForm = new FormData();
  upstreamForm.set("file", file, file.name || "voice.webm");
  upstreamForm.set("model", model);
  const language = formData?.get("language");
  if (typeof language === "string" && language.trim()) upstreamForm.set("language", language.trim());

  try {
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, message: `ASR 服务返回错误：${response.status}`, detail: detail.slice(0, 800) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as { text?: string };
    return NextResponse.json({ ok: true, text: data.text ?? "", model });
  } catch {
    return NextResponse.json({ ok: false, message: "ASR 请求失败" }, { status: 502 });
  }
}
