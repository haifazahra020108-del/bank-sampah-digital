-- Integrasi Telegram (tambahan murni / purely additive).
-- Tidak ada DROP TABLE, tidak ada perubahan tipe kolom yang ada, tidak ada penghapusan data.

-- AlterTable: kolom status pengiriman Telegram pada Notification.
-- Nullable => notifikasi lama tetap memiliki nilai NULL (= belum dicoba kirim) dan tidak
-- akan pernah dikirim ulang ke Telegram.
ALTER TABLE "Notification" ADD COLUMN "telegramStatus" TEXT;
ALTER TABLE "Notification" ADD COLUMN "telegramSentAt" DATETIME;
ALTER TABLE "Notification" ADD COLUMN "telegramError" TEXT;

-- AlterTable: kolom Telegram pada User.
-- Nullable => anggota yang belum pernah terhubung tetap bernilai NULL dan TIDAK akan
-- menerima pesan apa pun.
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
-- NOT NULL dengan DEFAULT non-null didukung SQLite untuk ADD COLUMN,
-- sehingga aman dan tidak memerlukan rebuild tabel.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: kode aktivasi sekali pakai.
CREATE TABLE "TelegramLinkCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "payloadCipher" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TelegramLinkCode_codeHash_key" ON "TelegramLinkCode"("codeHash");
CREATE INDEX "TelegramLinkCode_userId_idx" ON "TelegramLinkCode"("userId");
CREATE INDEX "TelegramLinkCode_expiresAt_idx" ON "TelegramLinkCode"("expiresAt");
CREATE INDEX "Notification_telegramStatus_idx" ON "Notification"("telegramStatus");