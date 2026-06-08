-- AlterTable SystemSettings: add logSettings (rétention du journal d'activité, JSON stocké en texte)
ALTER TABLE "SystemSettings" ADD COLUMN "logSettings" TEXT NOT NULL DEFAULT '{}';

-- CreateTable: AuditLog (journal d'activité)
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "userId" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
