import type { Metadata } from 'next'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PublicFormClient } from './public-form-client'
import { FormGateScreen } from './form-gate-screen'
import { resolveFormGate } from '@/lib/form-gate'
import { formatAccessDate, parseFormAccessSettings } from '@/lib/form-options'

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

// Un formulaire dont l'option « ne pas référencer » est active est retiré des moteurs de
// recherche. Les écrans de garde le sont toujours : ils n'ont aucun contenu à indexer.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (RESERVED_SLUGS.includes(slug)) return {}

  const form = await prisma.form.findFirst({
    where: { OR: [{ id: slug }, { slug }], status: 'published', deletedAt: null },
    select: { title: true, accessSettings: true },
  })

  if (!form) return {}

  const settings = parseFormAccessSettings(form.accessSettings)
  const restricted = settings.noIndex || settings.passwordEnabled || settings.requireLogin

  return {
    title: form.title,
    ...(restricted && { robots: { index: false, follow: false } }),
  }
}

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
        deletedAt: null,
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

  // Les blocs ne sont chargés côté navigateur qu'une fois l'accès accordé : un formulaire
  // protégé par mot de passe ne doit pas livrer ses questions dans le HTML de l'écran de garde.
  const gate = await resolveFormGate(form)
  if (gate.state !== 'open') {
    return (
      <FormGateScreen
        formId={form.id}
        formTitle={form.title}
        slug={form.slug}
        state={gate.state}
        message={gate.message}
        opensAtLabel={formatAccessDate(gate.opensAt)}
        themeProps={parsedTheme.properties}
        siteLogo={systemSettings?.siteLogo ?? null}
      />
    )
  }

  const parsedForm = {
    id: form.id,
    title: form.title,
    blocks: JSON.parse(form.blocks),
    settings: JSON.parse(form.settings),
    logic: JSON.parse(form.logic),
    webhooks: JSON.parse(form.webhooks),
  }

  return <PublicFormClient form={parsedForm} theme={parsedTheme} siteLogo={systemSettings?.siteLogo ?? null} />
}
