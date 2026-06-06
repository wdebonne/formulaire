'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { BlocksList } from '@/components/builder/blocks-list'
import { BlockEditor } from '@/components/builder/block-editor'
import { LogicEditor } from '@/components/builder/logic-editor'
import { WebhooksEditor } from '@/components/builder/webhooks-editor'
import { ThemeEditor } from '@/components/builder/theme-editor'
import { SettingsEditor } from '@/components/builder/settings-editor'
import { FormPreview } from '@/components/builder/form-preview'
import { CenterBlockPreview } from '@/components/builder/center-block-preview'
import type { FormBlock, BlockLogic, Webhook, FormSettings, Theme } from '@/types/form'
import {
  ArrowLeft,
  Save,
  Eye,
  Settings,
  Palette,
  GitBranch,
  Webhook as WebhookIcon,
  Loader2,
  Check,
  LayoutGrid,
  X,
  Share2,
  History,
} from 'lucide-react'
import { ShareDialog } from '@/components/builder/share-dialog'
import { VersionsModal } from '@/components/builder/versions-modal'

interface FormData {
  id: string
  title: string
  slug: string
  description: string
  status: 'draft' | 'published'
  blocks: FormBlock[]
  logic: BlockLogic[]
  settings: FormSettings
  webhooks: Webhook[]
  themeId: string | null
  theme: Theme | null
}

interface FormBuilderClientProps {
  initialForm: FormData
  themes: Theme[]
}

