// Conversion .docx → PDF par le serveur bureautique du NextCloud déjà configuré.
//
// L'alternative — un conteneur Gotenberg — suppose d'administrer une machine de plus pour un
// moteur bureautique que l'instance NextCloud branchée porte déjà : installé, authentifié,
// sauvegardé avec le reste. Les identifiants sont ceux d'Administration › NextCloud ; il n'y a
// rien à saisir de plus ici.
//
// **Plusieurs chemins, essayés dans l'ordre.** Aucun connecteur bureautique n'enregistre de
// fournisseur auprès de l'API de conversion générique de NextCloud : celle-ci répond, puis
// échoue faute de fournisseur — sauf si Nextcloud Office est installé à côté. Ce sont donc les
// routes propres aux connecteurs qui travaillent, en s'adressant au serveur de documents.
//
// Encore faut-il frapper à la bonne porte : Euro-Office est un fork d'ONLYOFFICE Docs, mais son
// connecteur NextCloud est une application distincte — `eurooffice`, et non `onlyoffice`. Les
// routes sont identiques à l'identifiant près, si bien qu'essayer l'une puis l'autre ne coûte
// qu'un 404, et évite de parier sur la variante installée. Le test de l'écran d'administration
// dit laquelle a répondu.
//
// Server-only : lit les identifiants en base et manipule des Buffer Node.

import { randomUUID } from 'crypto'
import { prisma } from './prisma'
import { DOCX_MIME } from './document-storage'

const PDF_MIME = 'application/pdf'

const DAV_TIMEOUT_MS = 30_000

// Une conversion est plus longue qu'un dépôt : le serveur de documents rend la main en quelques
// secondes sur une page, mais il lui arrive de démarrer à froid.
const CONVERT_TIMEOUT_MS = 120_000

const CREDENTIALS_REFUSED =
  'Identifiants refusés — vérifiez le compte et le mot de passe d’application dans Administration › NextCloud'

export const NEXTCLOUD_NOT_CONFIGURED = 'NextCloud n’est pas configuré (Administration › NextCloud)'

export interface NextcloudConfig {
  url: string
  user: string
  pass: string
  basePath: string
}

/**
 * Identifiants NextCloud enregistrés, `null` s'ils sont absents ou incomplets.
 *
 * Lecture en SQL brut comme le fait déjà /api/admin/nextcloud/browse : ces colonnes ont été
 * ajoutées après coup et peuvent manquer à un client Prisma plus ancien que le schéma.
 */
