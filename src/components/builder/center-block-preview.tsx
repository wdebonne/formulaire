'use client'

import React, { useState, useEffect } from 'react'
import type { FormBlock, Theme } from '@/types/form'
import { useFormBuilder } from '@/stores/form-builder'
import { Check, ChevronRight } from 'lucide-react'
import { getBackgroundStyle } from '@/lib/utils'

// Helper pour extraire l'ID de vidéo YouTube
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

// Composant Calendrier simplifié pour l'aperçu du builder
interface MiniCalendarPreviewProps {
  themeProps: any
  isDateRange?: boolean
  startDateLabel?: string
  endDateLabel?: string
  minDateType?: string
  maxDateType?: string
  minDateOffset?: number
  maxDateOffset?: number
}

function MiniCalendarPreview({ 
  themeProps, 
  isDateRange = false,
  startDateLabel = 'Date de début',
  endDateLabel = 'Date de fin',
  minDateType,
  maxDateType,
  minDateOffset,
  maxDateOffset
}: MiniCalendarPreviewProps) {
  const today = new Date()
  const [displayMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  
  const daysOfWeek = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
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

  const generateCalendarDays = () => {
    const year = displayMonth.getFullYear()
    const month = displayMonth.getMonth()
    const firstDay = getFirstDayOfMonth(displayMonth)
    const daysInMonth = getDaysInMonth(displayMonth)
    const daysInPrevMonth = getDaysInMonth(new Date(year, month - 1, 1))
    
    const days: { day: number; isCurrentMonth: boolean; isToday: boolean; isWeekend: boolean }[] = []
    
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isToday: false, isWeekend: false })
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i)
      const dayOfWeek = date.getDay()
      days.push({ 
        day: i, 
        isCurrentMonth: true, 
        isToday: today.getDate() === i && today.getMonth() === month && today.getFullYear() === year,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      })
    }
    
    const remainingDays = 35 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, isToday: false, isWeekend: false })
    }
    
    return days.slice(0, 35)
  }

  const days = generateCalendarDays()
  const hasMinRestriction = minDateType && minDateType !== 'none'
  const hasMaxRestriction = maxDateType && maxDateType !== 'none'

  return (
    <div className="mt-4 w-full">
      {isDateRange && (
        <div className="flex gap-2 mb-3 max-w-md mx-auto">
          <div 
            className="flex-1 px-3 py-2 rounded-lg border-2 text-sm text-center"
            style={{
              borderColor: themeProps.buttonsBgColor,
              backgroundColor: themeProps.buttonsBgColor + '10',
              color: themeProps.answersColor,
            }}
          >
            <div className="text-xs opacity-70">{startDateLabel}</div>
            <div>—</div>
          </div>
          <div 
            className="flex-1 px-3 py-2 rounded-lg border-2 text-sm text-center"
            style={{
              borderColor: themeProps.answersColor + '30',
              color: themeProps.answersColor,
            }}
          >
            <div className="text-xs opacity-70">{endDateLabel}</div>
            <div>—</div>
          </div>
        </div>
      )}

      <div 
        className="rounded-lg shadow-lg p-3 w-full max-w-md mx-auto"
        style={{ backgroundColor: themeProps.backgroundColor || '#ffffff' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs" style={{ color: themeProps.answersColor + '60' }}>« ‹</span>
          <span className="font-medium text-sm" style={{ color: themeProps.questionsColor }}>
            {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </span>
          <span className="text-xs" style={{ color: themeProps.answersColor + '60' }}>› »</span>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day + idx}
              className="text-center text-xs py-1"
              style={{ color: idx >= 5 ? '#ef4444' : themeProps.answersColor + '60' }}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => (
            <div
              key={idx}
              className={`py-1 text-xs text-center rounded ${d.isToday ? 'font-bold' : ''}`}
              style={{
                backgroundColor: d.isToday ? '#fef08a' : 'transparent',
                color: !d.isCurrentMonth 
                  ? themeProps.answersColor + '30' 
                  : d.isWeekend 
                    ? '#ef4444' 
                    : themeProps.answersColor,
              }}
            >
              {d.day}
            </div>
          ))}
        </div>

        {(hasMinRestriction || hasMaxRestriction) && (
          <div className="flex gap-2 mt-2 pt-2 border-t flex-wrap" style={{ borderColor: themeProps.answersColor + '20' }}>
            {hasMinRestriction && (
              <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-600">
                Min: {minDateType === 'today' ? "Auj." : minDateType === 'specific' ? 'Date' : 'Var.'}
                {minDateOffset ? ` ${minDateOffset > 0 ? '+' : ''}${minDateOffset}j` : ''}
              </span>
            )}
            {hasMaxRestriction && (
              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-600">
                Max: {maxDateType === 'today' ? "Auj." : maxDateType === 'specific' ? 'Date' : 'Var.'}
                {maxDateOffset ? ` ${maxDateOffset > 0 ? '+' : ''}${maxDateOffset}j` : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

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

  // Get background style from theme (solid, gradient, or image)
  const backgroundStyle = getBackgroundStyle(themeProps)

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const borderRadiusMap: Record<string, string> = {
    none: '0',
    small: '4px',
    medium: '8px',
    large: '12px',
    full: '9999px',
  }

  const buttonBorderRadius = borderRadiusMap[themeProps.buttonsBorderRadius || 'medium'] || '8px'
  const inputBorderRadius = borderRadiusMap[themeProps.inputBorderRadius || 'medium'] || '8px'

  const getInputStyle = (): React.CSSProperties => {
    switch (themeProps.inputStyle) {
      case 'underline':
        return {
          color: themeProps.answersColor,
          border: 'none',
          borderBottom: `2px solid ${themeProps.answersColor}40`,
          borderRadius: '0',
          backgroundColor: 'transparent',
        }
      case 'filled':
        return {
          color: themeProps.answersColor,
          border: 'none',
          borderRadius: inputBorderRadius,
          backgroundColor: `${themeProps.answersColor}10`,
          paddingLeft: '16px',
          paddingRight: '16px',
        }
      default:
        return {
          color: themeProps.answersColor,
          border: `2px solid ${themeProps.answersColor}40`,
          borderRadius: inputBorderRadius,
          backgroundColor: 'transparent',
          paddingLeft: '16px',
          paddingRight: '16px',
        }
    }
  }

  const inputStyleCss = getInputStyle()
  const choicesBg = themeProps.choicesBgColor || themeProps.backgroundColor || '#ffffff'

  if (!block) {
    return (
      <div 
        className="flex-1 flex items-center justify-center"
        style={backgroundStyle}
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
            className="w-full max-w-md py-2 text-lg outline-none transition-colors"
            style={inputStyleCss}
          />
        )

      case 'long-text':
        return (
          <textarea
            readOnly
            placeholder={innerBlock.attributes.placeholder || 'Tapez votre réponse ici...'}
            rows={2}
            className="w-full max-w-lg py-2 text-lg outline-none resize-none transition-colors"
            style={inputStyleCss}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            className="py-2 text-lg outline-none"
            style={inputStyleCss}
          />
        )

      case 'advanced-date':
        return (
          <MiniCalendarPreview
            themeProps={themeProps}
            isDateRange={innerBlock.attributes.isDateRange}
            startDateLabel={innerBlock.attributes.startDateLabel}
            endDateLabel={innerBlock.attributes.endDateLabel}
            minDateType={innerBlock.attributes.minDateType}
            maxDateType={innerBlock.attributes.maxDateType}
            minDateOffset={innerBlock.attributes.minDateOffset}
            maxDateOffset={innerBlock.attributes.maxDateOffset}
          />
        )

      case 'time':
        const innerIsTimeRange = innerBlock.attributes.isTimeRange || false
        if (innerIsTimeRange) {
          return (
            <div className="max-w-md space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm w-24 shrink-0" style={{ color: themeProps.answersColor }}>
                  {innerBlock.attributes.startTimeLabel || 'Début'}
                </span>
                <div 
                  className="flex-1 flex items-center gap-2 px-4 py-2 rounded-lg border-2"
                  style={{ borderColor: themeProps.buttonsBgColor, backgroundColor: themeProps.buttonsBgColor + '10' }}
                >
                  <svg className="w-5 h-5" style={{ color: themeProps.buttonsBgColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                  </svg>
                  <span className="text-lg font-medium" style={{ color: themeProps.answersColor }}>--:--</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm w-24 shrink-0" style={{ color: themeProps.answersColor }}>
                  {innerBlock.attributes.endTimeLabel || 'Fin'}
                </span>
                <div 
                  className="flex-1 flex items-center gap-2 px-4 py-2 rounded-lg border-2"
                  style={{ borderColor: themeProps.answersColor + '30' }}
                >
                  <svg className="w-5 h-5" style={{ color: themeProps.answersColor + '60' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                    <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
                  </svg>
                  <span className="text-lg font-medium" style={{ color: themeProps.answersColor + '60' }}>--:--</span>
                </div>
              </div>
            </div>
          )
        }
        return (
          <div 
            className="max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg border-2"
            style={{ borderColor: themeProps.buttonsBgColor, backgroundColor: themeProps.buttonsBgColor + '10' }}
          >
            <svg className="w-6 h-6" style={{ color: themeProps.buttonsBgColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
            </svg>
            <span className="text-xl font-medium" style={{ color: themeProps.answersColor }}>--:--</span>
          </div>
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
                className="flex-1 px-4 py-3 text-base bg-no-repeat outline-none transition-colors"
                style={{
                  border: `2px solid ${themeProps.answersColor}30`,
                  borderRadius: inputBorderRadius,
                  backgroundColor: choicesBg,
                  color: themeProps.answersColor,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(themeProps.answersColor || '#000')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px',
                  paddingRight: '44px',
                }}
              />
              <button
                className="px-4 py-3 font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
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
                className="flex items-center px-4 py-3 cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  border: `2px solid ${themeProps.answersColor}30`,
                  borderRadius: inputBorderRadius,
                  backgroundColor: choicesBg,
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

  // Fonction pour rendre l'attachment du welcome-screen
  const renderWelcomeAttachment = () => {
    if (!block?.attributes.showAttachment || !block?.attributes.attachmentUrl) return null
    
    const attachmentType = block.attributes.attachmentType || 'image'
    const attachmentUrl = block.attributes.attachmentUrl
    const attachmentLayout = block.attributes.attachmentLayout || 'stack'
    const focalPoint = block.attributes.focalPoint || { x: 50, y: 50 }
    
    // Les layouts split sont gérés différemment
    if (['split-left', 'split-right'].includes(attachmentLayout)) return null

    const isFloat = ['float-left', 'float-right'].includes(attachmentLayout)
    
    if (attachmentType === 'image') {
      return (
        <div className={`${isFloat ? (attachmentLayout === 'float-left' ? 'float-left mr-4 mb-2' : 'float-right ml-4 mb-2') : 'mb-4'}`}>
          <img
            src={attachmentUrl}
            alt=""
            className={`rounded-lg ${isFloat ? 'max-w-[200px]' : 'w-full max-h-48 object-cover'}`}
            style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          />
        </div>
      )
    }
    
    if (attachmentType === 'video') {
      const videoId = getYouTubeVideoId(attachmentUrl)
      if (!videoId) return null
      return (
        <div className={`${isFloat ? (attachmentLayout === 'float-left' ? 'float-left mr-4 mb-2' : 'float-right ml-4 mb-2') : 'mb-4'}`}>
          <div className={`relative ${isFloat ? 'w-48' : 'w-full'} aspect-video rounded-lg overflow-hidden`}>
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
        const layout = block.attributes.attachmentLayout || 'stack'
        const isSplit = ['split-left', 'split-right'].includes(layout)
        
        // Pour le split, on ne rend rien ici car c'est géré au niveau du composant parent
        if (isSplit && block.attributes.showAttachment && block.attributes.attachmentUrl) {
          return null
        }
        
        // Layout float - rendu côte à côte
        if (['float-left', 'float-right'].includes(layout)) {
          return null // Géré au niveau du composant parent
        }
        
        // Layout stack - juste le bouton (image gérée au niveau parent)
        return (
          <div className="mt-8">
            <button
              className="px-8 py-3 text-base font-medium transition-all hover:opacity-90 hover:scale-105 flex items-center gap-2"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {block.attributes.buttonText || 'Commencer'}
              <span className="opacity-70">→</span>
            </button>
          </div>
        )

      case 'thankyou-screen':
        return (
          <div className="mt-6 flex flex-col items-start gap-3">
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
            {block.attributes.showRestartButton && (
              <button
                className="px-6 py-2 text-sm font-medium transition-all hover:opacity-90 flex items-center gap-2"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
                }}
              >
                {block.attributes.restartButtonText || 'Recommencer'}
              </button>
            )}
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
            className="mt-6 w-full max-w-md py-3 text-xl outline-none transition-colors"
            style={inputStyleCss}
          />
        )

      case 'long-text':
        return (
          <textarea
            readOnly
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            rows={3}
            className="mt-6 w-full max-w-lg py-3 text-xl outline-none resize-none transition-colors"
            style={inputStyleCss}
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
                className="flex-1 px-4 py-3 text-base bg-no-repeat outline-none transition-colors"
                style={{
                  border: `2px solid ${themeProps.answersColor}30`,
                  borderRadius: inputBorderRadius,
                  backgroundColor: choicesBg,
                  color: themeProps.answersColor,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(themeProps.answersColor || '#000')}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 12px center',
                  backgroundSize: '20px',
                  paddingRight: '44px',
                }}
              />
              <button
                className="px-4 py-3 font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
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
                  className="flex items-center px-4 py-3 cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    border: `2px solid ${isSelected ? themeProps.buttonsBgColor : themeProps.answersColor + '30'}`,
                    borderRadius: inputBorderRadius,
                    backgroundColor: isSelected ? themeProps.buttonsBgColor + '15' : choicesBg,
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
                  className="mt-4 px-6 py-2 font-medium transition-opacity hover:opacity-90 flex items-center disabled:opacity-50"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
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
              className="w-full max-w-xs py-3 text-xl outline-none"
              style={inputStyleCss}
            />
          </div>
        )

      case 'advanced-date':
        return (
          <MiniCalendarPreview
            themeProps={themeProps}
            isDateRange={block.attributes.isDateRange}
            startDateLabel={block.attributes.startDateLabel}
            endDateLabel={block.attributes.endDateLabel}
            minDateType={block.attributes.minDateType}
            maxDateType={block.attributes.maxDateType}
            minDateOffset={block.attributes.minDateOffset}
            maxDateOffset={block.attributes.maxDateOffset}
          />
        )

      case 'time':
        const isTimeRange = block.attributes.isTimeRange || false
        if (isTimeRange) {
          return (
            <div className="mt-6 w-full max-w-md space-y-4">
              {/* Heure de début */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: themeProps.answersColor }}>
                  {block.attributes.startTimeLabel || 'Heure de début'}
                </label>
                <div 
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all"
                  style={{ 
                    borderColor: themeProps.buttonsBgColor, 
                    backgroundColor: themeProps.buttonsBgColor + '08',
                    boxShadow: `0 0 0 4px ${themeProps.buttonsBgColor}15`
                  }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: themeProps.buttonsBgColor + '20' }}
                  >
                    <svg className="w-5 h-5" style={{ color: themeProps.buttonsBgColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <span className="text-2xl font-semibold tracking-wide" style={{ color: themeProps.answersColor }}>
                    --:--
                  </span>
                </div>
              </div>
              
              {/* Séparateur */}
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
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all"
                  style={{ borderColor: themeProps.answersColor + '30' }}
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: themeProps.answersColor + '10' }}
                  >
                    <svg className="w-5 h-5" style={{ color: themeProps.answersColor + '50' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path strokeLinecap="round" d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                  <span className="text-2xl font-semibold tracking-wide" style={{ color: themeProps.answersColor + '50' }}>
                    --:--
                  </span>
                </div>
              </div>
            </div>
          )
        }
        
        // Heure simple - design moderne
        return (
          <div className="mt-6">
            <div 
              className="inline-flex items-center gap-4 px-6 py-4 rounded-xl border-2 transition-all"
              style={{ 
                borderColor: themeProps.buttonsBgColor, 
                backgroundColor: themeProps.buttonsBgColor + '08',
                boxShadow: `0 0 0 4px ${themeProps.buttonsBgColor}15`
              }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
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
                <span className="text-3xl font-bold tracking-wider" style={{ color: themeProps.answersColor }}>
                  --:--
                </span>
              </div>
            </div>
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
              className="px-8 py-3 text-base font-medium transition-all hover:opacity-90"
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

  // Vérifier si on doit utiliser un layout split pour welcome/thankyou screen
  const hasSplitLayout = block && 
    (block.type === 'welcome-screen' || block.type === 'thankyou-screen') &&
    block.attributes.showAttachment &&
    (block.attributes.attachmentLayout === 'split-left' || block.attributes.attachmentLayout === 'split-right')

  // Vérifier si on doit utiliser un layout float
  const hasFloatLayout = block && 
    (block.type === 'welcome-screen' || block.type === 'thankyou-screen') &&
    block.attributes.showAttachment &&
    (block.attributes.attachmentLayout === 'float-left' || block.attributes.attachmentLayout === 'float-right')

  // Rendu avec layout float
  if (hasFloatLayout) {
    const layout = block.attributes.attachmentLayout
    const attachmentUrl = block.attributes.attachmentUrl
    const attachmentType = block.attributes.attachmentType || 'image'
    const focalPoint = block.attributes.focalPoint || { x: 50, y: 50 }
    const isImageOnLeft = layout === 'float-left'

    const contentSection = (
      <div className={`flex-1 flex flex-col justify-center p-8 ${isImageOnLeft ? '' : 'items-end text-right'}`}>
        <div className={`${isImageOnLeft ? '' : 'max-w-md'}`}>
          {/* Logo */}
          {(settings as any).logo && (
            <div className="mb-6">
              <img 
                src={(settings as any).logo} 
                alt="Logo" 
                className={`h-8 object-contain ${isImageOnLeft ? '' : 'ml-auto'}`}
              />
            </div>
          )}
          
          {/* Titre */}
          <h1
            className="text-2xl md:text-3xl font-semibold leading-tight"
            style={{ color: themeProps.questionsColor }}
          >
            {block.attributes.label || 'Question sans titre'}
          </h1>

          {/* Description */}
          {block.attributes.description && (
            <p 
              className="mt-3 text-base leading-relaxed opacity-80" 
              style={{ color: themeProps.answersColor }}
            >
              {block.attributes.description}
            </p>
          )}

          {/* Button */}
          <div className={`mt-6 ${isImageOnLeft ? '' : 'flex justify-end'}`}>
            <button
              className="px-8 py-3 text-base font-medium transition-all hover:opacity-90 hover:scale-105 flex items-center gap-2"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
                borderRadius: buttonBorderRadius,
              }}
            >
              {block.attributes.buttonText || 'Commencer'}
              <span className="opacity-70">→</span>
            </button>
          </div>
          
          {/* Footer */}
          {(settings.showBranding ?? true) && (
            <div className="mt-8 text-sm opacity-50" style={{ color: themeProps.answersColor }}>
              propulsé par <span className="font-semibold">{settings.brandingText || 'FormBuilder'}</span>
            </div>
          )}
        </div>
      </div>
    )

    const attachmentSection = (
      <div className={`flex-1 flex items-center p-8 ${isImageOnLeft ? 'justify-end' : 'justify-start'}`}>
        <div className="w-full max-w-md rounded-lg overflow-hidden shadow-lg">
          {attachmentType === 'image' && attachmentUrl && (
            <img
              src={attachmentUrl}
              alt=""
              className="w-full h-auto object-cover"
              style={{ 
                maxHeight: '400px',
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
        className="flex-1 flex flex-row transition-all duration-300"
        style={{ 
          ...backgroundStyle,
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

  // Rendu avec layout split
  if (hasSplitLayout) {
    const layout = block.attributes.attachmentLayout
    const attachmentUrl = block.attributes.attachmentUrl
    const attachmentType = block.attributes.attachmentType || 'image'
    const focalPoint = block.attributes.focalPoint || { x: 50, y: 50 }
    const isImageOnLeft = layout === 'split-left'

    const contentSection = (
      <div className="w-1/2 h-full flex flex-col">
        {/* Logo */}
        {(settings as any).logo && (
          <div className="p-4 shrink-0">
            <img 
              src={(settings as any).logo} 
              alt="Logo" 
              className="h-6 object-contain"
            />
          </div>
        )}
        
        {/* Contenu centré */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            {/* Question text */}
            <h1
              className="text-2xl md:text-3xl font-semibold leading-tight"
              style={{ color: themeProps.questionsColor }}
            >
              {block.attributes.label || 'Question sans titre'}
            </h1>

            {/* Description */}
            {block.attributes.description && (
              <p 
                className="mt-4 text-base leading-relaxed opacity-80" 
                style={{ color: themeProps.answersColor }}
              >
                {block.attributes.description}
              </p>
            )}

            {/* Button */}
            {block.type === 'welcome-screen' && (
              <div className="mt-8">
                <button
                  className="px-8 py-3 text-base font-medium transition-all hover:opacity-90 hover:scale-105 flex items-center gap-2"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
                  }}
                >
                  {block.attributes.buttonText || 'Commencer'}
                  <span className="opacity-70">→</span>
                </button>
              </div>
            )}

            {block.type === 'thankyou-screen' && (
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
            )}
          </div>
        </div>
        
        {/* Footer */}
        {(settings.showBranding ?? true) && (
          <div className="p-4 text-center shrink-0">
            <span className="text-xs" style={{ color: themeProps.answersColor + '80' }}>
              propulsé par <span className="font-semibold">{settings.brandingText || 'FormBuilder'}</span>
            </span>
          </div>
        )}
      </div>
    )

    const attachmentSection = (
      <div className="w-1/2 h-full relative">
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
        className="flex-1 flex flex-row transition-all duration-300"
        style={{ 
          ...backgroundStyle,
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

  return (
    <div 
      className="flex-1 flex flex-col transition-all duration-300"
      style={{ 
        ...backgroundStyle,
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
            {/* Titre du groupe */}
            {!block.attributes.hideLabel && (
              <div>
                <h1
                  className="text-3xl md:text-4xl font-semibold leading-tight"
                  style={{ color: themeProps.questionsColor }}
                >
                  {block.attributes.label || 'Groupe sans titre'}
                </h1>
                {block.attributes.description && (
                  <p
                    className="mt-3 text-lg leading-relaxed opacity-80"
                    style={{ color: themeProps.answersColor }}
                  >
                    {block.attributes.description}
                  </p>
                )}
              </div>
            )}

            {block.innerBlocks?.map((innerBlock, innerIdx) => (
              <div key={innerBlock.id} className="pb-6 border-b border-gray-200/30 last:border-0">
                {/* Question number for inner block */}
                {settings.showQuestionNumbers && innerBlock.type !== 'statement' && !innerBlock.attributes.hideLabel && (
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
                {!innerBlock.attributes.hideLabel && (
                  <h2
                    className="text-xl md:text-2xl font-semibold leading-tight"
                    style={{ color: themeProps.questionsColor }}
                  >
                    {innerBlock.attributes.label || 'Question sans titre'}
                  </h2>
                )}

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
                className="px-6 py-2 font-medium transition-all hover:opacity-90 flex items-center gap-2"
                style={{
                  backgroundColor: themeProps.buttonsBgColor,
                  color: themeProps.buttonsFontColor,
                  borderRadius: buttonBorderRadius,
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
                  className="flex-1 px-6 py-3 font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
                  }}
                >
                  {block.attributes.initialYesLabel || 'Oui'} → Continuer
                </button>
                <button
                  className="flex-1 px-6 py-3 font-medium border-2 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: themeProps.answersColor + '40',
                    color: themeProps.answersColor,
                    backgroundColor: 'transparent',
                    borderRadius: buttonBorderRadius,
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
                    {settings.showQuestionNumbers && innerBlock.type !== 'statement' && !innerBlock.attributes.hideLabel && (
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
                    {!innerBlock.attributes.hideLabel && (
                      <h3
                        className="text-lg md:text-xl font-medium leading-tight"
                        style={{ color: themeProps.questionsColor }}
                      >
                        {innerBlock.attributes.label || 'Question sans titre'}
                      </h3>
                    )}

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
                  className="flex-1 px-6 py-3 font-medium transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
                  }}
                >
                  {block.attributes.repeatYesLabel || 'Oui'}
                </button>
                <button
                  className="flex-1 px-6 py-3 font-medium border-2 transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: themeProps.answersColor + '40',
                    color: themeProps.answersColor,
                    backgroundColor: 'transparent',
                    borderRadius: buttonBorderRadius,
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
            {/* Image au-dessus du titre pour welcome-screen et thankyou-screen en layout stack */}
            {(block.type === 'welcome-screen' || block.type === 'thankyou-screen') && 
             block.attributes.showAttachment && 
             block.attributes.attachmentLayout === 'stack' && 
             block.attributes.attachmentUrl && (
              <div className="mb-6">
                {block.attributes.attachmentType === 'video' ? (
                  <div className="aspect-video rounded-lg overflow-hidden max-w-xl">
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
                      maxHeight: '280px',
                      objectPosition: `${block.attributes.focalPoint?.x || 50}% ${block.attributes.focalPoint?.y || 50}%` 
                    }}
                  />
                )}
              </div>
            )}

            {/* Question number */}
            {settings.showQuestionNumbers && block.type !== 'welcome-screen' && block.type !== 'thankyou-screen' && block.type !== 'statement' && !block.attributes.hideLabel && (
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
            {!settings.showQuestionNumbers && block.attributes.required && block.type !== 'welcome-screen' && block.type !== 'thankyou-screen' && block.type !== 'statement' && !block.attributes.hideLabel && (
              <div className="flex items-center mb-4">
                <span className="text-red-500 text-lg">*</span>
              </div>
            )}

            {/* Question text */}
            {!block.attributes.hideLabel && (
              <h1
                className="text-3xl md:text-4xl font-semibold leading-tight"
                style={{ color: themeProps.questionsColor }}
              >
                {block.attributes.label || 'Question sans titre'}
              </h1>
            )}

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
            {['short-text', 'long-text', 'email', 'number', 'phone', 'date', 'advanced-date'].includes(block.type) && (
              <div className="mt-6">
                <button
                  className="px-6 py-2 font-medium transition-all hover:opacity-90 flex items-center gap-2"
                  style={{
                    backgroundColor: themeProps.buttonsBgColor,
                    color: themeProps.buttonsFontColor,
                    borderRadius: buttonBorderRadius,
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
