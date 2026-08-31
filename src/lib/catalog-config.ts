// Raccordement à l'application de gestion : adresse, jeton, et les appels qui les utilisent.
//
// Ce module est réservé au serveur — il importe Prisma, et surtout il détient le jeton d'API.
// Le calcul portant sur les articles vit dans `catalog.ts`, qui reste pur et donc importable par
// le navigateur ; c'est le même partage que `audit-actions.ts` / `audit-log.ts`.
//
// Le raccordement se règle dans Administration → Catalogue. Les variables d'environnement
// CATALOG_API_URL / CATALOG_API_TOKEN restent lues en secours : une installation configurée avant
// que cet écran n'existe continue de fonctionner sans intervention.

import { prisma } from './prisma'
import type { SystemCatalogSettings } from '@/types/form'

const DELAI_MS = 10_000

export interface CatalogConfig {
  baseUrl: string
  token: string
  /** D'où vient le raccordement — l'écran d'administration l'affiche pour lever l'ambiguïté. */
  source: 'settings' | 'env'
}

export interface CatalogService {
  id: number
  name: string
  slug: string
}

export interface CatalogCategory {
  id: number
  name: string
}

export type CatalogCall<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

export function normalizeCatalogUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export async function getSystemCatalogSettings(): Promise<SystemCatalogSettings> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
      select: { catalogSettings: true },
    })
    return settings?.catalogSettings ? JSON.parse(settings.catalogSettings) : {}
  } catch {
    return {}
  }
}

export async function saveSystemCatalogSettings(
  settings: SystemCatalogSettings
): Promise<SystemCatalogSettings> {
  await prisma.systemSettings.upsert({
    where: { id: 'system' },
    update: { catalogSettings: JSON.stringify(settings) },
    create: { id: 'system', catalogSettings: JSON.stringify(settings) },
  })
  return settings
}

/**
 * Raccordement effectif, ou `null` si le catalogue n'est pas configuré.
 *
 * Les réglages enregistrés l'emportent sur l'environnement : c'est l'écran d'administration qui
 * fait foi une fois qu'on s'en est servi, sans quoi une variable oubliée dans un docker-compose
 * annulerait silencieusement ce qu'un administrateur vient de saisir.
 *
 * Le raccordement ne dépend pas de `verified` : un catalogue joignable doit servir les formulaires
 * même si personne n'a cliqué sur « Tester ». C'est l'inverse du convertisseur PDF, où le test
 * conditionne l'apparition d'une option ; ici il ne fait que rendre compte.
 */
export async function getCatalogConfig(): Promise<CatalogConfig | null> {
  const settings = await getSystemCatalogSettings()
  const url = normalizeCatalogUrl(settings.apiUrl || '')
  const token = (settings.apiToken || '').trim()
  if (url && token) return { baseUrl: url, token, source: 'settings' }

  const envUrl = normalizeCatalogUrl(process.env.CATALOG_API_URL || '')
  const envToken = (process.env.CATALOG_API_TOKEN || '').trim()
  if (envUrl && envToken) return { baseUrl: envUrl, token: envToken, source: 'env' }

  return null
}

export interface CatalogSettingsView {
  apiUrl: string
  hasToken: boolean
  verified: boolean
  verifiedAt?: string
  verifiedServiceCount?: number
  verifiedItemCount?: number
  /** `env` : raccordement hérité des variables d'environnement, l'écran est alors vide. */
  source: 'settings' | 'env' | null
  envUrl: string
}

/**
 * Ce que l'écran d'administration a le droit de connaître.
 *
 * Le jeton ne redescend jamais, seulement son existence : un champ prérempli avec le secret le
 * livrerait à toute extension de navigateur et à tout épaule qui passe, pour le seul agrément de
 * le relire. Le calcul de `source` reprend la précédence de `getCatalogConfig()` sans relire la
 * base — les deux doivent dire la même chose.
 */
export function catalogSettingsView(settings: SystemCatalogSettings): CatalogSettingsView {
  const envUrl = normalizeCatalogUrl(process.env.CATALOG_API_URL || '')
  const envToken = (process.env.CATALOG_API_TOKEN || '').trim()

  return {
    apiUrl: settings.apiUrl ?? '',
    hasToken: Boolean(settings.apiToken),
    verified: Boolean(settings.verified),
    verifiedAt: settings.verifiedAt,
    verifiedServiceCount: settings.verifiedServiceCount,
    verifiedItemCount: settings.verifiedItemCount,
    source: settings.apiUrl && settings.apiToken ? 'settings' : envUrl && envToken ? 'env' : null,
    envUrl,
  }
}

