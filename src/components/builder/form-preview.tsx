'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import type { Theme, FormBlock, FormSettings, BlockLogic, LogicCondition } from '@/types/form'
import { ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { replaceVariables, getBackgroundStyle } from '@/lib/utils'

interface FormPreviewProps {
  blocks: FormBlock[]
  settings: FormSettings
  theme: Theme | null
  onClose: () => void
}

// Fonction pour aplatir tous les blocs (y compris les blocs internes des groupes)
const flattenAllBlocks = (blocks: FormBlock[]): FormBlock[] => {
  const result: FormBlock[] = []
  blocks.forEach((block) => {
    result.push(block)
    if (block.type === 'group' && block.innerBlocks) {
      result.push(...block.innerBlocks)
    }
  })
  return result
}

// Fonction pour évaluer une condition
const evaluateCondition = (condition: LogicCondition, answers: Record<string, any>, blocks: FormBlock[]): boolean => {
  // Aplatir les blocs pour inclure les blocs internes des groupes
  const allBlocks = flattenAllBlocks(blocks)
  
  const answer = answers[condition.blockId]
  const block = allBlocks.find(b => b.id === condition.blockId)
  
  console.log(`  Condition: blockId=${condition.blockId}, operator=${condition.operator}, value=${condition.value}`)
  console.log(`  Answer found:`, answer)
  console.log(`  Block found:`, block?.attributes.label)
  
  if (answer === undefined || answer === null) {
    console.log(`  -> Answer is undefined/null`)
    // Pas de réponse
    if (condition.operator === 'is_empty') {
      console.log(`  -> is_empty = TRUE (no answer)`)
      return true
    }
    if (condition.operator === 'is_not_empty') return false
    return false
  }
  
  // Pour les blocs avec des choix (multiple-choice, dropdown), convertir la valeur en label
  let answerValue = answer
  
  if (block?.attributes.choices && block.attributes.choices.length > 0) {
    if (Array.isArray(answer)) {
      // Sélection multiple - convertir chaque valeur en label
      answerValue = answer.map(val => {
        const choice = block.attributes.choices?.find(c => 
          c.value === val || 
          c.id === val || 
          c.label === val ||
          c.value?.toLowerCase() === String(val).toLowerCase() ||
          c.label?.toLowerCase() === String(val).toLowerCase()
        )
        return choice?.label || val
      })
    } else {
      // Sélection simple - convertir la valeur en label
      const choice = block.attributes.choices.find(c => 
        c.value === answer || 
        c.id === answer || 
        c.label === answer ||
        c.value?.toLowerCase() === String(answer).toLowerCase() ||
        c.label?.toLowerCase() === String(answer).toLowerCase()
      )
      answerValue = choice?.label || answer
    }
  }
  
  const conditionValue = condition.value

  switch (condition.operator) {
    case 'equals':
      if (Array.isArray(answerValue)) {
        // Pour les tableaux, vérifier si une des valeurs correspond
        return answerValue.some(v => String(v).toLowerCase() === String(conditionValue).toLowerCase())
      }
      return String(answerValue).toLowerCase() === String(conditionValue).toLowerCase()
    case 'not_equals':
      if (Array.isArray(answerValue)) {
        return !answerValue.some(v => String(v).toLowerCase() === String(conditionValue).toLowerCase())
      }
      return String(answerValue).toLowerCase() !== String(conditionValue).toLowerCase()
    case 'contains':
      if (Array.isArray(answerValue)) {
        return answerValue.some(v => String(v).toLowerCase().includes(String(conditionValue).toLowerCase()))
      }
      return String(answerValue).toLowerCase().includes(String(conditionValue).toLowerCase())
    case 'not_contains':
      if (Array.isArray(answerValue)) {
        return !answerValue.some(v => String(v).toLowerCase().includes(String(conditionValue).toLowerCase()))
      }
      return !String(answerValue).toLowerCase().includes(String(conditionValue).toLowerCase())
    case 'greater_than':
      return Number(answerValue) > Number(conditionValue)
    case 'less_than':
      return Number(answerValue) < Number(conditionValue)
    case 'is_empty':
      return !answerValue || answerValue === '' || (Array.isArray(answerValue) && answerValue.length === 0)
    case 'is_not_empty':
      return answerValue && answerValue !== '' && !(Array.isArray(answerValue) && answerValue.length === 0)
    default:
      return false
  }
}

// Fonction pour évaluer toutes les conditions d'une règle
const evaluateRule = (rule: BlockLogic['rules'][0], answers: Record<string, any>, blocks: FormBlock[]): boolean => {
  const results = rule.conditions.map(condition => evaluateCondition(condition, answers, blocks))
  
  if (rule.conditionMatch === 'all') {
    return results.every(r => r)
  } else {
    return results.some(r => r)
  }
}

// Helper pour extraire l'ID YouTube
const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

export function FormPreview({ blocks, settings, theme, onClose }: FormPreviewProps) {
  const { logic } = useFormBuilder()
  // Protection contre logic non-array
  const safeLogic = Array.isArray(logic) ? logic : []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [answeredBlockIds, setAnsweredBlockIds] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [previousVisibleIds, setPreviousVisibleIds] = useState<string[]>([])
  const [newlyVisibleIds, setNewlyVisibleIds] = useState<Set<string>>(new Set())
  
  // État pour les blocs répétables
  const [repeaterIterations, setRepeaterIterations] = useState<Record<string, number>>({}) // repeaterId -> nombre d'itérations
  const [repeaterCurrentIteration, setRepeaterCurrentIteration] = useState<Record<string, number>>({}) // repeaterId -> itération actuelle
  const [repeaterAnsweredBlocks, setRepeaterAnsweredBlocks] = useState<Record<string, Set<string>>>({}) // repeaterId -> Set des blocs répondus pour l'itération actuelle
  const [showRepeatQuestion, setShowRepeatQuestion] = useState<string | null>(null) // repeaterId si on affiche la question de répétition
  const [showInitialQuestion, setShowInitialQuestion] = useState<Record<string, boolean>>({}) // repeaterId -> true si on doit montrer la question initiale
  const [repeaterActive, setRepeaterActive] = useState<Record<string, boolean>>({}) // repeaterId -> true si le repeater a été activé (répondu Oui à la question initiale)

  const themeProps = theme?.properties || {
    backgroundColor: '#ffffff',
    questionsColor: '#000000',
    answersColor: '#4a4a4a',
    buttonsBgColor: '#7c3aed',
    buttonsFontColor: '#ffffff',
    font: 'Inter',
    buttonsBorderRadius: 'medium' as const,
    inputBorderRadius: 'medium' as const,
    inputStyle: 'outlined' as const,
  }

  // Convertir les valeurs de borderRadius en pixels CSS
  const borderRadiusMap: Record<string, string> = {
    none: '0',
    small: '4px',
    medium: '8px',
    large: '12px',
    full: '9999px',
  }

  const buttonBorderRadius = borderRadiusMap[themeProps.buttonsBorderRadius || 'medium'] || '8px'
  const inputBorderRadius = borderRadiusMap[themeProps.inputBorderRadius || 'medium'] || '8px'

  // Helper pour générer les styles des inputs selon le thème
  const getInputStyle = () => {
    const baseStyle: React.CSSProperties = {
      color: themeProps.answersColor,
      borderRadius: inputBorderRadius,
    }
    
    switch (themeProps.inputStyle) {
      case 'underline':
        return {
          ...baseStyle,
          border: 'none',
          borderBottom: `2px solid ${themeProps.answersColor}40`,
          borderRadius: '0',
          backgroundColor: 'transparent',
        }
      case 'filled':
        return {
          ...baseStyle,
          border: 'none',
          backgroundColor: `${themeProps.answersColor}10`,
        }
      default: // 'outlined'
        return {
          ...baseStyle,
          borderColor: `${themeProps.answersColor}40`,
        }
    }
  }

  const inputStyle = getInputStyle()

  // Créer une structure qui garde trace des groupes/repeaters et de leurs blocs
  // Format: { blockId: { parentId, parentType } | null }
  const blockToParentMap = useMemo(() => {
    const map: Record<string, { parentId: string; parentType: 'group' | 'repeater' } | null> = {}
    blocks.forEach((block) => {
      if ((block.type === 'group' || block.type === 'repeater') && block.innerBlocks) {
        block.innerBlocks.forEach(innerBlock => {
          map[innerBlock.id] = { parentId: block.id, parentType: block.type as 'group' | 'repeater' }
        })
      } else {
        map[block.id] = null
      }
    })
    return map
  }, [blocks])

  // Pour la compatibilité avec le code existant
  const blockToGroupMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    Object.entries(blockToParentMap).forEach(([blockId, parent]) => {
      map[blockId] = parent?.parentType === 'group' ? parent.parentId : null
    })
    return map
  }, [blockToParentMap])

  // Filter only question blocks (exclude thank you screens) and flatten groups (but keep repeaters as-is)
  const allQuestionBlocks = useMemo(() => {
    const result: FormBlock[] = []
    blocks.forEach((block) => {
      if (block.type === 'thankyou-screen') return
      
      if (block.type === 'group' && block.innerBlocks && block.innerBlocks.length > 0) {
        // Ajouter les blocs internes du groupe au lieu du groupe lui-même
        result.push(...block.innerBlocks)
      } else if (block.type === 'repeater') {
        // Garder le bloc repeater lui-même (sera traité spécialement)
        result.push(block)
      } else if (block.type !== 'group') {
        result.push(block)
      }
    })
    return result
  }, [blocks])
  
  // Calculer les blocs visibles en fonction de la logique conditionnelle
  const visibleBlocks = useMemo(() => {
    return allQuestionBlocks.filter((block) => {
      // Trouver les règles de logique pour ce bloc
      const blockLogic = safeLogic.find(l => l.blockId === block.id)
      
      if (!blockLogic || blockLogic.rules.length === 0) {
        // Pas de règle = toujours visible
        return true
      }
      
      // Chercher des règles "hide" ou "show"
      for (const rule of blockLogic.rules) {
        const conditionsMet = evaluateRule(rule, answers, blocks)
        
        if (rule.action === 'hide' && conditionsMet) {
          return false
        }
        
        if (rule.action === 'show') {
          return conditionsMet
        }
      }
      
      // Par défaut, le bloc est visible
      return true
    })
  }, [allQuestionBlocks, safeLogic, answers, blocks])

  // Le bloc courant (mode classique)
  const currentBlock = visibleBlocks[currentIndex]
  
  // Vérifier si le bloc courant fait partie d'un groupe
  const currentGroupId = currentBlock ? blockToGroupMap[currentBlock.id] : null
  const isInGroupMode = currentGroupId !== null

  // Vérifier si le bloc courant est un repeater
  const isInRepeaterMode = currentBlock?.type === 'repeater'
  const currentRepeaterId = isInRepeaterMode ? currentBlock.id : null
  
  // Vérifier si on doit montrer la question initiale pour ce repeater
  const shouldShowInitialQuestion = isInRepeaterMode && currentRepeaterId && 
    !repeaterActive[currentRepeaterId] && 
    showInitialQuestion[currentRepeaterId] !== false

  // Si on est en mode groupe, obtenir tous les blocs du même groupe
  const currentGroupBlocks = useMemo(() => {
    if (!isInGroupMode || !currentGroupId) return []
    return visibleBlocks.filter(b => blockToGroupMap[b.id] === currentGroupId)
  }, [visibleBlocks, currentGroupId, isInGroupMode, blockToGroupMap])

  // Pour le mode groupe: blocs à afficher (répondus + premier non répondu)
  const displayedGroupBlocks = useMemo(() => {
    if (!isInGroupMode) return []
    
    const result: FormBlock[] = []
    let foundFirstUnanswered = false
    
    for (const block of currentGroupBlocks) {
      if (answeredBlockIds.has(block.id)) {
        result.push(block)
        continue
      }
      
      if (!foundFirstUnanswered) {
        result.push(block)
        foundFirstUnanswered = true
      }
    }
    
    return result
  }, [currentGroupBlocks, answeredBlockIds, isInGroupMode])

  // Pour le mode repeater: blocs à afficher pour l'itération actuelle
  const currentRepeaterBlocks = useMemo(() => {
    if (!isInRepeaterMode || !currentBlock?.innerBlocks) return []
    return currentBlock.innerBlocks
  }, [isInRepeaterMode, currentBlock])

  const currentRepeaterIteration = currentRepeaterId ? (repeaterCurrentIteration[currentRepeaterId] || 1) : 1
  const repeaterAnswered = currentRepeaterId ? (repeaterAnsweredBlocks[currentRepeaterId] || new Set<string>()) : new Set<string>()

  const displayedRepeaterBlocks = useMemo(() => {
    if (!isInRepeaterMode) return []
    
    const result: FormBlock[] = []
    let foundFirstUnanswered = false
    
    for (const block of currentRepeaterBlocks) {
      const answerKey = `${block.id}_${currentRepeaterIteration}`
      if (repeaterAnswered.has(answerKey)) {
        result.push(block)
        continue
      }
      
      if (!foundFirstUnanswered) {
        result.push(block)
        foundFirstUnanswered = true
      }
    }
    
    return result
  }, [currentRepeaterBlocks, repeaterAnswered, isInRepeaterMode, currentRepeaterIteration])

  // Détecter les nouveaux blocs qui apparaissent pour les animer (mode groupe ou repeater)
  useEffect(() => {
    if (!isInGroupMode && !isInRepeaterMode) return
    
    const blocksToCheck = isInGroupMode ? displayedGroupBlocks : displayedRepeaterBlocks
    const currentIds = blocksToCheck.map(b => isInRepeaterMode ? `${b.id}_${currentRepeaterIteration}` : b.id)
    const newIds = currentIds.filter(id => !previousVisibleIds.includes(id))
    
    if (newIds.length > 0) {
      setNewlyVisibleIds(new Set(newIds))
      
      setTimeout(() => {
        const lastNewId = newIds[newIds.length - 1]
        const blockId = isInRepeaterMode ? lastNewId.split('_')[0] : lastNewId
        const element = blockRefs.current[blockId]
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      
      setTimeout(() => {
        setNewlyVisibleIds(new Set())
      }, 600)
    }
    
    setPreviousVisibleIds(currentIds)
  }, [displayedGroupBlocks, displayedRepeaterBlocks, isInGroupMode, isInRepeaterMode, currentRepeaterIteration])

  // Réinitialiser l'index si nécessaire
  useEffect(() => {
    if (currentIndex >= visibleBlocks.length && visibleBlocks.length > 0) {
      setCurrentIndex(visibleBlocks.length - 1)
    }
  }, [visibleBlocks.length, currentIndex])

  // Navigation
  const goToNext = () => {
    if (currentIndex < visibleBlocks.length - 1 && !isAnimating) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        setIsAnimating(false)
      }, 300)
    }
  }

  const goToPrev = () => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1)
        setIsAnimating(false)
      }, 300)
    }
  }

  // Passer au groupe/bloc suivant après avoir terminé un groupe
  const goToNextAfterGroup = () => {
    if (!currentGroupId) return
    
    // Trouver le dernier bloc du groupe actuel
    const lastGroupBlockIndex = visibleBlocks.findIndex((b, idx) => {
      const nextBlock = visibleBlocks[idx + 1]
      return blockToGroupMap[b.id] === currentGroupId && 
             (!nextBlock || blockToGroupMap[nextBlock.id] !== currentGroupId)
    })
    
    if (lastGroupBlockIndex !== -1 && lastGroupBlockIndex < visibleBlocks.length - 1) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(lastGroupBlockIndex + 1)
        setIsAnimating(false)
        // Reset les blocs répondus du groupe
        setAnsweredBlockIds(new Set())
        setPreviousVisibleIds([])
      }, 300)
    }
  }

  // Fonctions pour le repeater
  const handleRepeaterAnswer = (blockId: string, value: any) => {
    if (!currentRepeaterId) return
    const answerKey = `${currentRepeaterId}_${currentRepeaterIteration}_${blockId}`
    setAnswers(prev => ({ ...prev, [answerKey]: value }))
  }

  const handleRepeaterBlockNext = (blockId: string) => {
    if (!currentRepeaterId) return
    
    const answerKey = `${blockId}_${currentRepeaterIteration}`
    setRepeaterAnsweredBlocks(prev => {
      const current = prev[currentRepeaterId] || new Set<string>()
      return {
        ...prev,
        [currentRepeaterId]: new Set(Array.from(current).concat(answerKey))
      }
    })
    
    // Vérifier si tous les blocs de l'itération sont répondus
    const allAnswered = currentRepeaterBlocks.every(b => {
      const key = `${b.id}_${currentRepeaterIteration}`
      return repeaterAnswered.has(key) || b.id === blockId
    })
    
    if (allAnswered) {
      // Afficher la question de répétition
      setShowRepeatQuestion(currentRepeaterId)
    }
  }

  const handleRepeatYes = () => {
    if (!currentRepeaterId || !currentBlock) return
    
    const maxReps = currentBlock.attributes.maxRepetitions || 10
    const nextIteration = currentRepeaterIteration + 1
    
    if (nextIteration <= maxReps) {
      setRepeaterCurrentIteration(prev => ({
        ...prev,
        [currentRepeaterId]: nextIteration
      }))
      setRepeaterIterations(prev => ({
        ...prev,
        [currentRepeaterId]: nextIteration
      }))
      // Reset les blocs répondus pour la nouvelle itération
      setRepeaterAnsweredBlocks(prev => ({
        ...prev,
        [currentRepeaterId]: new Set<string>()
      }))
      setPreviousVisibleIds([])
    }
    setShowRepeatQuestion(null)
  }

  const handleRepeatNo = () => {
    setShowRepeatQuestion(null)
    goToNext()
  }

  // Gestionnaires pour la question initiale du repeater
  const handleInitialYes = () => {
    if (!currentRepeaterId) return
    
    // Activer le repeater
    setRepeaterActive(prev => ({
      ...prev,
      [currentRepeaterId]: true
    }))
    // Initialiser l'itération
    setRepeaterCurrentIteration(prev => ({
      ...prev,
      [currentRepeaterId]: 1
    }))
    setRepeaterIterations(prev => ({
      ...prev,
      [currentRepeaterId]: 1
    }))
    setRepeaterAnsweredBlocks(prev => ({
      ...prev,
      [currentRepeaterId]: new Set<string>()
    }))
  }

  const handleInitialNo = () => {
    if (!currentRepeaterId) return
    
    // Marquer comme non actif et passer au bloc suivant
    setShowInitialQuestion(prev => ({
      ...prev,
      [currentRepeaterId]: false
    }))
    goToNext()
  }

  const progress = visibleBlocks.length > 0 ? ((currentIndex + 1) / visibleBlocks.length) * 100 : 0

  if (blocks.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ ...getBackgroundStyle(themeProps) }}>
        <div className="p-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fermer l'aperçu
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Ajoutez des blocs pour voir l'aperçu</p>
        </div>
      </div>
    )
  }

  // Vérifier si on doit utiliser un layout split
  const hasSplitLayout = currentBlock && 
    (currentBlock.type === 'welcome-screen' || currentBlock.type === 'thankyou-screen') &&
    currentBlock.attributes.showAttachment &&
    (currentBlock.attributes.attachmentLayout === 'split-left' || currentBlock.attributes.attachmentLayout === 'split-right')

  // Rendu avec layout split pour welcome/thankyou screen dans le preview
  if (hasSplitLayout && currentBlock) {
    const layout = currentBlock.attributes.attachmentLayout
    const attachmentUrl = currentBlock.attributes.attachmentUrl
    const attachmentType = currentBlock.attributes.attachmentType || 'image'
    const focalPoint = currentBlock.attributes.focalPoint || { x: 50, y: 50 }
    const isImageOnLeft = layout === 'split-left'

    const contentSection = (
      <div className="w-full md:w-1/2 min-h-screen flex flex-col">
        {/* Logo */}
        {settings.logo && (
          <div className="p-4">
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="h-8 object-contain"
            />
          </div>
        )}
        
        {/* Contenu centré */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className={`max-w-md w-full transition-all duration-300 ${
            isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}>
            <PreviewBlock
              block={currentBlock}
              index={currentIndex}
              showNumber={false}
              showLetters={settings.lettersOnAnswers !== false}
              themeProps={themeProps}
              answer={answers[currentBlock.id]}
              onAnswer={(value) => setAnswers({ ...answers, [currentBlock.id]: value })}
              onNext={goToNext}
              allBlocks={blocks}
              allAnswers={answers}
              inputStyle={inputStyle}
              buttonBorderRadius={buttonBorderRadius}
            />
          </div>
        </div>
        
        {/* Footer */}
        {(settings.showBranding ?? true) && (
          <div className="p-4 text-center">
            <span className="text-xs" style={{ color: themeProps.answersColor + '80' }}>
              propulsé par <span className="font-semibold">{settings.brandingText || 'FormBuilder'}</span>
            </span>
          </div>
        )}
      </div>
    )

    const attachmentSection = (
      <div className="hidden md:block w-1/2 min-h-screen relative">
        {attachmentType === 'image' && attachmentUrl && (
          <img
            src={attachmentUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          />
        )}
        {attachmentType === 'video' && attachmentUrl && (
          <iframe
            src={`https://www.youtube.com/embed/${getYouTubeVideoId(attachmentUrl)}?autoplay=0`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    )

    return (
      <div
        className="fixed inset-0 z-50 flex flex-row transition-colors duration-300"
        style={{
          ...getBackgroundStyle(themeProps),
          fontFamily: themeProps.font || 'Inter',
        }}
      >
        {/* Close button */}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fermer l'aperçu
          </Button>
        </div>
        
        {isImageOnLeft ? (
          <>
            {attachmentSection}
            {contentSection}
          </>
        ) : (
          <>
            {contentSection}
            {attachmentSection}
          </>
        )}
      </div>
    )
  }

  const progressBarPosition = settings.progressBarPosition ?? 'top'
  const progressBarSize = settings.progressBarSize ?? 'small'
  const showProgressBar = (settings.showProgressBar ?? true) && visibleBlocks.length > 0 && currentBlock?.type !== 'welcome-screen'
  const isVerticalBar = progressBarPosition === 'left' || progressBarPosition === 'right'

  // Tailles de la barre de progression
  const barSizes = {
    small: isVerticalBar ? 'w-1' : 'h-1',
    medium: isVerticalBar ? 'w-2' : 'h-2',
    large: isVerticalBar ? 'w-3' : 'h-3',
  }
  const barPadding = {
    small: '4px',
    medium: '8px',
    large: '12px',
  }

  const renderProgressBar = () => {
    if (!showProgressBar) return null

    if (isVerticalBar) {
      return (
        <div 
          className={`${barSizes[progressBarSize]} bg-gray-200 h-full`}
          style={{ 
            position: 'absolute',
            [progressBarPosition]: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <div
            className="w-full transition-all duration-300"
            style={{ 
              height: `${progress}%`, 
              backgroundColor: themeProps.buttonsBgColor,
              position: 'absolute',
              bottom: 0,
            }}
          />
        </div>
      )
    }

    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col transition-colors duration-300"
      style={{
        ...getBackgroundStyle(themeProps),
        fontFamily: themeProps.font || 'Inter',
        paddingLeft: progressBarPosition === 'left' && showProgressBar ? barPadding[progressBarSize] : 0,
        paddingRight: progressBarPosition === 'right' && showProgressBar ? barPadding[progressBarSize] : 0,
      }}
    >
      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Fermer l'aperçu
        </Button>
      </div>

      {/* Progress bar - Left/Right */}
      {renderProgressBar()}

      {/* Progress bar - Top */}
      {showProgressBar && progressBarPosition === 'top' && (
        <div className={`${barSizes[progressBarSize]} bg-gray-200 w-full shrink-0`}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
          />
        </div>
      )}

      {/* Question area */}
      {isInRepeaterMode && shouldShowInitialQuestion ? (
        // Question initiale du repeater
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl w-full text-center space-y-6 animate-slide-in">
            <h2 
              className="text-2xl md:text-3xl font-semibold leading-tight"
              style={{ color: themeProps.questionsColor }}
            >
              {currentBlock?.attributes.initialQuestion || currentBlock?.attributes.label || 'Voulez-vous ajouter un élément ?'}
            </h2>
            
            {currentBlock?.attributes.description && (
              <p 
                className="text-lg opacity-80"
                style={{ color: themeProps.answersColor }}
              >
                {currentBlock.attributes.description}
              </p>
            )}
            
            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={handleInitialYes}
                className="px-8 py-3 font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {currentBlock?.attributes.initialYesLabel || 'Oui'}
              </button>
              <button
                onClick={handleInitialNo}
                className="px-8 py-3 font-medium transition-all hover:scale-105 border-2"
                style={{
                  borderColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsBgColor,
                  backgroundColor: 'transparent',
                  borderRadius: buttonBorderRadius,
                }}
              >
                {currentBlock?.attributes.initialNoLabel || 'Non'}
              </button>
            </div>
          </div>
        </div>
      ) : isInRepeaterMode ? (
        // Mode répéteur (questions en boucle)
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8"
        >
          <div className="max-w-xl mx-auto space-y-8 pb-32">
            {/* Indicateur d'itération */}
            <div 
              className="text-center mb-4 px-4 py-2 rounded-full inline-block mx-auto"
              style={{ 
                backgroundColor: `${themeProps.buttonsBgColor}20`,
                color: themeProps.questionsColor 
              }}
            >
              <span className="font-medium">
                Élément #{currentRepeaterIteration}
              </span>
            </div>

            {/* Afficher les blocs du repeater */}
            {!showRepeatQuestion ? (
              displayedRepeaterBlocks.map((block, idx) => {
                const answerKey = `${block.id}_${currentRepeaterIteration}`
                const isNewlyVisible = newlyVisibleIds.has(answerKey)
                const isAnswered = repeaterAnswered.has(answerKey)
                const fullAnswerKey = `${currentRepeaterId}_${currentRepeaterIteration}_${block.id}`
                
                return (
                  <div
                    key={`${block.id}_${currentRepeaterIteration}`}
                    ref={(el) => { blockRefs.current[block.id] = el }}
                    className={`transition-all duration-500 ${
                      isNewlyVisible ? 'animate-slide-in' : ''
                    } ${isAnswered ? 'opacity-60' : ''}`}
                  >
                    <PreviewBlock
                      block={block}
                      index={idx}
                      showNumber={settings.showQuestionNumbers !== false}
                      showLetters={settings.lettersOnAnswers !== false}
                      themeProps={themeProps}
                      answer={answers[fullAnswerKey]}
                      onAnswer={(value) => handleRepeaterAnswer(block.id, value)}
                      onNext={() => handleRepeaterBlockNext(block.id)}
                      allBlocks={blocks}
                      allAnswers={answers}
                      inputStyle={inputStyle}
                      buttonBorderRadius={buttonBorderRadius}
                    />
                  </div>
                )
              })
            ) : (
              /* Question de répétition */
              <div 
                className="text-center space-y-6 py-8 animate-slide-in"
              >
                <h2 
                  className="text-2xl font-semibold"
                  style={{ color: themeProps.questionsColor }}
                >
                  {currentBlock?.attributes.repeatQuestion || 'Voulez-vous ajouter un autre élément ?'}
                </h2>
                
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleRepeatYes}
                    className="px-8 py-3 font-medium transition-all hover:scale-105"
                    style={{
                      backgroundColor: themeProps.buttonsBgColor,
                      color: themeProps.buttonsFontColor,
                      borderRadius: buttonBorderRadius,
                    }}
                  >
                    {currentBlock?.attributes.repeatYesLabel || 'Oui, ajouter'}
                  </button>
                  <button
                    onClick={handleRepeatNo}
                    className="px-8 py-3 font-medium transition-all hover:scale-105 border-2"
                    style={{
                      borderColor: themeProps.buttonsBgColor,
                      color: themeProps.buttonsBgColor,
                      backgroundColor: 'transparent',
                      borderRadius: buttonBorderRadius,
                    }}
                  >
                    {currentBlock?.attributes.repeatNoLabel || 'Non, continuer'}
                  </button>
                </div>
                
                {(repeaterIterations[currentRepeaterId!] || 1) > 1 && (
                  <p 
                    className="text-sm opacity-70"
                    style={{ color: themeProps.answersColor }}
                  >
                    {repeaterIterations[currentRepeaterId!] || 1} élément(s) ajouté(s)
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : isInGroupMode ? (
        // Mode conversationnel pour les groupes
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8"
        >
          <div className="max-w-xl mx-auto space-y-8 pb-32">
            {displayedGroupBlocks.map((block, idx) => {
              const isNewlyVisible = newlyVisibleIds.has(block.id)
              const isAnswered = answeredBlockIds.has(block.id)
              const isLastInGroup = idx === currentGroupBlocks.length - 1 && 
                                    displayedGroupBlocks.length === currentGroupBlocks.length
              
              return (
                <div
                  key={block.id}
                  ref={(el) => { blockRefs.current[block.id] = el }}
                  className={`transition-all duration-500 ${
                    isNewlyVisible ? 'animate-slide-in' : ''
                  } ${isAnswered ? 'opacity-60' : ''}`}
                >
                  <PreviewBlock
                    block={block}
                    index={idx}
                    showNumber={settings.showQuestionNumbers !== false}
                    showLetters={settings.lettersOnAnswers !== false}
                    themeProps={themeProps}
                    answer={answers[block.id]}
                    onAnswer={(value) => {
                      setAnswers({ ...answers, [block.id]: value })
                    }}
                    onNext={() => {
                      // Marquer ce bloc comme répondu
                      setAnsweredBlockIds(prev => new Set(Array.from(prev).concat(block.id)))
                      
                      // Si c'est le dernier bloc visible du groupe et tous sont répondus
                      // Passer au bloc/groupe suivant
                      const allGroupAnswered = currentGroupBlocks.every(b => 
                        answeredBlockIds.has(b.id) || b.id === block.id
                      )
                      if (allGroupAnswered) {
                        goToNextAfterGroup()
                      }
                    }}
                    allBlocks={blocks}
                    allAnswers={answers}
                    inputStyle={inputStyle}
                    buttonBorderRadius={buttonBorderRadius}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // Mode classique (une question à la fois)
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className={`max-w-xl w-full transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
          >
            {currentBlock && (
              <PreviewBlock
                block={currentBlock}
                index={currentIndex}
                showNumber={settings.showQuestionNumbers !== false}
                showLetters={settings.lettersOnAnswers !== false}
                themeProps={themeProps}
                answer={answers[currentBlock.id]}
                onAnswer={(value) => setAnswers({ ...answers, [currentBlock.id]: value })}
                onNext={goToNext}
                allBlocks={blocks}
                allAnswers={answers}
                inputStyle={inputStyle}
                buttonBorderRadius={buttonBorderRadius}
              />
            )}
          </div>
        </div>
      )}

      {/* Progress bar - Bottom */}
      {showProgressBar && progressBarPosition === 'bottom' && (
        <div className={`${barSizes[progressBarSize]} bg-gray-200 w-full shrink-0`}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="p-4 flex justify-between items-center shrink-0">
        {!isInGroupMode && !isInRepeaterMode ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
              style={{ color: themeProps.questionsColor }}
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === visibleBlocks.length - 1}
              className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 transition-colors"
              style={{ color: themeProps.questionsColor }}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div /> 
        )}
        <div className="flex items-center gap-4">
          {(settings.showBranding ?? true) && (
            <span className="text-sm opacity-50" style={{ color: themeProps.answersColor }}>
              propulsé par <span className="font-semibold">{settings.brandingText || 'FormBuilder'}</span>
            </span>
          )}
          {(settings.showQuestionCounter ?? true) && (
            <span className="text-sm" style={{ color: themeProps.answersColor }}>
              {currentIndex + 1} / {visibleBlocks.length}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface PreviewBlockProps {
  block: FormBlock
  index: number
  showNumber: boolean
  showLetters: boolean
  themeProps: any
  answer: any
  onAnswer: (value: any) => void
  onNext: () => void
  allBlocks: FormBlock[]
  allAnswers: Record<string, any>
  inputStyle?: React.CSSProperties
  buttonBorderRadius?: string
}

function PreviewBlock({
  block,
  index,
  showNumber,
  showLetters,
  themeProps,
  answer,
  onAnswer,
  onNext,
  allBlocks,
  allAnswers,
  inputStyle = {},
  buttonBorderRadius = '8px',
}: PreviewBlockProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const renderInput = () => {
    switch (block.type) {
      case 'welcome-screen':
        return (
          <div className="mt-6">
            {block.attributes.buttonText && (
              <button
                onClick={onNext}
                className="px-6 py-3 font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {block.attributes.buttonText || 'Commencer'}
              </button>
            )}
          </div>
        )

      case 'short-text':
      case 'email':
      case 'number':
      case 'website':
        return (
          <input
            type={block.type === 'email' ? 'email' : block.type === 'number' ? 'number' : 'text'}
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onNext()}
            className="mt-4 w-full bg-transparent border-b-2 py-2 text-lg outline-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'long-text':
        return (
          <textarea
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            rows={4}
            className="mt-4 w-full bg-transparent border-2 py-2 px-3 text-lg outline-none resize-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'multiple-choice':
        const mcChoices = block.attributes.choices || []
        const allowMultiple = block.attributes.allowMultiple || false
        return (
          <div className="mt-4 space-y-2">
            {mcChoices.map((choice: any, idx: number) => {
              const isSelected = allowMultiple
                ? (answer || []).includes(choice.value)
                : answer === choice.value

              return (
                <button
                  key={choice.value}
                  onClick={() => {
                    if (allowMultiple) {
                      const current = answer || []
                      if (isSelected) {
                        onAnswer(current.filter((v: string) => v !== choice.value))
                      } else {
                        onAnswer([...current, choice.value])
                      }
                    } else {
                      onAnswer(choice.value)
                      setTimeout(onNext, 300)
                    }
                  }}
                  className="w-full flex items-center px-4 py-3 rounded-md border-2 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
                    backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                  }}
                >
                  {showLetters ? (
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-sm font-medium mr-3"
                      style={{
                        backgroundColor: isSelected
                          ? themeProps.buttonsBgColor
                          : themeProps.answersColor + '20',
                        color: isSelected ? themeProps.buttonsFontColor : themeProps.answersColor,
                      }}
                    >
                      {isSelected ? <Check className="w-4 h-4" /> : letters[idx]}
                    </span>
                  ) : (
                    <span
                      className="w-5 h-5 rounded border-2 flex items-center justify-center mr-3"
                      style={{
                        borderColor: isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '40',
                        backgroundColor: isSelected ? themeProps.buttonsBgColor : 'transparent',
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3" style={{ color: themeProps.buttonsFontColor }} />}
                    </span>
                  )}
                  <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
                </button>
              )
            })}
            {allowMultiple && (
              <>
                <p className="text-xs opacity-60 mt-2" style={{ color: themeProps.answersColor }}>
                  Vous pouvez sélectionner plusieurs options
                </p>
                <button
                  onClick={onNext}
                  disabled={!answer || (Array.isArray(answer) && answer.length === 0)}
                  className="mt-4 px-6 py-2 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                  }}
                >
                  OK
                  <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
                </button>
              </>
            )}
          </div>
        )

      case 'dropdown':
        const ddChoices = block.attributes.choices || []
        return (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                list={`dropdown-preview-${block.id}`}
                placeholder="Tapez pour rechercher ou ajouter..."
                value={answer || ''}
                onChange={(e) => onAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onNext()}
                className="flex-1 px-4 py-3 border-2 text-base outline-none transition-colors focus:border-opacity-100"
                style={{
                  borderColor: themeProps.answersColor + '30',
                  backgroundColor: 'transparent',
                  color: themeProps.answersColor,
                  ...inputStyle,
                }}
              />
              {answer && (
                <button
                  onClick={onNext}
                  className="px-4 py-3 font-medium transition-colors hover:opacity-90"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
                  }}
                >
                  OK
                </button>
              )}
            </div>
            <datalist id={`dropdown-preview-${block.id}`}>
              {ddChoices.map((choice: any, idx: number) => (
                <option key={choice.id || idx} value={choice.label} />
              ))}
            </datalist>
            <p className="mt-2 text-xs opacity-60" style={{ color: themeProps.answersColor }}>
              Sélectionnez une option ou entrez votre propre réponse
            </p>
          </div>
        )

      case 'date':
        return (
          <input
            type="date"
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            className="mt-4 bg-transparent border-2 py-2 px-3 text-lg outline-none"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'advanced-date':
        // Calculer les dates min/max en fonction de la configuration (version preview)
        const getPreviewDate = (
          dateType: string | undefined,
          specificDate: string | undefined,
          blockId: string | undefined,
          offset: number | undefined
        ): string | undefined => {
          if (!dateType || dateType === 'none') return undefined
          
          let baseDate: Date | null = null
          
          if (dateType === 'today') {
            baseDate = new Date()
          } else if (dateType === 'specific' && specificDate) {
            return specificDate
          } else if (dateType === 'block' && blockId) {
            const blockValue = allAnswers[blockId]
            if (blockValue) {
              baseDate = new Date(blockValue)
            }
          }
          
          if (baseDate && !isNaN(baseDate.getTime())) {
            if (offset) {
              baseDate.setDate(baseDate.getDate() + offset)
            }
            return baseDate.toISOString().split('T')[0]
          }
          
          return undefined
        }
        
        const previewMinDate = getPreviewDate(
          block.attributes.minDateType,
          block.attributes.minDate,
          block.attributes.minDateBlockId,
          block.attributes.minDateOffset
        )
        
        const previewMaxDate = getPreviewDate(
          block.attributes.maxDateType,
          block.attributes.maxDate,
          block.attributes.maxDateBlockId,
          block.attributes.maxDateOffset
        )
        
        return (
          <PreviewDateCalendar
            value={answer}
            onChange={onAnswer}
            minDate={previewMinDate}
            maxDate={previewMaxDate}
            themeProps={themeProps}
            isDateRange={block.attributes.isDateRange}
            startDateLabel={block.attributes.startDateLabel}
            endDateLabel={block.attributes.endDateLabel}
          />
        )

      case 'slider':
        const min = block.attributes.min || 0
        const max = block.attributes.max || 100
        const step = block.attributes.step || 1
        return (
          <div className="mt-6">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={answer || min}
              onChange={(e) => onAnswer(Number(e.target.value))}
              className="w-full accent-primary"
              style={{ accentColor: themeProps.buttonsBgColor }}
            />
            <div className="flex justify-between mt-2 text-sm" style={{ color: themeProps.answersColor }}>
              <span>{min}</span>
              <span className="font-medium text-lg">{answer || min}</span>
              <span>{max}</span>
            </div>
          </div>
        )

      case 'legal':
        return (
          <div className="mt-4">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={answer || false}
                onChange={(e) => {
                  onAnswer(e.target.checked)
                  if (e.target.checked) setTimeout(onNext, 300)
                }}
                className="mt-1 mr-3 w-5 h-5 rounded"
                style={{ accentColor: themeProps.buttonsBgColor }}
              />
              <span className="text-sm" style={{ color: themeProps.answersColor }}>
                {block.attributes.checkboxLabel || "J'accepte les conditions"}
              </span>
            </label>
          </div>
        )

      case 'statement':
        return (
          <div className="mt-6">
            <button
              onClick={onNext}
              className="px-6 py-3 font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {block.attributes.buttonText || 'Continuer'}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div>
      {/* Question number */}
      {showNumber && block.type !== 'welcome-screen' && block.type !== 'statement' && (
        <div className="flex items-center mb-2">
          <span
            className="text-sm font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: themeProps.buttonsBgColor + '20',
              color: themeProps.buttonsBgColor,
            }}
          >
            {index + 1}
          </span>
          {block.attributes.required && (
            <span className="ml-2 text-red-500 text-sm">*</span>
          )}
        </div>
      )}

      {/* Question text */}
      <h2
        className="text-2xl md:text-3xl font-medium leading-tight"
        style={{ color: themeProps.questionsColor }}
      >
        {block.attributes.label || 'Question sans titre'}
      </h2>

      {/* Description */}
      {block.attributes.description && (
        <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
          {replaceVariables(block.attributes.description, allBlocks, allAnswers, index)}
        </p>
      )}

      {/* Input */}
      {renderInput()}

      {/* OK button for text inputs */}
      {['short-text', 'long-text', 'email', 'number', 'website', 'date', 'advanced-date'].includes(block.type) && (
        <div className="mt-4">
          <button
            onClick={onNext}
            disabled={block.attributes.required && !answer}
            className="px-6 py-2 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            style={{
              backgroundColor: themeProps.buttonsBgColor,
              color: themeProps.buttonsFontColor,
            }}
          >
            OK
            <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
          </button>
        </div>
      )}
    </div>
  )
}
// Composant Calendrier pour la prévisualisation
interface PreviewDateCalendarProps {
  value: string | { start: string; end: string } | undefined
  onChange: (value: string | { start: string; end: string }) => void
  minDate?: string
  maxDate?: string
  themeProps: any
  isDateRange?: boolean
  startDateLabel?: string
  endDateLabel?: string
}

function PreviewDateCalendar({ 
  value, 
  onChange, 
  minDate, 
  maxDate, 
  themeProps, 
  isDateRange = false,
  startDateLabel = 'Date de début',
  endDateLabel = 'Date de fin'
}: PreviewDateCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [rangeSelection, setRangeSelection] = useState<'start' | 'end'>('start')
  
  const getSingleValue = (): string | undefined => {
    if (!value) return undefined
    if (typeof value === 'string') return value
    return undefined
  }
  
  const getRangeValue = (): { start?: string; end?: string } => {
    if (!value) return {}
    if (typeof value === 'object' && 'start' in value) {
      return value
    }
    return {}
  }
  
  const singleValue = getSingleValue()
  const rangeValue = getRangeValue()
  
  const [displayMonth, setDisplayMonth] = useState(() => {
    const dateToUse = isDateRange ? rangeValue.start : singleValue
    if (dateToUse) {
      const d = new Date(dateToUse)
      return new Date(d.getFullYear(), d.getMonth(), 1)
    }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const daysOfWeek = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ]

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const isDateDisabled = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    
    if (minDate) {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      if (date < min) return true
    }
    
    if (maxDate) {
      const max = new Date(maxDate)
      max.setHours(0, 0, 0, 0)
      if (date > max) return true
    }
    
    if (isDateRange && rangeSelection === 'end' && rangeValue.start) {
      const startDate = new Date(rangeValue.start)
      startDate.setHours(0, 0, 0, 0)
      if (date < startDate) return true
    }
    
    return false
  }

  const isDateSelected = (year: number, month: number, day: number) => {
    if (isDateRange) {
      if (rangeValue.start) {
        const start = new Date(rangeValue.start)
        if (start.getFullYear() === year && start.getMonth() === month && start.getDate() === day) {
          return 'start'
        }
      }
      if (rangeValue.end) {
        const end = new Date(rangeValue.end)
        if (end.getFullYear() === year && end.getMonth() === month && end.getDate() === day) {
          return 'end'
        }
      }
      return false
    }
    
    if (!singleValue) return false
    const selected = new Date(singleValue)
    return selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day ? 'single' : false
  }

  const isInRange = (year: number, month: number, day: number) => {
    if (!isDateRange || !rangeValue.start || !rangeValue.end) return false
    
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    const start = new Date(rangeValue.start)
    start.setHours(0, 0, 0, 0)
    const end = new Date(rangeValue.end)
    end.setHours(0, 0, 0, 0)
    
    return date > start && date < end
  }

  const isToday = (year: number, month: number, day: number) => {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  const isWeekend = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  const generateCalendarDays = () => {
    const year = displayMonth.getFullYear()
    const month = displayMonth.getMonth()
    const firstDay = getFirstDayOfMonth(displayMonth)
    const daysInMonth = getDaysInMonth(displayMonth)
    const daysInPrevMonth = getDaysInMonth(new Date(year, month - 1, 1))
    
    const days: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []
    
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        month: month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      })
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month, year, isCurrentMonth: true })
    }
    
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        month: month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      })
    }
    
    return days
  }

  const handleDateClick = (year: number, month: number, day: number) => {
    if (isDateDisabled(year, month, day)) return
    
    const date = new Date(year, month, day)
    const formatted = date.toISOString().split('T')[0]
    
    if (isDateRange) {
      if (rangeSelection === 'start') {
        const newRange: { start: string; end?: string } = { start: formatted }
        if (rangeValue.end) {
          const endDate = new Date(rangeValue.end)
          if (date <= endDate) {
            newRange.end = rangeValue.end
          }
        }
        onChange(newRange as { start: string; end: string })
        setRangeSelection('end')
      } else {
        onChange({ start: rangeValue.start || formatted, end: formatted })
        setRangeSelection('start')
      }
    } else {
      onChange(formatted)
    }
  }

  const days = generateCalendarDays()

  return (
    <div className="mt-4 w-full">
      {isDateRange && (
        <div className="flex gap-2 mb-4 max-w-lg mx-auto">
          <button
            onClick={() => setRangeSelection('start')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all`}
            style={{
              borderColor: rangeSelection === 'start' ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
              backgroundColor: rangeSelection === 'start' ? themeProps.buttonsBgColor + '10' : 'transparent',
              color: themeProps.answersColor,
            }}
          >
            <div className="text-xs opacity-70 mb-1">{startDateLabel}</div>
            <div>{rangeValue.start ? new Date(rangeValue.start).toLocaleDateString('fr-FR') : '—'}</div>
          </button>
          <button
            onClick={() => setRangeSelection('end')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all`}
            style={{
              borderColor: rangeSelection === 'end' ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
              backgroundColor: rangeSelection === 'end' ? themeProps.buttonsBgColor + '10' : 'transparent',
              color: themeProps.answersColor,
            }}
          >
            <div className="text-xs opacity-70 mb-1">{endDateLabel}</div>
            <div>{rangeValue.end ? new Date(rangeValue.end).toLocaleDateString('fr-FR') : '—'}</div>
          </button>
        </div>
      )}

      <div 
        className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-lg mx-auto"
        style={{ backgroundColor: themeProps.backgroundColor || '#ffffff' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear() - 1, displayMonth.getMonth(), 1))}
              className="p-1 hover:bg-gray-100 rounded"
              style={{ color: themeProps.answersColor }}
            >
              «
            </button>
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
              className="p-1 hover:bg-gray-100 rounded"
              style={{ color: themeProps.answersColor }}
            >
              ‹
            </button>
          </div>
          
          <span className="font-medium text-lg" style={{ color: themeProps.questionsColor }}>
            {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
              className="p-1 hover:bg-gray-100 rounded"
              style={{ color: themeProps.answersColor }}
            >
              ›
            </button>
            <button
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear() + 1, displayMonth.getMonth(), 1))}
              className="p-1 hover:bg-gray-100 rounded"
              style={{ color: themeProps.answersColor }}
            >
              »
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day}
              className="text-center text-xs font-medium py-2"
              style={{ color: idx >= 5 ? '#ef4444' : themeProps.answersColor + '80' }}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => {
            const disabled = isDateDisabled(d.year, d.month, d.day)
            const selected = isDateSelected(d.year, d.month, d.day)
            const inRange = isInRange(d.year, d.month, d.day)
            const todayDate = isToday(d.year, d.month, d.day)
            const weekend = isWeekend(d.year, d.month, d.day)
            
            return (
              <button
                key={idx}
                onClick={() => handleDateClick(d.year, d.month, d.day)}
                disabled={disabled}
                className={`
                  py-2 text-sm rounded transition-all
                  ${!d.isCurrentMonth ? 'opacity-30' : ''}
                  ${disabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-gray-100 cursor-pointer'}
                  ${selected ? 'ring-2 ring-offset-1' : ''}
                `}
                style={{
                  backgroundColor: selected 
                    ? themeProps.buttonsBgColor 
                    : inRange
                      ? themeProps.buttonsBgColor + '30'
                      : todayDate 
                        ? '#fef08a' 
                        : 'transparent',
                  color: selected 
                    ? themeProps.buttonsFontColor 
                    : disabled 
                      ? themeProps.answersColor + '40' 
                      : weekend && d.isCurrentMonth 
                        ? '#ef4444' 
                        : themeProps.answersColor,
                  outline: selected ? `2px solid ${themeProps.buttonsBgColor}` : undefined,
                }}
              >
                {d.day}
              </button>
            )
          })}
        </div>

        {(minDate || maxDate) && (
          <div className="mt-4 pt-3 border-t text-xs flex flex-wrap gap-3" style={{ borderColor: themeProps.answersColor + '20' }}>
            {minDate && <span style={{ color: themeProps.answersColor + '80' }}>Min: {new Date(minDate).toLocaleDateString('fr-FR')}</span>}
            {maxDate && <span style={{ color: themeProps.answersColor + '80' }}>Max: {new Date(maxDate).toLocaleDateString('fr-FR')}</span>}
          </div>
        )}
      </div>
      
      {!isDateRange && singleValue && (
        <div className="mt-3 text-lg text-center" style={{ color: themeProps.answersColor }}>
          Date sélectionnée : <strong>{new Date(singleValue).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        </div>
      )}
      
      {isDateRange && rangeValue.start && rangeValue.end && (
        <div className="mt-3 text-lg text-center" style={{ color: themeProps.answersColor }}>
          Du <strong>{new Date(rangeValue.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong> au <strong>{new Date(rangeValue.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          <span className="text-sm opacity-70 ml-2">
            ({Math.ceil((new Date(rangeValue.end).getTime() - new Date(rangeValue.start).getTime()) / (1000 * 60 * 60 * 24)) + 1} jours)
          </span>
        </div>
      )}
    </div>
  )
}