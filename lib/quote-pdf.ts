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
  clientWebsite?: string | null
  subject: string
  status: string
  validUntil?: Date | null
  deliveryDays?: number | null
  notes?: string | null
  discount: number
  discountType?: string
  items: PdfQuoteItem[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/[\u00A0\u202F]/g, ' ')
}

// Sanitize text for WinAnsi encoding (pdf-lib standard fonts)
function sanitize(text: string): string {
  return text
    .replace(/\u2022/g, '-')   // bullet •
    .replace(/\u2013/g, '-')   // en dash –
    .replace(/\u2014/g, '-')   // em dash —
    .replace(/\u2018/g, "'")   // left single quote '
    .replace(/\u2019/g, "'")   // right single quote '
    .replace(/\u201C/g, '"')   // left double quote "
    .replace(/\u201D/g, '"')   // right double quote "
    .replace(/\u2026/g, '...') // ellipsis …
    .replace(/\u2605/g, '*')   // star ★
    .replace(/[\u00A0\u202F]/g, ' ') // non-breaking spaces
    .replace(/[^\x00-\xFF]/g, '') // remove any remaining non-latin1 chars
}

function getClientDomain(website?: string | null): string | null {
  if (!website) return null
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch { return null }
}

async function fetchClientLogo(domain: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`https://logo.clearbit.com/${domain}`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch { return null }
}

