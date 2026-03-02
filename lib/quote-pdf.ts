import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface PdfQuoteItem {
  description: string
  unit: string
  quantity: number
  unitPrice: number
}

interface PdfQuote {
  number: string
  clientName: string
  clientEmail?: string | null
  clientAddress?: string | null
  subject: string
  status: string
  validUntil?: Date | null
  notes?: string | null
  discount: number
  items: PdfQuoteItem[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export async function generateQuotePdf(quote: PdfQuote): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.6, 0.6, 0.6)
  const pink = rgb(225 / 255, 75 / 255, 137 / 255)

  // Helper
  function drawText(text: string, x: number, yPos: number, size: number, f = font, color = black) {
    page.drawText(text, { x, y: yPos, size, font: f, color })
  }

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // ─── DEVIS TITLE (centered) ─────────────────────────────────────────
  const titleText = 'DEVIS'
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 28)
  drawText(titleText, (pageWidth - titleWidth) / 2, y, 28, fontBold, black)
  y -= 40

  // ─── Header: Agency info left, Quote info right ─────────────────────
  drawText('Agence Kameo', margin, y, 11, fontBold, gray)
  y -= 16
  drawText('9 rue des colonnes, Paris 75002', margin, y, 9, font, lightGray)
  y -= 13
  drawText('Tél : 06 76 23 00 37 — contact@agencekameo.fr', margin, y, 9, font, lightGray)
  y -= 13
  drawText('SIRET : 980 573 984 00013 | APE : 62.01Z', margin, y, 7, font, lightGray)
  y -= 10
  drawText('TVA : FR54980573984 | RCS Paris 980 573 984', margin, y, 7, font, lightGray)

  // Quote info on the right
  const rightX = pageWidth - margin
  const numText = `N° ${quote.number}`
  const numWidth = fontBold.widthOfTextAtSize(numText, 12)
  drawText(numText, rightX - numWidth, pageHeight - margin - 40, 12, fontBold, pink)

  const today = new Date().toLocaleDateString('fr-FR')
  const dateText = `Émis le : ${today}`
  const dateWidth = font.widthOfTextAtSize(dateText, 9)
  drawText(dateText, rightX - dateWidth, pageHeight - margin - 56, 9, font, gray)

  if (quote.validUntil) {
    const validText = `Valide jusqu'au : ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}`
    const validWidth = font.widthOfTextAtSize(validText, 9)
    drawText(validText, rightX - validWidth, pageHeight - margin - 69, 9, font, gray)
  }

  y -= 25

  // ─── Separator line ────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 2, color: rgb(248 / 255, 144 / 255, 60 / 255) })
  y -= 25

  // ─── Client block ──────────────────────────────────────────────────
  drawText('À L\'ATTENTION DE', margin, y, 8, fontBold, lightGray)
  y -= 18

  const clientLines = (quote.clientName || '').split('\n')
  for (const line of clientLines) {
    drawText(line, margin, y, 11, fontBold, black)
    y -= 15
  }
  if (quote.clientEmail) {
    drawText(quote.clientEmail, margin, y, 9, font, gray)
    y -= 13
  }
  if (quote.clientAddress) {
    const addrLines = quote.clientAddress.split('\n')
    for (const line of addrLines) {
      drawText(line, margin, y, 9, font, gray)
      y -= 13
    }
  }
  y -= 10

  // ─── Subject ───────────────────────────────────────────────────────
  drawText('Objet :', margin, y, 8, fontBold, lightGray)
  drawText(` ${quote.subject}`, margin + font.widthOfTextAtSize('Objet : ', 8), y, 10, fontBold, black)
  y -= 25

  // ─── Items table ───────────────────────────────────────────────────
  // Table header
  const colX = [margin, margin + contentWidth * 0.46, margin + contentWidth * 0.60, margin + contentWidth * 0.74, margin + contentWidth * 0.87]
  const headerH = 22

  page.drawRectangle({ x: margin, y: y - headerH, width: contentWidth, height: headerH, color: pink })

  const headerY = y - headerH + 7
  drawText('Contenu', colX[0] + 8, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Unité', colX[1] + 4, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Qté', colX[2] + 4, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Prix HT', colX[3] + 4, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Total HT', colX[4] + 4, headerY, 9, fontBold, rgb(1, 1, 1))

  y -= headerH + 4

  // Table rows
  for (let i = 0; i < quote.items.length; i++) {
    const item = quote.items[i]
    const rowH = 20

    ensureSpace(rowH + 10)

    if (i % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowH, width: contentWidth, height: rowH, color: rgb(0.97, 0.97, 0.97) })
    }

    const rowY = y - rowH + 6

    // Truncate description to first line for PDF
    const descLines = item.description.split('\n')
    const desc = descLines[0].length > 50 ? descLines[0].slice(0, 50) + '...' : descLines[0]
    drawText(desc, colX[0] + 8, rowY, 8, font, black)
    drawText(item.unit || '—', colX[1] + 4, rowY, 8, font, gray)

    const qtyText = String(item.quantity)
    const qtyW = font.widthOfTextAtSize(qtyText, 8)
    drawText(qtyText, colX[2] + 30 - qtyW, rowY, 8, font, black)

    const priceText = fmt(item.unitPrice)
    const priceW = font.widthOfTextAtSize(priceText, 8)
    drawText(priceText, colX[3] + 50 - priceW, rowY, 8, font, black)

    const totalItemText = fmt(item.quantity * item.unitPrice)
    const totalItemW = font.widthOfTextAtSize(totalItemText, 8)
    drawText(totalItemText, colX[4] + 55 - totalItemW, rowY, 8, fontBold, black)

    // Sub-description
    if (descLines.length > 1) {
      const subDesc = descLines.slice(1).join(' ').slice(0, 70)
      drawText(subDesc, colX[0] + 8, rowY - 10, 7, font, lightGray)
      y -= rowH + 10
    } else {
      y -= rowH
    }
  }

  y -= 10

  // ─── Totals ────────────────────────────────────────────────────────
  ensureSpace(120)

  const totalHT = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const remise = totalHT * quote.discount / 100
  const sousTotal = totalHT - remise
  const tva = sousTotal * 0.20
  const totalTTC = sousTotal + tva

  const totalsX = pageWidth - margin - 200

  function drawTotalRow(label: string, value: string, bold = false, color = black) {
    const f = bold ? fontBold : font
    const size = bold ? 11 : 9
    drawText(label, totalsX, y, size, f, color)
    const vW = f.widthOfTextAtSize(value, size)
    drawText(value, pageWidth - margin - vW, y, size, f, color)
    y -= bold ? 20 : 16
  }

  drawTotalRow('Total HT', fmt(totalHT))
  if (quote.discount > 0) {
    drawTotalRow(`Remise (${quote.discount}%)`, `- ${fmt(remise)}`, false, rgb(0.8, 0.5, 0.2))
    drawTotalRow('Sous-total HT', fmt(sousTotal))
  }
  drawTotalRow('TVA 20%', fmt(tva))

  // Total TTC with background
  page.drawRectangle({ x: totalsX - 8, y: y - 5, width: 208, height: 24, color: pink })
  drawText('Total TTC', totalsX, y, 11, fontBold, rgb(1, 1, 1))
  const ttcText = fmt(totalTTC)
  const ttcW = fontBold.widthOfTextAtSize(ttcText, 11)
  drawText(ttcText, pageWidth - margin - ttcW, y, 11, fontBold, rgb(1, 1, 1))
  y -= 35

  // ─── Échéancier ────────────────────────────────────────────────────
  ensureSpace(60)
  drawText('Échéancier prévisionnel', totalsX, y, 8, fontBold, gray)
  y -= 14
  drawText('50% à la commande', totalsX, y, 8, font, lightGray)
  const a1 = fmt(totalTTC * 0.50)
  const a1W = font.widthOfTextAtSize(a1, 8)
  drawText(a1, pageWidth - margin - a1W, y, 8, font, gray)
  y -= 12
  drawText('50% à la livraison', totalsX, y, 8, font, lightGray)
  const a2 = fmt(totalTTC * 0.50)
  const a2W = font.widthOfTextAtSize(a2, 8)
  drawText(a2, pageWidth - margin - a2W, y, 8, font, gray)
  y -= 25

  // ─── Notes ─────────────────────────────────────────────────────────
  if (quote.notes) {
    ensureSpace(40)
    page.drawRectangle({ x: margin, y, width: contentWidth, height: 0.5, color: rgb(0.85, 0.85, 0.85) })
    y -= 15
    drawText('Notes', margin, y, 8, fontBold, lightGray)
    y -= 14
    const noteLines = quote.notes.split('\n').slice(0, 5)
    for (const line of noteLines) {
      drawText(line.slice(0, 80), margin, y, 8, font, gray)
      y -= 12
    }
    y -= 10
  }

  // ─── Payment + Signature section ───────────────────────────────────
  ensureSpace(160)
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 0.5, color: rgb(0.85, 0.85, 0.85) })
  y -= 20

  // Payment (left)
  drawText('RÈGLEMENT', margin, y, 8, fontBold, lightGray)
  y -= 16
  drawText('Mode : Virement Bancaire', margin, y, 8, font, gray)
  y -= 12
  drawText('Banque : Crédit Agricole', margin, y, 8, font, gray)
  y -= 14
  drawText('IBAN : FR76 1310 6005 0030 0406 5882 074', margin, y, 7, font, gray)
  y -= 11
  drawText('BIC : AGRIFRPP831', margin, y, 7, font, gray)
  y -= 16
  drawText('Conditions : 50% à la commande · 50% à la livraison', margin, y, 7, fontBold, gray)
  y -= 25

  // Signature (right column)
  const sigX = pageWidth / 2 + 20
  const sigY = y + 94 // align with payment
  drawText('BON POUR ACCORD ET SIGNATURE', sigX, sigY, 8, fontBold, lightGray)
  drawText('Fait à :', sigX, sigY - 22, 8, font, lightGray)
  page.drawLine({ start: { x: sigX, y: sigY - 35 }, end: { x: pageWidth - margin, y: sigY - 35 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  drawText('Le :', sigX, sigY - 50, 8, font, lightGray)
  page.drawLine({ start: { x: sigX, y: sigY - 63 }, end: { x: pageWidth - margin, y: sigY - 63 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  drawText('Signature :', sigX, sigY - 78, 8, font, lightGray)
  page.drawLine({ start: { x: sigX, y: sigY - 105 }, end: { x: pageWidth - margin, y: sigY - 105 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })

  // ─── Footer ────────────────────────────────────────────────────────
  const footerY = margin - 10
  const footerText = 'Agence Kameo — 9 rue des colonnes, Paris 75002 — contact@agencekameo.fr'
  const footerWidth = font.widthOfTextAtSize(footerText, 7)
  // Draw on every page
  for (const p of doc.getPages()) {
    p.drawText(footerText, { x: (pageWidth - footerWidth) / 2, y: footerY, size: 7, font, color: lightGray })
    const footer2 = 'SIRET : 980 573 984 00013 — TVA : FR54980573984 — RCS Paris 980 573 984'
    const footer2W = font.widthOfTextAtSize(footer2, 7)
    p.drawText(footer2, { x: (pageWidth - footer2W) / 2, y: footerY - 10, size: 7, font, color: lightGray })
  }

  const pdfBytes = await doc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    pageCount: doc.getPageCount(),
  }
}
