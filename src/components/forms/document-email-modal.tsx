'use client'

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
import { buildFieldCatalog, catalogToMappings, type DocumentCatalogField } from '@/lib/document-fields'
import type { DocumentEmailRoute, FormDocumentSettings, LogicCondition } from '@/types/form'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  Loader2,
  Mail,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

interface FormBlock {
  id: string
  type: string
  attributes: { label?: string; [key: string]: any }
  innerBlocks?: FormBlock[]
}

interface DocumentEmailModalProps {
  formId: string
  blocks: FormBlock[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (settings: FormDocumentSettings) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const OPERATORS: { value: LogicCondition['operator']; label: string; needsValue: boolean }[] = [
  { value: 'equals', label: 'est égal à', needsValue: true },
  { value: 'not_equals', label: "n'est pas égal à", needsValue: true },
  { value: 'contains', label: 'contient', needsValue: true },
  { value: 'not_contains', label: 'ne contient pas', needsValue: true },
  { value: 'greater_than', label: 'est supérieur à', needsValue: true },
  { value: 'less_than', label: 'est inférieur à', needsValue: true },
  { value: 'is_empty', label: 'est vide', needsValue: false },
  { value: 'is_not_empty', label: "n'est pas vide", needsValue: false },
]

function collectEmailBlocks(blocks: FormBlock[]): { id: string; label: string }[] {
  const found: { id: string; label: string }[] = []
  const walk = (list: FormBlock[], parent?: string) => {
    for (const block of list) {
      if (block.type === 'email') {
        const label = block.attributes.label || block.id
        found.push({ id: block.id, label: parent ? `${label} (${parent})` : label })
      }
      if (block.innerBlocks?.length) walk(block.innerBlocks, block.attributes.label || parent)
    }
  }
  walk(blocks)
  return found
}

// Valeurs proposées pour une condition : les choix du bloc, ou les options Oui/Non et
// mention légale exposées par le catalogue sous forme de cases.
function valueOptions(field?: DocumentCatalogField): { label: string; value: string }[] {
  if (!field) return []
  if (field.choices?.length) return field.choices.map((c) => ({ label: c.label, value: c.value }))
  if (field.checkboxes?.length) {
    return field.checkboxes.map((b) => ({ label: b.label, value: b.choiceValue }))
  }
  return []
}

function newRoute(name: string): DocumentEmailRoute {
  return {
    id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    enabled: true,
    conditions: [],
    conditionMatch: 'all',
    recipients: [],
    recipientBlockIds: [],
    subject: 'Nouvelle réponse — {form_title}',
    body:
      '<p>Bonjour,</p>\n<p>Veuillez trouver ci-joint le document généré à partir de la réponse ' +
      'au formulaire « {form_title} » reçue le {entry_date}.</p>\n<p>Cordialement,</p>',
    attachDocument: true,
  }
}

export function DocumentEmailModal({
  formId,
  blocks,
  open,
  onOpenChange,
  onSaved,
}: DocumentEmailModalProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasTemplate, setHasTemplate] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [sendOnSubmission, setSendOnSubmission] = useState(true)
  const [routes, setRoutes] = useState<DocumentEmailRoute[]>([])
  const [mappings, setMappings] = useState<FormDocumentSettings['template']['mappings']>([])
  const [openRouteId, setOpenRouteId] = useState<string | null>(null)
  const [openConditionsId, setOpenConditionsId] = useState<string | null>(null)

  const emailBlocks = useMemo(() => collectEmailBlocks(blocks), [blocks])
  const catalog = useMemo(() => buildFieldCatalog(blocks, mappings), [blocks, mappings])

  // Les champs internes d'un répéteur ne sont pas adressables ici : leurs réponses sont stockées
  // sous des clés composées d'un numéro d'itération.
  const conditionFields = useMemo(
    () => catalog.filter((f) => !f.isMeta && f.type !== 'repeater'),
    [catalog]
  )
  const fieldById = useMemo(
    () => new Map(conditionFields.map((f) => [f.blockId, f])),
    [conditionFields]
  )
  const availableTags = useMemo(() => catalogToMappings(catalog).map((m) => m.tag), [catalog])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data: FormDocumentSettings = await res.json()
      setHasTemplate(Boolean(data.template.storedName))
      setMappings(data.template.mappings ?? [])
      setEnabled(data.email.enabled)
      setSendOnSubmission(data.email.sendOnSubmission)
      setRoutes(data.email.routes ?? [])
      setOpenRouteId(null)
      setOpenConditionsId(null)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const updateRoute = (id: string, patch: Partial<DocumentEmailRoute>) => {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const updateCondition = (routeId: string, index: number, patch: Partial<LogicCondition>) => {
    setRoutes((prev) =>
      prev.map((r) =>
        r.id === routeId
          ? { ...r, conditions: r.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
          : r
      )
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: { enabled, sendOnSubmission, routes } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      onSaved?.(data)
      toast({ title: 'Circuits d’envoi enregistrés' })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const routeSummary = (route: DocumentEmailRoute): string => {
    const count = route.conditions.length
    if (count === 0) return 'Toujours envoyé'
    return `${count} condition${count > 1 ? 's' : ''} (${route.conditionMatch === 'any' ? 'au moins une' : 'toutes'})`
  }

  const recipientSummary = (route: DocumentEmailRoute): string => {
    const fixed = route.recipients.length
    const fields = route.recipientBlockIds.length
    if (fixed === 0 && fields === 0) return 'aucun destinataire'
    const parts: string[] = []
    if (fixed) parts.push(`${fixed} adresse${fixed > 1 ? 's' : ''}`)
    if (fields) parts.push(`${fields} champ${fields > 1 ? 's' : ''} e-mail`)
    return parts.join(' + ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-600" />
            Circuits d’envoi
          </DialogTitle>
          <DialogDescription>
            Chaque circuit décide de ses propres destinataires. Sans condition, il part à chaque
            réponse ; avec conditions, seuls les services concernés sont prévenus.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {!hasTemplate && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Aucun modèle Word n’est encore importé. Les circuits resteront inactifs tant que
                  la modale « Modèle de document » n’en contient pas.
                </span>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-gray-200 p-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-900">
                  Activer l’envoi du document par e-mail
                </span>
              </label>
              <label className="flex items-center gap-3 pl-7">
                <input
                  type="checkbox"
                  checked={sendOnSubmission}
                  onChange={(e) => setSendOnSubmission(e.target.checked)}
                  disabled={!enabled}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Évaluer les circuits à chaque nouvelle réponse
                </span>
              </label>
              <p className="pl-7 text-xs text-gray-500">
                Décochez pour ne déclencher les circuits que manuellement, depuis la liste des
                réponses.
              </p>
            </div>

            {/* Circuits */}
            <div className="space-y-3">
              {routes.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-600">Aucun circuit défini.</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ajoutez-en un par service à prévenir — cantine, service technique…
                  </p>
                </div>
              )}

              {routes.map((route) => {
                const isOpen = openRouteId === route.id
                const conditionsOpen = openConditionsId === route.id
                return (
                  <div
                    key={route.id}
                    className={`rounded-xl border transition-colors ${
                      route.enabled ? 'border-gray-200' : 'border-gray-200 bg-gray-50/60'
                    }`}
                  >
                    {/* En-tête repliée */}
                    <div className="flex items-center gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => setOpenRouteId(isOpen ? null : route.id)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-gray-900">{route.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                route.conditions.length === 0
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-purple-50 text-purple-700'
                              }`}
                            >
                              {routeSummary(route)}
                            </span>
                            <span className="text-gray-500">→ {recipientSummary(route)}</span>
                          </div>
                        </div>
                      </button>

                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={route.enabled}
                          onChange={(e) => updateRoute(route.id, { enabled: e.target.checked })}
                          className="rounded"
                        />
                        Actif
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Supprimer le circuit « ${route.name} » ?`)) return
                          setRoutes((prev) => prev.filter((r) => r.id !== route.id))
                        }}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Supprimer ce circuit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="space-y-4 border-t border-gray-100 p-4">
                        <div className="space-y-2">
                          <Label>Nom du circuit</Label>
                          <Input
                            value={route.name}
                            onChange={(e) => updateRoute(route.id, { name: e.target.value })}
                            placeholder="Cantine"
                          />
                        </div>

                        {/* Conditions — repliées par défaut */}
                        <div className="rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenConditionsId(conditionsOpen ? null : route.id)
                            }
                            className="flex w-full items-center gap-2 p-3 text-left"
                          >
                            {conditionsOpen ? (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            )}
                            <Filter className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-gray-800">
                              Conditions de déclenchement
                            </span>
                            <span className="ml-auto text-xs text-gray-500">
                              {routeSummary(route)}
                            </span>
                          </button>

                          {conditionsOpen && (
                            <div className="space-y-3 border-t border-gray-100 p-3">
                              {route.conditions.length > 1 && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600">Déclencher si</span>
                                  <select
                                    value={route.conditionMatch}
                                    onChange={(e) =>
                                      updateRoute(route.id, {
                                        conditionMatch: e.target.value as 'all' | 'any',
                                      })
                                    }
                                    className="rounded-md border px-2 py-1 text-sm"
                                  >
                                    <option value="all">toutes les conditions</option>
                                    <option value="any">au moins une condition</option>
                                  </select>
                                  <span className="text-gray-600">sont remplies</span>
                                </div>
                              )}

                              {route.conditions.map((condition, index) => {
                                const field = fieldById.get(condition.blockId)
                                const operator = OPERATORS.find(
                                  (o) => o.value === condition.operator
                                )
                                const options = valueOptions(field)
                                return (
                                  <div
                                    key={index}
                                    className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2"
                                  >
                                    <select
                                      value={condition.blockId}
                                      onChange={(e) =>
                                        updateCondition(route.id, index, {
                                          blockId: e.target.value,
                                          value: '',
                                        })
                                      }
                                      className="min-w-[180px] flex-1 rounded-md border px-2 py-1.5 text-sm"
                                    >
                                      <option value="">Question…</option>
                                      {conditionFields.map((f) => (
                                        <option key={f.blockId} value={f.blockId}>
                                          {f.parentLabel ? `${f.parentLabel} — ` : ''}
                                          {f.label}
                                        </option>
                                      ))}
                                    </select>

                                    <select
                                      value={condition.operator}
                                      onChange={(e) =>
                                        updateCondition(route.id, index, {
                                          operator: e.target
                                            .value as LogicCondition['operator'],
                                        })
                                      }
                                      className="rounded-md border px-2 py-1.5 text-sm"
                                    >
                                      {OPERATORS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>

                                    {operator?.needsValue &&
                                      (options.length > 0 ? (
                                        <select
                                          value={String(condition.value ?? '')}
                                          onChange={(e) =>
                                            updateCondition(route.id, index, {
                                              value: e.target.value,
                                            })
                                          }
                                          className="min-w-[140px] flex-1 rounded-md border px-2 py-1.5 text-sm"
                                        >
                                          <option value="">Valeur…</option>
                                          {options.map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <Input
                                          value={String(condition.value ?? '')}
                                          onChange={(e) =>
                                            updateCondition(route.id, index, {
                                              value: e.target.value,
                                            })
                                          }
                                          placeholder="Valeur"
                                          className="min-w-[140px] flex-1"
                                        />
                                      ))}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateRoute(route.id, {
                                          conditions: route.conditions.filter(
                                            (_, i) => i !== index
                                          ),
                                        })
                                      }
                                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                      title="Retirer cette condition"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                )
                              })}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateRoute(route.id, {
                                    conditions: [
                                      ...route.conditions,
                                      {
                                        blockId: conditionFields[0]?.blockId ?? '',
                                        operator: 'equals',
                                        value: '',
                                      },
                                    ],
                                  })
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter une condition
                              </Button>

                              {route.conditions.length === 0 && (
                                <p className="text-xs text-gray-500">
                                  Sans condition, ce circuit part à chaque réponse.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <RouteRecipients
                          route={route}
                          emailBlocks={emailBlocks}
                          onChange={(patch) => updateRoute(route.id, patch)}
                        />

                        <div className="space-y-2">
                          <Label>Objet</Label>
                          <Input
                            value={route.subject}
                            onChange={(e) => updateRoute(route.id, { subject: e.target.value })}
                            placeholder="Nouvelle réponse — {form_title}"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Corps du message (HTML)</Label>
                          <textarea
                            value={route.body}
                            onChange={(e) => updateRoute(route.id, { body: e.target.value })}
                            className="h-36 w-full rounded-md border px-3 py-2 font-mono text-sm"
                          />
                        </div>

                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={route.attachDocument !== false}
                            onChange={(e) =>
                              updateRoute(route.id, { attachDocument: e.target.checked })
                            }
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">
                            Joindre le document généré
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const route = newRoute(`Circuit ${routes.length + 1}`)
                  setRoutes((prev) => [...prev, route])
                  setOpenRouteId(route.id)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un circuit
              </Button>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1.5 text-xs font-medium text-gray-600">
                Jetons acceptés dans l’objet et le corps :
              </p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <code
                    key={tag}
                    className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 ring-1 ring-gray-200"
                  >
                    {`{${tag}}`}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RouteRecipients({
  route,
  emailBlocks,
  onChange,
}: {
  route: DocumentEmailRoute
  emailBlocks: { id: string; label: string }[]
  onChange: (patch: Partial<DocumentEmailRoute>) => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState('')

  const add = () => {
    const address = draft.trim()
    if (!EMAIL_RE.test(address)) {
      toast({ title: 'Adresse invalide', variant: 'destructive' })
      return
    }
    if (!route.recipients.includes(address)) {
      onChange({ recipients: [...route.recipients, address] })
    }
    setDraft('')
  }

  return (
    <div className="space-y-3">
      <Label>Destinataires de ce circuit</Label>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="cantine@exemple.fr"
          type="email"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {route.recipients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {route.recipients.map((address) => (
            <span
              key={address}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-3 pr-1.5 text-sm text-emerald-800"
            >
              {address}
              <button
                type="button"
                onClick={() =>
                  onChange({ recipients: route.recipients.filter((a) => a !== address) })
                }
                className="rounded-full p-0.5 hover:bg-emerald-100"
                title="Retirer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {emailBlocks.length > 0 && (
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">
            Ou utiliser un champ e-mail du formulaire
          </p>
          <div className="space-y-1.5">
            {emailBlocks.map((block) => (
              <label key={block.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={route.recipientBlockIds.includes(block.id)}
                  onChange={() =>
                    onChange({
                      recipientBlockIds: route.recipientBlockIds.includes(block.id)
                        ? route.recipientBlockIds.filter((id) => id !== block.id)
                        : [...route.recipientBlockIds, block.id],
                    })
                  }
                  className="rounded"
                />
                <span className="text-gray-700">{block.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {route.recipients.length === 0 && route.recipientBlockIds.length === 0 && (
        <p className="text-xs text-red-600">
          Aucun destinataire : ce circuit échouera s’il se déclenche.
        </p>
      )}
    </div>
  )
}
