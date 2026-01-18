'use client'

import { useState, useRef, useEffect } from 'react'
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
  Settings2,
  GripVertical,
  Check,
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
  webhookStatus?: Record<string, { success: boolean; lastSent: string; error?: string }>
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
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const hasActiveWebhooks = form.webhooks?.some((w) => w.enabled) ?? false
  const activeWebhookIds = form.webhooks?.filter((w) => w.enabled).map((w) => w.id) ?? []

  // Liste des blocs de questions
  const questionBlocks = form.blocks.filter(
    (b) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  // État pour les colonnes visibles (par défaut les 4 premières + date)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const defaultColumns = ['date', ...questionBlocks.slice(0, 4).map(b => b.id)]
    return defaultColumns
  })

  // Fermer le sélecteur de colonnes si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fonction pour basculer la visibilité d'une colonne
  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnId)) {
        // Ne pas permettre de désélectionner toutes les colonnes
        if (prev.length <= 1) return prev
        return prev.filter(id => id !== columnId)
      } else {
        return [...prev, columnId]
      }
    })
  }

  // Sélectionner/désélectionner toutes les colonnes
  const toggleAllColumns = () => {
    if (visibleColumns.length === questionBlocks.length + 1) {
      // Garder seulement la date et les 4 premières colonnes
      setVisibleColumns(['date', ...questionBlocks.slice(0, 4).map(b => b.id)])
    } else {
      // Tout sélectionner
      setVisibleColumns(['date', ...questionBlocks.map(b => b.id)])
    }
  }

  // Colonnes de questions visibles
  const visibleQuestionBlocks = questionBlocks.filter(b => visibleColumns.includes(b.id))

  // Fonction pour déterminer le statut global des webhooks pour une réponse
  const getWebhookStatusForResponse = (response: FormResponse): 'success' | 'error' | 'partial' | 'none' => {
    if (!hasActiveWebhooks || !response.webhookStatus) return 'none'
    
    const statuses = activeWebhookIds
      .map((id) => response.webhookStatus?.[id])
      .filter(Boolean)
    
    if (statuses.length === 0) return 'none'
    
    const allSuccess = statuses.every((s) => s?.success)
    const allFailed = statuses.every((s) => !s?.success)
    
    if (allSuccess) return 'success'
    if (allFailed) return 'error'
    return 'partial'
  }

  const itemsPerPage = 20

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

      // Mettre à jour le statut webhook dans le state local
      const updatedStatus: Record<string, { success: boolean; lastSent: string; error?: string }> = {}
      for (const result of data.results) {
        updatedStatus[result.webhookId] = {
          success: result.success,
          lastSent: new Date().toISOString(),
          ...(result.error && { error: result.error }),
        }
      }
      
      setResponses((prev) =>
        prev.map((r) =>
          r.id === responseId
            ? { ...r, webhookStatus: { ...r.webhookStatus, ...updatedStatus } }
            : r
        )
      )

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="hover:bg-purple-50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">{form.title || 'Sans titre'}</h1>
                <p className="text-sm text-gray-500">
                  {responses.length} réponse{responses.length > 1 ? 's' : ''} collectée{responses.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="hover:bg-green-50 hover:border-green-300 hover:text-green-700">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
              {responses.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDeleteAll} className="hover:bg-red-50 hover:border-red-300 hover:text-red-700">
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Aucune réponse pour le moment</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Ce formulaire n'a pas encore reçu de réponses. Partagez-le pour commencer à collecter des données.
            </p>
            <Link href={`/${form.slug || form.id}`} target="_blank">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25">
                Voir le formulaire
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total réponses</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{responses.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Dernière réponse</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {responses.length > 0 
                        ? format(new Date(responses[0].createdAt), 'dd MMM yyyy', { locale: fr })
                        : '-'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Questions</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{questionBlocks.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                    <Eye className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Column Selector */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher dans les réponses..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                />
              </div>
              
              {/* Column Selector */}
              <div className="relative" ref={columnSelectorRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Colonnes ({visibleColumns.length - 1}/{questionBlocks.length})
                </Button>
                
                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-gray-700">Colonnes visibles</span>
                        <button
                          onClick={toggleAllColumns}
                          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                        >
                          {visibleColumns.length === questionBlocks.length + 1 ? 'Réinitialiser' : 'Tout afficher'}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {/* Date column (always visible) */}
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                        <div className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-200 flex items-center justify-center">
                          <Check className="w-3 h-3 text-gray-500" />
                        </div>
                        <span className="text-sm text-gray-500">Date (toujours visible)</span>
                      </div>
                      
                      {/* Question columns */}
                      {questionBlocks.map((block) => (
                        <button
                          key={block.id}
                          onClick={() => toggleColumn(block.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors text-left"
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            visibleColumns.includes(block.id)
                              ? 'bg-purple-600 border-purple-600'
                              : 'border-gray-300 hover:border-purple-400'
                          }`}>
                            {visibleColumns.includes(block.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {block.attributes.label || block.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      {visibleColumns.includes('date') && (
                        <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Date
                        </th>
                      )}
                      {visibleQuestionBlocks.map((block) => (
                        <th
                          key={block.id}
                          className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider max-w-[200px] truncate"
                        >
                          {block.attributes.label || block.id}
                        </th>
                      ))}
                      <th className="px-5 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {paginatedResponses.map((response, idx) => (
                      <tr key={response.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        {visibleColumns.includes('date') && (
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {format(new Date(response.createdAt), 'dd MMM yyyy', { locale: fr })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(new Date(response.createdAt), 'HH:mm', { locale: fr })}
                            </div>
                          </td>
                        )}
                        {visibleQuestionBlocks.map((block) => (
                          <td
                            key={block.id}
                            className="px-5 py-4 text-sm text-gray-700 max-w-[200px] truncate"
                          >
                            {getBlockValue(block, response.data)}
                          </td>
                        ))}
                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => setSelectedResponse(response)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasActiveWebhooks && (
                              <button
                                onClick={() => handleSendWebhook(response.id)}
                                disabled={sendingWebhook === response.id}
                                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                  (() => {
                                    const status = getWebhookStatusForResponse(response)
                                    switch (status) {
                                      case 'success':
                                        return 'text-green-500 hover:text-green-600 hover:bg-green-50'
                                      case 'error':
                                        return 'text-red-500 hover:text-red-600 hover:bg-red-50'
                                      case 'partial':
                                        return 'text-orange-500 hover:text-orange-600 hover:bg-orange-50'
                                      default:
                                        return 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                    }
                                  })()
                                }`}
                                title={(() => {
                                  const status = getWebhookStatusForResponse(response)
                                  switch (status) {
                                    case 'success':
                                      return 'Webhook envoyé avec succès - Cliquer pour renvoyer'
                                    case 'error':
                                      return 'Webhook échoué - Cliquer pour réessayer'
                                    case 'partial':
                                      return 'Certains webhooks ont échoué - Cliquer pour renvoyer'
                                    default:
                                      return 'Renvoyer le webhook'
                                  }
                                })()}
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
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <p className="text-sm text-gray-600">
                    Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredResponses.length)}</span> sur{' '}
                    <span className="font-medium">{filteredResponses.length}</span> réponses
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="hover:bg-blue-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-blue-50 text-gray-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="hover:bg-blue-50"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg text-gray-900">Détail de la réponse</h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {format(new Date(selectedResponse.createdAt), "EEEE dd MMMM yyyy 'à' HH:mm", {
                    locale: fr,
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedResponse(null)}
                className="p-2 hover:bg-white/80 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(85vh-180px)]">
              <div className="space-y-4">
                {questionBlocks.map((block) => renderBlockResponse(block, selectedResponse.data))}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                Fermer
              </Button>
              {hasActiveWebhooks && (
                <Button
                  variant="outline"
                  onClick={() => handleSendWebhook(selectedResponse.id)}
                  disabled={sendingWebhook === selectedResponse.id}
                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
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
                className="bg-red-600 hover:bg-red-700"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-900">Résultats des webhooks</h2>
              <button
                onClick={() => setWebhookResults(null)}
                className="p-2 hover:bg-white/80 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-140px)]">
              <div className="space-y-3">
                {webhookResults.map((result) => (
                  <div
                    key={result.webhookId}
                    className={`p-4 rounded-xl border-2 ${
                      result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-600" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{result.webhookName}</span>
                      </div>
                      {result.status && (
                        <span
                          className={`text-sm px-2.5 py-1 rounded-lg font-medium ${
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
                      <p className="text-sm text-gray-600 ml-10">
                        Temps de réponse: <span className="font-medium">{result.duration}ms</span>
                      </p>
                    )}
                    {result.error && (
                      <p className="text-sm text-red-600 mt-2 ml-10 font-medium">{result.error}</p>
                    )}
                    {result.response && (
                      <details className="mt-3 ml-10">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                          Voir la réponse du serveur
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-32 font-mono">
                          {result.response}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <Button onClick={() => setWebhookResults(null)} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
