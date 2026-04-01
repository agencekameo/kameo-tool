'use client'

import { useState, useEffect } from 'react'
import { Send, Mail, User, FileText, AlertCircle, CheckCircle2, Loader2, ChevronDown } from 'lucide-react'

const SENDER_ACCOUNTS = [
  { id: 'benjamin', label: 'Benjamin Dayan', email: 'benjamin.dayan@agence-kameo.fr' },
  { id: 'kameo', label: 'Agence Kameo', email: 'contact@agence-kameo.fr' },
  { id: 'louison', label: 'Louison', email: 'louison@agence-kameo.fr' },
]

export default function EmailPage() {
  const [form, setForm] = useState({ to: '', subject: '', body: '', senderId: 'kameo' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Reset result after 5s
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => setResult(null), 5000)
    return () => clearTimeout(t)
  }, [result])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)
    const sender = SENDER_ACCOUNTS.find(a => a.id === form.senderId)
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: form.to,
        subject: form.subject,
        body: form.body,
        senderId: form.senderId,
        senderName: sender?.label || 'Agence Kameo',
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ ok: true, msg: `Email envoyé à ${form.to} depuis ${sender?.email}` })
      setForm(prev => ({ ...prev, to: '', subject: '', body: '' }))
    } else {
      setResult({ ok: false, msg: data.error || 'Erreur lors de l\'envoi' })
    }
    setSending(false)
  }

  const selectedSender = SENDER_ACCOUNTS.find(a => a.id === form.senderId)

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Composer un email</h1>
        <p className="text-slate-400 text-sm mt-1">Envoi depuis les comptes Gmail configurés</p>
      </div>

      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <form onSubmit={handleSend} className="space-y-4">
          {/* Expéditeur */}
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <Send size={12} /> Expéditeur
            </label>
            <div className="relative">
              <select
                value={form.senderId}
                onChange={e => setForm({ ...form, senderId: e.target.value })}
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors appearance-none pr-10"
              >
                {SENDER_ACCOUNTS.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.label} ({account.email})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            {selectedSender && (
              <p className="text-slate-500 text-[11px] mt-1">
                L&apos;email sera envoyé depuis {selectedSender.email}
              </p>
            )}
          </div>

          {/* Destinataire */}
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <User size={12} /> Destinataire
            </label>
            <input
              type="email" required
              value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}
              placeholder="client@exemple.fr"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>

          {/* Objet */}
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <FileText size={12} /> Objet
            </label>
            <input
              required
              value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Objet de l'email"
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors"
            />
          </div>

          {/* Message */}
          <div>
            <label className="flex items-center gap-2 text-slate-400 text-xs mb-1.5">
              <Mail size={12} /> Message
            </label>
            <textarea
              required rows={10}
              value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="Rédigez votre message ici..."
              className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
            />
          </div>

          {result && (
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm ${result.ok ? 'bg-green-400/10 border-green-400/20 text-green-400' : 'bg-red-400/10 border-red-400/20 text-red-400'}`}>
              {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {result.msg}
            </div>
          )}

          <button
            type="submit" disabled={sending}
            className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {sending ? <><Loader2 size={15} className="animate-spin" /> Envoi en cours...</> : <><Send size={15} /> Envoyer</>}
          </button>
        </form>
      </div>
    </div>
  )
}
