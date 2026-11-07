-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "provider" TEXT NOT NULL,
    "apiKeyCipher" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "modelPrimary" TEXT NOT NULL,
    "modelFallback" TEXT,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "timeoutMs" INTEGER NOT NULL DEFAULT 45000,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastTestedAt" DATETIME,
    "testStatus" TEXT,
    "testLatencyMs" INTEGER,
    "testMessage" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AiConfig_isActive_idx" ON "AiConfig"("isActive");
