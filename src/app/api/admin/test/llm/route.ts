import { NextResponse } from "next/server";
import { withAdminGuard } from "@/lib/cyberpersona/api-guard";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { recordCall } from "@/lib/cyberpersona/call-logs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withAdminGuard(async () => {
    const body = await request.json().catch(() => ({})) as { prompt?: string };
    const prompt = body.prompt?.trim() || "用一句话和我打招呼，你叫小满。";
    const start = Date.now();
    const settings = await getProviderSettings();
    const baseUrl = settings.llm.baseUrl?.trim().replace(/\/+$/, "");
    const apiKey = settings.llm.apiKey;
    const model = settings.llm.model;
    if (!baseUrl || !apiKey || !model) {
      await recordCall({
        type: "llm",
        provider: settings.llm.provider || "unknown",
        source: "admin-test",
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "unconfigured",
        inputSummary: prompt,
        outputSummary: "",
        errorMessage: "LLM 未配置：缺少 baseUrl / apiKey / model",
        request: { baseUrl, model, hasApiKey: Boolean(apiKey) },
      });
      return NextResponse.json({ ok: false, status: "unconfigured", message: "LLM 未配置：缺少 baseUrl / apiKey / model" });
    }
    const payload = {
      model,
      stream: false,
      temperature: settings.llm.temperature ?? 0.7,
      messages: [
        { role: "system", content: "你是 CyberPersona 平台的连接测试助手。简洁、礼貌地回应。" },
        { role: "user", content: prompt },
      ],
    };
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        await recordCall({
          type: "llm",
          provider: settings.llm.provider || "unknown",
          source: "admin-test",
          startedAt: start,
          durationMs: Date.now() - start,
          streaming: false,
          status: "error",
          inputSummary: prompt,
          outputSummary: "",
          errorMessage: `HTTP ${response.status} ${detail.slice(0, 240)}`,
          request: { url: `${baseUrl}/chat/completions`, body: payload },
          response: { status: response.status, body: detail.slice(0, 4000) },
        });
        return NextResponse.json({ ok: false, status: "error", message: `LLM 接口返回 ${response.status}`, detail: detail.slice(0, 800) });
      }
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? "";
      await recordCall({
        type: "llm",
        provider: settings.llm.provider || "unknown",
        source: "admin-test",
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "ok",
        inputSummary: prompt,
        outputSummary: text,
        request: { url: `${baseUrl}/chat/completions`, body: payload },
        response: data,
      });
      return NextResponse.json({ ok: true, status: "ok", text, durationMs: Date.now() - start });
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      await recordCall({
        type: "llm",
        provider: settings.llm.provider || "unknown",
        source: "admin-test",
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: prompt,
        outputSummary: "",
        errorMessage: message,
        request: { url: `${baseUrl}/chat/completions`, body: payload },
      });
      return NextResponse.json({ ok: false, status: "error", message });
    }
  });
}
