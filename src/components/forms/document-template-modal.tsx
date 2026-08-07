'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  buildFieldCatalog,
  catalogToMappings,
  type DocumentCatalogField,
} from '@/lib/document-fields'
import type { FormDocumentSettings } from '@/types/form'
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'

interface FormBlock {
  id: string
  type: string
  attributes: { label?: string; [key: string]: any }
  innerBlocks?: FormBlock[]
}

interface DocumentTemplateModalProps {
  formId: string
  blocks: FormBlock[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (settings: FormDocumentSettings) => void
}

interface DocumentPayload extends FormDocumentSettings {
  tags: string[]
  templateError?: string
  pdfAvailable: boolean
}

const TYPE_LABELS: Record<string, string> = {
  'short-text': 'Texte court',
  'long-text': 'Texte long',
  number: 'Nombre',
  email: 'E-mail',
  phone: 'Téléphone',
  address: 'Adresse',
  date: 'Date',
  'advanced-date': 'Date avancée',
  time: 'Heure',
  dropdown: 'Liste déroulante',
  'multiple-choice': 'Choix multiple',
  'image-selection': 'Sélection d’image',
  slider: 'Curseur',
  legal: 'Mention légale',
  file: 'Fichier',
  signature: 'Signature',
  website: 'Site web',
  repeater: 'Répéteur',
  quantity: 'Quantité',
  'yes-no': 'Oui / Non',
  meta: 'Métadonnée',
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function CopyTag({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : la valeur reste sélectionnable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copier le jeton"
      className="group inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <span className="truncate max-w-[220px]">{label ?? value}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-blue-600" />
      )}
    </button>
  )
}

function ChoicesCell({ field }: { field: DocumentCatalogField }) {
  if (!field.choices?.length) return <span className="text-gray-300">—</span>
  const shown = field.choices.slice(0, 4)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((choice, i) => (
        <span
          key={`${choice.value}-${i}`}
          className="rounded bg-purple-50 px-1.5 py-0.5 text-[11px] text-purple-700"
        >
          {choice.label || choice.value}
        </span>
      ))}
      {field.choices.length > shown.length && (
        <span className="text-[11px] text-gray-400">+{field.choices.length - shown.length}</span>
      )}
    </div>
  )
}

function UsageBadge({ used }: { used: boolean }) {
  return used ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      <Check className="h-3 w-3" />
      Dans le modèle
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
      Non utilisé
    </span>
  )
}

