'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Database,
  Loader2,
  Download,
  Upload,
  CheckCircle,
  XCircle,
  HardDrive,
  Users,
  FileText,
  MessageSquare,
  Palette,
} from 'lucide-react'

interface DatabaseInfo {
  type: string
  stats: {
    users: number
    forms: number
    responses: number
    themes: number
  }
  fileSize: number | null
  databaseUrl: string
}

export function DatabaseSettingsClient() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null)

  const fetchDatabaseInfo = async () => {
    try {
      const res = await fetch('/api/admin/database')
      if (res.ok) {
        const data = await res.json()
        setDbInfo(data)
      }
    } catch (error) {
      console.error('Error fetching database info:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatabaseInfo()
  }, [])

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus('idle')
    try {
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-connection' }),
      })

      const data = await res.json()

      if (data.success) {
        setConnectionStatus('success')
        toast({
          title: 'Connexion réussie',
          description: 'La connexion à la base de données est fonctionnelle',
        })
      } else {
        setConnectionStatus('error')
        toast({
          title: 'Échec de connexion',
          description: data.error || 'Impossible de se connecter à la base de données',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      setConnectionStatus('error')
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' }),
      })

      const data = await res.json()

      if (res.ok) {
        // Télécharger le fichier
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `formbuilder-backup-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast({
          title: 'Export réussi',
          description: 'La sauvegarde a été téléchargée',
        })
      } else {
        throw new Error(data.error || 'Erreur lors de l\'export')
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('Attention : L\'import va fusionner les données avec la base existante. Voulez-vous continuer ?')) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setImporting(true)
    try {
      const content = await file.text()
      const backup = JSON.parse(content)

      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: 'Import réussi',
          description: 'Les données ont été importées avec succès',
        })
        fetchDatabaseInfo()
      } else {
        throw new Error(data.error || 'Erreur lors de l\'import')
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-orange-600" />
              <h1 className="text-xl font-semibold">Base de données</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations sur la base de données</CardTitle>
            <CardDescription>
              État actuel de la base de données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{dbInfo?.stats.users || 0}</p>
                  <p className="text-sm text-gray-600">Utilisateurs</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                <FileText className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{dbInfo?.stats.forms || 0}</p>
                  <p className="text-sm text-gray-600">Formulaires</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                <MessageSquare className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{dbInfo?.stats.responses || 0}</p>
                  <p className="text-sm text-gray-600">Réponses</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg">
                <Palette className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{dbInfo?.stats.themes || 0}</p>
                  <p className="text-sm text-gray-600">Thèmes</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">
                    {dbInfo?.type === 'sqlite' ? 'SQLite (fichier local)' : 'Base de données externe'}
                  </p>
                  {dbInfo?.fileSize && (
                    <p className="text-sm text-gray-500">
                      Taille : {formatBytes(dbInfo.fileSize)}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : connectionStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                ) : connectionStatus === 'error' ? (
                  <XCircle className="w-4 h-4 mr-2 text-red-600" />
                ) : null}
                Tester la connexion
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle>Sauvegarde et restauration</CardTitle>
            <CardDescription>
              Exportez ou importez les données de la base
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Exporter les données</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Téléchargez une sauvegarde complète de la base de données au format JSON.
                </p>
                <Button onClick={handleExport} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Exporter
                </Button>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Importer des données</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Importez des données depuis un fichier de sauvegarde JSON.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note :</strong> Pour modifier la connexion à une base de données externe, 
            vous devez modifier la variable d'environnement <code className="bg-yellow-100 px-1 rounded">DATABASE_URL</code> dans 
            votre fichier <code className="bg-yellow-100 px-1 rounded">.env</code> et redémarrer l'application.
          </p>
        </div>
      </main>
    </div>
  )
}
