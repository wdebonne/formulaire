import { describe, expect, it } from 'vitest'
import {
  effectiveScreenLayout,
  isFocalPointRelevant,
  resolveScreenMedia,
  screenImageProps,
  screenOverlay,
  screenVideoFrameClass,
} from '@/lib/screen-media'

describe('rendu historique préservé', () => {
  // Un formulaire enregistré avant ces réglages ne doit pas changer d'apparence
  it('sans attribut, l\'image empilée est rognée et plafonnée à 300 px, coins arrondis, sans ombre', () => {
    const img = screenImageProps(resolveScreenMedia({}), 'stack')
    expect(img.imgClassName).toContain('object-cover')
    expect(img.imgStyle.maxHeight).toBe('300px')
    expect(img.imgStyle.height).toBeUndefined()
    expect(img.frameClassName).toContain('rounded-lg')
    expect(img.frameClassName).not.toContain('shadow-lg')
  })

  it('sans attribut, l\'image côte à côte est plafonnée à 500 px avec une ombre', () => {
    const img = screenImageProps(resolveScreenMedia({}), 'float')
    expect(img.imgStyle.maxHeight).toBe('500px')
    expect(img.frameClassName).toContain('shadow-lg')
  })

  it('sans attribut, la moitié d\'écran est remplie par l\'image', () => {
    const img = screenImageProps(resolveScreenMedia({}), 'split')
    expect(img.frameClassName).toContain('absolute inset-0')
    expect(img.imgClassName).toContain('object-cover')
    expect(img.imgStyle.objectPosition).toBe('50% 50%')
  })

  it('sans disposition choisie, l\'image est empilée', () => {
    expect(effectiveScreenLayout({})).toBe('stack')
  })
})

describe('point focal', () => {
  // Régression : `focalPoint?.x || 50` ramenait un point focal à 0 % au centre
  it('un point focal sur le bord (0 %) reste sur le bord', () => {
    const img = screenImageProps(resolveScreenMedia({ focalPoint: { x: 0, y: 0 } }), 'stack')
    expect(img.imgStyle.objectPosition).toBe('0% 0%')
  })

  it('une valeur hors bornes est ramenée entre 0 et 100', () => {
    expect(resolveScreenMedia({ focalPoint: { x: -20, y: 140 } }).focal).toEqual({ x: 0, y: 100 })
  })

  it('n\'agit qu\'en mode Remplir, ou en taille d\'origine dans un cadre plein', () => {
    expect(isFocalPointRelevant(resolveScreenMedia({ attachmentFit: 'cover' }), 'stack')).toBe(true)
    expect(isFocalPointRelevant(resolveScreenMedia({ attachmentFit: 'contain' }), 'stack')).toBe(false)
    expect(isFocalPointRelevant(resolveScreenMedia({ attachmentFit: 'fill' }), 'split')).toBe(false)
    expect(isFocalPointRelevant(resolveScreenMedia({ attachmentFit: 'none' }), 'stack')).toBe(false)
    expect(isFocalPointRelevant(resolveScreenMedia({ attachmentFit: 'none' }), 'background')).toBe(true)
  })

  it('n\'est pas appliqué à une image adaptée, qui n\'est pas rognée', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentFit: 'contain', focalPoint: { x: 10, y: 10 } }), 'stack')
    expect(img.imgStyle.objectPosition).toBeUndefined()
  })
})

describe('zoom', () => {
  it('agrandit autour du point focal', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentZoom: 150, focalPoint: { x: 20, y: 80 } }), 'float')
    expect(img.imgStyle.transform).toBe('scale(1.5)')
    expect(img.imgStyle.transformOrigin).toBe('20% 80%')
  })

  it('est borné entre 100 et 200 %', () => {
    expect(resolveScreenMedia({ attachmentZoom: 500 }).zoom).toBe(200)
    expect(resolveScreenMedia({ attachmentZoom: 20 }).zoom).toBe(100)
  })

  // Agrandir une image adaptée ou étirée la ferait déborder de son cadre
  it('est ignoré hors du mode Remplir', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentFit: 'contain', attachmentZoom: 180 }), 'stack')
    expect(img.imgStyle.transform).toBeUndefined()
  })
})

