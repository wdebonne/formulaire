'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Mail,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
} from 'lucide-react'

interface SmtpSettings {
  smtpHost: string | null
  smtpPort: number
  smtpUser: string | null
  smtpPass: string | null
  smtpFrom: string | null
  smtpFromName: string | null
  smtpSecure: boolean
}

interface EmailTemplate {
  id: string
  name: string
  slug: string
  subject: string
  htmlContent: string
  variables: string
  isDefault: boolean
  createdAt: string
}

export function SmtpSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  // SMTP Settings
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    smtpFromName: '',
    smtpSecure: false,
  })
  const [testEmail, setTestEmail] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  const [templateForm, setTemplateForm] = useState({
    name: '',
    slug: '',
    subject: '',
    htmlContent: '',
    variables: [] as string[],
  })

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSmtpSettings({
          smtpHost: data.smtpHost || '',
          smtpPort: data.smtpPort || 587,
          smtpUser: data.smtpUser || '',
          smtpPass: data.smtpPass || '',
          smtpFrom: data.smtpFrom || '',
          smtpFromName: data.smtpFromName || '',
          smtpSecure: data.smtpSecure || false,
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchTemplates()
  }, [])

  const handleSaveSmtp = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpSettings),
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les paramètres SMTP ont été enregistrés',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus('idle')
    try {
      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-connection',
          config: {
            host: smtpSettings.smtpHost,
            port: smtpSettings.smtpPort,
            user: smtpSettings.smtpUser,
            pass: smtpSettings.smtpPass,
            from: smtpSettings.smtpFrom,
            secure: smtpSettings.smtpSecure,
          },
        }),
      })

      const data = await res.json()

      if (data.success) {
        setConnectionStatus('success')
        toast({
          title: 'Connexion réussie',
          description: 'La connexion au serveur SMTP est fonctionnelle',
        })
      } else {
        setConnectionStatus('error')
        toast({
          title: 'Échec de connexion',
          description: data.error || 'Impossible de se connecter au serveur SMTP',
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

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: 'Erreur',
        description: 'Veuillez entrer une adresse email de test',
        variant: 'destructive',
      })
      return
    }

    setSendingTest(true)
    try {
      const res = await fetch('/api/admin/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-test',
          testEmail,
          config: {
            host: smtpSettings.smtpHost,
            port: smtpSettings.smtpPort,
            user: smtpSettings.smtpUser,
            pass: smtpSettings.smtpPass,
            from: smtpSettings.smtpFrom,
            fromName: smtpSettings.smtpFromName,
            secure: smtpSettings.smtpSecure,
          },
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast({
          title: 'Email envoyé',
          description: `Un email de test a été envoyé à ${testEmail}`,
        })
      } else {
        toast({
          title: 'Échec de l\'envoi',
          description: data.error || 'Impossible d\'envoyer l\'email de test',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSendingTest(false)
    }
  }

  const handleOpenTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        name: template.name,
        slug: template.slug,
        subject: template.subject,
        htmlContent: template.htmlContent,
        variables: JSON.parse(template.variables || '[]'),
      })
    } else {
      setEditingTemplate(null)
      setTemplateForm({
        name: '',
        slug: '',
        subject: '',
        htmlContent: getDefaultTemplateHtml(),
        variables: ['siteName', 'year'],
      })
    }
    setIsTemplateDialogOpen(true)
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : '/api/admin/templates'
      
      const method = editingTemplate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...templateForm,
          variables: templateForm.variables,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      toast({
        title: editingTemplate ? 'Template modifié' : 'Template créé',
        description: 'Le template a été enregistré',
      })

      setIsTemplateDialogOpen(false)
      fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression')
      }

      toast({
        title: 'Template supprimé',
        description: 'Le template a été supprimé avec succès',
      })

      fetchTemplates()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handlePreview = (html: string) => {
    // Remplacer les variables par des valeurs de test
    let previewContent = html
      .replace(/\{\{siteName\}\}/g, 'FormBuilder')
      .replace(/\{\{name\}\}/g, 'Jean Dupont')
      .replace(/\{\{email\}\}/g, 'jean@exemple.com')
      .replace(/\{\{resetUrl\}\}/g, 'https://exemple.com/reset')
      .replace(/\{\{loginUrl\}\}/g, 'https://exemple.com/login')
      .replace(/\{\{formTitle\}\}/g, 'Mon formulaire')
      .replace(/\{\{formUrl\}\}/g, 'https://exemple.com/form')
      .replace(/\{\{sharedByName\}\}/g, 'Marie Martin')
      .replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
    
    setPreviewHtml(previewContent)
    setIsPreviewOpen(true)
  }

  function getDefaultTemplateHtml() {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>{{siteName}}</h1>
      </div>
      <div class="content">
        <h2>Titre de l'email</h2>
        <p>Contenu de l'email...</p>
      </div>
      <div class="footer">
        <p>© {{year}} {{siteName}}. Tous droits réservés.</p>
      </div>
    </div>
  </body>
</html>`
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
              <Mail className="w-5 h-5 text-green-600" />
              <h1 className="text-xl font-semibold">SMTP & Templates</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* SMTP Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration SMTP</CardTitle>
            <CardDescription>
              Configurez le serveur SMTP pour l'envoi des emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">Serveur SMTP</Label>
                <Input
                  id="smtpHost"
                  value={smtpSettings.smtpHost || ''}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpHost: e.target.value })}
                  placeholder="smtp.exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={smtpSettings.smtpPort}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpPort: parseInt(e.target.value) })}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser">Utilisateur</Label>
                <Input
                  id="smtpUser"
                  value={smtpSettings.smtpUser || ''}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpUser: e.target.value })}
                  placeholder="utilisateur@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPass">Mot de passe</Label>
                <Input
                  id="smtpPass"
                  type="password"
                  value={smtpSettings.smtpPass || ''}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpPass: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFrom">Email d'expédition</Label>
                <Input
                  id="smtpFrom"
                  value={smtpSettings.smtpFrom || ''}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpFrom: e.target.value })}
                  placeholder="noreply@exemple.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpFromName">Nom de l'expéditeur</Label>
                <Input
                  id="smtpFromName"
                  value={smtpSettings.smtpFromName || ''}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpFromName: e.target.value })}
                  placeholder="FormBuilder"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={smtpSettings.smtpSecure}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, smtpSecure: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="smtpSecure">Connexion sécurisée (SSL/TLS)</Label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-4">
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
              <Button onClick={handleSaveSmtp} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>

            {/* Test email */}
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Envoyer un email de test</h4>
              <div className="flex items-center space-x-3">
                <Input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="email@test.com"
                  className="max-w-xs"
                />
                <Button variant="outline" onClick={handleSendTestEmail} disabled={sendingTest}>
                  {sendingTest ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Templates d'emails</CardTitle>
                <CardDescription>
                  Personnalisez les emails envoyés par l'application
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenTemplateDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-green-100 rounded">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-gray-500">Slug: {template.slug}</p>
                    </div>
                    {template.isDefault && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Par défaut
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(template.htmlContent)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenTemplateDialog(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!template.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Aucun template créé. Les templates par défaut seront utilisés.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Modifier le template' : 'Nouveau template'}
            </DialogTitle>
            <DialogDescription>
              Variables disponibles : {'{{'} siteName {'}}'}, {'{{'} name {'}}'}, {'{{'} email {'}}'}, {'{{'} year {'}}'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate}>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Nom</Label>
                  <Input
                    id="templateName"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Bienvenue"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateSlug">Slug (identifiant unique)</Label>
                  <Input
                    id="templateSlug"
                    value={templateForm.slug}
                    onChange={(e) => setTemplateForm({ ...templateForm, slug: e.target.value })}
                    placeholder="welcome"
                    required
                    disabled={editingTemplate?.isDefault}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateSubject">Sujet de l'email</Label>
                <Input
                  id="templateSubject"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="Bienvenue sur {{siteName}} !"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="templateHtml">Contenu HTML</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(templateForm.htmlContent)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Aperçu
                  </Button>
                </div>
                <textarea
                  id="templateHtml"
                  value={templateForm.htmlContent}
                  onChange={(e) => setTemplateForm({ ...templateForm, htmlContent: e.target.value })}
                  className="w-full h-64 px-3 py-2 border rounded-md font-mono text-sm"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Aperçu de l'email</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[500px]"
              title="Aperçu email"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
