'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useFormBuilder } from '@/stores/form-builder'
import type { BlockType, FormBlock } from '@/types/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CalendarRange,
  Clock,
  ChevronDown,
  CheckSquare,
  SlidersHorizontal,
  Scale,
  FileText,
  PenTool,
  FileUp,
  Home,
  ThumbsUp,
  Plus,
  LayoutList,
  Repeat,
  ImageIcon,
} from 'lucide-react'

interface BlockTypeConfig {
  type: BlockType
  label: string
  icon: React.ReactNode
  iconColor: string
  defaultAttributes: FormBlock['attributes']
  defaultInnerBlocks?: FormBlock[]
  category: 'input' | 'choice' | 'content' | 'screen' | 'layout'
}

const blockTypes: BlockTypeConfig[] = [
  {
    type: 'welcome-screen',
    label: 'Écran d\'accueil',
    icon: <Home className="w-5 h-5" />,
    iconColor: 'text-blue-500 bg-blue-50',
    category: 'screen',
    defaultAttributes: {
      label: 'Bienvenue !',
      description: 'Ce formulaire ne prendra que quelques minutes.',
      buttonText: 'Commencer',
    },
  },
  {
    type: 'thankyou-screen',
    label: 'Écran de fin',
    icon: <ThumbsUp className="w-5 h-5" />,
    iconColor: 'text-green-500 bg-green-50',
    category: 'screen',
    defaultAttributes: {
      label: 'Merci !',
      description: 'Votre réponse a été enregistrée avec succès.',
    },
  },
  {
    type: 'short-text',
    label: 'Texte court',
    icon: <Type className="w-5 h-5" />,
    iconColor: 'text-gray-600 bg-gray-100',
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
    icon: <AlignLeft className="w-5 h-5" />,
    iconColor: 'text-gray-600 bg-gray-100',
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
    icon: <Hash className="w-5 h-5" />,
    iconColor: 'text-purple-500 bg-purple-50',
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
    icon: <Mail className="w-5 h-5" />,
    iconColor: 'text-blue-500 bg-blue-50',
    category: 'input',
    defaultAttributes: {
      label: 'Votre email',
      placeholder: 'email@exemple.com',
      required: false,
      validateEmail: true,
    },
  },
  {
    type: 'phone',
    label: 'Téléphone',
    icon: <Phone className="w-5 h-5" />,
    iconColor: 'text-emerald-500 bg-emerald-50',
    category: 'input',
    defaultAttributes: {
      label: 'Votre téléphone',
      placeholder: '06 12 34 56 78',
      required: false,
      phoneFormat: 'standard',
      phoneDigitsCount: 10,
    },
  },
  {
    type: 'address',
    label: 'Adresse',
    icon: <MapPin className="w-5 h-5" />,
    iconColor: 'text-lime-600 bg-lime-50',
    category: 'input',
    defaultAttributes: {
      label: 'Votre adresse',
      placeholder: 'Commencez à saisir une adresse...',
      required: false,
    },
  },
  {
    type: 'date',
    label: 'Date',
    icon: <Calendar className="w-5 h-5" />,
    iconColor: 'text-orange-500 bg-orange-50',
    category: 'input',
    defaultAttributes: {
      label: 'Sélectionnez une date',
      required: false,
      format: 'DD/MM/YYYY',
    },
  },
  {
    type: 'advanced-date',
    label: 'Date avancée',
    icon: <CalendarRange className="w-5 h-5" />,
    iconColor: 'text-red-500 bg-red-50',
    category: 'input',
    defaultAttributes: {
      label: 'Sélectionnez une date',
      required: false,
      format: 'DD/MM/YYYY',
      minDateType: 'none',
      maxDateType: 'none',
    },
  },
  {
    type: 'time',
    label: 'Heure',
    icon: <Clock className="w-5 h-5" />,
    iconColor: 'text-indigo-500 bg-indigo-50',
    category: 'input',
    defaultAttributes: {
      label: 'Sélectionnez une heure',
      required: false,
      isTimeRange: false,
      startTimeLabel: 'Heure de début',
      endTimeLabel: 'Heure de fin',
    },
  },
  {
    type: 'file',
    label: 'Téléchargement',
    icon: <FileUp className="w-5 h-5" />,
    iconColor: 'text-cyan-500 bg-cyan-50',
    category: 'input',
    defaultAttributes: {
      label: 'Téléchargez un fichier',
      required: false,
    },
  },
  {
    type: 'signature',
    label: 'Signature',
    icon: <PenTool className="w-5 h-5" />,
    iconColor: 'text-violet-500 bg-violet-50',
    category: 'input',
    defaultAttributes: {
      label: 'Votre signature',
      required: false,
    },
  },
  {
    type: 'dropdown',
    label: 'Liste déroulante',
    icon: <ChevronDown className="w-5 h-5" />,
    iconColor: 'text-teal-500 bg-teal-50',
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
    icon: <CheckSquare className="w-5 h-5" />,
    iconColor: 'text-indigo-500 bg-indigo-50',
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
    type: 'image-selection',
    label: 'Sélection Image',
    icon: <ImageIcon className="w-5 h-5" />,
    iconColor: 'text-fuchsia-500 bg-fuchsia-50',
    category: 'choice',
    defaultAttributes: {
      label: 'Sélectionnez une ou plusieurs images',
      required: false,
      allowMultiple: true,
      imageLayout: 'side-by-side',
      imageColumns: 2,
      showImageLabels: true,
      imageSize: 'medium',
      choices: [
        { id: '1', label: 'Image 1', value: 'image-1', imageUrl: '' },
        { id: '2', label: 'Image 2', value: 'image-2', imageUrl: '' },
      ],
    },
  },
  {
    type: 'slider',
    label: 'Curseur',
    icon: <SlidersHorizontal className="w-5 h-5" />,
    iconColor: 'text-pink-500 bg-pink-50',
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
    icon: <Scale className="w-5 h-5" />,
    iconColor: 'text-amber-500 bg-amber-50',
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
    icon: <FileText className="w-5 h-5" />,
    iconColor: 'text-rose-500 bg-rose-50',
    category: 'content',
    defaultAttributes: {
      label: 'Information importante',
      description: 'Ceci est un texte informatif qui ne nécessite pas de réponse.',
      buttonText: 'Continuer',
    },
  },
  {
    type: 'group',
    label: 'Groupe de questions',
    icon: <LayoutList className="w-5 h-5" />,
    iconColor: 'text-sky-500 bg-sky-50',
    category: 'layout',
    defaultAttributes: {
      label: '',
    },
    defaultInnerBlocks: [
      {
        id: 'inner-1',
        type: 'short-text',
        attributes: {
          label: 'Question 1',
          placeholder: 'Votre réponse',
          required: false,
        },
      },
      {
        id: 'inner-2',
        type: 'short-text',
        attributes: {
          label: 'Question 2',
          placeholder: 'Votre réponse',
          required: false,
        },
      },
    ],
  },
  {
    type: 'repeater',
    label: 'Bloc répétable',
    icon: <Repeat className="w-5 h-5" />,
    iconColor: 'text-orange-500 bg-orange-50',
    category: 'layout',
    defaultAttributes: {
      label: 'Avez-vous des éléments à ajouter ?',
      initialQuestion: 'Avez-vous des éléments à ajouter ?',
      initialYesLabel: 'Oui',
      initialNoLabel: 'Non',
      repeatQuestion: 'Voulez-vous ajouter un autre élément ?',
      repeatYesLabel: 'Oui',
      repeatNoLabel: 'Non',
      maxRepetitions: 10,
    },
    defaultInnerBlocks: [],
  },
]

