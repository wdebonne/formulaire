'use client'

// Modale « Options » d'un formulaire : conditions dans lesquelles le formulaire public accepte
// des réponses. Les règles sont appliquées côté serveur (src/lib/form-gate.ts) — cette modale
// n'en est que la saisie.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { DEFAULT_ACCESS_MESSAGES, formatAccessDate, parseLocalDateTime } from '@/lib/form-options'
import type { PublicFormAccessSettings } from '@/types/form'
import {
  CalendarClock,
  CheckCircle2,
  EyeOff,
  Loader2,
  Lock,
  Settings2,
  Users,
} from 'lucide-react'

interface FormOptionsModalProps {
  formId: string
  formTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

interface OptionsState {
  opensAt: string
  closesAt: string
  notYetOpenMessage: string
  closedMessage: string
  passwordEnabled: boolean
  passwordMessage: string
  maxResponsesEnabled: boolean
  maxResponses: string
  limitReachedMessage: string
  onePerDevice: boolean
  alreadySubmittedMessage: string
  requireLogin: boolean
  loginRequiredMessage: string
  noIndex: boolean
}

const EMPTY_STATE: OptionsState = {
  opensAt: '',
  closesAt: '',
  notYetOpenMessage: '',
  closedMessage: '',
  passwordEnabled: false,
  passwordMessage: '',
  maxResponsesEnabled: false,
  maxResponses: '',
  limitReachedMessage: '',
  onePerDevice: false,
  alreadySubmittedMessage: '',
  requireLogin: false,
  loginRequiredMessage: '',
  noIndex: false,
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Lock
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function MessageField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-600">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
      />
    </div>
  )
}

