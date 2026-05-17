'use client'

import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import type { FormBlock } from '@/types/form'
import {
  GripVertical,
  Copy,
  Trash2,
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ChevronDown,
  CheckSquare,
  SlidersHorizontal,
  Scale,
  FileText,
  PenTool,
  FileUp,
  Home,
  ThumbsUp,
  LayoutList,
  Repeat,
} from 'lucide-react'

const blockIcons: Record<string, React.ReactNode> = {
  'welcome-screen': <Home className="w-4 h-4" />,
  'short-text': <Type className="w-4 h-4" />,
  'long-text': <AlignLeft className="w-4 h-4" />,
  'number': <Hash className="w-4 h-4" />,
  'email': <Mail className="w-4 h-4" />,
  'phone': <Phone className="w-4 h-4" />,
  'address': <MapPin className="w-4 h-4" />,
  'date': <Calendar className="w-4 h-4" />,
  'dropdown': <ChevronDown className="w-4 h-4" />,
  'multiple-choice': <CheckSquare className="w-4 h-4" />,
  'slider': <SlidersHorizontal className="w-4 h-4" />,
  'legal': <Scale className="w-4 h-4" />,
  'statement': <FileText className="w-4 h-4" />,
  'file': <FileUp className="w-4 h-4" />,
  'signature': <PenTool className="w-4 h-4" />,
  'thankyou-screen': <ThumbsUp className="w-4 h-4" />,
  'group': <LayoutList className="w-4 h-4" />,
  'repeater': <Repeat className="w-4 h-4" />,
}

const blockTypeLabels: Record<string, string> = {
  'welcome-screen': 'Écran d\'accueil',
  'short-text': 'Texte court',
  'long-text': 'Texte long',
  'number': 'Nombre',
  'email': 'Email',
  'phone': 'Téléphone',
  'address': 'Adresse',
  'date': 'Date',
  'dropdown': 'Liste déroulante',
  'multiple-choice': 'Choix multiple',
  'slider': 'Curseur',
  'legal': 'Conditions légales',
  'statement': 'Énoncé',
  'file': 'Téléchargement',
  'signature': 'Signature',
  'thankyou-screen': 'Écran de fin',
  'group': 'Groupe',
  'repeater': 'Répétable',
}

// Composant pour les blocs internes triables
interface SortableInnerBlockProps {
  innerBlock: FormBlock
  parentIndex: number
  innerIndex: number
  isSelected: boolean
  onSelect: () => void
  onRemoveFromGroup: () => void
  onDelete: () => void
  colorScheme?: 'sky' | 'orange'
}

