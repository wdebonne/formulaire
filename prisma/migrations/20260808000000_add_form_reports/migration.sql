-- Rapports périodiques par formulaire : période analysée, sections incluses,
-- planification de l'envoi et destinataires (JSON stocké en texte).
ALTER TABLE "Form" ADD COLUMN "reportSettings" TEXT NOT NULL DEFAULT '{}';
