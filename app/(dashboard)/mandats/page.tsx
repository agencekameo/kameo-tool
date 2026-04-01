'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, X, Send, CheckCircle, Clock, Loader2, Search, ChevronRight, Download, ArrowLeft, FileText, Ban, RotateCcw, Upload } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { usePolling } from '@/hooks/usePolling'

interface Mandat {
  id: string
  clientName: string
  clientEmail?: string
  subject?: string
  billing: string
  priceHT?: number
  active: boolean
  signatureStatus: string
  sentForSignAt?: string
  clientAddress?: string
  clientPostalCode?: string
  clientCity?: string
  clientPrenom?: string
  bic?: string
  iban?: string
  paymentType?: string
  referenceMandat?: string
  referenceContrat?: string
  descriptionContrat?: string
  signatureData?: string
  signedCity?: string
  signerName?: string
  signedAt?: string
  stoppedAt?: string
  createdAt: string
}

interface MaintenanceLink {
  id: string
  type: string
  billing: string
  priceHT?: number
  mandatId?: string
  active: boolean
}

interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  siret?: string
}

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: 'bg-slate-800 text-slate-400',
  ENVOYE: 'bg-blue-500/10 text-blue-400',
  SIGNE: 'bg-green-500/10 text-green-400',
}
const STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  SIGNE: 'Signé',
}

function mandatStatus(m: Mandat): 'EN_COURS' | 'EN_ATTENTE' | 'TERMINE' {
  if (m.stoppedAt) return 'TERMINE'
  if (!m.active) return 'TERMINE'
  if (m.signatureStatus === 'SIGNE') return 'EN_COURS'
  return 'EN_ATTENTE'
}

const TABS = [
  { key: 'EN_COURS', label: 'Actifs', dot: 'bg-green-400' },
  { key: 'EN_ATTENTE', label: 'En attente', dot: 'bg-amber-400' },
  { key: 'TERMINE', label: 'Terminés', dot: 'bg-slate-500' },
]

// ─── PDF Generation ──────────────────────────────────────────────────────────

