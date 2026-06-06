import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicFormClient } from './public-form-client'

// Liste des routes réservées à exclure
const RESERVED_SLUGS = [
  'api',
  'login',
  'register',
  'dashboard',
  'builder',
  'forms',
  'settings',
  'forgot-password',
  'reset-password',
  'f',
]

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Si c'est une route réservée, ne pas traiter comme un formulaire
  if (RESERVED_SLUGS.includes(slug)) {
    notFound()
  }

  const [form, systemSettings] = await Promise.all([
    prisma.form.findFirst({
      where: {
        OR: [{ id: slug }, { slug }],
        status: 'published',
      },
      include: {
        theme: true,
      },
    }),
    prisma.systemSettings.findFirst({
      where: { id: 'system' },
      select: { siteLogo: true },
    }),
  ])

  if (!form) {
    notFound()
  }

  // Charger le thème par défaut si le formulaire n'a pas de thème
  let theme = form.theme
  if (!theme) {
    theme = await prisma.theme.findFirst({
      where: { isDefault: true },
    })
  }

  const parsedForm = {
    id: form.id,
    title: form.title,
    blocks: JSON.parse(form.blocks),
    settings: JSON.parse(form.settings),
    logic: JSON.parse(form.logic),
    webhooks: JSON.parse(form.webhooks),
  }

  const parsedTheme = theme
    ? {
        ...theme,
        properties: JSON.parse(theme.properties),
      }
    : {
        id: 'default',
        name: 'Défaut',
        properties: {
          font: 'Inter',
          backgroundColor: '#ffffff',
          questionsColor: '#000000',
          answersColor: '#4a4a4a',
          buttonsBgColor: '#7c3aed',
          buttonsFontColor: '#ffffff',
        },
      }

  return <PublicFormClient form={parsedForm} theme={parsedTheme} siteLogo={systemSettings?.siteLogo ?? null} />
}
