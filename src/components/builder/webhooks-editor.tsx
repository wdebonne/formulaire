'use client'

import { useState } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormBlock, Webhook, WebhookFieldMapping, WebhookHeader } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, ChevronDown, ChevronRight, Webhook as WebhookIcon, Play, Settings } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WebhooksEditorProps {
  blocks: FormBlock[]
}

export function WebhooksEditor({ blocks }: WebhooksEditorProps) {
  const { webhooks, addWebhook, updateWebhook, removeWebhook } = useFormBuilder()
  const [expandedWebhooks, setExpandedWebhooks] = useState<string[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const { toast } = useToast()

  const questionBlocks = blocks.filter(
    (b) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

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

    updateWebhook(webhookId, {
      headers: [...webhook.headers, { key: '', value: '' }],
    })
  }

  const handleUpdateHeader = (
    webhookId: string,
    headerIndex: number,
    updates: Partial<WebhookHeader>
  ) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    const newHeaders = [...webhook.headers]
    newHeaders[headerIndex] = { ...newHeaders[headerIndex], ...updates }
    updateWebhook(webhookId, { headers: newHeaders })
  }

  const handleRemoveHeader = (webhookId: string, headerIndex: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    updateWebhook(webhookId, {
      headers: webhook.headers.filter((_, i) => i !== headerIndex),
    })
  }

  const handleAddFieldMapping = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    updateWebhook(webhookId, {
      fieldMappings: [...webhook.fieldMappings, { key: '', blockId: '' }],
    })
  }

  const handleUpdateFieldMapping = (
    webhookId: string,
    mappingIndex: number,
    updates: Partial<WebhookFieldMapping>
  ) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    const newMappings = [...webhook.fieldMappings]
    newMappings[mappingIndex] = { ...newMappings[mappingIndex], ...updates }
    updateWebhook(webhookId, { fieldMappings: newMappings })
  }

  const handleRemoveFieldMapping = (webhookId: string, mappingIndex: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return

    updateWebhook(webhookId, {
      fieldMappings: webhook.fieldMappings.filter((_, i) => i !== mappingIndex),
    })
  }

  const handleTestWebhook = async (webhook: Webhook) => {
    if (!webhook.url) {
      toast({
        title: 'Erreur',
        description: 'Veuillez saisir une URL',
        variant: 'destructive',
      })
      return
    }

    setTesting(webhook.id)

    try {
      // Create test data
      const testData: Record<string, any> = {
        _test: true,
        _timestamp: new Date().toISOString(),
      }

      webhook.fieldMappings.forEach((mapping) => {
        if (mapping.key) {
          if (mapping.blockId === 'entry_date') {
            testData[mapping.key] = new Date().toISOString()
          } else if (mapping.blockId === 'entry_id') {
            testData[mapping.key] = 'test-entry-id'
          } else {
            const block = blocks.find((b) => b.id === mapping.blockId)
            testData[mapping.key] = `Test value for ${block?.attributes.label || 'field'}`
          }
        }
      })

      const headers: Record<string, string> = {}
      webhook.headers.forEach((h) => {
        if (h.key) headers[h.key] = h.value
      })

      if (webhook.bodyFormat === 'JSON') {
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhook.url,
          method: webhook.method,
          headers,
          data: testData,
          bodyFormat: webhook.bodyFormat,
        }),
      })

      const result = await res.json()

      if (result.success) {
        toast({
          title: 'Test réussi',
          description: `Réponse: ${result.status}`,
        })
      } else {
        throw new Error(result.error || 'Erreur lors du test')
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setTesting(null)
    }
  }

  const getBlockLabel = (blockId: string) => {
    if (blockId === 'entry_date') return 'Date de soumission'
    if (blockId === 'entry_id') return 'ID de la réponse'
    const block = blocks.find((b) => b.id === blockId)
    return block?.attributes.label || 'Sans titre'
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h3 className="font-medium">Webhooks</h3>
        <p className="text-sm text-gray-500 mt-1">
          Envoyez les réponses vers des services externes
        </p>
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
                className="flex items-center space-x-2 flex-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <WebhookIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">{webhook.name}</span>
                {!webhook.enabled && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                    Désactivé
                  </span>
                )}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-red-500 hover:text-red-600"
                onClick={() => removeWebhook(webhook.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {isExpanded && (
              <div className="p-3 space-y-4 border-t">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={webhook.name}
                    onChange={(e) => updateWebhook(webhook.id, { name: e.target.value })}
                    placeholder="Nom du webhook"
                    className="h-8 text-sm"
                  />
                </div>

                {/* URL */}
                <div className="space-y-2">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={webhook.url}
                    onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })}
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>

                {/* Method */}
                <div className="space-y-2">
                  <Label className="text-xs">Méthode</Label>
                  <select
                    value={webhook.method}
                    onChange={(e) =>
                      updateWebhook(webhook.id, { method: e.target.value as Webhook['method'] })
                    }
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="GET">GET</option>
                  </select>
                </div>

                {/* Trigger */}
                <div className="space-y-2">
                  <Label className="text-xs">Déclencher</Label>
                  <select
                    value={webhook.triggerOn}
                    onChange={(e) =>
                      updateWebhook(webhook.id, { triggerOn: e.target.value as Webhook['triggerOn'] })
                    }
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="submission">À la soumission</option>
                    <option value="partial">Soumission partielle</option>
                    <option value="save">À l'enregistrement</option>
                  </select>
                </div>

                {/* Body format */}
                <div className="space-y-2">
                  <Label className="text-xs">Format du corps</Label>
                  <select
                    value={webhook.bodyFormat}
                    onChange={(e) =>
                      updateWebhook(webhook.id, { bodyFormat: e.target.value as Webhook['bodyFormat'] })
                    }
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="JSON">JSON</option>
                    <option value="FORM">Form Data</option>
                  </select>
                </div>

                {/* Headers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">En-têtes</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleAddHeader(webhook.id)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  {webhook.headers.map((header, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={header.key}
                        onChange={(e) =>
                          handleUpdateHeader(webhook.id, index, { key: e.target.value })
                        }
                        placeholder="Clé"
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={header.value}
                        onChange={(e) =>
                          handleUpdateHeader(webhook.id, index, { value: e.target.value })
                        }
                        placeholder="Valeur"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleRemoveHeader(webhook.id, index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Field mappings */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mapping des champs</Label>
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
                  {webhook.fieldMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={mapping.key}
                        onChange={(e) =>
                          handleUpdateFieldMapping(webhook.id, index, { key: e.target.value })
                        }
                        placeholder="Clé JSON"
                        className="h-7 text-xs flex-1"
                      />
                      <select
                        value={mapping.blockId}
                        onChange={(e) =>
                          handleUpdateFieldMapping(webhook.id, index, { blockId: e.target.value })
                        }
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
                        className="h-7 px-2"
                        onClick={() => handleRemoveFieldMapping(webhook.id, index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Label className="text-xs">Actif</Label>
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
            )}
          </div>
        )
      })}

      <Button variant="outline" className="w-full" onClick={handleAddWebhook}>
        <Plus className="w-4 h-4 mr-2" />
        Ajouter un webhook
      </Button>
    </div>
  )
}