function SortableInnerBlock({ 
  innerBlock, 
  parentIndex, 
  innerIndex, 
  isSelected, 
  onSelect,
  onRemoveFromGroup,
  onDelete,
  colorScheme = 'sky',
}: SortableInnerBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: innerBlock.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const colors = colorScheme === 'orange' 
    ? { bg: 'bg-orange-100', text: 'text-orange-600' }
    : { bg: 'bg-sky-100', text: 'text-sky-600' }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={`
        group/inner flex items-center p-2 rounded-lg bg-white text-xs border-2 cursor-pointer transition-all
        ${isSelected ? 'border-primary shadow-sm bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
        ${isDragging ? 'shadow-md z-10' : ''}
      `}
    >
      {/* Drag handle */}
      <button
        className="mr-1.5 p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {/* Number badge */}
      <div className={`w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0 ${colors.bg} ${colors.text}`}>
        <span className="text-[10px] font-medium">{parentIndex + 1}{String.fromCharCode(65 + innerIndex)}</span>
      </div>
      
      {/* Icon and label */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-gray-400 scale-75">{blockIcons[innerBlock.type]}</span>
        <p className="text-xs font-medium text-gray-900 truncate">
          {innerBlock.attributes.label || 'Sans titre'}
        </p>
        {innerBlock.attributes.required && (
          <span className="text-[10px] text-red-500">*</span>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center opacity-0 group-hover/inner:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation()
            onRemoveFromGroup()
          }}
          title="Sortir du groupe"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          title="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

interface SortableBlockProps {
  block: FormBlock
  index: number
  isSelected: boolean
  onSelect: () => void
  compact?: boolean
  isDropTarget?: boolean
  isDragging?: boolean
  selectedInnerBlockId?: string | null
  onSelectInnerBlock?: (innerBlockId: string) => void
}

export function SortableBlock({ 
  block, 
  index, 
  isSelected, 
  onSelect, 
  compact = false, 
  isDropTarget = false, 
  isDragging: isDraggingProp = false,
  selectedInnerBlockId = null,
  onSelectInnerBlock,
}: SortableBlockProps) {
  const { duplicateBlock, removeBlock, removeBlockFromGroup, reorderInnerBlocks, updateBlock } = useFormBuilder()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleInnerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    // Si on dépose en dehors de la zone du groupe (over est null), on sort le bloc du groupe
    if (!over && block.innerBlocks) {
      const innerBlockId = active.id as string
      removeBlockFromGroup(block.id, innerBlockId)
      return
    }
    
    if (over && active.id !== over.id && block.innerBlocks) {
      const oldIndex = block.innerBlocks.findIndex((b) => b.id === active.id)
      const newIndex = block.innerBlocks.findIndex((b) => b.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderInnerBlocks(block.id, oldIndex, newIndex)
      }
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isScreen = block.type === 'welcome-screen' || block.type === 'thankyou-screen'
  const isGroup = block.type === 'group'
  const isRepeater = block.type === 'repeater'

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`
          ${isDragging ? 'shadow-md opacity-50' : ''}
        `}
      >
        <div
          onClick={onSelect}
          className={`
            group relative bg-white rounded-lg border-2 transition-all cursor-pointer
            ${isSelected ? 'border-primary shadow-sm bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
            ${isScreen ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : ''}
            ${isGroup ? 'bg-gradient-to-r from-sky-50 to-blue-50' : ''}
            ${isRepeater ? 'bg-gradient-to-r from-orange-50 to-amber-50' : ''}
            ${isDropTarget ? 'border-sky-500 border-dashed bg-sky-50 scale-105' : ''}
          `}
        >
          {/* Drop indicator for groups and repeaters */}
          {isDropTarget && (
            <div className="absolute inset-0 flex items-center justify-center bg-sky-100/50 rounded-lg z-10">
              <span className="text-xs font-medium text-sky-600 bg-white px-2 py-1 rounded shadow-sm">
                Déposer ici pour ajouter au {isRepeater ? 'répétable' : 'groupe'}
              </span>
            </div>
          )}
          
          <div className="flex items-center p-2">
            {/* Drag handle */}
            <button
              className="mr-2 p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-3 h-3" />
            </button>

            {/* Block icon and number */}
            <div className={`
              w-6 h-6 rounded flex items-center justify-center mr-2 shrink-0 text-xs
              ${isScreen ? 'bg-purple-100 text-purple-600' : ''}
              ${isGroup ? 'bg-sky-100 text-sky-600' : ''}
              ${isRepeater ? 'bg-orange-100 text-orange-600' : ''}
              ${!isScreen && !isGroup && !isRepeater ? 'bg-gray-100 text-gray-600' : ''}
            `}>
              {!isScreen && !isGroup && !isRepeater && <span className="text-[10px] font-medium">{index + 1}</span>}
              {(isScreen || isGroup || isRepeater) && <span className="scale-75">{blockIcons[block.type]}</span>}
            </div>

            {/* Block content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                {!isGroup && !isRepeater && <span className="text-gray-400 scale-75">{blockIcons[block.type]}</span>}
                <p className="text-xs font-medium text-gray-900 truncate">
                  {isGroup ? `${block.attributes.label || 'Groupe'} (${block.innerBlocks?.length || 0} questions)` :
                   isRepeater ? `${block.attributes.label || 'Répétable'} (${block.innerBlocks?.length || 0} questions)` :
                   (block.attributes.label || 'Sans titre')}
                </p>
                {block.attributes.required && (
                  <span className="text-[10px] text-red-500">*</span>
                )}
              </div>
            </div>

            {/* Collapse toggle for groups and repeaters */}
            {(isGroup || isRepeater) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-gray-400 hover:text-gray-600"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCollapsed(!isCollapsed)
                }}
                title={isCollapsed ? 'Développer' : 'Réduire'}
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </Button>
            )}

            {/* Actions */}
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  duplicateBlock(block.id)
                }}
                title="Dupliquer"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation()
                  removeBlock(block.id)
                }}
                title="Supprimer"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sub-blocks for groups - collapsible */}
        {!isCollapsed && isGroup && block.innerBlocks && block.innerBlocks.length > 0 && (
          <div className="ml-4 mt-1 space-y-1.5 border-l-2 border-sky-200 pl-2">
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragEnd={handleInnerDragEnd}
            >
              <SortableContext
                items={block.innerBlocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {block.innerBlocks.map((innerBlock, innerIdx) => (
                  <SortableInnerBlock
                    key={innerBlock.id}
                    innerBlock={innerBlock}
                    parentIndex={index}
                    innerIndex={innerIdx}
                    isSelected={selectedInnerBlockId === innerBlock.id}
                    onSelect={() => onSelectInnerBlock?.(innerBlock.id)}
                    onRemoveFromGroup={() => removeBlockFromGroup(block.id, innerBlock.id)}
                    onDelete={() => updateBlock(block.id, {
                      innerBlocks: block.innerBlocks?.filter(b => b.id !== innerBlock.id),
                    })}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Empty drop zone for groups */}
        {!isCollapsed && isGroup && (!block.innerBlocks || block.innerBlocks.length === 0) && (
          <div className={`ml-4 mt-1 border-l-2 border-sky-200 pl-2 ${isDropTarget ? 'border-sky-500' : ''}`}>
            <div className={`text-xs text-center py-2 px-2 rounded border-2 border-dashed ${isDropTarget ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-gray-200 text-gray-400'}`}>
              {isDropTarget ? 'Déposer ici' : 'Glissez des blocs ici'}
            </div>
          </div>
        )}
        
        {/* Sub-blocks for repeater - collapsible */}
        {!isCollapsed && isRepeater && block.innerBlocks && block.innerBlocks.length > 0 && (
          <div className="ml-4 mt-1 space-y-1.5 border-l-2 border-orange-200 pl-2">
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragEnd={handleInnerDragEnd}
            >
              <SortableContext
                items={block.innerBlocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {block.innerBlocks.map((innerBlock, innerIdx) => (
                  <SortableInnerBlock
                    key={innerBlock.id}
                    innerBlock={innerBlock}
                    parentIndex={index}
                    innerIndex={innerIdx}
                    isSelected={selectedInnerBlockId === innerBlock.id}
                    onSelect={() => onSelectInnerBlock?.(innerBlock.id)}
                    onRemoveFromGroup={() => removeBlockFromGroup(block.id, innerBlock.id)}
                    onDelete={() => updateBlock(block.id, {
                      innerBlocks: block.innerBlocks?.filter(b => b.id !== innerBlock.id),
                    })}
                    colorScheme="orange"
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Empty drop zone for repeaters */}
        {!isCollapsed && isRepeater && (!block.innerBlocks || block.innerBlocks.length === 0) && (
          <div className={`ml-4 mt-1 border-l-2 border-orange-200 pl-2 ${isDropTarget ? 'border-orange-500' : ''}`}>
            <div className={`text-xs text-center py-2 px-2 rounded border-2 border-dashed ${isDropTarget ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-400'}`}>
              {isDropTarget ? 'Déposer ici' : 'Glissez des blocs ici'}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`
        group relative bg-white rounded-lg border-2 transition-all cursor-pointer
        ${isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-gray-200'}
        ${isDragging ? 'shadow-lg' : ''}
        ${isScreen ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : ''}
      `}
    >
      <div className="flex items-start p-4">
        {/* Drag handle */}
        <button
          className="mr-3 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Block icon and number */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center mr-3 shrink-0
          ${isScreen ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}
        `}>
          {!isScreen && <span className="text-xs font-medium">{index + 1}</span>}
          {isScreen && blockIcons[block.type]}
        </div>

        {/* Block content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">{blockIcons[block.type]}</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {blockTypeLabels[block.type]}
            </span>
            {block.attributes.required && (
              <span className="text-xs text-red-500">*</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900 truncate">
            {block.attributes.label || 'Sans titre'}
          </p>
          {block.attributes.description && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              {block.attributes.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              duplicateBlock(block.id)
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              removeBlock(block.id)
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
