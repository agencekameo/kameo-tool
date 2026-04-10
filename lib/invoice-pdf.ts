import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { readFileSync } from 'fs'
import { join } from 'path'

interface InvoicePdfParams {
  invoiceNumber: string
  clientName: string
  clientCompany?: string | null
  clientAddress?: string | null
  clientPostalCode?: string | null
  clientCity?: string | null
  clientSiret?: string | null
  maintenanceType: string
  month: string
  year: number
  amountHT: number
  amountTTC: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/[\u00A0\u202F]/g, ' ')
}

function sanitize(text: string): string {
  return text
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '')
}

const TYPE_LABELS: Record<string, string> = {
  WEB: 'Web',
  GOOGLE: 'Fiche Google',
  RESEAUX: 'Reseaux sociaux',
  BLOG: 'Blog',
}

async function embedLogo(doc: PDFDocument): Promise<Awaited<ReturnType<typeof doc.embedPng>> | null> {
  try {
    // Try local file first (works in build/serverless)
    const logoPath = join(process.cwd(), 'public', 'kameo-logo-light.png')
    const logoBytes = readFileSync(logoPath)
    return await doc.embedPng(logoBytes)
  } catch {
    try {
      // Fallback: fetch from deployed URL
      const res = await fetch('https://kameo-tool.vercel.app/kameo-logo-light.png', { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      return await doc.embedPng(new Uint8Array(buf))
    } catch {
      return null
    }
  }
}

export async function generateInvoicePdf(params: InvoicePdfParams): Promise<Buffer> {
  const { invoiceNumber, clientName, clientCompany, clientAddress, clientPostalCode, clientCity, clientSiret, maintenanceType, month, year, amountHT, amountTTC } = params
  const typeLabel = TYPE_LABELS[maintenanceType] || maintenanceType
  const tva = amountTTC - amountHT

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  const pink = rgb(225 / 255, 75 / 255, 137 / 255)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.85, 0.85, 0.85)

  const page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // ─── HEADER: Gradient bar ───
  const barHeight = 4
  const strips = 30
  for (let s = 0; s < strips; s++) {
    const t = s / (strips - 1)
    const r = (225 + (248 - 225) * t) / 255
    const g = (75 + (144 - 75) * t) / 255
    const b = (137 + (60 - 137) * t) / 255
    const stripW = pageWidth / strips
    page.drawRectangle({
      x: s * stripW, y: pageHeight - barHeight,
      width: stripW + 1, height: barHeight,
      color: rgb(r, g, b),
    })
  }
  y -= 10

  // ─── LOGO ───
  const logo = await embedLogo(doc)
  if (logo) {
    const logoDims = logo.scale(1)
    const logoHeight = 28
    const logoScale = logoHeight / logoDims.height
    const logoWidth = logoDims.width * logoScale
    page.drawImage(logo, { x: margin, y: y - logoHeight + 10, width: logoWidth, height: logoHeight })
  } else {
    // Fallback: text "Kameo"
    page.drawText('Kameo', { x: margin, y, size: 28, font: fontBold, color: pink })
  }

  // ─── Date (top right) ───
  const dateStr = `Le ${new Date().toLocaleDateString('fr-FR')}`
  const dateW = font.widthOfTextAtSize(dateStr, 9)
  page.drawText(dateStr, { x: pageWidth - margin - dateW, y: pageHeight - margin - 2, size: 9, font, color: gray })

  // ─── FACTURE label (centered) ───
  const factureText = 'FACTURE'
  const factureW = fontBold.widthOfTextAtSize(factureText, 24)
  page.drawText(factureText, { x: (pageWidth - factureW) / 2, y: pageHeight - margin - 10, size: 24, font: fontBold, color: black })
  const numW = font.widthOfTextAtSize(invoiceNumber, 10)
  page.drawText(invoiceNumber, { x: (pageWidth - numW) / 2, y: pageHeight - margin - 26, size: 10, font, color: gray })

  y -= 40

  // ─── Separator ───
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray })
  y -= 30

  // ─── Émetteur / Destinataire ───
  const col1X = margin
  const col2X = pageWidth / 2 + 20

  page.drawText('Emetteur', { x: col1X, y, size: 8, font, color: gray })
  page.drawText('Destinataire', { x: col2X, y, size: 8, font, color: gray })
  y -= 16

  const emitter = [
    'Agence Kameo',
    '9 rue des colonnes',
    '75002 Paris',
    'SIRET : 980 573 984 00013',
    'TVA : FR54980573984',
  ]

  // Build recipient lines: company (or clientName), address, siret
  const recipient: string[] = []
  if (clientCompany) {
    recipient.push(sanitize(clientCompany))
  } else {
    recipient.push(sanitize(clientName))
  }
  if (clientAddress) {
    recipient.push(sanitize(clientAddress))
  }
  if (clientPostalCode || clientCity) {
    const postal = [clientPostalCode, clientCity].filter(Boolean).join(' ')
    recipient.push(sanitize(postal))
  }
  if (clientSiret) {
    recipient.push(`SIRET : ${sanitize(clientSiret)}`)
  }

  let ey = y
  for (const line of emitter) {
    page.drawText(line, { x: col1X, y: ey, size: 10, font: line === emitter[0] ? fontBold : font, color: black })
    ey -= 15
  }

  let ry = y
  for (let i = 0; i < recipient.length; i++) {
    page.drawText(recipient[i], { x: col2X, y: ry, size: 10, font: i === 0 ? fontBold : font, color: black })
    ry -= 15
  }

  y = Math.min(ey, ry) - 20

  y -= 20

  // ─── Table header ───
  const tableX = margin
  const descColW = contentWidth * 0.55
  const qtyColW = contentWidth * 0.1
  const puColW = contentWidth * 0.15

  page.drawRectangle({ x: tableX, y: y - 4, width: contentWidth, height: 24, color: rgb(0.95, 0.95, 0.95) })
  page.drawText('Description', { x: tableX + 8, y: y + 2, size: 9, font: fontBold, color: black })
  page.drawText('Qte', { x: tableX + descColW + 8, y: y + 2, size: 9, font: fontBold, color: black })

  const puLabel = 'Prix unit. HT'
  const puLabelW = fontBold.widthOfTextAtSize(puLabel, 9)
  page.drawText(puLabel, { x: tableX + descColW + qtyColW + puColW - puLabelW - 4, y: y + 2, size: 9, font: fontBold, color: black })

  const totalLabel = 'Total HT'
  const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 9)
  page.drawText(totalLabel, { x: tableX + contentWidth - totalLabelW - 4, y: y + 2, size: 9, font: fontBold, color: black })

  y -= 28

  // ─── Table row ───
  const desc = `Maintenance ${sanitize(typeLabel)} - ${sanitize(month)} ${year}`
  page.drawText(desc, { x: tableX + 8, y: y + 2, size: 10, font, color: black })
  page.drawText('1', { x: tableX + descColW + 8, y: y + 2, size: 10, font, color: black })

  const puStr = fmt(amountHT)
  const puStrW = font.widthOfTextAtSize(puStr, 10)
  page.drawText(puStr, { x: tableX + descColW + qtyColW + puColW - puStrW - 4, y: y + 2, size: 10, font, color: black })

  const totalStr = fmt(amountHT)
  const totalStrW = font.widthOfTextAtSize(totalStr, 10)
  page.drawText(totalStr, { x: tableX + contentWidth - totalStrW - 4, y: y + 2, size: 10, font, color: black })

  y -= 24
  page.drawLine({ start: { x: tableX, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray })
  y -= 30

  // ─── Totals ───
  const totalsX = pageWidth - margin - 200

  function drawTotalLine(label: string, value: string, bold: boolean, yPos: number, color = black) {
    page.drawText(label, { x: totalsX, y: yPos, size: 10, font: bold ? fontBold : font, color: gray })
    const valW = (bold ? fontBold : font).widthOfTextAtSize(value, bold ? 12 : 10)
    page.drawText(value, { x: pageWidth - margin - valW, y: yPos, size: bold ? 12 : 10, font: bold ? fontBold : font, color })
  }

  drawTotalLine('Total HT', fmt(amountHT), false, y)
  y -= 18
  drawTotalLine('TVA (20%)', fmt(tva), false, y)
  y -= 6
  page.drawLine({ start: { x: totalsX, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lightGray })
  y -= 18
  drawTotalLine('Total TTC', fmt(amountTTC), true, y, pink)
  y -= 80

  // ─── Payment info ───
  page.drawRectangle({ x: margin, y: y - 8, width: contentWidth, height: 70, color: rgb(0.97, 0.97, 0.97), borderColor: lightGray, borderWidth: 0.5 })
  page.drawText('Informations de paiement', { x: margin + 12, y: y + 42, size: 10, font: fontBold, color: black })
  page.drawText('Reglement par virement bancaire', { x: margin + 12, y: y + 26, size: 9, font, color: gray })
  page.drawText('IBAN : FR76 1310 6005 0030 0406 5882 074', { x: margin + 12, y: y + 12, size: 9, font, color: black })
  page.drawText('BIC : AGRIFRPP831', { x: margin + 12, y: y - 2, size: 9, font, color: black })

  // ─── Footer ───
  const footerY = margin + 20
  page.drawLine({ start: { x: margin, y: footerY + 10 }, end: { x: pageWidth - margin, y: footerY + 10 }, thickness: 0.5, color: lightGray })
  const footerText = 'Agence Kameo - 9 rue des colonnes, 75002 Paris - contact@agencekameo.fr - 06 62 37 99 85'
  const footerW = font.widthOfTextAtSize(footerText, 7)
  page.drawText(footerText, { x: (pageWidth - footerW) / 2, y: footerY - 4, size: 7, font, color: gray })
  const siretText = 'SIRET : 980 573 984 00013 - TVA : FR54980573984'
  const siretW = font.widthOfTextAtSize(siretText, 7)
  page.drawText(siretText, { x: (pageWidth - siretW) / 2, y: footerY - 16, size: 7, font, color: gray })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}
