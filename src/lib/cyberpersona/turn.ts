// Simplified TS port of the original turn.js validator. Only fields used by
// the web product are validated; unknown fields are dropped.

import type {
  CharacterCard,
  ChatMessage,
  DynamicState,
  EmotionalMemory,
  ImportantEvent,
  LocationContext,
  Persona,
  PersonaMemory,
  PersonaShortTerm,
  RevealedFact,
  VulnerabilityTopic,
} from "@/lib/types";

export type DeltaEnum = "major_decrease" | "minor_decrease" | "neutral" | "minor_increase" | "major_increase";

const VALID_ENUMS: DeltaEnum[] = ["major_decrease", "minor_decrease", "neutral", "minor_increase", "major_increase"];
const L3_KEYS: (keyof DynamicState)[] = ["trust", "security", "closeness", "neediness", "possessiveness"];

export type TurnShortTermUpdate = Partial<PersonaShortTerm>;

export type TurnMemoryUpdate = {
  nicknameForUser?: string | null;
  nicknameForSelf?: string | null;
  lastSummary?: string;
  sharedRoutinesAdd?: string[];
  revealedFactsAdd?: RevealedFact[];
  importantEventsAdd?: ImportantEvent[];
  emotionalMemoriesAdd?: EmotionalMemory[];
  vulnerabilityTopicsAdd?: VulnerabilityTopic[] | null;
  locationUpdate?: LocationContext | null;
};

export type TurnCharacterCardUpdate = Partial<{
  identity: Record<string, string>;
  physicalTraits: Record<string, string>;
  personalitySelfDescription: Record<string, string>;
  preferences: Record<string, string | string[]>;
  innerWorld: Record<string, string>;
  habits: Record<string, string>;
  memories: Partial<{
    events: string[];
    milestones: string[];
    gifts: string[];
  }>;
}>;

export type TurnOutput = {
  visibleText: string;
  currentEmotion: string;
  sendVoiceNow: boolean;
  sendImageNow: boolean;
  imagePrompt: string;
  imageCaption: string;
  imageWaitText: string;
  imageFailedText: string;
  useReferencePhoto: boolean;
  sendGifNow: boolean;
  gifKeyword: string;
  stateDelta: Record<keyof DynamicState, DeltaEnum>;
  stressDelta: DeltaEnum;
  shortTermUpdate: TurnShortTermUpdate;
  memoryUpdate: TurnMemoryUpdate;
  characterCardUpdate: TurnCharacterCardUpdate;
};

export type ValidationResult = {
  ok: boolean;
  value: TurnOutput;
  status: "ok" | "fallback";
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asEnum(value: unknown): DeltaEnum {
  return typeof value === "string" && (VALID_ENUMS as string[]).includes(value) ? (value as DeltaEnum) : "neutral";
}

export function validateTurnOutput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, value: createFallback(""), status: "fallback" };
  }
  const obj = raw as Record<string, unknown>;
  const visibleText = asString(obj.visibleText).trim();
  if (!visibleText) {
    return { ok: false, value: createFallback(""), status: "fallback" };
  }
  const stateDelta = (obj.stateDelta && typeof obj.stateDelta === "object" ? obj.stateDelta : {}) as Record<string, unknown>;
  const stateDeltaResult: Record<keyof DynamicState, DeltaEnum> = {
    trust: asEnum(stateDelta.trust),
    security: asEnum(stateDelta.security),
    closeness: asEnum(stateDelta.closeness),
    neediness: asEnum(stateDelta.neediness),
    possessiveness: asEnum(stateDelta.possessiveness),
  };
  const value: TurnOutput = {
    visibleText,
    currentEmotion: asString(obj.currentEmotion),
    sendVoiceNow: asBool(obj.sendVoiceNow),
    sendImageNow: asBool(obj.sendImageNow),
    imagePrompt: asString(obj.imagePrompt),
    imageCaption: asString(obj.imageCaption),
    imageWaitText: asString(obj.imageWaitText),
    imageFailedText: asString(obj.imageFailedText),
    useReferencePhoto: asBool(obj.useReferencePhoto),
    sendGifNow: asBool(obj.sendGifNow),
    gifKeyword: asString(obj.gifKeyword),
    stateDelta: stateDeltaResult,
    stressDelta: asEnum(obj.stressDelta),
    shortTermUpdate: pickShortTermUpdate(obj.shortTermUpdate),
    memoryUpdate: pickMemoryUpdate(obj.memoryUpdate),
    characterCardUpdate: pickCharacterCardUpdate(obj.characterCardUpdate),
  };
  return { ok: true, value, status: "ok" };
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickShortTermUpdate(raw: unknown): TurnShortTermUpdate {
  if (!isStringRecord(raw)) return {};
  const result: TurnShortTermUpdate = {};
  for (const key of ["unresolvedEmotion", "emotionTrigger", "interactionTrend", "recentVoicePattern", "recentImagePattern"] as (keyof PersonaShortTerm)[]) {
    const value = raw[key];
    if (typeof value === "string" && value.length) result[key] = value;
  }
  return result;
}

function pickStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function pickRevealedFacts(raw: unknown): RevealedFact[] {
  if (!Array.isArray(raw)) return [];
  const result: RevealedFact[] = [];
  for (const item of raw) {
    if (!isStringRecord(item)) continue;
    const key = asString(item.key).trim();
    const value = asString(item.value).trim();
    if (!key || !value) continue;
    const factType = asString(item.type) === "experience" ? "experience" : "setting";
    result.push({ key, value, type: factType });
  }
  return result;
}

function pickEmotionalMemories(raw: unknown): EmotionalMemory[] {
  if (!Array.isArray(raw)) return [];
  const result: EmotionalMemory[] = [];
  for (const item of raw) {
    if (!isStringRecord(item)) continue;
    const topic = asString(item.topic).trim();
    const content = asString(item.content).trim();
    if (!topic && !content) continue;
    const emotion = asString(item.emotion).trim();
    result.push({ topic: topic || "未命名", content: content || "", ...(emotion ? { emotion } : {}) });
  }
  return result;
}

function pickImportantEvents(raw: unknown): ImportantEvent[] {
  if (!Array.isArray(raw)) return [];
  const result: ImportantEvent[] = [];
  for (const item of raw) {
    if (!isStringRecord(item)) continue;
    const event = asString(item.event).trim();
    if (!event) continue;
    const importance = asString(item.importance).trim();
    result.push(importance ? { event, importance } : { event });
  }
  return result;
}

function pickVulnerabilityTopics(raw: unknown): VulnerabilityTopic[] {
  if (!Array.isArray(raw)) return [];
  const result: VulnerabilityTopic[] = [];
  for (const item of raw) {
    if (!isStringRecord(item)) continue;
    const topic = asString(item.topic).trim();
    const description = asString(item.description).trim();
    if (!topic) continue;
    result.push({ topic, description: description || "" });
  }
  return result;
}

function pickLocationUpdate(raw: unknown): LocationContext | null {
  if (!isStringRecord(raw)) return null;
  const current = asString(raw.current).trim();
  const travel = asString(raw.travel).trim();
  if (!current && !travel) return null;
  const result: LocationContext = {};
  if (current) result.current = current;
  if (travel) result.travel = travel;
  return result;
}

