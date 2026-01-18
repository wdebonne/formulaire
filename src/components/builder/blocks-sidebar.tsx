'use client'

import { v4 as uuidv4 } from 'uuid'
import { useFormBuilder } from '@/stores/form-builder'
import type { BlockType, FormBlock } from '@/types/form'
import {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
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
  Repeat,
} from 'lucide-react'

interface BlockTypeConfig {
  type: BlockType
  label: string
  icon: React.ReactNode
  defaultAttributes: FormBlock['attributes']
  category: 'input' | 'choice' | 'content' | 'screen'
}

const blockTypes: BlockTypeConfig[] = [
  {
    type: 'welcome-screen',
    label: 'Écran d\'accueil',
    icon: <Home className="w-4 h-4" />,
    category: 'screen',
    defaultAttributes: {
      label: 'Bienvenue !',
      description: 'Ce formulaire ne prendra que quelques minutes.',
      buttonText: 'Commencer',
    },
  },
  {
    type: 'short-text',
    label: 'Texte court',
    icon: <Type className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Question texte court',
      placeholder: 'Votre réponse',
      required: false,
    },
  },
  {
    type: 'long-text',
    label: 'Texte long',
    icon: <AlignLeft className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Question texte long',
      placeholder: 'Votre réponse détaillée',
      required: false,
    },
  },
  {
    type: 'number',
    label: 'Nombre',
    icon: <Hash className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Question numérique',
      placeholder: '0',
      required: false,
    },
  },
  {
    type: 'email',
    label: 'Email',
    icon: <Mail className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Votre email',
      placeholder: 'email@exemple.com',
      required: false,
    },
  },
  {
    type: 'phone',
    label: 'Téléphone',
    icon: <Phone className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Votre téléphone',
      placeholder: '+33 6 12 34 56 78',
      required: false,
    },
  },
  {
    type: 'date',
    label: 'Date',
    icon: <Calendar className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Sélectionnez une date',
      required: false,
      format: 'DD/MM/YYYY',
    },
  },
  {
    type: 'dropdown',
    label: 'Liste déroulante',
    icon: <ChevronDown className="w-4 h-4" />,
    category: 'choice',
    defaultAttributes: {
      label: 'Choisissez une option',
      required: false,
      choices: [
        { id: '1', label: 'Option 1', value: 'option-1' },
        { id: '2', label: 'Option 2', value: 'option-2' },
        { id: '3', label: 'Option 3', value: 'option-3' },
      ],
    },
  },
  {
    type: 'multiple-choice',
    label: 'Choix multiple',
    icon: <CheckSquare className="w-4 h-4" />,
    category: 'choice',
    defaultAttributes: {
      label: 'Sélectionnez une ou plusieurs options',
      required: false,
      allowMultiple: true,
      choices: [
        { id: '1', label: 'Option A', value: 'option-a' },
        { id: '2', label: 'Option B', value: 'option-b' },
        { id: '3', label: 'Option C', value: 'option-c' },
      ],
    },
  },
  {
    type: 'slider',
    label: 'Curseur',
    icon: <SlidersHorizontal className="w-4 h-4" />,
    category: 'choice',
    defaultAttributes: {
      label: 'Évaluez sur une échelle',
      required: false,
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 5,
    },
  },
  {
    type: 'legal',
    label: 'Conditions légales',
    icon: <Scale className="w-4 h-4" />,
    category: 'content',
    defaultAttributes: {
      label: 'J\'accepte les conditions générales',
      description: 'En cochant cette case, vous acceptez nos conditions d\'utilisation.',
      required: true,
    },
  },
  {
    type: 'statement',
    label: 'Énoncé',
    icon: <FileText className="w-4 h-4" />,
    category: 'content',
    defaultAttributes: {
      label: 'Information importante',
      description: 'Ceci est un texte informatif qui ne nécessite pas de réponse.',
      buttonText: 'Continuer',
    },
  },
  {
    type: 'file',
    label: 'Téléchargement',
    icon: <FileUp className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Téléchargez un fichier',
      required: false,
    },
  },
  {
    type: 'signature',
    label: 'Signature',
    icon: <PenTool className="w-4 h-4" />,
    category: 'input',
    defaultAttributes: {
      label: 'Votre signature',
      required: false,
    },
  },
  {
    type: 'thankyou-screen',
    label: 'Écran de fin',
    icon: <ThumbsUp className="w-4 h-4" />,
    category: 'screen',
    defaultAttributes: {
      label: 'Merci !',
      description: 'Votre réponse a été enregistrée avec succès.',
    },
  },
  {
    type: 'repeater',
    label: 'Bloc répétable',
    icon: <Repeat className="w-4 h-4" />,
    category: 'content',
    defaultAttributes: {
      label: 'Avez-vous besoin de matériel ?',
      repeatQuestion: 'Avez-vous besoin d\'autre matériel ?',
      repeatYesLabel: 'Oui, ajouter',
      repeatNoLabel: 'Non, continuer',
      maxRepetitions: 10,
    },
  },
]

const categories = [
  { id: 'screen', label: 'Écrans' },
  { id: 'input', label: 'Saisie' },
  { id: 'choice', label: 'Choix' },
  { id: 'content', label: 'Contenu' },
]

export function BlocksSidebar() {
  const { addBlock, selectedBlockId } = useFormBuilder()

  const handleAddBlock = (config: BlockTypeConfig) => {
    const newBlock: FormBlock = {
      id: uuidv4(),
      type: config.type,
      attributes: { ...config.defaultAttributes },
    }
    addBlock(newBlock, selectedBlockId || undefined)
  }

  return (
    <div className="w-56 bg-white border-r flex flex-col">
      <div className="p-3 border-b">
        <h3 className="font-medium text-sm text-gray-900">Blocs</h3>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-4">
        {categories.map((category) => (
          <div key={category.id}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">
              {category.label}
            </h4>
            <div className="space-y-1">
              {blockTypes
                .filter((b) => b.category === category.id)
                .map((blockType) => (
                  <button
                    key={blockType.type}
                    onClick={() => handleAddBlock(blockType)}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-left"
                  >
                    <span className="text-gray-400">{blockType.icon}</span>
                    <span>{blockType.label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
