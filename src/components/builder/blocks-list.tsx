'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useFormBuilder } from '@/stores/form-builder'
import { SortableBlock } from './sortable-block'
import { AddBlockDialog } from './add-block-dialog'
import { Plus, FileText, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BlocksList() {
  const { blocks, moveBlock, moveBlockToGroup, selectedBlockId, selectedInnerBlockId, selectBlock, selectInnerBlock } = useFormBuilder()
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return blocks
    const q = searchQuery.toLowerCase()
    return blocks.filter(block => {
      const labelMatch = (block.attributes?.label || '').toLowerCase().includes(q)
      const innerMatch = (block.innerBlocks || []).some(inner =>
        (inner.attributes?.label || '').toLowerCase().includes(q)
      )
      return labelMatch || innerMatch
    })
  }, [blocks, searchQuery])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks])

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingBlockId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      setDragOverGroupId(null)
      return
    }

    const activeBlock = blocks.find(b => b.id === active.id)
    const overBlock = blocks.find(b => b.id === over.id)

    // Si on survole un groupe ou repeater et que le bloc actif n'est pas un groupe/écran/repeater
    if ((overBlock?.type === 'group' || overBlock?.type === 'repeater') && 
        activeBlock && 
        activeBlock.type !== 'group' && 
        activeBlock.type !== 'repeater' &&
        activeBlock.type !== 'welcome-screen' && 
        activeBlock.type !== 'thankyou-screen') {
      setDragOverGroupId(over.id as string)
    } else {
      setDragOverGroupId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggingBlockId(null)
    setDragOverGroupId(null)

    if (!over || active.id === over.id) return

    const activeBlock = blocks.find(b => b.id === active.id)
    const overBlock = blocks.find(b => b.id === over.id)

    // Si on dépose sur un groupe ou repeater, déplacer le bloc dans le groupe
    if ((overBlock?.type === 'group' || overBlock?.type === 'repeater') && 
        activeBlock && 
        activeBlock.type !== 'group' && 
        activeBlock.type !== 'repeater' &&
        activeBlock.type !== 'welcome-screen' && 
        activeBlock.type !== 'thankyou-screen') {
      moveBlockToGroup(active.id as string, over.id as string)
    } else {
      // Sinon, réordonner normalement
      const oldIndex = blocks.findIndex((b) => b.id === active.id)
      const newIndex = blocks.findIndex((b) => b.id === over.id)
      moveBlock(active.id as string, newIndex)
    }
  }

  if (blocks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
        <FileText className="w-8 h-8 mb-2 text-gray-300" />
        <p className="text-sm font-medium text-center">Aucun bloc</p>
        <p className="text-xs mt-1 text-center mb-4">Cliquez sur le bouton ci-dessous pour ajouter votre premier bloc</p>
        <AddBlockDialog 
          trigger={
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter un bloc
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Blocs</h3>
        <AddBlockDialog
          trigger={
            <Button size="sm" variant="outline" className="h-8 w-8 p-0">
              <Plus className="w-4 h-4" />
            </Button>
          }
        />
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un bloc…"
          className="h-8 pl-7 pr-7 text-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {searchQuery && filteredBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-1">
          <Search className="w-5 h-5" />
          <p className="text-xs">Aucun bloc trouvé</p>
        </div>
      ) : searchQuery ? (
        <div className="space-y-1.5 flex-1 overflow-auto pr-2 -mr-2">
          {filteredBlocks.map((block, index) => (
            <SortableBlock
              key={block.id}
              block={block}
              index={index}
              isSelected={block.id === selectedBlockId}
              onSelect={() => selectBlock(block.id)}
              compact
              isDropTarget={false}
              isDragging={false}
              selectedInnerBlockId={block.id === selectedBlockId ? selectedInnerBlockId : null}
              onSelectInnerBlock={(innerBlockId) => selectInnerBlock(block.id, innerBlockId)}
            />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5 flex-1 overflow-auto pr-2 -mr-2">
              {blocks.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  isSelected={block.id === selectedBlockId}
                  onSelect={() => selectBlock(block.id)}
                  compact
                  isDropTarget={dragOverGroupId === block.id}
                  isDragging={draggingBlockId === block.id}
                  selectedInnerBlockId={block.id === selectedBlockId ? selectedInnerBlockId : null}
                  onSelectInnerBlock={(innerBlockId) => selectInnerBlock(block.id, innerBlockId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
