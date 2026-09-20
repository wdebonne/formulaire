-- File de reprise des webhooks en échec.
--
-- Création de table seule : aucune table existante n'est reconstruite, donc aucun
-- « INSERT INTO X_new SELECT * FROM X » et aucun risque de décalage de colonnes entre les deux
-- lignées de migration (db push / migrate deploy).
--
-- Rejouable : `IF NOT EXISTS` partout, pour qu'une reprise après échec ne bute pas sur ce qui
-- a déjà été créé.
CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookName" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookDelivery_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- L'index que la minuterie interroge : « ce qui est dû », et non la table entière.
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "WebhookDelivery_responseId_idx" ON "WebhookDelivery"("responseId");
