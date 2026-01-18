import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { FormBlock, BlockLogic, Webhook, FormSettings, Theme } from '@/types/form'

interface FormBuilderState {
  // Form data
  formId: string | null
  title: string
  slug: string
  description: string
  status: 'draft' | 'published'
  blocks: FormBlock[]
  logic: BlockLogic[]
  webhooks: Webhook[]
  settings: FormSettings
  themeId: string | null
  
  // UI state
  selectedBlockId: string | null
  selectedInnerBlockId: string | null // Pour les blocs dans les groupes
  activePanel: 'blocks' | 'logic' | 'theme' | 'settings' | 'webhooks'
  isDirty: boolean
  
  // Actions
  setFormData: (data: Partial<FormBuilderState>) => void
  addBlock: (block: FormBlock, afterBlockId?: string) => void
  updateBlock: (blockId: string, updates: Partial<FormBlock>) => void
  updateInnerBlock: (groupId: string, innerBlockId: string, updates: Partial<FormBlock>) => void
  removeBlock: (blockId: string) => void
  moveBlock: (blockId: string, newIndex: number) => void
  moveBlockToGroup: (blockId: string, groupId: string) => void
  removeBlockFromGroup: (groupId: string, innerBlockId: string) => void
  reorderInnerBlocks: (groupId: string, oldIndex: number, newIndex: number) => void
  duplicateBlock: (blockId: string) => void
  selectBlock: (blockId: string | null) => void
  selectInnerBlock: (groupId: string | null, innerBlockId: string | null) => void
  
  // Logic actions
  addLogicRule: (blockId: string, rule: BlockLogic['rules'][0]) => void
  updateLogicRule: (blockId: string, ruleId: string, updates: Partial<BlockLogic['rules'][0]>) => void
  removeLogicRule: (blockId: string, ruleId: string) => void
  
  // Webhook actions
  addWebhook: (webhook: Webhook) => void
  updateWebhook: (webhookId: string, updates: Partial<Webhook>) => void
  removeWebhook: (webhookId: string) => void
  
  // Settings
  updateSettings: (settings: Partial<FormSettings>) => void
  setTheme: (themeId: string | null) => void
  
  // Panel
  setActivePanel: (panel: FormBuilderState['activePanel']) => void
  
  // Form actions
  resetForm: () => void
  markClean: () => void
}

const initialState = {
  formId: null,
  title: 'Nouveau formulaire',
  slug: '',
  description: '',
  status: 'draft' as const,
  blocks: [],
  logic: [],
  webhooks: [],
  settings: {
    showProgressBar: true,
    showQuestionNumbers: true,
    lettersOnAnswers: true,
    animationDirection: 'vertical' as const,
  },
  themeId: null,
  selectedBlockId: null,
  selectedInnerBlockId: null,
  activePanel: 'blocks' as const,
  isDirty: false,
}