describe('ajustement et hauteur', () => {
  it('une hauteur choisie fixe le cadre, que l\'image remplit selon le mode', () => {
    const contain = screenImageProps(resolveScreenMedia({ attachmentFit: 'contain', attachmentHeight: 'lg' }), 'stack')
    expect(contain.imgStyle.height).toBe('450px')
    expect(contain.imgClassName).toContain('object-contain')
    const fill = screenImageProps(resolveScreenMedia({ attachmentFit: 'fill', attachmentHeight: 'sm' }), 'float')
    expect(fill.imgStyle.height).toBe('200px')
    expect(fill.imgClassName).toContain('object-fill')
  })

  it('les proportions d\'origine ne plafonnent pas la hauteur', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentHeight: 'auto' }), 'stack')
    expect(img.imgStyle.height).toBeUndefined()
    expect(img.imgStyle.maxHeight).toBeUndefined()
    expect(img.imgClassName).toContain('h-auto')
  })

  it('la taille d\'origine n\'impose ni hauteur ni largeur pleine', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentFit: 'none', attachmentHeight: 'lg' }), 'stack')
    expect(img.imgStyle.height).toBeUndefined()
    expect(img.frameClassName).toContain('w-fit')
    expect(img.frameClassName.split(' ')).not.toContain('w-full')
  })

  // En moitié d'écran et en arrière-plan, le cadre est l'écran : une hauteur n'a pas de sens
  it('la moitié d\'écran et l\'arrière-plan ignorent la hauteur', () => {
    for (const context of ['split', 'background'] as const) {
      const img = screenImageProps(resolveScreenMedia({ attachmentHeight: 'sm', attachmentFit: 'contain' }), context)
      expect(img.imgStyle.height).toBeUndefined()
      expect(img.imgStyle.maxHeight).toBeUndefined()
      expect(img.imgClassName).toContain('h-full')
      expect(img.imgClassName).toContain('object-contain')
    }
  })

  it('un mode inconnu retombe sur Remplir', () => {
    expect(resolveScreenMedia({ attachmentFit: 'stretch' as never }).fit).toBe('cover')
  })
})

describe('style du cadre', () => {
  it('coins et ombre réglés explicitement l\'emportent sur la disposition', () => {
    const img = screenImageProps(resolveScreenMedia({ attachmentRadius: 'none', attachmentShadow: false }), 'float')
    expect(img.frameClassName).toContain('rounded-none')
    expect(img.frameClassName).not.toContain('shadow-lg')
    const stack = screenImageProps(resolveScreenMedia({ attachmentRadius: 'xl', attachmentShadow: true }), 'stack')
    expect(stack.frameClassName).toContain('rounded-3xl')
    expect(stack.frameClassName).toContain('shadow-lg')
  })

  it('la vidéo reprend les coins et l\'ombre de l\'image', () => {
    const media = resolveScreenMedia({ attachmentRadius: 'xl' })
    expect(screenVideoFrameClass(media, 'float')).toContain('rounded-3xl')
    expect(screenVideoFrameClass(media, 'float')).toContain('shadow-lg')
    expect(screenVideoFrameClass(media, 'stack')).not.toContain('shadow-lg')
  })
})

describe('texte alternatif (RGAA)', () => {
  it('vide, l\'image est décorative', () => {
    expect(screenImageProps(resolveScreenMedia({}), 'stack').alt).toBe('')
    expect(screenImageProps(resolveScreenMedia({ attachmentAlt: '   ' }), 'stack').alt).toBe('')
  })

  it('renseigné, il est transmis sans espaces superflus', () => {
    expect(screenImageProps(resolveScreenMedia({ attachmentAlt: '  Salle des fêtes ' }), 'split').alt).toBe('Salle des fêtes')
  })
})

describe('arrière-plan', () => {
  it('le voile « thème » reprend le fond du thème et garde ses couleurs de texte', () => {
    const overlay = screenOverlay(resolveScreenMedia({}), '#fef3c7')
    expect(overlay.overlayStyle.backgroundColor).toBe('#fef3c7')
    expect(overlay.overlayStyle.opacity).toBe(0.5)
    expect(overlay.questionsColor).toBeUndefined()
  })

  it('un voile sombre impose un texte blanc, un voile clair un texte foncé', () => {
    expect(screenOverlay(resolveScreenMedia({ attachmentOverlay: 'dark' })).questionsColor).toBe('#ffffff')
    expect(screenOverlay(resolveScreenMedia({ attachmentOverlay: 'light' })).questionsColor).toBe('#111827')
  })

  // Un voile opaque à 100 % masquerait l'image qu'on a justement choisi d'afficher
  it('l\'opacité du voile est bornée à 90 %', () => {
    expect(resolveScreenMedia({ attachmentOverlayOpacity: 100 }).overlayOpacity).toBe(90)
    expect(resolveScreenMedia({ attachmentOverlayOpacity: -5 }).overlayOpacity).toBe(0)
    expect(resolveScreenMedia({ attachmentOverlayOpacity: 0 }).overlayOpacity).toBe(0)
  })

  // Une iframe YouTube ne se recadre pas en plein écran
  it('une vidéo en arrière-plan s\'affiche empilée', () => {
    expect(effectiveScreenLayout({ attachmentLayout: 'background', attachmentType: 'video' })).toBe('stack')
    expect(effectiveScreenLayout({ attachmentLayout: 'background', attachmentType: 'image' })).toBe('background')
    expect(effectiveScreenLayout({ attachmentLayout: 'background' })).toBe('background')
  })
})
