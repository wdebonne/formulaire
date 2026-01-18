import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionWithUser } from '@/lib/auth'

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
      const existing = await (prisma as any).font.findUnique({
        where: { family: font.family },
      })

      if (!existing) {
        await (prisma as any).font.create({
          data: {
            name: font.name,
            family: font.family,
            source: 'google',
            weights: JSON.stringify(font.weights),
            isDefault: true,
          },
        })
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
