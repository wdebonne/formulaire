-- AlterTable SystemSettings: add loginPageSettings (JSON stocké en texte)
ALTER TABLE "SystemSettings" ADD COLUMN "loginPageSettings" TEXT NOT NULL DEFAULT '{}';
