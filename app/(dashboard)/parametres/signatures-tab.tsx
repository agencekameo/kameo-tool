'use client'

import { useState, useEffect } from 'react'
import { PenTool, Plus, Trash2, Copy, Check, Eye, X, Loader2, Save } from 'lucide-react'

interface Signature {
  id: string
  name: string
  fullName: string
  role: string
  company: string
  phone: string
  email: string
  website: string
  photoUrl: string
  logoUrl: string
}

// Hardcoded photo URLs — always used for default signatures regardless of DB
const DEFAULT_PHOTOS: Record<string, string> = {
  benjamin: '/benjamin-dayan.png',
  louison: '/louison-boutet.png',
  jonathan: '/jonathan-derai.png',
}

function resolvePhotoUrl(sig: Signature): string {
  return DEFAULT_PHOTOS[sig.id] || sig.photoUrl
}

const DEFAULT_SIGNATURES: Signature[] = [
  {
    id: 'benjamin',
    name: 'Benjamin',
    fullName: 'Benjamin Dayan',
    role: 'Directeur commercial',
    company: 'Agence Kameo',
    phone: '06 62 37 99 85',
    email: 'contact@agence-kameo.fr',
    website: 'www.agence-kameo.fr',
    photoUrl: '/benjamin-dayan.png',
    logoUrl: '/kameo-logo-light.png',
  },
  {
    id: 'louison',
    name: 'Louison',
    fullName: 'Louison Boutet',
    role: 'Directeur Général',
    company: 'Agence Kameo',
    phone: '06 14 17 06 24',
    email: 'louison.boutet@agence-kameo.fr',
    website: 'www.agence-kameo.fr',
    photoUrl: '/louison-boutet.png',
    logoUrl: '/kameo-logo-light.png',
  },
  {
    id: 'jonathan',
    name: 'Jonathan',
    fullName: 'Jonathan Derai',
    role: 'Commercial',
    company: 'Agence Kameo',
    phone: '07 66 63 66 96',
    email: 'derai.jonathan@agence-kameo.fr',
    website: 'www.agence-kameo.fr',
    photoUrl: '/jonathan-derai.png',
    logoUrl: '/kameo-logo-light.png',
  },
]

