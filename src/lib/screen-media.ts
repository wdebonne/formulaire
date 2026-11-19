import type { CSSProperties } from 'react'
import type { BlockAttributes } from '@/types/form'

// Seule source des styles de l'image des écrans Bienvenue / Remerciement : le formulaire public et
// l'aperçu central du builder l'appellent tous deux, sinon les deux rendus divergent (ils l'ont déjà
// fait : 400 px d'un côté, 500 px de l'autre).

export type ScreenMediaFit = 'cover' | 'contain' | 'fill' | 'none'
export type ScreenMediaHeight = 'sm' | 'md' | 'lg' | 'auto'
export type ScreenMediaContext = 'stack' | 'float' | 'split' | 'background'
export type ScreenMediaOverlay = 'theme' | 'dark' | 'light'

export const SCREEN_MEDIA_HEIGHTS: Record<'sm' | 'md' | 'lg', number> = { sm: 200, md: 300, lg: 450 }

// Hauteurs maximales historiques, appliquées quand aucune hauteur n'a été choisie
const LEGACY_MAX_HEIGHT: Record<'stack' | 'float', number> = { stack: 300, float: 500 }

export const MIN_ZOOM = 100
export const MAX_ZOOM = 200
export const MAX_OVERLAY_OPACITY = 90
export const DEFAULT_OVERLAY_OPACITY = 50

export interface ScreenMedia {
  fit: ScreenMediaFit
  height: ScreenMediaHeight | null
  zoom: number
  radius: 'none' | 'md' | 'xl'
  shadow: boolean | null
  alt: string
  focal: { x: number; y: number }
  overlay: ScreenMediaOverlay
  overlayOpacity: number
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

const FITS: ScreenMediaFit[] = ['cover', 'contain', 'fill', 'none']
const HEIGHTS: ScreenMediaHeight[] = ['sm', 'md', 'lg', 'auto']

export function resolveScreenMedia(attrs: Partial<BlockAttributes>): ScreenMedia {
  const fit = FITS.includes(attrs.attachmentFit as ScreenMediaFit) ? (attrs.attachmentFit as ScreenMediaFit) : 'cover'
  const height = HEIGHTS.includes(attrs.attachmentHeight as ScreenMediaHeight)
    ? (attrs.attachmentHeight as ScreenMediaHeight)
    : null
  const radius = attrs.attachmentRadius === 'none' || attrs.attachmentRadius === 'xl' ? attrs.attachmentRadius : 'md'
  const overlay = attrs.attachmentOverlay === 'dark' || attrs.attachmentOverlay === 'light' ? attrs.attachmentOverlay : 'theme'
  return {
    fit,
    height,
    zoom: fit === 'cover' ? clamp(attrs.attachmentZoom, MIN_ZOOM, MAX_ZOOM, MIN_ZOOM) : MIN_ZOOM,
    radius,
    shadow: typeof attrs.attachmentShadow === 'boolean' ? attrs.attachmentShadow : null,
    alt: (attrs.attachmentAlt ?? '').trim(),
    focal: {
      x: clamp(attrs.focalPoint?.x, 0, 100, 50),
      y: clamp(attrs.focalPoint?.y, 0, 100, 50),
    },
    overlay,
    overlayOpacity: clamp(attrs.attachmentOverlayOpacity, 0, MAX_OVERLAY_OPACITY, DEFAULT_OVERLAY_OPACITY),
  }
}

// Le point focal n'a d'effet que si l'image est rognée : en cover, ou en taille d'origine dans un
// cadre plein écran (split / arrière-plan) plus petit que l'image.
export function isFocalPointRelevant(media: ScreenMedia, context: ScreenMediaContext): boolean {
  if (media.fit === 'cover') return true
  return media.fit === 'none' && (context === 'split' || context === 'background')
}

const FIT_CLASS: Record<ScreenMediaFit, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
  none: 'object-none',
}

const RADIUS_CLASS: Record<ScreenMedia['radius'], string> = {
  none: 'rounded-none',
  md: 'rounded-lg',
  xl: 'rounded-3xl',
}

