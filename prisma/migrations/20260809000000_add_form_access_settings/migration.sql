-- Conditions d'accès au formulaire public : fenêtre de publication (mise en ligne / clôture),
-- mot de passe, quota de réponses, restrictions de participation (JSON stocké en texte).
ALTER TABLE "Form" ADD COLUMN "accessSettings" TEXT NOT NULL DEFAULT '{}';