function signatureToHtml(sig: Signature, baseUrl: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #eee;padding-top:24px;">
<tr>
<td style="padding-right:40px;vertical-align:top;width:90px;">
<img src="${baseUrl}${resolvePhotoUrl(sig)}" alt="${sig.fullName}" width="56" height="56" style="border-radius:50%;display:block;width:56px;height:56px;" />
<div style="height:20px;"></div>
<img src="${baseUrl}${sig.logoUrl}" alt="${sig.company}" width="80" style="border-radius:8px;display:block;width:80px;object-fit:contain;" />
</td>
<td style="vertical-align:top;padding-left:16px;">
<p style="margin:0;font-size:14px;font-weight:600;color:#1a1a2e;">${sig.fullName}</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">${sig.role}</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">${sig.company}</p>
<p style="margin:14px 0 0;font-size:12px;">
<a href="tel:+33${sig.phone.replace(/\s/g, '').replace(/^0/, '')}" style="color:#666;text-decoration:none;">${sig.phone}</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="mailto:${sig.email}" style="color:#666;text-decoration:none;">${sig.email}</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="https://${sig.website}" target="_blank" style="color:#E14B89;text-decoration:none;font-weight:500;">${sig.website}</a>
</p>
</td>
</tr>
</table>`
}

export default function SignaturesTab() {
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Signature | null>(null)
  const [editForm, setEditForm] = useState<Signature | null>(null)
  const [preview, setPreview] = useState<Signature | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?key=email_signatures')
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          try {
            const saved: Signature[] = JSON.parse(data.value)
            // Merge defaults into saved: add missing sigs, fix photoUrl/logoUrl for defaults
            let needsSave = false
            const merged = DEFAULT_SIGNATURES.map(def => {
              const existing = saved.find(s => s.id === def.id)
              if (existing) {
                // Always force correct photoUrl and logoUrl for default signatures
                if (existing.photoUrl !== def.photoUrl || existing.logoUrl !== def.logoUrl) {
                  needsSave = true
                  return { ...existing, photoUrl: def.photoUrl, logoUrl: def.logoUrl }
                }
                return existing
              }
              needsSave = true
              return def
            })
            const extraSaved = saved.filter(s => !DEFAULT_SIGNATURES.find(d => d.id === s.id))
            const final = [...merged, ...extraSaved]
            setSignatures(final)
            // Auto-save if we added missing signatures
            if (needsSave) {
              fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'email_signatures', value: JSON.stringify(final) }),
              })
            }
          } catch {
            setSignatures(DEFAULT_SIGNATURES)
          }
        } else {
          setSignatures(DEFAULT_SIGNATURES)
        }
      })
      .catch(() => setSignatures(DEFAULT_SIGNATURES))
      .finally(() => setLoading(false))
  }, [])

  async function saveSignatures(sigs: Signature[]) {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'email_signatures', value: JSON.stringify(sigs) }),
      })
      setSignatures(sigs)
    } finally {
      setSaving(false)
    }
  }

  function handleAdd() {
    const newSig: Signature = {
      id: `sig_${Date.now()}`,
      name: '',
      fullName: '',
      role: '',
      company: 'Agence Kameo',
      phone: '',
      email: '',
      website: 'www.agence-kameo.fr',
      photoUrl: '/benjamin-dayan.png',
      logoUrl: '/kameo-logo-light.png',
    }
    setEditing(newSig)
    setEditForm(newSig)
  }

  function handleEdit(sig: Signature) {
    setEditing(sig)
    setEditForm({ ...sig })
  }

  async function handleSave() {
    if (!editForm) return
    const exists = signatures.find(s => s.id === editForm.id)
    const updated = exists
      ? signatures.map(s => s.id === editForm.id ? editForm : s)
      : [...signatures, editForm]
    await saveSignatures(updated)
    setEditing(null)
    setEditForm(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette signature ?')) return
    await saveSignatures(signatures.filter(s => s.id !== id))
  }

  function handleCopyHtml(sig: Signature) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(signatureToHtml(sig, baseUrl))
    setCopied(sig.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) return <div className="p-8 text-slate-500 text-sm">Chargement...</div>

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          Signatures email utilisées dans les mails automatiques (partenaires, devis, contrats...).
        </p>
        <button onClick={handleAdd}
          className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0">
          <Plus size={14} /> Nouvelle signature
        </button>
      </div>

      {/* Signatures list */}
      <div className="space-y-3">
        {signatures.map(sig => (
          <div key={sig.id} className="bg-[#111118] border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white font-medium">{sig.fullName || 'Sans nom'}</p>
                <p className="text-slate-500 text-xs">{sig.role} · {sig.company}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(sig)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Aperçu">
                  <Eye size={14} />
                </button>
                <button onClick={() => handleCopyHtml(sig)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Copier HTML">
                  {copied === sig.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
                <button onClick={() => handleEdit(sig)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Modifier">
                  <PenTool size={14} />
                </button>
                <button onClick={() => handleDelete(sig.id)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Mini preview */}
            <div className="bg-white rounded-lg p-4 overflow-hidden">
              <div className="flex items-start gap-8">
                <div className="flex flex-col items-center gap-4 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${resolvePhotoUrl(sig)}?v=2`} alt={sig.fullName} className="w-12 h-12 rounded-full object-cover" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sig.logoUrl} alt={sig.company} className="w-16 rounded-lg object-contain" />
                </div>
                <div>
                  <p className="text-gray-900 text-sm font-semibold">{sig.fullName}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">{sig.role}</p>
                  <p className="text-gray-500 text-[11px]">{sig.company}</p>
                  <p className="text-gray-500 text-[11px] mt-2.5">{sig.phone}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">{sig.email}</p>
                  <p className="text-[11px] mt-0.5 bg-gradient-to-r from-[#E14B89] to-[#F8903C] bg-clip-text text-transparent font-medium">{sig.website}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {signatures.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            Aucune signature configurée
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && editForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setEditing(null); setEditForm(null) }} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={18} /></button>
            <div className="p-6">
              <h2 className="text-white font-semibold text-lg mb-4">{signatures.find(s => s.id === editForm.id) ? 'Modifier' : 'Nouvelle'} signature</h2>

              <div className="space-y-3">
                {([
                  { key: 'name', label: 'Identifiant (interne)', placeholder: 'ex: benjamin' },
                  { key: 'fullName', label: 'Nom complet', placeholder: 'ex: Benjamin Dayan' },
                  { key: 'role', label: 'Poste', placeholder: 'ex: Directeur commercial' },
                  { key: 'company', label: 'Entreprise', placeholder: 'ex: Agence Kameo' },
                  { key: 'phone', label: 'Téléphone', placeholder: 'ex: 06 62 37 99 85' },
                  { key: 'email', label: 'Email', placeholder: 'ex: contact@agence-kameo.fr' },
                  { key: 'website', label: 'Site web', placeholder: 'ex: www.agence-kameo.fr' },
                  { key: 'photoUrl', label: 'URL photo de profil', placeholder: '/benjamin-dayan.png' },
                  { key: 'logoUrl', label: 'URL logo', placeholder: '/kameo-logo-light.png' },
                ] as { key: keyof Signature; label: string; placeholder: string }[]).map(field => (
                  <div key={field.key}>
                    <label className="block text-slate-400 text-xs mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={editForm[field.key]}
                      onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E14B89]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setEditing(null); setEditForm(null) }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving || !editForm.fullName}
                  className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg relative">
            <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={18} /></button>
            <div className="p-6">
              <h2 className="text-white font-semibold text-lg mb-1">Aperçu signature</h2>
              <p className="text-slate-400 text-xs mb-4">{preview.fullName} — {preview.role}</p>
              <div className="bg-white rounded-xl p-6 overflow-auto"
                dangerouslySetInnerHTML={{ __html: signatureToHtml(preview, baseUrl) }} />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setPreview(null)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Fermer
                </button>
                <button onClick={() => { handleCopyHtml(preview); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  {copied === preview.id ? <><Check size={14} className="text-green-400" /> Copié !</> : <><Copy size={14} /> Copier le HTML</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
