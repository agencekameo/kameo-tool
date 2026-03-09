'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, Trash2, Pencil, Eye, Download, X, ChevronDown, FileText, Check, Send, Loader2, Package, Sparkles,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
  subject: string
  status: 'EN_ATTENTE' | 'BROUILLON' | 'ENVOYE' | 'ACCEPTE' | 'REFUSE' | 'EXPIRE'
  validUntil?: string
  notes?: string
  discount: number
  items: QuoteItem[]
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
}

interface Client {
  id: string
  name: string
  company?: string
  email?: string
  address?: string
  postalCode?: string
  city?: string
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

function calcTotals(items: QuoteItem[], discount: number) {
  const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const remise = totalHT * discount / 100
  const sousTotal = totalHT - remise
  const tva = sousTotal * 0.20
  const totalTTC = sousTotal + tva
  return { totalHT, remise, sousTotal, tva, totalTTC }
}

// ─── Print View ───────────────────────────────────────────────────────────────

function PrintView({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(quote.items, quote.discount)
  const today = new Date().toLocaleDateString('fr-FR')

  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!quote.id || downloading) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/quotes/${quote.id}/pdf`)
      if (!res.ok) throw new Error('Erreur')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Devis ${quote.subject} - ${quote.clientName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors du téléchargement.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      {/* Screen-only controls */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-[#E14B89] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg disabled:opacity-50"
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? 'Téléchargement...' : 'Télécharger'}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
        >
          <X size={16} />
          Fermer
        </button>
      </div>

      {/* Print content */}
      <div className="max-w-[800px] mx-auto px-12 py-10 print:p-0 print:max-w-none text-gray-900">

        {/* Header: Logo centered, Devis title, then agency left / info right */}
        <div className="mb-10 pb-8 border-b-[3px]" style={{ borderColor: '#F8903C' }}>
          {/* Logo centered at top */}
          <div className="text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kameo-logo-light.svg" alt="Kameo" className="h-9 mx-auto" />
          </div>
          {/* Devis title centered */}
          <div className="text-center mb-8">
            <div className="text-3xl font-semibold tracking-tight text-gray-800">Devis</div>
          </div>

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
              <div className="text-lg font-bold" style={{ color: '#E14B89' }}>N° {quote.number}</div>
              <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                <div>Émis le : {today}</div>
                {quote.validUntil && (
                  <div>Valide jusqu&apos;au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Client block — same style as Kameo block */}
        <div className="mb-8">
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

        {/* Subject */}
        <div className="mb-8 bg-gray-50 rounded-lg px-5 py-3 border border-gray-100">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mr-3">Objet :</span>
          <span className="text-gray-900 font-semibold">{quote.subject}</span>
        </div>

        {/* Items table */}
        <table className="w-full mb-2 text-sm border-collapse">
          <thead>
            <tr style={{ background: 'linear-gradient(135deg, #E14B89 0%, #F8903C 100%)' }}>
              <th className="text-left py-2.5 px-4 text-white font-semibold w-[46%]">Contenu</th>
              <th className="text-center py-2.5 px-3 text-white font-semibold">Unité</th>
              <th className="text-right py-2.5 px-3 text-white font-semibold">Qté</th>
              <th className="text-right py-2.5 px-3 text-white font-semibold">Prix HT</th>
              <th className="text-right py-2.5 px-4 text-white font-semibold">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, i) => {
              const lines = item.description.split('\n').filter(Boolean)
              const hasMultiline = lines.length > 1
              return (
                <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td className="py-3 px-4 text-gray-800 border-b border-gray-100">
                    {hasMultiline ? (
                      <div>
                        <div className="font-semibold text-gray-900">{lines[0]}</div>
                        <div className="text-gray-500 text-xs mt-0.5 leading-relaxed">{lines.slice(1).join('\n')}</div>
                      </div>
                    ) : (
                      <span>{item.description}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-500 border-b border-gray-100">{item.unit || '—'}</td>
                  <td className="py-3 px-3 text-right text-gray-800 border-b border-gray-100">{item.quantity}</td>
                  <td className="py-3 px-3 text-right text-gray-800 border-b border-gray-100">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 px-4 text-right text-gray-900 font-semibold border-b border-gray-100">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              )
            })}
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

            {/* Échéancier acomptes */}
            <div className="mt-4 text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
              <div className="font-semibold text-gray-600 mb-1.5">Échéancier prévisionnel</div>
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

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 12mm 15mm; }
        }
      `}</style>
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
    subject: '',
    status: 'EN_ATTENTE' as Quote['status'],
    validUntil: defaultValidUntil(),
    notes: '',
    discount: 0,
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

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false)

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
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', unitPrice: '', unit: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Signature
  const SENDER_EMAILS = [
    { label: 'Benjamin Dayan', email: 'benjamin.dayan@agence-kameo.fr' },
    { label: 'Louison Boutet', email: 'louison.boutet@agence-kameo.fr' },
  ]
  const [signatureModal, setSignatureModal] = useState<Quote | null>(null)
  const [signatureForm, setSignatureForm] = useState({ firstName: '', lastName: '', email: '', phone: '', senderEmail: '' })
  const [signatureSending, setSignatureSending] = useState(false)
  const [signatureResult, setSignatureResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<ArticleTemplate | null>(null)
  const [editTemplateForm, setEditTemplateForm] = useState({ name: '', description: '', unitPrice: '', unit: '' })
  const [savingEditTemplate, setSavingEditTemplate] = useState(false)

  // Delete template double-confirmation
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{ id: string; name: string } | null>(null)
  const [deleteTemplateStep, setDeleteTemplateStep] = useState<1 | 2>(1)
  const [deletingTemplate, setDeletingTemplate] = useState(false)

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
      subject: q.subject || '',
      status: q.status,
      validUntil: q.validUntil ? q.validUntil.slice(0, 10) : '',
      notes: q.notes || '',
      discount: q.discount ?? 0,
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
    setForm(f => ({
      ...f,
      items: [...f.items, {
        id: genTempId(),
        description: t.name + (t.description && t.description !== t.name ? '\n' + t.description : ''),
        quantity: 1,
        unitPrice: t.unitPrice,
        unit: t.unit || 'forfait',
      }],
    }))
  }

  // ── Save quote ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.clientName.trim()) { alert('Veuillez renseigner un nom de client / entreprise.'); return }
    if (!form.clientAddress.trim()) { alert('Veuillez renseigner l\'adresse du client.'); return }
    if (!form.validUntil) { alert('Veuillez renseigner une date de validité.'); return }
    if (!form.subject.trim()) { alert('Veuillez renseigner un objet.'); return }

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
        subject: form.subject,
        status: form.status,
        validUntil: form.validUntil || undefined,
        notes: form.notes || undefined,
        discount: Number(form.discount) || 0,
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
        saved = await res.json()
        setQuotes(prev => prev.map(q => q.id === saved.id ? saved : q))
      } else {
        const res = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        saved = await res.json()
        setQuotes(prev => [saved, ...prev])
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

  // ── Signature ──────────────────────────────────────────────────────────────

  function getSignerInfo(q: Quote) {
    const nameParts = q.clientName.split('\n')
    const mainName = nameParts[nameParts.length - 1] || nameParts[0] || ''
    const parts = mainName.trim().split(' ')
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: q.clientEmail || '',
      phone: '',
    }
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
    const fullInfo = { ...info, senderEmail: defaultSender }
    // If we have all required info, send directly without modal
    if (info.firstName.trim() && info.lastName.trim() && info.email.trim()) {
      setSignatureModal(q)
      setSignatureForm(fullInfo)
      setSignatureResult(null)
      sendSignature(q, fullInfo)
    } else {
      // Missing info — open modal to fill in
      setSignatureModal(q)
      setSignatureForm(fullInfo)
      setSignatureResult(null)
    }
  }

  async function sendSignature(q: Quote, info: { firstName: string; lastName: string; email: string; phone: string; senderEmail: string }) {
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
        }),
      })
      const created = await res.json()
      setTemplates(prev => [...prev, created])
      setNewTemplate({ name: '', description: '', unitPrice: '', unit: '' })
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
          unit: editTemplateForm.unit || undefined,
        }),
      })
      const updated = await res.json()
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t))
      setEditingTemplate(null)
    } finally {
      setSavingEditTemplate(false)
    }
  }

  function openDeleteTemplateModal(t: ArticleTemplate) {
    setDeleteTemplateModal({ id: t.id, name: t.name })
    setDeleteTemplateStep(1)
  }

  async function confirmDeleteTemplate() {
    if (!deleteTemplateModal) return
    if (deleteTemplateStep === 1) {
      setDeleteTemplateStep(2)
      return
    }
    setDeletingTemplate(true)
    try {
      await fetch(`/api/article-templates/${deleteTemplateModal.id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(t => t.id !== deleteTemplateModal.id))
      setDeleteTemplateModal(null)
    } finally {
      setDeletingTemplate(false)
    }
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

  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(form.items, form.discount)

  // ── Build preview quote object ─────────────────────────────────────────────

  function buildPreviewQuote(): Quote {
    let previewName = form.clientName
    if (form.showClientName && form.clientId) {
      const cl = clients.find(c => c.id === form.clientId)
      if (cl && cl.company && cl.name !== form.clientName) {
        previewName = `${form.clientName}\n${cl.name}`
      }
    }
    return {
      id: editingQuote?.id || '',
      number: editingQuote?.number || 'APERÇU',
      clientId: form.clientId || undefined,
      clientName: previewName,
      clientEmail: form.clientEmail || undefined,
      clientAddress: form.clientAddress || undefined,
      subject: form.subject,
      status: form.status,
      validUntil: form.validUntil || undefined,
      notes: form.notes || undefined,
      discount: Number(form.discount) || 0,
      items: form.items,
      createdBy: editingQuote?.createdBy || { name: '' },
      createdAt: editingQuote?.createdAt || new Date().toISOString(),
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 min-h-screen bg-[#0d0d14]">

      {/* Print overlay */}
      {printQuote && (
        <PrintView quote={printQuote} onClose={() => setPrintQuote(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Devis</h1>
          <p className="text-slate-400 text-sm mt-1">
            {quotes.length} devis{quotes.length > 1 ? '' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-2 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Package size={16} />
            Modèles d&apos;articles
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity"
          >
            <Plus size={16} />
            Nouveau devis
          </button>
        </div>
      </div>

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
        <div className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Numéro</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Client</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Objet</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Statut</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3">Total HT</th>
                <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">Date</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, i) => {
                const { totalHT: qTotal } = calcTotals(q.items, q.discount)
                return (
                  <tr
                    key={q.id}
                    onClick={() => openEdit(q)}
                    className={`border-b border-slate-800/60 cursor-pointer hover:bg-white/[0.03] transition-colors group
                      ${i === quotes.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-mono text-slate-300 text-xs">{q.number}</td>
                    <td className="px-4 py-3.5 text-white font-medium">{q.clientName}</td>
                    <td className="px-4 py-3.5 text-slate-400 max-w-[220px] truncate">{q.subject}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-300 font-medium">{formatCurrency(qTotal)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
                      {new Date(q.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="pr-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); openSignature(q) }}
                          className="p-1.5 text-slate-500 hover:text-[#E14B89] transition-colors rounded-lg hover:bg-[#E14B89]/5"
                          title="Envoyer pour signature"
                        >
                          <Send size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setPrintQuote(q) }}
                          className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/5"
                          title="Aperçu"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(q.id) }}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5"
                          title="Supprimer"
                        >
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
      )}

      {/* ─── Create/Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-4xl my-8 flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[#E14B89]" />
                <h2 className="text-white font-semibold">
                  {editingQuote ? `Devis ${editingQuote.number}` : 'Nouveau devis'}
                </h2>
              </div>
              <button onClick={closeModal} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row overflow-hidden">

              {/* ── Left: Main form ────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Client selection — search bar */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Client</label>
                  <div className="relative" ref={clientDropdownRef}>
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
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
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
                </div>

                {/* Client detail fields — always visible when client selected or manual */}
                {(form.clientId || useOtherClient) && (
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.clientEmail}
                          onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Adresse *</label>
                        <textarea
                          value={form.clientAddress}
                          onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))}
                          rows={2}
                          placeholder="Adresse complète"
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
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

                {/* Objet */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Objet *</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Ex : Création site web vitrine"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>

                {/* Statut — visible uniquement en mode édition */}
                {editingQuote && (
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Statut</label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={e => setForm(f => ({ ...f, status: e.target.value as Quote['status'] }))}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-9"
                      >
                        {(Object.keys(STATUS_LABELS) as Quote['status'][]).map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* ── Line items ───────────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-300 text-sm font-medium">Lignes de devis</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTemplatesPanel(v => !v)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                          ${showTemplatesPanel
                            ? 'border-[#E14B89]/40 text-[#E14B89] bg-[#E14B89]/10'
                            : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}
                      >
                        <FileText size={12} />
                        Modèles d'articles
                      </button>
                      <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                      >
                        <Plus size={12} />
                        Ajouter une ligne
                      </button>
                    </div>
                  </div>

                  {/* Items table */}
                  {form.items.length > 0 ? (
                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-[#0d0d14]">
                            <th className="text-left text-slate-500 font-medium px-3 py-2 w-[40%]">Contenu</th>
                            <th className="text-left text-slate-500 font-medium px-2 py-2 w-[14%]">Unité</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-2 w-[10%]">Qté</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-2 w-[16%]">Prix HT</th>
                            <th className="text-right text-slate-500 font-medium px-2 py-2 w-[14%]">Total HT</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {form.items.map((item, i) => (
                            <tr key={item.id} className={`border-b border-slate-800/60 ${i === form.items.length - 1 ? 'border-b-0' : ''}`}>
                              <td className="px-3 py-1.5">
                                <textarea
                                  value={item.description}
                                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                                  placeholder="Contenu..."
                                  rows={2}
                                  className="w-full bg-transparent text-white text-xs focus:outline-none placeholder:text-slate-600 focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors resize-none leading-relaxed"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="relative">
                                  <select
                                    value={item.unit || ''}
                                    onChange={e => updateItem(item.id, 'unit', e.target.value)}
                                    className="w-full bg-transparent text-slate-300 text-xs focus:outline-none appearance-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors pr-4"
                                  >
                                    <option value="">—</option>
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                </div>
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantity}
                                  onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent text-white text-xs text-right focus:outline-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent text-white text-xs text-right focus:outline-none focus:bg-[#1a1a24] rounded px-1 py-0.5 transition-colors"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right text-slate-300 font-medium">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </td>
                              <td className="pr-2 py-1.5">
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
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

                {/* ── Totals summary ───────────────────────────────────────── */}
                <div className="flex justify-end">
                  <div className="w-60 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Total HT</span>
                      <span className="text-slate-300">{formatCurrency(totalHT)}</span>
                    </div>
                    {form.discount > 0 && (
                      <>
                        <div className="flex justify-between text-orange-400">
                          <span>Remise ({form.discount}%)</span>
                          <span>- {formatCurrency(remise)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1.5">
                          <span>Sous-total HT</span>
                          <span className="text-slate-300">{formatCurrency(sousTotal)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>TVA 20%</span>
                      <span className="text-slate-300">{formatCurrency(tva)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold text-base border-t border-slate-700 pt-2 mt-1">
                      <span>Total TTC</span>
                      <span className="text-[#E14B89]">{formatCurrency(totalTTC)}</span>
                    </div>
                  </div>
                </div>

                {/* ── Validité + Remise ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Valide jusqu&apos;au *</label>
                    <input
                      type="date"
                      value={form.validUntil}
                      onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Remise (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.discount}
                      onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                </div>

                {/* ── Notes internes ───────────────────────────────────────── */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Notes internes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder="Conditions, remarques..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>

              </div>

              {/* ── Right: Templates panel ────────────────────────────────── */}
              {showTemplatesPanel && (
                <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">Modèles d'articles</span>
                    <button onClick={() => setShowTemplatesPanel(false)} className="text-slate-600 hover:text-slate-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  {/* Template list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-80 lg:max-h-none">
                    {templates.length === 0 ? (
                      <p className="text-slate-600 text-xs text-center py-6">Aucun modèle</p>
                    ) : (
                      templates.map(t => (
                        editingTemplate?.id === t.id ? (
                          <form
                            key={t.id}
                            onSubmit={handleUpdateTemplate}
                            className="p-3 rounded-xl bg-[#0d0d14] border border-[#E14B89]/30 space-y-2"
                          >
                            <input
                              value={editTemplateForm.name}
                              onChange={e => setEditTemplateForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="Titre *"
                              required
                              className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                            />
                            <textarea
                              value={editTemplateForm.description}
                              onChange={e => setEditTemplateForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="Description *"
                              required
                              rows={3}
                              className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editTemplateForm.unitPrice}
                                onChange={e => setEditTemplateForm(f => ({ ...f, unitPrice: e.target.value }))}
                                placeholder="Prix HT *"
                                required
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                              />
                              <div className="relative">
                                <select
                                  value={editTemplateForm.unit}
                                  onChange={e => setEditTemplateForm(f => ({ ...f, unit: e.target.value }))}
                                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-6"
                                >
                                  <option value="">Unité</option>
                                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={savingEditTemplate}
                                className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-1.5 rounded-lg text-xs font-medium transition-opacity"
                              >
                                {savingEditTemplate ? 'Enregistrement...' : 'Enregistrer'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTemplate(null)}
                                className="px-3 py-1.5 text-slate-400 hover:text-white text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          </form>
                        ) : (
                        <div
                          key={t.id}
                          className="group flex items-start gap-2 p-3 rounded-xl bg-[#0d0d14] border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => addTemplateAsItem(t)}
                            className="flex-1 text-left"
                          >
                            <div className="text-white text-xs font-medium leading-snug">{t.name}</div>
                            {t.description && t.description !== t.name && (
                              <div className="text-slate-500 text-xs mt-0.5 line-clamp-3 whitespace-pre-wrap" dangerouslySetInnerHTML={{
                                __html: t.description
                                  .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-300">$1</strong>')
                                  .replace(/^- /gm, '• ')
                                  .replace(/\n- /g, '\n• ')
                              }} />
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[#E14B89] text-xs font-medium">{formatCurrency(t.unitPrice)}</span>
                              {t.unit && <span className="text-slate-600 text-xs">/ {t.unit}</span>}
                            </div>
                          </button>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => addTemplateAsItem(t)}
                              className="p-1 text-slate-500 hover:text-green-400 transition-colors"
                              title="Ajouter au devis"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTemplate(t)}
                              className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                              title="Modifier le modèle"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteTemplateModal(t)}
                              className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                              title="Supprimer le modèle"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        )
                      ))
                    )}
                  </div>

                  {/* New template form */}
                  <div className="border-t border-slate-800 p-3">
                    <p className="text-slate-500 text-xs mb-2 font-medium">Nouveau modèle</p>
                    <form onSubmit={handleSaveTemplate} className="space-y-2">
                      <input
                        value={newTemplate.name}
                        onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                        placeholder="Titre *"
                        required
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                      <textarea
                        value={newTemplate.description}
                        onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                        placeholder="Description * (- pour liste, **gras**)"
                        required
                        rows={3}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={newTemplate.unitPrice}
                          onChange={e => setNewTemplate(t => ({ ...t, unitPrice: e.target.value }))}
                          placeholder="Prix HT *"
                          required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                        <div className="relative">
                          <select
                            value={newTemplate.unit}
                            onChange={e => setNewTemplate(t => ({ ...t, unit: e.target.value }))}
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-6"
                          >
                            <option value="">Unité</option>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingTemplate || !newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.unitPrice}
                        className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2 rounded-lg text-xs font-medium transition-opacity flex items-center justify-center gap-1.5"
                      >
                        {savingTemplate ? (
                          <span>Enregistrement...</span>
                        ) : (
                          <>
                            <Check size={12} />
                            Enregistrer le modèle
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* ── Modal footer ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 flex-shrink-0 gap-3">
              <div className="flex items-center gap-2">
                {editingQuote && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingQuote.id)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 text-sm transition-colors px-3 py-2 rounded-xl hover:bg-red-500/5"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
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

      {/* ── Delete Template Double-Confirmation Modal ──────────────────────── */}
      {deleteTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            {deleteTemplateStep === 1 ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Supprimer le modèle ?</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Cette action est irréversible.</p>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-5">
                  Êtes-vous sûr de vouloir supprimer le modèle{' '}
                  <span className="text-white font-medium">&ldquo;{deleteTemplateModal.name}&rdquo;</span> ?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteTemplateModal(null)}
                    className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDeleteTemplate}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Oui, continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={18} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Confirmation finale</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Suppression définitive du modèle.</p>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                  Le modèle{' '}
                  <span className="text-white font-medium">&ldquo;{deleteTemplateModal.name}&rdquo;</span>{' '}
                  sera définitivement supprimé. Confirmez-vous cette action ?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteTemplateModal(null)}
                    className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDeleteTemplate}
                    disabled={deletingTemplate}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {deletingTemplate ? 'Suppression...' : 'Supprimer définitivement'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Standalone Templates Modal ──────────────────────────────────── */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTemplatesModal(false)}>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[#E14B89]" />
                <h2 className="text-white font-semibold">Modèles d&apos;articles</h2>
                <span className="text-slate-500 text-xs">({templates.length})</span>
              </div>
              <button onClick={() => setShowTemplatesModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* 2-column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Manual add form + AI */}
              <div className="w-1/2 border-r border-slate-800 flex flex-col overflow-y-auto">
                {/* Manual form (main) */}
                <div className="p-5 flex-1">
                  <p className="text-white text-sm font-medium mb-3">Ajout manuel</p>
                  <form onSubmit={handleSaveTemplate} className="space-y-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Titre *</label>
                      <input value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
                        placeholder="Ex : Création site vitrine" required
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Description * <span className="text-slate-600">(- pour liste, **gras**)</span></label>
                      <textarea value={newTemplate.description} onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                        placeholder={"- Design sur mesure responsive\n- Intégration WordPress\n- **5 pages** incluses\n- SEO de base"}
                        required rows={6}
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none leading-relaxed" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Prix HT *</label>
                        <input type="number" min={0} step="0.01" value={newTemplate.unitPrice}
                          onChange={e => setNewTemplate(t => ({ ...t, unitPrice: e.target.value }))} placeholder="0.00" required
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1.5">Unité</label>
                        <div className="relative">
                          <select value={newTemplate.unit} onChange={e => setNewTemplate(t => ({ ...t, unit: e.target.value }))}
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-8">
                            <option value="">Sélectionner</option>
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <button type="submit"
                      disabled={savingTemplate || !newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.unitPrice}
                      className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-lg text-sm font-medium transition-opacity flex items-center justify-center gap-2">
                      {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {savingTemplate ? 'Enregistrement...' : 'Enregistrer le modèle'}
                    </button>
                  </form>
                </div>

                {/* AI generation (small, bottom) */}
                <div className="border-t border-slate-800 p-4 bg-[#0d0d14]/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={12} className="text-[#E14B89]/70" />
                    <p className="text-slate-500 text-xs font-medium">Génération IA</p>
                  </div>
                  <form onSubmit={handlePromptCreate} className="flex gap-2 items-end">
                    <textarea
                      value={templatePrompt}
                      onChange={e => setTemplatePrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptCreate(e) } }}
                      placeholder="Décrivez l'article : nom, description, prix..."
                      rows={2}
                      className="flex-1 bg-[#1a1a24] border border-slate-800 rounded-lg px-3 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89]/50 transition-colors resize-none"
                    />
                    <button type="submit" disabled={promptLoading || !templatePrompt.trim()}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap">
                      {promptLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Créer
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Template list */}
              <div className="w-1/2 flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800">
                  <p className="text-slate-400 text-xs font-medium">Articles existants</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {templates.length === 0 ? (
                    <div className="text-center py-12">
                      <Package size={28} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">Aucun modèle</p>
                      <p className="text-slate-600 text-xs mt-1">Créez votre premier modèle</p>
                    </div>
                  ) : (
                    templates.map(t => (
                      editingTemplate?.id === t.id ? (
                        <form key={t.id} onSubmit={handleUpdateTemplate}
                          className="p-3 rounded-xl bg-[#0d0d14] border border-[#E14B89]/30 space-y-2">
                          <input value={editTemplateForm.name} onChange={e => setEditTemplateForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Titre *" required className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                          <textarea value={editTemplateForm.description} onChange={e => setEditTemplateForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description *" required rows={3}
                            className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" min={0} step="0.01" value={editTemplateForm.unitPrice}
                              onChange={e => setEditTemplateForm(f => ({ ...f, unitPrice: e.target.value }))}
                              placeholder="Prix HT *" required className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors" />
                            <div className="relative">
                              <select value={editTemplateForm.unit} onChange={e => setEditTemplateForm(f => ({ ...f, unit: e.target.value }))}
                                className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-6">
                                <option value="">Unité</option>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" disabled={savingEditTemplate}
                              className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-40 text-white py-2 rounded-lg text-xs font-medium transition-opacity">
                              {savingEditTemplate ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button type="button" onClick={() => setEditingTemplate(null)}
                              className="px-3 py-2 text-slate-400 hover:text-white text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                              Annuler
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div key={t.id} className="group flex items-start gap-3 p-3 rounded-xl bg-[#0d0d14] border border-slate-800 hover:border-slate-700 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium">{t.name}</div>
                            {t.description && t.description !== t.name && (
                              <div className="text-slate-500 text-xs mt-1 whitespace-pre-wrap line-clamp-3" dangerouslySetInnerHTML={{
                                __html: t.description
                                  .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-300">$1</strong>')
                                  .replace(/^- /gm, '• ')
                                  .replace(/\n- /g, '\n• ')
                              }} />
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[#E14B89] text-sm font-medium">{formatCurrency(t.unitPrice)}</span>
                              {t.unit && <span className="text-slate-600 text-xs">/ {t.unit}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button type="button" onClick={() => openEditTemplate(t)}
                              className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors rounded-lg hover:bg-slate-800" title="Modifier">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => openDeleteTemplateModal(t)}
                              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800" title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Template Confirmation ──────────────────────────────────── */}
      {deleteTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-2">Supprimer le modèle</h3>
            <p className="text-slate-400 text-sm mb-4">
              {deleteTemplateStep === 1
                ? `Voulez-vous supprimer "${deleteTemplateModal.name}" ?`
                : `Confirmez la suppression de "${deleteTemplateModal.name}" ?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTemplateModal(null)}
                className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                Annuler
              </button>
              <button onClick={confirmDeleteTemplate} disabled={deletingTemplate}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                {deletingTemplate ? 'Suppression...' : deleteTemplateStep === 1 ? 'Supprimer' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Signature Modal ─────────────────────────────────────────────── */}
      {signatureModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#E14B89]/10 flex items-center justify-center flex-shrink-0">
                <Send size={18} className="text-[#E14B89]" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Envoyer pour signature</h3>
                <p className="text-slate-500 text-xs mt-0.5">Devis {signatureModal.number}</p>
              </div>
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
            ) : signatureSending && !signatureResult?.error ? (
              <div className="text-center py-8">
                <Loader2 size={28} className="animate-spin text-[#E14B89] mx-auto mb-3" />
                <p className="text-white font-medium">Envoi en cours...</p>
                <p className="text-slate-500 text-xs mt-2">Envoi du devis à {signatureForm.email}<br/>depuis {signatureForm.senderEmail}</p>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-sm mb-4">Complétez les informations du signataire :</p>
                <div className="space-y-3 mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Prénom *</label>
                      <input
                        value={signatureForm.firstName}
                        onChange={e => setSignatureForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="Jean"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom *</label>
                      <input
                        value={signatureForm.lastName}
                        onChange={e => setSignatureForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Dupont"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Email du client *</label>
                    <input
                      type="email"
                      value={signatureForm.email}
                      onChange={e => setSignatureForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="client@exemple.fr"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Expéditeur</label>
                    <select
                      value={signatureForm.senderEmail}
                      onChange={e => setSignatureForm(f => ({ ...f, senderEmail: e.target.value }))}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    >
                      {SENDER_EMAILS.map(s => (
                        <option key={s.email} value={s.email}>{s.label} ({s.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {signatureResult?.error && (
                  <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-xs">{signatureResult.error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setSignatureModal(null)}
                    className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSignatureSend}
                    disabled={signatureSending}
                    className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-opacity flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    Envoyer
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
