import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type React from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function parseJsonSafe<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return defaultValue
  }
}

import type { FormBlock } from '@/types/form'

/**
 * Remplace les variables @1, @2, @2a, @2b, @2a.all, etc. dans un texte par les valeurs des réponses
 * - @1 = réponse de la question 1
 * - @2a = réponse du premier bloc interne (a) de la question 2 (groupe/repeater)
 * - @2a.all = toutes les réponses cumulées du bloc interne 'a' de toutes les répétitions
 *             Ex: élément 1 = "papier", élément 2 = "papier, tableaux", élément 3 = "papier, tableaux, crayon"
 * 
 * @param text - Le texte contenant les variables
 * @param blocks - Les blocs du formulaire
 * @param answers - Les réponses (clé = blockId, valeur = réponse)
 * @param currentBlockIndex - L'index du bloc courant (pour ne remplacer que les questions précédentes)
 * @param currentRepetition - Le numéro de répétition actuel (pour les repeaters)
 * @param currentRepeaterId - L'ID du repeater actuel (pour chercher dans la même répétition)
 * @param currentInnerBlockIndex - L'index du bloc interne actuel dans le repeater/groupe
 */
export function replaceVariables(
  text: string,
  blocks: FormBlock[],
  answers: Record<string, any>,
  currentBlockIndex?: number,
  currentRepetition?: number,
  currentRepeaterId?: string,
  currentInnerBlockIndex?: number
): string {
  if (!text) return text
  
  // Regex pour trouver @1, @2, @2a, @2b, @2a.all, etc.
  const variableRegex = /@(\d+)([a-z])?(\.all)?/gi
  
  return text.replace(variableRegex, (match, numStr, letter, allSuffix) => {
    const blockNum = parseInt(numStr, 10)
    const blockIndex = blockNum - 1 // Les numéros commencent à 1, les index à 0
    const isAllMode = allSuffix === '.all'
    
    // Trouver le bloc correspondant en comptant uniquement les blocs de questions
    let questionCount = 0
    let targetBlock: FormBlock | null = null
    
    for (const block of blocks) {
      // Ignorer uniquement les écrans de fin (thankyou-screen)
      // Le welcome-screen est compté pour que les numéros correspondent au builder
      if (block.type === 'thankyou-screen') continue
      
      questionCount++
      
      if (questionCount === blockNum) {
        targetBlock = block
        break
      }
    }
    
    console.log('[replaceVariables] Target block:', targetBlock?.id, targetBlock?.type, 'isAllMode:', isAllMode)
    
    if (!targetBlock) return match
    
    // Si une lettre est spécifiée, chercher dans les blocs internes
    if (letter && (targetBlock.type === 'group' || targetBlock.type === 'repeater')) {
      const letterIndex = letter.toLowerCase().charCodeAt(0) - 97 // a=0, b=1, c=2...
      const innerBlock = targetBlock.innerBlocks?.[letterIndex]
      
      if (!innerBlock) return match
      
      // Pour les repeaters avec le mode .all, collecter toutes les réponses cumulées
      if (targetBlock.type === 'repeater' && isAllMode) {
        const allAnswers: string[] = []
        const maxRep = currentRepeaterId === targetBlock.id && currentRepetition 
          ? currentRepetition 
          : 10
        
        for (let rep = 1; rep <= maxRep; rep++) {
          const answerKey = `${targetBlock.id}_${rep}_${innerBlock.id}`
          const answer = answers[answerKey]
          if (answer !== undefined && answer !== null && answer !== '') {
            allAnswers.push(formatAnswer(answer))
          }
        }
        
        return allAnswers.length > 0 ? allAnswers.join(', ') : '___'
      }
      
      // Pour les blocs internes du même repeater/groupe, vérifier qu'on ne référence pas un bloc futur
      if (currentRepeaterId === targetBlock.id && currentInnerBlockIndex !== undefined) {
        // On ne peut référencer que les blocs internes précédents (pas le courant ni les suivants)
        if (letterIndex >= currentInnerBlockIndex) {
          return match
        }
      } else if (currentBlockIndex !== undefined && blockIndex >= currentBlockIndex) {
        // Pour les autres blocs, on ne peut pas référencer les blocs futurs
        return match
      }
      
      // Pour les repeaters, chercher la réponse avec différentes clés possibles
      if (targetBlock.type === 'repeater') {
        // Si on est dans le même repeater, utiliser la répétition courante
        if (currentRepeaterId === targetBlock.id && currentRepetition) {
          const answerKey = `${targetBlock.id}_${currentRepetition}_${innerBlock.id}`
          const answer = answers[answerKey]
          if (answer !== undefined && answer !== null && answer !== '') {
            return formatAnswer(answer)
          }
        }
        
        // Sinon, chercher dans toutes les répétitions (de la plus récente à la plus ancienne)
        for (let rep = 10; rep >= 1; rep--) {
          const answerKey = `${targetBlock.id}_${rep}_${innerBlock.id}`
          const answer = answers[answerKey]
          if (answer !== undefined && answer !== null && answer !== '') {
            return formatAnswer(answer)
          }
        }
        return formatAnswer(undefined)
      }
      
      // Pour les groupes, utiliser simplement l'ID du bloc interne
      const answer = answers[innerBlock.id]
      return formatAnswer(answer)
    }
    
    // Ne pas remplacer les variables qui font référence à des questions futures (pour les blocs non-internes)
    if (currentBlockIndex !== undefined && blockIndex >= currentBlockIndex) {
      return match
    }
    
    // Sinon, prendre la réponse du bloc principal
    const answer = answers[targetBlock.id]
    return formatAnswer(answer)
  })
}

