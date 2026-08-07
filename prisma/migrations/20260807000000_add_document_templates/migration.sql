-- Modèle .docx et paramètres d'e-mail par formulaire
ALTER TABLE "Form" ADD COLUMN "documentSettings" TEXT NOT NULL DEFAULT '{}';

-- Statut du dernier envoi du document généré, par réponse
ALTER TABLE "Response" ADD COLUMN "documentStatus" TEXT DEFAULT '{}';

-- Convertisseur PDF externe (URL + état de vérification)
ALTER TABLE "SystemSettings" ADD COLUMN "documentSettings" TEXT NOT NULL DEFAULT '{}';
