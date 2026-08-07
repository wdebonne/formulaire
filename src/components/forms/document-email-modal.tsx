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
import { buildFieldCatalog, catalogToMappings } from '@/lib/document-fields'
import type { FormDocumentSettings } from '@/types/form'
import { AlertTriangle, Loader2, Mail, Plus, X } from 'lucide-react'

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

// Blocs dont la valeur peut servir d'adresse de destination.
function collectEmailBlocks(blocks: FormBlock[]): { id: string; label: string }[] {
  const found: { id: string; label: string }[] = []
  const walk = (list: FormBlock[], parent?: string) => {
    for (const block of list) {
      if (block.type === 'email') {
        const label = block.attributes.label || block.id
        found.push({ id: block.id, label: parent ? `${label} (${parent})` : label })
      }
      if (block.innerBlocks?.length) {
        walk(block.innerBlocks, block.attributes.label || parent)
      }
    }
  }
  walk(blocks)
  return found
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
  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientBlockIds, setRecipientBlockIds] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [newRecipient, setNewRecipient] = useState('')
  const [mappings, setMappings] = useState<FormDocumentSettings['template']['mappings']>([])

  const emailBlocks = useMemo(() => collectEmailBlocks(blocks), [blocks])

  // Mêmes jetons que le modèle : ils sont acceptés dans le sujet et le corps du message.
  const availableTags = useMemo(
    () => catalogToMappings(buildFieldCatalog(blocks, mappings)).map((m) => m.tag),
    [blocks, mappings]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data: FormDocumentSettings & { tags: string[] } = await res.json()
      setHasTemplate(Boolean(data.template.storedName))
      setMappings(data.template.mappings ?? [])
      setEnabled(data.email.enabled)
      setSendOnSubmission(data.email.sendOnSubmission)
      setRecipients(data.email.recipients ?? [])
      setRecipientBlockIds(data.email.recipientBlockIds ?? [])
      setSubject(data.email.subject ?? '')
      setBody(data.email.body ?? '')
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const addRecipient = () => {
    const address = newRecipient.trim()
    if (!EMAIL_RE.test(address)) {
      toast({ title: 'Adresse invalide', variant: 'destructive' })
      return
    }
    if (recipients.includes(address)) {
      setNewRecipient('')
      return
    }
    setRecipients([...recipients, address])
    setNewRecipient('')
  }

  const toggleBlockRecipient = (blockId: string) => {
    setRecipientBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: {
            enabled,
            sendOnSubmission,
            recipients,
            recipientBlockIds,
            subject,
            body,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      onSaved?.(data)
      toast({ title: 'Paramètres d’e-mail enregistrés' })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const noRecipients = recipients.length === 0 && recipientBlockIds.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-600" />
            E-mail d’envoi du document
          </DialogTitle>
          <DialogDescription>
            Objet, corps du message et destinataires de l’e-mail auquel le document généré est
            joint.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {!hasTemplate && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Aucun modèle Word n’est encore importé. L’envoi restera inactif tant que la
                  modale « Modèle de document » n’en contient pas.
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
                  Envoyer automatiquement à chaque nouvelle réponse
                </span>
              </label>
              <p className="pl-7 text-xs text-gray-500">
                Décochez pour n’envoyer que manuellement, depuis la liste des réponses.
              </p>
            </div>

            {/* Destinataires */}
            <div className="space-y-3">
              <Label>Destinataires</Label>

              <div className="flex gap-2">
                <Input
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addRecipient()
                    }
                  }}
                  placeholder="adresse@exemple.fr"
                  type="email"
                />
                <Button type="button" variant="outline" onClick={addRecipient}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>

              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {recipients.map((address) => (
                    <span
                      key={address}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-1 pl-3 pr-1.5 text-sm text-emerald-800"
                    >
                      {address}
                      <button
                        type="button"
                        onClick={() => setRecipients(recipients.filter((a) => a !== address))}
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
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">
                    Ou utiliser un champ e-mail du formulaire comme destinataire
                  </p>
                  <div className="space-y-1.5">
                    {emailBlocks.map((block) => (
                      <label key={block.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={recipientBlockIds.includes(block.id)}
                          onChange={() => toggleBlockRecipient(block.id)}
                          className="rounded"
                        />
                        <span className="text-gray-700">{block.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {enabled && noRecipients && (
                <p className="text-xs text-red-600">
                  Aucun destinataire : l’envoi échouera tant qu’aucune adresse ni champ e-mail
                  n’est sélectionné.
                </p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="documentSubject">Objet</Label>
              <Input
                id="documentSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Nouvelle réponse — {form_title}"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documentBody">Corps du message (HTML)</Label>
              <textarea
                id="documentBody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="h-48 w-full rounded-md border px-3 py-2 font-mono text-sm"
              />
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
