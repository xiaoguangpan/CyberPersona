import type { ChatMessage, Persona } from "@/lib/types";
import { getProviderSettings } from "@/lib/cyberpersona/provider-settings";
import { buildRecentHistory, createFallback, TurnOutput, validateTurnOutput } from "@/lib/cyberpersona/turn";
import { recordCall } from "@/lib/cyberpersona/call-logs";

const turnSchema = `{
  "analysis": "string",
  "visibleText": "string",
  "currentEmotion": "string",
  "sendVoiceNow": false,
  "sendImageNow": false,
  "imagePrompt": "",
  "imageCaption": "",
  "imageWaitText": "",
  "imageFailedText": "",
  "useReferencePhoto": false,
  "sendGifNow": false,
  "gifKeyword": "",
  "stateDelta": {"trust":"neutral","security":"neutral","closeness":"neutral","neediness":"neutral","possessiveness":"neutral"},
  "stressDelta": "neutral",
  "shortTermUpdate": {"unresolvedEmotion":"","emotionTrigger":"","interactionTrend":"","recentVoicePattern":"","recentImagePattern":""},
  "memoryUpdate": {"nicknameForUser":null,"nicknameForSelf":null,"sharedRoutinesAdd":[],"revealedFactsAdd":[],"importantEventsAdd":[],"lastSummary":"","emotionalMemoriesAdd":[],"locationUpdate":null,"vulnerabilityTopicsAdd":null},
  "characterCardUpdate": {"identity":{},"physicalTraits":{},"personalitySelfDescription":{},"preferences":{},"innerWorld":{},"habits":{},"memories":{"events":[],"milestones":[],"gifts":[]}}
}`;

function summarizeMemory(persona: Persona) {
  const memory = persona.memory;
  if (!memory) return "";
  const lines: string[] = [];
  if (memory.lastSummary) lines.push(`最近 session 摘要：${memory.lastSummary}`);
  if (memory.nicknameForUser) lines.push(`她对你的称呼：${memory.nicknameForUser}`);
  if (memory.nicknameForSelf) lines.push(`她自称：${memory.nicknameForSelf}`);
  if (memory.revealedFacts.length) {
    lines.push(`已确认事实：${memory.revealedFacts.slice(-10).map((fact) => `${fact.key}=${fact.value}`).join("；")}`);
  }
  if (memory.emotionalMemories.length) {
    lines.push(`情绪记忆：${memory.emotionalMemories.slice(-6).map((item) => `${item.topic}-${item.content}`).join("；")}`);
  }
  if (memory.importantEvents.length) {
    lines.push(`关键事件：${memory.importantEvents.slice(-6).map((item) => item.event).join("；")}`);
  }
  if (memory.vulnerabilityTopics.length) {
    lines.push(`脆弱话题：${memory.vulnerabilityTopics.slice(-6).map((item) => item.topic).join("；")}`);
  }
  if (memory.location?.current) lines.push(`当前位置：${memory.location.current}`);
  return lines.join("\n");
}

function summarizeShortTerm(persona: Persona) {
  const st = persona.shortTerm;
  if (!st) return "";
  const lines: string[] = [];
  if (st.unresolvedEmotion) lines.push(`未解情绪：${st.unresolvedEmotion}`);
  if (st.emotionTrigger) lines.push(`上次情绪触发：${st.emotionTrigger}`);
  if (st.interactionTrend) lines.push(`互动趋势：${st.interactionTrend}`);
  if (st.recentVoicePattern) lines.push(`最近语音模式：${st.recentVoicePattern}`);
  if (st.recentImagePattern) lines.push(`最近发图模式：${st.recentImagePattern}`);
  return lines.join("\n");
}

