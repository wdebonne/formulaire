-- AlterTable SystemSettings: add securitySettings (JSON stocké en texte)
ALTER TABLE "SystemSettings" ADD COLUMN "securitySettings" TEXT NOT NULL DEFAULT '{}';

-- CreateTable: IpRule (listes blanche / noire)
CREATE TABLE "IpRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "IpRule_ipAddress_listType_key" ON "IpRule"("ipAddress", "listType");

-- CreateIndex
CREATE INDEX "IpRule_listType_idx" ON "IpRule"("listType");

-- CreateTable: IpBlock (suivi des tentatives échouées et blocages actifs)
CREATE TABLE "IpBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "IpBlock_ipAddress_key" ON "IpBlock"("ipAddress");

-- CreateIndex
CREATE INDEX "IpBlock_blockedUntil_idx" ON "IpBlock"("blockedUntil");
