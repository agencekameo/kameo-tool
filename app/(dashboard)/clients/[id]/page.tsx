'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft, Mail, Phone, Globe, Building2, FileText, Plus, Trash2,
  Wrench, X, AlertTriangle, FolderKanban,
} from 'lucide-react'
import {
  formatCurrency, formatDate,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS,
  PROJECT_TYPE_LABELS, PROJECT_TYPE_COLORS,
  MAINTENANCE_LABELS,
} from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  status: string
}

interface Project {
  id: string
  name: string
  type: string
  status: string
  price?: number
  deadline?: string
  tasks: Task[]
}

interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  website?: string
  address?: string
  notes?: string
  maintenancePlan: string
  maintenancePrice?: number
  projects: Project[]
}

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  unit: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAINTENANCE_COLORS: Record<string, string> = {
  NONE: 'bg-slate-800 text-slate-400',
  HEBERGEMENT: 'bg-slate-500/15 text-slate-300',
  CLASSIQUE: 'bg-teal-500/15 text-teal-400',
  CONTENU: 'bg-blue-500/15 text-blue-400',
  SEO: 'bg-[#E14B89]/10 text-[#E14B89]',
}

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: 'Brouillon',
  ENVOYE: 'Envoyé',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  EXPIRE: 'Expiré',
}

const UNITS = ['forfait', 'jour', 'heure']

function genTempId() {
  return `tmp_${Math.random().toString(36).slice(2)}`
}

