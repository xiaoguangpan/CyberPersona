import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";

export const runtime = "nodejs";

type TtsRequestBody = {
  text?: string;
  context?: string;
  model?: string;
  format?: string;
  voiceSamplePath?: string;
};

type MiMoCompletionResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
      };
    };
  }>;
};

const supportedFormats = new Set(["wav", "mp3", "opus", "flac"]);
const mediaRoot = path.resolve(process.cwd(), ".cyberpersona-media");

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function estimateDurationSec(text: string) {
  const compact = text.replace(/\s+/g, "");
  return Math.max(2, Math.ceil(compact.length / 4.2));
}

async function encodeVoiceSample(voiceSamplePath?: string) {
  if (!voiceSamplePath) return null;
  const resolved = path.resolve(voiceSamplePath);
  if (!resolved.startsWith(mediaRoot)) return null;
  const ext = path.extname(resolved).toLowerCase();
  const mime = ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : null;
  if (!mime) return null;
  const data = await fs.readFile(resolved);
  if (data.length > 10 * 1024 * 1024) return null;
  return `data:${mime};base64,${data.toString("base64")}`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TtsRequestBody | null;
  const text = body?.text?.trim();

  if (!text) {
    return NextResponse.json({ ok: false, message: "缺少要合成的文本" }, { status: 400 });
  }

  if (text.length > 1200) {
    return NextResponse.json({ ok: false, message: "TTS 文本过长，请先切分后合成" }, { status: 400 });
  }

  const settings = await getProviderSettings();
  const apiKey = settings.tts.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, code: "tts_not_configured", message: "未配置 XIAOMI_API_KEY 或 MIMO_API_KEY" },
      { status: 503 },
    );
  }

  const baseUrl = normalizeBaseUrl(settings.tts.baseUrl || "https://api.xiaomimimo.com/v1");
  const voiceSample = await encodeVoiceSample(body?.voiceSamplePath).catch(() => null);
  const model = body?.model || (voiceSample ? "mimo-v2.5-tts-voiceclone" : settings.tts.model || "mimo-v2.5-tts");
  const voice = voiceSample || "茉莉";
  const requestedFormat = body?.format || settings.tts.format || "wav";
  const format = supportedFormats.has(requestedFormat) ? requestedFormat : "wav";
  const context = body?.context?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const messages = [
      ...(context ? [{ role: "user", content: context }] : []),
      { role: "assistant", content: text },
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        audio: { format, voice },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        { ok: false, message: `TTS 服务返回错误：${response.status}`, detail: detail.slice(0, 800) },
        { status: 502 },
      );
    }

    const completion = (await response.json()) as MiMoCompletionResponse;
    const audioData = completion.choices?.[0]?.message?.audio?.data;

    if (!audioData) {
      return NextResponse.json({ ok: false, message: "TTS 服务未返回音频数据" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      audioUrl: `data:audio/${format};base64,${audioData}`,
      durationSec: estimateDurationSec(text),
      format,
      voice: voiceSample ? "voiceclone" : voice,
      model,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "TTS 请求超时" : "TTS 请求失败";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
