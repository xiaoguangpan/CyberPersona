import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { AlbumItem, ChatMessage, DynamicState, Persona } from "@/lib/types";
import { applyProviderSettingsToEnv, getProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { recordCall } from "@/lib/cyberpersona/call-logs";

const execFileAsync = promisify(execFile);

// Always run Python child processes with UTF-8 stdio so Chinese output is
// preserved correctly on Windows (default code page is GBK / cp936). Without
// this, JSON written by random_character_seed.py and the vendor scripts ends
// up decoded as garbage when Node reads stdout as UTF-8.
function pythonEnv(extra?: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    ...(extra ?? {}),
  };
}

export type CyberPersonaSeed = {
  systemBase: {
    personalityArchetype: string;
    bigFive: { o: number; c: number; e: number; a: number; n: number };
    openingStrategy: string;
  };
  appearance: {
    hair: string;
    skin: string;
    eye: string;
    photoOutfit?: string;
    bodyType: string;
  };
  voice: {
    voiceStyle: string;
  };
  openingMessage: string;
  seedId: number;
};

type AudioCompletionResponse = {
  choices?: Array<{ message?: { audio?: { data?: string } } }>;
};

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
};

type MediaResult = {
  url: string;
  path?: string;
};

type GeneratedImageResult = MediaResult & {
  fallback?: boolean;
  fallbackReason?: string;
};

type InitialMedia = {
  referencePhotoUrl: string;
  referencePhotoPath?: string;
  voiceSampleUrl?: string;
  voiceSamplePath?: string;
};

const fallbackArchetypes = [
  { label: "温柔治愈型", n: 30, a: 85, o: 55, c: 70, e: 55 },
  { label: "元气小太阳型", n: 20, a: 70, o: 75, c: 50, e: 90 },
  { label: "知性优雅型", n: 25, a: 65, o: 60, c: 80, e: 50 },
  { label: "傲娇别扭型", n: 65, a: 35, o: 50, c: 55, e: 40 },
  { label: "冰山禁欲型", n: 35, a: 20, o: 45, c: 90, e: 15 },
];

const fallbackHair = ["原生黑长直", "黑茶色微卷发", "亚麻色法式大波浪", "冷棕色一刀切短发", "高马尾带随性碎发"];
const fallbackSkin = ["冷白皮", "暖白皮", "通透的素颜奶油肌", "阳光的小麦色肌肤", "脸颊有散落的浅浅雀斑"];
const fallbackEye = ["清澈灵动的圆眼", "无辜的下垂狗狗眼", "眼尾上挑的魅惑狐狸眼", "狭长的丹凤眼", "温柔透亮的杏眼"];
const fallbackOutfit = ["宽松的纯白色毛衣", "剪裁合体的黑色西装外套", "法式复古方领碎花裙", "浅灰色Oversized连帽卫衣", "白衬衫配深蓝领带"];
const fallbackBody = ["身材匀称，线条紧致", "高挑骨感，超模比例", "小巧玲珑的幼态骨架", "薄背直角肩", "丰满有致的沙漏型身材"];
const fallbackVoice = [
  "20多岁女性，声音清甜明亮，头腔共鸣明显，语速较快，吐字轻快跳跃，底色元气满满。",
  "20多岁女性，声音清冷干净，发音清晰笃定，语速适中均匀，吐字干脆利落，底色理智疏离。",
  "20多岁女性，声线细软含大量气声，语速偏慢，吐字轻柔收敛，底色害羞温软。",
];
const fallbackOpenings = ["好烦啊……", "你猜我现在在干嘛", "刚洗完澡头发还是湿的", "啊 发错了", "她正在线上..."];

function projectRoot() {
  return process.env.CYBERPERSONA_ROOT || path.resolve(process.cwd(), "..");
}

function resolveMediaRoot(mediaDir?: string) {
  return path.resolve(process.cwd(), mediaDir?.trim() || ".cyberpersona-media");
}

async function mediaRoot() {
  const settings = await getProviderSettings();
  return resolveMediaRoot(settings.runtime.mediaDir);
}

function mediaUrl(name: string) {
  return `/api/media/file?name=${encodeURIComponent(name)}`;
}