export interface ScreenImageProps {
  frameClassName: string
  frameStyle: CSSProperties
  imgClassName: string
  imgStyle: CSSProperties
  alt: string
}

export function screenImageProps(media: ScreenMedia, context: ScreenMediaContext): ScreenImageProps {
  const imgStyle: CSSProperties = {}
  if (isFocalPointRelevant(media, context)) {
    imgStyle.objectPosition = `${media.focal.x}% ${media.focal.y}%`
  }
  if (media.zoom > MIN_ZOOM) {
    imgStyle.transform = `scale(${media.zoom / 100})`
    imgStyle.transformOrigin = `${media.focal.x}% ${media.focal.y}%`
  }

  if (context === 'split' || context === 'background') {
    return {
      frameClassName: 'absolute inset-0 overflow-hidden',
      frameStyle: {},
      imgClassName: `w-full h-full ${FIT_CLASS[media.fit]}`,
      imgStyle,
      alt: media.alt,
    }
  }

  const shadow = media.shadow ?? context === 'float'
  const frameParts = ['overflow-hidden', RADIUS_CLASS[media.radius]]
  if (shadow) frameParts.push('shadow-lg')

  if (media.fit === 'none') {
    frameParts.push('w-fit max-w-full mx-auto')
    return {
      frameClassName: frameParts.join(' '),
      frameStyle: {},
      imgClassName: 'block max-w-full h-auto',
      imgStyle,
      alt: media.alt,
    }
  }

  frameParts.push('w-full')
  if (media.height === 'auto') {
    return {
      frameClassName: frameParts.join(' '),
      frameStyle: {},
      imgClassName: 'block w-full h-auto',
      imgStyle,
      alt: media.alt,
    }
  }
  if (media.height) {
    imgStyle.height = `${SCREEN_MEDIA_HEIGHTS[media.height]}px`
    return {
      frameClassName: frameParts.join(' '),
      frameStyle: {},
      imgClassName: `block w-full ${FIT_CLASS[media.fit]}`,
      imgStyle,
      alt: media.alt,
    }
  }
  imgStyle.maxHeight = `${LEGACY_MAX_HEIGHT[context]}px`
  return {
    frameClassName: frameParts.join(' '),
    frameStyle: {},
    imgClassName: `block w-full h-auto ${FIT_CLASS[media.fit]}`,
    imgStyle,
    alt: media.alt,
  }
}

// Cadre d'une vidéo (stack / float) : mêmes coins et même ombre que l'image
export function screenVideoFrameClass(media: ScreenMedia, context: 'stack' | 'float'): string {
  const shadow = media.shadow ?? context === 'float'
  return ['overflow-hidden aspect-video', RADIUS_CLASS[media.radius], shadow ? 'shadow-lg' : ''].filter(Boolean).join(' ')
}

export interface OverlayColors {
  overlayStyle: CSSProperties
  questionsColor?: string
  answersColor?: string
}

// Voile de la disposition arrière-plan. « theme » reprend le fond du thème, donc ses couleurs de texte
// restent lisibles ; sombre et clair imposent un texte contrasté.
export function screenOverlay(media: ScreenMedia, themeBackground?: string): OverlayColors {
  const opacity = media.overlayOpacity / 100
  if (media.overlay === 'dark') {
    return { overlayStyle: { backgroundColor: '#000000', opacity }, questionsColor: '#ffffff', answersColor: '#f3f4f6' }
  }
  if (media.overlay === 'light') {
    return { overlayStyle: { backgroundColor: '#ffffff', opacity }, questionsColor: '#111827', answersColor: '#374151' }
  }
  return { overlayStyle: { backgroundColor: themeBackground || '#ffffff', opacity } }
}

// Une iframe YouTube ne se recadre pas en plein écran : une vidéo en arrière-plan retombe en empilé
export function effectiveScreenLayout(attrs: Partial<BlockAttributes>): NonNullable<BlockAttributes['attachmentLayout']> {
  const layout = attrs.attachmentLayout || 'stack'
  if (layout === 'background' && (attrs.attachmentType || 'image') === 'video') return 'stack'
  return layout
}
