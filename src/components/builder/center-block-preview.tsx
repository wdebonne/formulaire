'use client'

import { useState, useEffect } from 'react'
import type { FormBlock, Theme } from '@/types/form'
import { useFormBuilder } from '@/stores/form-builder'
import { Check } from 'lucide-react'

interface CenterBlockPreviewProps {
  block: FormBlock | null
  theme: Theme | null
  blockIndex?: number
  totalBlocks?: number
}

export function CenterBlockPreview({ block, theme, blockIndex = 0, totalBlocks = 1 }: CenterBlockPreviewProps) {
  const { settings, blocks } = useFormBuilder()
  
  // Calculate total question blocks (excluding thank you screens)
  const questionBlocks = blocks.filter((b) => b.type !== 'thankyou-screen')
  const total = totalBlocks || questionBlocks.length || 1
  const progress = ((blockIndex + 1) / total) * 100
  const [selectedChoices, setSelectedChoices] = useState<string[]>([])

  // Reset selection when block changes
  useEffect(() => {
    setSelectedChoices([])
  }, [block?.id])
  
  const themeProps = theme?.properties || {
    backgroundColor: '#ffffff',
    questionsColor: '#000000',
    answersColor: '#4a4a4a',
    buttonsBgColor: '#7c3aed',
    buttonsFontColor: '#ffffff',
    font: 'Inter',
  }

  // Create gradient background
  const gradientBg = `linear-gradient(135deg, ${themeProps.backgroundColor} 0%, ${themeProps.buttonsBgColor}15 50%, ${themeProps.backgroundColor} 100%)`

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  if (!block) {
    return (
      <div 
        className="flex-1 flex items-center justify-center"
        style={{ background: gradientBg }}
      >
        <div className="text-center text-gray-400">
          <p className="text-lg">Sélectionnez un bloc pour voir l'aperçu</p>
          <p className="text-sm mt-2">ou ajoutez un nouveau bloc depuis la barre latérale</p>
        </div>
      </div>
    )
  }

  // Fonction pour rendre les inputs des blocs internes (pour les groupes)
  const renderInnerBlockInput = (innerBlock: FormBlock) => {
    switch (innerBlock.type) {
      case 'short-text':
      case 'email':
      case 'number':
      case 'phone':
        return (
          <input
            type="text"
            readOnly
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre réponse ici...'}
            className="w-full max-w-md bg-transparent border-b-2 py-2 text-lg outline-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'long-text':
        return (
          <textarea
            readOnly
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre réponse ici...'}
            rows={2}
            className="w-full max-w-lg bg-transparent border-b-2 py-2 text-lg outline-none resize-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            className="bg-transparent border-b-2 py-2 text-lg outline-none"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'dropdown':
        const ddChoices = innerBlock.attributes.choices || []
        const ddId = `dropdown-inner-${innerBlock.id}`
        return (
          <div className="max-w-md">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                list={ddId}
                placeholder="Tapez pour rechercher ou ajouter..."
                className="flex-1 px-4 py-3 rounded-lg border-2 text-base bg-no-repeat outline-none transition-colors focus:border-opacity-100"
                style={{
                  borderColor: themeProps.answersColor + '30',
                  backgroundColor: themeProps.backgroundColor,
                  color: themeProps.answersColor,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(themeProps.answersColor || '#000')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px',
                  paddingRight: '44px',
                }}
              />
              <button
                className="px-4 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                }}
              >
                OK
              </button>
            </div>
            <datalist id={ddId}>
              {ddChoices.map((choice: any, idx: number) => (
                <option key={choice.id || idx} value={choice.label} />
              ))}
            </datalist>
            <p className="mt-2 text-xs opacity-60" style={{ color: themeProps.answersColor }}>
              Sélectionnez une option ou entrez votre propre réponse
            </p>
          </div>
        )

      case 'multiple-choice':
        const mcChoices = innerBlock.attributes.choices || []
        const mcAllowMultiple = innerBlock.attributes.allowMultiple || false
        return (
          <div className="space-y-3 max-w-md">
            {mcChoices.map((choice: any, idx: number) => (
              <div
                key={choice.id || idx}
                className="flex items-center px-4 py-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  borderColor: themeProps.answersColor + '30',
                  backgroundColor: themeProps.backgroundColor,
                }}
              >
                {settings.lettersOnAnswers ? (
                  <span
                    className="w-7 h-7 rounded flex items-center justify-center text-sm font-medium mr-4 transition-colors"
                    style={{
                      backgroundColor: themeProps.answersColor + '15',
                      color: themeProps.answersColor,
                    }}
                  >
                    {letters[idx]}
                  </span>
                ) : (
                  <span
                    className="w-6 h-6 rounded border-2 flex items-center justify-center mr-4 transition-colors"
                    style={{
                      borderColor: themeProps.answersColor + '40',
                      backgroundColor: 'transparent',
                    }}
                  />
                )}
                <span className="text-base" style={{ color: themeProps.answersColor }}>
                  {choice.label}
                </span>
              </div>
            ))}
            {mcAllowMultiple && (
              <p className="text-xs opacity-60 mt-2" style={{ color: themeProps.answersColor }}>
                Vous pouvez sélectionner plusieurs options
              </p>
            )}
          </div>
        )

      case 'slider':
        const min = innerBlock.attributes.min || 0
        const max = innerBlock.attributes.max || 10
        return (
          <div className="max-w-md">
            <input
              type="range"
              min={min}
              max={max}
              defaultValue={innerBlock.attributes.defaultValue || min}
              className="w-full"
            />
            <div className="flex justify-between text-xs opacity-60" style={{ color: themeProps.answersColor }}>
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const renderInput = () => {
    switch (block.type) {
      case 'welcome-screen':
        return (
          <div className="mt-8">
            <button
              className="px-8 py-3 rounded-md text-base font-medium transition-all hover:opacity-90 hover:scale-105 flex items-center gap-2"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
              }}
            >
              {block.attributes.buttonText || 'Commencer'}
              <span className="opacity-70">→</span>
            </button>
          </div>
        )

      case 'thankyou-screen':
        return (
          <div className="mt-6">
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
        )

      case 'short-text':
      case 'email':
      case 'number':
      case 'phone':
        return (
          <input
            type="text"
            readOnly
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            className="mt-6 w-full max-w-md bg-transparent border-b-2 py-3 text-xl outline-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'long-text':
        return (
          <textarea
            readOnly
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            rows={3}
            className="mt-6 w-full max-w-lg bg-transparent border-b-2 py-3 text-xl outline-none resize-none transition-colors"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'dropdown':
        const dropdownChoices = block.attributes.choices || []
        const dropdownId = `dropdown-${block.id}`
        return (
          <div className="mt-6 max-w-md relative">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                list={dropdownId}
                placeholder="Tapez pour rechercher ou ajouter..."
                className="flex-1 px-4 py-3 rounded-lg border-2 text-base bg-no-repeat outline-none transition-colors focus:border-opacity-100"
                style={{
                  borderColor: themeProps.answersColor + '30',
                  backgroundColor: themeProps.backgroundColor,
                  color: themeProps.answersColor,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(themeProps.answersColor || '#000')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px',
                  paddingRight: '44px',
                }}
              />
              <button
                className="px-4 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                }}
              >
                OK
              </button>
            </div>
            <datalist id={dropdownId}>
              {dropdownChoices.map((choice: any, idx: number) => (
                <option key={choice.id || idx} value={choice.label} />
              ))}
            </datalist>
            <p className="mt-2 text-xs opacity-60" style={{ color: themeProps.answersColor }}>
              Sélectionnez une option ou entrez votre propre réponse
            </p>
          </div>
        )

      case 'multiple-choice':
        const choices = block.attributes.choices || []
        const allowMultiple = block.attributes.allowMultiple || false

        const handleChoiceClick = (choiceId: string) => {
          if (allowMultiple) {
            // Multiple selection
            setSelectedChoices(prev => 
              prev.includes(choiceId) 
                ? prev.filter(id => id !== choiceId)
                : [...prev, choiceId]
            )
          } else {
            // Single selection
            setSelectedChoices(prev => 
              prev.includes(choiceId) ? [] : [choiceId]
            )
          }
        }

        return (
          <div className="mt-6 space-y-3 max-w-md">
            {choices.map((choice: any, idx: number) => {
              const isSelected = selectedChoices.includes(choice.id)
              return (
                <div
                  key={choice.id || idx}
                  onClick={() => handleChoiceClick(choice.id)}
                  className="flex items-center px-4 py-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '30',
                    backgroundColor: isSelected ? themeProps.buttonsBgColor + '15' : themeProps.backgroundColor,
                  }}
                >
                  {settings.lettersOnAnswers ? (
                    <span
                      className="w-7 h-7 rounded flex items-center justify-center text-sm font-medium mr-4 transition-colors"
                      style={{
                        backgroundColor: isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '15',
                        color: isSelected ? themeProps.buttonsFontColor : themeProps.answersColor,
                      }}
                    >
                      {isSelected ? <Check className="w-4 h-4" /> : letters[idx]}
                    </span>
                  ) : (
                    <span
                      className="w-6 h-6 rounded border-2 flex items-center justify-center mr-4 transition-colors"
                      style={{
                        borderColor: isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '40',
                        backgroundColor: isSelected ? themeProps.buttonsBgColor : 'transparent',
                      }}
                    >
                      {isSelected && <Check className="w-4 h-4" style={{ color: themeProps.buttonsFontColor }} />}
                    </span>
                  )}
                  <span className="text-base" style={{ color: themeProps.answersColor }}>
                    {choice.label}
                  </span>
                </div>
              )
            })}
            {allowMultiple && (
              <>
                <p className="text-xs opacity-60 mt-2" style={{ color: themeProps.answersColor }}>
                  Vous pouvez sélectionner plusieurs options
                </p>
                <button
                  className="mt-4 px-6 py-2 rounded-md font-medium transition-opacity hover:opacity-90 flex items-center disabled:opacity-50"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                  }}
                  disabled={selectedChoices.length === 0}
                >
                  OK
                  <span className="ml-2 text-xs opacity-70">Entrée ↵</span>
                </button>
              </>
            )}
          </div>
        )

      case 'date':
        return (
          <div className="mt-6">
            <input
              type="text"
              readOnly
              placeholder={block.attributes.format || 'DD/MM/YYYY'}
              className="w-full max-w-xs bg-transparent border-b-2 py-3 text-xl outline-none"
              style={{
                color: themeProps.answersColor,
                borderColor: themeProps.buttonsBgColor + '60',
              }}
            />
          </div>
        )

      case 'slider':
        const min = block.attributes.min || 0
        const max = block.attributes.max || 10
        const defaultValue = block.attributes.defaultValue || min
        return (
          <div className="mt-8 w-full max-w-md">
            <input
              type="range"
              readOnly
              min={min}
              max={max}
              value={defaultValue}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: themeProps.buttonsBgColor }}
            />
            <div className="flex justify-between mt-3 text-sm" style={{ color: themeProps.answersColor }}>
              <span>{min}</span>
              <span 
                className="text-xl font-semibold px-4 py-1 rounded-lg"
                style={{ 
                  backgroundColor: themeProps.buttonsBgColor + '15',
                  color: themeProps.buttonsBgColor 
                }}
              >
                {defaultValue}
              </span>
              <span>{max}</span>
            </div>
          </div>
        )

      case 'legal':
        return (
          <div className="mt-6">
            <label className="flex items-start cursor-pointer group">
              <div 
                className="w-6 h-6 rounded border-2 mr-4 flex items-center justify-center transition-colors group-hover:border-opacity-100"
                style={{ borderColor: themeProps.buttonsBgColor }}
              >
              </div>
              <span className="text-base" style={{ color: themeProps.answersColor }}>
                {block.attributes.checkboxLabel || "J'accepte les conditions"}
              </span>
            </label>
          </div>
        )

      case 'statement':
        return (
          <div className="mt-8">
            <button
              className="px-8 py-3 rounded-md text-base font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
              }}
            >
              {block.attributes.buttonText || 'Continuer'}
            </button>
          </div>
        )

      case 'file':
        return (
          <div 
            className="mt-6 border-2 border-dashed rounded-xl p-8 text-center max-w-md transition-colors hover:border-opacity-100"
            style={{ borderColor: themeProps.buttonsBgColor + '60' }}
          >
            <div className="text-4xl mb-3">📎</div>
            <p className="text-base" style={{ color: themeProps.answersColor }}>
              Glissez un fichier ici ou cliquez pour parcourir
            </p>
          </div>
        )

      case 'signature':
        return (
          <div 
            className="mt-6 border-2 border-dashed rounded-xl p-8 text-center max-w-md"
            style={{ borderColor: themeProps.buttonsBgColor + '60' }}
          >
            <div className="text-4xl mb-3">✍️</div>
            <p className="text-base" style={{ color: themeProps.answersColor }}>
              Signez dans cette zone
            </p>
          </div>
        )

      case 'group':
        // Le bloc groupe affiche plusieurs questions sur une même page
        return null // Le rendu du groupe est fait dans le composant principal

      case 'repeater':
        // Le bloc repeater est similaire au groupe mais avec la question Oui/Non
        return null // Le rendu du repeater est fait dans le composant principal

      default:
        return null
    }
  }

  const progressBarPosition = settings.progressBarPosition ?? 'top'
  const progressBarSize = settings.progressBarSize ?? 'small'
  const showProgressBar = (settings.showProgressBar ?? true) && block && block.type !== 'welcome-screen' && block.type !== 'thankyou-screen'
  const isVerticalBar = progressBarPosition === 'left' || progressBarPosition === 'right'

  // Tailles de la barre de progression
  const barSizes = {
    small: isVerticalBar ? 'w-1' : 'h-1',
    medium: isVerticalBar ? 'w-2' : 'h-2',
    large: isVerticalBar ? 'w-3' : 'h-3',
  }

  const VerticalProgressBar = ({ position }: { position: 'left' | 'right' }) => (
    <div 
      className={`${barSizes[progressBarSize]} bg-gray-200/50 shrink-0 relative`}
    >
      <div
        className="w-full transition-all duration-300 absolute bottom-0"
        style={{ height: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
      />
    </div>
  )

  return (
    <div 
      className="flex-1 flex flex-col transition-all duration-300"
      style={{ 
        background: gradientBg,
        fontFamily: themeProps.font || 'Inter',
      }}
    >
      {/* Progress bar - Top */}
      {showProgressBar && progressBarPosition === 'top' && (
        <div className={`${barSizes[progressBarSize]} bg-gray-200/50 w-full shrink-0`}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
          />
        </div>
      )}

      {/* Main content area with optional left/right progress bars */}
      <div className="flex-1 flex min-h-0">
        {/* Progress bar - Left */}
        {showProgressBar && progressBarPosition === 'left' && (
          <VerticalProgressBar position="left" />
        )}

        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-2xl w-full">
        
        {/* Rendu spécial pour les groupes */}
        {block.type === 'group' ? (
          <div className="space-y-8">
            {block.innerBlocks?.map((innerBlock, innerIdx) => (
              <div key={innerBlock.id} className="pb-6 border-b border-gray-200/30 last:border-0">
                {/* Question number for inner block */}
                {settings.showQuestionNumbers && innerBlock.type !== 'statement' && (
                  <div className="flex items-center mb-3">
                    <span
                      className="text-sm font-semibold px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: themeProps.buttonsBgColor + '20',
                        color: themeProps.buttonsBgColor,
                      }}
                    >
                      {blockIndex + 1}{letters[innerIdx]}
                    </span>
                    {innerBlock.attributes.required && (
                      <span className="ml-2 text-red-500 text-lg">*</span>
                    )}
                  </div>
                )}

                {/* Inner block title */}
                <h2
                  className="text-xl md:text-2xl font-semibold leading-tight"
                  style={{ color: themeProps.questionsColor }}
                >
                  {innerBlock.attributes.label || 'Question sans titre'}
                </h2>

                {/* Inner block description */}
                {innerBlock.attributes.description && (
                  <p 
                    className="mt-2 text-base leading-relaxed opacity-80" 
                    style={{ color: themeProps.answersColor }}
                  >
                    {innerBlock.attributes.description}
                  </p>
                )}

                {/* Inner block input */}
                <div className="mt-3">
                  {renderInnerBlockInput(innerBlock)}
                </div>
              </div>
            ))}
            
            {/* OK button for group */}
            <div className="mt-4 pt-4">
              <button
                className="px-6 py-2 rounded-md font-medium transition-all hover:opacity-90 flex items-center gap-2"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                }}
              >
                OK
                <span className="text-xs opacity-70 ml-1">Entrée ↵</span>
              </button>
            </div>
          </div>
        ) : block.type === 'repeater' ? (
          <div className="space-y-6">
            {/* Question initiale Oui/Non */}
            <div className="p-6 border-2 border-orange-300 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="flex items-center gap-2 mb-4">
                <span 
                  className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-600"
                >
                  Question initiale
                </span>
              </div>
              
              <h3
                className="text-xl md:text-2xl font-semibold leading-tight mb-4"
                style={{ color: themeProps.questionsColor }}
              >
                {block.attributes.initialQuestion || block.attributes.label || 'Voulez-vous ajouter un élément ?'}
              </h3>

              {block.attributes.description && (
                <p 
                  className="mb-4 text-sm leading-relaxed opacity-80" 
                  style={{ color: themeProps.answersColor }}
                >
                  {block.attributes.description}
                </p>
              )}
              
              <div className="flex gap-3">
                <button
                  className="flex-1 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                  }}
                >
                  {block.attributes.initialYesLabel || 'Oui'} → Continuer
                </button>
                <button
                  className="flex-1 px-6 py-3 rounded-lg font-medium border-2 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: themeProps.answersColor + '40',
                    color: themeProps.answersColor,
                    backgroundColor: 'transparent',
                  }}
                >
                  {block.attributes.initialNoLabel || 'Non'} → Passer
                </button>
              </div>
            </div>

            {/* Aperçu des questions du groupe répétable (si Oui) */}
            {block.innerBlocks && block.innerBlocks.length > 0 && (
              <div className="p-6 border-2 border-orange-200 rounded-xl bg-orange-50/30">
                <div className="flex items-center gap-2 mb-4">
                  <span 
                    className="text-xs font-medium px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: themeProps.buttonsBgColor + '15',
                      color: themeProps.buttonsBgColor,
                    }}
                  >
                    Élément #1
                  </span>
                </div>
                
                {block.innerBlocks?.map((innerBlock, innerIdx) => (
                  <div key={innerBlock.id} className="pb-4 mb-4 border-b border-orange-200/50 last:border-0 last:mb-0 last:pb-0">
                    {/* Question number for inner block */}
                    {settings.showQuestionNumbers && innerBlock.type !== 'statement' && (
                      <div className="flex items-center mb-2">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: themeProps.buttonsBgColor + '20',
                            color: themeProps.buttonsBgColor,
                          }}
                        >
                          {innerIdx + 1}
                        </span>
                        {innerBlock.attributes.required && (
                          <span className="ml-2 text-red-500">*</span>
                        )}
                      </div>
                    )}

                    {/* Inner block title */}
                    <h3
                      className="text-lg md:text-xl font-medium leading-tight"
                      style={{ color: themeProps.questionsColor }}
                    >
                      {innerBlock.attributes.label || 'Question sans titre'}
                    </h3>

                    {/* Inner block description */}
                    {innerBlock.attributes.description && (
                      <p 
                        className="mt-1 text-sm leading-relaxed opacity-80" 
                        style={{ color: themeProps.answersColor }}
                      >
                        {innerBlock.attributes.description}
                      </p>
                    )}

                    {/* Inner block input */}
                    <div className="mt-2">
                      {renderInnerBlockInput(innerBlock)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question Oui/Non pour répéter */}
            <div className="p-6 border-2 border-dashed border-orange-300 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <span 
                  className="text-xs font-medium px-2 py-1 rounded-full bg-orange-100 text-orange-600"
                >
                  Après chaque élément
                </span>
              </div>
              
              <h3
                className="text-xl md:text-2xl font-semibold leading-tight mb-4"
                style={{ color: themeProps.questionsColor }}
              >
                {block.attributes.repeatQuestion || 'Voulez-vous ajouter un autre élément ?'}
              </h3>
              
              <div className="flex gap-3">
                <button
                  className="flex-1 px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                  }}
                >
                  {block.attributes.repeatYesLabel || 'Oui'}
                </button>
                <button
                  className="flex-1 px-6 py-3 rounded-lg font-medium border-2 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: themeProps.answersColor + '40',
                    color: themeProps.answersColor,
                    backgroundColor: 'transparent',
                  }}
                >
                  {block.attributes.repeatNoLabel || 'Non'}
                </button>
              </div>

              <p className="mt-3 text-xs text-center opacity-60" style={{ color: themeProps.answersColor }}>
                Max. {block.attributes.maxRepetitions || 10} répétitions
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Question number */}
            {settings.showQuestionNumbers && block.type !== 'welcome-screen' && block.type !== 'thankyou-screen' && block.type !== 'statement' && (
              <div className="flex items-center mb-4">
                <span
                  className="text-sm font-semibold px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor + '20',
                    color: themeProps.buttonsBgColor,
                  }}
                >
                  {blockIndex + 1}
                </span>
                {block.attributes.required && (
                  <span className="ml-2 text-red-500 text-lg">*</span>
                )}
              </div>
            )}

            {/* Required indicator when no question numbers */}
            {!settings.showQuestionNumbers && block.attributes.required && block.type !== 'welcome-screen' && block.type !== 'thankyou-screen' && block.type !== 'statement' && (
              <div className="flex items-center mb-4">
                <span className="text-red-500 text-lg">*</span>
              </div>
            )}

            {/* Question text */}
            <h1
              className="text-3xl md:text-4xl font-semibold leading-tight"
              style={{ color: themeProps.questionsColor }}
            >
              {block.attributes.label || 'Question sans titre'}
            </h1>

            {/* Description */}
            {block.attributes.description && (
              <p 
                className="mt-4 text-lg leading-relaxed opacity-80" 
                style={{ color: themeProps.answersColor }}
              >
                {block.attributes.description}
              </p>
            )}

            {/* Input preview */}
            {renderInput()}

            {/* OK button for text inputs */}
            {['short-text', 'long-text', 'email', 'number', 'phone', 'date'].includes(block.type) && (
              <div className="mt-6">
                <button
                  className="px-6 py-2 rounded-md font-medium transition-all hover:opacity-90 flex items-center gap-2"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                  }}
                >
                  OK
                  <span className="text-xs opacity-70 ml-1">Entrée ↵</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Powered by */}
        {(settings.showBranding ?? true) && (
          <div className="mt-12 flex items-center gap-2 text-sm opacity-50" style={{ color: themeProps.answersColor }}>
            <span>propulsé par</span>
            <span className="font-semibold">{settings.brandingText || 'FormBuilder'}</span>
          </div>
        )}
        </div>
        </div>

        {/* Progress bar - Right */}
        {showProgressBar && progressBarPosition === 'right' && (
          <VerticalProgressBar position="right" />
        )}
      </div>

      {/* Progress bar - Bottom */}
      {showProgressBar && progressBarPosition === 'bottom' && (
        <div className={`${barSizes[progressBarSize]} bg-gray-200/50 w-full shrink-0`}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: themeProps.buttonsBgColor }}
          />
        </div>
      )}
    </div>
  )
}
