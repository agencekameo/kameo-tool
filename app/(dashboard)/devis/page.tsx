'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, Pencil, Eye, Printer, X, ChevronDown, FileText, Check,
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
  status: 'BROUILLON' | 'ENVOYE' | 'ACCEPTE' | 'REFUSE' | 'EXPIRE'
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Quote['status'], string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EXPIRE: 'Expiré',
}

const STATUS_COLORS: Record<Quote['status'], string> = {
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

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      {/* Screen-only controls */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#E14B89] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
        >
          <Printer size={16} />
          Imprimer / Enregistrer PDF
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

        {/* Header: Agency left, Devis info right */}
        <div className="flex items-start justify-between mb-10 pb-8 border-b-[3px]" style={{ borderColor: '#F8903C' }}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kameo-logo-light.svg" alt="Kameo" className="h-9 mb-2" />
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: '#E14B89' }}>
              Agence Kameo
            </div>
            <div className="text-xs text-gray-500 mt-2 leading-relaxed">
              <div>9 rue des colonnes, Paris 75002</div>
              <div>Tél : 06 76 23 00 37 — contact@agencekameo.fr</div>
              <div className="mt-1.5 text-gray-400 text-[10px]">
                SIRET : 980 573 984 00013 &nbsp;|&nbsp; APE : 62.01Z<br />
                TVA Intracommunautaire : FR54980573984<br />
                RCS Paris 980 573 984
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black tracking-tight text-gray-800 uppercase">Devis</div>
            <div className="text-lg font-bold mt-1" style={{ color: '#E14B89' }}>N° {quote.number}</div>
            <div className="text-sm text-gray-500 mt-2 space-y-0.5">
              <div>Émis le : {today}</div>
              {quote.validUntil && (
                <div>Valide jusqu&apos;au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</div>
              )}
            </div>
            <div className="mt-3">
              <span className="text-xs px-3 py-1 rounded font-semibold border"
                style={{ borderColor: '#F8903C', color: '#E14B89', background: 'rgba(248,144,60,0.06)' }}>
                {STATUS_LABELS[quote.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Client block */}
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-bold">À l&apos;attention de</div>
          <div className="border border-gray-200 rounded-lg px-5 py-4 inline-block min-w-[220px]">
            <div className="font-bold text-gray-900 text-base">{quote.clientName}</div>
            {quote.clientEmail && <div className="text-sm text-gray-600 mt-1">{quote.clientEmail}</div>}
            {quote.clientAddress && (
              <div className="text-sm text-gray-600 mt-1 whitespace-pre-line">{quote.clientAddress}</div>
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

function emptyForm() {
  return {
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    subject: '',
    status: 'BROUILLON' as Quote['status'],
    validUntil: '',
    notes: '',
    discount: 0,
    items: [] as QuoteItem[],
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevisPage() {
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

  // New template form
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', unitPrice: '', unit: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Delete template double-confirmation
  const [deleteTemplateModal, setDeleteTemplateModal] = useState<{ id: string; name: string } | null>(null)
  const [deleteTemplateStep, setDeleteTemplateStep] = useState<1 | 2>(1)
  const [deletingTemplate, setDeletingTemplate] = useState(false)

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
    })
    setShowTemplatesPanel(false)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingQuote(null)
    setForm(emptyForm())
    setShowTemplatesPanel(false)
  }

  // ── Client dropdown change ─────────────────────────────────────────────────

  function handleClientChange(val: string) {
    if (val === '__other__') {
      setUseOtherClient(true)
      setForm(f => ({ ...f, clientId: '', clientName: '', clientEmail: '', clientAddress: '' }))
    } else {
      setUseOtherClient(false)
      const found = clients.find(c => c.id === val)
      setForm(f => ({ ...f, clientId: val, clientName: found?.name || '' }))
    }
  }

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
    if (!form.clientName.trim()) { alert('Veuillez renseigner un nom de client.'); return }
    if (!form.subject.trim()) { alert('Veuillez renseigner un objet.'); return }

    setSaving(true)
    try {
      const payload = {
        clientId: form.clientId || undefined,
        clientName: form.clientName,
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

  // ── Totals ─────────────────────────────────────────────────────────────────

  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(form.items, form.discount)

  // ── Build preview quote object ─────────────────────────────────────────────

  function buildPreviewQuote(): Quote {
    return {
      id: editingQuote?.id || '',
      number: editingQuote?.number || 'APERÇU',
      clientId: form.clientId || undefined,
      clientName: form.clientName,
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
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity"
        >
          <Plus size={16} />
          Nouveau devis
        </button>
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

                {/* Client selection */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">Client</label>
                  <div className="relative">
                    <select
                      value={useOtherClient ? '__other__' : (form.clientId || '')}
                      onChange={e => handleClientChange(e.target.value)}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-9"
                    >
                      <option value="">— Sélectionner un client —</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="__other__">Autre (saisie manuelle)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Manual client fields */}
                {useOtherClient && (
                  <div className="space-y-3 p-4 bg-[#0d0d14] rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom du client *</label>
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
                        <label className="block text-slate-400 text-xs mb-1.5">Adresse</label>
                        <input
                          value={form.clientAddress}
                          onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))}
                          className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                        />
                      </div>
                    </div>
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
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">Valide jusqu&apos;au</label>
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
                              <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{t.description}</div>
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
                              onClick={() => openDeleteTemplateModal(t)}
                              className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                              title="Supprimer le modèle"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
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
                      <input
                        value={newTemplate.description}
                        onChange={e => setNewTemplate(t => ({ ...t, description: e.target.value }))}
                        placeholder="Description *"
                        required
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:border-[#E14B89] transition-colors"
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
                <button
                  type="button"
                  onClick={() => setPrintQuote(buildPreviewQuote())}
                  className="flex items-center gap-1.5 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Printer size={14} />
                  Aperçu / Imprimer
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
    </div>
  )
}