export function DocumentTemplateModal({
  formId,
  blocks,
  open,
  onOpenChange,
  onSaved,
}: DocumentTemplateModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [payload, setPayload] = useState<DocumentPayload | null>(null)
  const [outputName, setOutputName] = useState('')
  const [outputFormat, setOutputFormat] = useState<'docx' | 'pdf'>('docx')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data: DocumentPayload = await res.json()
      setPayload(data)
      setOutputName(data.template.outputName ?? '')
      setOutputFormat(data.template.outputFormat === 'pdf' ? 'pdf' : 'docx')
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Le catalogue repart des mappings enregistrés : un jeton déjà attribué survit au renommage
  // de la question, ce qui protège les .docx déjà rédigés.
  const catalog = useMemo(
    () => buildFieldCatalog(blocks, payload?.template.mappings ?? []),
    [blocks, payload?.template.mappings]
  )

  const docTags = useMemo(() => new Set(payload?.tags ?? []), [payload?.tags])
  const knownTags = useMemo(
    () => new Set(catalogToMappings(catalog).map((m) => m.tag)),
    [catalog]
  )
  const unknownTags = useMemo(
    () => Array.from(docTags).filter((tag) => !knownTags.has(tag)),
    [docTags, knownTags]
  )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/forms/${formId}/document/template`, { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import impossible')

      // Les jetons sont figés dès l'import : l'utilisateur va les recopier dans Word, ils ne
      // doivent plus bouger même s'il renomme une question ensuite.
      await fetch(`/api/forms/${formId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: { mappings: catalogToMappings(buildFieldCatalog(blocks, data.template.mappings)) },
        }),
      })

      await load()
      onSaved?.(data)
      toast({ title: 'Modèle importé', description: file.name })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteTemplate = async () => {
    if (!confirm('Supprimer le modèle enregistré ?')) return
    try {
      const res = await fetch(`/api/forms/${formId}/document/template`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Suppression impossible')
      const data = await res.json()
      await load()
      onSaved?.(data)
      toast({ title: 'Modèle supprimé' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            mappings: catalogToMappings(catalog),
            outputName,
            outputFormat,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      setPayload((prev) => (prev ? { ...prev, ...data } : prev))
      onSaved?.(data)
      toast({ title: 'Modèle enregistré' })
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const template = payload?.template
  const hasTemplate = Boolean(template?.storedName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Modèle de document
          </DialogTitle>
          <DialogDescription>
            Importez un fichier Word et collez-y les jetons ci-dessous : ils seront remplacés par
            les réponses au moment de la génération.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Fichier modèle */}
            <div className="rounded-xl border border-gray-200 p-4">
              {hasTemplate ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{template?.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {template?.size ? `${Math.round(template.size / 1024)} Ko` : ''}
                        {template?.uploadedAt
                          ? ` — importé le ${new Date(template.uploadedAt).toLocaleDateString('fr-FR')}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/api/forms/${formId}/document/template`} download>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Remplacer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteTemplate}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-8 transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    <Upload className="h-6 w-6 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    Importer un modèle Word (.docx)
                  </span>
                  <span className="text-xs text-gray-500">10 Mo maximum</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
            </div>

            {payload?.templateError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{payload.templateError}</span>
              </div>
            )}

            {unknownTags.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      Jetons présents dans le document mais inconnus du formulaire
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {unknownTags.map((tag) => (
                        <code
                          key={tag}
                          className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs"
                        >
                          {`{${tag}}`}
                        </code>
                      ))}
                    </p>
                    <p className="mt-1 text-xs">Ils resteront vides à la génération.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tableau des champs */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Champs disponibles ({catalog.length})
              </h3>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Champ
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Type
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Jeton à coller
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Réponses possibles
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                        État
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {catalog.map((field) => (
                      <FieldRows key={field.blockId} field={field} docTags={docTags} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Dans Word, écrivez le jeton tel quel, accolades comprises. Pour un répéteur,
                encadrez les lignes à répéter (une ligne de tableau, par exemple) avec le jeton
                d’ouverture et de fermeture.
              </p>
            </div>

            {/* Sortie */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="outputName">Nom du fichier généré</Label>
                <Input
                  id="outputName"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  placeholder="Ordre de mission - {nom_et_prenom_de_l_agent}"
                />
                <p className="text-xs text-gray-500">
                  Les jetons du tableau sont acceptés ici aussi.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Format de sortie</Label>
                {payload?.pdfAvailable ? (
                  <div className="flex gap-4 pt-1.5">
                    {(['docx', 'pdf'] as const).map((format) => (
                      <label key={format} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="outputFormat"
                          checked={outputFormat === format}
                          onChange={() => setOutputFormat(format)}
                        />
                        {format === 'docx' ? 'Word (.docx)' : 'PDF'}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Word (.docx). La sortie PDF nécessite un convertisseur externe déclaré et
                    vérifié dans Administration → Documents.
                  </div>
                )}
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

function FieldRows({ field, docTags }: { field: DocumentCatalogField; docTags: Set<string> }) {
  const isLoop = Boolean(field.children?.length)

  return (
    <>
      <tr className={isLoop ? 'bg-indigo-50/40' : undefined}>
        <td className="px-4 py-2.5">
          <div className="font-medium text-gray-900">{field.label}</div>
          {field.parentLabel && (
            <div className="text-xs text-gray-500">dans « {field.parentLabel} »</div>
          )}
        </td>
        <td className="px-4 py-2.5 text-gray-600">{typeLabel(field.type)}</td>
        <td className="px-4 py-2.5">
          {isLoop ? (
            <div className="flex flex-col gap-1">
              <CopyTag value={`{#${field.tag}}`} />
              <CopyTag value={`{/${field.tag}}`} />
            </div>
          ) : (
            <CopyTag value={`{${field.tag}}`} />
          )}
        </td>
        <td className="px-4 py-2.5">
          {isLoop ? (
            <span className="text-xs text-gray-500">
              Boucle — encadre les {field.children!.length} champs ci-dessous
            </span>
          ) : (
            <ChoicesCell field={field} />
          )}
        </td>
        <td className="px-4 py-2.5">
          <UsageBadge used={docTags.has(field.tag)} />
        </td>
      </tr>

      {field.children?.map((child) => (
        <tr key={child.blockId} className="bg-indigo-50/20">
          <td className="px-4 py-2.5 pl-10">
            <div className="text-gray-900">{child.label}</div>
            <div className="text-xs text-gray-500">à placer dans la boucle</div>
          </td>
          <td className="px-4 py-2.5 text-gray-600">{typeLabel(child.type)}</td>
          <td className="px-4 py-2.5">
            <CopyTag value={`{${child.tag}}`} />
          </td>
          <td className="px-4 py-2.5">
            <ChoicesCell field={child} />
          </td>
          <td className="px-4 py-2.5">
            <UsageBadge used={docTags.has(child.tag)} />
          </td>
        </tr>
      ))}
    </>
  )
}