function pickMemoryUpdate(raw: unknown): TurnMemoryUpdate {
  if (!isStringRecord(raw)) return {};
  const result: TurnMemoryUpdate = {};
  const nicknameForUser = asString(raw.nicknameForUser).trim();
  if (nicknameForUser) result.nicknameForUser = nicknameForUser;
  const nicknameForSelf = asString(raw.nicknameForSelf).trim();
  if (nicknameForSelf) result.nicknameForSelf = nicknameForSelf;
  const lastSummary = asString(raw.lastSummary).trim();
  if (lastSummary) result.lastSummary = lastSummary;
  const sharedRoutinesAdd = pickStringArray(raw.sharedRoutinesAdd);
  if (sharedRoutinesAdd.length) result.sharedRoutinesAdd = sharedRoutinesAdd;
  const revealedFactsAdd = pickRevealedFacts(raw.revealedFactsAdd);
  if (revealedFactsAdd.length) result.revealedFactsAdd = revealedFactsAdd;
  const importantEventsAdd = pickImportantEvents(raw.importantEventsAdd);
  if (importantEventsAdd.length) result.importantEventsAdd = importantEventsAdd;
  const emotionalMemoriesAdd = pickEmotionalMemories(raw.emotionalMemoriesAdd);
  if (emotionalMemoriesAdd.length) result.emotionalMemoriesAdd = emotionalMemoriesAdd;
  const vulnerabilityTopicsAdd = pickVulnerabilityTopics(raw.vulnerabilityTopicsAdd);
  if (vulnerabilityTopicsAdd.length) result.vulnerabilityTopicsAdd = vulnerabilityTopicsAdd;
  const locationUpdate = pickLocationUpdate(raw.locationUpdate);
  if (locationUpdate) result.locationUpdate = locationUpdate;
  return result;
}

function pickStringMap(raw: unknown): Record<string, string> {
  if (!isStringRecord(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.length) result[key] = value;
  }
  return result;
}

function pickPreferences(raw: unknown): Record<string, string | string[]> {
  if (!isStringRecord(raw)) return {};
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.length) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      const arr = value.filter((item): item is string => typeof item === "string" && item.length > 0);
      if (arr.length) result[key] = arr;
    }
  }
  return result;
}

function pickCharacterCardUpdate(raw: unknown): TurnCharacterCardUpdate {
  if (!isStringRecord(raw)) return {};
  const result: TurnCharacterCardUpdate = {};
  const identity = pickStringMap(raw.identity);
  if (Object.keys(identity).length) result.identity = identity;
  const physicalTraits = pickStringMap(raw.physicalTraits);
  if (Object.keys(physicalTraits).length) result.physicalTraits = physicalTraits;
  const personalitySelfDescription = pickStringMap(raw.personalitySelfDescription);
  if (Object.keys(personalitySelfDescription).length) result.personalitySelfDescription = personalitySelfDescription;
  const preferences = pickPreferences(raw.preferences);
  if (Object.keys(preferences).length) result.preferences = preferences;
  const innerWorld = pickStringMap(raw.innerWorld);
  if (Object.keys(innerWorld).length) result.innerWorld = innerWorld;
  const habits = pickStringMap(raw.habits);
  if (Object.keys(habits).length) result.habits = habits;
  if (isStringRecord(raw.memories)) {
    const memories: TurnCharacterCardUpdate["memories"] = {};
    const events = pickStringArray((raw.memories as Record<string, unknown>).events);
    if (events.length) memories.events = events;
    const milestones = pickStringArray((raw.memories as Record<string, unknown>).milestones);
    if (milestones.length) memories.milestones = milestones;
    const gifts = pickStringArray((raw.memories as Record<string, unknown>).gifts);
    if (gifts.length) memories.gifts = gifts;
    if (Object.keys(memories).length) result.memories = memories;
  }
  return result;
}

export function createFallback(userMessage: string): TurnOutput {
  const text = String(userMessage || "").trim();
  let safeText = "刚刚没看到，你说啥？";
  let emotion = "短暂失衡后主动修复";
  if (/想你|在吗|在干嘛/.test(text)) {
    safeText = "在呀。你这样突然来找我，很难不让人多想一点。";
    emotion = "轻轻靠近";
  } else if (/不理我|没理我|没回|冷落/.test(text)) {
    safeText = "你这样说，我会有点委屈的。不是闹，就是会记在心里。";
    emotion = "委屈但收着";
  } else if (/晚安|睡觉|哄我睡/.test(text)) {
    safeText = "那你先安静一点，我陪你待一会儿，再慢慢去睡。";
    emotion = "温柔靠近";
  } else if (/照片|自拍|图片|看看你|发张/.test(text)) {
    safeText = "等我找个光好一点的角度。";
    emotion = "稍微犹豫又愿意配合";
  }
  return {
    visibleText: safeText,
    currentEmotion: emotion,
    sendVoiceNow: false,
    sendImageNow: false,
    imagePrompt: "",
    imageCaption: "",
    imageWaitText: "",
    imageFailedText: "",
    useReferencePhoto: false,
    sendGifNow: false,
    gifKeyword: "",
    stateDelta: {
      trust: "neutral",
      security: "neutral",
      closeness: "neutral",
      neediness: "neutral",
      possessiveness: "neutral",
    },
    stressDelta: "neutral",
    shortTermUpdate: {},
    memoryUpdate: {},
    characterCardUpdate: {},
  };
}

