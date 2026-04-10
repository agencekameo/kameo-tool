'use client'

import { useEffect, useState, use } from 'react'
import { Check, AlertCircle, Clock, FileText, Loader2 } from 'lucide-react'
import SignatureCanvas from '@/components/signature-canvas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  description: string
  unit: string
  quantity: number
  unitPrice: number
  tva: number
}

interface QuoteData {
  quoteNumber: string
  clientName: string
  clientEmail?: string
  clientAddress?: string
  clientLogo?: string
  subject: string
  validUntil?: string
  deliveryDays?: number | null
  notes?: string
  discount: number
  items: QuoteItem[]
  signerName: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function calcTotals(items: QuoteItem[], discount: number) {
  const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const remise = totalHT * discount / 100
  const sousTotal = totalHT - remise
  const tva = sousTotal * 0.20
  const totalTTC = sousTotal + tva
  return { totalHT, remise, sousTotal, tva, totalTTC }
}

function renderDescription(description: string) {
  const lines = description.split('\n')
  return lines.map((line, j) => {
    const trimmed = line.trim()
    const isBullet = /^[•\-–]/.test(trimmed)
    const isEmpty = trimmed === ''
    const isFirstLine = j === 0
    const prevEmpty = j > 0 && lines[j - 1].trim() === ''
    const isSectionTitle = !isEmpty && !isBullet && !isFirstLine && prevEmpty
    if (isEmpty) return <div key={j} className="h-2" />
    if (isFirstLine) return <div key={j} className="font-bold text-gray-900 text-sm mb-0.5">{line}</div>
    if (isSectionTitle) return <div key={j} className="font-bold text-gray-900 text-[13px] mt-1">{line}</div>
    return <div key={j} className="text-gray-500 text-xs leading-relaxed">{line}</div>
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SignerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [error, setError] = useState<{ type: string; message: string; quoteNumber?: string } | null>(null)

  // Form
  const [city, setCity] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('fr-FR'))
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/signature/${token}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError({ type: data.error, message: data.message, quoteNumber: data.quoteNumber })
        } else {
          setQuote(data)
        }
      })
      .catch(() => setError({ type: 'network', message: 'Erreur de connexion.' }))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmit() {
    if (!city.trim() || !date.trim() || !signatureData) {
      alert('Veuillez remplir "Fait à", "Le" et signer le document.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/signature/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, city: city.trim(), date: date.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
      } else {
        alert(data.error || 'Erreur lors de la signature.')
      }
    } catch {
      alert('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <GradientBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#E14B89] mx-auto mb-4" />
            <p className="text-gray-500">Chargement du devis...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error states ───────────────────────────────────────────────────────────

  if (error) {
    const isExpired = error.type === 'expired'
    const isSigned = error.type === 'already_signed'

    return (
      <div className="min-h-screen flex flex-col">
        <GradientBar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className={`w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center ${
              isSigned ? 'bg-green-50' : isExpired ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              {isSigned ? (
                <Check className="w-8 h-8 text-green-500" />
              ) : isExpired ? (
                <Clock className="w-8 h-8 text-amber-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              {isSigned ? 'Devis déjà signé' : isExpired ? 'Lien expiré' : 'Lien introuvable'}
            </h1>
            <p className="text-gray-500 mb-2">{error.message}</p>
            {error.quoteNumber && (
              <p className="text-sm text-gray-400">Devis N° {error.quoteNumber}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (success && quote) {
    return (
      <div className="min-h-screen flex flex-col">
        <GradientBar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 mx-auto mb-6 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Signature enregistrée</h1>
            <p className="text-gray-500 mb-1">
              Le devis N° <strong className="text-gray-700">{quote.quoteNumber}</strong> a été accepté.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              Vous pouvez fermer cette page. L&apos;agence Kameo a été notifiée de votre signature.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!quote) return null

  // ── Main signing view ──────────────────────────────────────────────────────

  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(quote.items, quote.discount)
  const today = new Date(quote.createdAt).toLocaleDateString('fr-FR')

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <GradientBar />

      <div className="max-w-[800px] mx-auto w-full px-4 sm:px-8 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6 sm:mb-8 pb-5 sm:pb-6 border-b-[3px]" style={{ borderColor: '#F8903C' }}>
          <div className="text-center mb-4 sm:mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kameo-logo-light.svg" alt="Kameo" className="h-7 sm:h-8 mx-auto" />
          </div>
          <div className="text-center mb-4 sm:mb-6">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight text-gray-800 uppercase">Devis</div>
          </div>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Agence Kameo</div>
              <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
                <div>9 rue des colonnes, 75002</div>
                <div>Paris</div>
                <div>06 62 37 99 85</div>
                <div>contact@agencekameo.fr</div>
                <div className="pt-1.5">SIRET : 980 573 984 00013</div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-base sm:text-lg font-bold" style={{ color: '#E14B89' }}>N° {quote.quoteNumber}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 space-y-0.5">
                <div>Émis le : {today}</div>
                {quote.deliveryDays && <div>Délai de livraison : {quote.deliveryDays} jours</div>}
                {quote.validUntil && (
                  <div>Valide jusqu&apos;au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client block */}
        <div className="mb-5 sm:mb-6">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">À l&apos;attention de</div>
          <div className="border border-gray-200 rounded-lg px-4 sm:px-5 py-3 sm:py-4 inline-block min-w-0 sm:min-w-[220px] max-w-full">
            <div className="font-bold text-gray-900 text-sm sm:text-base whitespace-pre-line break-words">{quote.clientName}</div>
            {quote.clientEmail && <div className="text-xs sm:text-sm text-gray-600 mt-1 break-all">{quote.clientEmail}</div>}
            {quote.clientAddress && (
              <div className="text-xs sm:text-sm text-gray-600 mt-1 whitespace-pre-line">{quote.clientAddress}</div>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="mb-5 sm:mb-6 bg-gray-50 rounded-lg px-4 sm:px-5 py-3 border border-gray-100">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mr-2 sm:mr-3">Objet :</span>
          <span className="text-gray-900 font-semibold text-sm sm:text-base">{quote.subject}</span>
        </div>

        {/* Items — responsive: table on desktop, cards on mobile */}
        <div className="mb-2">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full mb-2 text-sm border-collapse">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
                  <th className="text-left py-2.5 px-4 text-white font-semibold w-[46%] rounded-tl-lg">Contenu</th>
                  <th className="text-center py-2.5 px-3 text-white font-semibold">Unité</th>
                  <th className="text-right py-2.5 px-3 text-white font-semibold">Qté</th>
                  <th className="text-right py-2.5 px-3 text-white font-semibold">Prix HT</th>
                  <th className="text-right py-2.5 px-4 text-white font-semibold rounded-tr-lg">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td className="py-3 px-4 text-gray-800 border-b border-gray-100">
                      <div className="text-[13px] leading-relaxed">{renderDescription(item.description)}</div>
                    </td>
                    <td className="py-3 px-3 text-center text-gray-500 border-b border-gray-100 align-top">{item.unit || '—'}</td>
                    <td className="py-3 px-3 text-right text-gray-800 border-b border-gray-100 align-top">{item.quantity}</td>
                    <td className="py-3 px-3 text-right text-gray-800 border-b border-gray-100 align-top">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-semibold border-b border-gray-100 align-top">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {quote.items.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="text-[13px] leading-relaxed">{renderDescription(item.description)}</div>
                </div>
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {item.unit && <span>{item.unit}</span>}
                    <span>Qté : {item.quantity}</span>
                    <span>{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.quantity * item.unitPrice)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6 sm:mb-8 mt-4">
          <div className="w-full sm:w-72 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between text-gray-600 py-1.5 border-b border-gray-100">
                <span>Total HT</span>
                <span className="font-medium">{formatCurrency(totalHT)}</span>
              </div>
              {quote.discount > 0 && (
                <div className="flex justify-between text-orange-600 py-1.5 border-b border-gray-100">
                  <span>Remise ({quote.discount}%)</span>
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

            {/* Echeancier */}
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
          <div className="border-t border-gray-200 pt-4 sm:pt-5 mb-5 sm:mb-6">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">Notes</div>
            <p className="text-gray-600 text-xs sm:text-sm whitespace-pre-line">{quote.notes}</p>
          </div>
        )}

        {/* Reglement + Signature */}
        <div className="border-t border-gray-200 pt-5 sm:pt-6 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {/* Paiement */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-bold">Règlement</div>
            <div className="text-xs sm:text-sm text-gray-600 space-y-1">
              <div>Mode : Virement Bancaire</div>
              <div>Banque : Crédit Agricole</div>
              <div className="font-mono text-[10px] sm:text-xs mt-2 text-gray-700 break-all">IBAN : FR76 1310 6005 0030 0406 5882 074</div>
              <div className="font-mono text-[10px] sm:text-xs text-gray-700">BIC : AGRIFRPP831</div>
            </div>
            <div className="mt-3 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded px-3 py-2">
              <strong>Conditions :</strong> 50% à la commande · 50% à la livraison
            </div>
          </div>

          {/* Bon pour accord — interactive */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-bold">Bon pour accord et signature</div>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Fait à :</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Paris"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#E14B89] focus:ring-1 focus:ring-[#E14B89]/30 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Le :</label>
                <input
                  type="text"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  placeholder="02/03/2026"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#E14B89] focus:ring-1 focus:ring-[#E14B89]/30 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="mt-6 sm:mt-8 mb-6">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3 font-bold">Signature</div>
          <SignatureCanvas onSignatureChange={setSignatureData} height={160} />
        </div>

        {/* Submit button */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <button
            onClick={handleSubmit}
            disabled={submitting || !city.trim() || !date.trim() || !signatureData}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Valider et signer le devis
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 pt-4 text-[10px] text-gray-400 text-center leading-relaxed">
          Agence Kameo — 9 rue des colonnes, Paris 75002 — contact@agencekameo.fr<br />
          SIRET : 980 573 984 00013 — TVA : FR54980573984 — RCS Paris 980 573 984
        </div>
      </div>
    </div>
  )
}

// ─── Gradient Bar ─────────────────────────────────────────────────────────────

function GradientBar() {
  return (
    <div className="h-1.5 w-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }} />
  )
}