export async function getNextcloudConfig(): Promise<NextcloudConfig | null> {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT nextcloudUrl, nextcloudUser, nextcloudPass, nextcloudBasePath FROM "SystemSettings" WHERE id = 'system'`
    )) as any[]
    const row = rows[0]
    if (!row?.nextcloudUrl || !row?.nextcloudUser || !row?.nextcloudPass) return null

    return {
      url: String(row.nextcloudUrl),
      user: String(row.nextcloudUser),
      pass: String(row.nextcloudPass),
      basePath: String(row.nextcloudBasePath || '/'),
    }
  } catch {
    return null
  }
}

/**
 * Racine de l'instance, à partir de ce qui a pu être collé dans le champ d'adresse.
 *
 * Ce qu'un administrateur a sous les yeux, et donc recopie, c'est l'adresse du site — parfois
 * celle de l'écran des fichiers avec son `/apps/files/?dir=…`. Tout ce qui ne passe pas par
 * WebDAV (API OCS, routes d'application) s'adresse à la racine. Un NextCloud installé dans un
 * sous-répertoire garde le sien : c'est `remote.php` qui marque la frontière, pas le premier
 * segment du chemin.
 */
export function instanceRoot(rawUrl: string): string {
  const input = (rawUrl ?? '').trim().replace(/\/+$/, '')
  if (!input) return ''

  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return input
  }

  const path = parsed.pathname
    .replace(/\/remote\.php(\/.*)?$/i, '')
    .replace(/\/(index\.php|apps|login|settings)(\/.*)?$/i, '')
    .replace(/\/+$/, '')

  return `${parsed.origin}${path}`
}

function authHeaders(config: NextcloudConfig): Record<string, string> {
  const token = Buffer.from(`${config.user}:${config.pass}`).toString('base64')
  return { Authorization: `Basic ${token}` }
}

/** Découpe un chemin en segments sûrs : ni barres vides, ni remontée hors du compte. */
function pathSegments(path: string): string[] {
  return (path ?? '').split('/').filter((s) => s && s !== '.' && s !== '..')
}

function davUrl(config: NextcloudConfig, path: string): string {
  const root = `${instanceRoot(config.url)}/remote.php/dav/files/${encodeURIComponent(config.user)}`
  return [root, ...pathSegments(path).map(encodeURIComponent)].join('/')
}

/**
 * Traduit une erreur réseau en phrase exploitable.
 *
 * `fetch` échoue avec un laconique « fetch failed » et range la vraie cause dans `error.cause` :
 * un administrateur qui lit « fetch failed » ne sait pas s'il s'est trompé d'adresse, si le
 * serveur est éteint, ou si le certificat est refusé — et n'a aucune piste pour corriger.
 */
export function networkMessage(error: any): string {
  if (error?.name === 'TimeoutError') return 'Le serveur n’a pas répondu dans le délai imparti'

  const cause = error?.cause
  switch (cause?.code) {
    case 'ECONNREFUSED':
      return 'Connexion refusée — vérifiez l’adresse et le port'
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Nom de domaine introuvable${cause.hostname ? ` (${cause.hostname})` : ''}`
    case 'ETIMEDOUT':
      return 'Le serveur ne répond pas'
    case 'CERT_HAS_EXPIRED':
      return 'Certificat HTTPS expiré'
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return 'Certificat HTTPS auto-signé, refusé'
    default:
      break
  }

  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return `Serveur injoignable${cause?.message ? ` — ${cause.message}` : ''}`
  }

  return error?.message || 'Erreur inconnue'
}

/** Valeur d'une balise, quel que soit le préfixe de domaine employé par le serveur. */
function tagValue(xml: string, name: string): string | undefined {
  const found = xml.match(new RegExp(`<[a-z0-9]*:?${name}[^>]*>([^<]*)<`, 'i'))
  return found?.[1]?.trim() || undefined
}

// `405 Method Not Allowed` signifie « le dossier existe déjà » : réponse normale, pas une erreur.
async function ensureFolder(config: NextcloudConfig, path: string): Promise<void> {
  let current = ''

  for (const segment of pathSegments(path)) {
    current = current ? `${current}/${segment}` : segment
    const response = await fetch(davUrl(config, current), {
      method: 'MKCOL',
      headers: authHeaders(config),
      signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
    })

    if (response.ok || response.status === 405) continue
    if (response.status === 401) throw new Error(CREDENTIALS_REFUSED)
    throw new Error(`création du dossier « ${current} » refusée (HTTP ${response.status})`)
  }
}

async function putFile(
  config: NextcloudConfig,
  path: string,
  content: Buffer,
  mime: string
): Promise<void> {
  const response = await fetch(davUrl(config, path), {
    method: 'PUT',
    headers: { ...authHeaders(config), 'Content-Type': mime },
    body: new Uint8Array(content),
    signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
  })

  if (response.status === 401) throw new Error(CREDENTIALS_REFUSED)
  if (!response.ok) throw new Error(`dépôt refusé (HTTP ${response.status})`)
}

/**
 * Identifiant interne d'un fichier, celui que NextCloud appelle `fileid`.
 *
 * WebDAV désigne un fichier par son chemin, mais tout le reste de NextCloud le désigne par ce
 * nombre — la conversion en particulier. Le corps de la requête est explicite parce qu'un
 * PROPFIND sans corps ne rend que les propriétés du domaine `DAV:`, où `fileid` ne figure pas.
 */