/**
 * Formate une réponse pour l'affichage
 */
function formatAnswer(answer: any): string {
  if (answer === undefined || answer === null || answer === '') {
    return '___'
  }
  
  if (Array.isArray(answer)) {
    return answer.join(', ')
  }
  
  if (typeof answer === 'boolean') {
    return answer ? 'Oui' : 'Non'
  }
  
  return String(answer)
}

import type { ThemeProperties, GradientDirection } from '@/types/form'

/**
 * Génère le style CSS de fond en fonction des propriétés du thème
 * Supporte les couleurs unies, les dégradés et les images
 */
export function getBackgroundStyle(themeProps: ThemeProperties): React.CSSProperties {
  const gradientDirectionMap: Record<GradientDirection, string> = {
    'to-right': 'to right',
    'to-left': 'to left',
    'to-bottom': 'to bottom',
    'to-top': 'to top',
    'to-bottom-right': 'to bottom right',
    'to-bottom-left': 'to bottom left',
    'to-top-right': 'to top right',
    'to-top-left': 'to top left',
  }

  if (themeProps.backgroundType === 'gradient') {
    const direction = gradientDirectionMap[themeProps.gradientDirection || 'to-bottom'] || 'to bottom'
    const startColor = themeProps.gradientStartColor || '#667eea'
    const endColor = themeProps.gradientEndColor || '#764ba2'
    const opacity = (themeProps.gradientOpacity ?? 100) / 100
    
    if (opacity < 1) {
      // Avec opacité, on ajoute un overlay blanc
      const overlayOpacity = 1 - opacity
      return {
        background: `linear-gradient(rgba(255,255,255,${overlayOpacity}), rgba(255,255,255,${overlayOpacity})), linear-gradient(${direction}, ${startColor}, ${endColor})`,
      }
    }
    
    return {
      background: `linear-gradient(${direction}, ${startColor}, ${endColor})`,
    }
  }

  if (themeProps.backgroundType === 'image' && themeProps.backgroundImage) {
    const opacity = (themeProps.backgroundImageOpacity ?? 100) / 100
    // Pour l'image avec opacité, on utilise un overlay avec la couleur de fond
    const overlayOpacity = 1 - opacity
    return {
      backgroundImage: `linear-gradient(rgba(255,255,255,${overlayOpacity}), rgba(255,255,255,${overlayOpacity})), url(${themeProps.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  
  return {
    backgroundColor: themeProps.backgroundColor || '#ffffff',
  }
}
