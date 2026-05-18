-- AlterTable SystemSettings: add NextCloud fields
ALTER TABLE "SystemSettings" ADD COLUMN "nextcloudUrl" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "nextcloudUser" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "nextcloudPass" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "nextcloudBasePath" TEXT DEFAULT '/';
