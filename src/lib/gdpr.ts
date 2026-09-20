import { prisma } from '@/lib/prisma'
import type { GdprSettings } from '@/types/form'

// `autoPurgeEnabled` est volontairement à `false` par défaut : activer la suppression
// automatique à la faveur d'une mise à jour effacerait, au premier redémarrage, des réponses
// qu'aucun administrateur n'a consenti à perdre. L'écran /admin/gdpr expose l'interrupteur.
export const DEFAULT_GDPR_SETTINGS: Required<GdprSettings> = {
  retentionEnabled: true,
  retentionMonths: 36,
  autoPurgeEnabled: false,
  lastAutoPurgeAt: null,
}

export async function getGdprSettings(): Promise<Required<GdprSettings>> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system' } })
  if (!settings?.gdprSettings) return DEFAULT_GDPR_SETTINGS

  try {
    return { ...DEFAULT_GDPR_SETTINGS, ...JSON.parse(settings.gdprSettings) }
  } catch {
    return DEFAULT_GDPR_SETTINGS
  }
}

// Date avant laquelle les réponses sont considérées comme expirées au regard de la durée de conservation configurée
export function getRetentionCutoffDate(settings: Required<GdprSettings>): Date {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - settings.retentionMonths)
  return cutoff
}
