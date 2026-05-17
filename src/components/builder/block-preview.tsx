'use client'

import type { FormBlock, Theme } from '@/types/form'
import { Check, ChevronDown } from 'lucide-react'

interface BlockPreviewProps {
  block: FormBlock
  theme?: Theme | null
}

export function BlockPreview({ block, theme }: BlockPreviewProps) {
  const themeProps = theme?.properties || {
    backgroundColor: '#ffffff',
    questionsColor: '#000000',
    answersColor: '#4a4a4a',
    buttonsBgColor: '#7c3aed',
    buttonsFontColor: '#ffffff',
    font: 'Inter',
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  const renderInput = () => {
    switch (block.type) {
      case 'welcome-screen':
        return (
          <div className="mt-3">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
              }}
            >
              {block.attributes.buttonText || 'Commencer'}
            </button>
          </div>
        )

      case 'thankyou-screen':
        return (
          <div className="mt-2">
            <p className="text-xs" style={{ color: themeProps.answersColor }}>
              ✓ Formulaire terminé
            </p>
          </div>
        )

      case 'short-text':
      case 'email':
      case 'number':
      case 'phone':
      case 'address':
        return (
          <input
            type="text"
            readOnly
            placeholder={block.attributes.placeholder || 'Tapez votre réponse ici...'}
            className="mt-2 w-full bg-transparent border-b py-1 text-sm outline-none"
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
            rows={2}
            className="mt-2 w-full bg-transparent border-b py-1 text-sm outline-none resize-none"
            style={{
              color: themeProps.answersColor,
              borderColor: themeProps.buttonsBgColor + '60',
            }}
          />
        )

      case 'multiple-choice':
      case 'dropdown':
        const choices = (block.attributes.choices || []).slice(0, 4) // Show max 4 choices in preview
        const hasMore = (block.attributes.choices || []).length > 4
        return (
          <div className="mt-2 space-y-1">
            {choices.map((choice: any, idx: number) => (
              <div
                key={choice.id || idx}
                className="flex items-center px-2 py-1.5 rounded border text-xs"
                style={{
                  borderColor: themeProps.answersColor + '30',
                }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-medium mr-2"
                  style={{
                    backgroundColor: themeProps.answersColor + '20',
                    color: themeProps.answersColor,
                  }}
                >
                  {letters[idx]}
                </span>
                <span style={{ color: themeProps.answersColor }}>{choice.label}</span>
              </div>
            ))}
            {hasMore && (
              <p className="text-[10px] text-center" style={{ color: themeProps.answersColor + '80' }}>
                + {(block.attributes.choices || []).length - 4} autres options
              </p>
            )}
          </div>
        )

      case 'image-selection':
        const imageChoices = (block.attributes.choices || []).slice(0, 4)
        const hasMoreImages = (block.attributes.choices || []).length > 4
        const isStacked = block.attributes.imageLayout === 'stacked'
        const columns = block.attributes.imageColumns || 2
        
        return (
          <div className="mt-2">
            <div className={`${isStacked ? 'space-y-1' : `grid grid-cols-${Math.min(columns, 2)} gap-1`}`}>
              {imageChoices.map((choice: any, idx: number) => (
                <div
                  key={choice.id || idx}
                  className={`relative rounded border overflow-hidden ${isStacked ? 'flex items-center gap-2 p-1' : ''}`}
                  style={{
                    borderColor: themeProps.answersColor + '30',
                  }}
                >
                  {choice.imageUrl ? (
                    <img
                      src={choice.imageUrl}
                      alt={choice.label}
                      className={`object-cover ${isStacked ? 'w-8 h-8 rounded' : 'w-full h-12'}`}
                    />
                  ) : (
                    <div 
                      className={`flex items-center justify-center bg-gray-100 ${isStacked ? 'w-8 h-8 rounded' : 'w-full h-12'}`}
                    >
                      <span className="text-[8px] text-gray-400">IMG</span>
                    </div>
                  )}
                  {block.attributes.showImageLabels !== false && (
                    <span 
                      className={`text-[9px] truncate ${isStacked ? '' : 'absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5'}`}
                      style={isStacked ? { color: themeProps.answersColor } : {}}
                    >
                      {choice.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {hasMoreImages && (
              <p className="text-[10px] text-center mt-1" style={{ color: themeProps.answersColor + '80' }}>
                + {(block.attributes.choices || []).length - 4} autres images
              </p>
            )}
          </div>
        )

      case 'date':
        return (
          <div className="mt-2 flex items-center">
            <input
              type="text"
              readOnly
              placeholder={block.attributes.format || 'DD/MM/YYYY'}
              className="w-full bg-transparent border-b py-1 text-sm outline-none"
              style={{
                color: themeProps.answersColor,
                borderColor: themeProps.buttonsBgColor + '60',
              }}
            />
          </div>
        )

      case 'advanced-date':
        const hasMinRestriction = block.attributes.minDateType && block.attributes.minDateType !== 'none'
        const hasMaxRestriction = block.attributes.maxDateType && block.attributes.maxDateType !== 'none'
        return (
          <div className="mt-2">
            <div className="flex items-center">
              <input
                type="text"
                readOnly
                placeholder={block.attributes.format || 'DD/MM/YYYY'}
                className="w-full bg-transparent border-b py-1 text-sm outline-none"
                style={{
                  color: themeProps.answersColor,
                  borderColor: themeProps.buttonsBgColor + '60',
                }}
              />
            </div>
            {(hasMinRestriction || hasMaxRestriction) && (
              <div className="flex gap-2 mt-1">
                {hasMinRestriction && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">
                    Min: {block.attributes.minDateType === 'today' ? "Aujourd'hui" : 
                          block.attributes.minDateType === 'specific' ? block.attributes.minDate :
                          block.attributes.minDateType === 'block' ? 'Variable' : ''}
                    {block.attributes.minDateOffset ? ` ${block.attributes.minDateOffset > 0 ? '+' : ''}${block.attributes.minDateOffset}j` : ''}
                  </span>
                )}
                {hasMaxRestriction && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                    Max: {block.attributes.maxDateType === 'today' ? "Aujourd'hui" : 
                          block.attributes.maxDateType === 'specific' ? block.attributes.maxDate :
                          block.attributes.maxDateType === 'block' ? 'Variable' : ''}
                    {block.attributes.maxDateOffset ? ` ${block.attributes.maxDateOffset > 0 ? '+' : ''}${block.attributes.maxDateOffset}j` : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        )

      case 'time':
        const isTimeRange = block.attributes.isTimeRange || false
        return (
          <div className="mt-2">
            {isTimeRange ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16 shrink-0">
                    {block.attributes.startTimeLabel || 'Début'}
                  </span>
                  <input
                    type="text"
                    readOnly
                    placeholder="HH:MM"
                    className="flex-1 bg-transparent border-b py-1 text-xs outline-none"
                    style={{
                      color: themeProps.answersColor,
                      borderColor: themeProps.buttonsBgColor + '60',
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-16 shrink-0">
                    {block.attributes.endTimeLabel || 'Fin'}
                  </span>
                  <input
                    type="text"
                    readOnly
                    placeholder="HH:MM"
                    className="flex-1 bg-transparent border-b py-1 text-xs outline-none"
                    style={{
                      color: themeProps.answersColor,
                      borderColor: themeProps.buttonsBgColor + '60',
                    }}
                  />
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 inline-block">
                  Plage horaire
                </span>
              </div>
            ) : (
              <input
                type="text"
                readOnly
                placeholder="HH:MM"
                className="w-full bg-transparent border-b py-1 text-sm outline-none"
                style={{
                  color: themeProps.answersColor,
                  borderColor: themeProps.buttonsBgColor + '60',
                }}
              />
            )}
          </div>
        )

      case 'slider':
        const min = block.attributes.min || 0
        const max = block.attributes.max || 10
        const defaultValue = block.attributes.defaultValue || min
        return (
          <div className="mt-2">
            <input
              type="range"
              readOnly
              min={min}
              max={max}
              value={defaultValue}
              className="w-full h-1"
              style={{ accentColor: themeProps.buttonsBgColor }}
            />
            <div className="flex justify-between mt-1 text-[10px]" style={{ color: themeProps.answersColor }}>
              <span>{min}</span>
              <span className="font-medium">{defaultValue}</span>
              <span>{max}</span>
            </div>
          </div>
        )

      case 'legal':
        return (
          <div className="mt-2">
            <label className="flex items-start">
              <input
                type="checkbox"
                readOnly
                className="mt-0.5 mr-2 w-3 h-3 rounded"
                style={{ accentColor: themeProps.buttonsBgColor }}
              />
              <span className="text-[10px]" style={{ color: themeProps.answersColor }}>
                {block.attributes.checkboxLabel || "J'accepte les conditions"}
              </span>
            </label>
          </div>
        )

      case 'statement':
        return (
          <div className="mt-3">
            <button
              className="px-4 py-2 rounded-md text-sm font-medium"
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
            className="mt-2 border-2 border-dashed rounded-lg p-3 text-center"
            style={{ borderColor: themeProps.buttonsBgColor + '40' }}
          >
            <p className="text-xs" style={{ color: themeProps.answersColor }}>
              📎 Glissez un fichier ou cliquez
            </p>
          </div>
        )

      case 'signature':
        return (
          <div 
            className="mt-2 border-2 border-dashed rounded-lg p-4 text-center"
            style={{ borderColor: themeProps.buttonsBgColor + '40' }}
          >
            <p className="text-xs" style={{ color: themeProps.answersColor }}>
              ✍️ Signez ici
            </p>
          </div>
        )

      case 'group':
        return (
          <div className="mt-2 space-y-2">
            {(block.innerBlocks || []).slice(0, 3).map((innerBlock, idx) => (
              <div key={innerBlock.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded">
                <span className="w-5 h-5 bg-sky-100 text-sky-600 rounded flex items-center justify-center text-[10px] font-medium">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span style={{ color: themeProps.answersColor }}>{innerBlock.attributes.label}</span>
              </div>
            ))}
            {(block.innerBlocks || []).length > 3 && (
              <p className="text-[10px] text-center" style={{ color: themeProps.answersColor + '80' }}>
                + {(block.innerBlocks || []).length - 3} autres questions
              </p>
            )}
          </div>
        )

      case 'repeater':
        return (
          <div className="mt-2 space-y-2">
            {/* Aperçu des questions du groupe */}
            <div className="p-2 border border-orange-200 rounded-lg bg-orange-50/50">
              {(block.innerBlocks || []).slice(0, 2).map((innerBlock, idx) => (
                <div key={innerBlock.id} className="flex items-center gap-2 text-xs py-1">
                  <span className="w-5 h-5 bg-orange-100 text-orange-600 rounded flex items-center justify-center text-[10px] font-medium">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ color: themeProps.answersColor }}>{innerBlock.attributes.label}</span>
                </div>
              ))}
              {(block.innerBlocks || []).length > 2 && (
                <p className="text-[10px] pl-7" style={{ color: themeProps.answersColor + '80' }}>
                  + {(block.innerBlocks || []).length - 2} autres questions
                </p>
              )}
            </div>

            {/* Aperçu de la question Oui/Non */}
            <div className="p-2 border border-dashed border-orange-300 rounded-lg">
              <p className="text-[10px] font-medium mb-1" style={{ color: themeProps.questionsColor }}>
                {block.attributes.repeatQuestion || 'Voulez-vous ajouter un élément ?'}
              </p>
              <div className="flex gap-2">
                <span className="text-[9px] px-2 py-0.5 rounded" style={{ backgroundColor: themeProps.buttonsBgColor, color: themeProps.buttonsFontColor }}>
                  {block.attributes.repeatYesLabel || 'Oui'}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded border" style={{ borderColor: themeProps.answersColor + '30', color: themeProps.answersColor }}>
                  {block.attributes.repeatNoLabel || 'Non'}
                </span>
              </div>
            </div>
          </div>
        )

      case 'yes-no':
        return (
          <div className="mt-2 flex gap-2">
            <button
              className="px-4 py-2 rounded border-2 text-sm font-medium transition-colors"
              style={{
                borderColor: themeProps.buttonsBgColor,
                color: themeProps.answersColor,
              }}
            >
              {block.attributes.yesLabel || 'Oui'}
            </button>
            <button
              className="px-4 py-2 rounded border-2 text-sm font-medium transition-colors"
              style={{
                borderColor: themeProps.answersColor + '40',
                color: themeProps.answersColor,
              }}
            >
              {block.attributes.noLabel || 'Non'}
            </button>
          </div>
        )

      case 'quantity':
        const previewItems = (block.attributes.quantityItems || []).slice(0, 3)
        return (
          <div className="mt-2 space-y-1.5">
            {previewItems.length > 0 ? (
              previewItems.map((item: any) => (
                <div key={item.choiceId} className="flex items-center justify-between p-1.5 rounded border text-xs" style={{ borderColor: themeProps.answersColor + '20' }}>
                  <span style={{ color: themeProps.answersColor }}>{item.choiceLabel}</span>
                  <div className="flex items-center gap-1">
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: themeProps.buttonsBgColor + '20', color: themeProps.buttonsBgColor }}>−</span>
                    <span className="w-6 text-center text-[10px] font-semibold" style={{ color: themeProps.answersColor }}>{item.min ?? 1}</span>
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: themeProps.buttonsBgColor + '20', color: themeProps.buttonsBgColor }}>+</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-center py-1" style={{ color: themeProps.answersColor + '60' }}>
                Lier à un bloc de choix pour configurer
              </p>
            )}
            {(block.attributes.quantityItems || []).length > 3 && (
              <p className="text-[10px] text-center" style={{ color: themeProps.answersColor + '80' }}>
                + {(block.attributes.quantityItems || []).length - 3} autres options
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const getBlockTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'welcome-screen': "ÉCRAN D'ACCUEIL",
      'thankyou-screen': 'ÉCRAN DE FIN',
      'short-text': 'TEXTE COURT',
      'long-text': 'TEXTE LONG',
      'multiple-choice': 'CHOIX MULTIPLE',
      'image-selection': 'SÉLECTION IMAGE',
      'dropdown': 'LISTE DÉROULANTE',
      'date': 'DATE',
      'advanced-date': 'DATE AVANCÉE',
      'time': 'HEURE',
      'number': 'NOMBRE',
      'email': 'EMAIL',
      'phone': 'TÉLÉPHONE',
      'address': 'ADRESSE',
      'slider': 'CURSEUR',
      'legal': 'CONDITIONS LÉGALES',
      'statement': 'ÉNONCÉ',
      'file': 'FICHIER',
      'signature': 'SIGNATURE',
      'group': 'GROUPE DE QUESTIONS',
      'repeater': 'BLOC RÉPÉTABLE',
      'quantity': 'QUANTITÉ',
      'yes-no': 'OUI / NON',
    }
    return labels[type] || type.toUpperCase()
  }

  return (
    <div className="p-4 border-b bg-gray-50">
      <div className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
        Aperçu du bloc
      </div>
      <div
        className="rounded-lg p-4 shadow-sm border transition-all"
        style={{
          backgroundColor: themeProps.backgroundColor,
          fontFamily: themeProps.font || 'Inter',
        }}
      >
        {/* Block type badge */}
        <div className="flex items-center mb-1">
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{
              backgroundColor: themeProps.buttonsBgColor + '15',
              color: themeProps.buttonsBgColor,
            }}
          >
            {getBlockTypeLabel(block.type)}
          </span>
          {block.attributes.required && (
            <span className="ml-1 text-red-500 text-[10px]">*</span>
          )}
        </div>

        {/* Question text */}
        <h3
          className="text-sm font-medium leading-snug"
          style={{ color: themeProps.questionsColor }}
        >
          {block.attributes.label || 'Question sans titre'}
        </h3>

        {/* Description */}
        {block.attributes.description && (
          <p className="mt-1 text-xs leading-relaxed" style={{ color: themeProps.answersColor }}>
            {block.attributes.description}
          </p>
        )}

        {/* Input preview */}
        {renderInput()}

        {/* OK button for input types */}
        {['short-text', 'long-text', 'email', 'number', 'phone', 'address', 'date', 'advanced-date', 'time'].includes(block.type) && (
          <div className="mt-3">
            <button
              className="px-3 py-1 rounded text-xs font-medium flex items-center"
              style={{
                backgroundColor: themeProps.buttonsBgColor,
                color: themeProps.buttonsFontColor,
              }}
            >
              OK
              <span className="ml-1 opacity-70 text-[9px]">↵</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
