'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormBlock, BlockLogic, LogicRule, Webhook, ThemeProperties } from '@/types/form'
import { ChevronDown, ChevronUp, ChevronRight, Check, Loader2 } from 'lucide-react'
import { replaceVariables, getBackgroundStyle } from '@/lib/utils'

// Helper pour extraire l'ID de vidéo YouTube
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

interface PublicFormClientProps {
  form: {
    id: string
    title: string
    blocks: FormBlock[]
    settings: any
    logic: BlockLogic[]
    webhooks: Webhook[]
  }
  theme: {
    id: string
    name: string
    properties: ThemeProperties
  }
}

// État pour un bloc répétable
interface RepeaterState {
  isActive: boolean
  currentInnerIndex: number
  repetitionCount: number
  showRepeatQuestion: boolean
}

export function PublicFormClient({ form, theme }: PublicFormClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visibleBlocks, setVisibleBlocks] = useState<FormBlock[]>([])
  
  // État pour les blocs répétables
  const [repeaterStates, setRepeaterStates] = useState<Record<string, RepeaterState>>({})

  const themeProps = theme.properties
  const allBlocks = form.blocks
  const thankyouBlock = allBlocks.find((b) => b.type === 'thankyou-screen')

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
  const getInputStyle = (): React.CSSProperties => {
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

  // Appliquer la logique pour déterminer les blocs visibles
  // Les groupes sont gardés comme blocs uniques (mode conversationnel)
  useEffect(() => {
    const questionBlocks = allBlocks.filter((b) => b.type !== 'thankyou-screen')
    const hiddenBlockIds = new Set<string>()

    // Évaluer chaque règle de logique
    // form.logic est un tableau de BlockLogic[] où chaque élément contient blockId et rules[]
    const blockLogicArray = Array.isArray(form.logic) ? form.logic : []
    blockLogicArray.forEach((blockLogic) => {
      // blockLogic.blockId est le bloc auquel les règles s'appliquent
      const targetBlockId = blockLogic.blockId
      
      if (blockLogic.rules) {
        blockLogic.rules.forEach((rule: any) => {
          // Vérifier que la règle est activée (par défaut true si non défini)
          if (rule.enabled === false) return

          const shouldApply = evaluateConditions(rule.conditions, rule.conditionMatch, answers)

          if (shouldApply) {
            // rule.action est le type d'action ('hide', 'show', 'jump', 'require')
            if (rule.action === 'hide') {
              hiddenBlockIds.add(targetBlockId)
            }
          }
        })
      }
    })

    const visible = questionBlocks.filter((b) => !hiddenBlockIds.has(b.id))
    setVisibleBlocks(visible)
  }, [allBlocks, form.logic, answers])

  const currentBlock = visibleBlocks[currentIndex]
  const progress = visibleBlocks.length > 0 ? ((currentIndex + 1) / visibleBlocks.length) * 100 : 0

  // Déterminer le bloc à afficher (peut être un bloc interne d'un repeater)
  const getCurrentDisplayBlock = (): { block: FormBlock; isInnerBlock: boolean; parentBlock?: FormBlock } => {
    if (!currentBlock) return { block: currentBlock, isInnerBlock: false }
    
    if (currentBlock.type === 'repeater') {
      const state = repeaterStates[currentBlock.id]
      
      // Si le repeater n'est pas actif, on affiche la question initiale
      if (!state || !state.isActive) {
        return { block: currentBlock, isInnerBlock: false }
      }
      
      // Si on montre la question de répétition
      if (state.showRepeatQuestion) {
        return { block: currentBlock, isInnerBlock: false }
      }
      
      // Sinon on affiche le bloc interne courant
      const innerBlocks = currentBlock.innerBlocks || []
      if (innerBlocks.length > 0 && state.currentInnerIndex < innerBlocks.length) {
        return { 
          block: innerBlocks[state.currentInnerIndex], 
          isInnerBlock: true,
          parentBlock: currentBlock
        }
      }
    }
    
    return { block: currentBlock, isInnerBlock: false }
  }

  const { block: displayBlock, isInnerBlock, parentBlock } = getCurrentDisplayBlock()

  // Helper pour trouver un bloc par ID (y compris dans les innerBlocks des groupes)
  const findBlockByIdGlobal = (blockId: string): FormBlock | undefined => {
    for (const b of allBlocks) {
      if (b.id === blockId) return b
      if (b.innerBlocks) {
        const inner = b.innerBlocks.find(ib => ib.id === blockId)
        if (inner) return inner
      }
    }
    return undefined
  }

  const evaluateConditions = (
    conditions: LogicRule['conditions'],
    match: 'all' | 'any',
    answers: Record<string, any>
  ): boolean => {
    if (conditions.length === 0) return false

    const results = conditions.map((condition) => {
      const answer = answers[condition.blockId]
      let value = condition.value

      // Pour les blocs avec des choix, vérifier si la valeur de condition est un label
      // et la convertir en value si nécessaire (rétrocompatibilité)
      const sourceBlock = findBlockByIdGlobal(condition.blockId)
      if (sourceBlock?.attributes.choices) {
        const choiceByLabel = sourceBlock.attributes.choices.find(c => c.label === value)
        if (choiceByLabel) {
          value = choiceByLabel.value
        }
      }

      switch (condition.operator) {
        case 'equals':
          return answer === value
        case 'not_equals':
          return answer !== value
        case 'contains':
          return String(answer || '').includes(String(value))
        case 'not_contains':
          return !String(answer || '').includes(String(value))
        case 'greater_than':
          return Number(answer) > Number(value)
        case 'less_than':
          return Number(answer) < Number(value)
        case 'is_empty':
          return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0)
        case 'is_not_empty':
          return answer && answer !== '' && (!Array.isArray(answer) || answer.length > 0)
        default:
          return false
      }
    })

    return match === 'all' ? results.every(Boolean) : results.some(Boolean)
  }

  const getJumpTarget = useCallback((): string | null => {
    const blockLogicArray = Array.isArray(form.logic) ? form.logic : []
    
    // Trouver si une règle de jump s'applique pour le bloc courant
    for (const blockLogic of blockLogicArray) {
      if (!blockLogic.rules) continue
      
      for (const rule of blockLogic.rules) {
        if (rule.enabled === false) continue
        if (rule.action !== 'jump') continue

        const shouldApply = evaluateConditions(rule.conditions, rule.conditionMatch, answers)

        if (shouldApply && rule.targetBlockId) {
          return rule.targetBlockId
        }
      }
    }
    return null
  }, [form.logic, answers])

  const goToNext = useCallback((skipValidation: boolean = false, currentValue?: any) => {
    if (isAnimating) return
    setError(null)

    // Gestion des blocs répétables
    if (currentBlock?.type === 'repeater') {
      const state = repeaterStates[currentBlock.id]
      const innerBlocks = currentBlock.innerBlocks || []
      
      // Question initiale: On vérifie la réponse Oui/Non
      if (!state || !state.isActive) {
        const initialAnswer = currentValue ?? answers[`${currentBlock.id}_initial`]
        
        if (!skipValidation && !initialAnswer) {
          setError('Veuillez répondre à la question')
          return
        }
        
        // Si "Non", on passe au bloc suivant
        if (initialAnswer === 'no') {
          if (currentIndex < visibleBlocks.length - 1) {
            setIsAnimating(true)
            setTimeout(() => {
              setCurrentIndex(currentIndex + 1)
              setIsAnimating(false)
            }, 300)
          } else {
            handleSubmit()
          }
          return
        }
        
        // Si "Oui", on active le repeater et on affiche les questions internes
        if (innerBlocks.length > 0) {
          setIsAnimating(true)
          setTimeout(() => {
            setRepeaterStates({
              ...repeaterStates,
              [currentBlock.id]: {
                isActive: true,
                currentInnerIndex: 0,
                repetitionCount: 1,
                showRepeatQuestion: false
              }
            })
            setIsAnimating(false)
          }, 300)
          return
        } else {
          // Pas de blocs internes, on passe au suivant
          if (currentIndex < visibleBlocks.length - 1) {
            setIsAnimating(true)
            setTimeout(() => {
              setCurrentIndex(currentIndex + 1)
              setIsAnimating(false)
            }, 300)
          } else {
            handleSubmit()
          }
          return
        }
      }
      
      // On est dans le repeater actif
      if (state.showRepeatQuestion) {
        // On a répondu à la question de répétition
        const repeatAnswer = currentValue ?? answers[`${currentBlock.id}_repeat_${state.repetitionCount}`]
        
        if (!skipValidation && !repeatAnswer) {
          setError('Veuillez répondre à la question')
          return
        }
        
        if (repeatAnswer === 'yes') {
          // On recommence une répétition
          const maxReps = currentBlock.attributes.maxRepetitions || 10
          if (state.repetitionCount < maxReps) {
            setIsAnimating(true)
            setTimeout(() => {
              setRepeaterStates({
                ...repeaterStates,
                [currentBlock.id]: {
                  ...state,
                  currentInnerIndex: 0,
                  repetitionCount: state.repetitionCount + 1,
                  showRepeatQuestion: false
                }
              })
              setIsAnimating(false)
            }, 300)
          } else {
            // Max atteint, on passe au bloc suivant
            if (currentIndex < visibleBlocks.length - 1) {
              setIsAnimating(true)
              setTimeout(() => {
                setCurrentIndex(currentIndex + 1)
                setRepeaterStates({
                  ...repeaterStates,
                  [currentBlock.id]: { ...state, isActive: false }
                })
                setIsAnimating(false)
              }, 300)
            } else {
              handleSubmit()
            }
          }
        } else {
          // Non, on passe au bloc suivant
          if (currentIndex < visibleBlocks.length - 1) {
            setIsAnimating(true)
            setTimeout(() => {
              setCurrentIndex(currentIndex + 1)
              setRepeaterStates({
                ...repeaterStates,
                [currentBlock.id]: { ...state, isActive: false }
              })
              setIsAnimating(false)
            }, 300)
          } else {
            handleSubmit()
          }
        }
        return
      }
      
      // On est sur un bloc interne
      const currentInnerBlock = innerBlocks[state.currentInnerIndex]
      const innerAnswer = answers[`${currentBlock.id}_${state.repetitionCount}_${currentInnerBlock?.id}`]
      
      if (currentInnerBlock?.attributes.required && !innerAnswer) {
        setError('Ce champ est requis')
        return
      }
      
      // Passer au bloc interne suivant ou afficher la question de répétition
      if (state.currentInnerIndex < innerBlocks.length - 1) {
        setIsAnimating(true)
        setTimeout(() => {
          setRepeaterStates({
            ...repeaterStates,
            [currentBlock.id]: {
              ...state,
              currentInnerIndex: state.currentInnerIndex + 1
            }
          })
          setIsAnimating(false)
        }, 300)
      } else {
        // Fin des blocs internes, afficher la question de répétition
        setIsAnimating(true)
        setTimeout(() => {
          setRepeaterStates({
            ...repeaterStates,
            [currentBlock.id]: {
              ...state,
              showRepeatQuestion: true
            }
          })
          setIsAnimating(false)
        }, 300)
      }
      return
    }

    // Vérifier si le champ est requis (pour les blocs normaux)
    if (!skipValidation && displayBlock?.attributes.required && !answers[displayBlock.id]) {
      setError('Ce champ est requis')
      return
    }

    // Vérifier s'il y a un saut logique
    const jumpTarget = getJumpTarget()
    if (jumpTarget) {
      const targetIndex = visibleBlocks.findIndex((b) => b.id === jumpTarget)
      if (targetIndex !== -1) {
        setIsAnimating(true)
        setTimeout(() => {
          setCurrentIndex(targetIndex)
          setIsAnimating(false)
        }, 300)
        return
      }
    }

    if (currentIndex < visibleBlocks.length - 1) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        setIsAnimating(false)
      }, 300)
    } else {
      // Soumettre le formulaire
      handleSubmit()
    }
  }, [currentIndex, visibleBlocks, currentBlock, answers, isAnimating, getJumpTarget])

  const goToPrev = () => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1)
        setIsAnimating(false)
      }, 300)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: answers,
          metadata: {
            userAgent: navigator.userAgent,
            submittedAt: new Date().toISOString(),
          },
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erreur lors de la soumission')
      }

      setIsSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAnswer = (value: any, customKey?: string) => {
    const key = customKey || displayBlock?.id || currentBlock?.id
    if (key) {
      setAnswers({ ...answers, [key]: value })
      setError(null)
    }
  }

  // Fonction pour gérer les réponses du repeater
  const handleRepeaterAnswer = (value: any) => {
    if (!currentBlock || currentBlock.type !== 'repeater') return
    
    const state = repeaterStates[currentBlock.id]
    
    if (!state || !state.isActive) {
      // Réponse à la question initiale
      handleAnswer(value, `${currentBlock.id}_initial`)
    } else if (state.showRepeatQuestion) {
      // Réponse à la question de répétition
      handleAnswer(value, `${currentBlock.id}_repeat_${state.repetitionCount}`)
    } else {
      // Réponse à un bloc interne
      const innerBlocks = currentBlock.innerBlocks || []
      const currentInnerBlock = innerBlocks[state.currentInnerIndex]
      if (currentInnerBlock) {
        handleAnswer(value, `${currentBlock.id}_${state.repetitionCount}_${currentInnerBlock.id}`)
      }
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext])

  // Thank you screen
  if (isSubmitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8"
        style={{
          backgroundColor: themeProps.backgroundColor,
          fontFamily: themeProps.font || 'Inter',
        }}
      >
        <div className="max-w-xl w-full text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: themeProps.buttonsBgColor }}
          >
            <Check className="w-8 h-8" style={{ color: themeProps.buttonsFontColor }} />
          </div>
          <h1
            className="text-3xl font-bold mb-4"
            style={{ color: themeProps.questionsColor }}
          >
            {thankyouBlock?.attributes.label || 'Merci !'}
          </h1>
          {thankyouBlock?.attributes.description && (
            <p className="text-lg" style={{ color: themeProps.answersColor }}>
              {thankyouBlock.attributes.description}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (visibleBlocks.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: themeProps.backgroundColor }}
      >
        <p style={{ color: themeProps.answersColor }}>Ce formulaire ne contient aucune question.</p>
      </div>
    )
  }

  // Vérifier si le bloc actuel est un welcome-screen ou thankyou-screen avec un layout split
  const hasSplitLayout = currentBlock && 
    ['welcome-screen', 'thankyou-screen'].includes(currentBlock.type) &&
    currentBlock.attributes.showAttachment &&
    ['split-left', 'split-right'].includes(currentBlock.attributes.attachmentLayout || '')

  // Vérifier si le bloc actuel a un layout float
  const hasFloatLayout = currentBlock && 
    ['welcome-screen', 'thankyou-screen'].includes(currentBlock.type) &&
    currentBlock.attributes.showAttachment &&
    ['float-left', 'float-right'].includes(currentBlock.attributes.attachmentLayout || '')

  // Rendu avec layout float pour welcome/thankyou screen
  if (hasFloatLayout && currentBlock) {
    const layout = currentBlock.attributes.attachmentLayout
    const attachmentUrl = currentBlock.attributes.attachmentUrl
    const attachmentType = currentBlock.attributes.attachmentType || 'image'
    const focalPoint = currentBlock.attributes.focalPoint || { x: 50, y: 50 }
    const isImageOnLeft = layout === 'float-left'

    const contentSection = (
      <div className={`flex-1 flex flex-col justify-center p-8 md:p-12 ${isImageOnLeft ? '' : 'items-end text-right md:pr-16'}`}>
        <div className={`${isImageOnLeft ? '' : 'max-w-lg'}`}>
          {/* Logo */}
          {form.settings.logo && (
            <div className="mb-6">
              <img 
                src={form.settings.logo} 
                alt="Logo" 
                className={`h-10 object-contain ${isImageOnLeft ? '' : 'ml-auto'}`}
              />
            </div>
          )}
          
          {/* Titre */}
          <h1
            className="text-3xl md:text-4xl font-semibold leading-tight"
            style={{ color: themeProps.questionsColor }}
          >
            {currentBlock.attributes.label || 'Bienvenue'}
          </h1>

          {/* Description */}
          {currentBlock.attributes.description && (
            <p 
              className="mt-4 text-lg leading-relaxed opacity-80" 
              style={{ color: themeProps.answersColor }}
            >
              {currentBlock.attributes.description}
            </p>
          )}

          {/* Button */}
          {currentBlock.type === 'welcome-screen' && (
            <div className={`mt-8 ${isImageOnLeft ? '' : 'flex justify-end'}`}>
              <button
                onClick={() => goToNext()}
                className="px-8 py-3 font-medium transition-all hover:opacity-90 hover:scale-105 flex items-center gap-2"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {currentBlock.attributes.buttonText || 'Commencer'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {currentBlock.type === 'thankyou-screen' && (
            <div className={`mt-6 ${isImageOnLeft ? '' : 'flex justify-end'}`}>
              <div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                style={{
                  backgroundColor: themeProps.buttonsBgColor + '20',
                  color: themeProps.buttonsBgColor,
                }}
              >
                <Check className="w-4 h-4" />
                Formulaire terminé
              </div>
            </div>
          )}
          
          {/* Footer */}
          {form.settings.showBranding !== false && (
            <div className="mt-8 text-sm opacity-50" style={{ color: themeProps.answersColor }}>
              appuyer sur <span className="font-semibold">Entrée ↵</span>
            </div>
          )}
        </div>
      </div>
    )

    const attachmentSection = (
      <div className={`flex-1 flex items-center p-8 ${isImageOnLeft ? 'justify-end md:pl-8' : 'justify-start md:pr-8'}`}>
        <div className="w-full max-w-xl rounded-lg overflow-hidden shadow-lg">
          {attachmentType === 'image' && attachmentUrl && (
            <img
              src={attachmentUrl}
              alt=""
              className="w-full h-auto object-cover"
              style={{ 
                maxHeight: '500px',
                objectPosition: `${focalPoint.x}% ${focalPoint.y}%` 
              }}
            />
          )}
          {attachmentType === 'video' && attachmentUrl && (
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(attachmentUrl)}?autoplay=0`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    )

    return (
      <div
        className="min-h-screen flex flex-col md:flex-row transition-colors duration-300"
        style={{
          backgroundColor: themeProps.backgroundColor,
          fontFamily: themeProps.font || 'Inter',
        }}
      >
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

  // Rendu avec layout split pour welcome/thankyou screen
  if (hasSplitLayout && currentBlock) {
    const layout = currentBlock.attributes.attachmentLayout
    const attachmentUrl = currentBlock.attributes.attachmentUrl
    const attachmentType = currentBlock.attributes.attachmentType || 'image'
    const focalPoint = currentBlock.attributes.focalPoint || { x: 50, y: 50 }
    const isImageOnLeft = layout === 'split-left'

    const contentSection = (
      <div className="w-full md:w-1/2 min-h-screen flex flex-col">
        {/* Logo */}
        {form.settings.logo && (
          <div className="p-4">
            <img 
              src={form.settings.logo} 
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
            <WelcomeScreenContent
              block={currentBlock}
              themeProps={themeProps}
              onNext={goToNext}
              buttonBorderRadius={buttonBorderRadius}
            />
          </div>
        </div>
        
        {/* Footer */}
        {form.settings.showBranding !== false && (
          <div className="p-4 text-center">
            <span className="text-xs" style={{ color: themeProps.answersColor + '80' }}>
              propulsé par <a href="#" className="underline">FormBuilder</a>
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
        className="min-h-screen flex flex-row transition-colors duration-300"
        style={{
          ...getBackgroundStyle(themeProps),
          fontFamily: themeProps.font || 'Inter',
        }}
      >
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

  // Configuration de la barre de progression
  const progressBarPosition = form.settings.progressBarPosition ?? 'top'
  const progressBarSize = form.settings.progressBarSize ?? 'small'
  const showProgressBar = form.settings.showProgressBar !== false && currentBlock?.type !== 'welcome-screen'
  
  const barSizes: Record<string, string> = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3',
  }
  
  const barSizesVertical: Record<string, string> = {
    small: 'w-1',
    medium: 'w-2',
    large: 'w-3',
  }

  const isVerticalBar = progressBarPosition === 'left' || progressBarPosition === 'right'

  // Composant barre de progression horizontale
  const HorizontalProgressBar = () => (
    <div className={`${barSizes[progressBarSize]} bg-gray-200 w-full shrink-0`}>
      <div
        className="h-full transition-all duration-300"
        style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
      />
    </div>
  )

  // Composant barre de progression verticale
  const VerticalProgressBar = () => (
    <div 
      className={`${barSizesVertical[progressBarSize]} bg-gray-200 h-full shrink-0`}
      style={{ position: 'fixed', top: 0, bottom: 0, [progressBarPosition]: 0 }}
    >
      <div
        className="w-full transition-all duration-300"
        style={{ height: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
      />
    </div>
  )

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        ...getBackgroundStyle(themeProps),
        fontFamily: themeProps.font || 'Inter',
      }}
    >
      {/* Progress bar - Top */}
      {showProgressBar && progressBarPosition === 'top' && <HorizontalProgressBar />}
      
      {/* Progress bar - Left */}
      {showProgressBar && progressBarPosition === 'left' && <VerticalProgressBar />}

      {/* Question area */}
      <div 
        className="flex-1 flex items-center justify-center px-4 py-6 sm:p-8"
        style={{
          paddingLeft: progressBarPosition === 'left' && showProgressBar ? '24px' : undefined,
          paddingRight: progressBarPosition === 'right' && showProgressBar ? '24px' : undefined,
        }}
      >
        <div
          className={`max-w-xl w-full transition-opacity duration-300 ${
            isAnimating ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {currentBlock && currentBlock.type === 'repeater' ? (
            <RepeaterBlock
              block={currentBlock}
              repeaterState={repeaterStates[currentBlock.id]}
              index={currentIndex}
              showNumber={form.settings.showQuestionNumbers !== false}
              showLetters={form.settings.lettersOnAnswers !== false}
              themeProps={themeProps}
              answers={answers}
              onAnswer={handleRepeaterAnswer}
              onNext={goToNext}
              isLast={currentIndex === visibleBlocks.length - 1}
              isSubmitting={isSubmitting}
              error={error}
              allBlocks={form.blocks}
              inputStyle={inputStyle}
              buttonBorderRadius={buttonBorderRadius}
            />
          ) : currentBlock && currentBlock.type === 'group' ? (
            <GroupBlock
              block={currentBlock}
              index={currentIndex}
              showNumber={form.settings.showQuestionNumbers !== false}
              showLetters={form.settings.lettersOnAnswers !== false}
              themeProps={themeProps}
              answers={answers}
              onAnswer={handleAnswer}
              onNext={goToNext}
              isLast={currentIndex === visibleBlocks.length - 1}
              isSubmitting={isSubmitting}
              error={error}
              allBlocks={form.blocks}
              inputStyle={inputStyle}
              buttonBorderRadius={buttonBorderRadius}
              logic={form.logic}
            />
          ) : currentBlock ? (
            <QuestionBlock
              block={currentBlock}
              index={currentIndex}
              showNumber={form.settings.showQuestionNumbers !== false}
              showLetters={form.settings.lettersOnAnswers !== false}
              themeProps={themeProps}
              answer={answers[currentBlock.id]}
              onAnswer={handleAnswer}
              onNext={goToNext}
              isLast={currentIndex === visibleBlocks.length - 1}
              isSubmitting={isSubmitting}
              error={error}
              allBlocks={form.blocks}
              allAnswers={answers}
              inputStyle={inputStyle}
              buttonBorderRadius={buttonBorderRadius}
              inputBorderRadius={inputBorderRadius}
            />
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-3 sm:p-4 flex justify-between items-center safe-area-inset-bottom">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="p-2 sm:p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/5 active:bg-black/10 transition-colors"
            style={{ color: themeProps.questionsColor }}
          >
            <ChevronUp className="w-6 h-6 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => goToNext()}
            className="p-2 sm:p-2 rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
            style={{ color: themeProps.questionsColor }}
          >
            <ChevronDown className="w-6 h-6 sm:w-5 sm:h-5" />
          </button>
        </div>
        <span className="text-sm" style={{ color: themeProps.answersColor }}>
          {currentIndex + 1} / {visibleBlocks.length}
        </span>
      </div>

      {/* Progress bar - Bottom */}
      {showProgressBar && progressBarPosition === 'bottom' && <HorizontalProgressBar />}
      
      {/* Progress bar - Right */}
      {showProgressBar && progressBarPosition === 'right' && <VerticalProgressBar />}
    </div>
  )
}

interface QuestionBlockProps {
  block: FormBlock
  index: number
  showNumber: boolean
  showLetters: boolean
  themeProps: ThemeProperties
  answer: any
  onAnswer: (value: any) => void
  onNext: (skipValidation?: boolean) => void
  isLast: boolean
  isSubmitting: boolean
  error: string | null
  allBlocks: FormBlock[]
  allAnswers: Record<string, any>
  inputStyle?: React.CSSProperties
  buttonBorderRadius?: string
  inputBorderRadius?: string
}

function QuestionBlock({
  block,
  index,
  showNumber,
  showLetters,
  themeProps,
  answer,
  onAnswer,
  onNext,
  isLast,
  isSubmitting,
  error,
  allBlocks,
  allAnswers,
  inputStyle = {},
  buttonBorderRadius = '8px',
  inputBorderRadius = '8px',
}: QuestionBlockProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  // Rendu de l'attachment pour welcome-screen (layouts non-split)
  const renderWelcomeAttachment = () => {
    if (!block.attributes.showAttachment || !block.attributes.attachmentUrl) return null
    
    const attachmentType = block.attributes.attachmentType || 'image'
    const attachmentUrl = block.attributes.attachmentUrl
    const attachmentLayout = block.attributes.attachmentLayout || 'stack'
    const focalPoint = block.attributes.focalPoint || { x: 50, y: 50 }
    
    // Les layouts split sont gérés au niveau du conteneur parent
    if (['split-left', 'split-right'].includes(attachmentLayout)) return null

    const isFloat = ['float-left', 'float-right'].includes(attachmentLayout)
    
    if (attachmentType === 'image') {
      return (
        <div className={`${isFloat ? (attachmentLayout === 'float-left' ? 'float-left mr-6 mb-4' : 'float-right ml-6 mb-4') : 'mb-6'}`}>
          <img
            src={attachmentUrl}
            alt=""
            className={`rounded-lg ${isFloat ? 'max-w-xs' : 'w-full max-h-64 object-cover'}`}
            style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          />
        </div>
      )
    }
    
    if (attachmentType === 'video') {
      const videoId = getYouTubeVideoId(attachmentUrl)
      if (!videoId) return null
      return (
        <div className={`${isFloat ? (attachmentLayout === 'float-left' ? 'float-left mr-6 mb-4' : 'float-right ml-6 mb-4') : 'mb-6'}`}>
          <div className={`relative ${isFloat ? 'w-64' : 'w-full'} aspect-video rounded-lg overflow-hidden`}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )
    }
    
    return null
  }

  const renderInput = () => {
    switch (block.type) {
      case 'welcome-screen':
        // Les layouts float et split sont gérés au niveau du composant parent
        // Ici on rend juste le bouton pour le layout stack
        return (
          <div className="mt-6">
            <button
              onClick={() => onNext()}
              className="px-6 py-3 font-medium transition-opacity hover:opacity-90 flex items-center"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {block.attributes.buttonText || 'Commencer'}
              <ChevronDown className="w-5 h-5 ml-2 rotate-[-90deg]" />
            </button>
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
            autoFocus
            className="mt-4 w-full bg-transparent border-2 py-3 px-4 text-base sm:text-lg outline-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
              fontSize: '16px', // Empêche le zoom auto sur iOS
              ...inputStyle,
            }}
          />
        )

      case 'phone':
        return (
          <input
            type="tel"
            placeholder={block.attributes.placeholder || '+33 6 12 34 56 78'}
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            autoFocus
            className="mt-4 w-full bg-transparent border-2 py-3 px-4 text-base sm:text-lg outline-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
              fontSize: '16px', // Empêche le zoom auto sur iOS
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
            autoFocus
            className="mt-4 w-full bg-transparent border-2 py-3 px-4 text-base sm:text-lg outline-none resize-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
              fontSize: '16px', // Empêche le zoom auto sur iOS
              ...inputStyle,
            }}
          />
        )

      case 'dropdown':
        const dropdownChoicesMain = block.attributes.choices || []
        return (
          <div className="mt-4 relative">
            <select
              value={answer || ''}
              onChange={(e) => {
                onAnswer(e.target.value)
                if (e.target.value) {
                  setTimeout(() => onNext(true), 300)
                }
              }}
              className="w-full bg-transparent border-2 py-3 px-4 text-lg outline-none appearance-none cursor-pointer transition-colors"
              style={{
                color: themeProps.answersColor,
                borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
                borderRadius: inputBorderRadius,
                ...inputStyle,
              }}
            >
              <option value="" style={{ color: '#999' }}>
                {block.attributes.placeholder || 'Sélectionnez une option...'}
              </option>
              {dropdownChoicesMain.map((choice: any) => (
                <option key={choice.id || choice.value} value={choice.value} style={{ color: '#333' }}>
                  {choice.label}
                </option>
              ))}
            </select>
            <ChevronDown 
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" 
              style={{ color: themeProps.answersColor }}
              size={20}
            />
          </div>
        )

      case 'multiple-choice':
        const choices = block.attributes.choices || []
        const allowMultiple = block.attributes.allowMultiple || block.attributes.multiple
        return (
          <div className="mt-4 space-y-2 sm:space-y-3">
            {choices.map((choice: any, idx: number) => {
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
                      setTimeout(() => onNext(true), 300)
                    }
                  }}
                  className="w-full flex items-center px-4 py-3 sm:py-4 rounded-md border-2 transition-all active:scale-[0.98] hover:scale-[1.01]"
                  style={{
                    borderColor: isSelected
                      ? themeProps.buttonsBgColor
                      : themeProps.answersColor + '30',
                    backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                  }}
                >
                  {showLetters && (
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
                  )}
                  <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
                </button>
              )
            })}
          </div>
        )

      case 'date':
        return (
          <input
            type="date"
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            className="mt-4 bg-transparent border-b-2 py-2 text-lg outline-none"
            style={{
              color: themeProps.answersColor,
              borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'advanced-date':
        // Calculer les dates min/max en fonction de la configuration
        const getComputedDate = (
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
            return specificDate // Pas besoin d'offset pour une date spécifique
          } else if (dateType === 'block' && blockId) {
            const blockValue = allAnswers[blockId]
            if (blockValue && typeof blockValue === 'string' && blockValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const [y, m, d] = blockValue.split('-').map(Number)
              baseDate = new Date(y, m - 1, d)
            }
          }
          
          if (baseDate && !isNaN(baseDate.getTime())) {
            if (offset) {
              baseDate.setDate(baseDate.getDate() + offset)
            }
            // Formater manuellement pour éviter les problèmes de fuseau horaire
            return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
          }
          
          return undefined
        }
        
        const advMinDate = getComputedDate(
          block.attributes.minDateType,
          block.attributes.minDate,
          block.attributes.minDateBlockId,
          block.attributes.minDateOffset
        )
        
        const advMaxDate = getComputedDate(
          block.attributes.maxDateType,
          block.attributes.maxDate,
          block.attributes.maxDateBlockId,
          block.attributes.maxDateOffset
        )
        
        return (
          <AdvancedDateCalendar
            value={answer}
            onChange={onAnswer}
            minDate={advMinDate}
            maxDate={advMaxDate}
            themeProps={themeProps}
            isDateRange={block.attributes.isDateRange}
            startDateLabel={block.attributes.startDateLabel}
            endDateLabel={block.attributes.endDateLabel}
          />
        )

      case 'time':
        const isTimeRange = block.attributes.isTimeRange || false
        
        if (isTimeRange) {
          // Plage horaire avec deux champs - design moderne
          const timeRangeValue = answer || { startTime: '', endTime: '' }
          return (
            <div className="mt-6 w-full max-w-md space-y-4">
              {/* Heure de début */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: themeProps.answersColor }}>
                  {block.attributes.startTimeLabel || 'Heure de début'}
                </label>
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all focus-within:shadow-lg"
                  style={{ 
                    borderColor: timeRangeValue.startTime ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
                    backgroundColor: timeRangeValue.startTime ? themeProps.buttonsBgColor + '08' : 'transparent',
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: themeProps.buttonsBgColor + '20' }}
                  >
                    <svg className="w-5 h-5" style={{ color: themeProps.buttonsBgColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <input
                    type="time"
                    value={timeRangeValue.startTime || ''}
                    onChange={(e) => onAnswer({ ...timeRangeValue, startTime: e.target.value })}
                    className="flex-1 bg-transparent text-2xl font-semibold outline-none"
                    style={{ color: themeProps.answersColor }}
                  />
                </div>
              </div>
              
              {/* Séparateur visuel */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: themeProps.answersColor + '10' }}>
                  <svg className="w-4 h-4" style={{ color: themeProps.answersColor + '60' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                  <span className="text-xs font-medium" style={{ color: themeProps.answersColor + '60' }}>jusqu'à</span>
                </div>
              </div>
              
              {/* Heure de fin */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: themeProps.answersColor }}>
                  {block.attributes.endTimeLabel || 'Heure de fin'}
                </label>
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all focus-within:shadow-lg"
                  style={{ 
                    borderColor: timeRangeValue.endTime ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
                    backgroundColor: timeRangeValue.endTime ? themeProps.buttonsBgColor + '08' : 'transparent',
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: themeProps.answersColor + '15' }}
                  >
                    <svg className="w-5 h-5" style={{ color: themeProps.answersColor + '60' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <input
                    type="time"
                    value={timeRangeValue.endTime || ''}
                    onChange={(e) => onAnswer({ ...timeRangeValue, endTime: e.target.value })}
                    className="flex-1 bg-transparent text-2xl font-semibold outline-none"
                    style={{ color: themeProps.answersColor }}
                  />
                </div>
              </div>
            </div>
          )
        }
        
        // Heure simple - design moderne
        return (
          <div className="mt-6">
            <div 
              className="inline-flex items-center gap-4 px-6 py-4 rounded-xl border-2 transition-all focus-within:shadow-lg"
              style={{ 
                borderColor: answer ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
                backgroundColor: answer ? themeProps.buttonsBgColor + '08' : 'transparent',
              }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: themeProps.buttonsBgColor + '20' }}
              >
                <svg className="w-6 h-6" style={{ color: themeProps.buttonsBgColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path strokeLinecap="round" d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: themeProps.answersColor + '60' }}>
                  Format 24h
                </span>
                <input
                  type="time"
                  value={answer || ''}
                  onChange={(e) => onAnswer(e.target.value)}
                  className="bg-transparent text-3xl font-bold tracking-wider outline-none"
                  style={{ color: themeProps.answersColor }}
                />
              </div>
            </div>
          </div>
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
              className="w-full"
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
                  if (e.target.checked) setTimeout(() => onNext(true), 300)
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
              onClick={() => onNext()}
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
      {/* Image au-dessus du titre pour welcome-screen et thankyou-screen en layout stack */}
      {(block.type === 'welcome-screen' || block.type === 'thankyou-screen') && 
       block.attributes.showAttachment && 
       block.attributes.attachmentLayout === 'stack' && 
       block.attributes.attachmentUrl && (
        <div className="mb-6">
          {block.attributes.attachmentType === 'video' ? (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(block.attributes.attachmentUrl)}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <img
              src={block.attributes.attachmentUrl}
              alt=""
              className="w-full max-w-xl rounded-lg object-cover"
              style={{ 
                maxHeight: '300px',
                objectPosition: `${block.attributes.focalPoint?.x || 50}% ${block.attributes.focalPoint?.y || 50}%` 
              }}
            />
          )}
        </div>
      )}

      {/* Question number */}
      {showNumber && block.type !== 'welcome-screen' && block.type !== 'statement' && !block.attributes.hideLabel && (
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
          {block.attributes.required && <span className="ml-2 text-red-500 text-sm">*</span>}
        </div>
      )}

      {/* Question text */}
      {!block.attributes.hideLabel && (
        <h2
          className="text-xl sm:text-2xl md:text-3xl font-medium leading-tight"
          style={{ color: themeProps.questionsColor }}
        >
          {replaceVariables(block.attributes.label || 'Question sans titre', allBlocks, allAnswers, index)}
        </h2>
      )}

      {/* Description */}
      {block.attributes.description && (
        <p className="mt-2 text-base sm:text-lg" style={{ color: themeProps.answersColor }}>
          {replaceVariables(block.attributes.description, allBlocks, allAnswers, index)}
        </p>
      )}

      {/* Input */}
      {renderInput()}

      {/* Error message */}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/* OK/Submit button for text inputs */}
      {['short-text', 'long-text', 'email', 'number', 'website', 'phone', 'date', 'advanced-date', 'time', 'slider'].includes(
        block.type
      ) && (
        <div className="mt-4 sm:mt-6">
          <button
            onClick={() => onNext()}
            disabled={isSubmitting || (block.attributes.required && !answer)}
            className="px-6 py-3 sm:py-2 font-medium transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-base"
            style={{
              backgroundColor: themeProps.buttonsBgColor,
              color: themeProps.buttonsFontColor,
              borderRadius: buttonBorderRadius,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                {isLast ? 'Envoyer' : 'OK'}
                <span className="ml-2 text-xs opacity-70 hidden sm:inline">Entrée ↵</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Submit button for multiple choice */}
      {['multiple-choice', 'dropdown'].includes(block.type) &&
        (block.attributes.allowMultiple || block.attributes.multiple) &&
        (answer || []).length > 0 && (
          <div className="mt-4 sm:mt-6">
            <button
              onClick={() => onNext()}
              disabled={isSubmitting}
              className="px-6 py-3 sm:py-2 font-medium transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50 flex items-center text-base"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  {isLast ? 'Envoyer' : 'OK'}
                  <span className="ml-2 text-xs opacity-70 hidden sm:inline">Entrée ↵</span>
                </>
              )}
            </button>
          </div>
        )}
    </div>
  )
}

// Composant pour les blocs groupe (affichage conversationnel)
interface GroupBlockProps {
  block: FormBlock
  index: number
  showNumber: boolean
  showLetters: boolean
  themeProps: ThemeProperties
  answers: Record<string, any>
  onAnswer: (value: any, blockId?: string) => void
  onNext: (skipValidation?: boolean) => void
  isLast: boolean
  isSubmitting: boolean
  error: string | null
  allBlocks: FormBlock[]
  inputStyle?: React.CSSProperties
  buttonBorderRadius?: string
  logic?: BlockLogic[]
}

function GroupBlock({
  block,
  index,
  showNumber,
  showLetters,
  themeProps,
  answers,
  onAnswer,
  onNext,
  isLast,
  isSubmitting,
  error,
  allBlocks,
  inputStyle = {},
  buttonBorderRadius = '8px',
  logic = [],
}: GroupBlockProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const allInnerBlocks = block.innerBlocks || []

  // Helper pour trouver un bloc par ID (dans les innerBlocks ou allBlocks)
  const findBlockById = (blockId: string): FormBlock | undefined => {
    // Chercher dans les innerBlocks du groupe
    const innerBlock = allInnerBlocks.find(b => b.id === blockId)
    if (innerBlock) return innerBlock
    // Chercher dans tous les blocs
    return allBlocks.find(b => b.id === blockId)
  }

  // Fonction pour évaluer les conditions de logique
  const evaluateConditions = (
    conditions: LogicRule['conditions'],
    match: 'all' | 'any'
  ): boolean => {
    if (conditions.length === 0) return false

    const results = conditions.map((condition) => {
      const answer = answers[condition.blockId]
      let value = condition.value

      // Pour les blocs avec des choix, vérifier si la valeur de condition est un label
      // et la convertir en value si nécessaire (rétrocompatibilité)
      const sourceBlock = findBlockById(condition.blockId)
      if (sourceBlock?.attributes.choices) {
        const choiceByLabel = sourceBlock.attributes.choices.find(c => c.label === value)
        if (choiceByLabel) {
          value = choiceByLabel.value
        }
      }

      switch (condition.operator) {
        case 'equals':
          return answer === value
        case 'not_equals':
          return answer !== value
        case 'contains':
          return String(answer || '').includes(String(value))
        case 'not_contains':
          return !String(answer || '').includes(String(value))
        case 'greater_than':
          return Number(answer) > Number(value)
        case 'less_than':
          return Number(answer) < Number(value)
        case 'is_empty':
          return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0)
        case 'is_not_empty':
          return answer && answer !== '' && (!Array.isArray(answer) || answer.length > 0)
        default:
          return false
      }
    })

    return match === 'all' ? results.every(Boolean) : results.some(Boolean)
  }

  // Filtrer les innerBlocks selon la logique conditionnelle
  // logic est un tableau de BlockLogic[] où chaque élément contient blockId et rules[]
  const hiddenBlockIds = new Set<string>()
  logic.forEach((blockLogic: any) => {
    // blockLogic.blockId est le bloc auquel les règles s'appliquent
    const targetBlockId = blockLogic.blockId
    
    if (blockLogic.rules) {
      blockLogic.rules.forEach((rule: any) => {
        if (rule.enabled === false) return
        
        const shouldApply = evaluateConditions(rule.conditions, rule.conditionMatch)
        if (shouldApply) {
          if (rule.action === 'hide') {
            hiddenBlockIds.add(targetBlockId)
          }
        }
      })
    }
  })

  const innerBlocks = allInnerBlocks.filter((b) => !hiddenBlockIds.has(b.id))

  // Vérifier si tous les champs requis sont remplis (uniquement les visibles)
  const allRequiredFilled = innerBlocks.every((innerBlock) => {
    if (!innerBlock.attributes.required) return true
    const value = answers[innerBlock.id]
    if (value === null || value === undefined || value === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  })

  const renderInnerInput = (innerBlock: FormBlock, innerIndex: number) => {
    const value = answers[innerBlock.id]
    const handleChange = (newValue: any) => onAnswer(newValue, innerBlock.id)

    switch (innerBlock.type) {
      case 'short-text':
      case 'email':
      case 'number':
      case 'website':
        return (
          <input
            type={innerBlock.type === 'email' ? 'email' : innerBlock.type === 'number' ? 'number' : 'text'}
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre réponse ici...'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none transition-colors focus:border-opacity-100"
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
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre réponse ici...'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            rows={3}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none resize-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'multiple-choice':
        const choices = innerBlock.attributes.choices || []
        const allowMultiple = innerBlock.attributes.allowMultiple || innerBlock.attributes.multiple
        const selectedValues = Array.isArray(value) ? value : value ? [value] : []

        return (
          <div className="space-y-2">
            {choices.map((choice: any, choiceIdx: number) => {
              const isSelected = selectedValues.includes(choice.value)

              return (
                <button
                  key={choice.id}
                  onClick={() => {
                    if (allowMultiple) {
                      const newValues = isSelected
                        ? selectedValues.filter((v: string) => v !== choice.value)
                        : [...selectedValues, choice.value]
                      handleChange(newValues)
                    } else {
                      handleChange(choice.value)
                    }
                  }}
                  className="w-full flex items-center px-3 py-2 border-2 transition-all hover:scale-[1.01] text-left"
                  style={{
                    borderColor: isSelected
                      ? themeProps.buttonsBgColor
                      : themeProps.answersColor + '30',
                    backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                    borderRadius: buttonBorderRadius,
                  }}
                >
                  {showLetters && (
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium mr-2 shrink-0"
                      style={{
                        backgroundColor: isSelected
                          ? themeProps.buttonsBgColor
                          : themeProps.answersColor + '20',
                        color: isSelected ? themeProps.buttonsFontColor : themeProps.answersColor,
                      }}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : letters[choiceIdx]}
                    </span>
                  )}
                  <span className="text-sm" style={{ color: themeProps.answersColor }}>{choice.label}</span>
                </button>
              )
            })}
          </div>
        )

      case 'dropdown':
        const dropdownChoices = innerBlock.attributes.choices || []
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          >
            <option value="">{innerBlock.attributes.placeholder || 'Sélectionnez...'}</option>
            {dropdownChoices.map((choice: any) => (
              <option key={choice.id} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        )

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'time':
        return (
          <input
            type="time"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      case 'legal':
        return (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleChange(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2"
              style={{ accentColor: themeProps.buttonsBgColor }}
            />
            <span className="text-sm" style={{ color: themeProps.answersColor }}>
              {innerBlock.attributes.checkboxLabel || 'J\'accepte'}
            </span>
          </label>
        )

      case 'advanced-date':
        // Utiliser le même composant calendrier que les blocs séparés
        // Calculer les dates min/max si nécessaire
        const getComputedDateForGroup = (
          dateType?: string,
          specificDate?: string,
          blockId?: string,
          offset?: number
        ): string | undefined => {
          if (!dateType || dateType === 'none') return undefined
          
          if (dateType === 'specific' && specificDate) {
            return specificDate
          }
          
          if (dateType === 'today') {
            const today = new Date()
            if (offset) {
              today.setDate(today.getDate() + offset)
            }
            // Formater manuellement pour éviter les problèmes de fuseau horaire
            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          }
          
          if (dateType === 'block' && blockId) {
            const blockAnswer = answers[blockId]
            if (blockAnswer) {
              // Parser manuellement si c'est une chaîne de date
              if (typeof blockAnswer === 'string' && blockAnswer.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = blockAnswer.split('-').map(Number)
                const baseDate = new Date(year, month - 1, day)
                if (offset) {
                  baseDate.setDate(baseDate.getDate() + offset)
                }
                return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
              }
            }
          }
          
          return undefined
        }
        
        const advMinDate = getComputedDateForGroup(
          innerBlock.attributes.minDateType,
          innerBlock.attributes.minDate,
          innerBlock.attributes.minDateBlockId,
          innerBlock.attributes.minDateOffset
        )
        
        const advMaxDate = getComputedDateForGroup(
          innerBlock.attributes.maxDateType,
          innerBlock.attributes.maxDate,
          innerBlock.attributes.maxDateBlockId,
          innerBlock.attributes.maxDateOffset
        )
        
        return (
          <AdvancedDateCalendar
            value={value}
            onChange={handleChange}
            minDate={advMinDate}
            maxDate={advMaxDate}
            themeProps={themeProps}
            isDateRange={innerBlock.attributes.isDateRange}
            startDateLabel={innerBlock.attributes.startDateLabel}
            endDateLabel={innerBlock.attributes.endDateLabel}
          />
        )

      case 'slider':
        const min = innerBlock.attributes.min ?? 0
        const max = innerBlock.attributes.max ?? 100
        const step = innerBlock.attributes.step ?? 1
        const sliderValue = value ?? innerBlock.attributes.defaultValue ?? min
        
        return (
          <div className="space-y-2">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={sliderValue}
              onChange={(e) => handleChange(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: themeProps.buttonsBgColor }}
            />
            <div className="flex justify-between text-sm" style={{ color: themeProps.answersColor }}>
              <span>{min}</span>
              <span className="font-medium">{sliderValue}</span>
              <span>{max}</span>
            </div>
          </div>
        )

      case 'phone':
        return (
          <input
            type="tel"
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre numéro...'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full bg-transparent border-2 py-2 px-3 text-base outline-none transition-colors focus:border-opacity-100"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
              ...inputStyle,
            }}
          />
        )

      default:
        return (
          <p className="text-sm" style={{ color: themeProps.answersColor + '60' }}>
            Type de bloc non supporté dans un groupe: {innerBlock.type}
          </p>
        )
    }
  }

  return (
    <div>
      {/* Titre du groupe (optionnel) */}
      {block.attributes.label && !block.attributes.hideLabel && (
        <div className="mb-6">
          <div className="flex items-baseline">
            {showNumber && (
              <span
                className="text-sm font-medium px-2 py-1 rounded mr-3"
                style={{
                  backgroundColor: themeProps.buttonsBgColor + '20',
                  color: themeProps.buttonsBgColor,
                }}
              >
                {index + 1}
              </span>
            )}
            <h2
              className="text-2xl md:text-3xl font-medium leading-tight"
              style={{ color: themeProps.questionsColor }}
            >
              {block.attributes.label}
            </h2>
          </div>
          {block.attributes.description && (
            <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
              {block.attributes.description}
            </p>
          )}
        </div>
      )}

      {/* Questions internes */}
      <div className="space-y-6">
        {innerBlocks.map((innerBlock, innerIdx) => (
          <div key={innerBlock.id} className="group">
            {!innerBlock.attributes.hideLabel && (
              <div className="flex items-baseline mb-2">
                {showNumber && (
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded mr-2"
                    style={{
                      backgroundColor: themeProps.answersColor + '15',
                      color: themeProps.answersColor + '80',
                    }}
                  >
                    {index + 1}{String.fromCharCode(65 + innerIdx)}
                  </span>
                )}
                <label
                  className="text-lg font-medium"
                  style={{ color: themeProps.questionsColor }}
                >
                  {innerBlock.attributes.label || 'Question sans titre'}
                  {innerBlock.attributes.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
              </div>
            )}
            {innerBlock.attributes.description && (
              <p className="text-sm mb-2" style={{ color: themeProps.answersColor + '80' }}>
                {innerBlock.attributes.description}
              </p>
            )}
            {renderInnerInput(innerBlock, innerIdx)}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {/* Bouton OK/Envoyer */}
      <div className="mt-6">
        <button
          onClick={() => onNext()}
          disabled={isSubmitting || !allRequiredFilled}
          className="px-6 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          style={{
            backgroundColor: themeProps.buttonsBgColor,
            color: themeProps.buttonsFontColor,
            borderRadius: buttonBorderRadius,
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              {isLast ? 'Envoyer' : 'OK'}
              <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Composant pour les blocs répétables
interface RepeaterBlockProps {
  block: FormBlock
  repeaterState?: RepeaterState
  index: number
  showNumber: boolean
  showLetters: boolean
  themeProps: ThemeProperties
  answers: Record<string, any>
  onAnswer: (value: any) => void
  onNext: (skipValidation?: boolean, currentValue?: any) => void
  isLast: boolean
  isSubmitting: boolean
  error: string | null
  allBlocks: FormBlock[]
  inputStyle?: React.CSSProperties
  buttonBorderRadius?: string
}

function RepeaterBlock({
  block,
  repeaterState,
  index,
  showNumber,
  showLetters,
  themeProps,
  answers,
  onAnswer,
  onNext,
  isLast,
  isSubmitting,
  error,
  allBlocks,
  inputStyle = {},
  buttonBorderRadius = '8px',
}: RepeaterBlockProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const innerBlocks = block.innerBlocks || []

  // Déterminer ce qu'on doit afficher
  const isShowingInitialQuestion = !repeaterState || !repeaterState.isActive
  const isShowingRepeatQuestion = repeaterState?.showRepeatQuestion
  const currentInnerBlock = !isShowingInitialQuestion && !isShowingRepeatQuestion && innerBlocks.length > 0
    ? innerBlocks[repeaterState!.currentInnerIndex]
    : null

  // Obtenir la réponse courante
  const getCurrentAnswer = () => {
    if (isShowingInitialQuestion) {
      return answers[`${block.id}_initial`]
    }
    if (isShowingRepeatQuestion && repeaterState) {
      return answers[`${block.id}_repeat_${repeaterState.repetitionCount}`]
    }
    if (currentInnerBlock && repeaterState) {
      return answers[`${block.id}_${repeaterState.repetitionCount}_${currentInnerBlock.id}`]
    }
    return undefined
  }

  const currentAnswer = getCurrentAnswer()

  // Rendu de la question initiale Oui/Non
  if (isShowingInitialQuestion) {
    const yesLabel = block.attributes.initialYesLabel || 'Oui'
    const noLabel = block.attributes.initialNoLabel || 'Non'
    const question = block.attributes.initialQuestion || block.attributes.label || 'Voulez-vous continuer ?'

    return (
      <div>
        {showNumber && (
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
          </div>
        )}

        <h2
          className="text-2xl md:text-3xl font-medium leading-tight"
          style={{ color: themeProps.questionsColor }}
        >
          {replaceVariables(question, allBlocks, answers, index)}
        </h2>

        {block.attributes.description && (
          <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
            {replaceVariables(block.attributes.description, allBlocks, answers, index)}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {[
            { value: 'yes', label: yesLabel },
            { value: 'no', label: noLabel }
          ].map((choice, idx) => {
            const isSelected = currentAnswer === choice.value

            return (
              <button
                key={choice.value}
                onClick={() => {
                  onAnswer(choice.value)
                  setTimeout(() => onNext(true, choice.value), 300)
                }}
                className="w-full flex items-center px-4 py-3 border-2 transition-all hover:scale-[1.02]"
                style={{
                  borderColor: isSelected
                    ? themeProps.buttonsBgColor
                    : themeProps.answersColor + '30',
                  backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                  borderRadius: buttonBorderRadius,
                }}
              >
                {showLetters && (
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
                )}
                <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // Rendu de la question de répétition
  if (isShowingRepeatQuestion && repeaterState) {
    const yesLabel = block.attributes.repeatYesLabel || 'Oui'
    const noLabel = block.attributes.repeatNoLabel || 'Non'
    const question = block.attributes.repeatQuestion || 'Voulez-vous ajouter une autre entrée ?'

    return (
      <div>
        <div className="flex items-center mb-2">
          <span
            className="text-sm font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: '#f97316' + '20',
              color: '#f97316',
            }}
          >
            Répétition {repeaterState.repetitionCount}
          </span>
        </div>

        <h2
          className="text-2xl md:text-3xl font-medium leading-tight"
          style={{ color: themeProps.questionsColor }}
        >
          {replaceVariables(question, allBlocks, answers, index)}
        </h2>

        {block.attributes.repeatDescription && (
          <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
            {replaceVariables(block.attributes.repeatDescription, allBlocks, answers, index, repeaterState.repetitionCount, block.id)}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {[
            { value: 'yes', label: yesLabel },
            { value: 'no', label: noLabel }
          ].map((choice, idx) => {
            const isSelected = currentAnswer === choice.value

            return (
              <button
                key={choice.value}
                onClick={() => {
                  onAnswer(choice.value)
                  setTimeout(() => onNext(true, choice.value), 300)
                }}
                className="w-full flex items-center px-4 py-3 border-2 transition-all hover:scale-[1.02]"
                style={{
                  borderColor: isSelected
                    ? themeProps.buttonsBgColor
                    : themeProps.answersColor + '30',
                  backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                  borderRadius: buttonBorderRadius,
                }}
              >
                {showLetters && (
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
                )}
                <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
              </button>
            )
          })}
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  // Rendu d'un bloc interne
  if (currentInnerBlock && repeaterState) {
    return (
      <div>
        {!currentInnerBlock.attributes.hideLabel && (
          <div className="flex items-center mb-2 gap-2">
            <span
              className="text-sm font-medium px-2 py-1 rounded"
              style={{
                backgroundColor: '#f97316' + '20',
                color: '#f97316',
              }}
            >
              Répétition {repeaterState.repetitionCount}
            </span>
            {showNumber && (
              <span
                className="text-sm font-medium px-2 py-1 rounded"
                style={{
                  backgroundColor: themeProps.buttonsBgColor + '20',
                  color: themeProps.buttonsBgColor,
                }}
              >
                {repeaterState.currentInnerIndex + 1} / {innerBlocks.length}
              </span>
            )}
            {currentInnerBlock.attributes.required && <span className="text-red-500 text-sm">*</span>}
          </div>
        )}

        {!currentInnerBlock.attributes.hideLabel && (
          <h2
            className="text-2xl md:text-3xl font-medium leading-tight"
            style={{ color: themeProps.questionsColor }}
          >
            {replaceVariables(currentInnerBlock.attributes.label || 'Question sans titre', allBlocks, answers, index, repeaterState.repetitionCount, block.id, repeaterState.currentInnerIndex)}
          </h2>
        )}

        {currentInnerBlock.attributes.description && (
          <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
            {replaceVariables(currentInnerBlock.attributes.description, allBlocks, answers, index, repeaterState.repetitionCount, block.id, repeaterState.currentInnerIndex)}
          </p>
        )}

        {/* Input du bloc interne */}
        <InnerBlockInput
          block={currentInnerBlock}
          showLetters={showLetters}
          themeProps={themeProps}
          answer={currentAnswer}
          onAnswer={onAnswer}
          onNext={onNext}
          error={error}
          inputStyle={inputStyle}
          allAnswers={answers}
        />

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {/* Bouton OK pour les champs texte */}
        {['short-text', 'long-text', 'email', 'number', 'website', 'date', 'advanced-date', 'slider'].includes(
          currentInnerBlock.type
        ) && (
          <div className="mt-4">
            <button
              onClick={() => onNext()}
              disabled={isSubmitting || (currentInnerBlock.attributes.required && !currentAnswer)}
              className="px-6 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              OK
              <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
            </button>
          </div>
        )}

        {/* Bouton OK pour les choix multiples */}
        {['multiple-choice', 'dropdown'].includes(currentInnerBlock.type) &&
          (currentInnerBlock.attributes.allowMultiple || currentInnerBlock.attributes.multiple) &&
          (currentAnswer || []).length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => onNext()}
                disabled={isSubmitting}
                className="px-6 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
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

  return null
}

// Composant pour le rendu des inputs des blocs internes
interface InnerBlockInputProps {
  block: FormBlock
  showLetters: boolean
  themeProps: ThemeProperties
  answer: any
  onAnswer: (value: any) => void
  onNext: (skipValidation?: boolean) => void
  error: string | null
  inputStyle?: React.CSSProperties
  buttonBorderRadius?: string
  allAnswers?: Record<string, any>
}

function InnerBlockInput({
  block,
  showLetters,
  themeProps,
  answer,
  onAnswer,
  onNext,
  error,
  inputStyle = {},
  buttonBorderRadius = '8px',
  allAnswers = {},
}: InnerBlockInputProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  switch (block.type) {
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
          autoFocus
          className="mt-4 w-full bg-transparent border-2 py-2 px-3 text-lg outline-none transition-colors focus:border-opacity-100"
          style={{
            color: themeProps.answersColor,
            borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
            ...inputStyle,
          }}
        />
      )

    case 'phone':
      return (
        <input
          type="tel"
          placeholder={block.attributes.placeholder || '+33 6 12 34 56 78'}
          value={answer || ''}
          onChange={(e) => onAnswer(e.target.value)}
          autoFocus
          className="mt-4 w-full bg-transparent border-2 py-2 px-3 text-lg outline-none transition-colors focus:border-opacity-100"
          style={{
            color: themeProps.answersColor,
            borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
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
          autoFocus
          className="mt-4 w-full bg-transparent border-2 py-2 px-3 text-lg outline-none resize-none transition-colors focus:border-opacity-100"
          style={{
            color: themeProps.answersColor,
            borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
            ...inputStyle,
          }}
        />
      )

    case 'dropdown':
      const innerDropdownChoices = block.attributes.choices || []
      return (
        <div className="mt-4 relative">
          <select
            value={answer || ''}
            onChange={(e) => {
              onAnswer(e.target.value)
              if (e.target.value) {
                setTimeout(() => onNext(true), 300)
              }
            }}
            className="w-full bg-transparent border-2 py-3 px-4 text-lg outline-none appearance-none cursor-pointer transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
              borderRadius: buttonBorderRadius,
              ...inputStyle,
            }}
          >
            <option value="" style={{ color: '#999' }}>
              {block.attributes.placeholder || 'Sélectionnez une option...'}
            </option>
            {innerDropdownChoices.map((choice: any) => (
              <option key={choice.id || choice.value} value={choice.value} style={{ color: '#333' }}>
                {choice.label}
              </option>
            ))}
          </select>
          <ChevronDown 
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" 
            style={{ color: themeProps.answersColor }}
            size={20}
          />
        </div>
      )

    case 'multiple-choice':
      const innerChoices = block.attributes.choices || []
      const innerAllowMultiple = block.attributes.allowMultiple || block.attributes.multiple
      return (
        <div className="mt-4 space-y-2">
          {innerChoices.map((choice: any, idx: number) => {
            const isSelected = innerAllowMultiple
              ? (answer || []).includes(choice.value)
              : answer === choice.value

            return (
              <button
                key={choice.value}
                onClick={() => {
                  if (innerAllowMultiple) {
                    const current = answer || []
                    if (isSelected) {
                      onAnswer(current.filter((v: string) => v !== choice.value))
                    } else {
                      onAnswer([...current, choice.value])
                    }
                  } else {
                    onAnswer(choice.value)
                    setTimeout(() => onNext(true), 300)
                  }
                }}
                className="w-full flex items-center px-4 py-3 border-2 transition-all hover:scale-[1.02]"
                style={{
                  borderColor: isSelected
                    ? themeProps.buttonsBgColor
                    : themeProps.answersColor + '30',
                  backgroundColor: isSelected ? themeProps.buttonsBgColor + '10' : 'transparent',
                  borderRadius: buttonBorderRadius,
                }}
              >
                {showLetters && (
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
                )}
                <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
              </button>
            )
          })}
        </div>
      )

    case 'date':
      return (
        <input
          type="date"
          value={answer || ''}
          onChange={(e) => onAnswer(e.target.value)}
          className="mt-4 bg-transparent border-b-2 py-2 text-lg outline-none"
          style={{
            color: themeProps.answersColor,
            borderColor: error ? '#ef4444' : themeProps.buttonsBgColor + '60',
          }}
        />
      )

    case 'advanced-date':
      // Calculer les dates min/max en fonction de la configuration
      const getComputedDateInner = (
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
          if (blockValue && typeof blockValue === 'string' && blockValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = blockValue.split('-').map(Number)
            baseDate = new Date(y, m - 1, d)
          }
        }
        
        if (baseDate && !isNaN(baseDate.getTime())) {
          if (offset) {
            baseDate.setDate(baseDate.getDate() + offset)
          }
          // Formater manuellement pour éviter les problèmes de fuseau horaire
          return `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`
        }
        
        return undefined
      }
      
      const innerMinDate = getComputedDateInner(
        block.attributes.minDateType,
        block.attributes.minDate,
        block.attributes.minDateBlockId,
        block.attributes.minDateOffset
      )
      
      const innerMaxDate = getComputedDateInner(
        block.attributes.maxDateType,
        block.attributes.maxDate,
        block.attributes.maxDateBlockId,
        block.attributes.maxDateOffset
      )
      
      return (
        <AdvancedDateCalendar
          value={answer}
          onChange={onAnswer}
          minDate={innerMinDate}
          maxDate={innerMaxDate}
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
            className="w-full"
            style={{ accentColor: themeProps.buttonsBgColor }}
          />
          <div className="flex justify-between mt-2 text-sm" style={{ color: themeProps.answersColor }}>
            <span>{min}</span>
            <span className="font-medium text-lg">{answer || min}</span>
            <span>{max}</span>
          </div>
        </div>
      )

    default:
      return null
  }
}

// Composant Calendrier pour le bloc Date Avancée
interface AdvancedDateCalendarProps {
  value: string | { start: string; end: string } | undefined
  onChange: (value: string | { start: string; end: string }) => void
  minDate?: string
  maxDate?: string
  themeProps: ThemeProperties
  isDateRange?: boolean
  startDateLabel?: string
  endDateLabel?: string
}

function AdvancedDateCalendar({ 
  value, 
  onChange, 
  minDate, 
  maxDate, 
  themeProps, 
  isDateRange = false,
  startDateLabel = 'Date de début',
  endDateLabel = 'Date de fin'
}: AdvancedDateCalendarProps) {
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
        // Parser la date manuellement pour éviter les problèmes de fuseau horaire
        const [startYear, startMonth, startDay] = rangeValue.start.split('-').map(Number)
        if (startYear === year && startMonth - 1 === month && startDay === day) {
          return 'start'
        }
      }
      if (rangeValue.end) {
        const [endYear, endMonth, endDay] = rangeValue.end.split('-').map(Number)
        if (endYear === year && endMonth - 1 === month && endDay === day) {
          return 'end'
        }
      }
      return false
    }
    
    if (!singleValue) return false
    // Parser la date manuellement pour éviter les problèmes de fuseau horaire
    const [selYear, selMonth, selDay] = singleValue.split('-').map(Number)
    return selYear === year && selMonth - 1 === month && selDay === day ? 'single' : false
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
    
    // Formater manuellement pour éviter les problèmes de fuseau horaire avec toISOString()
    const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    if (isDateRange) {
      if (rangeSelection === 'start') {
        const newRange: { start: string; end?: string } = { start: formatted }
        if (rangeValue.end) {
          const endDate = new Date(rangeValue.end)
          if (new Date(year, month, day) <= endDate) {
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
      {/* Sélecteur pour plage de dates */}
      {isDateRange && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setRangeSelection('start')}
            className="flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium"
            style={{
              borderColor: rangeSelection === 'start' ? themeProps.buttonsBgColor : themeProps.answersColor + '40',
              backgroundColor: rangeSelection === 'start' ? themeProps.buttonsBgColor + '10' : 'transparent',
              color: themeProps.answersColor,
            }}
          >
            <div className="text-xs opacity-70 mb-1">{startDateLabel}</div>
            <div>{rangeValue.start ? new Date(rangeValue.start).toLocaleDateString('fr-FR') : '—'}</div>
          </button>
          <button
            type="button"
            onClick={() => setRangeSelection('end')}
            className="flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium"
            style={{
              borderColor: rangeSelection === 'end' ? themeProps.buttonsBgColor : themeProps.answersColor + '40',
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
        style={{ 
          backgroundColor: themeProps.backgroundColor || '#ffffff',
          border: `1px solid ${themeProps.answersColor}20`,
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        {/* Header avec navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear() - 1, displayMonth.getMonth(), 1))}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeProps.answersColor, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeProps.answersColor, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            >
              ‹
            </button>
          </div>
          
          <span 
            style={{ fontWeight: 500, fontSize: '18px', color: themeProps.questionsColor }}
          >
            {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeProps.answersColor, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear() + 1, displayMonth.getMonth(), 1))}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeProps.answersColor, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
            >
              »
            </button>
          </div>
        </div>

        {/* Calendrier en tableau HTML */}
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {daysOfWeek.map((day, idx) => (
                <th
                  key={day}
                  style={{ 
                    padding: '8px 0',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: idx >= 5 ? '#ef4444' : themeProps.answersColor + '80'
                  }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, weekIdx) => (
              <tr key={weekIdx}>
                {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((d, dayIdx) => {
                  const disabled = isDateDisabled(d.year, d.month, d.day)
                  const selected = isDateSelected(d.year, d.month, d.day)
                  const inRange = isInRange(d.year, d.month, d.day)
                  const todayDate = isToday(d.year, d.month, d.day)
                  const weekend = isWeekend(d.year, d.month, d.day)
                  
                  return (
                    <td
                      key={dayIdx}
                      onClick={() => !disabled && handleDateClick(d.year, d.month, d.day)}
                      style={{
                        padding: '4px',
                        textAlign: 'center',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '36px',
                          fontSize: '14px',
                          borderRadius: '4px',
                          opacity: !d.isCurrentMonth ? 0.3 : disabled ? 0.3 : 1,
                          fontWeight: todayDate && !selected ? 'bold' : 'normal',
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
                          boxShadow: selected ? `0 0 0 2px ${themeProps.buttonsBgColor}` : 'none',
                        }}
                      >
                        {d.day}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Légende */}
        {(minDate || maxDate) && (
          <div className="mt-4 pt-3 border-t text-xs flex flex-wrap gap-3" style={{ borderColor: themeProps.answersColor + '20' }}>
            {minDate && (
              <span style={{ color: themeProps.answersColor + '80' }}>
                Min: {new Date(minDate).toLocaleDateString('fr-FR')}
              </span>
            )}
            {maxDate && (
              <span style={{ color: themeProps.answersColor + '80' }}>
                Max: {new Date(maxDate).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Affichage de la date sélectionnée */}
      {!isDateRange && singleValue && (
        <div className="mt-3 text-lg text-center" style={{ color: themeProps.answersColor }}>
          Date sélectionnée : <strong>{new Date(singleValue).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        </div>
      )}
      
      {/* Affichage de la plage sélectionnée */}
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

// Composant pour le contenu du welcome-screen (utilisé avec les layouts split)
interface WelcomeScreenContentProps {
  block: FormBlock
  themeProps: ThemeProperties
  onNext: () => void
  buttonBorderRadius: string
}

function WelcomeScreenContent({ block, themeProps, onNext, buttonBorderRadius }: WelcomeScreenContentProps) {
  return (
    <div>
      <h1
        className="text-3xl md:text-4xl font-bold leading-tight"
        style={{ color: themeProps.questionsColor }}
      >
        {block.attributes.label || 'Bienvenue'}
      </h1>

      {block.attributes.description && (
        <p className="mt-4 text-lg" style={{ color: themeProps.answersColor }}>
          {block.attributes.description}
        </p>
      )}

      <div className="mt-8">
        <button
          onClick={() => onNext()}
          className="px-8 py-3 font-medium transition-opacity hover:opacity-90 flex items-center"
          style={{
            backgroundColor: themeProps.buttonsBgColor,
            color: themeProps.buttonsFontColor,
            borderRadius: buttonBorderRadius,
          }}
        >
          {block.attributes.buttonText || 'Commencer'}
          <ChevronDown className="w-5 h-5 ml-2 rotate-[-90deg]" />
        </button>
      </div>
    </div>
  )
}