const categories = [
  { id: 'screen', label: 'Écrans' },
  { id: 'input', label: 'Saisie' },
  { id: 'choice', label: 'Choix' },
  { id: 'content', label: 'Contenu' },
  { id: 'layout', label: 'Mise en page' },
]

interface AddBlockDialogProps {
  trigger?: React.ReactNode
}

export function AddBlockDialog({ trigger }: AddBlockDialogProps) {
  const [open, setOpen] = useState(false)
  const { addBlock, selectedBlockId } = useFormBuilder()

  const handleAddBlock = (config: BlockTypeConfig) => {
    const newBlock: FormBlock = {
      id: uuidv4(),
      type: config.type,
      attributes: { ...config.defaultAttributes },
      // Ajouter les innerBlocks avec des IDs uniques pour les groupes/repeaters
      innerBlocks: config.defaultInnerBlocks 
        ? config.defaultInnerBlocks.map(inner => ({
            ...inner,
            id: uuidv4(),
          }))
        : (config.type === 'group' || config.type === 'repeater') ? [] : undefined,
    }
    addBlock(newBlock, selectedBlockId || undefined)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter une question</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto py-4">
          <div className="grid grid-cols-3 gap-3">
            {categories.map((category) => {
              const categoryBlocks = blockTypes.filter((b) => b.category === category.id)
              if (categoryBlocks.length === 0) return null
              
              return categoryBlocks.map((blockType) => (
                <button
                  key={blockType.type}
                  onClick={() => handleAddBlock(blockType)}
                  className="flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-colors group"
                >
                  <div className={`p-2 rounded-lg ${blockType.iconColor}`}>
                    {blockType.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {blockType.label}
                  </span>
                </button>
              ))
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { blockTypes, categories }
