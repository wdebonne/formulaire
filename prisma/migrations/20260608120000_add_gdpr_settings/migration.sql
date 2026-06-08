-- AlterTable SystemSettings: add gdprSettings (JSON stocké en texte)
ALTER TABLE "SystemSettings" ADD COLUMN "gdprSettings" TEXT NOT NULL DEFAULT '{}';
