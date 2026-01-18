// Script d'initialisation de la base de données
// Crée l'admin par défaut et les paramètres système si nécessaires

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function init() {
  console.log('🔧 Initializing database...')

  try {
    // Vérifier et ajouter les colonnes manquantes dans Response
    try {
      // Vérifier si la colonne webhookStatus existe
      await prisma.$queryRaw`SELECT webhookStatus FROM Response LIMIT 1`
    } catch (columnError) {
      // La colonne n'existe pas, on l'ajoute
      console.log('⚠️  Adding missing column webhookStatus to Response table...')
      try {
        await prisma.$executeRaw`ALTER TABLE "Response" ADD COLUMN "webhookStatus" TEXT DEFAULT '{}'`
        console.log('✅ Column webhookStatus added to Response table')
      } catch (alterError) {
        // Ignorer si la colonne existe déjà (autre type d'erreur)
        if (!alterError.message?.includes('duplicate column')) {
          console.log('⚠️  Could not add webhookStatus column:', alterError.message)
        }
      }
    }

    // Créer les paramètres système si nécessaires
    const existingSettings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    })

    if (!existingSettings) {
      await prisma.systemSettings.create({
        data: {
          id: 'system',
          siteName: 'FormBuilder',
          registrationEnabled: true,
        }
      })
      console.log('✅ System settings created')
    }

    // Créer l'admin par défaut si aucun admin n'existe
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12)
      await prisma.user.create({
        data: {
          email: 'admin@formbuilder.local',
          password: hashedPassword,
          name: 'Administrateur',
          role: 'admin',
        }
      })
      console.log('✅ Admin user created (email: admin@formbuilder.local, password: admin123)')
      console.log('⚠️  IMPORTANT: Change the admin password after first login!')
    } else {
      console.log('⏭️  Admin user already exists')
    }

    // Créer les thèmes par défaut si aucun thème n'existe
    const existingThemes = await prisma.theme.count()
    
    if (existingThemes === 0) {
      await prisma.theme.createMany({
        data: [
          {
            name: 'Moderne Violet',
            isDefault: true,
            properties: JSON.stringify({
              font: 'Inter',
              questionsColor: '#1e293b',
              answersColor: '#64748b',
              buttonsBgColor: '#8b5cf6',
              buttonsFontColor: '#ffffff',
              backgroundColor: '#f8fafc',
              backgroundType: 'color',
              buttonsBorderRadius: 'rounded',
              inputsBorderRadius: 'rounded',
              inputsStyle: 'outlined',
            }),
          },
          {
            name: 'Classique Bleu',
            isDefault: true,
            properties: JSON.stringify({
              font: 'Arial',
              questionsColor: '#1a365d',
              answersColor: '#4a5568',
              buttonsBgColor: '#3182ce',
              buttonsFontColor: '#ffffff',
              backgroundColor: '#ffffff',
              backgroundType: 'color',
              buttonsBorderRadius: 'rounded',
              inputsBorderRadius: 'rounded',
              inputsStyle: 'outlined',
            }),
          },
        ],
      })
      console.log('✅ Default themes created')
    }

    console.log('✅ Database initialization complete')
  } catch (error) {
    console.error('❌ Database initialization error:', error)
    // Ne pas faire échouer le démarrage si l'init échoue
  } finally {
    await prisma.$disconnect()
  }
}

init()
