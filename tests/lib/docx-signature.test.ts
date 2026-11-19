import { describe, expect, it } from 'vitest'
import PizZip from 'pizzip'
import { buildDocumentData, inspectDocxTags, renderDocx } from '@/lib/docx-template'

// PNG 1×1 valide : suffit à vérifier l'insertion, et son ratio carré exerce le plafond de hauteur.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

function makeDocx(body: string): Buffer {
  const zip = new PizZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  )
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body +
      '</w:body></w:document>'
  )
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}

const para = (text: string) => `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

const blocks = [{ id: 'sig', type: 'signature', attributes: { label: 'Signature' } }]
const mappings = [{ tag: 'signature', blockId: 'sig' }]
const answer = { sig: { kind: 'signature', dataUrl: PNG, signedAt: '2026-11-19T10:00:00Z' } }
const context = { responseId: 'r1', createdAt: new Date('2026-11-19T10:00:00Z'), formTitle: 'F' }

function render(body: string, data = answer) {
  const out = renderDocx(makeDocx(body), buildDocumentData(blocks, mappings, data, context))
  const zip = new PizZip(out)
  return {
    xml: zip.file('word/document.xml')!.asText(),
    rels: zip.file('word/_rels/document.xml.rels')?.asText() ?? '',
    types: zip.file('[Content_Types].xml')!.asText(),
    media: Object.keys(zip.files).filter((f) => f.startsWith('word/media/')),
  }
}

describe('Signature dans un modèle .docx', () => {
  it('{tag} écrit la mention textuelle, sans image', () => {
    const doc = render(para('Fait : {signature}'))
    expect(doc.xml).toContain('Fait : Signé électroniquement le 19/11/2026')
    expect(doc.xml).not.toContain('<w:drawing>')
    expect(doc.media).toHaveLength(0)
  })

  it('{%tag} insère le tracé en image, déclaré dans les relations et les types', () => {
    const doc = render(para('Signature : {%signature} fin'))
    expect(doc.xml).toContain('<w:drawing>')
    // Le texte autour du jeton et la mise en forme du run sont conservés.
    expect(doc.xml).toMatch(/<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">Signature : <\/w:t><w:drawing>/)
    expect(doc.xml).toContain('<w:t xml:space="preserve"> fin</w:t>')
    expect(doc.xml).not.toMatch(/FBSIGIMG/)
    expect(doc.media).toEqual(['word/media/fb-signature-0.png'])
    expect(doc.rels).toContain('Target="media/fb-signature-0.png"')
    expect(doc.types).toContain('<Default Extension="png" ContentType="image/png"/>')
    // Ratio 1:1 → plafonné à 2,5 cm de haut, la largeur suit.
    expect(doc.xml).toContain('<wp:extent cx="900000" cy="900000"/>')
  })

  it('les deux jetons coexistent dans un même document', () => {
    const doc = render(para('{%signature}') + para('{signature}'))
    expect(doc.xml).toContain('<w:drawing>')
    expect(doc.xml).toContain('Signé électroniquement le 19/11/2026')
  })

  it('une réponse sans signature laisse {%tag} vide plutôt que de casser le rendu', () => {
    const doc = render(para('[{%signature}]'), {} as any)
    expect(doc.xml).toContain('[]')
    expect(doc.media).toHaveLength(0)
  })

  it('le contrôle du modèle reconnaît {%tag} comme le champ {tag}', () => {
    expect(inspectDocxTags(makeDocx(para('{%signature}')))).toEqual(['signature'])
  })
})