// 503 et non 500 : ce n'est pas une panne, c'est une configuration absente, et le message doit
// dire où la renseigner plutôt que d'envoyer chercher dans les journaux.
export const CATALOG_NOT_CONFIGURED = {
  status: 503,
  error: 'Catalogue non configuré (Administration → Catalogue)',
} as const

/**
 * Un appel au catalogue, erreurs traduites.
 *
 * Le corps de la réponse amont peut contenir n'importe quoi : seul le code est relayé, et le 401
 * est nommé parce que c'est la panne la plus probable — un jeton expiré ou révoqué.
 */
export async function catalogCall<T = any>(
  config: CatalogConfig,
  path: string,
  params: Record<string, string> = {}
): Promise<CatalogCall<T>> {
  const query = new URLSearchParams(params).toString()
  const url = `${config.baseUrl}${path}${query ? `?${query}` : ''}`

  let reponse: Response
  try {
    reponse = await fetch(url, {
      headers: { 'X-API-Token': config.token, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(DELAI_MS),
    })
  } catch {
    return { ok: false, status: 502, error: 'Catalogue injoignable' }
  }

  if (!reponse.ok) {
    const detail = reponse.status === 401 || reponse.status === 403 ? ' (jeton refusé)' : ''
    return { ok: false, status: 502, error: `Le catalogue a répondu ${reponse.status}${detail}` }
  }

  const corps = await reponse.json().catch(() => null)
  return { ok: true, data: corps as T }
}

/**
 * Services et catégories déclarés dans l'application de gestion.
 *
 * Un service désactivé n'est pas proposé : le formulaire construit sur lui ne proposerait plus
 * rien, sans dire pourquoi.
 */
export async function fetchCatalogFacets(
  config: CatalogConfig
): Promise<CatalogCall<{ services: CatalogService[]; categories: CatalogCategory[] }>> {
  const [services, categories] = await Promise.all([
    catalogCall(config, '/api/services'),
    catalogCall(config, '/api/categories'),
  ])

  if (!services.ok) return services
  if (!categories.ok) return categories

  return {
    ok: true,
    data: {
      services: (Array.isArray(services.data?.data) ? services.data.data : [])
        .filter((service: any) => service?.is_active !== 0)
        .map((service: any) => ({
          id: Number(service?.id),
          name: String(service?.name ?? ''),
          slug: String(service?.slug ?? ''),
        }))
        .filter((service: CatalogService) => service.name && service.slug),
      categories: (Array.isArray(categories.data?.categories) ? categories.data.categories : [])
        .map((categorie: any) => ({ id: Number(categorie?.id), name: String(categorie?.name ?? '') }))
        .filter((categorie: CatalogCategory) => categorie.name)
        .sort((a: CatalogCategory, b: CatalogCategory) => a.name.localeCompare(b.name, 'fr')),
    },
  }
}

/** Le jour même : une date est obligatoire pour interroger le stock, et celle-ci ne surprend personne. */
export function todayIso(): string {
  const maintenant = new Date()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

export interface CatalogTestResult {
  success: boolean
  error?: string
  services?: CatalogService[]
  categories?: CatalogCategory[]
  itemCount?: number
}

/**
 * Test de raccordement.
 *
 * Les trois points d'entrée dont dépendent les formulaires sont interrogés, pas seulement le
 * premier : un jeton peut ouvrir la liste des services et se voir refuser le stock, et un test qui
 * s'arrêterait à `/api/services` annoncerait une réussite démentie au premier formulaire.
 */
export async function testCatalogConnection(
  rawUrl: string,
  token: string
): Promise<CatalogTestResult> {
  const baseUrl = normalizeCatalogUrl(rawUrl)
  if (!baseUrl) return { success: false, error: 'Aucune adresse renseignée' }
  if (!token.trim()) return { success: false, error: 'Aucun jeton renseigné' }

  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    return { success: false, error: 'Adresse invalide (exemple : https://materiels.example.com)' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { success: false, error: 'Seuls les protocoles http et https sont acceptés' }
  }

  const config: CatalogConfig = { baseUrl, token: token.trim(), source: 'settings' }

  const facettes = await fetchCatalogFacets(config)
  if (!facettes.ok) return { success: false, error: facettes.error }

  const jour = todayIso()
  const stock = await catalogCall(config, '/api/manifestations/stock/availability', {
    date_from: jour,
    date_to: jour,
  })
  if (!stock.ok) return { success: false, error: stock.error }

  return {
    success: true,
    services: facettes.data.services,
    categories: facettes.data.categories,
    itemCount: Array.isArray(stock.data?.data) ? stock.data.data.length : 0,
  }
}
