import type {
  AdminUserRow,
  AdminPersonaRow,
  AdminTurnRecord,
  AdminProviderSettings,
  AdminChatRecord,
  ChatMessage,
} from "../types";
import { ACTIVE_MESSAGES, ARCHIVED_MESSAGES } from "./messages";
import { ACTIVE_PERSONA, BROKEN_UP_PERSONAS } from "./persona";

function dayOffset(days: number, hour = 10) {
  const d = new Date("2026-05-15T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d.toISOString();
}

const phones = [
  "13912340001", "13912340002", "13988770003", "13700004404", "13615520005",
  "13912340006", "13900000007", "13821110008", "15901119999", "18800122311",
  "13099210004", "13800007777", "13877655234", "17600009910", "18811223344",
  "13533099011", "13988221177", "13511223344", "13633557788", "17712239900",
  "18800993322", "13888889999", "13900112255", "13755112233", "17633000123",
];

const archetypes = [
  "温柔细腻型", "清冷高敏型", "活泼黏人型", "成熟知性型", "傲娇直球型",
  "笨拙慢热型", "理性克制型", "热烈奔放型",
];

const nicknames = [
  "林夕", "苏念", "知夏", "顾安", "沈嘉", "周屿", "陆离", "白晚",
  "江晚", "宋时", "言知", "顾迟", "唐宁", "魏笙", "陈愿", "陶夭",
  "黎洲", "封姣", "穆晓", "薛宁", "盛梨", "应满", "桑予", "纪寒",
];

const personaStatuses: ("active" | "broken_up" | "reconciliation_pending" | "archived")[] = [
  "active", "broken_up", "active", "broken_up", "broken_up", "active",
  "archived", "active", "reconciliation_pending", "active",
];

function estimateCreditsSpent(messages: ChatMessage[]) {
  return messages.reduce((sum, message) => {
    if (message.role === "user") return sum + 1;
    if (message.role !== "assistant") return sum;
    if (message.type === "text") return sum + 1;
    if (message.type === "voice") return sum + 2;
    if (message.type === "image") return sum + 5;
    return sum;
  }, 0);
}

export const ADMIN_USERS: AdminUserRow[] = phones.map((phone, i) => ({
  id: `u_${1001 + i}`,
  phone,
  createdAt: dayOffset(60 - i),
  lastLoginAt: dayOffset(i % 4, 18),
  status: i === 12 ? "disabled" : i === 19 ? "deleted" : "active",
  credits: i === 0 ? 100 : 40 + ((i * 137) % 2800),
  relationshipStatus:
    i % 9 === 3 ? "cooldown" : personaStatuses[i % personaStatuses.length] === "active" ? "active" : "unassigned",
  activePersonaName:
    i % 9 !== 3 && personaStatuses[i % personaStatuses.length] === "active"
      ? nicknames[i % nicknames.length]
      : null,
  cooldownEndsAt: i % 9 === 3 ? new Date(Date.now() + 18 * 60 * 1000).toISOString() : null,
  totalPersonas: 1 + (i % 4),
  totalMessages: 12 + i * 17,
  totalTurns: 8 + i * 9,
  todayCreationCount: i % 4 === 0 ? 1 : 0,
  isAdmin: i === 0,
}));

export const ADMIN_PERSONAS: AdminPersonaRow[] = Array.from({ length: 36 }, (_, i) => ({
  id: `p_${5001 + i}`,
  userPhone: phones[i % phones.length],
  nickname: nicknames[i % nicknames.length],
  status: personaStatuses[i % personaStatuses.length],
  archetype: archetypes[i % archetypes.length],
  createdAt: dayOffset(40 - i),
  updatedAt: dayOffset(i % 7, 21),
  sessionCount: 8 + i * 3,
  trust: 20 + ((i * 7) % 70),
  closeness: 10 + ((i * 11) % 80),
  stress: (i * 13) % 90,
  affection: 200 + i * 31,
}));

export const ADMIN_TURNS: AdminTurnRecord[] = Array.from({ length: 24 }, (_, i) => {
  const validationStatus = i === 4 ? "fallback" : i === 11 ? "error" : "ok";
  return {
    id: `t_${9001 + i}`,
    personaId: ADMIN_PERSONAS[i % ADMIN_PERSONAS.length].id,
    personaName: ADMIN_PERSONAS[i % ADMIN_PERSONAS.length].nickname,
    userPhone: ADMIN_PERSONAS[i % ADMIN_PERSONAS.length].userPhone,
    userMessage: [
      "在吗",
      "今天上班好累",
      "怎么不理我了",
      "我刚才路过那家奶茶店",
      "你睡了没",
      "我们好像很久没好好聊天了",
      "下周可以陪我一起逛书店吗",
      "好啦不闹了",
    ][i % 8],
    visibleText: [
      "嗯,在。",
      "辛苦你了,要不先去洗个热水澡?",
      "没有,我刚刚在收稿子,正想找你来着。",
      "诶,买了吗,要那家招牌的那杯吗。",
      "还没,你呢,要我陪你聊一会儿吗。",
      "嗯......我也有点这个感觉。",
      "好啊,但你不许又拖到最后一刻。",
      "嗯,知道你不是真的生气了。",
    ][i % 8],
    currentEmotion: [
      "平静",
      "心疼夹一点担心",
      "略带困意但被逗笑",
      "好奇且温暖",
      "安静下来",
      "有点失落但克制",
      "认真,带一点期待",
      "释然",
    ][i % 8],
    sendVoiceNow: i % 5 === 0,
    sendImageNow: i % 7 === 0,
    sendGifNow: i % 9 === 0,
    validationStatus,
    latencyMs: 920 + (i * 137) % 1800,
    createdAt: dayOffset(i % 10, 14 + (i % 6)),
    stateDelta: {
      trust: "neutral",
      security: i % 6 === 0 ? "minor_decrease" : "neutral",
      closeness: i % 3 === 0 ? "minor_increase" : "neutral",
      neediness: "neutral",
      possessiveness: "neutral",
    },
    stressDelta: i % 4 === 0 ? "minor_decrease" : "neutral",
  };
});

export const ADMIN_CHATS: AdminChatRecord[] = [
  {
    id: "chat_active_self",
    userId: "u_self",
    userPhone: "13912340000",
    personaId: ACTIVE_PERSONA.id,
    personaName: ACTIVE_PERSONA.nickname,
    personaStatus: ACTIVE_PERSONA.status,
    messageCount: ACTIVE_MESSAGES.length,
    creditsSpent: estimateCreditsSpent(ACTIVE_MESSAGES),
    lastMessagePreview: "嗯,记得带个外套,听说今晚降温。",
    lastMessageAt: ACTIVE_MESSAGES.at(-1)?.createdAt ?? dayOffset(0),
    messages: ACTIVE_MESSAGES,
  },
  ...BROKEN_UP_PERSONAS.map((persona) => {
    const messages = ARCHIVED_MESSAGES[persona.id] ?? [];
    return {
      id: `chat_archived_${persona.id}`,
      userId: "u_self",
      userPhone: "13912340000",
      personaId: persona.id,
      personaName: persona.nickname,
      personaStatus: persona.status,
      messageCount: messages.length,
      creditsSpent: estimateCreditsSpent(messages),
      lastMessagePreview: messages.findLast((m) => m.text)?.text ?? "历史聊天",
      lastMessageAt: messages.at(-1)?.createdAt ?? persona.updatedAt,
      messages,
    };
  }),
  ...ADMIN_PERSONAS.slice(2, 14).map((persona, i) => {
    const messages = ACTIVE_MESSAGES.slice(1, 7).map((message, index) => ({
      ...message,
      id: `${persona.id}_${message.id}_${index}`,
      personaId: persona.id,
      createdAt: dayOffset(i % 8, 12 + index),
    }));
    return {
      id: `chat_${persona.id}`,
      userId: `u_${1003 + i}`,
      userPhone: persona.userPhone,
      personaId: persona.id,
      personaName: persona.nickname,
      personaStatus: persona.status,
      messageCount: 24 + i * 7,
      creditsSpent: estimateCreditsSpent(messages),
      lastMessagePreview: messages.at(-1)?.text ?? "最近有一次聊天",
      lastMessageAt: messages.at(-1)?.createdAt ?? dayOffset(i),
      messages,
    };
  }),
];

export const ADMIN_SETTINGS: AdminProviderSettings = {
  llm: {
    provider: "OpenAI Compatible",
    baseUrl: "https://api.openai.com/v1",
    model: "deepseek-r1-distill",
    apiKeyMasked: "sk-****8821",
    temperature: 0.7,
  },
  tts: {
    provider: "Xiaomi MiMo",
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-tts",
    voiceStrategy: "按角色 voiceStyle 生成音色样本，日常回复使用 voiceclone",
    format: "wav",
    apiKeyMasked: "xiaomi-****a7d2",
    enabled: true,
  },
  asr: {
    provider: "Local faster-whisper",
    baseUrl: "http://127.0.0.1:9000/v1",
    model: "faster-whisper-small",
    apiKeyMasked: "local-****asr",
    enabled: false,
  },
  llmAudio: {
    provider: "OpenAI/Kimi Compatible Multimodal LLM",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-audio-preview",
    apiKeyMasked: "sk-****audio",
    enabled: false,
  },
  image: {
    provider: "OpenAI Compatible Image API",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-2",
    apiKeyMasked: "img-****91fe",
    enabled: true,
  },
  sticker: {
    provider: "tangdouz API",
    apiUrl: "https://api.tangdouz.com/a/biaoq.php?return=json&nr={keyword}",
    enabled: true,
  },
  runtime: {
    stateFile: "./data/state.json",
    historyFile: "./data/history.json",
    ttsOutputDir: "./data/tts",
    imageOutputDir: "./data/img",
    mediaDir: ".cyberpersona-media",
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

export const ADMIN_OVERVIEW = {
  totalUsers: 2147,
  activeUsers7d: 813,
  activePersonas: 1188,
  brokenUpPersonas: 974,
  messagesToday: 41203,
  turnsToday: 21071,
  creditsConsumedToday: 52417,
  usersInCooldown: 128,
  fallbackRate: 0.018,
  errorRate: 0.004,
};
