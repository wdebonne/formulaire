'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  Download,
  Image as ImageIcon,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  DEFAULT_QR_DESIGN,
  drawQrCode,
  type QrDesign,
  type QrDotStyle,
  type QrErrorLevel,
  type QrEyeStyle,
  type QrFillMode,
  type QrGradientType,
  type QrLogoShape,
} from '@/lib/qr-render'

interface QrCodePanelProps {
  url: string
  fileName: string
  advanced: boolean
  onAdvancedChange: (advanced: boolean) => void
}

const CHECKERBOARD =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 16px 16px'

const DOT_STYLES: { value: QrDotStyle; label: string }[] = [
  { value: 'square', label: 'Carré' },
  { value: 'rounded', label: 'Arrondi' },
  { value: 'dots', label: 'Points' },
  { value: 'classy', label: 'Classy' },
]

const EYE_STYLES: { value: QrEyeStyle; label: string }[] = [
  { value: 'square', label: 'Carré' },
  { value: 'rounded', label: 'Arrondi' },
  { value: 'circle', label: 'Cercle' },
]

const FILL_MODES: { value: QrFillMode; label: string }[] = [
  { value: 'solid', label: 'Uni' },
  { value: 'gradient', label: 'Dégradé' },
]

const GRADIENT_TYPES: { value: QrGradientType; label: string }[] = [
  { value: 'linear', label: 'Linéaire' },
  { value: 'radial', label: 'Radial' },
]

const LOGO_SHAPES: { value: QrLogoShape; label: string }[] = [
  { value: 'square', label: 'Carré' },
  { value: 'circle', label: 'Cercle' },
]

const ERROR_LEVELS: { value: QrErrorLevel; label: string }[] = [
  { value: 'L', label: 'Faible (7%)' },
  { value: 'M', label: 'Moyen (15%)' },
  { value: 'Q', label: 'Élevé (25%)' },
  { value: 'H', label: 'Maximum (30%)' },
]

const EXPORT_SIZES = [512, 1024, 2048]

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(value)

  useEffect(() => setText(value), [value])

  const handleChange = (next: string) => {
    setText(next)
    if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase())
  }

  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex gap-2 mt-1">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <Input
          value={text}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          className="h-9 flex-1 font-mono text-xs uppercase"
        />
      </div>
    </div>
  )
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="mt-1 flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors',
              value === option.value
                ? 'border-primary bg-primary/5 font-medium text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <span className="text-xs tabular-nums text-gray-400">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-primary"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      {children}
    </div>
  )
}

