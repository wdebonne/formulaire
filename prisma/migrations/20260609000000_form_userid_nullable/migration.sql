-- SQLite does not support ALTER COLUMN, so we recreate the Form table
-- to make userId nullable and change onDelete from CASCADE to SET NULL.

PRAGMA foreign_keys=OFF;

-- Guard against a leftover table from a previously failed run of this migration.
DROP TABLE IF EXISTS "Form_new";

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

-- Step 2: copy all existing data.
-- Columns MUST be listed explicitly: `SELECT *` copies by position, and the physical column
-- order of "Form" differs between a database built by `migrate deploy` (where deletedAt and
-- saveCount were appended by later ALTER TABLE statements, so they sit after createdAt and
-- updatedAt) and one built by `db push` (which recreates the table in schema order). A
-- positional copy shifts deletedAt — NULL for every non-trashed form — into the NOT NULL
-- createdAt column and aborts the whole migration.
INSERT INTO "Form_new" (
    "id", "title", "slug", "description", "status", "blocks", "logic", "settings",
    "webhooks", "themeId", "userId", "deletedAt", "saveCount", "createdAt", "updatedAt"
)
SELECT
    "id", "title", "slug", "description", "status", "blocks", "logic", "settings",
    "webhooks", "themeId", "userId", "deletedAt", "saveCount", "createdAt", "updatedAt"
FROM "Form";

-- Step 3: drop old table
DROP TABLE "Form";

-- Step 4: rename new table
ALTER TABLE "Form_new" RENAME TO "Form";

-- Step 5: recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Form_slug_key" ON "Form"("slug");
CREATE INDEX IF NOT EXISTS "Form_userId_idx" ON "Form"("userId");
CREATE INDEX IF NOT EXISTS "Form_slug_idx" ON "Form"("slug");

PRAGMA foreign_keys=ON;
