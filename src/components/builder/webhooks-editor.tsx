'use client'

import { useState } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormBlock, Webhook, WebhookFieldMapping, WebhookHeader } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Webhook as WebhookIcon,
  Play, Maximize2, Minimize2, X, ArrowRight,
  AlignLeft, Hash, Mail, Phone, List, CheckSquare, Calendar, Clock,
  Layers, ToggleLeft, Globe, FileText, PenLine, Image, LayoutList,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WebhooksEditorProps {
  blocks: FormBlock[]
}

function getBlockTypeIcon(type: string) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'short-text':   return <AlignLeft className={cls} />
    case 'long-text':    return <FileText className={cls} />
    case 'email':        return <Mail className={cls} />
    case 'phone':        return <Phone className={cls} />
    case 'number':       return <Hash className={cls} />
    case 'dropdown':     return <List className={cls} />
    case 'multiple-choice': return <CheckSquare className={cls} />
    case 'date':
    case 'advanced-date': return <Calendar className={cls} />
    case 'time':         return <Clock className={cls} />
    case 'group':        return <Layers className={cls} />
    case 'repeater':     return <LayoutList className={cls} />
    case 'legal':        return <ToggleLeft className={cls} />
    case 'website':      return <Globe className={cls} />
    case 'signature':    return <PenLine className={cls} />
    case 'image-selection': return <Image className={cls} />
    default:             return <AlignLeft className={cls} />
  }
}

