import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@formbuilder.local',
    to: email,
    subject: 'Réinitialisation de votre mot de passe - FormBuilder',
    html: `
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
              <h1>FormBuilder</h1>
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
              <p>© ${new Date().getFullYear()} FormBuilder. Tous droits réservés.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  try {
    await transporter.sendMail(mailOptions)
    return { success: true }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}
