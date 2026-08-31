-- Catalogue de matériel externe : adresse, jeton d'API et état de vérification.
-- Les variables d'environnement CATALOG_API_URL / CATALOG_API_TOKEN restent lues en secours,
-- pour les installations configurées avant que ces réglages n'existent.
ALTER TABLE "SystemSettings" ADD COLUMN "catalogSettings" TEXT NOT NULL DEFAULT '{}';
