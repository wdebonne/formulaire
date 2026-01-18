'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Download,
  Trash2,
  Search,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface Webhook {
  id: string
  name: string
  url: string
  enabled: boolean
}

interface WebhookResult {
  webhookId: string
  webhookName: string
  success: boolean
  status?: number
  statusText?: string
  duration?: number
  error?: string
  response?: string
}

interface FormBlock {
  id: string
  type: string
  attributes: {
    label?: string
    [key: string]: any
  }
  innerBlocks?: FormBlock[]
}

interface FormResponse {
  id: string
  formId: string
  data: Record<string, any>
  metadata: string | null
  createdAt: Date
}

interface ResponsesClientProps {
  form: {
    id: string
    title: string
    slug?: string
    blocks: FormBlock[]
    settings: any
    webhooks?: Webhook[]
  }
  responses: FormResponse[]
}

export function ResponsesClient({ form, responses: initialResponses }: ResponsesClientProps) {
  const [responses, setResponses] = useState(initialResponses)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null)
  const [webhookResults, setWebhookResults] = useState<WebhookResult[] | null>(null)
  const { toast } = useToast()

  const hasActiveWebhooks = form.webhooks?.some((w) => w.enabled) ?? false

  const itemsPerPage = 20
  const questionBlocks = form.blocks.filter(
    (b) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  // Filtrer les réponses
  const filteredResponses = responses.filter((response) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return Object.values(response.data).some((value) =>
      String(value).toLowerCase().includes(searchLower)
    )
  })

  // Pagination
  const totalPages = Math.ceil(filteredResponses.length / itemsPerPage)
  const paginatedResponses = filteredResponses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette réponse ?')) return

    try {
      const res = await fetch(`/api/forms/${form.id}/responses/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error()

      setResponses(responses.filter((r) => r.id !== id))
      toast({ title: 'Réponse supprimée' })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la réponse',
        variant: 'destructive',
      })
    }
  }

  const handleExportCSV = () => {
    // Construire les headers, en développant les repeaters et groupes
    const headers: string[] = ['Date']
    questionBlocks.forEach((b) => {
      if (b.type === 'repeater' && b.innerBlocks && b.innerBlocks.length > 0) {
        // Trouver le nombre max de répétitions pour ce repeater
        let maxRep = 0
        responses.forEach((r) => {
          let rep = 1
          while (r.data[`${b.id}_${rep}_${b.innerBlocks![0].id}`] !== undefined) {
            rep++
          }
          maxRep = Math.max(maxRep, rep - 1)
        })
        
        // Ajouter les headers pour chaque répétition
        for (let i = 1; i <= maxRep; i++) {
          b.innerBlocks.forEach((inner) => {
            headers.push(`${b.attributes.label || b.id} #${i} - ${inner.attributes.label || inner.id}`)
          })
        }
        
        // Si aucune répétition, ajouter au moins une colonne
        if (maxRep === 0) {
          headers.push(b.attributes.label || b.id)
        }
      } else if (b.type === 'group' && b.innerBlocks && b.innerBlocks.length > 0) {
        // Pour les groupes, ajouter une colonne par bloc interne
        b.innerBlocks.forEach((inner) => {
          headers.push(`${b.attributes.label || b.id} - ${inner.attributes.label || inner.id}`)
        })
      } else {
        headers.push(b.attributes.label || b.id)
      }
    })
    
    const rows = responses.map((r) => {
      const row: string[] = [format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })]
      
      questionBlocks.forEach((b) => {
        if (b.type === 'repeater' && b.innerBlocks && b.innerBlocks.length > 0) {
          // Trouver le nombre max de répétitions pour ce repeater
          let maxRep = 0
          responses.forEach((resp) => {
            let rep = 1
            while (resp.data[`${b.id}_${rep}_${b.innerBlocks![0].id}`] !== undefined) {
              rep++
            }
            maxRep = Math.max(maxRep, rep - 1)
          })
          
          // Ajouter les valeurs pour chaque répétition
          for (let i = 1; i <= maxRep; i++) {
            b.innerBlocks.forEach((inner) => {
              const value = r.data[`${b.id}_${i}_${inner.id}`]
              if (Array.isArray(value)) {
                row.push(value.join(', '))
              } else if (typeof value === 'object') {
                row.push(JSON.stringify(value))
              } else {
                row.push(String(value || ''))
              }
            })
          }
          
          // Si aucune répétition, ajouter une cellule vide
          if (maxRep === 0) {
            row.push('')
          }
        } else if (b.type === 'group' && b.innerBlocks && b.innerBlocks.length > 0) {
          // Pour les groupes, ajouter une valeur par bloc interne
          b.innerBlocks.forEach((inner) => {
            const value = r.data[inner.id]
            if (Array.isArray(value)) {
              row.push(value.join(', '))
            } else if (typeof value === 'object') {
              row.push(JSON.stringify(value))
            } else {
              row.push(String(value || ''))
            }
          })
        } else {
          const value = r.data[b.id]
          if (Array.isArray(value)) {
            row.push(value.join(', '))
          } else if (typeof value === 'object') {
            row.push(JSON.stringify(value))
          } else {
            row.push(String(value || ''))
          }
        }
      })
      
      return row
    })

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.title || 'formulaire'}-reponses.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({ title: 'Export CSV téléchargé' })
  }

  const handleDeleteAll = async () => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer toutes les ${responses.length} réponses ? Cette action est irréversible.`
      )
    )
      return

    try {
      const res = await fetch(`/api/forms/${form.id}/responses`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error()

      setResponses([])
      toast({ title: 'Toutes les réponses ont été supprimées' })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer les réponses',
        variant: 'destructive',
      })
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // Fonction pour obtenir la valeur d'un bloc (gère les groupes et repeaters)
  const getBlockValue = (block: FormBlock, data: Record<string, any>): string => {
    // Pour les groupes, afficher un résumé des réponses internes
    if (block.type === 'group' && block.innerBlocks && block.innerBlocks.length > 0) {
      const values = block.innerBlocks
        .map((inner) => data[inner.id])
        .filter((v) => v !== undefined && v !== null && v !== '')
      if (values.length === 0) return '-'
      return values.map((v) => formatValue(v)).join(' | ')
    }

    // Pour les repeaters, afficher le nombre d'entrées
    if (block.type === 'repeater' && block.innerBlocks && block.innerBlocks.length > 0) {
      let count = 0
      let repIndex = 1
      while (data[`${block.id}_${repIndex}_${block.innerBlocks[0].id}`] !== undefined) {
        count++
        repIndex++
      }
      if (count === 0) return '-'
      return `${count} entrée${count > 1 ? 's' : ''}`
    }

    return formatValue(data[block.id])
  }

  // Fonction pour récupérer les données d'un repeater
  const getRepeaterData = (repeaterId: string, innerBlocks: FormBlock[], data: Record<string, any>) => {
    const repetitions: Array<{ index: number; answers: Array<{ block: FormBlock; value: any }> }> = []
    
    // Trouver toutes les répétitions
    let repIndex = 1
    while (true) {
      const repAnswers: Array<{ block: FormBlock; value: any }> = []
      let hasData = false
      
      for (const innerBlock of innerBlocks) {
        const key = `${repeaterId}_${repIndex}_${innerBlock.id}`
        if (data[key] !== undefined) {
          hasData = true
          repAnswers.push({ block: innerBlock, value: data[key] })
        }
      }
      
      if (!hasData) break
      
      repetitions.push({ index: repIndex, answers: repAnswers })
      repIndex++
    }
    
    return repetitions
  }

  // Fonction pour afficher un bloc (y compris les repeaters et groupes)
  const renderBlockResponse = (block: FormBlock, data: Record<string, any>) => {
    if (block.type === 'repeater' && block.innerBlocks && block.innerBlocks.length > 0) {
      const repetitions = getRepeaterData(block.id, block.innerBlocks, data)
      
      if (repetitions.length === 0) {
        return (
          <div key={block.id} className="border-b pb-4 last:border-0">
            <p className="text-sm font-medium text-gray-500 mb-1">
              {block.attributes.label || block.id}
            </p>
            <p className="text-gray-900">-</p>
          </div>
        )
      }
      
      return (
        <div key={block.id} className="border-b pb-4 last:border-0">
          <p className="text-sm font-medium text-gray-500 mb-2">
            {block.attributes.label || block.id}
          </p>
          <div className="space-y-3">
            {repetitions.map((rep) => (
              <div key={rep.index} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-400 mb-2">
                  Entrée #{rep.index}
                </p>
                <div className="space-y-2">
                  {rep.answers.map(({ block: innerBlock, value }) => (
                    <div key={innerBlock.id}>
                      <p className="text-xs text-gray-500">
                        {innerBlock.attributes.label || innerBlock.id}
                      </p>
                      <p className="text-sm text-gray-900">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Pour les blocs de type groupe
    if (block.type === 'group' && block.innerBlocks && block.innerBlocks.length > 0) {
      const groupAnswers = block.innerBlocks.map((innerBlock) => ({
        block: innerBlock,
        value: data[innerBlock.id]
      })).filter(({ value }) => value !== undefined)

      if (groupAnswers.length === 0) {
        return (
          <div key={block.id} className="border-b pb-4 last:border-0">
            <p className="text-sm font-medium text-gray-500 mb-1">
              {block.attributes.label || block.id}
            </p>
            <p className="text-gray-900">-</p>
          </div>
        )
      }

      return (
        <div key={block.id} className="border-b pb-4 last:border-0">
          <p className="text-sm font-medium text-gray-500 mb-2">
            {block.attributes.label || block.id}
          </p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            {groupAnswers.map(({ block: innerBlock, value }) => (
              <div key={innerBlock.id}>
                <p className="text-xs text-gray-500">
                  {innerBlock.attributes.label || innerBlock.id}
                </p>
                <p className="text-sm text-gray-900">{formatValue(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
    
    // Pour les blocs normaux
    return (
      <div key={block.id} className="border-b pb-4 last:border-0">
        <p className="text-sm font-medium text-gray-500 mb-1">
          {block.attributes.label || block.id}
        </p>
        <p className="text-gray-900">{formatValue(data[block.id])}</p>
      </div>
    )
  }

  const handleSendWebhook = async (responseId: string) => {
    setSendingWebhook(responseId)
    setWebhookResults(null)

    try {
      const res = await fetch(`/api/forms/${form.id}/responses/${responseId}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }

      setWebhookResults(data.results)

      if (data.success) {
        toast({
          title: 'Webhook envoyé',
          description: 'Les webhooks ont été renvoyés avec succès',
        })
      } else {
        toast({
          title: 'Envoi partiel',
          description: 'Certains webhooks ont échoué',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'envoyer le webhook',
        variant: 'destructive',
      })
    } finally {
      setSendingWebhook(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{form.title || 'Sans titre'}</h1>
                <p className="text-sm text-gray-500">
                  {responses.length} réponse{responses.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
              {responses.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tout supprimer
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {responses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">Aucune réponse</h2>
            <p className="text-gray-500 mb-6">
              Ce formulaire n'a pas encore reçu de réponses.
            </p>
            <Link href={`/${form.slug || form.id}`} target="_blank">
              <Button>Voir le formulaire</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher dans les réponses..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      {questionBlocks.slice(0, 4).map((block) => (
                        <th
                          key={block.id}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[200px] truncate"
                        >
                          {block.attributes.label || block.id}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedResponses.map((response) => (
                      <tr key={response.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(response.createdAt), 'dd/MM/yyyy HH:mm', {
                            locale: fr,
                          })}
                        </td>
                        {questionBlocks.slice(0, 4).map((block) => (
                          <td
                            key={block.id}
                            className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate"
                          >
                            {getBlockValue(block, response.data)}
                          </td>
                        ))}
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setSelectedResponse(response)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasActiveWebhooks && (
                              <button
                                onClick={() => handleSendWebhook(response.id)}
                                disabled={sendingWebhook === response.id}
                                className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                                title="Renvoyer le webhook"
                              >
                                {sendingWebhook === response.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(response.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {(currentPage - 1) * itemsPerPage + 1} -{' '}
                    {Math.min(currentPage * itemsPerPage, filteredResponses.length)} sur{' '}
                    {filteredResponses.length}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Response detail modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Détail de la réponse</h2>
                <p className="text-sm text-gray-500">
                  {format(new Date(selectedResponse.createdAt), "dd MMMM yyyy 'à' HH:mm", {
                    locale: fr,
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-4">
                {questionBlocks.map((block) => renderBlockResponse(block, selectedResponse.data))}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                Fermer
              </Button>
              {hasActiveWebhooks && (
                <Button
                  variant="outline"
                  onClick={() => handleSendWebhook(selectedResponse.id)}
                  disabled={sendingWebhook === selectedResponse.id}
                >
                  {sendingWebhook === selectedResponse.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Renvoyer webhook
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete(selectedResponse.id)
                  setSelectedResponse(null)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook results modal */}
      {webhookResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Résultats des webhooks</h2>
              <button
                onClick={() => setWebhookResults(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="space-y-3">
                {webhookResults.map((result) => (
                  <div
                    key={result.webhookId}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-medium">{result.webhookName}</span>
                      </div>
                      {result.status && (
                        <span
                          className={`text-sm px-2 py-0.5 rounded ${
                            result.success
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {result.status} {result.statusText}
                        </span>
                      )}
                    </div>
                    {result.duration && (
                      <p className="text-sm text-gray-600">
                        Temps de réponse: {result.duration}ms
                      </p>
                    )}
                    {result.error && (
                      <p className="text-sm text-red-600 mt-1">{result.error}</p>
                    )}
                    {result.response && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                          Voir la réponse
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto max-h-32">
                          {result.response}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <Button onClick={() => setWebhookResults(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