export const useFormBuilder = create<FormBuilderState>((set, get) => ({
  ...initialState,

  setFormData: (data) => set((state) => ({ ...state, ...data, isDirty: true })),

  addBlock: (block, afterBlockId) => set((state) => {
    const newBlock = { ...block, id: block.id || uuidv4() }
    let newBlocks: FormBlock[]
    
    if (afterBlockId) {
      const index = state.blocks.findIndex((b) => b.id === afterBlockId)
      newBlocks = [
        ...state.blocks.slice(0, index + 1),
        newBlock,
        ...state.blocks.slice(index + 1),
      ]
    } else {
      newBlocks = [...state.blocks, newBlock]
    }
    
    return { blocks: newBlocks, selectedBlockId: newBlock.id, isDirty: true }
  }),

  updateBlock: (blockId, updates) => set((state) => ({
    blocks: state.blocks.map((block) =>
      block.id === blockId 
        ? { 
            ...block, 
            ...updates, 
            attributes: { ...block.attributes, ...updates.attributes },
            // Préserver innerBlocks si non fourni dans les updates
            ...(updates.innerBlocks !== undefined ? { innerBlocks: updates.innerBlocks } : {}),
          } 
        : block
    ),
    isDirty: true,
  })),

  removeBlock: (blockId) => set((state) => ({
    blocks: state.blocks.filter((block) => block.id !== blockId),
    logic: Array.isArray(state.logic) ? state.logic.filter((l) => l.blockId !== blockId) : [],
    selectedBlockId: state.selectedBlockId === blockId ? null : state.selectedBlockId,
    isDirty: true,
  })),

  moveBlock: (blockId, newIndex) => set((state) => {
    const currentIndex = state.blocks.findIndex((b) => b.id === blockId)
    if (currentIndex === -1) return state
    
    const newBlocks = [...state.blocks]
    const [removed] = newBlocks.splice(currentIndex, 1)
    newBlocks.splice(newIndex, 0, removed)
    
    return { blocks: newBlocks, isDirty: true }
  }),

  moveBlockToGroup: (blockId, groupId) => set((state) => {
    // Trouver le bloc à déplacer
    const blockToMove = state.blocks.find((b) => b.id === blockId)
    if (!blockToMove) return state
    
    // Ne pas permettre de déplacer un groupe/repeater dans un groupe/repeater, ou des écrans
    if (blockToMove.type === 'group' || blockToMove.type === 'repeater' || blockToMove.type === 'welcome-screen' || blockToMove.type === 'thankyou-screen') {
      return state
    }
    
    // Trouver le groupe/repeater cible
    const groupIndex = state.blocks.findIndex((b) => b.id === groupId)
    if (groupIndex === -1) return state
    
    const group = state.blocks[groupIndex]
    if (group.type !== 'group' && group.type !== 'repeater') return state
    
    // Retirer le bloc de la liste principale
    const newBlocks = state.blocks.filter((b) => b.id !== blockId)
    
    // Ajouter le bloc aux innerBlocks du groupe/repeater
    const updatedGroup = {
      ...group,
      innerBlocks: [...(group.innerBlocks || []), blockToMove],
    }
    
    newBlocks[groupIndex > state.blocks.findIndex(b => b.id === blockId) ? groupIndex - 1 : groupIndex] = updatedGroup
    
    return { 
      blocks: newBlocks, 
      selectedBlockId: groupId,
      isDirty: true 
    }
  }),

  removeBlockFromGroup: (groupId, innerBlockId) => set((state) => {
    const groupIndex = state.blocks.findIndex((b) => b.id === groupId)
    if (groupIndex === -1) return state
    
    const group = state.blocks[groupIndex]
    if ((group.type !== 'group' && group.type !== 'repeater') || !group.innerBlocks) return state
    
    // Trouver le bloc à retirer
    const innerBlock = group.innerBlocks.find((b) => b.id === innerBlockId)
    if (!innerBlock) return state
    
    // Retirer le bloc du groupe
    const updatedGroup = {
      ...group,
      innerBlocks: group.innerBlocks.filter((b) => b.id !== innerBlockId),
    }
    
    // Ajouter le bloc à la liste principale après le groupe
    const newBlocks = [...state.blocks]
    newBlocks[groupIndex] = updatedGroup
    newBlocks.splice(groupIndex + 1, 0, innerBlock)
    
    return { blocks: newBlocks, isDirty: true }
  }),

  reorderInnerBlocks: (groupId, oldIndex, newIndex) => set((state) => {
    const groupIndex = state.blocks.findIndex((b) => b.id === groupId)
    if (groupIndex === -1) return state
    
    const group = state.blocks[groupIndex]
    if ((group.type !== 'group' && group.type !== 'repeater') || !group.innerBlocks) return state
    
    const newInnerBlocks = [...group.innerBlocks]
    const [movedBlock] = newInnerBlocks.splice(oldIndex, 1)
    newInnerBlocks.splice(newIndex, 0, movedBlock)
    
    const newBlocks = [...state.blocks]
    newBlocks[groupIndex] = {
      ...group,
      innerBlocks: newInnerBlocks,
    }
    
    return { blocks: newBlocks, isDirty: true }
  }),

  duplicateBlock: (blockId) => set((state) => {
    const block = state.blocks.find((b) => b.id === blockId)
    if (!block) return state
    
    const newBlock: FormBlock = {
      ...block,
      id: uuidv4(),
      attributes: { ...block.attributes, label: `${block.attributes.label} (copie)` },
    }
    
    const index = state.blocks.findIndex((b) => b.id === blockId)
    const newBlocks = [
      ...state.blocks.slice(0, index + 1),
      newBlock,
      ...state.blocks.slice(index + 1),
    ]
    
    return { blocks: newBlocks, selectedBlockId: newBlock.id, isDirty: true }
  }),

  selectBlock: (blockId) => set({ selectedBlockId: blockId, selectedInnerBlockId: null }),

  selectInnerBlock: (groupId, innerBlockId) => set({ 
    selectedBlockId: groupId, 
    selectedInnerBlockId: innerBlockId 
  }),

  updateInnerBlock: (groupId, innerBlockId, updates) => set((state) => ({
    blocks: state.blocks.map((block) => {
      if (block.id !== groupId || !block.innerBlocks) return block
      return {
        ...block,
        innerBlocks: block.innerBlocks.map((inner) =>
          inner.id === innerBlockId
            ? { ...inner, ...updates, attributes: { ...inner.attributes, ...updates.attributes } }
            : inner
        ),
      }
    }),
    isDirty: true,
  })),

  addLogicRule: (blockId, rule) => set((state) => {
    const existingLogic = state.logic.find((l) => l.blockId === blockId)
    
    if (existingLogic) {
      return {
        logic: state.logic.map((l) =>
          l.blockId === blockId
            ? { ...l, rules: [...l.rules, { ...rule, id: uuidv4() }] }
            : l
        ),
        isDirty: true,
      }
    }
    
    return {
      logic: [...state.logic, { blockId, rules: [{ ...rule, id: uuidv4() }] }],
      isDirty: true,
    }
  }),

  updateLogicRule: (blockId, ruleId, updates) => set((state) => ({
    logic: state.logic.map((l) =>
      l.blockId === blockId
        ? { ...l, rules: l.rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)) }
        : l
    ),
    isDirty: true,
  })),

  removeLogicRule: (blockId, ruleId) => set((state) => ({
    logic: state.logic
      .map((l) =>
        l.blockId === blockId ? { ...l, rules: l.rules.filter((r) => r.id !== ruleId) } : l
      )
      .filter((l) => l.rules.length > 0),
    isDirty: true,
  })),

  addWebhook: (webhook) => set((state) => ({
    webhooks: [...state.webhooks, { ...webhook, id: uuidv4() }],
    isDirty: true,
  })),

  updateWebhook: (webhookId, updates) => set((state) => ({
    webhooks: state.webhooks.map((w) => (w.id === webhookId ? { ...w, ...updates } : w)),
    isDirty: true,
  })),

  removeWebhook: (webhookId) => set((state) => ({
    webhooks: state.webhooks.filter((w) => w.id !== webhookId),
    isDirty: true,
  })),

  updateSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings },
    isDirty: true,
  })),

  setTheme: (themeId) => set({ themeId, isDirty: true }),

  setActivePanel: (activePanel) => set({ activePanel }),

  resetForm: () => set(initialState),

  markClean: () => set({ isDirty: false }),
}))
