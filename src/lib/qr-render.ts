import QRCode from 'qrcode'

export type QrDotStyle = 'square' | 'rounded' | 'dots' | 'classy'
export type QrEyeStyle = 'square' | 'rounded' | 'circle'
export type QrFillMode = 'solid' | 'gradient'
export type QrGradientType = 'linear' | 'radial'
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H'
export type QrLogoShape = 'square' | 'circle'

export interface QrDesign {
  fillMode: QrFillMode
  color: string
  gradientFrom: string
  gradientTo: string
  gradientType: QrGradientType
  gradientAngle: number
  bgColor: string
  bgTransparent: boolean
  dotStyle: QrDotStyle
  eyeStyle: QrEyeStyle
  eyeColorEnabled: boolean
  eyeColor: string
  margin: number
  errorCorrectionLevel: QrErrorLevel
  logoSize: number
  logoPadding: number
  logoBackground: boolean
  logoShape: QrLogoShape
}

export const DEFAULT_QR_DESIGN: QrDesign = {
  fillMode: 'solid',
  color: '#000000',
  gradientFrom: '#7c3aed',
  gradientTo: '#2563eb',
  gradientType: 'linear',
  gradientAngle: 45,
  bgColor: '#ffffff',
  bgTransparent: false,
  dotStyle: 'square',
  eyeStyle: 'square',
  eyeColorEnabled: false,
  eyeColor: '#7c3aed',
  margin: 2,
  errorCorrectionLevel: 'M',
  logoSize: 22,
  logoPadding: 2,
  logoBackground: true,
  logoShape: 'square',
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number
) {
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  if (tl) ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

function createFill(
  ctx: CanvasRenderingContext2D,
  design: QrDesign,
  x: number,
  y: number,
  size: number
): string | CanvasGradient {
  if (design.fillMode === 'solid') return design.color

  const cx = x + size / 2
  const cy = y + size / 2

  if (design.gradientType === 'radial') {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, (size / 2) * Math.SQRT2)
    gradient.addColorStop(0, design.gradientFrom)
    gradient.addColorStop(1, design.gradientTo)
    return gradient
  }

  const rad = (design.gradientAngle * Math.PI) / 180
  // Demi-diagonale projetée sur l'axe du dégradé : garantit que la bande couvre
  // tout le carré quel que soit l'angle.
  const half = (size / 2) * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)))
  const gradient = ctx.createLinearGradient(
    cx - Math.cos(rad) * half,
    cy - Math.sin(rad) * half,
    cx + Math.cos(rad) * half,
    cy + Math.sin(rad) * half
  )
  gradient.addColorStop(0, design.gradientFrom)
  gradient.addColorStop(1, design.gradientTo)
  return gradient
}

export function drawQrCode(
  canvas: HTMLCanvasElement,
  text: string,
  design: QrDesign,
  logo?: HTMLImageElement | null,
  size = 1024
): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx || !text) return false

  let modules
  try {
    modules = QRCode.create(text, {
      // Un logo masque des modules : le niveau H (30% de redondance) garde le code lisible.
      errorCorrectionLevel: logo ? 'H' : design.errorCorrectionLevel,
    }).modules
  } catch {
    return false
  }

  const count = modules.size
  const data = modules.data
  const margin = Math.max(0, design.margin)
  const cell = size / (count + margin * 2)
  const offset = margin * cell
  const overlap = 0.5

  canvas.width = size
  canvas.height = size
  ctx.clearRect(0, 0, size, size)

  if (!design.bgTransparent) {
    ctx.fillStyle = design.bgColor
    ctx.fillRect(0, 0, size, size)
  }

  const isDark = (row: number, col: number) =>
    row >= 0 && col >= 0 && row < count && col < count && data[row * count + col] === 1

  const isFinder = (row: number, col: number) =>
    (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7)

  const bodyFill = createFill(ctx, design, offset, offset, count * cell)
  ctx.fillStyle = bodyFill

  const radius = cell / 2

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!isDark(row, col) || isFinder(row, col)) continue

      const x = offset + col * cell
      const y = offset + row * cell

      if (design.dotStyle === 'dots') {
        ctx.beginPath()
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.45, 0, Math.PI * 2)
        ctx.fill()
        continue
      }

      if (design.dotStyle === 'square') {
        ctx.fillRect(x, y, cell + overlap, cell + overlap)
        continue
      }

      const top = isDark(row - 1, col)
      const bottom = isDark(row + 1, col)
      const left = isDark(row, col - 1)
      const right = isDark(row, col + 1)

      if (design.dotStyle === 'classy') {
        roundedRectPath(
          ctx,
          x,
          y,
          cell + overlap,
          cell + overlap,
          !top && !left ? radius : 0,
          0,
          !bottom && !right ? radius : 0,
          0
        )
      } else {
        roundedRectPath(
          ctx,
          x,
          y,
          cell + overlap,
          cell + overlap,
          !top && !left ? radius : 0,
          !top && !right ? radius : 0,
          !bottom && !right ? radius : 0,
          !bottom && !left ? radius : 0
        )
      }
      ctx.fill()
    }
  }

  const eyeFill = design.eyeColorEnabled ? design.eyeColor : bodyFill
  ctx.fillStyle = eyeFill
  ctx.strokeStyle = eyeFill
  ctx.lineWidth = cell

  const finders: [number, number][] = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ]

  for (const [row, col] of finders) {
    const x = offset + col * cell
    const y = offset + row * cell
    const outer = cell * 7

    if (design.eyeStyle === 'circle') {
      // Cadre très arrondi plutôt qu'un cercle parfait : un cercle ampute les
      // quatre coins du motif de repérage et casse la détection (vérifié avec
      // zbar et OpenCV).
      const r = cell * 2.6
      roundedRectPath(ctx, x + cell / 2, y + cell / 2, outer - cell, outer - cell, r, r, r, r)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x + outer / 2, y + outer / 2, cell * 1.5, 0, Math.PI * 2)
      ctx.fill()
    } else if (design.eyeStyle === 'rounded') {
      // Rayon volontairement modéré : au-delà, les coins retirés au motif de
      // repérage font échouer une partie des lecteurs.
      const r = cell * 1.4
      roundedRectPath(ctx, x + cell / 2, y + cell / 2, outer - cell, outer - cell, r, r, r, r)
      ctx.stroke()
      const ri = cell * 0.8
      roundedRectPath(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, ri, ri, ri, ri)
      ctx.fill()
    } else {
      ctx.strokeRect(x + cell / 2, y + cell / 2, outer - cell, outer - cell)
      ctx.fillRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3)
    }
  }

  if (logo && design.logoSize > 0) {
    const box = (size * design.logoSize) / 100
    const ratio =
      logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 1
    const w = ratio >= 1 ? box : box * ratio
    const h = ratio >= 1 ? box / ratio : box
    const cx = size / 2
    const cy = size / 2
    const pad = (size * design.logoPadding) / 100

    if (design.logoBackground) {
      ctx.fillStyle = design.bgTransparent ? '#ffffff' : design.bgColor
      if (design.logoShape === 'circle') {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(w, h) / 2 + pad, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const bw = w + pad * 2
        const bh = h + pad * 2
        const r = Math.min(bw, bh) * 0.15
        roundedRectPath(ctx, cx - bw / 2, cy - bh / 2, bw, bh, r, r, r, r)
        ctx.fill()
      }
    }

    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h)
  }

  return true
}
