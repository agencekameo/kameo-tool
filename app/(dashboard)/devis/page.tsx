'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Trash2, Pencil, Eye, Download, X, ChevronDown, ChevronLeft, FileText, Check, Send, Loader2, Package, Sparkles, Settings, Copy, GripVertical,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  unit?: string
}

interface Quote {
  id: string
  number: string
  clientId?: string
  clientName: string
  clientEmail?: string
  clientAddress?: string
  clientLogo?: string
  subject: string
  status: 'EN_ATTENTE' | 'BROUILLON' | 'ENVOYE' | 'ACCEPTE' | 'REFUSE' | 'EXPIRE'
  validUntil?: string
  notes?: string
  discount: number
  discountType: 'PERCENT' | 'FIXED'
  deliveryDays?: number | null
  items: QuoteItem[]
  clientWebsite?: string
  client?: { id: string; name: string }
  createdBy: { name: string }
  createdAt: string
}

interface ArticleTemplate {
  id: string
  name: string
  description: string
  unitPrice: number
  unit?: string
  deliveryDays?: number | null
}

interface Client {
  id: string
  name: string
  firstName?: string
  lastName?: string
  company?: string
  email?: string
  address?: string
  postalCode?: string
  city?: string
  website?: string
  logo?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Quote['status'], string> = {
  EN_ATTENTE: 'En attente',
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EXPIRE: 'Expiré',
}

const STATUS_COLORS: Record<Quote['status'], string> = {
  EN_ATTENTE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  BROUILLON: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  ENVOYE:    'bg-blue-500/15 text-blue-400 border-blue-500/20',
  ACCEPTE:   'bg-green-500/15 text-green-400 border-green-500/20',
  REFUSE:    'bg-red-500/15 text-red-400 border-red-500/20',
  EXPIRE:    'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

const UNITS = ['forfait', 'jour', 'heure', 'page', 'mois', 'unité']

function genTempId() {
  return `tmp_${Math.random().toString(36).slice(2)}`
}

// ─── Totals helper ────────────────────────────────────────────────────────────

function calcTotals(items: QuoteItem[], discount: number, discountType: 'PERCENT' | 'FIXED' = 'PERCENT') {
  const totalHT = (items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const remise = discountType === 'FIXED' ? Math.min(discount, totalHT) : totalHT * discount / 100
  const sousTotal = totalHT - remise
  const tva = sousTotal * 0.20
  const totalTTC = sousTotal + tva
  return { totalHT, remise, sousTotal, tva, totalTTC }
}

// ─── Print View ───────────────────────────────────────────────────────────────

function getClientDomain(website?: string): string | null {
  if (!website) return null
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch { return null }
}

function buildQuoteHtml(quote: Quote, signatureData: { signatureImage?: string; signedCity?: string; signedDate?: string; signerName?: string } | null) {
  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(quote.items, quote.discount, quote.discountType)
  const today = new Date().toLocaleDateString('fr-FR')
  const clientDomain = getClientDomain(quote.clientWebsite)
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u202F/g, ' ')

  const itemsHtml = quote.items.map((item, i) => {
    const lines = item.description.split('\n')
    const descHtml = lines.map((line, li) => {
      const trimmed = line.trim()
      const isBullet = /^[•\-–]/.test(trimmed)
      const isEmpty = trimmed === ''
      const isFirstLine = li === 0
      const prevEmpty = li > 0 && lines[li - 1].trim() === ''
      const isSectionTitle = !isEmpty && !isBullet && !isFirstLine && prevEmpty
      if (isEmpty) return '<div style="height:10px"></div>'
      if (isFirstLine) return `<div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:2px">${line}</div>`
      if (isSectionTitle) return `<div style="font-weight:700;font-size:13px;color:#111827;margin-top:4px">${line}</div>`
      return `<div style="color:#4b5563">${line}</div>`
    }).join('')
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:12px 16px;color:#1f2937;border-bottom:1px solid #f3f4f6;font-size:13px;line-height:1.6">${descHtml}</td>
      <td style="padding:12px;text-align:center;color:#6b7280;border-bottom:1px solid #f3f4f6;vertical-align:top;font-size:13px">${fmt(item.unitPrice)}</td>
      <td style="padding:12px;text-align:right;color:#1f2937;border-bottom:1px solid #f3f4f6;vertical-align:top;font-size:13px">${item.quantity}</td>
      <td style="padding:12px 16px;text-align:right;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;vertical-align:top;font-size:13px">${fmt(item.quantity * item.unitPrice)}</td>
    </tr>`
  }).join('')

  const discountHtml = quote.discount > 0 ? `
    <div style="display:flex;justify-content:space-between;color:#ea580c;padding:6px 0;border-bottom:1px solid #f3f4f6"><span>Remise${quote.discountType === 'FIXED' ? '' : ` (${quote.discount}%)`}</span><span>- ${fmt(remise)}</span></div>
    <div style="display:flex;justify-content:space-between;color:#4b5563;padding:6px 0;border-bottom:1px solid #f3f4f6"><span>Sous-total HT</span><span style="font-weight:500">${fmt(sousTotal)}</span></div>
  ` : ''

  const signatureHtml = signatureData?.signatureImage ? `
    <div style="font-size:13px;color:#4b5563">
      <div style="display:flex;gap:16px;margin-bottom:8px">
        <div><div style="font-size:11px;color:#9ca3af">Fait à :</div><div style="font-weight:500;color:#1f2937">${signatureData.signedCity || '—'}</div></div>
        <div><div style="font-size:11px;color:#9ca3af">Le :</div><div style="font-weight:500;color:#1f2937">${signatureData.signedDate || '—'}</div></div>
      </div>
      <div><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Signé par ${signatureData.signerName} :</div>
        <img src="${signatureData.signatureImage}" style="max-height:64px;border:1px solid #e5e7eb;border-radius:4px;background:#fff;padding:4px" />
      </div>
    </div>
  ` : `
    <div style="font-size:13px;color:#4b5563">
      <div style="margin-bottom:16px"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Fait à :</div><div style="border-bottom:1px solid #d1d5db;min-height:28px"></div></div>
      <div style="margin-bottom:16px"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Le :</div><div style="border-bottom:1px solid #d1d5db;min-height:28px"></div></div>
      <div><div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Signature :</div><div style="border-bottom:1px solid #d1d5db;min-height:52px"></div></div>
    </div>
  `

  const logoUrl = `${window.location.origin}/kameo-logo-light.svg`
  const clientLogoUrl = quote.clientLogo || (clientDomain ? `https://logo.clearbit.com/${clientDomain}` : '')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Devis ${quote.number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
  @page { margin: 0; size: A4; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    thead { display: table-row-group; }
  }
</style></head><body>

<!-- PAGE DE GARDE -->
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;page-break-after:always;text-align:center">
  <img src="${logoUrl}" style="height:56px;margin-bottom:12px" />
  <div style="color:#6b7280;font-size:14px;margin-bottom:64px;letter-spacing:0.5px">L'expert du site web haut de gamme.</div>
  <div style="display:flex;gap:24px;margin-bottom:64px">
    <div style="border:1px solid #e5e7eb;border-radius:9999px;padding:10px 24px;font-size:14px;color:#4b5563">+ de 50 entreprises accompagnées.</div>
    <div style="border:1px solid #e5e7eb;border-radius:9999px;padding:10px 24px;font-size:14px;color:#4b5563">4.5 ★ sur Trustpilot</div>
  </div>
  <div style="font-size:48px;font-weight:700;color:#111827;line-height:1.2;margin-bottom:48px">
    Conception d'un site<br/>internet <span style="color:#F8903C">à votre image.</span>
  </div>
  <div style="color:#6b7280;font-size:18px;margin-bottom:48px">
    Proposition exclusive pour <strong style="color:#111827">${quote.clientName.split('\n')[0]}.</strong>
  </div>
  ${clientLogoUrl ? `<div style="width:280px;height:180px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:32px">
    <img src="${clientLogoUrl}" style="max-height:100%;max-width:100%;object-fit:contain" onerror="this.parentElement.style.display='none'" />
  </div>` : ''}
</div>

<!-- CONTENU DU DEVIS -->
<div style="max-width:800px;margin:0 auto;padding:40px 48px">
  <!-- Header -->
  <div style="margin-bottom:40px;padding-bottom:32px;border-bottom:3px solid #F8903C">
    <div style="position:relative;margin-bottom:24px">
      <div style="position:absolute;top:0;right:0;text-align:right">
        <div style="font-size:12px;font-weight:700;color:#E14B89">N° ${quote.number}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:2px">
          <div>Émis le : ${today}</div>
          ${quote.deliveryDays ? `<div>Délai de livraison : ${quote.deliveryDays} jours</div>` : ''}
          ${quote.validUntil ? `<div>Valide jusqu'au : ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}</div>` : ''}
        </div>
      </div>
      <img src="${logoUrl}" style="height:36px;display:block;margin:0 auto" />
    </div>
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:28px;font-weight:600;letter-spacing:-0.5px;color:#1f2937">Devis</div>
    </div>
    <div style="display:flex;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:600;color:#374151;margin-bottom:8px">Agence Kameo</div>
        <div style="font-size:12px;color:#6b7280;line-height:1.8">
          9 rue des colonnes, 75002<br/>Paris<br/>06 76 23 00 37<br/>contact@agencekameo.fr<br/><span style="padding-top:6px;display:inline-block">SIRET : 980 573 984 00013</span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:600;color:#374151;margin-bottom:8px">À l'attention de</div>
        <div style="font-size:12px;color:#6b7280;line-height:1.8">
          <div style="font-weight:500;color:#111827">${quote.clientName}</div>
          ${quote.clientEmail ? `<div>${quote.clientEmail}</div>` : ''}
          ${quote.clientAddress ? `<div style="white-space:pre-line">${quote.clientAddress}</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Table -->
  <table style="width:100%;margin-bottom:8px;font-size:13px;border-collapse:collapse">
    <thead>
      <tr style="background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%)">
        <th style="text-align:left;padding:10px 16px;color:#fff;font-weight:600;width:55%">Contenu</th>
        <th style="text-align:center;padding:10px 12px;color:#fff;font-weight:600">Prix unitaire</th>
        <th style="text-align:right;padding:10px 12px;color:#fff;font-weight:600">Qté</th>
        <th style="text-align:right;padding:10px 16px;color:#fff;font-weight:600">Total HT</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:40px;margin-top:16px">
    <div style="width:288px;font-size:13px">
      <div style="display:flex;justify-content:space-between;color:#4b5563;padding:6px 0;border-bottom:1px solid #f3f4f6"><span>Total HT</span><span style="font-weight:500">${fmt(totalHT)}</span></div>
      ${discountHtml}
      <div style="display:flex;justify-content:space-between;color:#4b5563;padding:6px 0;border-bottom:1px solid #f3f4f6"><span>TVA 20%</span><span style="font-weight:500">${fmt(tva)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;color:#fff;font-size:15px;padding:12px 16px;border-radius:8px;margin-top:4px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%)"><span>Total TTC</span><span>${fmt(totalTTC)}</span></div>
      <div style="margin-top:16px;font-size:11px;color:#6b7280;background:#f9fafb;border-radius:8px;padding:12px 16px;border:1px solid #f3f4f6">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;color:#4b5563">Échéancier prévisionnel</span>
          ${quote.deliveryDays ? `<span style="font-weight:600;color:#E14B89">Délai : ${quote.deliveryDays} jours</span>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between"><span>50% à la commande</span><span style="font-weight:500;color:#374151">${fmt(totalTTC * 0.5)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px"><span>50% à la livraison</span><span style="font-weight:500;color:#374151">${fmt(totalTTC * 0.5)}</span></div>
      </div>
    </div>
  </div>

  ${quote.notes ? `
  <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-bottom:32px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px;font-weight:700">Notes</div>
    <p style="color:#4b5563;font-size:13px;white-space:pre-line">${quote.notes}</p>
  </div>` : ''}

  <!-- Règlement + Signature + Footer — bloc insécable -->
  <div style="page-break-inside:avoid;break-inside:avoid">
    <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:12px;font-weight:700">Règlement</div>
        <div style="font-size:13px;color:#4b5563;line-height:1.6">
          Mode : Virement Bancaire<br/>Banque : Crédit Agricole
          <div style="font-family:monospace;font-size:11px;margin-top:8px;color:#374151">IBAN : FR76 1310 6005 0030 0406 5882 074</div>
          <div style="font-family:monospace;font-size:11px;color:#374151">BIC : AGRIFRPP831</div>
        </div>
        <div style="margin-top:12px;font-size:11px;color:#6b7280;background:#f9fafb;border-radius:4px;padding:8px 12px">
          <strong>Conditions :</strong> 50% à la commande · 50% à la livraison
        </div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:12px;font-weight:700">Bon pour accord et signature</div>
        ${signatureHtml}
      </div>
    </div>

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #f3f4f6;font-size:10px;color:#9ca3af;text-align:center;line-height:1.8">
      Agence Kameo — 9 rue des colonnes, Paris 75002 — contact@agencekameo.fr<br/>
      SIRET : 980 573 984 00013 — TVA : FR54980573984 — RCS Paris 980 573 984
      ${quote.validUntil ? ` — Offre valable jusqu'au ${new Date(quote.validUntil).toLocaleDateString('fr-FR')}` : ''}
    </div>
  </div>
</div>
</body></html>`
}

function PrintView({ quote, onClose, onSendSignature }: { quote: Quote; onClose: () => void; onSendSignature?: (q: Quote) => void }) {
  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(quote.items, quote.discount, quote.discountType)
  const today = new Date().toLocaleDateString('fr-FR')
  const clientDomain = getClientDomain(quote.clientWebsite)
  const [logoError, setLogoError] = useState(false)
  const [signatureData, setSignatureData] = useState<{ signatureImage?: string; signedCity?: string; signedDate?: string; signerName?: string } | null>(null)

  // Fetch signature if quote is signed
  useEffect(() => {
    if (quote.id && quote.status === 'ACCEPTE') {
      fetch(`/api/quotes/${quote.id}/signature`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setSignatureData(data) })
        .catch(() => {})
    }
  }, [quote.id, quote.status])

  function handleDownload() {
    // Open a clean window with ONLY the quote HTML, then print it
    const html = buildQuoteHtml(quote, signatureData)
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) { alert('Autorisez les popups pour télécharger le PDF.'); return }
    printWindow.document.write(html)
    printWindow.document.close()
    // Wait for images to load, then print
    setTimeout(() => {
      printWindow.print()
      // Close after print dialog closes
      printWindow.onafterprint = () => printWindow.close()
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      {/* Screen-only controls */}
      <div className="fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-[#E14B89] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
        >
          <Download size={16} />
          Télécharger PDF
        </button>
        {quote.id && onSendSignature && (
          <button
            onClick={() => { onClose(); onSendSignature(quote) }}
            className="flex items-center gap-2 bg-white border border-[#E14B89] text-[#E14B89] px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-[#E14B89]/5 transition-colors"
          >
            <Send size={16} />
            Envoyer pour signature
          </button>
        )}
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
        >
          <X size={16} />
          Fermer
        </button>
      </div>

      {/* ─── Cover Page ─── */}
      <div className="max-w-[800px] mx-auto px-12 py-10 text-gray-900 flex flex-col items-center justify-center min-h-screen">
        {/* Kameo logo */}
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kameo-logo-light.svg" alt="Kameo" className="h-14 mx-auto" />
        </div>
        <div className="text-gray-500 text-sm mb-16 tracking-wide">L&apos;expert du site web haut de gamme.</div>

        {/* Badges */}
        <div className="flex gap-6 mb-16">
          <div className="border border-gray-200 rounded-full px-6 py-2.5 text-sm text-gray-600">+ de 50 entreprises accompagnées.</div>
          <div className="border border-gray-200 rounded-full px-6 py-2.5 text-sm text-gray-600">4.5 ★ sur Trustpilot</div>
        </div>

        {/* Big title */}
        <div className="text-center mb-12">
          <div className="text-5xl font-bold text-gray-900 leading-tight">
            Conception d&apos;un site
          </div>
          <div className="text-5xl font-bold leading-tight">
            <span className="text-gray-900">internet </span>
            <span style={{ color: '#F8903C' }}>à votre image.</span>
          </div>
        </div>

        {/* Client name */}
        <div className="text-gray-500 text-lg mb-12">
          Proposition exclusive pour <strong className="text-gray-900">{quote.clientName.split('\n')[0]}.</strong>
        </div>

        {/* Client logo */}
        {quote.clientLogo ? (
          <div className="w-[280px] h-[180px] flex items-center justify-center rounded-2xl bg-white shadow-lg p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={quote.clientLogo} alt="Logo client" className="max-h-full max-w-full object-contain" />
          </div>
        ) : clientDomain && !logoError ? (
          <div className="w-[280px] h-[180px] flex items-center justify-center rounded-2xl bg-white shadow-lg p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://logo.clearbit.com/${clientDomain}`}
              alt="Logo client"
              className="max-h-full max-w-full object-contain"
              onError={() => setLogoError(true)}
            />
          </div>
        ) : null}
      </div>

      {/* ─── Quote content ─── */}
      <div className="max-w-[800px] mx-auto px-12 py-10 text-gray-900">

        {/* Header */}
        <div className="mb-10 pb-8 border-b-[3px]" style={{ borderColor: '#F8903C' }}>
          {/* Quote meta top-right + Logo centered */}
          <div className="relative mb-6">
            <div className="absolute top-0 right-0 text-right">
              <div className="text-xs font-bold" style={{ color: '#E14B89' }}>N° {quote.number}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 space-y-0">
                <div>Émis le : {today}</div>
                {quote.deliveryDays && (
                  <div>Délai de livraison : {quote.deliveryDays} jours</div>
                )}
                {quote.validUntil && (
                  <div>Valide jusqu&apos;au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</div>
                )}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kameo-logo-light.svg" alt="Kameo" className="h-9 mx-auto" />
          </div>
          {/* Devis title centered */}
          <div className="text-center mb-8">
            <div className="text-3xl font-semibold tracking-tight text-gray-800">Devis</div>
          </div>

          {/* Agency left / Client right */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Agence Kameo
              </div>
              <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                <div>9 rue des colonnes, 75002</div>
                <div>Paris</div>
                <div>06 76 23 00 37</div>
                <div>contact@agencekameo.fr</div>
                <div className="pt-1.5">SIRET : 980 573 984 00013</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                À l&apos;attention de
              </div>
              <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                <div className="font-medium text-gray-900">{quote.clientName}</div>
                {quote.clientEmail && <div>{quote.clientEmail}</div>}
                {quote.clientAddress && (
                  <div className="whitespace-pre-line">{quote.clientAddress}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full mb-2 text-sm border-collapse">
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
              <th className="text-left py-2.5 px-4 text-white font-semibold w-[55%]">Contenu</th>
              <th className="text-center py-2.5 px-3 text-white font-semibold">Prix unitaire</th>
              <th className="text-right py-2.5 px-3 text-white font-semibold">Qté</th>
              <th className="text-right py-2.5 px-4 text-white font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td className="py-3 px-4 text-gray-800 border-b border-gray-100">
                  <div className="text-[13px] leading-relaxed">
                    {(() => {
                      const descLines = item.description.split('\n')
                      return descLines.map((line, j) => {
                        const trimmed = line.trim()
                        const isBullet = /^[•\-–]/.test(trimmed)
                        const isEmpty = trimmed === ''
                        const isFirstLine = j === 0
                        const prevEmpty = j > 0 && descLines[j - 1].trim() === ''
                        const isSectionTitle = !isEmpty && !isBullet && !isFirstLine && prevEmpty
                        if (isEmpty) return <div key={j} className="h-2.5" />
                        if (isFirstLine) return <div key={j} className="font-bold text-gray-900 text-sm mb-0.5">{line}</div>
                        if (isSectionTitle) return <div key={j} className="font-bold text-gray-900 text-[13px] mt-1">{line}</div>
                        return <div key={j} className="text-gray-500">{line}</div>
                      })
                    })()}
                  </div>
                </td>
                <td className="py-3 px-3 text-center text-gray-500 border-b border-gray-100 align-top">{formatCurrency(item.unitPrice)}</td>
                <td className="py-3 px-3 text-right text-gray-800 border-b border-gray-100 align-top">{item.quantity}</td>
                <td className="py-3 px-4 text-right text-gray-900 font-semibold border-b border-gray-100 align-top">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-10 mt-4">
          <div className="w-72 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-gray-600 py-1.5 border-b border-gray-100">
                <span>Total HT</span>
                <span className="font-medium">{formatCurrency(totalHT)}</span>
              </div>
              {quote.discount > 0 && (
                <div className="flex justify-between text-orange-600 py-1.5 border-b border-gray-100">
                  <span>Remise {quote.discountType === 'FIXED' ? '' : `(${quote.discount}%)`}</span>
                  <span>- {formatCurrency(remise)}</span>
                </div>
              )}
              {quote.discount > 0 && (
                <div className="flex justify-between text-gray-600 py-1.5 border-b border-gray-100">
                  <span>Sous-total HT</span>
                  <span className="font-medium">{formatCurrency(sousTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 py-1.5 border-b border-gray-100">
                <span>TVA 20%</span>
                <span className="font-medium">{formatCurrency(tva)}</span>
              </div>
              <div className="flex justify-between font-bold text-white text-base py-3 px-4 rounded-lg mt-1"
                style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
                <span>Total TTC</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
            </div>

            {/* Échéancier acomptes */}
            <div className="mt-4 text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-gray-600">Échéancier prévisionnel</span>
                {quote.deliveryDays && <span className="font-semibold" style={{ color: '#E14B89' }}>Délai : {quote.deliveryDays} jours</span>}
              </div>
              <div className="flex justify-between">
                <span>50% à la commande</span>
                <span className="font-medium text-gray-700">{formatCurrency(totalTTC * 0.50)}</span>
              </div>
              <div className="flex justify-between">
                <span>50% à la livraison</span>
                <span className="font-medium text-gray-700">{formatCurrency(totalTTC * 0.50)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="border-t border-gray-200 pt-5 mb-8">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">Notes</div>
            <p className="text-gray-600 text-sm whitespace-pre-line">{quote.notes}</p>
          </div>
        )}

        {/* Règlement + Bon pour accord */}
        <div className="border-t border-gray-200 pt-6 mt-2 grid grid-cols-2 gap-10">
          {/* Paiement */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-bold">Règlement</div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Mode : Virement Bancaire</div>
              <div>Banque : Crédit Agricole</div>
              <div className="font-mono text-xs mt-2 text-gray-700">IBAN : FR76 1310 6005 0030 0406 5882 074</div>
              <div className="font-mono text-xs text-gray-700">BIC : AGRIFRPP831</div>
            </div>
            <div className="mt-3 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded px-3 py-2">
              <strong>Conditions :</strong> 50% à la commande · 50% à la livraison
            </div>
          </div>

          {/* Bon pour accord */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-bold">Bon pour accord et signature</div>
            {signatureData?.signatureImage ? (
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Fait à :</div>
                    <div className="text-gray-800 font-medium">{signatureData.signedCity || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Le :</div>
                    <div className="text-gray-800 font-medium">{signatureData.signedDate || '—'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Signé par {signatureData.signerName} :</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatureData.signatureImage} alt="Signature" className="max-h-16 border border-gray-200 rounded bg-white p-1" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Fait à :</div>
                  <div className="border-b border-gray-300 min-h-[28px]"></div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Le :</div>
                  <div className="border-b border-gray-300 min-h-[28px]"></div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Signature :</div>
                  <div className="border-b border-gray-300 min-h-[52px]"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400 text-center leading-relaxed">
          Agence Kameo — 9 rue des colonnes, Paris 75002 — contact@agencekameo.fr<br />
          SIRET : 980 573 984 00013 — TVA : FR54980573984 — RCS Paris 980 573 984
          {quote.validUntil && (
            <span> — Offre valable jusqu&apos;au {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty quote form state ────────────────────────────────────────────────────

function defaultValidUntil() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

function emptyForm() {
  return {
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    clientLogo: '',
    subject: '',
    status: 'EN_ATTENTE' as Quote['status'],
    validUntil: defaultValidUntil(),
    notes: '',
    discount: 0,
    discountType: 'PERCENT' as Quote['discountType'],
    deliveryDays: '' as string | number,
    items: [] as QuoteItem[],
    showClientName: false,
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevisPage() {
  const { data: session } = useSession()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [templates, setTemplates] = useState<ArticleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'EN_ATTENTE' | 'SIGNE' | 'REFUSE'>('EN_ATTENTE')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false)
  const [showClientDetails, setShowClientDetails] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [dragItemId, setDragItemId] = useState<string | null>(null)

  function handleItemDrop(targetId: string) {
    if (!dragItemId || dragItemId === targetId) { setDragItemId(null); return }
    setForm(f => {
      const items = [...f.items]
      const fromIdx = items.findIndex(i => i.id === dragItemId)
      const toIdx = items.findIndex(i => i.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return f
      const [moved] = items.splice(fromIdx, 1)
      items.splice(toIdx, 0, moved)
      return { ...f, items: items.map((it, idx) => ({ ...it, position: idx })) }
    })
    setDragItemId(null)
  }

  // Print
  const [printQuote, setPrintQuote] = useState<Quote | null>(null)

  // Form
  const [form, setForm] = useState(emptyForm())
  const [useOtherClient, setUseOtherClient] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  // Close client dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setClientDropdownOpen(false)
      }
    }
    if (clientDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [clientDropdownOpen])

  // New template form
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', unitPrice: '', unit: '', deliveryDays: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Signature
  const SENDER_EMAILS = [
    { label: 'Benjamin Dayan', email: 'benjamin.dayan@agence-kameo.fr' },
    { label: 'Louison Boutet', email: 'louison.boutet@agence-kameo.fr' },
  ]
  const [signatureModal, setSignatureModal] = useState<Quote | null>(null)
  const [signatureForm, setSignatureForm] = useState({ firstName: '', lastName: '', email: '', phone: '', senderEmail: '', formule: 'vous_prenom' as string })
  const [signatureSending, setSignatureSending] = useState(false)
  const [signatureResult, setSignatureResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)
  const [signatureStep, setSignatureStep] = useState<1 | 2>(1)

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<ArticleTemplate | null>(null)
  const [editTemplateForm, setEditTemplateForm] = useState({ name: '', description: '', unitPrice: '', unit: '', deliveryDays: '' })
  const [savingEditTemplate, setSavingEditTemplate] = useState(false)


  // Standalone templates modal (from header)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)

  // AI prompt for quick template creation
  const [templatePrompt, setTemplatePrompt] = useState('')
  const [promptLoading, setPromptLoading] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadQuotes = useCallback(async () => {
    const res = await fetch('/api/quotes')
    const data = await res.json()
    setQuotes(Array.isArray(data) ? data : [])
  }, [])

  const loadTemplates = useCallback(async () => {
    const res = await fetch('/api/article-templates')
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
  }, [])

  function pollDevis() {
    Promise.all([
      loadQuotes(),
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : [])),
      loadTemplates(),
    ])
  }
  usePolling(pollDevis)

  useEffect(() => {
    Promise.all([
      loadQuotes(),
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : [])),
      loadTemplates(),
    ]).finally(() => setLoading(false))
  }, [loadQuotes, loadTemplates])

  // ── Open modal ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingQuote(null)
    setForm(emptyForm())
    setUseOtherClient(false)
    setShowTemplatesPanel(false)
    setShowModal(true)
  }

  function openEdit(q: Quote) {
    setEditingQuote(q)
    const hasKnownClient = !!q.clientId && clients.some(c => c.id === q.clientId)
    setUseOtherClient(!hasKnownClient)
    if (hasKnownClient) {
      const cl = clients.find(c => c.id === q.clientId)
      setClientSearch(cl ? (cl.company ? `${cl.company} — ${cl.name}` : cl.name) : q.clientName)
    } else {
      setClientSearch(q.clientName || '')
    }
    setForm({
      clientId: q.clientId || '',
      clientName: q.clientName || '',
      clientEmail: q.clientEmail || '',
      clientAddress: q.clientAddress || '',
      clientLogo: q.clientLogo || '',
      subject: q.subject || '',
      status: q.status,
      validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
      notes: q.notes || '',
      discount: q.discount ?? 0,
      discountType: q.discountType || 'PERCENT',
      deliveryDays: q.deliveryDays?.toString() || '',
      items: q.items.map(i => ({ ...i })),
      showClientName: false,
    })
    setShowTemplatesPanel(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingQuote(null)
    setForm(emptyForm())
    setShowTemplatesPanel(false)
    setClientSearch('')
    setClientDropdownOpen(false)
    setUseOtherClient(false)
  }

  // ── Client search + selection ─────────────────────────────────────────────

  function selectClient(client: Client) {
    setUseOtherClient(false)
    const addrParts = [client.address, client.postalCode && client.city ? `${client.postalCode} ${client.city}` : (client.postalCode || client.city)].filter(Boolean).join('\n')
    setForm(f => ({
      ...f,
      clientId: client.id,
      clientName: client.company || client.name || '',
      clientEmail: client.email || '',
      clientAddress: addrParts || '',
      clientLogo: client.logo || '',
    }))
    setClientSearch(client.company ? `${client.company} — ${client.name}` : client.name)
    setClientDropdownOpen(false)
  }

  function handleClientSearchManual() {
    setUseOtherClient(true)
    setForm(f => ({ ...f, clientId: '', clientName: '', clientEmail: '', clientAddress: '' }))
    setClientDropdownOpen(false)
  }

  const filteredClients = clientSearch.trim()
    ? clients.filter(c => {
        const q = clientSearch.toLowerCase()
        return c.name.toLowerCase().includes(q) || (c.company?.toLowerCase().includes(q) ?? false) || (c.email?.toLowerCase().includes(q) ?? false)
      })
    : clients

  // ── Items CRUD ─────────────────────────────────────────────────────────────

  function addItem() {
    setForm(f => ({
      ...f,
      items: [...f.items, { id: genTempId(), description: '', quantity: 1, unitPrice: 0, unit: 'forfait' }],
    }))
  }

  function updateItem(id: string, field: keyof QuoteItem, value: string | number) {
    setForm(f => ({
      ...f,
      items: f.items.map(i => i.id === id ? { ...i, [field]: value } : i),
    }))
  }

  function removeItem(id: string) {
    setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  }

  function addTemplateAsItem(t: ArticleTemplate) {
    setForm(f => {
      const currentTotal = Number(f.deliveryDays) || 0
      const newTotal = currentTotal + (t.deliveryDays || 0)
      return {
        ...f,
        deliveryDays: newTotal || '',
        items: [...f.items, {
          id: genTempId(),
          description: t.name + (t.description && t.description !== t.name ? '\n' + t.description : ''),
          quantity: 1,
          unitPrice: t.unitPrice,
          unit: t.unit || 'forfait',
        }],
      }
    })
  }

  // ── Save quote ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.clientName.trim()) { alert('Veuillez renseigner un nom de client / entreprise.'); return }
    if (!form.clientAddress.trim()) { alert('Veuillez renseigner l\'adresse du client.'); return }
    if (!form.validUntil) { alert('Veuillez renseigner une date de validité.'); return }
    // Subject auto-generated if empty
    if (!form.subject.trim()) form.subject = `Devis ${form.clientName.split('\n')[0]}`

    setSaving(true)
    try {
      // Build display name: company + optional contact name
      let displayName = form.clientName
      if (form.showClientName && form.clientId) {
        const cl = clients.find(c => c.id === form.clientId)
        if (cl && cl.company && cl.name !== form.clientName) {
          displayName = `${form.clientName}\n${cl.name}`
        }
      }
      const payload = {
        clientId: form.clientId || undefined,
        clientName: displayName,
        clientEmail: form.clientEmail || undefined,
        clientAddress: form.clientAddress || undefined,
        clientLogo: form.clientLogo || undefined,
        subject: form.subject,
        status: form.status,
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
        discount: Number(form.discount) || 0,
        discountType: form.discountType || 'PERCENT',
        deliveryDays: form.deliveryDays || null,
        items: form.items.map(({ id: _id, ...rest }) => ({
          ...rest,
          quantity: Number(rest.quantity),
          unitPrice: Number(rest.unitPrice),
        })),
      }

      let saved: Quote
      if (editingQuote) {
        const res = await fetch(`/api/quotes/${editingQuote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la sauvegarde'); return }
        saved = await res.json()
        setQuotes(prev => prev.map(q => q.id === saved.id ? saved : q))
      } else {
        const res = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erreur lors de la création'); return }
        saved = await res.json()
        setQuotes(prev => [saved, ...prev])
      }
      // Save logo to client for future quotes
      if (form.clientId && form.clientLogo) {
        fetch(`/api/clients/${form.clientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: form.clientLogo }),
        }).catch(() => {})
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete quote ───────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce devis définitivement ?')) return
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    setQuotes(prev => prev.filter(q => q.id !== id))
    if (editingQuote?.id === id) closeModal()
  }

  async function handleRefuse(id: string) {
    if (!confirm('Marquer ce devis comme refusé ?')) return
    const res = await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REFUSE' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: updated.status } : q))
    }
  }

  function handleDuplicate(q: Quote) {
    setEditingQuote(null)
    const f = emptyForm()
    setForm({
      ...f,
      clientId: q.clientId || '',
      clientName: q.clientName || '',
      clientEmail: q.clientEmail || '',
      clientAddress: q.clientAddress || '',
      clientLogo: q.clientLogo || '',
      subject: '',
      status: 'EN_ATTENTE',
      validUntil: defaultValidUntil(),
      notes: q.notes || '',
      discount: q.discount ?? 0,
      discountType: q.discountType || 'PERCENT',
      deliveryDays: q.deliveryDays?.toString() || '',
      items: q.items.map(i => ({ ...i, id: genTempId() })),
      showClientName: false,
    })
    if (q.clientId) {
      const cl = clients.find(c => c.id === q.clientId)
      if (cl) setClientSearch(cl.company ? `${cl.company} — ${cl.name}` : cl.name)
    } else {
      setClientSearch(q.clientName)
    }
    setShowModal(true)
  }

  // ── Signature ──────────────────────────────────────────────────────────────

  function getSignerInfo(q: Quote) {
    // Try to find client record for firstName/lastName
    const cl = q.clientId ? clients.find(c => c.id === q.clientId) : null
    if (cl?.firstName || cl?.lastName) {
      return { firstName: cl.firstName || '', lastName: cl.lastName || '', email: q.clientEmail || '', phone: '' }
    }
    // Fallback: split from clientName (last line if multiline = contact name)
    const nameParts = q.clientName.split('\n')
    const mainName = nameParts[nameParts.length - 1] || nameParts[0] || ''
    const parts = mainName.trim().split(' ')
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', email: q.clientEmail || '', phone: '' }
  }

  function getDefaultSender() {
    const userName = session?.user?.name?.toLowerCase() || ''
    if (userName.includes('benjamin')) return 'benjamin.dayan@agence-kameo.fr'
    if (userName.includes('louison')) return 'louison.boutet@agence-kameo.fr'
    return SENDER_EMAILS[0]?.email || ''
  }

  function openSignature(q: Quote) {
    const info = getSignerInfo(q)
    const defaultSender = getDefaultSender()
    setSignatureModal(q)
    setSignatureForm({ ...info, senderEmail: defaultSender, formule: 'vous_prenom' })
    setSignatureResult(null)
    setSignatureStep(1)
  }

  async function sendSignature(q: Quote, info: { firstName: string; lastName: string; email: string; phone: string; senderEmail: string; formule: string }) {
    setSignatureSending(true)
    setSignatureResult(null)
    try {
      const res = await fetch(`/api/quotes/${q.id}/send-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerFirstName: info.firstName,
          signerLastName: info.lastName,
          signerEmail: info.email,
          signerPhone: info.phone || undefined,
          senderEmail: info.senderEmail || undefined,
          tone: info.formule.startsWith('tu') ? 'tu' : 'vous',
          nameDisplay: info.formule.endsWith('nom') ? 'nom' : 'prenom',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSignatureResult({ success: true, message: data.message || 'Envoyé pour signature !' })
        setQuotes(prev => prev.map(existing => existing.id === q.id ? { ...existing, status: 'ENVOYE' as Quote['status'] } : existing))
      } else {
        setSignatureResult({ error: data.error || 'Erreur lors de l\'envoi' })
      }
    } catch {
      setSignatureResult({ error: 'Erreur réseau' })
    } finally {
      setSignatureSending(false)
    }
  }

  async function handleSignatureSend() {
    if (!signatureModal) return
    if (!signatureForm.firstName.trim() || !signatureForm.lastName.trim() || !signatureForm.email.trim()) {
      alert('Veuillez renseigner le prénom, nom et email du signataire.')
      return
    }
    sendSignature(signatureModal, signatureForm)
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.unitPrice) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/article-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplate.name,
          description: newTemplate.description,
          unitPrice: parseFloat(newTemplate.unitPrice) || 0,
          unit: newTemplate.unit || undefined,
          deliveryDays: newTemplate.deliveryDays || null,
        }),
      })
      const created = await res.json()
      setTemplates(prev => [...prev, created])
      setNewTemplate({ name: '', description: '', unitPrice: '', unit: '', deliveryDays: '' })
    } finally {
      setSavingTemplate(false)
    }
  }

  function openEditTemplate(t: ArticleTemplate) {
    setEditingTemplate(t)
    setEditTemplateForm({
      name: t.name,
      description: t.description,
      unitPrice: t.unitPrice.toString(),
      unit: t.unit || '',
      deliveryDays: t.deliveryDays?.toString() || '',
    })
  }

  async function handleUpdateTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTemplate || !editTemplateForm.name.trim() || !editTemplateForm.description.trim() || !editTemplateForm.unitPrice) return
    setSavingEditTemplate(true)
    try {
      const res = await fetch(`/api/article-templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTemplateForm.name,
          description: editTemplateForm.description,
          unitPrice: parseFloat(editTemplateForm.unitPrice) || 0,
          unit: editTemplateForm.unit || null,
          deliveryDays: editTemplateForm.deliveryDays || null,
        }),
      })
      const updated = await res.json()
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
      setEditingTemplate(null)
    } finally {
      setSavingEditTemplate(false)
    }
  }

  async function handleDeleteTemplate(e: React.MouseEvent, t: ArticleTemplate) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Supprimer le modèle "${t.name}" ?`)) return
    try {
      await fetch(`/api/article-templates/${t.id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch {
      // ignore
    }
  }

  function handleTemplateDrop(targetId: string) {
    if (!dragTemplateId || dragTemplateId === targetId) { setDragTemplateId(null); return }
    setTemplates(prev => {
      const items = [...prev]
      const fromIdx = items.findIndex(t => t.id === dragTemplateId)
      const toIdx = items.findIndex(t => t.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = items.splice(fromIdx, 1)
      items.splice(toIdx, 0, moved)
      // Save new order
      fetch('/api/article-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: items.map(t => t.id) }),
      }).catch(() => {})
      return items
    })
    setDragTemplateId(null)
  }

  // ── AI prompt to create template ──────────────────────────────────────────

  async function handlePromptCreate(e: React.FormEvent) {
    e.preventDefault()
    const prompt = templatePrompt.trim()
    if (!prompt) return
    setPromptLoading(true)
    try {
      const res = await fetch('/api/article-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const created = await res.json()
      if (created.id) {
        setTemplates(prev => [...prev, created])
        setTemplatePrompt('')
      }
    } finally {
      setPromptLoading(false)
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(form.items, form.discount, form.discountType)

  // ── Build preview quote object ─────────────────────────────────────────────

  function buildPreviewQuote(): Quote {
    let previewName = form.clientName
    if (form.showClientName && form.clientId) {
      const cl = clients.find(c => c.id === form.clientId)
      if (cl && cl.company && cl.name !== form.clientName) {
        previewName = `${form.clientName}\n${cl.name}`
      }
    }
    const cl = form.clientId ? clients.find(c => c.id === form.clientId) : undefined
    return {
      id: editingQuote?.id || '',
      number: editingQuote?.number || 'APERÇU',
      clientId: form.clientId || undefined,
      clientName: previewName,
      clientEmail: form.clientEmail || undefined,
      clientAddress: form.clientAddress || undefined,
      clientLogo: form.clientLogo || undefined,
      clientWebsite: cl?.website || undefined,
      subject: form.subject,
      status: form.status,
      validUntil: form.validUntil || undefined,
      notes: form.notes || undefined,
      discount: Number(form.discount) || 0,
      discountType: form.discountType || 'PERCENT',
      deliveryDays: Number(form.deliveryDays) || null,
      items: form.items,
      createdBy: editingQuote?.createdBy || { name: '' },
      createdAt: editingQuote?.createdAt || new Date().toISOString(),
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-[#0d0d14]">

      {/* Print overlay */}
      {printQuote && (
        <PrintView quote={printQuote} onClose={() => setPrintQuote(null)} onSendSignature={openSignature} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Devis</h1>
          <p className="text-slate-400 text-sm mt-1">
            {quotes.length} devis · {quotes.filter(q => q.status === 'ACCEPTE').length} signé{quotes.filter(q => q.status === 'ACCEPTE').length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="hidden sm:flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Package size={16} />
            Modèles d&apos;articles
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nouveau devis</span>
            <span className="sm:hidden">Nouveau</span>
          </button>
        </div>
      </div>

      {/* Status tabs */}
      {(() => {
        const QUOTE_TABS = [
          { key: 'EN_ATTENTE' as const, label: 'En attente', dot: 'bg-amber-400', statuses: ['EN_ATTENTE', 'BROUILLON', 'ENVOYE'] },
          { key: 'SIGNE' as const, label: 'Signés', dot: 'bg-green-400', statuses: ['ACCEPTE'] },
          { key: 'REFUSE' as const, label: 'Refusés', dot: 'bg-red-400', statuses: ['REFUSE', 'EXPIRE'] },
        ]
        return (
          <div className="flex gap-1 mb-6 bg-[#111118] border border-slate-800 rounded-xl p-1 w-fit overflow-x-auto">
            {QUOTE_TABS.map(t => {
              const count = quotes.filter(q => t.statuses.includes(q.status)).length
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                  <span className={`text-xs ${tab === t.key ? 'text-[#E14B89]/60' : 'text-slate-600'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Quotes table */}
      {loading ? (
        <div className="text-slate-500 text-sm">Chargement...</div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <FileText size={40} className="mb-4 opacity-30" />
          <p className="text-sm">Aucun devis pour l'instant</p>
          <button onClick={openCreate} className="mt-4 text-[#E14B89] text-sm hover:underline">
            Créer un premier devis
          </button>
        </div>
      ) : (
        <div>
          {(() => {
            const tabStatuses = tab === 'SIGNE' ? ['ACCEPTE'] : tab === 'REFUSE' ? ['REFUSE', 'EXPIRE'] : ['EN_ATTENTE', 'BROUILLON', 'ENVOYE']
            const filteredQuotes = quotes.filter(q => tabStatuses.includes(q.status))

            return (
              <>
                {/* Mobile: card layout */}
                <div className="sm:hidden space-y-3">
                  {filteredQuotes.map(q => {
                    const { totalHT: qTotal } = calcTotals(q.items, q.discount, q.discountType)
                    return (
                      <div key={q.id} onClick={() => openEdit(q)}
                        className="bg-[#111118] border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-slate-700 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-medium text-sm truncate">{q.clientName}</p>
                            <p className="text-slate-500 text-xs font-mono">{q.number}</p>
                          </div>
                          {q.status === 'ENVOYE' ? (
                            <button onClick={e => { e.stopPropagation(); handleRefuse(q.id) }}
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ml-2 cursor-pointer hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-colors ${STATUS_COLORS[q.status]}`}
                              title="Cliquer pour refuser">
                              {STATUS_LABELS[q.status]}
                            </button>
                          ) : (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ml-2 ${STATUS_COLORS[q.status]}`}>
                              {STATUS_LABELS[q.status]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">{formatCurrency(qTotal)}</span>
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            {q.deliveryDays && <span>{q.deliveryDays}j</span>}
                            <span>{new Date(q.createdAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-800/50">
                          {q.status === 'ENVOYE' && (
                            <button onClick={e => { e.stopPropagation(); handleRefuse(q.id) }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-colors">
                              <X size={12} /> Refuser
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); openSignature(q) }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400 hover:text-[#E14B89] rounded-lg hover:bg-[#E14B89]/5 transition-colors">
                            <Send size={12} /> Signature
                          </button>
                          <button onClick={e => { e.stopPropagation(); setPrintQuote(q) }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                            <Eye size={12} /> Aperçu
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDuplicate(q) }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400 hover:text-blue-400 rounded-lg hover:bg-blue-500/5 transition-colors">
                            <Copy size={12} /> Dupliquer
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden sm:block bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Numéro</th>
                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Client</th>
                        <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Statut</th>
                        <th className="text-right text-xs text-slate-500 font-medium px-4 py-3">Total HT</th>
                        <th className="text-right text-xs text-slate-500 font-medium px-4 py-3">Délai</th>
                        <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">Date</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q, i) => {
                        const { totalHT: qTotal } = calcTotals(q.items, q.discount, q.discountType)
                        return (
                          <tr key={q.id} onClick={() => openEdit(q)}
                            className={`border-b border-slate-800/60 cursor-pointer hover:bg-white/[0.03] transition-colors group ${i === filteredQuotes.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-5 py-3.5 font-mono text-slate-300 text-xs">{q.number}</td>
                            <td className="px-4 py-3.5 text-white font-medium">{q.clientName}</td>
                            <td className="px-4 py-3.5">
                              {q.status === 'ENVOYE' ? (
                                <button onClick={e => { e.stopPropagation(); handleRefuse(q.id) }}
                                  className={`text-xs px-2.5 py-1 rounded-full font-medium border cursor-pointer hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-colors ${STATUS_COLORS[q.status]}`}
                                  title="Cliquer pour refuser">
                                  {STATUS_LABELS[q.status]}
                                </button>
                              ) : (
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[q.status]}`}>
                                  {STATUS_LABELS[q.status]}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-300 font-medium">{formatCurrency(qTotal)}</td>
                            <td className="px-4 py-3.5 text-right text-slate-500 text-xs">{q.deliveryDays ? `${q.deliveryDays}j` : ''}</td>
                            <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{new Date(q.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td className="pr-3">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {q.status === 'ENVOYE' && (
                                  <button onClick={e => { e.stopPropagation(); handleRefuse(q.id) }}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5" title="Marquer comme refusé">
                                    <X size={14} />
                                  </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); openSignature(q) }}
                                  className="p-1.5 text-slate-500 hover:text-[#E14B89] transition-colors rounded-lg hover:bg-[#E14B89]/5" title="Envoyer pour signature">
                                  <Send size={14} />
                                </button>
                                <button onClick={e => { e.stopPropagation(); setPrintQuote(q) }}
                                  className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5" title="Aperçu">
                                  <Eye size={14} />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleDuplicate(q) }}
                                  className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-500/5" title="Dupliquer">
                                  <Copy size={14} />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5" title="Supprimer">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ─── Create/Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0a0a12] z-50 flex flex-col overflow-hidden">
          <div className="bg-[#0a0a12] w-full h-full flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={closeModal} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm mr-2">
                  <ChevronLeft size={16} /> Retour
                </button>
                <div className="w-px h-5 bg-slate-800" />
                <FileText size={18} className="text-[#E14B89]" />
                <h2 className="text-white font-semibold">
                  {editingQuote ? `Devis ${editingQuote.number}` : 'Nouveau devis'}
                </h2>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row overflow-hidden flex-1 relative">

              {/* ── Left: Main form ────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-4 flex flex-col gap-4">

                {/* Client selection — compact with inline details */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 relative" ref={clientDropdownRef}>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Client</label>
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => {
                        setClientSearch(e.target.value)
                        setClientDropdownOpen(true)
                        if (form.clientId) {
                          setForm(f => ({ ...f, clientId: '' }))
                          setUseOtherClient(false)
                        }
                      }}
                      onFocus={() => setClientDropdownOpen(true)}
                      placeholder="Rechercher un client..."
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors pr-9"
                    />
                    <ChevronDown size={14} className="absolute right-3 top-[38px] -translate-y-1/2 text-slate-500 pointer-events-none" />
                    {clientDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a24] border border-slate-700 rounded-xl max-h-52 overflow-y-auto shadow-xl">
                        {filteredClients.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectClient(c)}
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#E14B89]/10 transition-colors first:rounded-t-xl last:rounded-b-xl"
                          >
                            {c.company ? `${c.company} — ${c.name}` : c.name}
                            {c.email && <span className="text-slate-500 ml-2 text-xs">{c.email}</span>}
                          </button>
                        ))}
                        {filteredClients.length === 0 && clientSearch.trim() && (
                          <div className="px-3 py-2 text-sm text-slate-500">Aucun résultat</div>
                        )}
                        <button
                          type="button"
                          onClick={handleClientSearchManual}
                          className="w-full text-left px-3 py-2 text-sm text-[#E14B89] hover:bg-[#E14B89]/10 transition-colors border-t border-slate-700/50 rounded-b-xl"
                        >
                          + Saisie manuelle
                        </button>
                      </div>
                    )}
                  </div>
                  {(form.clientId || useOtherClient) && (
                    <button
                      type="button"
                      onClick={() => setShowClientDetails(v => !v)}
                      className={`mt-6 flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-xl border transition-colors flex-shrink-0 ${
                        showClientDetails ? 'border-[#E14B89]/40 text-[#E14B89] bg-[#E14B89]/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <Pencil size={12} />
                      Détails
                    </button>
                  )}
                </div>

                {/* Client detail fields — collapsible */}
                {(form.clientId || useOtherClient) && showClientDetails && (
                  <div className="space-y-3 p-4 bg-[#0d0d14] rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Entreprise / Nom sur le devis *</label>
                      <input
                        value={form.clientName}
                        onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                        placeholder="Ex : SARL Dupont"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.clientEmail}
                          onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-slate-400 text-xs mb-1.5">Adresse *</label>
                        <input
                          value={form.clientAddress}
                          onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))}
                          placeholder="Adresse complète"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                    </div>
                    {form.clientId && (() => {
                      const cl = clients.find(c => c.id === form.clientId)
                      return cl && cl.company ? (
                        <label className="flex items-center gap-2 text-slate-400 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.showClientName}
                            onChange={e => setForm(f => ({ ...f, showClientName: e.target.checked }))}
                            className="accent-[#E14B89]"
                          />
                          Afficher aussi le nom du contact ({cl.name}) sur le devis
                        </label>
                      ) : null
                    })()}
                  </div>
                )}

                {/* ── Line items ───────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-slate-300 text-sm font-medium">Lignes de devis</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSettingsPanel(v => !v)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          showSettingsPanel ? 'border-[#E14B89]/40 text-[#E14B89] bg-[#E14B89]/10' : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <Settings size={12} />
                        Paramètres
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTemplatesPanel(v => !v)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                          ${showTemplatesPanel
                            ? 'border-[#E14B89]/40 text-[#E14B89] bg-[#E14B89]/10'
                            : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
                      >
                        <FileText size={12} />
                        Modèles
                      </button>
                      <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                      >
                        <Plus size={12} />
                        Ligne
                      </button>
                    </div>
                  </div>

                  {/* Items table */}
                  {form.items.length > 0 ? (
                    <div className="rounded-xl border border-slate-800 overflow-y-auto flex-1">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 z-10">
                          <tr className="border-b border-slate-800 bg-[#0d0d14]">
                            <th className="w-6" />
                            <th className="text-left text-slate-500 font-medium px-3 py-1.5 w-[55%]">Contenu</th>
                            <th className="text-left text-slate-500 font-medium px-2 py-1.5 w-[10%]">Unité</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-1.5 w-[7%]">Qté</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-1.5 w-[12%]">Prix HT</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-1.5 w-[12%]">Total HT</th>
                            <th className="w-14" />
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((item, i) => {
                            const isExpanded = expandedItemId === item.id
                            const lineClamp = form.items.length <= 2 ? 'line-clamp-[8]' : form.items.length <= 4 ? 'line-clamp-5' : form.items.length <= 6 ? 'line-clamp-3' : 'line-clamp-2'
                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-slate-700/50 ${dragItemId === item.id ? 'opacity-40' : ''}`}
                                draggable={!isExpanded}
                                onDragStart={() => setDragItemId(item.id)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => handleItemDrop(item.id)}
                                onDragEnd={() => setDragItemId(null)}
                              >
                                {isExpanded ? (
                                  /* ── Expanded: full-width edit ── */
                                  <td colSpan={7} className="p-4 bg-[#0d0d14]/50">
                                    {(() => {
                                      const lines = (item.description || '').split('\n')
                                      const itemTitle = lines[0] || ''
                                      const itemBody = lines.slice(1).join('\n')
                                      const updateTitle = (val: string) => updateItem(item.id, 'description', val + '\n' + itemBody)
                                      const updateBody = (val: string) => updateItem(item.id, 'description', itemTitle + '\n' + val)
                                      return (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 text-[10px] font-medium">Modifier l&apos;article</span>
                                        <button onClick={() => setExpandedItemId(null)} className="text-slate-500 hover:text-white transition-colors">
                                          <X size={12} />
                                        </button>
                                      </div>
                                      <div>
                                        <label className="block text-slate-500 text-[10px] mb-0.5">Titre</label>
                                        <input
                                          value={itemTitle}
                                          onChange={e => updateTitle(e.target.value)}
                                          placeholder="Nom de l'article"
                                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-semibold focus:outline-none focus:border-[#E14B89] transition-colors"
                                          autoFocus
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-slate-500 text-[10px] mb-0.5">Description</label>
                                        <textarea
                                          value={itemBody}
                                          onChange={e => updateBody(e.target.value)}
                                          placeholder="Détail de la prestation..."
                                          rows={10}
                                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors resize-y leading-[1.7]"
                                        />
                                      </div>
                                      <div className="grid grid-cols-4 gap-2">
                                        <div>
                                          <label className="block text-slate-500 text-[10px] mb-0.5">Unité</label>
                                          <select
                                            value={item.unit || ''}
                                            onChange={e => updateItem(item.id, 'unit', e.target.value)}
                                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors appearance-none"
                                          >
                                            <option value="">—</option>
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-slate-500 text-[10px] mb-0.5">Quantité</label>
                                          <input type="number" min={0} value={item.quantity}
                                            onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:outline-none focus:border-[#E14B89] transition-colors" />
                                        </div>
                                        <div>
                                          <label className="block text-slate-500 text-[10px] mb-0.5">Prix unitaire HT</label>
                                          <input type="number" min={0} step="0.01" value={item.unitPrice}
                                            onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs text-right focus:outline-none focus:border-[#E14B89] transition-colors" />
                                        </div>
                                        <div>
                                          <label className="block text-slate-500 text-[10px] mb-0.5">Total HT</label>
                                          <div className="bg-[#0d0d14] border border-slate-800 rounded-lg px-2 py-1.5 text-[#E14B89] text-xs text-right font-semibold">
                                            {formatCurrency(item.quantity * item.unitPrice)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                      )
                                    })()}
                                  </td>
                                ) : (
                                  /* ── Compact row ── */
                                  <>
                                    <td className="pl-1 py-3 align-top w-6">
                                      <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors pt-0.5">
                                        <GripVertical size={12} />
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                      {(() => {
                                        const lines = (item.description || '').split('\n')
                                        const title = lines[0] || ''
                                        const rest = lines.slice(1).join('\n').trim()
                                        return (
                                          <div
                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => setExpandedItemId(item.id)}
                                            title="Cliquer pour modifier"
                                          >
                                            {title ? (
                                              <p className="text-white text-xs font-semibold leading-snug mb-0.5">{title}</p>
                                            ) : (
                                              <span className="text-slate-600 text-[11px]">Contenu...</span>
                                            )}
                                            {rest && (
                                              <p className={`text-slate-400 text-[11px] leading-[1.6] whitespace-pre-wrap ${lineClamp}`}>{rest}</p>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </td>
                                    <td className="px-2 py-3 align-top">
                                      <select
                                        value={item.unit || ''}
                                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                                        className="w-full bg-transparent text-slate-300 text-[11px] focus:outline-none appearance-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors pr-4"
                                      >
                                        <option value="">—</option>
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                      </select>
                                    </td>
                                    <td className="px-2 py-3 align-top">
                                      <input type="number" min={0} value={item.quantity}
                                        onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-transparent text-white text-[11px] text-right focus:outline-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors" />
                                    </td>
                                    <td className="px-2 py-3 align-top">
                                      <input type="number" min={0} step="0.01" value={item.unitPrice}
                                        onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-transparent text-white text-[11px] text-right focus:outline-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors" />
                                    </td>
                                    <td className="px-2 py-3 text-right text-slate-300 text-[11px] font-semibold align-top">
                                      {formatCurrency(item.quantity * item.unitPrice)}
                                    </td>
                                    <td className="pr-2 py-3 align-top">
                                      <div className="flex items-center gap-0.5">
                                        <button onClick={() => setExpandedItemId(item.id)}
                                          className="p-1 text-slate-600 hover:text-white transition-colors rounded" title="Ouvrir">
                                          <Pencil size={10} />
                                        </button>
                                        <button onClick={() => removeItem(item.id)}
                                          className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded">
                                          <Trash2 size={10} />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      onClick={addItem}
                      className="border border-dashed border-slate-700 rounded-xl py-8 text-center text-slate-600 text-xs cursor-pointer hover:border-slate-600 hover:text-slate-500 transition-colors"
                    >
                      Cliquez pour ajouter une première ligne
                    </div>
                  )}
                </div>

                {/* ── Settings panel (validité, remise, notes) ──────────── */}
                {showSettingsPanel && (
                  <div className="space-y-3 p-4 bg-[#0d0d14] rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 text-sm font-medium">Paramètres du devis</span>
                      <button type="button" onClick={() => setShowSettingsPanel(false)} className="text-slate-500 hover:text-white transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Valide jusqu&apos;au *</label>
                        <input
                          type="date"
                          value={form.validUntil}
                          onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Délai (jours)</label>
                        <input
                          type="number"
                          min={1}
                          value={form.deliveryDays}
                          onChange={e => setForm(f => ({ ...f, deliveryDays: e.target.value }))}
                          placeholder="Ex : 45"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Remise</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={0}
                            max={form.discountType === 'PERCENT' ? 100 : undefined}
                            value={form.discount}
                            onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                            className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, discountType: f.discountType === 'PERCENT' ? 'FIXED' : 'PERCENT', discount: 0 }))}
                            className="shrink-0 w-12 bg-[#1a1a24] border border-slate-700 rounded-xl text-white text-sm font-medium hover:border-[#E14B89] transition-colors"
                          >
                            {form.discountType === 'PERCENT' ? '%' : '\u20AC'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Logo client (URL)</label>
                        <div className="flex gap-2">
                          <input
                            value={form.clientLogo}
                            onChange={e => setForm(f => ({ ...f, clientLogo: e.target.value }))}
                            placeholder="https://..."
                            className="flex-1 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                          />
                          {form.clientLogo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.clientLogo} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-white p-1 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Notes internes</label>
                        <textarea
                          value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                          rows={1}
                          placeholder="Conditions, remarques..."
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ── Templates panel — full overlay ────────────────────────── */}
              {showTemplatesPanel && (
                <div className="absolute inset-0 bg-[#0a0a12] z-30 flex flex-col">
                  <div className="px-6 lg:px-10 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setShowTemplatesPanel(false)} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                        <ChevronLeft size={16} /> Retour
                      </button>
                      <div className="w-px h-5 bg-slate-800" />
                      <span className="text-white font-semibold text-sm">Modèles d&apos;articles</span>
                      <span className="text-slate-500 text-xs">{templates.length} modèle{templates.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {[...templates].sort((a, b) => editingTemplate?.id === a.id ? -1 : editingTemplate?.id === b.id ? 1 : 0).map(t => (
                        editingTemplate?.id === t.id ? (
                          <form
                            key={t.id}
                            onSubmit={handleUpdateTemplate}
                            className="p-4 rounded-xl bg-[#111118] border border-[#E14B89]/30 space-y-3 col-span-1 lg:col-span-2"
                          >
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-0.5">Titre</label>
                              <input
                                value={editTemplateForm.name}
                                onChange={e => setEditTemplateForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Titre *"
                                required
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-semibold focus:outline-none focus:border-[#E14B89] transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-0.5">Description</label>
                              <textarea
                                value={editTemplateForm.description}
                                onChange={e => setEditTemplateForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Description *"
                                required
                                rows={8}
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors resize-y leading-[1.7]"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-slate-500 text-[10px] mb-0.5">Prix HT *</label>
                                <input type="number" min={0} step="0.01"
                                  value={editTemplateForm.unitPrice}
                                  onChange={e => setEditTemplateForm(f => ({ ...f, unitPrice: e.target.value }))}
                                  placeholder="0" required
                                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                              </div>
                              <div>
                                <label className="block text-slate-500 text-[10px] mb-0.5">Unité</label>
                                <select
                                  value={editTemplateForm.unit}
                                  onChange={e => setEditTemplateForm(f => ({ ...f, unit: e.target.value }))}
                                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none">
                                  <option value="">—</option>
                                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-slate-500 text-[10px] mb-0.5">Délai (jours)</label>
                                <input type="number" min={1}
                                  value={editTemplateForm.deliveryDays}
                                  onChange={e => setEditTemplateForm(f => ({ ...f, deliveryDays: e.target.value }))}
                                  placeholder="Ex : 30"
                                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={savingEditTemplate}
                                className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity">
                                {savingEditTemplate ? 'Enregistrement...' : 'Enregistrer'}
                              </button>
                              <button type="button" onClick={() => setEditingTemplate(null)}
                                className="px-4 py-2.5 text-slate-400 hover:text-white text-sm rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                                Annuler
                              </button>
                            </div>
                          </form>
                        ) : (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setDragTemplateId(t.id)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleTemplateDrop(t.id)}
                          className={`group bg-[#111118] border rounded-xl p-4 transition-colors flex flex-col cursor-grab active:cursor-grabbing ${dragTemplateId === t.id ? 'border-[#E14B89]/50 opacity-50' : 'border-slate-800 hover:border-slate-700'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold leading-snug">{t.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[#E14B89] text-sm font-semibold">{formatCurrency(t.unitPrice)}</span>
                                {t.unit && <span className="text-slate-500 text-xs">/ {t.unit}</span>}
                                {t.deliveryDays && <span className="text-slate-600 text-xs">· {t.deliveryDays}j</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button type="button" onClick={() => openEditTemplate(t)}
                                className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-800" title="Modifier">
                                <Pencil size={12} />
                              </button>
                              <button type="button" onClick={(e) => handleDeleteTemplate(e, t)}
                                className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5" title="Supprimer">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          {t.description && t.description !== t.name && (
                            <p className="text-slate-400 text-[11px] leading-[1.6] whitespace-pre-wrap line-clamp-4 mb-3">
                              {t.description.replace(/\*\*(.+?)\*\*/g, '$1')}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => addTemplateAsItem(t)}
                            className="mt-auto w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#E14B89] hover:text-white bg-[#E14B89]/5 hover:bg-[#E14B89]/15 border border-[#E14B89]/20 rounded-lg transition-colors"
                          >
                            <Plus size={12} />
                            Ajouter au devis
                          </button>
                        </div>
                        )
                      ))}
                    </div>
                    {templates.length === 0 && (
                      <p className="text-slate-600 text-sm text-center py-12">Aucun modèle enregistré</p>
                    )}
                  </div>

                  {/* New template form — footer */}
                  <div className="border-t border-slate-800 px-6 lg:px-10 py-3 flex-shrink-0">
                    <form onSubmit={handleSaveTemplate} className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-slate-500 text-[10px] mb-0.5">Titre *</label>
                        <input
                          value={newTemplate.name}
                          onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                          placeholder="Nom du modèle"
                          required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-slate-500 text-[10px] mb-0.5">Description *</label>
                        <input
                          value={newTemplate.description}
                          onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                          placeholder="Description du modèle"
                          required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-slate-500 text-[10px] mb-0.5">Prix HT *</label>
                        <input
                          type="number" min={0} step="0.01"
                          value={newTemplate.unitPrice}
                          onChange={e => setNewTemplate(t => ({ ...t, unitPrice: e.target.value }))}
                          placeholder="0" required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-slate-500 text-[10px] mb-0.5">Unité</label>
                        <select
                          value={newTemplate.unit}
                          onChange={e => setNewTemplate(t => ({ ...t, unit: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors appearance-none"
                        >
                          <option value="">—</option>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="block text-slate-500 text-[10px] mb-0.5">Délai (j)</label>
                        <input type="number" min={1}
                          value={newTemplate.deliveryDays}
                          onChange={e => setNewTemplate(t => ({ ...t, deliveryDays: e.target.value }))}
                          placeholder="30"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                      </div>
                      <button
                        type="submit"
                        disabled={savingTemplate || !newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.unitPrice}
                        className="bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-opacity flex items-center gap-1.5 flex-shrink-0"
                      >
                        <Plus size={12} />
                        {savingTemplate ? '...' : 'Créer'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer with totals ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 lg:px-10 py-3 border-t border-slate-800 flex-shrink-0 gap-3">
              <div className="flex items-center gap-4">
                {editingQuote && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingQuote.id)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 text-xs transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/5"
                  >
                    <Trash2 size={12} />
                    Supprimer
                  </button>
                )}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span>HT</span>
                    <span className="text-slate-300 font-medium">{formatCurrency(totalHT)}</span>
                  </div>
                  {form.discount > 0 && (
                    <div className="flex items-center gap-1.5 text-orange-400">
                      <span>-{form.discount}{form.discountType === 'PERCENT' ? '%' : '\u20AC'}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span>TVA</span>
                    <span className="text-slate-300 font-medium">{formatCurrency(tva)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-semibold">TTC</span>
                    <span className="text-[#E14B89] font-bold text-sm">{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingQuote && (
                  <button
                    type="button"
                    onClick={() => { closeModal(); openSignature(editingQuote) }}
                    className="flex items-center gap-1.5 border border-[#E14B89]/40 text-[#E14B89] hover:bg-[#E14B89]/10 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Send size={14} />
                    Envoyer pour signature
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPrintQuote(buildPreviewQuote())}
                  className="flex items-center gap-1.5 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Eye size={14} />
                  Aperçu
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      {editingQuote ? 'Mettre à jour' : 'Créer le devis'}
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* ─── Standalone Templates Modal ──────────────────────────────────── */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-[#0a0a12] z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowTemplatesModal(false)} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                <ChevronLeft size={16} /> Retour
              </button>
              <div className="w-px h-5 bg-slate-800" />
              <Package size={18} className="text-[#E14B89]" />
              <h2 className="text-white font-semibold">Modèles d&apos;articles</h2>
              <span className="text-slate-500 text-xs">{templates.length} modèle{templates.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[...templates].sort((a, b) => editingTemplate?.id === a.id ? -1 : editingTemplate?.id === b.id ? 1 : 0).map(t => (
                editingTemplate?.id === t.id ? (
                  <form
                    key={t.id}
                    onSubmit={handleUpdateTemplate}
                    className="p-4 rounded-xl bg-[#111118] border border-[#E14B89]/30 space-y-3 col-span-1 lg:col-span-2"
                  >
                    <div>
                      <label className="block text-slate-500 text-[10px] mb-0.5">Titre</label>
                      <input
                        value={editTemplateForm.name}
                        onChange={e => setEditTemplateForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Titre *" required
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-semibold focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[10px] mb-0.5">Description</label>
                      <textarea
                        value={editTemplateForm.description}
                        onChange={e => setEditTemplateForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Description *" required rows={8}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors resize-y leading-[1.7]"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-0.5">Prix HT *</label>
                        <input type="number" min={0} step="0.01" value={editTemplateForm.unitPrice}
                          onChange={e => setEditTemplateForm(f => ({ ...f, unitPrice: e.target.value }))}
                          placeholder="0" required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-0.5">Unité</label>
                        <select value={editTemplateForm.unit} onChange={e => setEditTemplateForm(f => ({ ...f, unit: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none">
                          <option value="">—</option>
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-500 text-[10px] mb-0.5">Délai (jours)</label>
                        <input type="number" min={1}
                          value={editTemplateForm.deliveryDays}
                          onChange={e => setEditTemplateForm(f => ({ ...f, deliveryDays: e.target.value }))}
                          placeholder="Ex : 30"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingEditTemplate}
                        className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity">
                        {savingEditTemplate ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                      <button type="button" onClick={() => setEditingTemplate(null)}
                        className="px-4 py-2.5 text-slate-400 hover:text-white text-sm rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragTemplateId(t.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleTemplateDrop(t.id)}
                  className={`group bg-[#111118] border rounded-xl p-4 transition-colors flex flex-col cursor-grab active:cursor-grabbing ${dragTemplateId === t.id ? 'border-[#E14B89]/50 opacity-50' : 'border-slate-800 hover:border-slate-700'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-snug">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[#E14B89] text-sm font-semibold">{formatCurrency(t.unitPrice)}</span>
                        {t.unit && <span className="text-slate-500 text-xs">/ {t.unit}</span>}
                        {t.deliveryDays && <span className="text-slate-600 text-xs">· {t.deliveryDays}j</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button type="button" onClick={() => openEditTemplate(t)}
                        className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-800" title="Modifier">
                        <Pencil size={12} />
                      </button>
                      <button type="button" onClick={(e) => handleDeleteTemplate(e, t)}
                        className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5" title="Supprimer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {t.description && t.description !== t.name && (
                    <p className="text-slate-400 text-[11px] leading-[1.6] whitespace-pre-wrap line-clamp-4 mb-2">
                      {t.description.replace(/\*\*(.+?)\*\*/g, '$1')}
                    </p>
                  )}
                </div>
                )
              ))}
            </div>
            {templates.length === 0 && (
              <div className="text-center py-12">
                <Package size={28} className="text-slate-700 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Aucun modèle</p>
                <p className="text-slate-600 text-xs mt-1">Créez votre premier modèle ci-dessous</p>
              </div>
            )}
          </div>

          {/* Footer: new template + AI */}
          <div className="border-t border-slate-800 px-6 lg:px-10 py-3 flex-shrink-0">
            <div className="flex gap-4">
              <form onSubmit={handleSaveTemplate} className="flex items-end gap-3 flex-1">
                <div className="flex-1">
                  <label className="block text-slate-500 text-[10px] mb-0.5">Titre *</label>
                  <input value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                    placeholder="Nom du modèle" required
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div className="flex-[2]">
                  <label className="block text-slate-500 text-[10px] mb-0.5">Description *</label>
                  <input value={newTemplate.description} onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                    placeholder="Description du modèle" required
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div className="w-24">
                  <label className="block text-slate-500 text-[10px] mb-0.5">Prix HT *</label>
                  <input type="number" min={0} step="0.01" value={newTemplate.unitPrice}
                    onChange={e => setNewTemplate(t => ({ ...t, unitPrice: e.target.value }))}
                    placeholder="0" required
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <div className="w-20">
                  <label className="block text-slate-500 text-[10px] mb-0.5">Unité</label>
                  <select value={newTemplate.unit} onChange={e => setNewTemplate(t => ({ ...t, unit: e.target.value }))}
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors appearance-none">
                    <option value="">—</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-slate-500 text-[10px] mb-0.5">Délai (j)</label>
                  <input type="number" min={1}
                    value={newTemplate.deliveryDays}
                    onChange={e => setNewTemplate(t => ({ ...t, deliveryDays: e.target.value }))}
                    placeholder="30"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors" />
                </div>
                <button type="submit"
                  disabled={savingTemplate || !newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.unitPrice}
                  className="bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-opacity flex items-center gap-1.5 flex-shrink-0">
                  <Plus size={12} />
                  {savingTemplate ? '...' : 'Créer'}
                </button>
              </form>
              <div className="w-px bg-slate-800" />
              <form onSubmit={handlePromptCreate} className="flex items-end gap-2 w-80">
                <div className="flex-1">
                  <label className="block text-slate-500 text-[10px] mb-0.5 flex items-center gap-1"><Sparkles size={10} className="text-[#E14B89]/70" /> IA</label>
                  <input
                    value={templatePrompt}
                    onChange={e => setTemplatePrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePromptCreate(e) } }}
                    placeholder="Décrivez l'article..."
                    className="w-full bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89]/50 transition-colors" />
                </div>
                <button type="submit" disabled={promptLoading || !templatePrompt.trim()}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                  {promptLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Créer
                </button>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ─── Signature Modal ─────────────────────────────────────────────── */}
      {signatureModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#E14B89]/10 flex items-center justify-center flex-shrink-0">
                <Send size={18} className="text-[#E14B89]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Envoyer pour signature</h3>
                <p className="text-slate-500 text-xs mt-0.5">Devis {signatureModal.number}</p>
              </div>
              <button onClick={() => setSignatureModal(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {signatureResult?.success ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} className="text-green-400" />
                </div>
                <p className="text-green-400 font-medium">{signatureResult.message}</p>
                <p className="text-slate-500 text-xs mt-2">Le client recevra un email avec un lien pour signer.</p>
                <button
                  onClick={() => setSignatureModal(null)}
                  className="mt-4 border border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Fermer
                </button>
              </div>
            ) : signatureSending ? (
              <div className="text-center py-8">
                <Loader2 size={28} className="animate-spin text-[#E14B89] mx-auto mb-3" />
                <p className="text-white font-medium">Envoi en cours...</p>
                <p className="text-slate-500 text-xs mt-2">Envoi du devis à {signatureForm.email}</p>
              </div>
            ) : signatureStep === 1 ? (
              /* ── Step 1: Informations ── */
              <>
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Prénom du contact *</label>
                      <input
                        value={signatureForm.firstName}
                        onChange={e => setSignatureForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="Jean"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom du contact *</label>
                      <input
                        value={signatureForm.lastName}
                        onChange={e => setSignatureForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Dupont"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Email *</label>
                    <input
                      type="email"
                      value={signatureForm.email}
                      onChange={e => setSignatureForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="client@exemple.fr"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Expéditeur *</label>
                      <select
                        value={signatureForm.senderEmail}
                        onChange={e => setSignatureForm(f => ({ ...f, senderEmail: e.target.value }))}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      >
                        {SENDER_EMAILS.map(s => (
                          <option key={s.email} value={s.email}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Formule</label>
                      <select
                        value={signatureForm.formule}
                        onChange={e => setSignatureForm(f => ({ ...f, formule: e.target.value }))}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      >
                        <option value="vous_prenom">Vouvoiement + Prénom</option>
                        <option value="vous_nom">Vouvoiement + M./Mme Nom</option>
                        <option value="tu_prenom">Tutoiement + Prénom</option>
                        <option value="tu_nom">Tutoiement + M./Mme Nom</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!signatureForm.firstName.trim() || !signatureForm.lastName.trim() || !signatureForm.email.trim()) {
                      alert('Veuillez renseigner le prénom, nom et email du signataire.')
                      return
                    }
                    setSignatureStep(2)
                  }}
                  className="w-full bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity flex items-center justify-center gap-2"
                >
                  Suivant
                </button>
              </>
            ) : (
              /* ── Step 2: Aperçu + Confirmation ── */
              <>
                <p className="text-slate-400 text-sm mb-3">Aperçu de l&apos;email qui sera envoyé :</p>

                {/* Email preview */}
                {(() => {
                  const isTu = signatureForm.formule.startsWith('tu')
                  const useNom = signatureForm.formule.endsWith('nom')
                  const displayName = useNom ? `M. ${signatureForm.lastName}` : signatureForm.firstName
                  return (
                <div className="bg-white rounded-xl overflow-hidden mb-4 max-h-[320px] overflow-y-auto">
                  <div className="h-1" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
                  <div className="p-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/kameo-logo-light.svg" alt="Kameo" className="h-6 mx-auto mb-4" />
                    <h3 className="text-gray-900 font-semibold text-base mb-3">Proposition commerciale</h3>
                    <p className="text-gray-600 text-sm mb-2">
                      Bonjour {displayName},
                    </p>
                    <p className="text-gray-600 text-sm mb-3">
                      {isTu
                        ? <>Suite à notre échange, je te transmets notre proposition commerciale <strong className="text-gray-900">N° {signatureModal.number}</strong> concernant :</>
                        : <>Suite à notre échange, nous avons le plaisir de vous transmettre notre proposition commerciale <strong className="text-gray-900">N° {signatureModal.number}</strong> concernant :</>
                      }
                    </p>
                    <div className="bg-gray-50 px-4 py-3 rounded-lg mb-4 border-l-4" style={{ borderColor: '#F8903C' }}>
                      <p className="text-gray-900 font-semibold text-sm">{signatureModal.subject || signatureModal.clientName}</p>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">
                      {isTu
                        ? 'Tu peux consulter le détail de cette proposition et la valider directement en ligne.'
                        : 'Vous pouvez consulter le détail de cette proposition et la valider directement en ligne.'
                      }
                    </p>
                    <div className="text-center mb-3">
                      <span className="inline-block text-white text-sm font-semibold px-6 py-2.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
                        Consulter et signer la proposition
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs text-center">
                      Ce lien est valable jusqu&apos;au {signatureModal.validUntil ? new Date(signatureModal.validUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '30 jours'}.
                    </p>
                  </div>
                </div>
                  )
                })()}

                {/* Summary */}
                <div className="bg-[#0d0d14] rounded-xl p-3 mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destinataire</span>
                    <span className="text-white">{signatureForm.firstName} {signatureForm.lastName} &lt;{signatureForm.email}&gt;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expéditeur</span>
                    <span className="text-white">{SENDER_EMAILS.find(s => s.email === signatureForm.senderEmail)?.label || signatureForm.senderEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Objet</span>
                    <span className="text-slate-300">Devis N {signatureModal.number} - {signatureModal.subject || signatureModal.clientName}</span>
                  </div>
                </div>

                {signatureResult?.error && (
                  <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs">{signatureResult.error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setSignatureStep(1)}
                    className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Retour
                  </button>
                  <button
                    onClick={async () => {
                      if (!signatureModal) return
                      const tone = signatureForm.formule.startsWith('tu') ? 'tu' : 'vous'
                      const nameDisplay = signatureForm.formule.endsWith('nom') ? 'nom' : 'prenom'
                      try {
                        const res = await fetch(`/api/quotes/${signatureModal.id}/send-signature`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            signerFirstName: signatureForm.firstName,
                            signerLastName: signatureForm.lastName,
                            signerEmail: 'contact@agence-kameo.fr',
                            senderEmail: signatureForm.senderEmail,
                            tone, nameDisplay,
                            testMode: true,
                          }),
                        })
                        if (res.ok) alert('Email de test envoyé à contact@agence-kameo.fr')
                        else alert('Erreur lors de l\'envoi du test')
                      } catch { alert('Erreur réseau') }
                    }}
                    className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Eye size={12} />
                    Envoyer un test
                  </button>
                  <button
                    onClick={handleSignatureSend}
                    disabled={signatureSending}
                    className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    Confirmer l&apos;envoi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
