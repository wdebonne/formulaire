import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionWithUser } from '@/lib/auth'

interface FontRecord {
  id: string
  family: string
}

// Polices Google Fonts par défaut
const defaultFonts = [
  { name: 'Inter', family: 'Inter', weights: [400, 500, 600, 700] },
  { name: 'Roboto', family: 'Roboto', weights: [400, 500, 700] },
  { name: 'Open Sans', family: 'Open Sans', weights: [400, 600, 700] },
  { name: 'Lato', family: 'Lato', weights: [400, 700] },
  { name: 'Poppins', family: 'Poppins', weights: [400, 500, 600, 700] },
  { name: 'Montserrat', family: 'Montserrat', weights: [400, 500, 600, 700] },
  { name: 'Playfair Display', family: 'Playfair Display', weights: [400, 500, 600, 700] },
  { name: 'Merriweather', family: 'Merriweather', weights: [400, 700] },
  { name: 'Source Sans Pro', family: 'Source Sans Pro', weights: [400, 600, 700] },
  { name: 'Nunito', family: 'Nunito', weights: [400, 600, 700] },
  { name: 'Raleway', family: 'Raleway', weights: [400, 500, 600, 700] },
  { name: 'Ubuntu', family: 'Ubuntu', weights: [400, 500, 700] },
  { name: 'PT Sans', family: 'PT Sans', weights: [400, 700] },
  { name: 'Oswald', family: 'Oswald', weights: [400, 500, 600, 700] },
  { name: 'Quicksand', family: 'Quicksand', weights: [400, 500, 600, 700] },
  { name: 'Cabin', family: 'Cabin', weights: [400, 500, 600, 700] },
  { name: 'Work Sans', family: 'Work Sans', weights: [400, 500, 600, 700] },
  { name: 'Fira Sans', family: 'Fira Sans', weights: [400, 500, 600, 700] },
  { name: 'Libre Baskerville', family: 'Libre Baskerville', weights: [400, 700] },
  { name: 'Crimson Text', family: 'Crimson Text', weights: [400, 600, 700] },
]

// POST /api/admin/fonts/seed - Initialiser les polices par défaut
export async function POST() {
  try {
    const user = await getSessionWithUser()
    if (!user || (user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let created = 0
    let skipped = 0

    for (const font of defaultFonts) {
      const existing = await prisma.$queryRaw<FontRecord[]>`
        SELECT id, family FROM Font WHERE family = ${font.family}
      `

      if (existing.length === 0) {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const weightsJson = JSON.stringify(font.weights)

        await prisma.$executeRaw`
          INSERT INTO Font (id, name, family, source, url, weights, isDefault, createdAt, updatedAt)
          VALUES (${id}, ${font.name}, ${font.family}, 'google', NULL, ${weightsJson}, 1, ${now}, ${now})
        `
        created++
      } else {
        skipped++
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${created} polices créées, ${skipped} déjà existantes` 
    })
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des polices:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
