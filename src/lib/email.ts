import nodemailer from 'nodemailer'
import { prisma } from './prisma'

// Récupère les paramètres SMTP depuis la base de données ou les variables d'env
async function getSmtpConfig() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    })

    if (settings && settings.smtpHost) {
      return {
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        secure: settings.smtpSecure || false,
        auth: {
          user: settings.smtpUser || '',
          pass: settings.smtpPass || '',
        },
        from: settings.smtpFrom || 'noreply@formbuilder.local',
        fromName: settings.smtpFromName || '',
      }
    }
  } catch (e) {
    // Si la table n'existe pas encore, utiliser les variables d'env
  }

  // Fallback sur les variables d'environnement
  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || 'noreply@formbuilder.local',
    fromName: process.env.SMTP_FROM_NAME || '',
  }
}

// Crée un transporter dynamique
async function createTransporter() {
  const config = await getSmtpConfig()
  // Formater l'adresse expéditeur avec le nom si disponible
  const fromAddress = config.fromName 
    ? `"${config.fromName}" <${config.from}>`
    : config.from
  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    }),
    from: fromAddress,
  }
}

// Récupère le nom du site depuis les paramètres
async function getSiteName(): Promise<string> {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    })
    return settings?.siteName || 'FormBuilder'
  } catch {
    return 'FormBuilder'
  }
}

// Récupère un template d'email par son slug
async function getEmailTemplate(slug: string): Promise<{ subject: string; htmlContent: string } | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { slug }
    })
    return template
  } catch {
    return null
  }
}

// Remplace les variables dans un template
function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
}

