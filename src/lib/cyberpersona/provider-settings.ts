import type { Prisma } from "@prisma/client";
import type { AdminProviderSettings } from "@/lib/types";
import { getRequiredPrismaClient } from "@/lib/cyberpersona/db";

type ProviderSettingsWithSecrets = Omit<AdminProviderSettings, "llm" | "tts" | "asr" | "llmAudio" | "image"> & {
  llm: AdminProviderSettings["llm"] & { apiKey?: string };
  tts: AdminProviderSettings["tts"] & { apiKey?: string };
  asr: AdminProviderSettings["asr"] & { apiKey?: string };
  llmAudio: AdminProviderSettings["llmAudio"] & { apiKey?: string };
  image: AdminProviderSettings["image"] & { apiKey?: string };
};

const DEFAULT_API_BASE_URL = "https://cpa.itxgp.com/v1";
const DEFAULT_MEDIA_DIR = ".cyberpersona-media";
const providerSettingsKey = "default";

function maskSecret(value?: string) {
  if (!value) return "";
  if (value.includes("****")) return value;
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function secretFromMasked(nextValue: string | undefined, currentSecret: string | undefined) {
  if (!nextValue || nextValue.includes("****")) return currentSecret;
  return nextValue;
}

export function defaultProviderSettings(): ProviderSettingsWithSecrets {
  return {
    llm: {
      provider: "OpenAI Compatible",
      baseUrl: DEFAULT_API_BASE_URL,
      model: "",
      apiKeyMasked: "",
      apiKey: "",
      temperature: 0.7,
    },
    tts: {
      provider: "Xiaomi MiMo",
      baseUrl: "https://api.xiaomimimo.com/v1",
      model: "mimo-v2.5-tts",
      voiceStrategy: "按角色 voiceStyle 生成音色样本，日常回复使用 voiceclone",
      format: "wav",
      apiKeyMasked: "",
      apiKey: "",
      enabled: false,
    },
    asr: {
      provider: "Local faster-whisper",
      baseUrl: "http://127.0.0.1:9000/v1",
      model: "faster-whisper-small",
      apiKeyMasked: "",
      apiKey: "",
      enabled: false,
    },
    llmAudio: {
      provider: "OpenAI/Kimi Compatible Multimodal LLM",
      baseUrl: "",
      model: "",
      apiKeyMasked: "",
      apiKey: "",
      enabled: false,
    },
    image: {
      provider: "OpenAI Compatible Image API",
      baseUrl: DEFAULT_API_BASE_URL,
      model: "gpt-image-2",
      apiKeyMasked: "",
      apiKey: "",
      enabled: true,
    },
    sticker: {
      provider: "Local tangdouz skill",
      apiUrl: "https://api.tangdouz.com/a/biaoq.php?return=json&nr={keyword}",
      enabled: true,
    },
    runtime: {
      stateFile: "./data/state.json",
      historyFile: "./data/history.json",
      ttsOutputDir: "./data/tts",
      imageOutputDir: "./data/img",
      mediaDir: DEFAULT_MEDIA_DIR,
      debug: false,
      debugTts: false,
    },
    credits: {
      initialBalance: 100,
      dialogueTurnCost: 1,
      textMessageCost: 1,
      voiceMessageCost: 2,
      imageMessageCost: 5,
      stickerMessageCost: 0,
    },
    relationship: {
      dailyCreationLimit: 3,
      breakupCooldownMinutes: [5, 30, 60],
    },
  };
}

export function publicProviderSettings(settings: ProviderSettingsWithSecrets): AdminProviderSettings {
  const { apiKey: llmApiKey, ...llm } = settings.llm;
  const { apiKey: ttsApiKey, ...tts } = settings.tts;
  const { apiKey: asrApiKey, ...asr } = settings.asr;
  const { apiKey: llmAudioApiKey, ...llmAudio } = settings.llmAudio;
  const { apiKey: imageApiKey, ...image } = settings.image;
  return {
    llm: { ...llm, apiKeyMasked: maskSecret(llmApiKey || settings.llm.apiKeyMasked) },
    tts: { ...tts, apiKeyMasked: maskSecret(ttsApiKey || settings.tts.apiKeyMasked) },
    asr: { ...asr, apiKeyMasked: maskSecret(asrApiKey || settings.asr.apiKeyMasked) },
    llmAudio: { ...llmAudio, apiKeyMasked: maskSecret(llmAudioApiKey || settings.llmAudio.apiKeyMasked) },
    image: { ...image, apiKeyMasked: maskSecret(imageApiKey || settings.image.apiKeyMasked) },
    sticker: settings.sticker,
    runtime: settings.runtime,
    credits: settings.credits,
    relationship: settings.relationship,
  };
}

function mergeProviderSettings(defaults: ProviderSettingsWithSecrets, stored: Partial<ProviderSettingsWithSecrets>): ProviderSettingsWithSecrets {
  return {
    ...defaults,
    ...stored,
    llm: { ...defaults.llm, ...stored.llm },
    tts: { ...defaults.tts, ...stored.tts },
    asr: { ...defaults.asr, ...stored.asr },
    llmAudio: { ...defaults.llmAudio, ...stored.llmAudio },
    image: { ...defaults.image, ...stored.image },
    sticker: { ...defaults.sticker, ...stored.sticker },
    runtime: { ...defaults.runtime, ...stored.runtime },
    credits: { ...defaults.credits, ...stored.credits },
    relationship: { ...defaults.relationship, ...stored.relationship },
  };
}

export async function getProviderSettings(): Promise<ProviderSettingsWithSecrets> {
  const defaults = defaultProviderSettings();
  const prisma = getRequiredPrismaClient();
  const row = await prisma.providerSettings.findUnique({ where: { key: providerSettingsKey } });
  if (row) return mergeProviderSettings(defaults, row.data as Partial<ProviderSettingsWithSecrets>);

  await prisma.providerSettings.create({
    data: { key: providerSettingsKey, data: defaults as Prisma.InputJsonValue },
  });
  return defaults;
}

export async function saveProviderSettings(next: AdminProviderSettings): Promise<AdminProviderSettings> {
  const current = await getProviderSettings();
  const saved: ProviderSettingsWithSecrets = {
    ...current,
    ...next,
    llm: { ...current.llm, ...next.llm, apiKey: secretFromMasked(next.llm.apiKeyMasked, current.llm.apiKey) },
    tts: { ...current.tts, ...next.tts, apiKey: secretFromMasked(next.tts.apiKeyMasked, current.tts.apiKey), voiceStrategy: current.tts.voiceStrategy },
    asr: { ...current.asr, ...next.asr, apiKey: secretFromMasked(next.asr.apiKeyMasked, current.asr.apiKey) },
    llmAudio: { ...current.llmAudio, ...next.llmAudio, apiKey: secretFromMasked(next.llmAudio.apiKeyMasked, current.llmAudio.apiKey) },
    image: { ...current.image, ...next.image, apiKey: secretFromMasked(next.image.apiKeyMasked, current.image.apiKey) },
  };

  const prisma = getRequiredPrismaClient();
  await prisma.providerSettings.upsert({
    where: { key: providerSettingsKey },
    create: { key: providerSettingsKey, data: saved as Prisma.InputJsonValue },
    update: { data: saved as Prisma.InputJsonValue },
  });

  return publicProviderSettings(saved);
}

export function applyProviderSettingsToEnv(settings: ProviderSettingsWithSecrets) {
  if (settings.tts.apiKey) process.env.XIAOMI_API_KEY = settings.tts.apiKey;
  if (settings.tts.baseUrl) process.env.XIAOMI_BASE_URL = settings.tts.baseUrl;
  if (settings.tts.model) process.env.XIAOMI_TTS_MODEL = settings.tts.model;
  if (settings.tts.format) process.env.XIAOMI_TTS_FORMAT = settings.tts.format;
  if (settings.image.apiKey) process.env.IMAGE_API_KEY = settings.image.apiKey;
  if (settings.image.baseUrl) process.env.IMAGE_API_BASE = settings.image.baseUrl;
  if (settings.image.model) process.env.IMAGE_MODEL = settings.image.model;
}