async function remoteFileId(config: NextcloudConfig, path: string): Promise<number> {
  const response = await fetch(davUrl(config, path), {
    method: 'PROPFIND',
    headers: { ...authHeaders(config), Depth: '0', 'Content-Type': 'application/xml' },
    body:
      '<?xml version="1.0"?>' +
      '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">' +
      '<d:prop><oc:fileid/></d:prop></d:propfind>',
    signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
  })

  if (response.status === 401) throw new Error(CREDENTIALS_REFUSED)
  if (!response.ok) throw new Error(`lecture du fichier déposé impossible (HTTP ${response.status})`)

  const raw = tagValue(await response.text(), 'fileid')
  const fileId = Number(raw)
  if (!raw || !Number.isInteger(fileId)) {
    throw new Error('NextCloud n’a pas renvoyé l’identifiant du fichier déposé')
  }
  return fileId
}

async function getFile(config: NextcloudConfig, path: string): Promise<Buffer> {
  const response = await fetch(davUrl(config, path), {
    method: 'GET',
    headers: authHeaders(config),
    signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
  })

  if (response.status === 401) throw new Error(CREDENTIALS_REFUSED)
  if (!response.ok) throw new Error(`relecture impossible (HTTP ${response.status})`)

  return Buffer.from(await response.arrayBuffer())
}

/** Le retrait est toujours accessoire : un témoin oublié se voit, une exception casserait tout. */
async function removeFile(config: NextcloudConfig, path: string): Promise<void> {
  try {
    await fetch(davUrl(config, path), {
      method: 'DELETE',
      headers: authHeaders(config),
      signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
    })
  } catch {
    /* sans conséquence */
  }
}

/**
 * Un PDF commence par `%PDF-`, et rien d'autre ne commence ainsi.
 *
 * Le connecteur refuse en JSON sous un code HTTP 200 : se fier au statut, ou même au
 * `Content-Type`, ferait envoyer un message d'erreur sous le nom d'un document.
 */
function looksLikePdf(content: Buffer): boolean {
  return content.length > 5 && content.subarray(0, 5).toString('latin1') === '%PDF-'
}

/** Tire une phrase de la réponse du connecteur, qui refuse en JSON ou en HTML. */
function refusalMessage(content: Buffer): string {
  const text = content.subarray(0, 2000).toString('utf8').trim()

  try {
    const json = JSON.parse(text)
    const message = json?.error ?? json?.message ?? json?.ocs?.meta?.message
    if (message) return String(message)
  } catch {
    /* pas du JSON : la réponse est une page d'erreur */
  }

  return text ? 'réponse inattendue du serveur' : 'réponse vide'
}

interface Attempt {
  success: boolean
  pdf?: Buffer
  error?: string
}

/**
 * Les connecteurs bureautiques connus, dans l'ordre où on les essaie.
 *
 * Deux applications NextCloud pour un même code : le fork Euro-Office a son propre connecteur, et
 * l'identifiant d'application est tout ce qui les distingue côté route. Un troisième fork
 * s'ajouterait ici, et nulle part ailleurs.
 */
const CONNECTORS = [
  { app: 'eurooffice', label: 'Euro-Office' },
  { app: 'onlyoffice', label: 'ONLYOFFICE' },
]

/**
 * La route d'un connecteur bureautique.
 *
 * `downloadas` passe la main au serveur de documents et rend les octets du PDF. Ce n'est pas une
 * route OCS, mais une requête en `Basic` sans cookie passe le contrôle CSRF de NextCloud : c'est
 * précisément le cas d'un mot de passe d'application, le seul que cette application connaisse.
 */
