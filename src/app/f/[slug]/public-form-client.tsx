'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FormBlock, LogicRule, Webhook, ThemeProperties } from '@/types/form'
import { ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react'
import { replaceVariables } from '@/lib/utils'

interface PublicFormClientProps {
  form: {
    id: string
    title: string
    blocks: FormBlock[]
    settings: any
    logic: LogicRule[]
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
  useEffect(() => {
    const questionBlocks = allBlocks.filter((b) => b.type !== 'thankyou-screen')
    const hiddenBlockIds = new Set<string>()

    // Évaluer chaque règle de logique
    form.logic.forEach((rule) => {
      if (!rule.enabled) return

      const shouldApply = evaluateConditions(rule.conditions, rule.conditionMatch, answers)

      if (shouldApply) {
        rule.actions.forEach((action) => {
          if (action.type === 'hide') {
            hiddenBlockIds.add(action.target)
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

  const evaluateConditions = (
    conditions: LogicRule['conditions'],
    match: 'all' | 'any',
    answers: Record<string, any>
  ): boolean => {
    if (conditions.length === 0) return false

    const results = conditions.map((condition) => {
      const answer = answers[condition.blockId]
      const value = condition.value

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
    for (const rule of form.logic) {
      if (!rule.enabled) continue

      const shouldApply = evaluateConditions(rule.conditions, rule.conditionMatch, answers)

      if (shouldApply) {
        for (const action of rule.actions) {
          if (action.type === 'jump') {
            return action.target
          }
        }
      }
    }
    return null
  }, [form.logic, answers])

  const goToNext = useCallback(() => {
    if (isAnimating) return
    setError(null)

    // Gestion des blocs répétables
    if (currentBlock?.type === 'repeater') {
      const state = repeaterStates[currentBlock.id]
      const innerBlocks = currentBlock.innerBlocks || []
      
      // Question initiale: On vérifie la réponse Oui/Non
      if (!state || !state.isActive) {
        const initialAnswer = answers[`${currentBlock.id}_initial`]
        
        if (!initialAnswer) {
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
          setRepeaterStates({
            ...repeaterStates,
            [currentBlock.id]: {
              isActive: true,
              currentInnerIndex: 0,
              repetitionCount: 1,
              showRepeatQuestion: false
            }
          })
          setIsAnimating(true)
          setTimeout(() => setIsAnimating(false), 300)
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
        const repeatAnswer = answers[`${currentBlock.id}_repeat_${state.repetitionCount}`]
        
        if (!repeatAnswer) {
          setError('Veuillez répondre à la question')
          return
        }
        
        if (repeatAnswer === 'yes') {
          // On recommence une répétition
          const maxReps = currentBlock.attributes.maxRepetitions || 10
          if (state.repetitionCount < maxReps) {
            setRepeaterStates({
              ...repeaterStates,
              [currentBlock.id]: {
                ...state,
                currentInnerIndex: 0,
                repetitionCount: state.repetitionCount + 1,
                showRepeatQuestion: false
              }
            })
            setIsAnimating(true)
            setTimeout(() => setIsAnimating(false), 300)
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
        setRepeaterStates({
          ...repeaterStates,
          [currentBlock.id]: {
            ...state,
            currentInnerIndex: state.currentInnerIndex + 1
          }
        })
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 300)
      } else {
        // Fin des blocs internes, afficher la question de répétition
        setRepeaterStates({
          ...repeaterStates,
          [currentBlock.id]: {
            ...state,
            showRepeatQuestion: true
          }
        })
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 300)
      }
      return
    }

    // Vérifier si le champ est requis (pour les blocs normaux)
    if (displayBlock?.attributes.required && !answers[displayBlock.id]) {
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

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: themeProps.backgroundColor,
        fontFamily: themeProps.font || 'Inter',
      }}
    >
      {/* Progress bar */}
      {form.settings.showProgressBar !== false && (
        <div className="h-1 bg-gray-200">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
          />
        </div>
      )}

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className={`max-w-xl w-full transition-all duration-300 ${
            isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
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
            />
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 flex justify-between items-center">
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
            className="p-2 rounded-md hover:bg-black/5 transition-colors"
            style={{ color: themeProps.questionsColor }}
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
        <span className="text-sm" style={{ color: themeProps.answersColor }}>
          {currentIndex + 1} / {visibleBlocks.length}
        </span>
      </div>
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
  onNext: () => void
  isLast: boolean
  isSubmitting: boolean
  error: string | null
  allBlocks: FormBlock[]
  allAnswers: Record<string, any>
  inputStyle?: React.CSSProperties
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
}: QuestionBlockProps) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const renderInput = () => {
    switch (block.type) {
      case 'welcome-screen':
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
              {block.attributes.buttonText || 'Commencer'}
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

      case 'multiple-choice':
      case 'dropdown':
        const choices = block.attributes.choices || []
        return (
          <div className="mt-4 space-y-2">
            {choices.map((choice: any, idx: number) => {
              const isSelected = block.attributes.multiple
                ? (answer || []).includes(choice.value)
                : answer === choice.value

              return (
                <button
                  key={choice.value}
                  onClick={() => {
                    if (block.attributes.multiple) {
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
          {block.attributes.required && <span className="ml-2 text-red-500 text-sm">*</span>}
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

      {/* Error message */}
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/* OK/Submit button for text inputs */}
      {['short-text', 'long-text', 'email', 'number', 'website', 'date', 'slider'].includes(
        block.type
      ) && (
        <div className="mt-4">
          <button
            onClick={onNext}
            disabled={isSubmitting || (block.attributes.required && !answer)}
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
      )}

      {/* Submit button for multiple choice */}
      {['multiple-choice', 'dropdown'].includes(block.type) &&
        block.attributes.multiple &&
        (answer || []).length > 0 && (
          <div className="mt-4">
            <button
              onClick={onNext}
              disabled={isSubmitting}
              className="px-6 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center"
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
        )}
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
  onNext: () => void
  isLast: boolean
  isSubmitting: boolean
  error: string | null
  allBlocks: FormBlock[]
  inputStyle?: React.CSSProperties
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
          {question}
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
                  setTimeout(onNext, 300)
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
          {question}
        </h2>

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
                  setTimeout(onNext, 300)
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

        <h2
          className="text-2xl md:text-3xl font-medium leading-tight"
          style={{ color: themeProps.questionsColor }}
        >
          {currentInnerBlock.attributes.label || 'Question sans titre'}
        </h2>

        {currentInnerBlock.attributes.description && (
          <p className="mt-2 text-lg" style={{ color: themeProps.answersColor }}>
            {replaceVariables(currentInnerBlock.attributes.description, allBlocks, answers, index)}
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
        />

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {/* Bouton OK pour les champs texte */}
        {['short-text', 'long-text', 'email', 'number', 'website', 'date', 'slider'].includes(
          currentInnerBlock.type
        ) && (
          <div className="mt-4">
            <button
              onClick={onNext}
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
  onNext: () => void
  error: string | null
  inputStyle?: React.CSSProperties
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

    case 'multiple-choice':
    case 'dropdown':
      const choices = block.attributes.choices || []
      return (
        <div className="mt-4 space-y-2">
          {choices.map((choice: any, idx: number) => {
            const isSelected = block.attributes.multiple
              ? (answer || []).includes(choice.value)
              : answer === choice.value

            return (
              <button
                key={choice.value}
                onClick={() => {
                  if (block.attributes.multiple) {
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
