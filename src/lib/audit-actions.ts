// Données pures (pas d'accès Prisma) — peut être importé aussi bien côté
// serveur (routes API, lib/audit-log.ts) que côté client (filtre admin/logs)

export type AuditAction =
  | 'auth.login_success'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset_request'
  | 'auth.password_reset_complete'
  | 'form.create'
  | 'form.update'
  | 'form.publish'
  | 'form.unpublish'
  | 'form.delete'
  | 'form.restore'
  | 'form.permanent_delete'
  | 'form.duplicate'
  | 'form.version_create'
  | 'form.version_restore'
  | 'user.create'
  | 'user.update'
  | 'user.delete'

export const ACTION_LABELS: Record<AuditAction, string> = {
  'auth.login_success': 'Connexion réussie',
  'auth.login_failed': 'Connexion échouée',
  'auth.logout': 'Déconnexion',
  'auth.register': 'Inscription',
  'auth.password_reset_request': 'Demande de réinitialisation de mot de passe',
  'auth.password_reset_complete': 'Mot de passe réinitialisé',
  'form.create': 'Création de formulaire',
  'form.update': 'Modification de formulaire',
  'form.publish': 'Publication de formulaire',
  'form.unpublish': 'Dépublication de formulaire',
  'form.delete': 'Suppression de formulaire',
  'form.restore': 'Restauration depuis la corbeille',
  'form.permanent_delete': 'Suppression définitive de formulaire',
  'form.duplicate': 'Duplication de formulaire',
  'form.version_create': 'Création de version',
  'form.version_restore': 'Restauration de version',
  'user.create': 'Création d\'utilisateur',
  'user.update': 'Modification d\'utilisateur',
  'user.delete': 'Suppression d\'utilisateur',
}

export const ACTION_CATEGORIES: { label: string; actions: AuditAction[] }[] = [
  {
    label: 'Authentification',
    actions: [
      'auth.login_success',
      'auth.login_failed',
      'auth.logout',
      'auth.register',
      'auth.password_reset_request',
      'auth.password_reset_complete',
    ],
  },
  {
    label: 'Formulaires',
    actions: [
      'form.create',
      'form.update',
      'form.publish',
      'form.unpublish',
      'form.delete',
      'form.restore',
      'form.permanent_delete',
      'form.duplicate',
      'form.version_create',
      'form.version_restore',
    ],
  },
  {
    label: 'Utilisateurs',
    actions: ['user.create', 'user.update', 'user.delete'],
  },
]

export function actionLabel(action: string): string {
  return ACTION_LABELS[action as AuditAction] || action
}
