'use client'

// Écran affiché à la place du formulaire lorsque celui-ci n'est pas accessible : hors de sa
// fenêtre de publication, quota atteint, réponse déjà envoyée, connexion requise, ou mot de passe
// à saisir. Il reprend le thème du formulaire pour ne pas rompre visuellement avec lui.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Lock, Loader2, CheckCircle2, LogIn, Users } from 'lucide-react'
import { getBackgroundStyle } from '@/lib/utils'
import type { FormGateState, ThemeProperties } from '@/types/form'

interface FormGateScreenProps {
  formId: string
  formTitle: string
  slug: string
  state: Exclude<FormGateState, 'open'>
  message: string
  // Déjà formatée côté serveur : la formater ici produirait une chaîne différente si le fuseau du
  // navigateur ne correspond pas à celui du serveur, et donc une erreur d'hydratation.
  opensAtLabel?: string
  themeProps: ThemeProperties
  siteLogo?: string | null
}

const ICONS: Record<Exclude<FormGateState, 'open'>, typeof Lock> = {
  not_open: CalendarClock,
  closed: CalendarClock,
  limit_reached: Users,
  already_submitted: CheckCircle2,
  login_required: LogIn,
  password_required: Lock,
}

const TITLES: Record<Exclude<FormGateState, 'open'>, string> = {
  not_open: 'Pas encore ouvert',
  closed: 'Formulaire clôturé',
  limit_reached: 'Participation complète',
  already_submitted: 'Réponse déjà enregistrée',
  login_required: 'Accès réservé',
  password_required: 'Formulaire protégé',
}

export function FormGateScreen({
  formId,
  formTitle,
  slug,
  state,
  message,
  opensAtLabel,
  themeProps,
  siteLogo,
}: FormGateScreenProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const Icon = ICONS[state]
  const accent = themeProps.buttonsBgColor || '#7c3aed'
  const titleColor = themeProps.questionsColor || '#111827'
  const textColor = themeProps.answersColor || '#4b5563'

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password) return

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/forms/${formId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Mot de passe incorrect')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        ...getBackgroundStyle(themeProps),
        fontFamily: themeProps.font ? `'${themeProps.font}', sans-serif` : undefined,
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 text-center shadow-xl backdrop-blur">
        {siteLogo && (
          <img src={siteLogo} alt="" className="mx-auto mb-6 h-12 w-auto object-contain" />
        )}

        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon className="h-7 w-7" />
        </div>

        <h1 className="text-xl font-semibold" style={{ color: titleColor }}>
          {TITLES[state]}
        </h1>
        <p className="mt-1 text-sm font-medium" style={{ color: textColor }}>
          {formTitle}
        </p>

        <p className="mt-4 whitespace-pre-line text-sm" style={{ color: textColor }}>
          {message}
        </p>

        {state === 'not_open' && opensAtLabel && (
          <p className="mt-3 text-sm font-medium" style={{ color: accent }}>
            Ouverture le {opensAtLabel}
          </p>
        )}

        {state === 'login_required' && (
          <a
            href={`/login?redirect=${encodeURIComponent(`/${slug}`)}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent, color: themeProps.buttonsFontColor || '#ffffff' }}
          >
            Se connecter
          </a>
        )}

        {state === 'password_required' && (
          <form onSubmit={handleUnlock} className="mt-6 space-y-3 text-left">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2"
              style={{ ['--tw-ring-color' as string]: accent }}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: accent, color: themeProps.buttonsFontColor || '#ffffff' }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Accéder au formulaire
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