async function viaConnector(
  config: NextcloudConfig,
  fileId: number,
  connector: { app: string; label: string }
): Promise<Attempt> {
  const params = new URLSearchParams({ fileId: String(fileId), toExtension: 'pdf' })
  const url = `${instanceRoot(config.url)}/index.php/apps/${connector.app}/downloadas?${params}`

  const response = await fetch(url, {
    method: 'GET',
    headers: authHeaders(config),
    signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
  })

  if (response.status === 404) {
    return {
      success: false,
      error: `route absente — application « ${connector.app} » non installée`,
    }
  }
  if (response.status === 401 || response.status === 403) {
    return { success: false, error: `accès refusé (HTTP ${response.status})` }
  }
  if (!response.ok) return { success: false, error: `HTTP ${response.status}` }

  const content = Buffer.from(await response.arrayBuffer())
  if (!looksLikePdf(content)) return { success: false, error: refusalMessage(content) }

  return { success: true, pdf: content }
}

/**
 * Le dernier recours — l'API de conversion de NextCloud.
 *
 * Elle écrit le PDF dans le compte plutôt que de le rendre : il faut donc le relire, puis
 * l'effacer. Elle n'aboutit que si une application a déclaré savoir convertir du .docx — ce que
 * fait Nextcloud Office, et aucun des connecteurs ci-dessus. D'où sa place en dernier : sur une
 * instance qui n'a que son serveur de documents, elle répond « le fichier n'a pas pu être
 * converti », faute de fournisseur et non faute de moteur.
 */
async function viaNextcloudApi(
  config: NextcloudConfig,
  fileId: number,
  folder: string
): Promise<Attempt> {
  const destination = `/${pathSegments(folder).join('/')}/${randomUUID()}.pdf`
  const url = `${instanceRoot(config.url)}/ocs/v2.php/apps/files/api/v1/convert`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(config),
      'OCS-APIRequest': 'true',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileId, targetMimeType: PDF_MIME, destination }),
    signal: AbortSignal.timeout(CONVERT_TIMEOUT_MS),
  })

  const text = await response.text()
  let envelope: any
  try {
    envelope = JSON.parse(text)
  } catch {
    return { success: false, error: `réponse illisible (HTTP ${response.status})` }
  }

  const produced = envelope?.ocs?.data?.path
  if (!response.ok || !produced) {
    return { success: false, error: envelope?.ocs?.meta?.message || `HTTP ${response.status}` }
  }

  try {
    const content = await getFile(config, produced)
    if (!looksLikePdf(content)) {
      return { success: false, error: 'le fichier produit n’a pas l’allure d’un PDF' }
    }
    return { success: true, pdf: content }
  } catch (error: any) {
    return { success: false, error: networkMessage(error) }
  } finally {
    // Le PDF produit est un intermédiaire, pas une pièce à garder sur le NextCloud.
    await removeFile(config, produced)
  }
}

/** Les chemins de conversion, dans l'ordre où ils sont tentés. */
const PATHS: Array<{
  name: string
  attempt: (config: NextcloudConfig, fileId: number, folder: string) => Promise<Attempt>
}> = [
  ...CONNECTORS.map((connector) => ({
    name: `connecteur ${connector.label}`,
    attempt: (config: NextcloudConfig, fileId: number) => viaConnector(config, fileId, connector),
  })),
  { name: 'API de conversion NextCloud', attempt: viaNextcloudApi },
]

export interface NextcloudConversionResult {
  success: boolean
  pdf?: Buffer
  /** Chemin qui a abouti, tel que l'écran d'administration l'affiche. */
  method?: string
  error?: string
}

/**
 * Convertit un .docx en PDF, ou dit pourquoi elle n'a pas pu.
 *
 * Ne lève jamais : l'appelant produit le document d'une réponse déjà enregistrée, et un serveur
 * bureautique en panne ne doit pas emporter l'envoi avec lui — même contrat que logEvent().
 * Le .docx déposé est retiré dans tous les cas, y compris après échec, sans quoi les témoins
 * s'accumuleraient dans un dossier que personne ne pense à ouvrir.
 */
