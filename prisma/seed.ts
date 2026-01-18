import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Créer les thèmes par défaut
  const defaultThemes = [
    {
      name: 'Classique',
      isDefault: true,
      properties: JSON.stringify({
        font: 'Inter',
        backgroundColor: '#ffffff',
        questionsColor: '#000000',
        answersColor: '#4a4a4a',
        buttonsBgColor: '#7c3aed',
        buttonsFontColor: '#ffffff',
      }),
    },
    {
      name: 'Sombre',
      isDefault: true,
      properties: JSON.stringify({
        font: 'Inter',
        backgroundColor: '#1a1a2e',
        questionsColor: '#ffffff',
        answersColor: '#a0a0b0',
        buttonsBgColor: '#7c3aed',
        buttonsFontColor: '#ffffff',
      }),
    },
    {
      name: 'Nature',
      isDefault: true,
      properties: JSON.stringify({
        font: 'Open Sans',
        backgroundColor: '#f0f9f4',
        questionsColor: '#1a472a',
        answersColor: '#2d5a3d',
        buttonsBgColor: '#059669',
        buttonsFontColor: '#ffffff',
      }),
    },
    {
      name: 'Océan',
      isDefault: true,
      properties: JSON.stringify({
        font: 'Poppins',
        backgroundColor: '#f0f9ff',
        questionsColor: '#0c4a6e',
        answersColor: '#0369a1',
        buttonsBgColor: '#0284c7',
        buttonsFontColor: '#ffffff',
      }),
    },
    {
      name: 'Chaleureux',
      isDefault: true,
      properties: JSON.stringify({
        font: 'Lato',
        backgroundColor: '#fffbeb',
        questionsColor: '#78350f',
        answersColor: '#92400e',
        buttonsBgColor: '#f59e0b',
        buttonsFontColor: '#ffffff',
      }),
    },
  ]

  for (const theme of defaultThemes) {
    const existing = await prisma.theme.findFirst({
      where: {
        name: theme.name,
        isDefault: true,
      },
    })

    if (!existing) {
      await prisma.theme.create({
        data: theme,
      })
      console.log(`✅ Thème "${theme.name}" créé`)
    } else {
      console.log(`⏭️ Thème "${theme.name}" existe déjà`)
    }
  }

  console.log('🎉 Seeding terminé!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