// Template par défaut pour la réinitialisation de mot de passe
function getDefaultPasswordResetTemplate(resetUrl: string, siteName: string): string {
  return `
    <!DOCTYPE html>
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
            <h1>${siteName}</h1>
          </div>
          <div class="content">
            <h2>Réinitialisation de mot de passe</h2>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            </p>
            <p><strong>Ce lien expire dans 1 heure.</strong></p>
            <p>Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

// Template par défaut pour l'email de bienvenue
function getDefaultWelcomeTemplate(name: string, siteName: string, loginUrl: string): string {
  return `
    <!DOCTYPE html>
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
            <h1>${siteName}</h1>
          </div>
          <div class="content">
            <h2>Bienvenue ${name} !</h2>
            <p>Votre compte a été créé avec succès sur ${siteName}.</p>
            <p>Vous pouvez dès maintenant créer vos formulaires et commencer à collecter des réponses.</p>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="button">Se connecter</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

// Template par défaut pour le partage de formulaire
function getDefaultFormSharedTemplate(formTitle: string, sharedByName: string, siteName: string, formUrl: string): string {
  return `
    <!DOCTYPE html>
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
            <h1>${siteName}</h1>
          </div>
          <div class="content">
            <h2>Un formulaire a été partagé avec vous</h2>
            <p><strong>${sharedByName}</strong> vous a partagé le formulaire "${formTitle}".</p>
            <p>Vous pouvez maintenant accéder à ce formulaire depuis votre tableau de bord.</p>
            <p style="text-align: center;">
              <a href="${formUrl}" class="button">Voir le formulaire</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

// Template par défaut pour l'alerte de tentatives de connexion échouées
function getDefaultFailedLoginAlertTemplate(ipAddress: string, attempts: number, siteName: string, securityUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${siteName}</h1>
          </div>
          <div class="content">
            <h2>Tentatives de connexion échouées détectées</h2>
            <p><strong>${attempts}</strong> tentative(s) de connexion échouée(s) ont été enregistrées depuis l'adresse IP <strong>${ipAddress}</strong>.</p>
            <p>Si cela ne vous semble pas habituel, vous pouvez consulter le journal d'activité et ajuster les règles anti-bruteforce depuis l'administration.</p>
            <p style="text-align: center;">
              <a href="${securityUrl}" class="button">Voir la sécurité</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
  const siteName = await getSiteName()
  
  // Essayer de récupérer le template personnalisé
  const template = await getEmailTemplate('forgot-password')
  
  let htmlContent: string
  let subject: string
  
  if (template) {
    subject = replaceVariables(template.subject, { siteName, resetUrl })
    htmlContent = replaceVariables(template.htmlContent, { 
      siteName, 
      resetUrl,
      year: new Date().getFullYear().toString()
    })
  } else {
    subject = `Réinitialisation de votre mot de passe - ${siteName}`
    htmlContent = getDefaultPasswordResetTemplate(resetUrl, siteName)
  }

  const { transporter, from } = await createTransporter()

  const mailOptions = {
    from,
    to: email,
    subject,
    html: htmlContent,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  const siteName = await getSiteName()
  
  const template = await getEmailTemplate('welcome')
  
  let htmlContent: string
  let subject: string
  
  if (template) {
    subject = replaceVariables(template.subject, { siteName, name })
    htmlContent = replaceVariables(template.htmlContent, { 
      siteName, 
      name,
      loginUrl,
      year: new Date().getFullYear().toString()
    })
  } else {
    subject = `Bienvenue sur ${siteName} !`
    htmlContent = getDefaultWelcomeTemplate(name, siteName, loginUrl)
  }

  const { transporter, from } = await createTransporter()

  const mailOptions = {
    from,
    to: email,
    subject,
    html: htmlContent,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return { success: false, error }
  }
}

export async function sendFormSharedEmail(email: string, formTitle: string, sharedByName: string, formId: string) {
  const formUrl = `${process.env.NEXT_PUBLIC_APP_URL}/builder/${formId}`
  const siteName = await getSiteName()
  
  const template = await getEmailTemplate('form-shared')
  
  let htmlContent: string
  let subject: string
  
  if (template) {
    subject = replaceVariables(template.subject, { siteName, formTitle, sharedByName })
    htmlContent = replaceVariables(template.htmlContent, { 
      siteName, 
      formTitle,
      sharedByName,
      formUrl,
      year: new Date().getFullYear().toString()
    })
  } else {
    subject = `${sharedByName} vous a partagé un formulaire - ${siteName}`
    htmlContent = getDefaultFormSharedTemplate(formTitle, sharedByName, siteName, formUrl)
  }

  const { transporter, from } = await createTransporter()

  const mailOptions = {
    from,
    to: email,
    subject,
    html: htmlContent,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Error sending form shared email:', error)
    return { success: false, error }
  }
}

export async function sendFailedLoginAlertEmail(to: string, ipAddress: string, attempts: number) {
  const securityUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/security`
  const siteName = await getSiteName()

  const subject = `Alerte sécurité — ${attempts} tentatives de connexion échouées - ${siteName}`
  const htmlContent = getDefaultFailedLoginAlertTemplate(ipAddress, attempts, siteName, securityUrl)

  const { transporter, from } = await createTransporter()

  const mailOptions = {
    from,
    to,
    subject,
    html: htmlContent,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Error sending failed login alert email:', error)
    return { success: false, error }
  }
}

// Fonction pour tester la connexion SMTP
export async function testSmtpConnection(config?: {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    let transporterConfig
    
    if (config) {
      transporterConfig = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      })
    } else {
      const { transporter } = await createTransporter()
      transporterConfig = transporter
    }

    await transporterConfig.verify()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer un email de test
export async function sendTestEmail(to: string, config?: {
  host: string
  port: number
  user: string
  pass: string
  from: string
  fromName?: string
  secure: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const siteName = await getSiteName()
    let transporter
    let from

    if (config) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      })
      // Formater l'adresse expéditeur avec le nom si disponible
      from = config.fromName 
        ? `"${config.fromName}" <${config.from}>`
        : config.from
    } else {
      const result = await createTransporter()
      transporter = result.transporter
      from = result.from
    }

    await transporter.sendMail({
      from,
      to,
      subject: `Test de configuration SMTP - ${siteName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test SMTP réussi !</h2>
          <p>Si vous recevez cet email, la configuration SMTP fonctionne correctement.</p>
          <p><strong>Date du test :</strong> ${new Date().toLocaleString('fr-FR')}</p>
          <p>— ${siteName}</p>
        </div>
      `,
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
