-- SQLite does not support ALTER COLUMN, so we recreate the Form table
-- to make userId nullable and change onDelete from CASCADE to SET NULL.

PRAGMA foreign_keys=OFF;

-- Step 1: create new Form table with userId nullable and SET NULL
CREATE TABLE "Form_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "logic" TEXT NOT NULL DEFAULT '[]',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "webhooks" TEXT NOT NULL DEFAULT '[]',
    "themeId" TEXT,
    "userId" TEXT,
    "deletedAt" DATETIME,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Form_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 2: copy all existing data
INSERT INTO "Form_new" SELECT * FROM "Form";

-- Step 3: drop old table
DROP TABLE "Form";

-- Step 4: rename new table
ALTER TABLE "Form_new" RENAME TO "Form";

-- Step 5: recreate indexes
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");
CREATE INDEX "Form_userId_idx" ON "Form"("userId");
CREATE INDEX "Form_slug_idx" ON "Form"("slug");

PRAGMA foreign_keys=ON;
