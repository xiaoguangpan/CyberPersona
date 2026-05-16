-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "importedFrom" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProviderSettings" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "importedFrom" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSettings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "streaming" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "errorMessage" TEXT,
    "request" JSONB,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSendRequest" (
    "id" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "userId" TEXT,
    "personaId" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallLog_type_startedAt_idx" ON "CallLog"("type", "startedAt");

-- CreateIndex
CREATE INDEX "CallLog_status_startedAt_idx" ON "CallLog"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSendRequest_clientRequestId_key" ON "ChatSendRequest"("clientRequestId");

-- CreateIndex
CREATE INDEX "ChatSendRequest_userId_personaId_createdAt_idx" ON "ChatSendRequest"("userId", "personaId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatSendRequest_status_createdAt_idx" ON "ChatSendRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_kind_createdAt_idx" ON "MediaAsset"("kind", "createdAt");