export function FormBuilderClient({ initialForm, themes: initialThemes }: FormBuilderClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [title, setTitle] = useState(initialForm.title)
  const [themes, setThemes] = useState(initialThemes)
  
  const {
    formId,
    blocks,
    logic,
    webhooks,
    settings,
    themeId,
    selectedBlockId,
    selectedInnerBlockId,
    activePanel,
    isDirty,
    setFormData,
    setActivePanel,
    markClean,
  } = useFormBuilder()

  // Handler pour mettre à jour le thème en temps réel (live preview)
  const handleThemeChange = useCallback((updatedTheme: Theme) => {
    setThemes(prevThemes => 
      prevThemes.map(t => t.id === updatedTheme.id ? updatedTheme : t)
    )
  }, [])

  // Initialize store with form data
  useEffect(() => {
    setFormData({
      formId: initialForm.id,
      title: initialForm.title,
      slug: initialForm.slug,
      description: initialForm.description,
      status: initialForm.status,
      blocks: initialForm.blocks,
      logic: initialForm.logic || [],
      webhooks: initialForm.webhooks || [],
      settings: initialForm.settings,
      themeId: initialForm.themeId,
    })
  }, [initialForm, setFormData])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/forms/${initialForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          blocks,
          logic,
          settings,
          webhooks,
          themeId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      markClean()
      toast({
        title: 'Modifications enregistrées',
        description: 'Vos modifications ont été sauvegardées',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [title, blocks, logic, settings, webhooks, themeId, initialForm, markClean, toast])

  const [isPublishing, setIsPublishing] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showVersionsModal, setShowVersionsModal] = useState(false)
  const [leftWidth, setLeftWidth] = useState(256)
  const [rightWidth, setRightWidth] = useState(320)
  const isResizingLeft = useRef(false)
  const isResizingRight = useRef(false)

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingLeft.current = true
    const startX = e.clientX
    const startWidth = leftWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingLeft.current) return
      const newWidth = Math.min(Math.max(startWidth + ev.clientX - startX, 160), 480)
      setLeftWidth(newWidth)
    }
    const onMouseUp = () => {
      isResizingLeft.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [leftWidth])

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRight.current = true
    const startX = e.clientX
    const startWidth = rightWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingRight.current) return
      const newWidth = Math.min(Math.max(startWidth + startX - ev.clientX, 240), 560)
      setRightWidth(newWidth)
    }
    const onMouseUp = () => {
      isResizingRight.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [rightWidth])
  
  const handleTogglePublish = useCallback(async () => {
    setIsPublishing(true)
    const newStatus = initialForm.status === 'published' ? 'draft' : 'published'
    try {
      const res = await fetch(`/api/forms/${initialForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          blocks,
          logic,
          settings,
          webhooks,
          themeId,
          status: newStatus,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      markClean()
      toast({
        title: newStatus === 'published' ? 'Formulaire publié' : 'Formulaire dépublié',
        description: newStatus === 'published' 
          ? 'Votre formulaire est maintenant accessible'
          : 'Votre formulaire n\'est plus accessible',
      })
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }, [title, blocks, logic, settings, webhooks, themeId, initialForm, markClean, toast, router])

  // Auto-save
  useEffect(() => {
    if (!isDirty) return

    const timer = setTimeout(() => {
      handleSave()
    }, 30000) // Auto-save every 30 seconds

    return () => clearTimeout(timer)
  }, [isDirty, handleSave])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)
  const selectedBlockIndex = blocks.findIndex(b => b.id === selectedBlockId)
  
  // Trouver le sous-bloc sélectionné si on est dans un groupe ou repeater
  const selectedInnerBlock = (selectedBlock?.type === 'group' || selectedBlock?.type === 'repeater') && selectedInnerBlockId
    ? selectedBlock.innerBlocks?.find(b => b.id === selectedInnerBlockId)
    : null

  if (showPreview) {
    return (
      <FormPreview 
        blocks={blocks}
        settings={settings}
        theme={themes.find(t => t.id === themeId) || null}
        onClose={() => setShowPreview(false)}
      />
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-64 font-medium"
            placeholder="Titre du formulaire"
          />
          {isDirty && (
            <span className="text-xs text-amber-600">Non enregistré</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowVersionsModal(true)}>
            <History className="w-4 h-4 mr-2" />
            Versions
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Aperçu
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
          <Button 
            size="sm" 
            variant={initialForm.status === 'published' ? 'outline' : 'default'}
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={initialForm.status === 'published' ? 'border-amber-500 text-amber-600 hover:bg-amber-50' : ''}
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : initialForm.status === 'published' ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Dépublier
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Publier
              </>
            )}
          </Button>
          {initialForm.status === 'published' && (
            <Button 
              size="sm" 
              variant="default"
              onClick={() => setShowShareDialog(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Partager
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Blocks list */}
        <div className="bg-white border-r overflow-auto p-3 shrink-0" style={{ width: leftWidth }}>
          <BlocksList />
        </div>

        {/* Left resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/40 transition-colors relative group"
          onMouseDown={handleLeftResizeStart}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-gray-200 group-hover:bg-primary/40 transition-colors" />
        </div>

        {/* Center - Block Preview */}
        <CenterBlockPreview
          block={selectedBlock || null}
          theme={themes.find(t => t.id === themeId) || null}
          blockIndex={selectedBlockIndex}
        />

        {/* Right resize handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/20 active:bg-primary/40 transition-colors relative group"
          onMouseDown={handleRightResizeStart}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-gray-200 group-hover:bg-primary/40 transition-colors" />
        </div>

        {/* Right panel */}
        <div className="bg-white border-l flex flex-col shrink-0" style={{ width: rightWidth }}>
          {/* Panel tabs */}
          <div className="flex border-b shrink-0">
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'blocks'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => setActivePanel('blocks')}
            >
              <LayoutGrid className="w-4 h-4 mx-auto" />
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'logic'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => setActivePanel('logic')}
            >
              <GitBranch className="w-4 h-4 mx-auto" />
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'theme'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => setActivePanel('theme')}
            >
              <Palette className="w-4 h-4 mx-auto" />
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'webhooks'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => setActivePanel('webhooks')}
            >
              <WebhookIcon className="w-4 h-4 mx-auto" />
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activePanel === 'settings'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => setActivePanel('settings')}
            >
              <Settings className="w-4 h-4 mx-auto" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-auto">
            {activePanel === 'blocks' && selectedInnerBlock && (
              <BlockEditor 
                block={selectedInnerBlock} 
                isInnerBlock 
                parentGroupId={selectedBlockId!}
              />
            )}
            {activePanel === 'blocks' && selectedBlock && !selectedInnerBlock && (
              <BlockEditor block={selectedBlock} />
            )}
            {activePanel === 'blocks' && !selectedBlock && (
              <div className="p-4 text-center text-gray-500">
                <p>Sélectionnez un bloc pour le modifier</p>
              </div>
            )}
            {activePanel === 'logic' && (
              <LogicEditor blocks={blocks} />
            )}
            {activePanel === 'theme' && (
              <ThemeEditor themes={themes} onThemeChange={handleThemeChange} />
            )}
            {activePanel === 'webhooks' && (
              <WebhooksEditor blocks={blocks} />
            )}
            {activePanel === 'settings' && (
              <SettingsEditor />
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        formSlug={initialForm.slug}
        formId={initialForm.id}
      />

      {/* Versions Modal */}
      <VersionsModal
        formId={initialForm.id}
        open={showVersionsModal}
        onClose={() => setShowVersionsModal(false)}
        onRestored={() => router.refresh()}
      />
    </div>
  )
}