export async function convertWithNextcloud(docx: Buffer): Promise<NextcloudConversionResult> {
  const config = await getNextcloudConfig()
  if (!config) return { success: false, error: NEXTCLOUD_NOT_CONFIGURED }

  // Le point initial range le dossier hors de vue dans l'écran des fichiers : ce qui y transite
  // ne regarde pas les personnes qui consultent ce NextCloud.
  const folder = [...pathSegments(config.basePath), '.formbuilder-conversion'].join('/')
  const path = `${folder}/${randomUUID()}.docx`

  try {
    await ensureFolder(config, folder)
    await putFile(config, path, docx, DOCX_MIME)
  } catch (error: any) {
    return {
      success: false,
      error: `dépôt du document à convertir refusé — ${networkMessage(error)}`,
    }
  }

  try {
    const fileId = await remoteFileId(config, path)

    const refusals: string[] = []
    for (const { name, attempt } of PATHS) {
      try {
        const tried = await attempt(config, fileId, folder)
        if (tried.success && tried.pdf) return { success: true, pdf: tried.pdf, method: name }
        refusals.push(`${name} : ${tried.error}`)
      } catch (error: any) {
        // Un chemin qui casse ne doit pas empêcher d'essayer le suivant.
        refusals.push(`${name} : ${networkMessage(error)}`)
      }
    }

    return { success: false, error: `aucune conversion n’a abouti — ${refusals.join(' ; ')}` }
  } catch (error: any) {
    return { success: false, error: networkMessage(error) }
  } finally {
    // Le témoin part dans tous les cas : un échec en laisserait autant qu'il y a eu de tentatives.
    await removeFile(config, path)
  }
}

export interface NextcloudProbeResult {
  success: boolean
  version?: string
  /** Applications bureautiques repérées dans les capacités de l'instance. */
  office?: string[]
  error?: string
}

/**
 * Vérifie que le NextCloud configuré est joignable et que les identifiants passent.
 *
 * Ne dit rien de la conversion : savoir qu'une instance répond n'apprend pas qu'un serveur
 * bureautique y est branché. C'est le test de conversion qui le prouve, et lui seul ouvre
 * l'option PDF dans les formulaires.
 */
export async function probeNextcloud(): Promise<NextcloudProbeResult> {
  const config = await getNextcloudConfig()
  if (!config) return { success: false, error: NEXTCLOUD_NOT_CONFIGURED }

  try {
    const response = await fetch(davUrl(config, config.basePath), {
      method: 'PROPFIND',
      headers: { ...authHeaders(config), Depth: '0', 'Content-Type': 'application/xml' },
      body:
        '<?xml version="1.0"?>' +
        '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
      signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
    })

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: CREDENTIALS_REFUSED }
    }
    if (response.status === 404) {
      return { success: false, error: `Dossier introuvable : ${config.basePath}` }
    }
    if (response.status !== 207 && !response.ok) {
      return { success: false, error: `Le serveur a répondu HTTP ${response.status}` }
    }
  } catch (error: any) {
    return { success: false, error: networkMessage(error) }
  }

  // Les capacités sont un complément d'information : leur absence n'invalide pas une instance
  // dont le WebDAV vient de répondre.
  let version: string | undefined
  let office: string[] | undefined
  try {
    const response = await fetch(
      `${instanceRoot(config.url)}/ocs/v2.php/cloud/capabilities?format=json`,
      {
        headers: { ...authHeaders(config), 'OCS-APIRequest': 'true', Accept: 'application/json' },
        signal: AbortSignal.timeout(DAV_TIMEOUT_MS),
      }
    )
    if (response.ok) {
      const envelope = await response.json()
      version = envelope?.ocs?.data?.version?.string
      const capabilities = envelope?.ocs?.data?.capabilities ?? {}
      const known: Array<[string, string]> = [
        ['eurooffice', 'Euro-Office'],
        ['onlyoffice', 'ONLYOFFICE'],
        ['richdocuments', 'Nextcloud Office'],
      ]
      office = known.filter(([key]) => capabilities[key]).map(([, label]) => label)
    }
  } catch {
    /* facultatif */
  }

  return { success: true, version, office }
}