function taskProgress(tasks: Task[]): number | null {
  if (!tasks.length) return null
  return Math.round((tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100)
}

function calcTotals(items: QuoteItem[], discount: number) {
  const totalHT = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const remise = totalHT * discount / 100
  const sousTotal = totalHT - remise
  const tva = sousTotal * 0.20
  const totalTTC = sousTotal + tva
  return { totalHT, remise, sousTotal, tva, totalTTC }
}

// ─── Quote Modal ───────────────────────────────────────────────────────────────

interface QuoteModalProps {
  client: Client
  onClose: () => void
  onSuccess: () => void
}

function QuoteModal({ client, onClose, onSuccess }: QuoteModalProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    status: 'BROUILLON',
    validUntil: '',
    notes: '',
    discount: 0,
    items: [{ id: genTempId(), description: '', quantity: 1, unitPrice: 0, unit: 'forfait' }] as QuoteItem[],
  })

  const { totalHT, remise, sousTotal, tva, totalTTC } = calcTotals(form.items, form.discount)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim()) return
    setSaving(true)
    try {
      const payload = {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email || undefined,
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
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onSuccess()
        router.push('/devis')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Nouveau devis</h2>
            <p className="text-slate-400 text-sm mt-0.5">Pour {client.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Objet *</label>
              <input
                required
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Ex : Création site web vitrine"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>

            {/* Status + ValidUntil */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Valide jusqu&apos;au</label>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Informations complémentaires..."
                rows={2}
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
              />
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-xs">Prestations</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <Plus size={12} />
                  Ajouter une ligne
                </button>
              </div>

              <div className="space-y-2">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_80px_100px_90px_32px] gap-2 px-1">
                  <span className="text-slate-600 text-xs">Description</span>
                  <span className="text-slate-600 text-xs">Qté</span>
                  <span className="text-slate-600 text-xs">Prix HT</span>
                  <span className="text-slate-600 text-xs">Unité</span>
                  <span />
                </div>

                {form.items.map(item => (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_100px_90px_32px] gap-2 items-center">
                    <input
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Description de la prestation"
                      className="bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors text-center"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                    <select
                      value={item.unit}
                      onChange={e => updateItem(item.id, 'unit', e.target.value)}
                      className="bg-[#1a1a24] border border-slate-700 rounded-xl px-2 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {form.items.length === 0 && (
                  <div className="text-center py-4 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                    Aucune prestation. Cliquez sur &quot;Ajouter une ligne&quot;.
                  </div>
                )}
              </div>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-3">
              <label className="text-slate-400 text-xs whitespace-nowrap">Remise (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.discount}
                onChange={e => setForm(f => ({ ...f, discount: parseFloat(e.target.value) || 0 }))}
                className="w-24 bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>

            {/* Totals */}
            <div className="bg-[#0d0d14] border border-slate-800 rounded-xl p-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Total HT</span>
                  <span className="text-white">{formatCurrency(totalHT)}</span>
                </div>
                {form.discount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>Remise ({form.discount}%)</span>
                      <span className="text-orange-400">- {formatCurrency(remise)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Sous-total HT</span>
                      <span className="text-white">{formatCurrency(sousTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>TVA 20%</span>
                  <span className="text-white">{formatCurrency(tva)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-slate-800 mt-2">
                  <span className="text-white">Total TTC</span>
                  <span className="text-[#E14B89]">{formatCurrency(totalTTC)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Création...' : 'Créer le devis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Project Modal ─────────────────────────────────────────────────────────────

const PROJECT_TYPES = ['WORDPRESS', 'FRAMER', 'CUSTOM', 'ECOMMERCE']
const PROJECT_STATUSES = ['BRIEF', 'REDACTION', 'MAQUETTE', 'DEVELOPPEMENT', 'REVIEW', 'LIVRAISON', 'MAINTENANCE']
const SERVICES = ['SEO', 'Google Ads', 'Meta Ads', 'Réseaux sociaux', 'Identité visuelle', 'Google Business', 'Rédaction', 'Maintenance']

interface ProjectModalProps {
  clientId: string
  clientName: string
  onClose: () => void
  onSuccess: (project: Project) => void
}

function ProjectModal({ clientId, clientName, onClose, onSuccess }: ProjectModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    type: 'WORDPRESS',
    status: 'BRIEF',
    price: '',
    deadline: '',
    notes: '',
    services: [] as string[],
  })

  function toggleService(s: string) {
    setForm(f => ({ ...f, services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clientId,
          price: form.price ? parseFloat(form.price) : null,
          deadline: form.deadline || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Erreur lors de la création')
        return
      }
      const project = await res.json()
      onSuccess(project)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Nouveau projet</h2>
            <p className="text-slate-400 text-sm mt-0.5">Pour {clientName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Nom du projet *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex : Site vitrine restaurant La Bella"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
              />
            </div>

            {/* Technologie + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Technologie</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  {PROJECT_TYPES.map(t => (
                    <option key={t} value={t}>{PROJECT_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Statut</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                >
                  {PROJECT_STATUSES.map(s => (
                    <option key={s} value={s}>{PROJECT_STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price + Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Prix HT (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1.5">Date de livraison</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>
            </div>

            {/* Services */}
            <div>
              <label className="block text-slate-400 text-xs mb-2">Services inclus</label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.services.includes(s)
                        ? 'bg-[#E14B89]/15 border-[#E14B89]/40 text-[#E14B89]'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Informations complémentaires..."
                rows={3}
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>

          <div className="flex gap-3 p-6 border-t border-slate-800 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#E14B89] hover:opacity-90 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

interface DeleteModalProps {
  clientName: string
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
}

function DeleteModal({ clientName, onCancel, onConfirm, deleting }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const isValid = confirmText === clientName

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111118] border border-red-500/30 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold">Supprimer le client</h2>
            <p className="text-slate-400 text-sm mt-0.5">Cette action est irréversible</p>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Cette action est irréversible. Tous les projets de ce client seront également supprimés.
        </p>

        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-red-400 text-xs mb-2">
            Tapez <strong className="text-red-300">{clientName}</strong> pour confirmer la suppression
          </p>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={clientName}
            className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isValid || deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {deleting ? 'Suppression...' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN'

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/clients/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setClient)
      .catch(() => router.push('/clients'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      router.push('/clients')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="h-4 w-16 bg-slate-800 rounded-lg" />
          <div className="flex gap-3">
            <div className="h-10 w-36 bg-slate-800 rounded-xl" />
            <div className="h-10 w-36 bg-slate-800 rounded-xl" />
          </div>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 bg-slate-800 rounded-lg" />
              <div className="h-4 w-32 bg-slate-800 rounded-lg" />
              <div className="flex gap-4 mt-4">
                <div className="h-4 w-40 bg-slate-800 rounded-lg" />
                <div className="h-4 w-28 bg-slate-800 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="h-5 w-48 bg-slate-800 rounded-lg mb-2" />
              <div className="h-3 w-32 bg-slate-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!client) return null

  return (
    <div className="p-8 max-w-5xl">
      {/* Top bar: back link + action buttons */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/clients"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Retour
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <FolderKanban size={16} />
            Nouveau projet
          </button>
          <button
            onClick={() => setShowQuoteModal(true)}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <FileText size={16} />
            Nouveau devis
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:border-red-500/60 hover:text-red-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 size={16} />
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Client header card */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-700/20 border border-[#E14B89]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#E14B89] font-bold text-xl">{client.name[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-white">{client.name}</h1>
                {client.company && (
                  <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5">
                    <Building2 size={13} />
                    {client.company}
                  </p>
                )}
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 flex-shrink-0 ${MAINTENANCE_COLORS[client.maintenancePlan]}`}>
                {client.maintenancePlan !== 'NONE' && <Wrench size={11} />}
                {MAINTENANCE_LABELS[client.maintenancePlan]}
                {client.maintenancePrice != null && client.maintenancePlan !== 'NONE' && (
                  <span className="ml-1 opacity-70">— {formatCurrency(client.maintenancePrice)}/mois</span>
                )}
              </span>
            </div>

            {/* Contact info */}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  <Mail size={14} />
                  {client.email}
                </a>
              )}
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  <Phone size={14} />
                  {client.phone}
                </a>
              )}
              {client.website && (
                <a
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  <Globe size={14} />
                  {client.website}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="mt-5 pt-5 border-t border-slate-800">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Notes</p>
            <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Projects section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">
            Projets{' '}
            <span className="text-slate-500 font-normal text-sm ml-1">
              {client.projects.length}
            </span>
          </h2>
          <button
            onClick={() => setShowProjectModal(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <Plus size={15} />
            Ajouter
          </button>
        </div>

        {client.projects.length === 0 ? (
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-10 text-center">
            <p className="text-slate-500 text-sm">Aucun projet pour ce client</p>
          </div>
        ) : (
          <div className="space-y-3">
            {client.projects.map(project => {
              const progress = taskProgress(project.tasks)
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block bg-[#111118] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-white font-medium truncate group-hover:text-[#E14B89] transition-colors">{project.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_TYPE_COLORS[project.type] || 'bg-slate-800 text-slate-400'}`}>
                          {PROJECT_TYPE_LABELS[project.type] || project.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_COLORS[project.status] || 'bg-slate-800 text-slate-400'}`}>
                          {PROJECT_STATUS_LABELS[project.status] || project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        {project.deadline && (
                          <span className="text-slate-500 text-xs">
                            Livraison : {formatDate(project.deadline)}
                          </span>
                        )}
                        {project.price != null && (
                          <span className="text-slate-500 text-xs">
                            {formatCurrency(project.price)}
                          </span>
                        )}
                        {project.tasks.length > 0 && (
                          <span className="text-slate-500 text-xs">
                            {project.tasks.filter(t => t.status === 'DONE').length}/{project.tasks.length} tâches
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Task progress bar */}
                  {progress !== null && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-slate-500 text-xs">Avancement</span>
                        <span className="text-slate-400 text-xs font-medium">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E14B89] rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <ProjectModal
          clientId={client.id}
          clientName={client.name}
          onClose={() => setShowProjectModal(false)}
          onSuccess={(project) => {
            setClient(c => c ? { ...c, projects: [project, ...c.projects] } : c)
            setShowProjectModal(false)
          }}
        />
      )}

      {/* Quote Modal */}
      {showQuoteModal && (
        <QuoteModal
          client={client}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => setShowQuoteModal(false)}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteModal
          clientName={client.name}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  )
}