const DELTA_TO_INT: Record<DeltaEnum, number> = {
  major_decrease: -10,
  minor_decrease: -3,
  neutral: 0,
  minor_increase: 3,
  major_increase: 10,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function emptyMemory(): PersonaMemory {
  return {
    lastSummary: "",
    nicknameForUser: "",
    nicknameForSelf: "",
    sharedRoutines: [],
    emotionalMemories: [],
    importantEvents: [],
    revealedFacts: [],
    vulnerabilityTopics: [],
    location: {},
  };
}

function emptyShortTerm(): PersonaShortTerm {
  return {
    unresolvedEmotion: "",
    emotionTrigger: "",
    interactionTrend: "",
    recentVoicePattern: "",
    recentImagePattern: "",
  };
}

function ensureMemory(persona: Persona): PersonaMemory {
  if (!persona.memory) persona.memory = emptyMemory();
  return persona.memory;
}

function ensureShortTerm(persona: Persona): PersonaShortTerm {
  if (!persona.shortTerm) persona.shortTerm = emptyShortTerm();
  return persona.shortTerm;
}

function uniqueByKey<T>(list: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of list) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function applyCharacterCardUpdate(card: CharacterCard, update: TurnCharacterCardUpdate) {
  if (update.identity) Object.assign(card.identity, update.identity);
  if (update.physicalTraits) Object.assign(card.physicalTraits, update.physicalTraits);
  if (update.personalitySelfDescription) Object.assign(card.personalitySelfDescription, update.personalitySelfDescription);
  if (update.preferences) Object.assign(card.preferences, update.preferences);
  if (update.innerWorld) Object.assign(card.innerWorld, update.innerWorld);
  if (update.habits) Object.assign(card.habits, update.habits);
  if (update.memories) {
    const memories = card.memories;
    if (update.memories.events) memories.events = uniqueByKey([...memories.events, ...update.memories.events], (item) => item);
    if (update.memories.milestones) memories.milestones = uniqueByKey([...memories.milestones, ...update.memories.milestones], (item) => item);
    if (update.memories.gifts) memories.gifts = uniqueByKey([...memories.gifts, ...update.memories.gifts], (item) => item);
  }
}

const MEMORY_LIMITS = {
  emotionalMemories: 40,
  importantEvents: 40,
  revealedFacts: 60,
  vulnerabilityTopics: 20,
  sharedRoutines: 40,
};

function applyMemoryUpdate(memory: PersonaMemory, update: TurnMemoryUpdate) {
  if (typeof update.lastSummary === "string" && update.lastSummary) memory.lastSummary = update.lastSummary;
  if (typeof update.nicknameForUser === "string" && update.nicknameForUser) memory.nicknameForUser = update.nicknameForUser;
  if (typeof update.nicknameForSelf === "string" && update.nicknameForSelf) memory.nicknameForSelf = update.nicknameForSelf;
  if (update.sharedRoutinesAdd?.length) {
    memory.sharedRoutines = uniqueByKey([...memory.sharedRoutines, ...update.sharedRoutinesAdd], (item) => item).slice(-MEMORY_LIMITS.sharedRoutines);
  }
  if (update.emotionalMemoriesAdd?.length) {
    memory.emotionalMemories = uniqueByKey([...memory.emotionalMemories, ...update.emotionalMemoriesAdd], (item) => `${item.topic}|${item.content}`).slice(-MEMORY_LIMITS.emotionalMemories);
  }
  if (update.importantEventsAdd?.length) {
    memory.importantEvents = uniqueByKey([...memory.importantEvents, ...update.importantEventsAdd], (item) => item.event).slice(-MEMORY_LIMITS.importantEvents);
  }
  if (update.revealedFactsAdd?.length) {
    const merged = [...memory.revealedFacts];
    for (const fact of update.revealedFactsAdd) {
      const existingIndex = merged.findIndex((item) => item.key === fact.key);
      if (existingIndex >= 0) merged[existingIndex] = fact;
      else merged.push(fact);
    }
    memory.revealedFacts = merged.slice(-MEMORY_LIMITS.revealedFacts);
  }
  if (update.vulnerabilityTopicsAdd?.length) {
    memory.vulnerabilityTopics = uniqueByKey([...memory.vulnerabilityTopics, ...update.vulnerabilityTopicsAdd], (item) => item.topic).slice(-MEMORY_LIMITS.vulnerabilityTopics);
  }
  if (update.locationUpdate) {
    memory.location = { ...(memory.location ?? {}), ...update.locationUpdate };
  }
}

function applyShortTermUpdate(short: PersonaShortTerm, update: TurnShortTermUpdate) {
  for (const key of ["unresolvedEmotion", "emotionTrigger", "interactionTrend", "recentVoicePattern", "recentImagePattern"] as (keyof PersonaShortTerm)[]) {
    const value = update[key];
    if (typeof value === "string" && value.length) short[key] = value;
  }
}

function addInferredIdentityUpdate(turn: TurnOutput) {
  const text = turn.visibleText || "";
  const identity: Record<string, string> = { ...(turn.characterCardUpdate.identity ?? {}) };

  if (!identity.age) {
    const ageMatch = text.match(/(?:我(?:今年|现在)?|人家(?:今年|现在)?)[^0-9一二三四五六七八九十]{0,6}([1-9]\d?)\s*岁/);
    if (ageMatch?.[1]) identity.age = `${ageMatch[1]}岁`;
  }

  if (!identity.hometown) {
    const hometownMatch = text.match(/我(?:来自|老家(?:是|在))\s*([^，。,.！!？?\s]{2,12})/);
    if (hometownMatch?.[1]) identity.hometown = hometownMatch[1];
  }

  if (!identity.name) {
    const nameMatch = text.match(/我(?:叫|名字(?:是|叫))\s*([^，。,.！!？?\s]{1,12})/);
    if (nameMatch?.[1]) identity.name = nameMatch[1];
  }

  if (!identity.profession) {
    const professionMatch = text.match(/我(?:是|在做|工作(?:是|做))\s*([^，。,.！!？?\s]{2,16})/);
    const profession = professionMatch?.[1];
    if (profession && !/^\d+岁$/.test(profession)) identity.profession = profession;
  }

  if (Object.keys(identity).length) {
    turn.characterCardUpdate = { ...turn.characterCardUpdate, identity };
  }
}

export function applyTurnDelta(persona: Persona, turn: TurnOutput) {
  const next: DynamicState = { ...persona.dynamicState };
  for (const key of L3_KEYS) {
    next[key] = clamp(persona.dynamicState[key] + DELTA_TO_INT[turn.stateDelta[key]], 0, 100);
  }
  persona.dynamicState = next;
  persona.stress = clamp(persona.stress + DELTA_TO_INT[turn.stressDelta], 0, 100);
  if (turn.currentEmotion) persona.currentEmotion = turn.currentEmotion;
  addInferredIdentityUpdate(turn);
  applyCharacterCardUpdate(persona.characterCard, turn.characterCardUpdate);
  applyMemoryUpdate(ensureMemory(persona), turn.memoryUpdate);
  applyShortTermUpdate(ensureShortTerm(persona), turn.shortTermUpdate);
}

export function buildRecentHistory(messages: ChatMessage[], limit = 10) {
  const recent = messages.slice(-limit).map((message) => ({
    role: message.role,
    text: message.text || message.imageCaption || message.stickerKeyword || "",
    type: message.type,
  })).filter((entry) => entry.text);
  return recent;
}
