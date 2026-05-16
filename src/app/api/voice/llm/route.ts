import { NextResponse } from "next/server";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  output_text?: string;
};

function inferAudioFormat(file: File, explicit?: FormDataEntryValue | null) {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  if (file.type.includes("mpeg") || file.name.endsWith(".mp3")) return "mp3";
  if (file.type.includes("wav") || file.name.endsWith(".wav")) return "wav";
  if (file.type.includes("webm") || file.name.endsWith(".webm")) return "webm";
  if (file.type.includes("ogg") || file.name.endsWith(".ogg")) return "ogg";
  return "wav";
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "缺少音频文件 file" }, { status: 400 });
  }

  const settings = await getProviderSettings();
  const baseUrl = settings.llmAudio.baseUrl?.replace(/\/+$/, "");
  const apiKey = settings.llmAudio.apiKey;
  const model = settings.llmAudio.model;
  if (!settings.llmAudio.enabled || !baseUrl || !apiKey || !model) {
    return NextResponse.json(
      { ok: false, code: "llm_audio_not_configured", message: "未启用多模态 LLM 语音直连。可配置 LLM_AUDIO_ENABLED/BASE_URL/API_KEY/MODEL，或改用独立 ASR。" },
      { status: 503 },
    );
  }

  const prompt = typeof formData?.get("prompt") === "string"
    ? String(formData.get("prompt"))
    : "请直接理解这段语音并以 CyberPersona 当前角色回复。";
  const format = inferAudioFormat(file, formData?.get("format"));
  const audioBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_audio", input_audio: { data: audioBase64, format } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, message: `多模态 LLM 语音服务返回错误：${response.status}`, detail: detail.slice(0, 800) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content ?? data.output_text ?? "";
    return NextResponse.json({ ok: true, text, model, mode: "multimodal_llm_audio" });
  } catch {
    return NextResponse.json({ ok: false, message: "多模态 LLM 语音请求失败" }, { status: 502 });
  }
}