export function QrCodePanel({ url, fileName, advanced, onAdvancedChange }: QrCodePanelProps) {
  const { toast } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [design, setDesign] = useState<QrDesign>(DEFAULT_QR_DESIGN)
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null)
  const [siteLogo, setSiteLogo] = useState<string | null>(null)
  const [exportSize, setExportSize] = useState(1024)

  const set = <K extends keyof QrDesign>(key: K, value: QrDesign[K]) =>
    setDesign((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    fetch('/api/settings/public')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.siteLogo) setSiteLogo(data.siteLogo)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!logoSrc) {
      setLogoImage(null)
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!cancelled) setLogoImage(image)
    }
    image.onerror = () => {
      if (cancelled) return
      setLogoImage(null)
      toast({
        title: 'Erreur',
        description: "Impossible de charger cette image",
        variant: 'destructive',
      })
    }
    image.src = logoSrc

    return () => {
      cancelled = true
    }
  }, [logoSrc, toast])

  useEffect(() => {
    if (canvasRef.current) {
      drawQrCode(canvasRef.current, url, design, logoImage)
    }
  }, [url, design, logoImage])

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Format non supporté',
        description: 'Choisissez une image (PNG, JPG, SVG…)',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Image trop lourde',
        description: 'La taille maximale est de 2 Mo',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => setLogoSrc(String(reader.result))
    reader.readAsDataURL(file)
  }

  const handleDownload = () => {
    const canvas = document.createElement('canvas')
    if (!drawQrCode(canvas, url, design, logoImage, exportSize)) {
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le QR code',
        variant: 'destructive',
      })
      return
    }

    const link = document.createElement('a')
    link.download = `${fileName}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleReset = () => {
    setDesign(DEFAULT_QR_DESIGN)
    setLogoSrc(null)
  }

  return (
    <div className={cn('gap-6', advanced ? 'flex flex-col md:flex-row' : 'flex flex-col')}>
      <div className={cn(advanced && 'md:w-56 md:shrink-0')}>
        <div className="flex flex-col items-center gap-3 md:sticky md:top-0">
          <div
            className="rounded-lg border p-2 shadow-sm"
            style={{ background: design.bgTransparent ? CHECKERBOARD : '#ffffff' }}
          >
            <canvas
              ref={canvasRef}
              className="block rounded"
              style={{ width: 200, height: 200 }}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={exportSize}
              onChange={(e) => setExportSize(Number(e.target.value))}
              className="h-9 rounded-md border px-2 text-sm"
            >
              {EXPORT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} px
                </option>
              ))}
            </select>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAdvancedChange(!advanced)}
            className="flex flex-1 items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-gray-500" />
              Options avancées
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-gray-500 transition-transform', advanced && 'rotate-180')}
            />
          </button>
          {advanced && (
            <Button variant="ghost" size="sm" onClick={handleReset} title="Réinitialiser">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {advanced && (
          <div className="space-y-3">
            <Section title="Couleur">
              <OptionGroup
                label="Type de remplissage"
                value={design.fillMode}
                options={FILL_MODES}
                onChange={(value) => set('fillMode', value)}
              />

              {design.fillMode === 'solid' ? (
                <ColorField
                  label="Couleur"
                  value={design.color}
                  onChange={(value) => set('color', value)}
                />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label="Début"
                      value={design.gradientFrom}
                      onChange={(value) => set('gradientFrom', value)}
                    />
                    <ColorField
                      label="Fin"
                      value={design.gradientTo}
                      onChange={(value) => set('gradientTo', value)}
                    />
                  </div>
                  <OptionGroup
                    label="Type de dégradé"
                    value={design.gradientType}
                    options={GRADIENT_TYPES}
                    onChange={(value) => set('gradientType', value)}
                  />
                  {design.gradientType === 'linear' && (
                    <SliderField
                      label="Angle"
                      value={design.gradientAngle}
                      min={0}
                      max={360}
                      step={5}
                      suffix="°"
                      onChange={(value) => set('gradientAngle', value)}
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <ColorField
                  label="Arrière-plan"
                  value={design.bgColor}
                  onChange={(value) => set('bgColor', value)}
                  disabled={design.bgTransparent}
                />
                <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={design.bgTransparent}
                    onChange={(e) => set('bgTransparent', e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Fond transparent
                </label>
              </div>
            </Section>

            <Section title="Style">
              <OptionGroup
                label="Points"
                value={design.dotStyle}
                options={DOT_STYLES}
                onChange={(value) => set('dotStyle', value)}
              />
              <OptionGroup
                label="Coins de repérage"
                value={design.eyeStyle}
                options={EYE_STYLES}
                onChange={(value) => set('eyeStyle', value)}
              />
              {design.eyeStyle !== 'square' && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                  Arrondir les coins de repérage retire quelques modules aux motifs de détection.
                  Les téléphones y arrivent, mais certains lecteurs stricts peuvent refuser le code :
                  testez-le avant impression.
                </p>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={design.eyeColorEnabled}
                  onChange={(e) => set('eyeColorEnabled', e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Couleur de coin dédiée
              </label>
              {design.eyeColorEnabled && (
                <ColorField
                  label="Couleur des coins"
                  value={design.eyeColor}
                  onChange={(value) => set('eyeColor', value)}
                />
              )}
            </Section>

            <Section title="Logo central">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFile}
                  className="hidden"
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {logoSrc ? 'Changer' : 'Importer une image'}
                </Button>
                {siteLogo && siteLogo !== logoSrc && (
                  <Button variant="outline" size="sm" onClick={() => setLogoSrc(siteLogo)}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Logo du site
                  </Button>
                )}
                {logoSrc && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoSrc}
                      alt="Logo"
                      className="h-9 w-9 rounded border object-contain p-0.5"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoSrc(null)}
                      className="text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {logoSrc && (
                <div className="space-y-3">
                  <SliderField
                    label="Taille"
                    value={design.logoSize}
                    min={10}
                    max={35}
                    suffix="%"
                    onChange={(value) => set('logoSize', value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={design.logoBackground}
                        onChange={(e) => set('logoBackground', e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      Fond derrière le logo
                    </label>
                    <OptionGroup
                      label="Forme du fond"
                      value={design.logoShape}
                      options={LOGO_SHAPES}
                      onChange={(value) => set('logoShape', value)}
                    />
                  </div>
                  {design.logoBackground && (
                    <SliderField
                      label="Marge du fond"
                      value={design.logoPadding}
                      min={0}
                      max={6}
                      step={0.5}
                      suffix="%"
                      onChange={(value) => set('logoPadding', value)}
                    />
                  )}
                  <p className="text-xs text-gray-500">
                    Avec un logo, la correction d&apos;erreur passe automatiquement au niveau maximum
                    pour garder le code scannable. Testez toujours le rendu final avec votre
                    téléphone.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Rendu">
              <SliderField
                label="Marge (modules)"
                value={design.margin}
                min={0}
                max={6}
                suffix=""
                onChange={(value) => set('margin', value)}
              />
              <div>
                <label className="text-xs font-medium text-gray-600">Correction d&apos;erreur</label>
                <select
                  value={logoSrc ? 'H' : design.errorCorrectionLevel}
                  disabled={Boolean(logoSrc)}
                  onChange={(e) => set('errorCorrectionLevel', e.target.value as QrErrorLevel)}
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {ERROR_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
