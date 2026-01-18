'use client'

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Link,
  Code,
  Code2,
  QrCode,
  Copy,
  Check,
  Download,
  Users,
  Trash2,
  Loader2,
} from 'lucide-react'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formSlug: string
  formId: string
}

interface FormShare {
  id: string
  permission: string
  user: {
    id: string
    email: string
    name: string | null
  }
}

type ShareTab = 'link' | 'users' | 'shortcode' | 'embed' | 'qrcode'

const PERMISSIONS = [
  { value: 'view', label: 'Lecture', description: 'Peut voir les réponses' },
  { value: 'edit', label: 'Édition', description: 'Peut modifier le formulaire' },
  { value: 'admin', label: 'Administrateur', description: 'Peut tout faire, y compris gérer les partages' },
]

export function ShareDialog({ open, onOpenChange, formSlug, formId }: ShareDialogProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<ShareTab>('link')
  const [copied, setCopied] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  // User sharing
  const [shares, setShares] = useState<FormShare[]>([])
  const [loadingShares, setLoadingShares] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState('view')
  const [addingShare, setAddingShare] = useState(false)

  // Shortcode settings
  const [width, setWidth] = useState('100')
  const [widthUnit, setWidthUnit] = useState('%')
  const [minHeight, setMinHeight] = useState('500')
  const [minHeightUnit, setMinHeightUnit] = useState('px')
  const [maxHeight, setMaxHeight] = useState('0')
  const [maxHeightUnit, setMaxHeightUnit] = useState('auto')

  // Embed settings
  const [embedWidth, setEmbedWidth] = useState('100%')
  const [embedHeight, setEmbedHeight] = useState('600')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  // Fetch shares when opening users tab
  useEffect(() => {
    if (activeTab === 'users' && open) {
      fetchShares()
    }
  }, [activeTab, open])

  const fetchShares = async () => {
    setLoadingShares(true)
    try {
      const res = await fetch(`/api/forms/${formId}/share`)
      if (res.ok) {
        const data = await res.json()
        setShares(data)
      }
    } catch (error) {
      console.error('Error fetching shares:', error)
    } finally {
      setLoadingShares(false)
    }
  }

  const handleAddShare = async () => {
    if (!shareEmail) return

    setAddingShare(true)
    try {
      const res = await fetch(`/api/forms/${formId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: shareEmail, permission: sharePermission }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du partage')
      }

      toast({
        title: 'Formulaire partagé',
        description: `Le formulaire a été partagé avec ${shareEmail}`,
      })

      setShareEmail('')
      fetchShares()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setAddingShare(false)
    }
  }

  const handleRemoveShare = async (shareId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/share?shareId=${shareId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la suppression')
      }

      toast({
        title: 'Partage supprimé',
        description: 'L\'accès a été révoqué',
      })

      fetchShares()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleUpdatePermission = async (shareId: string, newPermission: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/share`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, permission: newPermission }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la mise à jour')
      }

      toast({
        title: 'Permission mise à jour',
        description: 'Les droits ont été modifiés',
      })

      fetchShares()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const formUrl = `${baseUrl}/${formSlug}`

  const shortcode = `[formulaire id="${formId}" width="${width}${widthUnit}" min_height="${minHeight}${minHeightUnit}"${maxHeightUnit !== 'auto' ? ` max_height="${maxHeight}${maxHeightUnit}"` : ''}]`

  const embedCode = `<iframe src="${formUrl}" width="${embedWidth}" height="${embedHeight}" style="border:0;"></iframe>`

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: 'Copié !',
        description: 'Le contenu a été copié dans le presse-papier',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de copier',
        variant: 'destructive',
      })
    }
  }

  // Generate QR Code
  useEffect(() => {
    if (activeTab === 'qrcode' && qrCanvasRef.current && formUrl) {
      QRCode.toCanvas(qrCanvasRef.current, formUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
    }
  }, [activeTab, formUrl])

  const downloadQRCode = () => {
    if (qrCanvasRef.current) {
      const link = document.createElement('a')
      link.download = `qrcode-${formSlug}.png`
      link.href = qrCanvasRef.current.toDataURL('image/png')
      link.click()
    }
  }

  const tabs = [
    { id: 'link' as ShareTab, label: 'Lien direct', icon: Link },
    { id: 'users' as ShareTab, label: 'Utilisateurs', icon: Users },
    { id: 'shortcode' as ShareTab, label: 'Shortcode', icon: Code },
    { id: 'embed' as ShareTab, label: 'Embed', icon: Code2 },
    { id: 'qrcode' as ShareTab, label: 'QR Code', icon: QrCode },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Partager le formulaire</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 mb-1 ${activeTab === tab.id ? 'text-primary' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium ${activeTab === tab.id ? 'text-primary' : 'text-gray-700'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'link' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Copiez le lien du formulaire et partagez-le avec votre audience.
              </p>
              <div className="flex gap-2">
                <Input
                  value={formUrl}
                  readOnly
                  className="flex-1"
                />
                <Button onClick={() => copyToClipboard(formUrl)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-2">Copier</span>
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Partagez ce formulaire avec d'autres utilisateurs de la plateforme.
              </p>

              {/* Permissions info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-gray-700">Niveaux de droits :</p>
                {PERMISSIONS.map((perm) => (
                  <p key={perm.value} className="text-xs text-gray-500">
                    <span className="font-medium">{perm.label}</span> : {perm.description}
                  </p>
                ))}
              </div>

              {/* Add share form */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email de l'utilisateur"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  {PERMISSIONS.map((perm) => (
                    <option key={perm.value} value={perm.value}>{perm.label}</option>
                  ))}
                </select>
                <Button onClick={handleAddShare} disabled={addingShare || !shareEmail}>
                  {addingShare ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Partager'
                  )}
                </Button>
              </div>

              {/* List of shares */}
              <div className="border rounded-lg divide-y">
                {loadingShares ? (
                  <div className="p-4 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    <p className="text-sm mt-2">Chargement...</p>
                  </div>
                ) : shares.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    Ce formulaire n'est partagé avec aucun utilisateur.
                  </div>
                ) : (
                  shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium text-sm">{share.user.name || share.user.email}</p>
                        <p className="text-xs text-gray-500">{share.user.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={share.permission}
                          onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${
                            share.permission === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : share.permission === 'edit' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {PERMISSIONS.map((perm) => (
                            <option key={perm.value} value={perm.value}>{perm.label}</option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveShare(share.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'shortcode' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Personnalisez l'affichage du formulaire et copiez le shortcode.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Largeur</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={widthUnit}
                      onChange={(e) => setWidthUnit(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="%">%</option>
                      <option value="px">px</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Hauteur minimale</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={minHeight}
                      onChange={(e) => setMinHeight(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={minHeightUnit}
                      onChange={(e) => setMinHeightUnit(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="px">px</option>
                      <option value="vh">vh</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Hauteur maximale</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(e.target.value)}
                      className="flex-1"
                      disabled={maxHeightUnit === 'auto'}
                    />
                    <select
                      value={maxHeightUnit}
                      onChange={(e) => setMaxHeightUnit(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="auto">auto</option>
                      <option value="px">px</option>
                      <option value="vh">vh</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Shortcode généré</label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={shortcode}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button onClick={() => copyToClipboard(shortcode)}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="ml-2">Copier</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Copiez le code embed ci-dessous et insérez-le dans votre page externe.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Largeur</label>
                  <Input
                    value={embedWidth}
                    onChange={(e) => setEmbedWidth(e.target.value)}
                    placeholder="100% ou 600px"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hauteur</label>
                  <Input
                    value={embedHeight}
                    onChange={(e) => setEmbedHeight(e.target.value)}
                    placeholder="600"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Code Embed</label>
                <div className="flex gap-2 mt-1">
                  <textarea
                    value={embedCode}
                    readOnly
                    rows={3}
                    className="flex-1 px-3 py-2 border rounded-md font-mono text-sm resize-none"
                  />
                  <Button onClick={() => copyToClipboard(embedCode)} className="self-start">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="ml-2">Copier</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qrcode' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Scannez ce QR code pour accéder au formulaire. Idéal pour partager en version imprimée.
              </p>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                Modifier le slug du formulaire dans les paramètres modifiera le QR code.
              </div>

              <div className="flex flex-col items-center space-y-4 py-4">
                <canvas
                  ref={qrCanvasRef}
                  className="border rounded-lg shadow-sm"
                  style={{ width: 200, height: 200 }}
                />
                <Button onClick={downloadQRCode}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