export function WebhooksEditor({ blocks }: WebhooksEditorProps) {
  const { webhooks, addWebhook, updateWebhook, removeWebhook } = useFormBuilder()
  const [expandedWebhooks, setExpandedWebhooks] = useState<string[]>([])
  const [maximizedWebhookId, setMaximizedWebhookId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const { toast } = useToast()

  const questionBlocks = blocks.filter(
    (b) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  // Aplatir aussi les innerBlocks des groupes/répéteurs pour le mapping
  const allMappableBlocks: FormBlock[] = []
  questionBlocks.forEach((b) => {
    allMappableBlocks.push(b)
    if ((b.type === 'group' || b.type === 'repeater') && b.innerBlocks) {
      b.innerBlocks.forEach((inner) => allMappableBlocks.push(inner))
    }
  })

  const toggleExpanded = (webhookId: string) => {
    setExpandedWebhooks((prev) =>
      prev.includes(webhookId) ? prev.filter((id) => id !== webhookId) : [...prev, webhookId]
    )
  }

  const handleAddWebhook = () => {
    const newWebhook: Webhook = {
      id: uuidv4(),
      name: `Webhook ${webhooks.length + 1}`,
      url: '',
      method: 'POST',
      headers: [],
      bodyFormat: 'JSON',
      fieldMappings: [],
      enabled: true,
      triggerOn: 'submission',
    }
    addWebhook(newWebhook)
    setExpandedWebhooks((prev) => [...prev, newWebhook.id])
  }

  const handleAddHeader = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { headers: [...webhook.headers, { key: '', value: '' }] })
  }

  const handleUpdateHeader = (webhookId: string, headerIndex: number, updates: Partial<WebhookHeader>) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    const newHeaders = [...webhook.headers]
    newHeaders[headerIndex] = { ...newHeaders[headerIndex], ...updates }
    updateWebhook(webhookId, { headers: newHeaders })
  }

  const handleRemoveHeader = (webhookId: string, headerIndex: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { headers: webhook.headers.filter((_, i) => i !== headerIndex) })
  }

  const handleAddFieldMapping = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { fieldMappings: [...webhook.fieldMappings, { key: '', blockId: '' }] })
  }

  const handleUpdateFieldMapping = (webhookId: string, mappingIndex: number, updates: Partial<WebhookFieldMapping>) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    const newMappings = [...webhook.fieldMappings]
    newMappings[mappingIndex] = { ...newMappings[mappingIndex], ...updates }
    updateWebhook(webhookId, { fieldMappings: newMappings })
  }

  const handleRemoveFieldMapping = (webhookId: string, mappingIndex: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { fieldMappings: webhook.fieldMappings.filter((_, i) => i !== mappingIndex) })
  }

  const handleTestWebhook = async (webhook: Webhook) => {
    if (!webhook.url) {
      toast({ title: 'Erreur', description: 'Veuillez saisir une URL', variant: 'destructive' })
      return
    }

    setTesting(webhook.id)

    try {
      const testData: Record<string, any> = { _test: true, _timestamp: new Date().toISOString() }

      webhook.fieldMappings.forEach((mapping) => {
        if (mapping.key) {
          if (mapping.blockId === 'entry_date') {
            testData[mapping.key] = new Date().toISOString()
          } else if (mapping.blockId === 'entry_id') {
            testData[mapping.key] = 'test-entry-id'
          } else {
            const block = allMappableBlocks.find((b) => b.id === mapping.blockId)
            testData[mapping.key] = `Test value for ${block?.attributes.label || 'field'}`
          }
        }
      })

      const headers: Record<string, string> = {}
      webhook.headers.forEach((h) => { if (h.key) headers[h.key] = h.value })
      if (webhook.bodyFormat === 'JSON') headers['Content-Type'] = 'application/json'

      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhook.url, method: webhook.method, headers, data: testData, bodyFormat: webhook.bodyFormat }),
      })

      const result = await res.json()
      if (result.success) {
        toast({ title: 'Test réussi', description: `Réponse: ${result.status}` })
      } else {
        throw new Error(result.error || 'Erreur lors du test')
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  const getBlockLabel = (blockId: string) => {
    if (blockId === 'entry_date') return 'Date de soumission'
    if (blockId === 'entry_id') return 'ID de la réponse'
    const block = allMappableBlocks.find((b) => b.id === blockId)
    return block?.attributes.label || 'Sans titre'
  }

  // ─── Formulaire d'un webhook (réutilisé en mode compact ET agrandi) ──────────
  const renderWebhookForm = (webhook: Webhook, compact = true) => {
    const inputCls = compact ? 'h-8 text-sm' : 'h-9 text-sm'
    const selectCls = compact
      ? 'w-full px-2 py-1 text-sm border rounded'
      : 'w-full px-3 py-2 text-sm border rounded-md'

    return (
      <div className={compact ? 'p-3 space-y-4 border-t' : 'space-y-4'}>
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nom</Label>
          <Input
            value={webhook.name}
            onChange={(e) => updateWebhook(webhook.id, { name: e.target.value })}
            placeholder="Nom du webhook"
            className={inputCls}
          />
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">URL</Label>
          <Input
            value={webhook.url}
            onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
            placeholder="https://..."
            className={inputCls}
          />
        </div>

        {/* Method */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Méthode</Label>
          <select
            value={webhook.method}
            onChange={(e) => updateWebhook(webhook.id, { method: e.target.value as Webhook['method'] })}
            className={selectCls}
          >
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="GET">GET</option>
          </select>
        </div>

        {/* Trigger */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Déclencher</Label>
          <select
            value={webhook.triggerOn}
            onChange={(e) => updateWebhook(webhook.id, { triggerOn: e.target.value as Webhook['triggerOn'] })}
            className={selectCls}
          >
            <option value="submission">À la soumission</option>
            <option value="partial">Soumission partielle</option>
            <option value="save">À l'enregistrement</option>
          </select>
        </div>

        {/* Body format */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Format du corps</Label>
          <select
            value={webhook.bodyFormat}
            onChange={(e) => updateWebhook(webhook.id, { bodyFormat: e.target.value as Webhook['bodyFormat'] })}
            className={selectCls}
          >
            <option value="JSON">JSON</option>
            <option value="FORM">Form Data</option>
          </select>
        </div>

        {/* Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">En-têtes</Label>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleAddHeader(webhook.id)}>
              <Plus className="w-3 h-3 mr-1" />Ajouter
            </Button>
          </div>
          {webhook.headers.map((header, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                value={header.key}
                onChange={(e) => handleUpdateHeader(webhook.id, index, { key: e.target.value })}
                placeholder="Clé"
                className="h-7 text-xs flex-1"
              />
              <Input
                value={header.value}
                onChange={(e) => handleUpdateHeader(webhook.id, index, { value: e.target.value })}
                placeholder="Valeur"
                className="h-7 text-xs flex-1"
              />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600"
                onClick={() => handleRemoveHeader(webhook.id, index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Label className="text-xs font-medium">Actif</Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={webhook.enabled}
              onChange={(e) => updateWebhook(webhook.id, { enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Test button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => handleTestWebhook(webhook)}
          disabled={testing === webhook.id}
        >
          <Play className="w-4 h-4 mr-1" />
          {testing === webhook.id ? 'Test en cours...' : 'Tester le webhook'}
        </Button>
      </div>
    )
  }

  // ─── Section mapping des champs (mode agrandi) ───────────────────────────────
  const renderFieldMappingsExpanded = (webhook: Webhook) => (
    <div className="space-y-3">
      {/* En-tête du tableau */}
      <div className="grid grid-cols-[1fr_32px_1fr_36px] gap-2 px-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clé JSON</span>
        <span />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Champ du formulaire</span>
        <span />
      </div>

      {webhook.fieldMappings.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          Aucun mapping — cliquez sur &quot;+ Ajouter&quot; pour commencer
        </p>
      )}

      {webhook.fieldMappings.map((mapping, index) => {
        const block = allMappableBlocks.find((b) => b.id === mapping.blockId)
        const hasKey = mapping.key.trim() !== ''

        return (
          <div key={index} className="grid grid-cols-[1fr_32px_1fr_36px] gap-2 items-center group">
            {/* Clé JSON */}
            <Input
              value={mapping.key}
              onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { key: e.target.value })}
              placeholder="nom_du_champ"
              className={`h-9 text-sm font-mono ${hasKey ? 'text-orange-600 border-orange-200 bg-orange-50/50' : ''}`}
            />

            {/* Flèche */}
            <div className="flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>

            {/* Sélecteur de bloc */}
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                {mapping.blockId === 'entry_date' ? <Calendar className="w-3.5 h-3.5" /> :
                 mapping.blockId === 'entry_id'   ? <Hash className="w-3.5 h-3.5" /> :
                 block ? getBlockTypeIcon(block.type) : <AlignLeft className="w-3.5 h-3.5 opacity-30" />}
              </div>
              <select
                value={mapping.blockId}
                onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { blockId: e.target.value })}
                className="w-full pl-8 pr-3 py-2 text-sm border rounded-md h-9 appearance-none bg-white"
              >
                <option value="">Choisir un champ…</option>
                <optgroup label="Métadonnées">
                  <option value="entry_id">ID de la réponse</option>
                  <option value="entry_date">Date de soumission</option>
                </optgroup>
                <optgroup label="Questions">
                  {questionBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.attributes.label || 'Sans titre'}
                      {(b.type === 'group' || b.type === 'repeater') && b.innerBlocks?.length
                        ? ` (${b.innerBlocks.length} champs)`
                        : ''}
                    </option>
                  ))}
                </optgroup>
                {allMappableBlocks.some((b) => {
                  const parent = questionBlocks.find(
                    (q) => (q.type === 'group' || q.type === 'repeater') && q.innerBlocks?.some((i) => i.id === b.id)
                  )
                  return !!parent
                }) && (
                  <optgroup label="Champs internes (groupes / répéteurs)">
                    {allMappableBlocks
                      .filter((b) =>
                        questionBlocks.some(
                          (q) => (q.type === 'group' || q.type === 'repeater') && q.innerBlocks?.some((i) => i.id === b.id)
                        )
                      )
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.attributes.label || 'Sans titre'}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              {/* Chevron décoratif */}
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Supprimer */}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemoveFieldMapping(webhook.id, index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )
      })}

      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed text-gray-500 hover:text-gray-700 mt-2"
        onClick={() => handleAddFieldMapping(webhook.id)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Ajouter un mapping
      </Button>
    </div>
  )

  // ─── Modal agrandi ────────────────────────────────────────────────────────────
  const maximizedWebhook = webhooks.find((w) => w.id === maximizedWebhookId)

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="mb-4">
          <h3 className="font-medium">Webhooks</h3>
          <p className="text-sm text-gray-500 mt-1">Envoyez les réponses vers des services externes</p>
        </div>

        {webhooks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <WebhookIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Aucun webhook</p>
            <p className="text-sm mt-1">Ajoutez un webhook pour envoyer les données</p>
          </div>
        )}

        {webhooks.map((webhook) => {
          const isExpanded = expandedWebhooks.includes(webhook.id)

          return (
            <div key={webhook.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-gray-50">
                <button
                  onClick={() => toggleExpanded(webhook.id)}
                  className="flex items-center space-x-2 flex-1 min-w-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                  <WebhookIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium truncate">{webhook.name}</span>
                  {!webhook.enabled && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded shrink-0">
                      Désactivé
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Bouton Agrandir */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                    title="Agrandir"
                    onClick={(e) => { e.stopPropagation(); setMaximizedWebhookId(webhook.id) }}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>

                  {/* Bouton Supprimer */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    onClick={() => removeWebhook(webhook.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Vue compacte */}
              {isExpanded && (
                <>
                  {renderWebhookForm(webhook, true)}

                  {/* Mapping compact */}
                  <div className="px-3 pb-3 space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mapping des champs</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-purple-600 hover:text-purple-700"
                          onClick={() => setMaximizedWebhookId(webhook.id)}
                        >
                          <Maximize2 className="w-3 h-3 mr-1" />
                          Agrandir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => handleAddFieldMapping(webhook.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>
                    {webhook.fieldMappings.map((mapping, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={mapping.key}
                          onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { key: e.target.value })}
                          placeholder="Clé JSON"
                          className={`h-7 text-xs flex-1 font-mono ${mapping.key ? 'text-orange-600' : ''}`}
                        />
                        <select
                          value={mapping.blockId}
                          onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { blockId: e.target.value })}
                          className="flex-1 px-2 py-1 text-xs border rounded h-7"
                        >
                          <option value="">Sélectionner...</option>
                          <option value="entry_id">ID de la réponse</option>
                          <option value="entry_date">Date de soumission</option>
                          {questionBlocks.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.attributes.label || 'Sans titre'}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-400"
                          onClick={() => handleRemoveFieldMapping(webhook.id, index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}

        <Button variant="outline" className="w-full" onClick={handleAddWebhook}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un webhook
        </Button>
      </div>

      {/* ─── Modal agrandi ──────────────────────────────────────────────────── */}
      {maximizedWebhook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMaximizedWebhookId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
            style={{ maxWidth: '900px', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête de la modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <WebhookIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{maximizedWebhook.name}</h2>
                  <p className="text-xs text-gray-400 truncate max-w-xs">
                    {maximizedWebhook.url || 'URL non définie'}
                  </p>
                </div>
                {!maximizedWebhook.enabled && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Désactivé
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                onClick={() => setMaximizedWebhookId(null)}
                title="Rétrécir"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Corps de la modal — deux colonnes */}
            <div className="flex flex-1 overflow-hidden">
              {/* Colonne gauche : configuration */}
              <div className="w-72 shrink-0 border-r overflow-y-auto p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Configuration
                </p>
                {renderWebhookForm(maximizedWebhook, false)}
              </div>

              {/* Colonne droite : mapping des champs */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Request Body Format
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 w-fit text-sm text-gray-700">
                      {maximizedWebhook.bodyFormat}
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {maximizedWebhook.fieldMappings.length} mapping{maximizedWebhook.fieldMappings.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Request Body
                </p>

                {renderFieldMappingsExpanded(maximizedWebhook)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