function pythonBin() {
  return process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
}

function vendorImageScript() {
  return path.join(projectRoot(), "vendor", "image-api", "scripts", "image_api.py");
}

function vendorVoiceDesignScript() {
  return path.join(projectRoot(), "vendor", "MiMo-Skills", "skills", "mimo-v2-5-tts", "scripts", "mimo_tts_voicedesign.py");
}

function vendorStickerScript() {
  return path.join(projectRoot(), "vendor", "sticker", "scripts", "sticker_search.py");
}

async function fileToMediaResult(filePath: string, fallbackPrefix: string) {
  const resolved = path.resolve(filePath);
  const root = await mediaRoot();
  await fs.mkdir(root, { recursive: true });
  if (resolved.startsWith(root)) {
    return { url: mediaUrl(path.basename(resolved)), path: resolved };
  }
  const ext = path.extname(resolved) || ".bin";
  const name = `${fallbackPrefix}-${randomUUID()}${ext}`;
  const target = path.join(root, name);
  await fs.copyFile(resolved, target);
  return { url: mediaUrl(name), path: target };
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function perturb(value: number, delta = 6) {
  return Math.max(0, Math.min(100, value + Math.floor(Math.random() * (delta * 2 + 1)) - delta));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function fallbackSeed(): CyberPersonaSeed {
  const archetype = pick(fallbackArchetypes);
  return {
    systemBase: {
      personalityArchetype: archetype.label,
      bigFive: {
        n: perturb(archetype.n),
        a: perturb(archetype.a),
        o: perturb(archetype.o),
        c: perturb(archetype.c),
        e: perturb(archetype.e),
      },
      openingStrategy: "fallback",
    },
    appearance: {
      hair: pick(fallbackHair),
      skin: pick(fallbackSkin),
      eye: pick(fallbackEye),
      photoOutfit: pick(fallbackOutfit),
      bodyType: pick(fallbackBody),
    },
    voice: { voiceStyle: pick(fallbackVoice) },
    openingMessage: pick(fallbackOpenings),
    seedId: Math.floor(10000 + Math.random() * 90000),
  };
}

async function runOriginalSeedScript(): Promise<CyberPersonaSeed | null> {
  const script = path.join(projectRoot(), "scripts", "random_character_seed.py");
  const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  try {
    const { stdout } = await execFileAsync(python, [script], {
      cwd: projectRoot(),
      timeout: 30_000,
      encoding: "utf8",
      env: pythonEnv(),
    });
    return JSON.parse(stdout) as CyberPersonaSeed;
  } catch {
    return null;
  }
}

export async function generateSeed() {
  return (await runOriginalSeedScript()) ?? fallbackSeed();
}

export function computeInitialDynamicState(seed: CyberPersonaSeed): DynamicState {
  const bigFive = seed.systemBase.bigFive;
  const n = bigFive.n ?? 50;
  const a = bigFive.a ?? 50;
  const o = bigFive.o ?? 50;
  const c = bigFive.c ?? 50;
  const e = bigFive.e ?? 50;
  return {
    trust: clamp(20 + a * 0.3 + c * 0.2, 5, 70),
    security: clamp(50 - n * 0.3, 5, 70),
    closeness: clamp(5 + e * 0.25 + o * 0.15, 0, 50),
    neediness: clamp(10 + n * 0.2 + (100 - e) * 0.15, 0, 50),
    possessiveness: clamp(5 + n * 0.15 + (100 - a) * 0.15, 0, 50),
  };
}

// Reference photo prompt — used both as the persona's first selfie and as
// the consistency anchor for later image generations. We deliberately avoid
// the words "证件照 / ID photo / passport photo" because they push the model
// toward stiff frontal head-shots on a plain backdrop. Instead we ask for a
// natural artistic life-style portrait of a young Chinese woman in one of
// several common, photogenic scenes. The seedId picks a deterministic scene
// so the same persona always anchors to the same vibe across regenerations.
const referenceScenes = [
  {
    location: "在城市公园的花海里，斜阳下，背景是大片的粉色花朵",
    pose: "侧身回眸轻笑，一只手撩起耳边的头发",
    lighting: "黄昏的暖色逆光，柔和发丝轮廓光",
  },
  {
    location: "在海边的浅滩边，背景是傍晚的大海与远处的灯塔",
    pose: "赤脚走在沙滩上，转头看向镜头，半身入画",
    lighting: "蓝色 magic hour 自然光，海风带起头发",
  },
  {
    location: "在大学校园的林荫道上，背景是斑驳光影和远处教学楼",
    pose: "怀里抱着课本，倚着树干微微仰头看向镜头",
    lighting: "树叶缝隙洒下的斑驳日光，体感温柔",
  },
  {
    location: "在安静的图书馆靠窗位置，桌上有翻开的书和咖啡杯",
    pose: "侧头托腮看向窗外，又被镜头吸引转过来一瞬间",
    lighting: "窗外柔和侧光，书页上有轻微反光",
  },
  {
    location: "在江南庭院的回廊里，背景是青砖、绿植和漏窗",
    pose: "倚着木栏静静站着，半身入画，身体微微侧向镜头",
    lighting: "阴天散射光，皮肤通透不油",
  },
  {
    location: "在咖啡馆靠窗的卡座，桌上是一杯冒着热气的拿铁",
    pose: "双手捧着马克杯，抬眼笑看镜头",
    lighting: "暖色钨丝灯 + 落地窗自然光",
  },
  {
    location: "在樱花盛开的步道上，路面散落花瓣",
    pose: "轻轻抬手接住飘落的花瓣，半侧身入画",
    lighting: "春日上午的柔和散射光，整体偏粉调",
  },
  {
    location: "在天台上的小花园，背景是城市天际线与晚霞",
    pose: "靠在矮墙上眺望远方，被身后的呼唤带回头",
    lighting: "金色 magic hour 顶光 + 反光板补光",
  },
];

export function buildReferencePhotoPrompt(seed: CyberPersonaSeed) {
  const appearance = seed.appearance;
  const scene = referenceScenes[Math.abs(seed.seedId) % referenceScenes.length];
  const lines = [
    "像 iPhone 前置摄像头拍到的真实生活自拍/半身照，主体是一位 22 岁左右的当代中国年轻女性。",
    "照片应像普通手机原片：自然抓拍、轻微广角透视、真实皮肤纹理、细小瑕疵、发丝碎发、衣料褶皱，避免影楼写真、网红精修、AI 插画、CG 塑料感。",
    `场景：${scene.location}。`,
    `姿态：${scene.pose}。`,
    `光线：${scene.lighting}。`,
    "相机感：iPhone 前置摄像头/普通手机自拍，等效 24-28mm，手持轻微不完美构图，背景真实但不过度虚化，允许轻微噪点和曝光不均。",
    "后期限制：无磨皮、无大眼瘦脸、无商业摄影布光、无胶片滤镜堆叠、无过饱和、无油亮皮肤。",
    "输出目标：看起来像真实朋友圈随手拍，不像 AI 生成图或专业写真。",
    "Negative prompt: CGI, 3D render, doll-like face, plastic skin, over-smoothed skin, airbrushed, glamour studio, stock photo, perfect symmetry, uncanny eyes, watermark, text, logo.",
    "外貌锚点（必须保留以保证后续一致性）：",
    appearance.hair ? `· 发型：${appearance.hair}` : "",
    appearance.skin ? `· 肤色：${appearance.skin}` : "",
    appearance.eye ? `· 眼部：${appearance.eye}` : "",
    appearance.bodyType ? `· 身材：${appearance.bodyType}` : "",
    appearance.photoOutfit ? `· 着装：${appearance.photoOutfit}` : "",
    "请勿出现：水印、文字、logo、艺术签名、证件框、白色棚拍背景、蓝/红渐变证件底色。",
  ];
  return lines.filter(Boolean).join("\n");
}

// Pastel placeholder image used only when the real image provider is
// unavailable. Deliberately kept minimal — soft gradient + a few abstract
// shapes, no text, no icons, no faces. Stable per seedId so the placeholder
// looks the same for the same persona across renders.
function imageSvgDataUrl(seed: CyberPersonaSeed) {
  const palettes = [
    ["#fde8e4", "#f3c7d1", "#e7a8c4"],
    ["#e9f0ff", "#cdd9f4", "#a9b8e6"],
    ["#e8f4ec", "#c9e1d3", "#9cc6b2"],
    ["#fff2dc", "#f5dcb7", "#e6b988"],
    ["#efe6ff", "#d6c3f2", "#b69fdf"],
  ];
  const palette = palettes[Math.abs(seed.seedId) % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">`
    + `<defs>`
    + `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">`
    + `<stop offset="0" stop-color="${palette[0]}"/>`
    + `<stop offset=".55" stop-color="${palette[1]}"/>`
    + `<stop offset="1" stop-color="${palette[2]}"/>`
    + `</linearGradient>`
    + `<radialGradient id="glow" cx=".3" cy=".25" r=".75">`
    + `<stop offset="0" stop-color="#ffffff" stop-opacity=".55"/>`
    + `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>`
    + `</radialGradient>`
    + `</defs>`
    + `<rect width="720" height="960" fill="url(#bg)"/>`
    + `<rect width="720" height="960" fill="url(#glow)"/>`
    + `<circle cx="540" cy="780" r="180" fill="#ffffff" fill-opacity=".18"/>`
    + `<circle cx="160" cy="180" r="110" fill="#ffffff" fill-opacity=".22"/>`
    + `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function saveDataUrl(dataUrl: string, prefix: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { url: dataUrl };
  const mime = match[1];
  const ext = mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "bin";
  const name = `${prefix}-${randomUUID()}.${ext}`;
  const root = await mediaRoot();
  const outputPath = path.join(root, name);
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(match[2], "base64"));
  return { url: mediaUrl(name), path: outputPath };
}


function fastImageSize(prefix: string) {
  return prefix === "reference-photo" ? "1024x1024" : "1024x1024";
}

function fastImageQuality(_prefix: string) {
  return "low";
}

async function runVendorImage(input: {
  prompt: string;
  prefix: string;
  referencePhotoPath?: string;
  source?: string;
}): Promise<MediaResult | null> {
  const start = Date.now();
  const settings = await getProviderSettings();
  const script = vendorImageScript();
  const apiKey = settings.image.apiKey;
  const baseUrl = settings.image.baseUrl?.trim().replace(/\/+$/, "");
  const logSource = input.source || "vendor-image";
  if (!settings.image.enabled) {
    await recordCall({
      type: "image",
      provider: settings.image.provider || "vendor-image",
      source: logSource,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "unconfigured",
      inputSummary: input.prompt,
      outputSummary: "",
      errorMessage: "Image API 未启用",
      request: { enabled: false, baseUrl },
    });
    return null;
  }
  if (!apiKey || !baseUrl) {
    await recordCall({
      type: "image",
      provider: settings.image.provider || "vendor-image",
      source: logSource,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "unconfigured",
      inputSummary: input.prompt,
      outputSummary: "",
      errorMessage: "Image API 未配置：缺少 apiKey / baseUrl",
      request: { script, hasApiKey: Boolean(apiKey), baseUrl },
    });
    return null;
  }
  try {
    await fs.access(script);
  } catch {
    return null;
  }
  const outputDir = await mediaRoot();
  await fs.mkdir(outputDir, { recursive: true });
  const args = [
    script,
    "--json",
    "--size",
    fastImageSize(input.prefix),
    "--quality",
    fastImageQuality(input.prefix),
    "--format",
    "jpeg",
    "--compression",
    "80",
    "--moderation",
    "low",
  ];
  if (input.referencePhotoPath) {
    args.push("--edit", "--image", input.referencePhotoPath);
  }
  args.push(input.prompt);
  try {
    const { stdout } = await execFileAsync(pythonBin(), args, {
      cwd: path.dirname(path.dirname(script)),
      timeout: 180_000,
      encoding: "utf8",
      env: pythonEnv({
        IMAGE_API_KEY: apiKey,
        IMAGE_API_BASE: baseUrl,
        IMAGE_MODEL: settings.image.model,
        IMAGE_OUT_DIR: outputDir,
      }),
    });
    const parsed = JSON.parse(stdout) as { ok?: boolean; paths?: string[]; message?: string };
    const firstPath = parsed.paths?.[0];
    if (!parsed.ok || !firstPath) {
      await recordCall({
        type: "image",
        provider: settings.image.provider || "vendor-image",
        source: logSource,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: input.prompt,
        outputSummary: "",
        errorMessage: parsed.message || "vendor image 返回未成功",
        request: { args, model: settings.image.model, baseUrl, optimizedForLatency: true },
        response: parsed,
      });
      return null;
    }
    const result = await fileToMediaResult(firstPath, input.prefix);
    await recordCall({
      type: "image",
      provider: settings.image.provider || "vendor-image",
      source: logSource,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "ok",
      inputSummary: input.prompt,
      outputSummary: result.url,
      request: { args, model: settings.image.model, baseUrl, optimizedForLatency: true },
      response: parsed,
    });
    return result;
  } catch (error) {
    await recordCall({
      type: "image",
      provider: settings.image.provider || "vendor-image",
      source: logSource,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "error",
      inputSummary: input.prompt,
      outputSummary: "",
      errorMessage: error instanceof Error ? error.message : "vendor image 调用异常",
      request: { args, model: settings.image.model, baseUrl, optimizedForLatency: true },
    });
    return null;
  }
}

async function fetchImageFromProvider(seed: CyberPersonaSeed) {
  const settings = await getProviderSettings();
  const vendor = await runVendorImage({
    prompt: buildReferencePhotoPrompt(seed),
    prefix: "reference-photo",
  }).catch(() => null);
  if (vendor) return vendor;

  const apiKey = settings.image.apiKey;
  const baseUrl = settings.image.baseUrl?.trim().replace(/\/+$/, "");
  if (!settings.image.enabled || !apiKey || !baseUrl) return null;
  const prompt = buildReferencePhotoPrompt(seed);
  const body = {
    model: settings.image.model || "gpt-image-2",
    prompt,
    size: "1024x1024",
    quality: "low",
    n: 1,
  };
  return requestImageResult({
    url: `${baseUrl}/images/generations`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    prefix: "reference-photo",
    prompt,
    provider: settings.image.provider || "image",
    source: "direct-image-reference",
    request: { endpoint: "/images/generations", baseUrl, model: body.model, size: body.size, quality: body.quality, optimizedForLatency: true },
  });
}

async function imageResultFromData(data: ImageGenerationResponse, prefix: string): Promise<MediaResult | null> {
  const first = data.data?.[0];
  if (first?.b64_json) return saveDataUrl(`data:image/png;base64,${first.b64_json}`, prefix);
  if (first?.url) return { url: first.url };
  return null;
}

async function requestImageResult(input: {
  url: string;
  init: RequestInit;
  prefix: string;
  prompt: string;
  provider: string;
  source: string;
  request: unknown;
}): Promise<MediaResult | null> {
  const start = Date.now();
  try {
    const response = await fetch(input.url, input.init);
    const text = await response.text();
    let data: ImageGenerationResponse | null = null;
    try {
      data = text ? JSON.parse(text) as ImageGenerationResponse : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      await recordCall({
        type: "image",
        provider: input.provider,
        source: input.source,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: input.prompt,
        outputSummary: "",
        errorMessage: `HTTP ${response.status} ${text.slice(0, 180)}`,
        request: input.request,
        response: { status: response.status, body: text.slice(0, 4000) },
      });
      return null;
    }

    if (!data) {
      await recordCall({
        type: "image",
        provider: input.provider,
        source: input.source,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: input.prompt,
        outputSummary: "",
        errorMessage: "Image API 返回的 JSON 无法解析",
        request: input.request,
        response: { status: response.status, body: text.slice(0, 4000) },
      });
      return null;
    }

    const first = data.data?.[0];
    const result = await imageResultFromData(data, input.prefix);
    if (!result) {
      await recordCall({
        type: "image",
        provider: input.provider,
        source: input.source,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: input.prompt,
        outputSummary: "",
        errorMessage: "Image API 未返回 b64_json 或 url",
        request: input.request,
        response: { status: response.status, items: data.data?.length ?? 0, hasB64: Boolean(first?.b64_json), hasUrl: Boolean(first?.url) },
      });
      return null;
    }

    await recordCall({
      type: "image",
      provider: input.provider,
      source: input.source,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "ok",
      inputSummary: input.prompt,
      outputSummary: result.url,
      request: input.request,
      response: { status: response.status, items: data.data?.length ?? 0, hasB64: Boolean(first?.b64_json), hasUrl: Boolean(first?.url) },
    });
    return result;
  } catch (error) {
    await recordCall({
      type: "image",
      provider: input.provider,
      source: input.source,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "error",
      inputSummary: input.prompt,
      outputSummary: "",
      errorMessage: error instanceof Error ? error.message : "Image API 调用异常",
      request: input.request,
    });
    return null;
  }
}

async function fetchConsistentImageFromProvider(input: {
  prompt: string;
  referencePhotoPath?: string;
  source?: string;
}) {
  const settings = await getProviderSettings();
  const photoRealism = "Keep the same person as the reference photo. Render as an iPhone front-camera casual photo: natural skin texture, slight lens imperfection, handheld framing, realistic ambient light, no studio glamour, no CGI, no plastic skin, no over-retouching.";
  const vendor = await runVendorImage({
    prompt: `${input.prompt}\n${photoRealism}`,
    prefix: "consistent-image",
    referencePhotoPath: input.referencePhotoPath,
    source: input.source,
  }).catch(() => null);
  if (vendor) return vendor;

  const apiKey = settings.image.apiKey;
  const baseUrl = settings.image.baseUrl?.trim().replace(/\/+$/, "");
  if (!settings.image.enabled || !apiKey || !baseUrl) return null;
  const prompt = `${input.prompt}\n${photoRealism}`;
  const provider = settings.image.provider || "image";
  const source = input.source || "direct-image";
  const model = settings.image.model || "gpt-image-2";
  if (input.referencePhotoPath) {
    const resolved = path.resolve(input.referencePhotoPath);
    const root = await mediaRoot();
    if (resolved.startsWith(root)) {
      const image = await fs.readFile(resolved).catch(() => null);
      if (image) {
        const formData = new FormData();
        formData.set("model", model);
        formData.set("prompt", prompt);
        formData.set("image", new Blob([image], { type: "image/png" }), path.basename(resolved));
        formData.set("size", "1024x1024");
        formData.set("quality", "low");
        const edited = await requestImageResult({
          url: `${baseUrl}/images/edits`,
          init: {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          },
          prefix: "consistent-image",
          prompt,
          provider,
          source,
          request: { endpoint: "/images/edits", baseUrl, model, size: "1024x1024", quality: "low", hasReferenceImage: true, optimizedForLatency: true },
        });
        if (edited) return edited;
      }
    }
  }
  const body = {
    model,
    prompt,
    size: "1024x1024",
    quality: "low",
    n: 1,
  };
  return requestImageResult({
    url: `${baseUrl}/images/generations`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    prefix: "consistent-image",
    prompt,
    provider,
    source,
    request: { endpoint: "/images/generations", baseUrl, model, size: body.size, quality: body.quality },
  });
}

export async function generateConsistentPersonaImage(input: {
  prompt: string;
  referencePhotoUrl?: string;
  referencePhotoPath?: string;
  source?: string;
}): Promise<GeneratedImageResult> {
  const generated = await fetchConsistentImageFromProvider(input).catch(() => null);
  if (generated) return generated;
  return {
    url: input.referencePhotoUrl || imageSvgDataUrl(fallbackSeed()),
    fallback: true,
    fallbackReason: "Image API 未配置或返回失败",
  };
}

async function synthesizeVoiceDesign(seed: CyberPersonaSeed) {
  const vendor = await runVendorVoiceDesign(seed).catch(() => null);
  if (vendor) return vendor;

  const settings = await getProviderSettings();
  const apiKey = settings.tts.apiKey;
  const baseUrl = (settings.tts.baseUrl || "https://api.xiaomimimo.com/v1").replace(/\/+$/, "");
  if (!apiKey) return null;
  const text = seed.openingMessage?.trim() || "你好，我在。";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mimo-v2.5-tts-voicedesign",
      messages: [
        { role: "user", content: seed.voice.voiceStyle },
        { role: "assistant", content: text },
      ],
      audio: { format: settings.tts.format || "wav" },
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as AudioCompletionResponse;
  const audio = data.choices?.[0]?.message?.audio?.data;
  if (!audio) return null;
  return saveDataUrl(`data:audio/wav;base64,${audio}`, "voice-sample");
}

async function runVendorVoiceDesign(seed: CyberPersonaSeed) {
  const script = vendorVoiceDesignScript();
  const settings = await getProviderSettings();
  applyProviderSettingsToEnv(settings);
  const apiKey = settings.tts.apiKey;
  if (!apiKey) return null;
  await fs.access(script);
  const outputDir = await mediaRoot();
  const outputPath = path.join(outputDir, `voice-sample-${randomUUID()}.wav`);
  await fs.mkdir(outputDir, { recursive: true });
  await execFileAsync(pythonBin(), [
    script,
    "--context",
    seed.voice.voiceStyle,
    "--text",
    seed.openingMessage?.trim() || "你好，我在。",
    "--output",
    outputPath,
  ], {
    cwd: projectRoot(),
    timeout: 60_000,
    encoding: "utf8",
    env: pythonEnv({ MIMO_API_KEY: apiKey, XIAOMI_API_KEY: apiKey }),
  });
  return fileToMediaResult(outputPath, "voice-sample");
}

export async function searchSticker(keyword: string, source = "chat-turn") {
  const start = Date.now();
  const settings = await getProviderSettings();
  const script = vendorStickerScript();
  const outputDir = await mediaRoot();
  try {
    await fs.access(script);
  } catch (error) {
    await recordCall({
      type: "sticker",
      provider: settings.sticker.provider || "sticker",
      source,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "error",
      inputSummary: keyword,
      outputSummary: "",
      errorMessage: error instanceof Error ? error.message : "sticker 脚本不可访问",
      request: { script },
    });
    throw new Error("表情包脚本不可访问");
  }
  await fs.mkdir(outputDir, { recursive: true });
  try {
    const { stdout } = await execFileAsync(pythonBin(), [
      script,
      "--json",
      "--output-dir",
      outputDir,
      keyword,
    ], {
      cwd: projectRoot(),
      timeout: 12_000,
      encoding: "utf8",
      env: pythonEnv({ STICKER_OUT_DIR: outputDir }),
    });
    const parsed = JSON.parse(stdout) as { ok?: boolean; path?: string; sourceUrl?: string; message?: string };
    if (!parsed.ok || !parsed.path) {
      await recordCall({
        type: "sticker",
        provider: settings.sticker.provider || "sticker",
        source,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: keyword,
        outputSummary: "",
        errorMessage: parsed.message || "表情包搜索失败",
        request: { keyword },
        response: parsed,
      });
      throw new Error(parsed.message || "表情包搜索失败");
    }
    const result = await fileToMediaResult(parsed.path, "sticker");
    await recordCall({
      type: "sticker",
      provider: settings.sticker.provider || "sticker",
      source,
      startedAt: start,
      durationMs: Date.now() - start,
      streaming: false,
      status: "ok",
      inputSummary: keyword,
      outputSummary: result.url,
      request: { keyword },
      response: parsed,
    });
    return { ...result, sourceUrl: parsed.sourceUrl };
  } catch (error) {
    if (error instanceof Error && error.message && error.message !== "表情包搜索失败") {
      await recordCall({
        type: "sticker",
        provider: settings.sticker.provider || "sticker",
        source,
        startedAt: start,
        durationMs: Date.now() - start,
        streaming: false,
        status: "error",
        inputSummary: keyword,
        outputSummary: "",
        errorMessage: error.message,
        request: { keyword },
      });
    }
    throw error;
  }
}

export async function generateInitialMedia(seed: CyberPersonaSeed): Promise<InitialMedia> {
  const image = await fetchImageFromProvider(seed).catch(() => null);
  const fallbackImage = image ?? { url: imageSvgDataUrl(seed) };
  const voice = await synthesizeVoiceDesign(seed).catch(() => null);
  return {
    referencePhotoUrl: fallbackImage.url,
    referencePhotoPath: fallbackImage.path,
    voiceSampleUrl: voice?.url,
    voiceSamplePath: voice?.path,
  };
}

function buildPersona(seed: CyberPersonaSeed, media: InitialMedia): Persona {
  const now = new Date().toISOString();
  const id = `p_${seed.seedId}_${Date.now()}`;
  return {
    id,
    userId: "u_self",
    status: "active",
    nickname: "她",
    avatarUrl: media.referencePhotoUrl,
    referencePhotoUrl: media.referencePhotoUrl,
    referencePhotoPath: media.referencePhotoPath,
    voiceSampleUrl: media.voiceSampleUrl,
    voiceSamplePath: media.voiceSamplePath,
    createdAt: now,
    updatedAt: now,
    currentEmotion: "刚被分配到你身边，语气里还有一点试探",
    sessionCount: 1,
    characterCard: {
      systemBase: seed.systemBase,
      appearance: seed.appearance,
      voice: { ...seed.voice, voiceSamplePath: media.voiceSamplePath },
      referencePhotoPath: media.referencePhotoPath,
      identity: {},
      physicalTraits: {},
      personalitySelfDescription: {},
      preferences: {},
      innerWorld: {},
      habits: {},
      memories: { events: ["你们刚刚被系统分配到彼此身边"], milestones: [], gifts: [] },
    },
    dynamicState: computeInitialDynamicState(seed),
    stress: 20,
    affection: 100,
    affectionLevel: 1,
    memory: {
      lastSummary: "",
      nicknameForUser: "",
      nicknameForSelf: "",
      sharedRoutines: [],
      emotionalMemories: [],
      importantEvents: [],
      revealedFacts: [],
      vulnerabilityTopics: [],
      location: {},
    },
    shortTerm: {
      unresolvedEmotion: "",
      emotionTrigger: "",
      interactionTrend: "",
      recentVoicePattern: "",
      recentImagePattern: "",
    },
  };
}

function buildInitialMessages(persona: Persona, seed: CyberPersonaSeed): ChatMessage[] {
  const now = Date.now();
  const messages: ChatMessage[] = [
    {
      id: `system_${persona.id}`,
      personaId: persona.id,
      role: "system",
      type: "system",
      text: "你们的关系刚刚开始。",
      createdAt: new Date(now).toISOString(),
    },
    {
      id: `reference_${persona.id}`,
      personaId: persona.id,
      role: "assistant",
      type: "image",
      imageUrl: persona.referencePhotoUrl,
      imageCaption: "刚装扮好，以真面目示人。你要是不喜欢，我可要难过啦。",
      createdAt: new Date(now + 500).toISOString(),
    },
  ];
  if (persona.voiceSampleUrl) {
    messages.push({
      id: `voice_sample_${persona.id}`,
      personaId: persona.id,
      role: "assistant",
      type: "voice",
      text: seed.openingMessage?.trim() || "你好，我在。",
      audioUrl: persona.voiceSampleUrl,
      audioDurationSec: 4,
      createdAt: new Date(now + 900).toISOString(),
    });
  }
  messages.push({
    id: `opening_${persona.id}`,
    personaId: persona.id,
    role: "assistant",
    type: "text",
    text: seed.openingMessage?.trim() || "她正在线上...",
    createdAt: new Date(now + 1300).toISOString(),
  });
  return messages;
}

function buildInitialAlbum(persona: Persona): AlbumItem[] {
  return [{
    id: `album_reference_${persona.id}`,
    personaId: persona.id,
    imageUrl: persona.referencePhotoUrl || persona.avatarUrl,
    caption: "初次见面的照片",
    createdAt: persona.createdAt,
    relatedMessageId: `reference_${persona.id}`,
  }];
}

export async function createInitialPersonaBundle() {
  const seed = await generateSeed();
  const media = await generateInitialMedia(seed);
  const persona = buildPersona(seed, media);
  return {
    seed,
    persona,
    messages: buildInitialMessages(persona, seed),
    album: buildInitialAlbum(persona),
  };
}
