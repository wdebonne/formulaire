import { describe, expect, it } from 'vitest'
import { cleanSenderName, isCompleteHtmlDocument, wrapDocumentEmailBody } from '@/lib/email-body'

describe('cleanSenderName', () => {
  it('keeps an ordinary name, accents included', () => {
    expect(cleanSenderName('  Ordre de Mission — Pavilly ')).toBe('Ordre de Mission — Pavilly')
  })

  // The name can come from a token, so from a respondent: a newline would inject a header,
  // and quotes or brackets would forge the address part of From.
  it('cannot inject a header or forge the address', () => {
    expect(cleanSenderName('RH\r\nBcc: x@evil.test')).toBe('RH Bcc: x@evil.test')
    expect(cleanSenderName('Maire" <maire@evil.test>')).toBe('Maire maire@evil.test')
  })

  it('treats empty input as no name, so the SMTP default applies', () => {
    expect(cleanSenderName(undefined)).toBe('')
    expect(cleanSenderName('   ')).toBe('')
  })
})

describe('wrapDocumentEmailBody', () => {
  it('wraps a fragment in the site envelope', () => {
    const html = wrapDocumentEmailBody('<p>Bonjour</p>', 'Mairie')
    expect(html).toContain('<h1>Mairie</h1>')
    expect(html).toContain('<p>Bonjour</p>')
  })

  // Nesting a full document produced a card inside a card in Outlook, with the inner <head>
  // styles lost — the author's layout must reach the client untouched.
  it('sends a complete HTML document as is', () => {
    const doc = '<!DOCTYPE html>\n<html lang="fr"><head></head><body><p>x</p></body></html>'
    expect(wrapDocumentEmailBody(doc, 'Mairie')).toBe(doc)
  })

  it('gives the header a solid colour Outlook can paint', () => {
    expect(wrapDocumentEmailBody('<p>x</p>', 'Mairie')).toMatch(/\.header \{ background-color: #/)
  })
})

describe('isCompleteHtmlDocument', () => {
  it('recognises a document by its doctype or <html> tag, after whitespace or comments', () => {
    expect(isCompleteHtmlDocument('  <!doctype html><html></html>')).toBe(true)
    expect(isCompleteHtmlDocument('<html lang="fr"><body></body></html>')).toBe(true)
    expect(isCompleteHtmlDocument('<!-- modèle RH -->\n<!DOCTYPE html><html></html>')).toBe(true)
  })

  it('treats a fragment as a fragment, even one mentioning html further down', () => {
    expect(isCompleteHtmlDocument('<p>Voir le code <html> ci-dessous</p>')).toBe(false)
    expect(isCompleteHtmlDocument('<htmlish>')).toBe(false)
    expect(isCompleteHtmlDocument('')).toBe(false)
  })
})