function buildMandatPdfHtml(m: Mandat) {
  const today = new Date().toLocaleDateString('fr-FR')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mandat SEPA - ${m.clientName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; font-size:13px; }
  @page { margin: 32px; size: A4; }
  @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  table { border-collapse: collapse; width: 100%; }
  td, th { padding: 8px 12px; border: 1px solid #d1d5db; font-size: 12px; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 700; text-align: left; }
  .section-title { background: #111827; color: #fff; padding: 10px 16px; font-weight: 700; font-size: 14px; }
  .label { color: #6b7280; font-size: 11px; font-weight: 600; }
  .value { font-weight: 500; color: #111; }
  .hint { font-size: 10px; color: #9ca3af; font-style: italic; }
  .blank { display: inline-block; min-width: 200px; border-bottom: 1px solid #d1d5db; min-height: 16px; }
</style></head><body>

<div style="border:2px solid #111;max-width:700px;margin:0 auto">
  <div class="section-title" style="text-align:center;font-size:18px;padding:16px">
    Mandat de prélèvement SEPA Direct Debit - SDD
  </div>

  <!-- IDENTIFICATION DE L'ENTREPRISE -->
  <table>
    <tr>
      <td colspan="2" style="background:#f9fafb;border-bottom:2px solid #111">
        <strong style="font-size:13px">IDENTIFICATION DE L'ENTREPRISE</strong>
        <span style="float:right;font-size:11px;color:#6b7280;font-style:italic">Vous vous engagez avec l'entreprise suivante :</span>
      </td>
    </tr>
    <tr><td class="label" style="width:140px">Nom</td><td class="value">KAMEO</td></tr>
    <tr><td class="label">Adresse</td><td class="value">1862 RUE LA LAURAGAISE</td></tr>
    <tr><td class="label">Code Postal / Ville</td><td class="value">31670 &nbsp;&nbsp;&nbsp; LABÈGE</td></tr>
    <tr><td class="label">ICS</td><td class="value">FR93ZZZ897DF1</td></tr>
  </table>

  <!-- REFERENCE DU MANDAT -->
  <table style="margin-top:-1px">
    <tr>
      <td style="background:#f9fafb;border-bottom:2px solid #111" colspan="2">
        <strong>REFERENCE DU MANDAT</strong>
        <span style="margin-left:16px" class="hint">Cette Référence Unique du Mandat est à conserver et à rappeler dans tous vos courriers</span>
      </td>
    </tr>
    <tr><td colspan="2" style="padding:12px">${m.referenceMandat || ''}</td></tr>
  </table>

  <!-- CONDITIONS -->
  <div style="border:1px solid #d1d5db;border-top:none;padding:12px 16px;background:#fefce8;font-size:11px;color:#4b5563;line-height:1.7;font-style:italic">
    <strong style="font-style:normal">Conditions générales d'utilisation de votre mandat</strong><br/>
    En signant ce formulaire de mandat, vous autorisez (A) KAMEO à envoyer des instructions à votre banque pour débiter votre compte, et (B)
    votre banque à débiter votre compte conformément aux instructions de paiement de KAMEO. Vous bénéficiez d'un droit de remboursement par
    votre banque selon les conditions décrites dans la convention que vous avez passée avec elle.<br/>
    Toute demande de remboursement doit être présentée dans les 8 semaines suivant la date de débit de votre compte.
  </div>

  <!-- IDENTIFICATION DU CLIENT -->
  <table style="margin-top:-1px">
    <tr>
      <td style="background:#f9fafb;border-bottom:2px solid #111" colspan="2">
        <strong>IDENTIFICATION DU CLIENT</strong>
        <span style="float:right" class="hint">En ce qui vous concerne, nous avons besoin des éléments suivants :</span>
      </td>
    </tr>
    <tr>
      <td class="label" style="width:140px">Votre nom et Prénom</td>
      <td>
        <span class="label">Nom </span><span class="value">${m.clientName || ''}</span>
        <span style="margin-left:24px" class="label">Prénom </span><span class="value">${m.clientPrenom || ''}</span>
      </td>
    </tr>
    <tr>
      <td class="label">Votre adresse</td>
      <td>
        <div><span class="label">N° et Rue </span><span class="value">${m.clientAddress || ''}</span></div>
        <div style="margin-top:6px"><span class="label">Code Postal </span><span class="value">${m.clientPostalCode || ''}</span> <span style="margin-left:16px" class="label">Ville </span><span class="value">${m.clientCity || ''}</span></div>
      </td>
    </tr>
    <tr>
      <td class="label">Coordonnées bancaires</td>
      <td>
        <div><span class="label">BIC </span><span class="value">${m.bic || ''}</span></div>
        <div class="hint">Le BIC est le Code International d'Identification de votre banque</div>
        <div style="margin-top:6px"><span class="label">IBAN </span><span class="value">${m.iban || ''}</span></div>
        <div class="hint">Votre IBAN est le numéro d'identification internationale de votre compte</div>
        <div style="margin-top:8px">
          <span class="label">Type de paiement : </span>
          <span class="value">Récurrent ${m.paymentType === 'RECURRENT' || !m.paymentType ? '☒' : '☐'}</span>
          <span style="margin-left:12px" class="value">Ponctuel ${m.paymentType === 'PONCTUEL' ? '☒' : '☐'}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td class="label">Votre signature</td>
      <td>
        <div><span class="label">Date </span><span class="value">${m.signedAt ? new Date(m.signedAt).toLocaleDateString('fr-FR') : today}</span> <span style="margin-left:24px" class="label">Ville </span><span class="value">${m.signedCity || m.clientCity || ''}</span></div>
        <div style="min-height:60px;margin-top:12px;border-top:1px dashed #d1d5db;padding-top:8px">
          ${m.signatureData
            ? `<img src="${m.signatureData}" style="max-width:200px;max-height:50px;margin:4px 0" />`
            : `<div class="hint">Votre signature validant votre autorisation</div>`}
          ${m.signerName ? `<div class="value" style="margin-top:4px">${m.signerName}</div>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- REFERENCE DU CONTRAT -->
  <table style="margin-top:-1px">
    <tr>
      <td class="label" style="width:140px">REFERENCE DU CONTRAT</td>
      <td>
        <div><span class="label">N. d'identification </span><span class="value">${m.referenceContrat || ''}</span></div>
        <div style="margin-top:4px"><span class="label">Description </span><span class="value">${m.descriptionContrat || ''}</span></div>
      </td>
    </tr>
  </table>
</div>

</body></html>`
}

function downloadMandatPdf(m: Mandat) {
  const html = buildMandatPdfHtml(m)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 500)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MandatsPage() {
  const [mandats, setMandats] = useState<Mandat[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [maintenances, setMaintenances] = useState<MaintenanceLink[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'EN_COURS' | 'EN_ATTENTE' | 'TERMINE'>('EN_COURS')

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', referenceContrat: '', descriptionContrat: [] as string[], dejaActif: false,
  })

  // Signature
  const [signModal, setSignModal] = useState<Mandat | null>(null)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  // Inline edits
  const [editingIban, setEditingIban] = useState<string | null>(null)
  const [ibanValue, setIbanValue] = useState('')
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [refValue, setRefValue] = useState('')

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ filename: string; success: boolean; error?: string }[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/mandats').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/maintenances').then(r => r.json()),
    ]).then(([m, cl, mt]) => { setMandats(m); setClients(cl); setMaintenances(mt) }).finally(() => setLoading(false))
  }, [])

  function refreshData() {
    Promise.all([
      fetch('/api/mandats').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/maintenances').then(r => r.json()),
    ]).then(([m, cl, mt]) => { setMandats(m); setClients(cl); setMaintenances(mt) })
  }
  usePolling(refreshData)

  async function handleImportMandats(files: FileList) {
    setImporting(true)
    setImportResults([])
    try {
      const formData = new FormData()
      Array.from(files).forEach(f => formData.append('files', f))
      const res = await fetch('/api/mandats/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.results) {
        setImportResults(data.results)
        const refreshed = await fetch('/api/mandats').then(r => r.json())
        setMandats(refreshed)
      } else {
        setImportResults([{ filename: 'Erreur', success: false, error: data.error }])
      }
    } catch { setImportResults([{ filename: 'Erreur', success: false, error: 'Erreur réseau' }]) }
    finally { setImporting(false) }
  }

  function getNextReference() {
    const year = new Date().getFullYear()
    const prefix = `M${year}-`
    const nums = mandats
      .map(m => m.referenceMandat || '')
      .filter(r => r.startsWith(prefix))
      .map(r => parseInt(r.replace(prefix, ''), 10))
      .filter(n => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }

  function openWizard() {
    setWizardStep(1)
    setSelectedClient(null)
    setClientSearch('')
    setForm({ clientName: '', clientEmail: '', referenceContrat: getNextReference(), descriptionContrat: [], dejaActif: false })
    setShowWizard(true)
  }

  function selectClient(client: Client) {
    setSelectedClient(client)
    setForm(prev => ({
      ...prev,
      clientName: client.company || client.name,
      clientEmail: client.email || '',
    }))
    setWizardStep(2)
  }

  async function handleCreateMandat() {
    setSaving(true)
    try {
      const payload = {
        clientName: form.clientName,
        clientEmail: form.clientEmail || null,
        subject: 'Mandat de prélèvement SEPA',
        billing: 'MENSUEL',
        active: true,
        clientId: selectedClient?.id || null,
        referenceContrat: form.referenceContrat || null,
        descriptionContrat: form.descriptionContrat.length > 0 ? form.descriptionContrat.join(', ') : null,
        ...(form.referenceContrat ? { referenceMandat: form.referenceContrat } : {}),
        ...(form.dejaActif ? { signatureStatus: 'SIGNE' } : {}),
      }
      const res = await fetch('/api/mandats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const created = await res.json()
      if (!res.ok) { alert(created.error || 'Erreur lors de la création'); return }
      setMandats(prev => [created, ...prev])
      setWizardStep(3)
    } catch { alert('Erreur lors de la création') }
    finally { setSaving(false) }
  }

  async function handleSendSignature() {
    if (!signModal || !signModal.clientEmail) return
    setSending(true)
    try {
      const res = await fetch(`/api/mandats/${signModal.id}/send-signature`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signModal.clientEmail }),
      })
      if (!res.ok) { const err = await res.json(); alert(err.error || 'Erreur'); return }
      setMandats(prev => prev.map(m => m.id === signModal.id ? { ...m, signatureStatus: 'ENVOYE', sentForSignAt: new Date().toISOString() } : m))
      setSignModal(null)
      alert('Email envoyé avec succès !')
    } catch { alert('Erreur réseau') }
    finally { setSending(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce mandat ?')) return
    await fetch(`/api/mandats/${id}`, { method: 'DELETE' })
    setMandats(prev => prev.filter(m => m.id !== id))
  }

  async function handleStopMandat(id: string) {
    if (!confirm('Marquer ce mandat comme arrêté par le client ?')) return
    const res = await fetch(`/api/mandats/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stoppedAt: new Date().toISOString() }),
    })
    if (res.ok) {
      setMandats(prev => prev.map(m => m.id === id ? { ...m, stoppedAt: new Date().toISOString() } : m))
    }
  }

  async function handleSaveRef(id: string) {
    const trimmed = refValue.trim()
    if (!trimmed) { setEditingRef(null); return }
    const res = await fetch(`/api/mandats/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceMandat: trimmed }),
    })
    if (res.ok) {
      setMandats(prev => prev.map(m => m.id === id ? { ...m, referenceMandat: trimmed } : m))
    }
    setEditingRef(null)
  }

  async function handleSaveIban(id: string) {
    const trimmed = ibanValue.replace(/\s/g, '').toUpperCase()
    if (!trimmed) { setEditingIban(null); return }
    const res = await fetch(`/api/mandats/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iban: trimmed }),
    })
    if (res.ok) {
      setMandats(prev => prev.map(m => m.id === id ? { ...m, iban: trimmed } : m))
    }
    setEditingIban(null)
  }

  async function handleReactivateMandat(id: string) {
    if (!confirm('Réactiver ce mandat ?')) return
    const res = await fetch(`/api/mandats/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stoppedAt: null }),
    })
    if (res.ok) {
      setMandats(prev => prev.map(m => m.id === id ? { ...m, stoppedAt: undefined } : m))
    }
  }

  const TYPE_LABELS: Record<string, string> = { WEB: 'Web', GOOGLE: 'Google', RESEAUX: 'Réseaux', BLOG: 'Blog' }

  function getLinkedMaintenances(mandatId: string) {
    return maintenances.filter(mt => mt.mandatId === mandatId)
  }

  function formatMaintPrice(mt: MaintenanceLink): number {
    const price = mt.priceHT ?? 0
    if (mt.billing === 'ANNUEL') return price / 12
    if (mt.billing === 'TRIMESTRIEL') return price / 3
    return price
  }

  const filteredClients = clientSearch.length >= 1
    ? clients.filter(c => (c.name + ' ' + (c.company || '')).toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : []

  const lastCreated = mandats[0]
  const inputClass = "w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
  const inputError = "w-full bg-[#1a1a24] border border-red-500/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-400 transition-colors"
  const labelClass = "block text-slate-400 text-xs mb-1.5"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValid = !form.clientEmail || emailRegex.test(form.clientEmail)

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Mandats</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mandats.filter(m => mandatStatus(m) === 'EN_COURS').length} actifs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowImport(true); setImportResults([]) }}
            className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Upload size={16} /> Importer
          </button>
          <button onClick={openWizard}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Nouveau mandat
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111118] border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const count = mandats.filter(m => mandatStatus(m) === t.key).length
          return (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
              {t.label}
              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? <div className="text-slate-500 text-sm">Chargement...</div> : (
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          {mandats.filter(m => mandatStatus(m) === tab).length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">Aucun mandat dans cette catégorie</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Client</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Référence</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Abonnement</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">Prix mensuel</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium hidden md:table-cell">IBAN</th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {mandats.filter(m => mandatStatus(m) === tab).map((m, i, arr) => (
                  <tr key={m.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group ${i === arr.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{m.clientName}</p>
                      {m.clientPrenom && <p className="text-slate-500 text-xs">{m.clientPrenom}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm font-mono hidden md:table-cell"
                      onDoubleClick={() => { setEditingRef(m.id); setRefValue(m.referenceMandat || '') }}>
                      {editingRef === m.id ? (
                        <input autoFocus value={refValue} onChange={e => setRefValue(e.target.value)}
                          onBlur={() => handleSaveRef(m.id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveRef(m.id); if (e.key === 'Escape') setEditingRef(null) }}
                          className="bg-[#1a1a24] border border-[#E14B89] rounded px-2 py-1 text-white text-sm font-mono w-32 focus:outline-none"
                          placeholder="M2024-001" />
                      ) : (
                        <span className="cursor-pointer hover:text-slate-300" title="Double-clic pour modifier">
                          {m.referenceMandat || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const linked = getLinkedMaintenances(m.id)
                        if (linked.length === 0) {
                          if (m.subject) return <span className="text-xs px-2 py-0.5 rounded-full bg-[#E14B89]/10 text-[#E14B89]">{m.subject}</span>
                          return <span className="text-slate-600 text-xs">—</span>
                        }
                        return (
                          <div className="flex flex-wrap gap-1">
                            {linked.map(mt => (
                              <span key={mt.id} className="text-xs px-2 py-0.5 rounded-full bg-[#E14B89]/10 text-[#E14B89]">
                                {TYPE_LABELS[mt.type] || mt.type}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {(() => {
                        const linked = getLinkedMaintenances(m.id)
                        if (linked.length === 0) {
                          if (m.priceHT) return <span className="text-white text-sm font-medium">{formatCurrency(m.priceHT)}</span>
                          return <span className="text-slate-600 text-xs">—</span>
                        }
                        const total = linked.reduce((s, mt) => s + formatMaintPrice(mt), 0)
                        return <span className="text-white text-sm font-medium">{formatCurrency(total)}</span>
                      })()}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono hidden md:table-cell"
                      onDoubleClick={() => { if (!m.iban) { setEditingIban(m.id); setIbanValue('') } }}>
                      {editingIban === m.id ? (
                        <input autoFocus value={ibanValue} onChange={e => setIbanValue(e.target.value)}
                          onBlur={() => handleSaveIban(m.id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveIban(m.id); if (e.key === 'Escape') setEditingIban(null) }}
                          className="bg-[#1a1a24] border border-[#E14B89] rounded px-2 py-1 text-white text-xs font-mono w-44 focus:outline-none"
                          placeholder="FR76 1234 5678 ..." />
                      ) : (
                        <span className={!m.iban ? 'cursor-pointer hover:text-slate-300' : ''} title={!m.iban ? 'Double-clic pour ajouter' : m.iban}>
                          {m.iban ? m.iban.replace(/(.{4})/g, '$1 ').trim().slice(0, 20) + '...' : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.stoppedAt ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                          <Ban size={10} className="inline mr-1" />Arrêté
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[m.signatureStatus] ?? 'bg-slate-800 text-slate-400'}`}>
                          {m.signatureStatus === 'SIGNE' && <CheckCircle size={10} className="inline mr-1" />}
                          {m.signatureStatus === 'ENVOYE' && <Clock size={10} className="inline mr-1" />}
                          {STATUS_LABELS[m.signatureStatus] ?? m.signatureStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadMandatPdf(m)}
                          className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors" title="Télécharger PDF">
                          <Download size={13} />
                        </button>
                        {m.signatureStatus !== 'SIGNE' && !m.stoppedAt && (
                          <button onClick={() => setSignModal(m)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 rounded-lg hover:bg-blue-400/5 transition-colors" title="Envoyer pour signature">
                            <Send size={13} />
                          </button>
                        )}
                        {m.signatureStatus === 'SIGNE' && !m.stoppedAt && (
                          <button onClick={() => handleStopMandat(m.id)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-400/5 transition-colors" title="Client veut arrêter">
                            <Ban size={13} />
                          </button>
                        )}
                        {m.stoppedAt && (
                          <button onClick={() => handleReactivateMandat(m.id)}
                            className="p-1.5 text-green-400 hover:text-green-300 rounded-lg hover:bg-green-400/5 transition-colors" title="Réactiver le mandat">
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(m.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-400/5 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ WIZARD ═══ */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {wizardStep === 2 && (
                  <button onClick={() => setWizardStep(1)} className="text-slate-500 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
                )}
                <div>
                  <h2 className="text-white font-semibold text-lg">Nouveau mandat SEPA</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Étape {Math.min(wizardStep, 3)} / 3</p>
                </div>
              </div>
              <button onClick={() => setShowWizard(false)} className="text-slate-500 hover:text-white transition-colors p-1"><X size={18} /></button>
            </div>
            <div className="flex gap-1 px-6 pt-4">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= wizardStep ? 'bg-[#E14B89]' : 'bg-slate-800'}`} />
              ))}
            </div>

            <div className="p-6">
              {/* Step 1: Client */}
              {wizardStep === 1 && (
                <div>
                  <h3 className="text-white font-medium mb-1">Sélectionner un client</h3>
                  <p className="text-slate-500 text-sm mb-4">Le client remplira ses informations (adresse, IBAN, BIC...) lors de la signature</p>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client..." autoFocus
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                  </div>
                  {filteredClients.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {filteredClients.map(c => (
                        <button key={c.id} onClick={() => selectClient(c)}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                          <div>
                            <p className="text-white text-sm font-medium">{c.company || c.name}</p>
                            <p className="text-slate-500 text-xs">{[c.email, c.city].filter(Boolean).join(' · ')}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-[#E14B89] transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                  {clientSearch.length >= 2 && filteredClients.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">Aucun client trouvé</div>
                  )}
                </div>
              )}

              {/* Step 2: Reference + email only */}
              {wizardStep === 2 && (
                <div>
                  <h3 className="text-white font-medium mb-1">Référence du mandat</h3>
                  <p className="text-slate-500 text-sm mb-4">
                    Mandat pour <span className="text-white">{form.clientName}</span> — les informations client seront remplies par le client lui-même
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Email du client (pour l'envoi) *</label>
                      <input type="email" value={form.clientEmail} onChange={e => setForm({ ...form, clientEmail: e.target.value })} className={emailValid ? inputClass : inputError} placeholder="client@example.com" />
                      {!emailValid && <p className="text-red-400 text-[11px] mt-1">Format email invalide</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Numéro de mandat</label>
                      <input value={form.referenceContrat} onChange={e => setForm({ ...form, referenceContrat: e.target.value })} className={inputClass} placeholder="ex: M2026-001" />
                    </div>
                    <div>
                      <label className={labelClass}>Abonnement</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Maintenance web', 'Fiche google', 'Réseaux sociaux', 'Blog'].map(opt => {
                          const checked = form.descriptionContrat.includes(opt)
                          return (
                            <label key={opt} className={`flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl border transition-colors ${checked ? 'border-[#E14B89]/50 bg-[#E14B89]/5' : 'border-slate-800 hover:border-slate-700'}`}>
                              <input type="checkbox" checked={checked}
                                onChange={() => setForm(prev => ({
                                  ...prev,
                                  descriptionContrat: checked
                                    ? prev.descriptionContrat.filter(v => v !== opt)
                                    : [...prev.descriptionContrat, opt],
                                }))}
                                className="w-3.5 h-3.5 rounded border-slate-600 bg-[#1a1a24] accent-[#E14B89]" />
                              <span className={`text-sm ${checked ? 'text-white' : 'text-slate-400'}`}>{opt}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer mt-1 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <input type="checkbox" checked={form.dejaActif} onChange={e => setForm({ ...form, dejaActif: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-600 bg-[#1a1a24] text-[#E14B89] focus:ring-[#E14B89] focus:ring-offset-0 accent-[#E14B89]" />
                      <div>
                        <p className="text-white text-sm font-medium">Mandat déjà actif</p>
                        <p className="text-slate-500 text-xs">Pas d'envoi par email ni de signature — directement dans les actifs</p>
                      </div>
                    </label>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setWizardStep(1)}
                      className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Retour</button>
                    <button onClick={handleCreateMandat} disabled={saving || !form.clientName || (!form.dejaActif && (!form.clientEmail || !emailValid))}
                      className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      {form.dejaActif ? 'Créer (actif)' : 'Créer et envoyer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Done */}
              {wizardStep === 3 && lastCreated && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-400" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Mandat créé !</h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Mandat SEPA pour <strong className="text-white">{lastCreated.clientName}</strong>
                    {lastCreated.signatureStatus === 'SIGNE' && <span className="block text-green-400 text-xs mt-1">Mandat directement actif</span>}
                  </p>
                  <div className="flex gap-3 max-w-sm mx-auto">
                    <button onClick={() => downloadMandatPdf(lastCreated)}
                      className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-300 hover:text-white py-3 rounded-xl text-sm transition-colors hover:bg-slate-800/50">
                      <Download size={16} /> Télécharger
                    </button>
                    {lastCreated.signatureStatus !== 'SIGNE' && (
                      <button onClick={() => { setShowWizard(false); setSignModal(lastCreated) }}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#E14B89] hover:opacity-90 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                        <Send size={16} /> Envoyer pour signature
                      </button>
                    )}
                  </div>
                  <button onClick={() => setShowWizard(false)} className="text-slate-500 hover:text-white text-sm mt-4 transition-colors">Fermer</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SIGNATURE MODAL ═══ */}
      {signModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Envoyer pour signature</h2>
              <button onClick={() => setSignModal(null)} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Le client <strong className="text-white">{signModal.clientName}</strong> recevra un lien à <strong className="text-white">{signModal.clientEmail}</strong> pour remplir ses coordonnées bancaires et signer le mandat.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setSignModal(null)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
              <button onClick={handleSendSignature} disabled={sending || !signModal.clientEmail}
                className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ IMPORT MODAL ═══ */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Importer des mandats</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Importez un ou plusieurs mandats SEPA au format PDF. L&apos;IA analysera chaque document pour en extraire les informations et créer les mandats automatiquement.
            </p>

            <input ref={importRef} type="file" accept=".pdf" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) handleImportMandats(e.target.files) }} />

            {!importing && importResults.length === 0 && (
              <button onClick={() => importRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-[#E14B89]/50 rounded-xl py-12 flex flex-col items-center gap-3 transition-colors group">
                <Upload size={32} className="text-slate-500 group-hover:text-[#E14B89] transition-colors" />
                <span className="text-slate-400 text-sm">Cliquez pour sélectionner des fichiers PDF</span>
              </button>
            )}

            {importing && (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 size={32} className="text-[#E14B89] animate-spin" />
                <p className="text-slate-400 text-sm">Analyse des PDFs en cours...</p>
                <p className="text-slate-500 text-xs">Cela peut prendre quelques secondes par fichier</p>
              </div>
            )}

            {importResults.length > 0 && (
              <div className="space-y-2">
                {importResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${r.success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    {r.success ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" /> : <X size={16} className="text-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>{r.filename}</p>
                      {r.error && <p className="text-red-400/70 text-xs truncate">{r.error}</p>}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setImportResults([]); importRef.current?.click() }}
                    className="flex-1 border border-slate-700 text-slate-300 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                    Importer d&apos;autres
                  </button>
                  <button onClick={() => setShowImport(false)}
                    className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