export function FormOptionsModal({
  formId,
  formTitle,
  open,
  onOpenChange,
  onSaved,
}: FormOptionsModalProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<OptionsState>(EMPTY_STATE)
  const [passwordSet, setPasswordSet] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [responsesCount, setResponsesCount] = useState(0)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')

  const patch = (values: Partial<OptionsState>) => setState((prev) => ({ ...prev, ...values }))

  const load = useCallback(async () => {
    setLoading(true)
    setNewPassword('')
    try {
      const res = await fetch(`/api/forms/${formId}/options`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data: {
        settings: PublicFormAccessSettings
        responsesCount: number
        status: 'draft' | 'published'
      } = await res.json()

      const s = data.settings
      setState({
        opensAt: s.opensAt ?? '',
        closesAt: s.closesAt ?? '',
        notYetOpenMessage: s.notYetOpenMessage ?? '',
        closedMessage: s.closedMessage ?? '',
        passwordEnabled: Boolean(s.passwordEnabled),
        passwordMessage: s.passwordMessage ?? '',
        maxResponsesEnabled: Boolean(s.maxResponsesEnabled),
        maxResponses: s.maxResponses ? String(s.maxResponses) : '',
        limitReachedMessage: s.limitReachedMessage ?? '',
        onePerDevice: Boolean(s.onePerDevice),
        alreadySubmittedMessage: s.alreadySubmittedMessage ?? '',
        requireLogin: Boolean(s.requireLogin),
        loginRequiredMessage: s.loginRequiredMessage ?? '',
        noIndex: Boolean(s.noIndex),
      })
      setPasswordSet(Boolean(s.passwordSet))
      setResponsesCount(data.responsesCount)
      setStatus(data.status)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Bandeau d'état : ce que verrait un visiteur en arrivant maintenant sur le formulaire.
  const currentState = useMemo(() => {
    if (status !== 'published') {
      return { tone: 'amber', label: 'Brouillon — le formulaire n’est pas encore publié' }
    }
    const now = Date.now()
    const opensAt = parseLocalDateTime(state.opensAt)
    if (opensAt && now < opensAt.getTime()) {
      return { tone: 'amber', label: `Ouvre le ${formatAccessDate(state.opensAt)}` }
    }
    const closesAt = parseLocalDateTime(state.closesAt)
    if (closesAt && now >= closesAt.getTime()) {
      return { tone: 'red', label: `Clôturé depuis le ${formatAccessDate(state.closesAt)}` }
    }
    const max = Number(state.maxResponses)
    if (state.maxResponsesEnabled && max > 0 && responsesCount >= max) {
      return { tone: 'red', label: `Quota atteint (${responsesCount}/${max} réponses)` }
    }
    if (closesAt) {
      return { tone: 'green', label: `Ouvert jusqu’au ${formatAccessDate(state.closesAt)}` }
    }
    return { tone: 'green', label: 'Ouvert aux réponses' }
  }, [status, state, responsesCount])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/options`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state,
          opensAt: state.opensAt || null,
          closesAt: state.closesAt || null,
          maxResponses: state.maxResponses ? Number(state.maxResponses) : null,
          ...(newPassword && { password: newPassword }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')

      setPasswordSet(Boolean(data.settings?.passwordSet))
      setNewPassword('')
      onSaved?.()
      toast({ title: 'Options enregistrées' })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toneClasses: Record<string, string> = {
    green: 'border-green-200 bg-green-50 text-green-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-purple-600" />
            Options du formulaire
          </DialogTitle>
          <DialogDescription>
            Conditions d’accès de « {formTitle} ». Elles sont vérifiées à l’ouverture de la page
            publique <em>et</em> à l’envoi de chaque réponse.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${toneClasses[currentState.tone]}`}
            >
              {currentState.label}
              <span className="ml-2 font-normal opacity-80">
                · {responsesCount} réponse{responsesCount > 1 ? 's' : ''} reçue
                {responsesCount > 1 ? 's' : ''}
              </span>
            </div>

            <Section
              icon={CalendarClock}
              title="Période de disponibilité"
              description="Heure du serveur. Laissez vide pour ne pas fixer de limite."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Date de mise en ligne</Label>
                  <Input
                    type="datetime-local"
                    value={state.opensAt}
                    onChange={(e) => patch({ opensAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">Date de clôture</Label>
                  <Input
                    type="datetime-local"
                    value={state.closesAt}
                    onChange={(e) => patch({ closesAt: e.target.value })}
                  />
                </div>
              </div>

              {state.opensAt && (
                <MessageField
                  label="Message avant l’ouverture"
                  value={state.notYetOpenMessage}
                  placeholder={DEFAULT_ACCESS_MESSAGES.not_open}
                  onChange={(notYetOpenMessage) => patch({ notYetOpenMessage })}
                />
              )}
              {state.closesAt && (
                <MessageField
                  label="Message après la clôture"
                  value={state.closedMessage}
                  placeholder={DEFAULT_ACCESS_MESSAGES.closed}
                  onChange={(closedMessage) => patch({ closedMessage })}
                />
              )}
            </Section>

            <Section
              icon={Lock}
              title="Mot de passe d’accès"
              description="Le formulaire n’est visible qu’après saisie du mot de passe. L’accès est mémorisé 12 h sur l’appareil."
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.passwordEnabled}
                  onChange={(e) => patch({ passwordEnabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">Protéger l’accès par un mot de passe</span>
              </label>

              {state.passwordEnabled && (
                <div className="space-y-3 pl-7">
                  {passwordSet && (
                    <p className="flex items-center gap-1.5 text-xs text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Un mot de passe est actuellement défini.
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">
                      {passwordSet ? 'Nouveau mot de passe' : 'Mot de passe'}
                    </Label>
                    <Input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={
                        passwordSet
                          ? 'Laisser vide pour conserver l’actuel'
                          : '4 caractères minimum'
                      }
                      autoComplete="off"
                    />
                    <p className="text-xs text-gray-500">
                      Modifier le mot de passe déconnecte immédiatement les visiteurs qui avaient
                      déjà accès.
                    </p>
                  </div>
                  <MessageField
                    label="Message de l’écran de saisie"
                    value={state.passwordMessage}
                    placeholder={DEFAULT_ACCESS_MESSAGES.password_required}
                    onChange={(passwordMessage) => patch({ passwordMessage })}
                  />
                </div>
              )}
            </Section>

            <Section
              icon={Users}
              title="Participation"
              description="Quota global et restrictions par répondant."
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.maxResponsesEnabled}
                  onChange={(e) => patch({ maxResponsesEnabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">Limiter le nombre total de réponses</span>
              </label>

              {state.maxResponsesEnabled && (
                <div className="space-y-3 pl-7">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      value={state.maxResponses}
                      onChange={(e) => patch({ maxResponses: e.target.value })}
                      className="w-32"
                      placeholder="100"
                    />
                    <span className="text-sm text-gray-600">
                      réponses maximum ({responsesCount} déjà reçue
                      {responsesCount > 1 ? 's' : ''})
                    </span>
                  </div>
                  <MessageField
                    label="Message une fois le quota atteint"
                    value={state.limitReachedMessage}
                    placeholder={DEFAULT_ACCESS_MESSAGES.limit_reached}
                    onChange={(limitReachedMessage) => patch({ limitReachedMessage })}
                  />
                </div>
              )}

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.onePerDevice}
                  onChange={(e) => patch({ onePerDevice: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">Une seule réponse par appareil</span>
              </label>
              {state.onePerDevice && (
                <div className="space-y-3 pl-7">
                  <p className="text-xs text-gray-500">
                    Repose sur un cookie déposé après l’envoi : dissuasif, mais contournable en
                    changeant de navigateur. Pour une garantie stricte, utilisez « Réserver aux
                    utilisateurs connectés ».
                  </p>
                  <MessageField
                    label="Message en cas de seconde visite"
                    value={state.alreadySubmittedMessage}
                    placeholder={DEFAULT_ACCESS_MESSAGES.already_submitted}
                    onChange={(alreadySubmittedMessage) => patch({ alreadySubmittedMessage })}
                  />
                </div>
              )}

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.requireLogin}
                  onChange={(e) => patch({ requireLogin: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">
                  Réserver aux utilisateurs connectés à l’application
                </span>
              </label>
              {state.requireLogin && (
                <div className="pl-7">
                  <MessageField
                    label="Message pour un visiteur non connecté"
                    value={state.loginRequiredMessage}
                    placeholder={DEFAULT_ACCESS_MESSAGES.login_required}
                    onChange={(loginRequiredMessage) => patch({ loginRequiredMessage })}
                  />
                </div>
              )}
            </Section>

            <Section
              icon={EyeOff}
              title="Confidentialité"
              description="Visibilité du formulaire pour les moteurs de recherche."
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={state.noIndex}
                  onChange={(e) => patch({ noIndex: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-800">
                  Empêcher l’indexation par les moteurs de recherche
                </span>
              </label>
              <p className="pl-7 text-xs text-gray-500">
                Un formulaire protégé par mot de passe ou réservé aux utilisateurs connectés est de
                toute façon désindexé.
              </p>
            </Section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
