'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface MandatData {
  clientName: string
  subject: string
  referenceMandat: string | null
  referenceContrat: string | null
  descriptionContrat: string | null
  signatureStatus: string
}

export default function MandatSignPage() {
  const { token } = useParams<{ token: string }>()
  const [mandat, setMandat] = useState<MandatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [signing, setSigning] = useState(false)

  const [form, setForm] = useState({
    bic: '', iban: '', signCity: '',
  })

  // Format IBAN with spaces every 4 chars (display only)
  function formatIban(raw: string) { return raw.replace(/(.{4})/g, '$1 ').trim() }
  function cleanIban(val: string) { return val.toUpperCase().replace(/[^A-Z0-9]/g, '') }
  function cleanBic(val: string) { return val.toUpperCase().replace(/[^A-Z0-9]/g, '') }

  // Validation
  const bicLen = form.bic.length
  const ibanLen = form.iban.length
  const bicValid = bicLen === 8 || bicLen === 11
  const ibanValid = ibanLen >= 15 && ibanLen <= 34

  useEffect(() => {
    fetch(`/api/signature/mandat/${token}`)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setMandat(data) })
      .catch(() => setError('Impossible de charger le mandat'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSign() {
    if (!form.iban || !form.signCity || !form.bic || !bicValid || !ibanValid) return
    setSigning(true)
    try {
      // Generate signature image from client name
      const canvas = document.createElement('canvas')
      canvas.width = 600; canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 100)
      ctx.fillStyle = '#111827'; ctx.font = 'italic 32px Georgia, serif'
      ctx.fillText(mandat!.clientName, 20, 60)
      const signatureData = canvas.toDataURL('image/png')

      const res = await fetch(`/api/signature/mandat/${token}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData, city: form.signCity,
          bic: form.bic, iban: form.iban,
        }),
      })
      if (!res.ok) { const err = await res.json(); setError(err.error || 'Erreur'); return }
      setSigned(true)
    } catch { setError('Erreur réseau') }
    finally { setSigning(false) }
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#E14B89] focus:ring-2 focus:ring-[#E14B89]/10 transition-all bg-white"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1.5"

  const isValid = bicValid && ibanValid && form.signCity
  const errors: string[] = []
  if (form.bic && !bicValid) errors.push('BIC : 8 ou 11 caractères')
  if (form.iban && !ibanValid) errors.push('IBAN : entre 15 et 34 caractères')
  if (!form.bic) errors.push('BIC requis')
  if (!form.iban) errors.push('IBAN requis')
  if (!form.signCity) errors.push('Ville de signature requise')

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4"><div className="text-center"><AlertCircle className="mx-auto text-red-400 mb-3" size={40} /><p className="text-gray-600">{error}</p></div></div>
  if (signed || mandat?.signatureStatus === 'SIGNE') return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4"><div className="text-center"><CheckCircle className="mx-auto text-green-500 mb-3" size={48} /><h2 className="text-xl font-semibold text-gray-800 mb-2">Mandat signé</h2><p className="text-gray-500">Merci ! Votre mandat de prélèvement a été enregistré.</p></div></div>
  if (!mandat) return null

  return (
    <div className="min-h-screen bg-gray-100" style={{ colorScheme: 'light' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Kameo" className="h-6" />
          <span className="text-xs text-gray-400">Mandat SEPA</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Title */}
        <div className="text-center mb-6">
          <div className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-1">Mandat de prélèvement SEPA</div>
          <p className="text-sm text-gray-500">Veuillez renseigner vos coordonnées bancaires pour autoriser le prélèvement</p>
        </div>

        {/* ═══ Section 1: Entreprise (read-only) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-3">
          <div className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3">Créancier</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-400">Nom :</span> <strong className="text-gray-800">KAMEO</strong></div>
            <div><span className="text-gray-400">ICS :</span> <span className="text-gray-800 font-mono text-xs">FR93ZZZ897DF1</span></div>
            <div className="col-span-2"><span className="text-gray-400">Adresse :</span> <span className="text-gray-800">1862 RUE LA LAURAGAISE, 31670 LABÈGE</span></div>
          </div>
          {(mandat.referenceMandat || mandat.referenceContrat) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Référence :</span> <span className="font-semibold text-[#E14B89] text-sm">{mandat.referenceMandat || mandat.referenceContrat}</span>
              {mandat.descriptionContrat && <span className="text-gray-500 text-sm ml-2">— {mandat.descriptionContrat}</span>}
            </div>
          )}
        </div>

        {/* ═══ Débiteur (read-only) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-3">
          <div className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-3">Débiteur</div>
          <div className="text-sm text-gray-800 font-medium">{mandat.clientName}</div>
        </div>

        {/* ═══ Conditions (compact) ═══ */}
        <div className="bg-amber-50 border border-amber-200/50 rounded-xl px-4 py-3 mb-3 text-xs text-amber-800 leading-relaxed">
          <strong>Conditions :</strong> En signant, vous autorisez KAMEO à débiter votre compte selon les instructions de paiement.
          Droit de remboursement sous 8 semaines après le débit.
        </div>

        {/* ═══ Section 2: Coordonnées bancaires ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-3">
          <div className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-4">Coordonnées bancaires</div>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>BIC (Code banque international) *</label>
              <input value={form.bic} onChange={e => setForm({ ...form, bic: cleanBic(e.target.value) })}
                className={`${inputCls} font-mono uppercase ${form.bic && !bicValid ? 'border-red-300 focus:border-red-400 focus:ring-red-400/10' : ''}`}
                placeholder="Ex: BNPAFRPP" maxLength={11} autoFocus />
              <p className={`text-[11px] mt-1 ${form.bic && !bicValid ? 'text-red-400' : 'text-gray-400'}`}>
                {form.bic && !bicValid ? `${bicLen} caractère${bicLen > 1 ? 's' : ''} — attendu 8 ou 11` : '8 ou 11 caractères — disponible sur votre RIB'}
              </p>
            </div>
            <div>
              <label className={labelCls}>IBAN (N° de compte international) *</label>
              <input value={formatIban(form.iban)}
                onChange={e => { const raw = cleanIban(e.target.value); if (raw.length <= 34) setForm({ ...form, iban: raw }) }}
                className={`${inputCls} font-mono uppercase tracking-wider ${form.iban && !ibanValid ? 'border-red-300 focus:border-red-400 focus:ring-red-400/10' : ''}`}
                placeholder="Ex: FR76 3000 6000 0112 3456 7890 189" inputMode="text" />
              <p className={`text-[11px] mt-1 ${form.iban && !ibanValid ? 'text-red-400' : 'text-gray-400'}`}>
                {form.iban && !ibanValid ? `${ibanLen} caractère${ibanLen > 1 ? 's' : ''} — attendu entre 15 et 34` : '27 caractères pour un IBAN français — disponible sur votre RIB'}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ Section 3: Signature ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-3">
          <div className="font-bold text-xs text-gray-400 uppercase tracking-wider mb-4">Signature</div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className={labelCls}>Fait à *</label>
              <input value={form.signCity} onChange={e => setForm({ ...form, signCity: e.target.value })} className={inputCls}
                placeholder="Votre ville" />
            </div>
            <div>
              <label className={labelCls}>Le</label>
              <input value={today} disabled className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500" />
            </div>
          </div>

          {/* Tap to sign */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4 focus-within:border-[#E14B89] transition-colors">
            <label className="block text-xs font-medium text-gray-500 mb-2">Signature *</label>
            <input value={mandat.clientName} readOnly
              className="w-full border-0 outline-none text-2xl italic font-serif text-gray-900 bg-transparent cursor-default" />
            <div className="border-t border-gray-200 mt-3 pt-2 text-center text-[10px] text-gray-400 italic">
              Signature électronique — validant votre autorisation de prélèvement
            </div>
          </div>

          {/* Validation feedback */}
          {errors.length > 0 && (form.bic || form.iban) && !isValid && (
            <div className="bg-orange-50 border border-orange-200/50 rounded-xl px-4 py-3 mb-4 text-xs text-orange-700">
              {errors.filter(e => !e.includes('requis') || (form.bic || form.iban)).slice(0, 3).join(' · ')}
            </div>
          )}

          <button onClick={handleSign} disabled={signing || !isValid}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
            {signing ? 'Signature en cours...' : 'Signer le mandat de prélèvement'}
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4 pb-6">
          Document généré par Kameo — {today}
        </p>
      </div>
    </div>
  )
}
