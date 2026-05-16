import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Créer ou mettre à jour les paramètres système
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
    console.log('✅ Paramètres système créés')
  } else {
    console.log('⏭️ Paramètres système existent déjà')
  }

  // Créer l'administrateur par défaut si aucun admin n'existe
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
    console.log('✅ Utilisateur admin créé (email: admin@formbuilder.local, mot de passe: admin123)')
    console.log('⚠️  IMPORTANT: Changez le mot de passe admin après la première connexion!')
  } else {
    console.log('⏭️ Un administrateur existe déjà')
  }

  // Créer les templates d'emails par défaut
  const defaultTemplates = [
    {
      name: 'Bienvenue',
      slug: 'welcome',
      subject: 'Bienvenue sur {{siteName}} !',
      isDefault: true,
      variables: JSON.stringify(['siteName', 'name', 'loginUrl', 'year']),
      htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>{{siteName}}</h1>
      </div>
      <div class="content">
        <h2>Bienvenue {{name}} !</h2>
        <p>Votre compte a été créé avec succès sur {{siteName}}.</p>
        <p>Vous pouvez dès maintenant créer vos formulaires et commencer à collecter des réponses.</p>
        <p style="text-align: center;">
          <a href="{{loginUrl}}" class="button">Se connecter</a>
        </p>
      </div>
      <div class="footer">
        <p>© {{year}} {{siteName}}. Tous droits réservés.</p>
      </div>
    </div>
  </body>
</html>`,
    },
    {
      name: 'Mot de passe oublié',
      slug: 'forgot-password',
      subject: 'Réinitialisation de votre mot de passe - {{siteName}}',
      isDefault: true,
      variables: JSON.stringify(['siteName', 'resetUrl', 'year']),
      htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>{{siteName}}</h1>
      </div>
      <div class="content">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
        <p style="text-align: center;">
          <a href="{{resetUrl}}" class="button">Réinitialiser mon mot de passe</a>
        </p>
        <p><strong>Ce lien expire dans 1 heure.</strong></p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.</p>
      </div>
      <div class="footer">
        <p>© {{year}} {{siteName}}. Tous droits réservés.</p>
      </div>
    </div>
  </body>
</html>`,
    },
    {
      name: 'Formulaire partagé',
      slug: 'form-shared',
      subject: '{{sharedByName}} vous a partagé un formulaire - {{siteName}}',
      isDefault: true,
      variables: JSON.stringify(['siteName', 'formTitle', 'sharedByName', 'formUrl', 'year']),
      htmlContent: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>{{siteName}}</h1>
      </div>
      <div class="content">
        <h2>Un formulaire a été partagé avec vous</h2>
        <p><strong>{{sharedByName}}</strong> vous a partagé le formulaire "{{formTitle}}".</p>
        <p>Vous pouvez maintenant accéder à ce formulaire depuis votre tableau de bord.</p>
        <p style="text-align: center;">
          <a href="{{formUrl}}" class="button">Voir le formulaire</a>
        </p>
      </div>
      <div class="footer">
        <p>© {{year}} {{siteName}}. Tous droits réservés.</p>
      </div>
    </div>
  </body>
</html>`,
    },
  ]

  for (const template of defaultTemplates) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { slug: template.slug }
    })

    if (!existing) {
      await prisma.emailTemplate.create({
        data: template
      })
      console.log(`✅ Template "${template.name}" créé`)
    } else {
      console.log(`⏭️ Template "${template.name}" existe déjà`)
    }
  }

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
