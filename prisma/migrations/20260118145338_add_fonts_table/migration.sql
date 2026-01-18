-- CreateTable
CREATE TABLE "Font" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google',
    "url" TEXT,
    "weights" TEXT NOT NULL DEFAULT '[400,700]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Font_family_key" ON "Font"("family");
