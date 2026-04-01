'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2, ChevronDown } from 'lucide-react'

interface ContractData {
  clientName: string
  subject: string
  type: string
  billing: string
  priceHT: number | null
  startDate: string | null
  endDate: string | null
  notes: string | null
  signatureStatus: string
  clientAddress: string | null
  clientPostalCode: string | null
  clientCity: string | null
  clientCountry: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientSiren: string | null
  duration: string | null
  maintenanceLevel: number | null
}

function getSubtitle(type: string) {
  switch (type) {
    case 'PACK_COM': return 'Pack de communication'
    case 'MAINTENANCE_WEB': return 'Maintenance web'
    case 'FICHE_GOOGLE': return 'Fiche Google'
    case 'ARTICLES_BLOG': return 'Articles de blog'
    default: return 'Prestation'
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

const MAINT_LEVELS: Record<number, string[]> = {
  1: ['Hébergement web'],
  2: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7'],
  3: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7', '1h de développement'],
  4: ['Hébergement web', 'Hébergement nom de domaine', 'License Elementor Pro', 'Mises à jour régulières du CMS et des plugins', '1 sauvegarde mensuelle complète du site', 'Support technique 5j/7', '1h de développement', '1 appel trimestriel de suivi'],
}

function ServiceDescription({ type, maintenanceLevel }: { type: string; maintenanceLevel?: number | null }) {
  if (type === 'PACK_COM') return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-gray-50 rounded-xl p-5">
        <div className="font-bold text-sm text-gray-800 mb-3 pb-3 border-b border-gray-200">Réseaux Sociaux</div>
        <ul className="list-disc pl-4 text-gray-600 text-[13px] space-y-1.5 leading-relaxed">
          <li>Création des réseaux sociaux (si nécessaire)</li>
          <li>Optimisation et refonte visuelle des comptes</li>
          <li>Animation des réseaux (réponse aux messages, aux commentaires, etc.)</li>
          <li>Publication de 2 posts / semaine (2 réseaux sociaux)</li>
        </ul>
      </div>
      <div className="bg-gray-50 rounded-xl p-5">
        <div className="font-bold text-sm text-gray-800 mb-3 pb-3 border-b border-gray-200">Fiche Google</div>
        <ul className="list-disc pl-4 text-gray-600 text-[13px] space-y-1.5 leading-relaxed">
          <li>Création de la fiche Google (offert)</li>
          <li>Rédaction et publication d&apos;articles sur la fiche Google</li>
          <li>Planification de photos Google</li>
          <li>Réponses aux avis Google</li>
          <li>2 plaquettes Google offertes afin de récolter des avis clients</li>
        </ul>
      </div>
    </div>
  )
  const items = type === 'MAINTENANCE_WEB' ? (MAINT_LEVELS[maintenanceLevel ?? 2] ?? MAINT_LEVELS[2])
  : type === 'FICHE_GOOGLE' ? [
    'Création de la fiche Google (offert)', "Rédaction et publication d'articles sur la fiche Google",
    'Planification de photos Google', 'Réponses aux avis Google', '2 plaquettes Google offertes afin de récolter des avis clients',
  ] : type === 'ARTICLES_BLOG' ? ['Rédaction et mise en ligne de 8 articles de blog par mois'] : []
  if (!items.length) return null
  const title = type === 'MAINTENANCE_WEB' ? `Maintenance web — Niveau ${maintenanceLevel ?? 2}` : type === 'FICHE_GOOGLE' ? 'Fiche Google' : 'Articles de blog'
  return (
    <div className="bg-gray-50 rounded-xl p-5 max-w-md">
      <div className="font-bold text-sm text-gray-800 mb-3 pb-3 border-b border-gray-200">{title}</div>
      <ul className="list-disc pl-4 text-gray-600 text-[13px] space-y-1.5 leading-relaxed">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <div className="inline-block bg-gray-100 rounded-lg px-4 py-1.5 font-semibold text-sm text-gray-700 mb-4 border-l-[3px] border-[#E14B89]">{children}</div>
}

export default function ContractSignPage() {
  const { token } = useParams<{ token: string }>()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [signing, setSigning] = useState(false)
  const [city, setCity] = useState('')
  const [signerName, setSignerName] = useState('')
  const [showConditions, setShowConditions] = useState(false)

  useEffect(() => {
    fetch(`/api/signature/contrat/${token}`)
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else { setContract(data); setSignerName(data.clientName || '') } })
      .catch(() => setError('Impossible de charger le contrat'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSign() {
    if (!city || !signerName) return
    setSigning(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 600; canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 100)
      ctx.fillStyle = '#111827'; ctx.font = 'italic 32px Georgia, serif'
      ctx.fillText(signerName, 20, 60)
      const signatureData = canvas.toDataURL('image/png')
      const res = await fetch(`/api/signature/contrat/${token}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, city, date: new Date().toLocaleDateString('fr-FR') }),
      })
      if (!res.ok) { const err = await res.json(); setError(err.error || 'Erreur'); return }
      setSigned(true)
    } catch { setError('Erreur réseau') }
    finally { setSigning(false) }
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4"><div className="text-center"><AlertCircle className="mx-auto text-red-400 mb-3" size={40} /><p className="text-gray-600">{error}</p></div></div>
  if (signed || contract?.signatureStatus === 'SIGNE') return <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4"><div className="text-center"><CheckCircle className="mx-auto text-green-500 mb-3" size={48} /><h2 className="text-xl font-semibold text-gray-800 mb-2">Contrat signé</h2><p className="text-gray-500">Merci ! Votre signature a été enregistrée.</p></div></div>
  if (!contract) return null

  const c = contract
  const priceHT = c.priceHT ?? 0
  const tva = priceHT * 0.2
  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#E14B89] focus:ring-2 focus:ring-[#E14B89]/10 transition-all bg-white"

  return (
    <div className="min-h-screen bg-gray-100" style={{ colorScheme: 'light' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Kameo" className="h-6" />
          <span className="text-xs text-gray-400">Contrat à signer</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">

        {/* ═══ Cover section ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 mb-4">
          <div className="text-center mb-6 sm:mb-8">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">Contrat d&apos;abonnement</div>
            <div className="text-gray-500">{getSubtitle(c.type)}</div>
          </div>

          {/* Prestataire */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-5 mb-4">
            <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Le Prestataire</div>
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong>Kameo SAS</strong> — 1862 RUE LA LAURAGAISE, 31670 LABÈGE<br />
              RCS Toulouse 980 573 984 — Représentée par Benjamin Dayan, Président
            </p>
          </div>

          {/* Client */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-5 mb-4">
            <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Le Client</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-400">Nom :</span> <span className="font-medium text-gray-800">{c.clientName}</span></div>
              {c.clientEmail && <div><span className="text-gray-400">Email :</span> <span className="text-gray-800">{c.clientEmail}</span></div>}
              {c.clientAddress && <div className="sm:col-span-2"><span className="text-gray-400">Adresse :</span> <span className="text-gray-800">{c.clientAddress}</span></div>}
              {c.clientPostalCode && <div><span className="text-gray-400">CP :</span> <span className="text-gray-800">{c.clientPostalCode}</span></div>}
              {c.clientCity && <div><span className="text-gray-400">Ville :</span> <span className="text-gray-800">{c.clientCity}</span></div>}
              {c.clientPhone && <div><span className="text-gray-400">Tél :</span> <span className="text-gray-800">{c.clientPhone}</span></div>}
              {c.clientSiren && <div><span className="text-gray-400">SIREN :</span> <span className="text-gray-800">{c.clientSiren}</span></div>}
            </div>
          </div>

          {/* Prix */}
          <div className="bg-gradient-to-r from-[#E14B89]/5 to-[#F8903C]/5 rounded-xl p-4 sm:p-5 border border-[#E14B89]/10">
            <div className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Coût du service</div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 mb-3">
              <div><span className="text-sm text-gray-500">Mensuel HT</span><div className="text-lg font-bold text-gray-900">{priceHT ? fmt(priceHT) : '—'}</div></div>
              <div><span className="text-sm text-gray-500">TVA (20%)</span><div className="text-lg font-bold text-gray-900">{priceHT ? fmt(tva) : '—'}</div></div>
              <div><span className="text-sm text-gray-500">Total TTC</span><div className="text-lg font-bold text-[#E14B89]">{priceHT ? fmt(priceHT + tva) : '—'}</div></div>
            </div>
            {c.duration && <div className="text-sm text-gray-500">Durée : <strong className="text-gray-800">{c.duration}</strong></div>}
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">Paiement par prélèvement automatique SEPA. Malus de 20€ par prélèvement refusé.</p>
          </div>
        </div>

        {/* ═══ Service description ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 mb-4">
          <Badge>Article 3 : Description du service</Badge>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            L&apos;Agence Digitale KAMEO s&apos;engage à fournir au CLIENT la prestation suivante :
          </p>
          <ServiceDescription type={c.type} maintenanceLevel={c.maintenanceLevel} />
        </div>

        {/* ═══ Conditions Générales (collapsible) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
          <button onClick={() => setShowConditions(!showConditions)}
            className="w-full flex items-center justify-between p-5 sm:p-6 text-left">
            <div>
              <div className="font-semibold text-gray-800">Conditions Générales</div>
              <div className="text-xs text-gray-400 mt-0.5">Articles 1 à 11 — Cliquez pour {showConditions ? 'masquer' : 'lire'}</div>
            </div>
            <ChevronDown size={20} className={`text-gray-400 transition-transform ${showConditions ? 'rotate-180' : ''}`} />
          </button>
          {showConditions && (
            <div className="px-5 sm:px-8 pb-6 sm:pb-8 text-[13px] text-gray-600 leading-[1.8] space-y-5">
              <div>
                <Badge>Article 1 : OBJET</Badge>
                <p>Les présentes Conditions Générales définissent les droits et obligations respectifs de l&apos;agence digitale KAMEO et du CLIENT dans le cadre de la fourniture par KAMEO SAS d&apos;un service d&apos;hébergement du site internet du CLIENT. Elles définissent notamment les Conditions spécifiques d&apos;utilisation de ce service par le CLIENT ici comme ses termes et conditions particulières. Tout accomplissement par l&apos;Agence Digitale KAMEO d&apos;une prestation de ce service tel que décrites à l&apos;article 3 implique donc l&apos;acceptation sans réserve du CLIENT des présentes conditions générales.</p>
              </div>
              <div>
                <Badge>Article 2 : DÉFINITIONS</Badge>
                <ul className="space-y-1">
                  <li><span className="text-[#E14B89] font-bold">●</span> <strong>CLIENT :</strong> la personne physique ou morale ayant souscrit au Service.</li>
                  <li><span className="text-[#E14B89] font-bold">●</span> <strong>CONTRAT :</strong> les présentes Conditions Générales et les Conditions Particulières du Service.</li>
                  <li><span className="text-[#E14B89] font-bold">●</span> <strong>SERVICE :</strong> prestation de communication fournie par l&apos;Agence Digitale KAMEO.</li>
                </ul>
              </div>
              <div>
                <Badge>Article 4 : MODALITÉS D&apos;EXÉCUTION</Badge>
                <p>Prise en charge sous 48h, réponse sous 8 jours ouvrés. Horaires : 09h00 à 18h00.</p>
              </div>
              <div>
                <Badge>Article 5 : DURÉE</Badge>
                <p>Durée de <strong>{c.duration || '—'}</strong>, tacitement reconduit pour 1 an sauf dénonciation avec préavis d&apos;1 mois.</p>
              </div>
              <div>
                <Badge>Article 6 : RÉSILIATION ANTICIPÉE</Badge>
                <p>Résiliation possible en cas de manquement, avec préavis de 15 jours par lettre recommandée.</p>
              </div>
              <div>
                <Badge>Article 7 : PRÉLÈVEMENTS</Badge>
                <p>Frais de 19,60 € TTC par prélèvement rejeté (pénalités bancaires).</p>
              </div>
              <div>
                <Badge>Article 8 : RESPONSABILITÉS</Badge>
                <p>Le CLIENT est seul responsable des informations contenues dans ses supports digitaux.</p>
              </div>
              <div>
                <Badge>Article 9 : MODIFICATION DU CONTRAT</Badge>
                <p>Information 1 mois avant, résiliation possible dans les 2 mois suivant l&apos;entrée en vigueur.</p>
              </div>
              <div>
                <Badge>Article 10 : LIVRAISON ET MISE EN DEMEURE</Badge>
                <p>30 jours pour validation. Frais de remise en service : 75€ HT. Sauvegarde conservée 90 jours.</p>
              </div>
              <div>
                <Badge>Article 11 : DISPOSITIONS DIVERSES</Badge>
                <p>Droit français. Juridictions françaises compétentes.</p>
              </div>
            </div>
          )}
        </div>

        {/* ═══ Signature ═══ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
          <div className="font-semibold text-gray-800 mb-1">Bon pour accord et signature</div>
          <p className="text-xs text-gray-400 mb-5">En signant, vous acceptez les conditions ci-dessus</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fait à *</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Votre ville" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Le</label>
              <input value={today} disabled className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-500" />
            </div>
          </div>

          {/* Signatures side by side on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 mb-3">KAMEO SAS</div>
              <div className="italic text-2xl text-gray-700 font-serif">Dayan</div>
              <div className="border-t border-gray-200 mt-4 pt-2 text-center text-[10px] text-gray-400 italic">Signature du prestataire</div>
            </div>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">Votre signature *</div>
              <input value={signerName} onChange={e => setSignerName(e.target.value)}
                placeholder="Tapez votre nom complet pour signer"
                className="w-full border-0 border-b-2 border-gray-200 focus:border-[#E14B89] outline-none text-lg py-2 bg-transparent italic font-serif transition-colors text-gray-900 placeholder-gray-400"
              />
              {signerName && (
                <div className="mt-2 text-center">
                  <span className="italic text-2xl font-serif text-gray-700">{signerName}</span>
                </div>
              )}
              <div className="border-t border-gray-200 mt-3 pt-2 text-center text-[10px] text-gray-400 italic">Signature du client</div>
            </div>
          </div>

          <button onClick={handleSign} disabled={signing || !city || !signerName}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
            {signing ? 'Signature en cours...' : 'Signer le contrat'}
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4 pb-6">
          Document généré par Kameo — {today}
        </p>
      </div>
    </div>
  )
}