function summarizeCharacterCard(persona: Persona) {
  const card = persona.characterCard;
  const lines: string[] = [];
  const identity = Object.entries(card.identity).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`);
  if (identity.length) lines.push(`身份：${identity.join("；")}`);
  const habits = Object.entries(card.habits).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`);
  if (habits.length) lines.push(`习惯：${habits.join("；")}`);
  const preferences = Object.entries(card.preferences).filter(([, value]) => value).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("/") : value}`);
  if (preferences.length) lines.push(`偏好：${preferences.join("；")}`);
  const memories = card.memories;
  if (memories.events.length) lines.push(`共同事件：${memories.events.slice(-6).join("；")}`);
  if (memories.milestones.length) lines.push(`里程碑：${memories.milestones.slice(-6).join("；")}`);
  return lines.join("\n");
}

function buildSystemPrompt(persona: Persona) {
  const card = persona.characterCard;
  const appearance = card.appearance;
  const memorySummary = summarizeMemory(persona);
  const shortTermSummary = summarizeShortTerm(persona);
  const cardSummary = summarizeCharacterCard(persona);
  return [
    "你是一个有独立性格的赛博女友角色。请基于角色卡和当前关系状态，自然地回应用户消息。",
    "真实感优先于讨好感，不要做模板化甜妹，避免无意义客套。",
    "角色有自己的日常生活和可变场景：可以自然地在家、路上、咖啡馆、书店、公园、泳池边等安全合理场景之间移动；不要因为早期一句话就长期固定在同一个地点或动作。",
    "长期记忆/角色卡里的地点、动作、最近发图模式只作为参考，不是当前必须重复的场景；除非用户刚刚明确要求或关系状态强烈需要，否则主动换一个符合角色性格的当下生活片段。",
    "如果用户提出你明确不愿意的请求，可以拒绝并解释边界；但拒绝应基于角色意愿和关系状态，而不是机械退回某个固定场景。",
    "临时场景、姿势、当天在做什么、某次照片背景，通常不要写入 habits/preferences/memories；只有反复出现且确认为长期偏好/习惯时才写入。",
    "",
    `角色基本设定：性格原型 ${card.systemBase.personalityArchetype || "未设定"}。`,
    appearance.hair ? `外貌：${[appearance.hair, appearance.skin, appearance.eye, appearance.bodyType].filter(Boolean).join("，")}。` : "",
    card.voice.voiceStyle ? `声音风格：${card.voice.voiceStyle}` : "",
    `当前情绪：${persona.currentEmotion || "平静"}。`,
    `当前关系数值（0-100）：信任 ${persona.dynamicState.trust}，安全感 ${persona.dynamicState.security}，亲密度 ${persona.dynamicState.closeness}，需要感 ${persona.dynamicState.neediness}，独占欲 ${persona.dynamicState.possessiveness}。压力值 ${persona.stress}。`,
    cardSummary ? `\n【角色卡已确认信息】\n${cardSummary}` : "",
    memorySummary ? `\n【长期记忆】\n${memorySummary}` : "",
    shortTermSummary ? `\n【短期心境】\n${shortTermSummary}` : "",
    "",
    "stateDelta 与 stressDelta 只能填这五个枚举之一：major_decrease/minor_decrease/neutral/minor_increase/major_increase。绝大多数普通对话是 neutral 或 minor 变化。",
    "如果你打算用语音回复，把 sendVoiceNow 设为 true；如果想发自拍/照片，把 sendImageNow 设为 true，并填 imagePrompt（英文，含外貌一致性、服装、姿势、场景）和 imageCaption；如果想发表情包，把 sendGifNow 设为 true 并填 gifKeyword（中文）。",
    "只要 visibleText 表示“我发了/发给你/直接发/你先看照片/这张是刚拍的”等已经发送或马上发送照片的意思，sendImageNow 必须为 true，imagePrompt 不能为空；如果不准备发图，visibleText 里不要说已经发了或让用户看照片。",
    "当你在对话中自然提到关于自己的新信息时，必须同步写入结构化更新，不能只写在 visibleText 里。身份类字段写入 characterCardUpdate.identity：name=名字，age=年龄，hometown=家乡/老家/来自哪里，profession=职业/工作；偏好、口头禅、共同回忆等写入 characterCardUpdate 或 memoryUpdate.revealedFactsAdd；情绪、未解心结、互动趋势写入 shortTermUpdate。",
    "已经写过的事实保持一致，不要重复写入。",
    "",
    "只输出严格 JSON，不要解释。字段示例：",
    turnSchema,
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(history: ReturnType<typeof buildRecentHistory>, userMessage: string) {
  const lines = ["最近的对话片段（按时间）："];
  for (const entry of history) {
    const role = entry.role === "user" ? "用户" : entry.role === "assistant" ? "你" : "系统";
    lines.push(`${role}：${entry.text}`);
  }
  lines.push("", `当前用户消息：${userMessage}`);
  lines.push("", "请基于上述上下文输出 JSON，仅输出 JSON 本身。");
  return lines.join("\n");
}

function tryParseJson(content: string): unknown {
  if (!content) return null;
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export type RunTurnInput = {
  persona: Persona;
  messages: ChatMessage[];
  userMessage: string;
  source?: string;
};

export type RunTurnResult = {
  turn: TurnOutput;
  status: "llm_ok" | "llm_invalid" | "llm_unconfigured" | "llm_error";
  raw?: string;
  latencyMs: number;
};

export async function runTurnWithLlm({ persona, messages, userMessage, source }: RunTurnInput): Promise<RunTurnResult> {
  const start = Date.now();
  const settings = await getProviderSettings();
  const baseUrl = settings.llm.baseUrl?.trim().replace(/\/+$/, "");
  const apiKey = settings.llm.apiKey;
  const model = settings.llm.model;
  const logSource = source || "chat-turn";
  if (!baseUrl || !apiKey || !model) {
    const durationMs = Date.now() - start;
    await recordCall({
      type: "llm",
      provider: settings.llm.provider || "unknown",
      source: logSource,
      startedAt: start,
      durationMs,
      streaming: false,
      status: "unconfigured",
      inputSummary: userMessage,
      outputSummary: "",
      errorMessage: "LLM 未配置：缺少 baseUrl / apiKey / model",
      request: { baseUrl, model, hasApiKey: Boolean(apiKey) },
    });
    return {
      turn: createFallback(userMessage),
      status: "llm_unconfigured",
      latencyMs: durationMs,
    };
  }
  const history = buildRecentHistory(messages, 12);
  const body = {
    model,
    stream: false,
    temperature: settings.llm.temperature ?? 0.7,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: buildSystemPrompt(persona) },
      { role: "user", content: buildUserPrompt(history, userMessage) },
    ],
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const durationMs = Date.now() - start;
      await recordCall({
        type: "llm",
        provider: settings.llm.provider || "unknown",
        source: logSource,
        startedAt: start,
        durationMs,
        streaming: false,
        status: "error",
        inputSummary: userMessage,
        outputSummary: "",
        errorMessage: `HTTP ${response.status} ${detail.slice(0, 240)}`,
        request: { url: `${baseUrl}/chat/completions`, body },
        response: { status: response.status, body: detail.slice(0, 4000) },
      });
      return {
        turn: createFallback(userMessage),
        status: "llm_error",
        latencyMs: durationMs,
      };
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseJson(content);
    const validated = validateTurnOutput(parsed);
    if (!validated.ok) {
      const durationMs = Date.now() - start;
      await recordCall({
        type: "llm",
        provider: settings.llm.provider || "unknown",
        source: logSource,
        startedAt: start,
        durationMs,
        streaming: false,
        status: "fallback",
        inputSummary: userMessage,
        outputSummary: content,
        errorMessage: "LLM 输出不符合 schema，已使用兜底回复",
        request: { url: `${baseUrl}/chat/completions`, body },
        response: data,
      });
      return {
        turn: createFallback(userMessage),
        status: "llm_invalid",
        raw: content.slice(0, 800),
        latencyMs: durationMs,
      };
    }
    const durationMs = Date.now() - start;
    await recordCall({
      type: "llm",
      provider: settings.llm.provider || "unknown",
      source: logSource,
      startedAt: start,
      durationMs,
      streaming: false,
      status: "ok",
      inputSummary: userMessage,
      outputSummary: validated.value.visibleText || content,
      request: { url: `${baseUrl}/chat/completions`, body },
      response: data,
    });
    return {
      turn: validated.value,
      status: "llm_ok",
      raw: content.slice(0, 800),
      latencyMs: durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    await recordCall({
      type: "llm",
      provider: settings.llm.provider || "unknown",
      source: logSource,
      startedAt: start,
      durationMs,
      streaming: false,
      status: "error",
      inputSummary: userMessage,
      outputSummary: "",
      errorMessage: error instanceof Error ? error.message : "未知错误",
      request: { url: `${baseUrl}/chat/completions`, body },
    });
    return {
      turn: createFallback(userMessage),
      status: "llm_error",
      latencyMs: durationMs,
    };
  } finally {
    clearTimeout(timeout);
  }
}