export async function generateQuotePdf(quote: PdfQuote): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const margin = 50
  const contentWidth = pageWidth - margin * 2

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.6, 0.6, 0.6)
  const pink = rgb(225 / 255, 75 / 255, 137 / 255)
  const orange = rgb(248 / 255, 144 / 255, 60 / 255)

  // ─── COVER PAGE ────────────────────────────────────────────────────
  const coverPage = doc.addPage([pageWidth, pageHeight])
  const cx = pageWidth / 2 // center x

  // "Kameo" title (since we can't embed SVG, use text)
  const kameoText = 'Kameo'
  const kameoW = fontBold.widthOfTextAtSize(kameoText, 36)
  coverPage.drawText(kameoText, { x: cx - kameoW / 2, y: pageHeight - 120, size: 36, font: fontBold, color: pink })

  // Tagline
  const tagline = 'L\'expert du site web haut de gamme.'
  const tagW = font.widthOfTextAtSize(tagline, 12)
  coverPage.drawText(tagline, { x: cx - tagW / 2, y: pageHeight - 150, size: 12, font, color: gray })

  // Badges
  const badge1 = '+ de 50 entreprises accompagnées.'
  const badge2 = '4.5 * sur Trustpilot'
  const b1W = font.widthOfTextAtSize(badge1, 10)
  const b2W = font.widthOfTextAtSize(badge2, 10)
  const badgeY = pageHeight - 220
  const badgeGap = 20
  const totalBadgeW = b1W + b2W + badgeGap + 48 // 24 padding each
  const b1X = cx - totalBadgeW / 2

  // Badge 1 border
  coverPage.drawRectangle({ x: b1X, y: badgeY - 10, width: b1W + 24, height: 28, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1, color: rgb(1, 1, 1) })
  coverPage.drawText(badge1, { x: b1X + 12, y: badgeY - 1, size: 10, font, color: gray })

  // Badge 2 border
  const b2X = b1X + b1W + 24 + badgeGap
  coverPage.drawRectangle({ x: b2X, y: badgeY - 10, width: b2W + 24, height: 28, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1, color: rgb(1, 1, 1) })
  coverPage.drawText(badge2, { x: b2X + 12, y: badgeY - 1, size: 10, font, color: gray })

  // Big title: "Conception d'un site internet à votre image."
  const line1 = 'Conception d\'un site'
  const line2a = 'internet '
  const line2b = 'à votre image.'
  const titleSize = 32
  const l1W = fontBold.widthOfTextAtSize(line1, titleSize)
  const l2aW = fontBold.widthOfTextAtSize(line2a, titleSize)
  const l2bW = fontBold.widthOfTextAtSize(line2b, titleSize)
  const titleY = pageHeight - 340

  coverPage.drawText(line1, { x: cx - l1W / 2, y: titleY, size: titleSize, font: fontBold, color: black })
  const line2TotalW = l2aW + l2bW
  const line2X = cx - line2TotalW / 2
  coverPage.drawText(line2a, { x: line2X, y: titleY - 42, size: titleSize, font: fontBold, color: black })
  coverPage.drawText(line2b, { x: line2X + l2aW, y: titleY - 42, size: titleSize, font: fontBold, color: orange })

  // "Proposition exclusive pour [Client]."
  const clientDisplayName = sanitize((quote.clientName || '').split('\n')[0])
  const propA = 'Proposition exclusive pour '
  const propB = `${clientDisplayName}.`
  const propAW = font.widthOfTextAtSize(propA, 14)
  const propBW = fontBold.widthOfTextAtSize(propB, 14)
  const propTotalW = propAW + propBW
  const propX = cx - propTotalW / 2
  const propY = titleY - 110

  coverPage.drawText(propA, { x: propX, y: propY, size: 14, font, color: gray })
  coverPage.drawText(propB, { x: propX + propAW, y: propY, size: 14, font: fontBold, color: black })

  // Client logo — white card with logo
  const logoBoxW = 200
  const logoBoxH = 130
  const logoBoxX = cx - logoBoxW / 2
  const logoBoxY = propY - 50 - logoBoxH

  try {
    // Try clientLogo URL first, then Clearbit fallback
    const clientDomain = getClientDomain(quote.clientWebsite)
    const logoUrl = (quote as { clientLogo?: string }).clientLogo || (clientDomain ? `https://logo.clearbit.com/${clientDomain}` : null)
    if (logoUrl) {
      const logoBytes = await fetchClientLogo(logoUrl.includes('clearbit') ? logoUrl.replace('https://logo.clearbit.com/', '') : '')
        .catch(() => null)
      // If clientLogo is a direct URL (not clearbit), fetch it directly
      const finalBytes = logoUrl.includes('clearbit') ? logoBytes : await fetch(logoUrl, { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.arrayBuffer().then(b => new Uint8Array(b)) : null).catch(() => null)
      if (finalBytes && finalBytes.length > 100) {
        // White card background
        coverPage.drawRectangle({ x: logoBoxX, y: logoBoxY, width: logoBoxW, height: logoBoxH, color: rgb(1, 1, 1), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1 })
        const logoImage = await doc.embedPng(finalBytes).catch(() => doc.embedJpg(finalBytes))
        const logoDims = logoImage.scale(1)
        const pad = 24
        const maxLogoH = logoBoxH - pad * 2
        const maxLogoW = logoBoxW - pad * 2
        const scale = Math.min(maxLogoW / logoDims.width, maxLogoH / logoDims.height, 1)
        const lw = logoDims.width * scale
        const lh = logoDims.height * scale
        coverPage.drawImage(logoImage, {
          x: cx - lw / 2,
          y: logoBoxY + (logoBoxH - lh) / 2,
          width: lw,
          height: lh,
        })
      }
    }
  } catch { /* logo fetch/embed failed — skip silently */ }

  // ─── QUOTE PAGE ────────────────────────────────────────────────────
  let page = doc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  // Helper — auto-sanitizes text for WinAnsi encoding
  function drawText(text: string, x: number, yPos: number, size: number, f = font, color = black) {
    page.drawText(sanitize(text), { x, y: yPos, size, font: f, color })
  }

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // ─── Quote meta: N°, date, validity — top right, small ─────────────
  const rightX = pageWidth - margin
  const today = new Date().toLocaleDateString('fr-FR')

  const numText = `N° ${quote.number}`
  const numWidth = fontBold.widthOfTextAtSize(numText, 8)
  drawText(numText, rightX - numWidth, y, 8, fontBold, pink)

  const dateText = `Émis le : ${today}`
  const dateWidth = font.widthOfTextAtSize(dateText, 7)
  drawText(dateText, rightX - dateWidth, y - 11, 7, font, gray)

  let metaY = y - 21
  if (quote.deliveryDays) {
    const delaiText = sanitize(`Délai de livraison : ${quote.deliveryDays} jours`)
    const delaiWidth = font.widthOfTextAtSize(delaiText, 7)
    drawText(delaiText, rightX - delaiWidth, metaY, 7, font, gray)
    metaY -= 10
  }
  if (quote.validUntil) {
    const validText = sanitize(`Valide jusqu'au : ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}`)
    const validWidth = font.widthOfTextAtSize(validText, 7)
    drawText(validText, rightX - validWidth, metaY, 7, font, gray)
  }

  // ─── DEVIS TITLE (centered) ─────────────────────────────────────────
  const titleText = 'DEVIS'
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 28)
  drawText(titleText, (pageWidth - titleWidth) / 2, y - 10, 28, fontBold, black)
  y -= 50

  // ─── Header: Agency info left, Client info right ───────────────────
  const headerStartY = y
  drawText('Agence Kameo', margin, y, 11, fontBold, gray)
  y -= 16
  drawText('9 rue des colonnes, Paris 75002', margin, y, 9, font, lightGray)
  y -= 13
  drawText('Tel : 06 76 23 00 37 - contact@agencekameo.fr', margin, y, 9, font, lightGray)
  y -= 13
  drawText('SIRET : 980 573 984 00013 | APE : 62.01Z', margin, y, 7, font, lightGray)
  y -= 10
  drawText('TVA : FR54980573984 | RCS Paris 980 573 984', margin, y, 7, font, lightGray)

  // Client info on the right (same layout as agency)
  let clientY = headerStartY
  const clientLines = sanitize(quote.clientName || '').split('\n')
  const clientTitle = clientLines[0] || ''
  const clientTitleW = fontBold.widthOfTextAtSize(clientTitle, 11)
  drawText(clientTitle, rightX - clientTitleW, clientY, 11, fontBold, gray)
  clientY -= 16
  for (const line of clientLines.slice(1)) {
    const lineW = font.widthOfTextAtSize(line, 9)
    drawText(line, rightX - lineW, clientY, 9, font, lightGray)
    clientY -= 13
  }
  if (quote.clientAddress) {
    const addrLines = sanitize(quote.clientAddress).split('\n')
    for (const line of addrLines) {
      const lineW = font.widthOfTextAtSize(line, 9)
      drawText(line, rightX - lineW, clientY, 9, font, lightGray)
      clientY -= 13
    }
  }
  if (quote.clientEmail) {
    const email = sanitize(quote.clientEmail)
    const emailW = font.widthOfTextAtSize(email, 9)
    drawText(email, rightX - emailW, clientY, 9, font, lightGray)
    clientY -= 13
  }

  // Use the lowest Y between agency and client blocks
  y = Math.min(y, clientY) - 10

  // ─── Separator line ────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y, width: contentWidth, height: 2, color: rgb(248 / 255, 144 / 255, 60 / 255) })
  y -= 20

  // ─── Items table ───────────────────────────────────────────────────
  // Table header (4 columns: Contenu, Unité, Qté, Total HT)
  const colX = [margin, margin + contentWidth * 0.58, margin + contentWidth * 0.72, margin + contentWidth * 0.84]
  const headerH = 22

  page.drawRectangle({ x: margin, y: y - headerH, width: contentWidth, height: headerH, color: pink })

  const headerY = y - headerH + 7
  drawText('Contenu', colX[0] + 8, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Prix unit.', colX[1] + 4, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Qté', colX[2] + 4, headerY, 9, fontBold, rgb(1, 1, 1))
  drawText('Total HT', colX[3] + 4, headerY, 9, fontBold, rgb(1, 1, 1))

  y -= headerH + 4

  // Helper to wrap text within a max width (auto-sanitizes)
  function wrapText(text: string, maxWidth: number, size: number, f = font): string[] {
    const clean = sanitize(text)
    const words = clean.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (current) lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }

  // Table rows
  for (let i = 0; i < quote.items.length; i++) {
    const item = quote.items[i]

    // Split description by newlines and wrap each line
    // First line = title (bold), lines starting with - are bullets, empty lines = gap
    const descMaxWidth = (colX[1] - colX[0]) - 16
    const rawLines = item.description.split('\n')
    const allDescLines: { text: string; bold: boolean; gap: boolean; sectionGap: boolean }[] = []
    let isFirstLine = true
    let prevWasEmpty = false
    for (const raw of rawLines) {
      const trimmed = raw.trim()
      if (trimmed === '') {
        allDescLines.push({ text: '', bold: false, gap: true, sectionGap: true })
        isFirstLine = false
        prevWasEmpty = true
      } else {
        const isBullet = /^[•\-–]/.test(trimmed)
        const isTitle = isFirstLine
        const isSectionTitle = !isFirstLine && !isBullet && prevWasEmpty
        const useBold = isTitle || isSectionTitle
        const fontSize = isTitle ? 9 : 8
        const wrapped = wrapText(raw, descMaxWidth, fontSize, useBold ? fontBold : font)
        for (const w of wrapped) {
          allDescLines.push({ text: w, bold: useBold, gap: false, sectionGap: false })
        }
        isFirstLine = false
        prevWasEmpty = false
      }
    }

    const lineHeight = 11
    const titleLineHeight = 14
    const gapHeight = 8 // section gap between blocks
    const totalDescH = allDescLines.reduce((h, l, idx) => {
      if (l.sectionGap) return h + gapHeight
      if (idx === 0 && l.bold) return h + titleLineHeight
      return h + lineHeight
    }, 0)
    const rowH = Math.max(20, totalDescH + 8)

    ensureSpace(rowH + 4)

    if (i % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - rowH, width: contentWidth, height: rowH, color: rgb(0.97, 0.97, 0.97) })
    }

    // Draw description lines (preserving formatting, bold for title/categories)
    let descY = y - 12
    for (let li = 0; li < allDescLines.length; li++) {
      const line = allDescLines[li]
      if (line.sectionGap) {
        descY -= gapHeight
      } else {
        const isTitle = li === 0 && line.bold
        const fontSize = isTitle ? 9 : 8
        if (line.text) drawText(line.text, colX[0] + 8, descY, fontSize, line.bold ? fontBold : font, black)
        descY -= isTitle ? titleLineHeight : lineHeight
      }
    }

    // Prix unit., Qty, Total aligned to top of row
    const rowTopY = y - 14
    const unitPriceText = fmt(item.unitPrice)
    const unitPriceW = font.widthOfTextAtSize(unitPriceText, 8)
    drawText(unitPriceText, colX[1] + 50 - unitPriceW, rowTopY, 8, font, black)

    const qtyText = String(item.quantity)
    const qtyW = font.widthOfTextAtSize(qtyText, 8)
    drawText(qtyText, colX[2] + 30 - qtyW, rowTopY, 8, font, black)

    const totalItemText = fmt(item.quantity * item.unitPrice)
    const totalItemW = font.widthOfTextAtSize(totalItemText, 8)
    drawText(totalItemText, colX[3] + 55 - totalItemW, rowTopY, 8, fontBold, black)

    y -= rowH
  }

  y -= 10

  // ─── Totals ────────────────────────────────────────────────────────
  ensureSpace(120)

  const totalHT = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const isFixed = quote.discountType === 'FIXED'
  const remise = isFixed ? Math.min(quote.discount, totalHT) : totalHT * quote.discount / 100
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
    drawTotalRow(isFixed ? 'Remise' : `Remise (${quote.discount}%)`, `- ${fmt(remise)}`, false, rgb(0.8, 0.5, 0.2))
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
  drawText(sanitize('Échéancier prévisionnel'), totalsX, y, 8, fontBold, gray)
  if (quote.deliveryDays) {
    const delaiLabel = sanitize(`Délai : ${quote.deliveryDays} jours`)
    const delaiW = fontBold.widthOfTextAtSize(delaiLabel, 8)
    drawText(delaiLabel, pageWidth - margin - delaiW, y, 8, fontBold, pink)
  }
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
  const footerText = sanitize('Agence Kameo - 9 rue des colonnes, Paris 75002 - contact@agencekameo.fr')
  const footerWidth = font.widthOfTextAtSize(footerText, 7)
  const footer2 = sanitize('SIRET : 980 573 984 00013 - TVA : FR54980573984 - RCS Paris 980 573 984')
  const footer2W = font.widthOfTextAtSize(footer2, 7)
  // Draw on every page
  for (const p of doc.getPages()) {
    p.drawText(footerText, { x: (pageWidth - footerWidth) / 2, y: footerY, size: 7, font, color: lightGray })
    p.drawText(footer2, { x: (pageWidth - footer2W) / 2, y: footerY - 10, size: 7, font, color: lightGray })
  }

  const pdfBytes = await doc.save()
  return {
    buffer: Buffer.from(pdfBytes),
    pageCount: doc.getPageCount(),
  }
}
