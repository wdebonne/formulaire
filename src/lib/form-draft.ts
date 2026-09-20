// Brouillon local d'une saisie en cours — partie pure, sans Prisma ni réseau.
//
// Même découpage que form-options.ts / form-gate.ts : tout ce qui touche au stockage du
// navigateur vit ici, importable depuis le formulaire public ('use client'), et rien de tout
// cela n'atteint jamais le serveur. Le brouillon reste sur l'appareil du répondant, et il en
// disparaît dès que la réponse est envoyée.

import type { SignatureValue } from '@/types/form'

const DRAFT_STORAGE_PREFIX = 'formbuilder:draft'

// Un brouillon écrit par une version antérieure du format est ignoré plutôt que réinterprété :
// proposer de reprendre une saisie pour la restaurer de travers est pire que ne rien proposer.
const DRAFT_VERSION = 1

// Passé ce délai, la reprise n'est plus proposée et l'entrée est effacée. Un brouillon est une
// commodité de quelques jours, pas un dossier que le navigateur garderait indéfiniment.
export const DRAFT_MAX_AGE_DAYS = 7

// Chaque frappe ne touche pas le disque ; la fermeture de l'onglet, elle, n'attend pas (voir
// l'écouteur `pagehide` côté formulaire public).
export const DRAFT_SAVE_DEBOUNCE_MS = 400

// L'aperçu du concepteur rend le même composant que la page publique. Sans cette séparation, une
// saisie de test faite dans l'aperçu serait proposée au premier répondant du formulaire publié.
export type DraftScope = 'public' | 'preview'

export interface DraftRepeaterState {
  isActive: boolean
  currentInnerIndex: number
  repetitionCount: number
  showRepeatQuestion: boolean
}

export interface FormDraft {
  version: number
  formId: string
  savedAt: string
  currentIndex: number
  answers: Record<string, any>
  repeaterStates: Record<string, DraftRepeaterState>
}

export function draftStorageKey(formId: string, scope: DraftScope = 'public'): string {
  return scope === 'preview'
    ? `${DRAFT_STORAGE_PREFIX}:preview:${formId}`
    : `${DRAFT_STORAGE_PREFIX}:${formId}`
}

// Le réglage est optionnel et vaut « activé » par défaut : un formulaire enregistré avant que la
// fonctionnalité existe en bénéficie sans être rouvert, comme pour l'anti-spam.
export function isDraftEnabled(settings: { saveDraftEnabled?: boolean } | null | undefined): boolean {
  return settings?.saveDraftEnabled !== false
}

function isSignatureValue(value: any): value is SignatureValue {
  return Boolean(value) && typeof value === 'object' && (value as any).kind === 'signature'
}

// Ce qu'on ne recopie pas sur le disque du répondant.
//
// La signature est volontairement exclue : c'est un acte, pas une saisie, et la refaire après une
// interruption est le comportement honnête. Accessoirement, un PNG en base64 remplirait à lui seul
// le quota du domaine. Une pièce jointe, elle, est conservée — la réponse n'en porte que la
// référence (nom d'origine, taille, nom stocké) et le fichier est déjà sur le serveur : la reprise
// évite précisément de le redéposer.
export function sanitizeDraftAnswers(answers: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const [key, value] of Object.entries(answers ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (isSignatureValue(value)) continue
    clean[key] = value
  }
  return clean
}

// Renvoie null quand il n'y a rien à conserver : ouvrir la page puis la fermer ne doit pas laisser
// de trace, et surtout pas écraser un brouillon existant par un objet vide.
export function buildFormDraft(
  formId: string,
  currentIndex: number,
  answers: Record<string, any>,
  repeaterStates: Record<string, DraftRepeaterState>
): FormDraft | null {
  const clean = sanitizeDraftAnswers(answers)
  if (Object.keys(clean).length === 0) return null

  return {
    version: DRAFT_VERSION,
    formId,
    savedAt: new Date().toISOString(),
    currentIndex: Math.max(0, currentIndex),
    answers: clean,
    repeaterStates: repeaterStates ?? {},
  }
}

function storage(): Storage | null {
  // Navigation privée, stockage désactivé par une stratégie de groupe, iframe cloisonné : l'accès
  // lui-même peut lever. Un brouillon est un confort, jamais une condition pour répondre.
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function draftAge(savedAt: string): number {
  const saved = new Date(savedAt).getTime()
  if (Number.isNaN(saved)) return Number.POSITIVE_INFINITY
  return Date.now() - saved
}

export function readDraft(formId: string, scope: DraftScope = 'public'): FormDraft | null {
  const store = storage()
  if (!store) return null

  try {
    const raw = store.getItem(draftStorageKey(formId, scope))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== DRAFT_VERSION ||
      parsed.formId !== formId ||
      typeof parsed.savedAt !== 'string' ||
      !parsed.answers ||
      typeof parsed.answers !== 'object'
    ) {
      clearDraft(formId, scope)
      return null
    }

    if (draftAge(parsed.savedAt) > DRAFT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      clearDraft(formId, scope)
      return null
    }

    const answers = sanitizeDraftAnswers(parsed.answers)
    if (Object.keys(answers).length === 0) {
      clearDraft(formId, scope)
      return null
    }

    return {
      version: DRAFT_VERSION,
      formId,
      savedAt: parsed.savedAt,
      currentIndex: typeof parsed.currentIndex === 'number' ? Math.max(0, parsed.currentIndex) : 0,
      answers,
      repeaterStates:
        parsed.repeaterStates && typeof parsed.repeaterStates === 'object' ? parsed.repeaterStates : {},
    }
  } catch {
    return null
  }
}

// Renvoie false quand l'écriture n'a pas abouti (quota atteint, stockage refusé) afin que
// l'interface n'affiche pas « brouillon enregistré » pour une saisie qui ne l'est pas.
export function writeDraft(draft: FormDraft, scope: DraftScope = 'public'): boolean {
  const store = storage()
  if (!store) return false

  try {
    store.setItem(draftStorageKey(draft.formId, scope), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearDraft(formId: string, scope: DraftScope = 'public'): void {
  const store = storage()
  if (!store) return

  try {
    store.removeItem(draftStorageKey(formId, scope))
  } catch {
    // Rien à faire : l'entrée expirera d'elle-même.
  }
}

export function formatDraftDate(savedAt: string): string {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

// Nombre de questions réellement conservées, annoncé dans la proposition de reprise. Les clés d'un
// bloc répétable (`{repeaterId}_{n}_{innerId}`) comptent chacune pour une : c'est bien le nombre de
// champs que le répondant retrouvera remplis.
export function draftAnswerCount(draft: FormDraft): number {
  return Object.keys(draft.answers).length
}
