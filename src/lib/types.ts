// Domain types that mirror the CyberPersona core protocol.
// These are intentionally close to the original project's data shapes
// so the backend can later return them with zero front-end changes.

export type PersonaStatus = "active" | "broken_up" | "reconciliation_pending" | "archived";

export type BigFive = {
  o: number;
  c: number;
  e: number;
  a: number;
  n: number;
};

export type DynamicState = {
  trust: number;
  security: number;
  closeness: number;
  neediness: number;
  possessiveness: number;
};

export type CharacterCard = {
  systemBase: {
    bigFive: BigFive;
    personalityArchetype: string;
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
    voiceSamplePath?: string;
  };
  referencePhotoPath?: string;
  identity: Record<string, string | undefined>;
  physicalTraits: Record<string, string | undefined>;
  personalitySelfDescription: Record<string, string | undefined>;
  preferences: Record<string, string | string[] | undefined>;
  innerWorld: Record<string, string | undefined>;
  habits: Record<string, string | undefined>;
  memories: {
    events: string[];
    milestones: string[];
    gifts: string[];
  };
};

export type RevealedFact = {
  key: string;
  value: string;
  type?: "setting" | "experience";
};

export type EmotionalMemory = {
  topic: string;
  content: string;
  emotion?: string;
};

export type VulnerabilityTopic = {
  topic: string;
  description: string;
};

export type ImportantEvent = {
  event: string;
  importance?: string;
};

export type LocationContext = {
  current?: string;
  travel?: string;
};

export type PersonaMemory = {
  lastSummary: string;
  nicknameForUser: string;
  nicknameForSelf: string;
  sharedRoutines: string[];
  emotionalMemories: EmotionalMemory[];
  importantEvents: ImportantEvent[];
  revealedFacts: RevealedFact[];
  vulnerabilityTopics: VulnerabilityTopic[];
  location?: LocationContext;
};

export type PersonaShortTerm = {
  unresolvedEmotion: string;
  emotionTrigger: string;
  interactionTrend: string;
  recentVoicePattern: string;
  recentImagePattern: string;
};

export type Persona = {
  id: string;
  userId: string;
  status: PersonaStatus;
  nickname: string;
  avatarUrl: string;
  referencePhotoUrl?: string;
  referencePhotoPath?: string;
  voiceSampleUrl?: string;
  voiceSamplePath?: string;
  createdAt: string;
  updatedAt: string;
  brokenUpAt?: string;
  reconciledAt?: string;
  currentEmotion: string;
  sessionCount: number;
  characterCard: CharacterCard;
  dynamicState: DynamicState;
  stress: number;
  // Hidden from user UI by design.
  affection: number;
  affectionLevel: number;
  memory?: PersonaMemory;
  shortTerm?: PersonaShortTerm;
};

export type MessageType =
  | "text"
  | "voice"
  | "image"
  | "image_loading"
  | "image_failed"
  | "sticker"
  | "system";

export type MessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  personaId: string;
  role: MessageRole;
  type: MessageType;
  text?: string;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrl?: string;
  imageCaption?: string;
  imageWaitText?: string;
  imageFailedText?: string;
  stickerUrl?: string;
  stickerKeyword?: string;
  stickerEmoji?: string;
  clientRequestId?: string;
  requestId?: string;
  turnId?: string;
  createdAt: string;
};

export type AlbumItem = {
  id: string;
  personaId: string;
  imageUrl: string;
  caption?: string;
  createdAt: string;
  relatedMessageId?: string;
};

export type UserProfile = {
  id: string;
  phone: string;
  avatarColor: string;
  credits: number;
  createdAt: string;
  lastLoginAt: string;
  todayCreationCount: number;
  dailyCreationLimit: number;
  breakupCountToday: number;
  cooldownUntil?: string;
  isAdmin?: boolean;
};

export type AdminUserRow = {
  id: string;
  phone: string;
  createdAt: string;
  lastLoginAt: string;
  status: "active" | "disabled" | "deleted";
  credits: number;
  relationshipStatus: "active" | "cooldown" | "unassigned";
  activePersonaName: string | null;
  cooldownEndsAt?: string | null;
  totalPersonas: number;
  totalMessages: number;
  totalTurns: number;
  todayCreationCount: number;
  isAdmin: boolean;
};

export type AdminPersonaRow = {
  id: string;
  userPhone: string;
  nickname: string;
  status: PersonaStatus;
  archetype: string;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  trust: number;
  closeness: number;
  stress: number;
  affection: number;
};

export type AdminChatRecord = {
  id: string;
  userId: string;
  userPhone: string;
  personaId: string;
  personaName: string;
  personaStatus: PersonaStatus;
  messageCount: number;
  creditsSpent: number;
  lastMessagePreview: string;
  lastMessageAt: string;
  messages: ChatMessage[];
};

export type AdminTurnRecord = {
  id: string;
  requestId?: string;
  turnId?: string;
  personaId: string;
  personaName: string;
  userPhone: string;
  userMessage: string;
  visibleText: string;
  currentEmotion: string;
  sendVoiceNow: boolean;
  sendImageNow: boolean;
  sendGifNow: boolean;
  validationStatus: "ok" | "fallback" | "error";
  latencyMs: number;
  createdAt: string;
  stateDelta: Record<string, "major_decrease" | "minor_decrease" | "neutral" | "minor_increase" | "major_increase">;
  stressDelta: "major_decrease" | "minor_decrease" | "neutral" | "minor_increase" | "major_increase";
};

export type CallLogType = "llm" | "image" | "sticker";

export type CallLogStatus = "ok" | "error" | "fallback" | "unconfigured";

export type CallLogEntry = {
  id: string;
  type: CallLogType;
  provider: string;
  source: string;
  startedAt: string;
  durationMs: number;
  streaming: boolean;
  status: CallLogStatus;
  inputSummary: string;
  outputSummary: string;
  errorMessage?: string;
  request?: unknown;
  response?: unknown;
};

export type AdminProviderSettings = {
  llm: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    temperature: number;
  };
  tts: {
    provider: string;
    baseUrl: string;
    model: string;
    voiceStrategy: string;
    format: string;
    apiKeyMasked: string;
    enabled: boolean;
  };
  asr: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    enabled: boolean;
  };
  llmAudio: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    enabled: boolean;
  };
  image: {
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyMasked: string;
    enabled: boolean;
  };
  sticker: {
    provider: string;
    apiUrl: string;
    enabled: boolean;
  };
  runtime: {
    stateFile: string;
    historyFile: string;
    ttsOutputDir: string;
    imageOutputDir: string;
    mediaDir: string;
    debug: boolean;
    debugTts: boolean;
  };
  credits: {
    initialBalance: number;
    dialogueTurnCost: number;
    textMessageCost: number;
    voiceMessageCost: number;
    imageMessageCost: number;
    stickerMessageCost: number;
  };
  relationship: {
    dailyCreationLimit: number;
    breakupCooldownMinutes: [number, number, number];
  };
};
