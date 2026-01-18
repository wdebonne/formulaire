import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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
 * Remplace les variables @1, @2, @2a, @2b, etc. dans un texte par les valeurs des réponses
 * - @1 = réponse de la question 1
 * - @2a = réponse du premier bloc interne (a) de la question 2 (groupe/repeater)
 * 
 * @param text - Le texte contenant les variables
 * @param blocks - Les blocs du formulaire
 * @param answers - Les réponses (clé = blockId, valeur = réponse)
 * @param currentBlockIndex - L'index du bloc courant (pour ne remplacer que les questions précédentes)
 */
export function replaceVariables(
  text: string,
  blocks: FormBlock[],
  answers: Record<string, any>,
  currentBlockIndex?: number
): string {
  if (!text) return text
  
  // Regex pour trouver @1, @2, @2a, @2b, etc.
  const variableRegex = /@(\d+)([a-z])?/gi
  
  return text.replace(variableRegex, (match, numStr, letter) => {
    const blockNum = parseInt(numStr, 10)
    const blockIndex = blockNum - 1 // Les numéros commencent à 1, les index à 0
    
    // Ne pas remplacer les variables qui font référence à des questions futures
    if (currentBlockIndex !== undefined && blockIndex >= currentBlockIndex) {
      return match
    }
    
    // Trouver le bloc correspondant en comptant uniquement les blocs de questions
    let questionCount = 0
    let targetBlock: FormBlock | null = null
    
    for (const block of blocks) {
      // Ignorer les écrans d'accueil et de fin
      if (block.type === 'welcome-screen' || block.type === 'thankyou-screen') continue
      
      questionCount++
      
      if (questionCount === blockNum) {
        targetBlock = block
        break
      }
    }
    
    if (!targetBlock) return match
    
    // Si une lettre est spécifiée, chercher dans les blocs internes
    if (letter && (targetBlock.type === 'group' || targetBlock.type === 'repeater')) {
      const letterIndex = letter.toLowerCase().charCodeAt(0) - 97 // a=0, b=1, c=2...
      const innerBlock = targetBlock.innerBlocks?.[letterIndex]
      
      if (!innerBlock) return match
      
      // Pour les repeaters, on prend la première itération par défaut
      const answerKey = targetBlock.type === 'repeater' 
        ? `${targetBlock.id}_1_${innerBlock.id}`
        : innerBlock.id
      
      const answer = answers[answerKey]
      return formatAnswer(answer)
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
