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
} from 'lucide-react'

interface FormBlock {
  id: string
  type: string
  attributes: {
    label?: string
    [key: string]: any
  }
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
    blocks: FormBlock[]
    settings: any
  }
  responses: FormResponse[]
}

export function ResponsesClient({ form, responses: initialResponses }: ResponsesClientProps) {
  const [responses, setResponses] = useState(initialResponses)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const { toast } = useToast()

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
    const headers = ['Date', ...questionBlocks.map((b) => b.attributes.label || b.id)]
    const rows = responses.map((r) => [
      format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr }),
      ...questionBlocks.map((b) => {
        const value = r.data[b.id]
        if (Array.isArray(value)) return value.join(', ')
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value || '')
      }),
    ])

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
            <Link href={`/f/${form.id}`} target="_blank">
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
                            {formatValue(response.data[block.id])}
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
                {questionBlocks.map((block) => (
                  <div key={block.id} className="border-b pb-4 last:border-0">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      {block.attributes.label || block.id}
                    </p>
                    <p className="text-gray-900">
                      {formatValue(selectedResponse.data[block.id])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                Fermer
              </Button>
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
    </div>
  )
}
