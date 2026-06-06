-- AlterTable: add saveCount to Form
ALTER TABLE "Form" ADD COLUMN "saveCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: FormVersion
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT,
    "isAuto" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "logic" TEXT NOT NULL DEFAULT '[]',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "webhooks" TEXT NOT NULL DEFAULT '[]',
    "themeId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FormVersion_formId_idx" ON "FormVersion"("formId");
