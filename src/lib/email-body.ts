// A body that already carries its own <html> has its own layout: wrapping it would nest one
// document inside another, which mail clients render as a card inside a card, and drop the
// inner <head> styles on the way.
export function isCompleteHtmlDocument(body: string): boolean {
  return /^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype\s+html|<html[\s>])/i.test(body)
}

export function wrapDocumentEmailBody(body: string, siteName: string): string {
  if (isCompleteHtmlDocument(body)) return body

  // background-color precedes the gradient: Outlook ignores gradients, and white text on its
  // default white background left an empty band at the top of the message.
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6b5fc7; background-image: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header" bgcolor="#6b5fc7">
            <h1>${siteName}</h1>
          </div>
          <div class="content">
            ${body}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. Tous droits réservés.</p>
          </div>
        </div>
      </body>
    </html>
  `
}
