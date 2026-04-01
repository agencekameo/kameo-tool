'use client'

import { useState } from 'react'
import { Send, Check, X, Loader2, Bell, Users, FileText, AlertTriangle, Eye } from 'lucide-react'

interface MailConfig {
  id: string
  name: string
  description: string
  type: 'client' | 'alerte'
  endpoint: string
  enabled: boolean
}

const MAIL_CONFIGS: MailConfig[] = [
  // ── Mails clients ──
  {
    id: 'quote_signature',
    name: 'Envoi devis pour signature',
    description: 'Email envoyé au client avec le lien pour consulter et signer le devis.',
    type: 'client',
    endpoint: '/api/quotes',
    enabled: true,
  },
  {
    id: 'contract_signature',
    name: 'Envoi contrat pour signature',
    description: 'Email envoyé au client avec le lien pour signer un contrat de prestation.',
    type: 'client',
    endpoint: '/api/contracts',
    enabled: true,
  },
  {
    id: 'mandat_signature',
    name: 'Envoi mandat pour signature',
    description: 'Email envoyé au client avec le lien pour signer un mandat de prélèvement.',
    type: 'client',
    endpoint: '/api/mandats',
    enabled: true,
  },
  {
    id: 'maintenance_invoice',
    name: 'Facture de maintenance',
    description: 'Email mensuel envoyé automatiquement aux clients avec leur facture de maintenance.',
    type: 'client',
    endpoint: '/api/cron/invoices',
    enabled: true,
  },
  {
    id: 'reset_password',
    name: 'Réinitialisation mot de passe',
    description: 'Email envoyé à l\'utilisateur avec son nouveau mot de passe.',
    type: 'client',
    endpoint: '/api/auth/reset-password',
    enabled: true,
  },
  // ── Alertes internes ──
  {
    id: 'quote_signed_alert',
    name: 'Alerte devis signé',
    description: 'Notification envoyée à contact@agence-kameo.fr quand un client signe un devis (avec montant HT).',
    type: 'alerte',
    endpoint: '/api/signature',
    enabled: true,
  },
  {
    id: 'form_complete_alert',
    name: 'Alerte formulaire projet complet',
    description: 'Notification interne quand un client a rempli les 4 catégories du formulaire projet.',
    type: 'alerte',
    endpoint: '/api/formulaire',
    enabled: true,
  },
  {
    id: 'generic_email',
    name: 'Envoi email générique',
    description: 'Emails manuels envoyés depuis la page Email (contacter un client, un prospect, etc.).',
    type: 'client',
    endpoint: '/api/email/send',
    enabled: true,
  },
]

function getTestEmailHtml(config: MailConfig) {
  return `<div style="font-family:Arial,sans-serif;max-width:500px;">
    <div style="height:4px;background:linear-gradient(135deg,#E14B89,#F8903C);border-radius:4px;margin-bottom:24px;"></div>
    <h2 style="color:#1a1a2e;margin:0 0 16px;">Test — ${config.name}</h2>
    <p style="color:#444;margin:0 0 8px;">Ceci est un email de test pour vérifier le bon fonctionnement de :</p>
    <div style="background:#f8f9fa;border-left:4px solid #F8903C;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="font-weight:600;color:#1a1a2e;margin:0;">${config.name}</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0;">${config.description}</p>
    </div>
    <p style="color:#888;font-size:12px;margin:24px 0 0;">Type : ${config.type === 'client' ? 'Email client' : 'Alerte interne'}</p>
    <p style="color:#aaa;font-size:11px;margin:8px 0 0;">Agence Kameo — kameo-tool.vercel.app</p>
  </div>`
}

export default function MailsTab() {
  const [configs, setConfigs] = useState(MAIL_CONFIGS)
  const [sending, setSending] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const [previewConfig, setPreviewConfig] = useState<MailConfig | null>(null)

  function toggleMail(id: string) {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))
  }

  async function sendTest(config: MailConfig) {
    setSending(config.id)
    setResult(null)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'contact@agence-kameo.fr',
          subject: `[TEST] ${config.name}`,
          rawHtml: getTestEmailHtml(config),
        }),
      })
      if (res.ok) {
        setResult({ id: config.id, success: true, message: 'Email de test envoyé !' })
      } else {
        const data = await res.json().catch(() => ({}))
        setResult({ id: config.id, success: false, message: data.error || 'Erreur lors de l\'envoi' })
      }
    } catch {
      setResult({ id: config.id, success: false, message: 'Erreur réseau' })
    } finally {
      setSending(null)
    }
  }

  const clientMails = configs.filter(c => c.type === 'client')
  const alertMails = configs.filter(c => c.type === 'alerte')

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div>
        <p className="text-slate-400 text-sm">
          Liste de tous les emails configurés dans l&apos;application. Vous pouvez prévisualiser ou envoyer un email de test à contact@agence-kameo.fr.
        </p>
      </div>

      {/* Mails clients */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-blue-400" />
          <h2 className="text-white font-semibold text-sm">Emails clients</h2>
          <span className="text-slate-600 text-xs">({clientMails.length})</span>
        </div>
        <div className="space-y-2">
          {clientMails.map(config => (
            <MailCard key={config.id} config={config} sending={sending} result={result}
              onToggle={toggleMail} onTest={sendTest} onPreview={setPreviewConfig} />
          ))}
        </div>
      </div>

      {/* Alertes internes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} className="text-amber-400" />
          <h2 className="text-white font-semibold text-sm">Alertes internes</h2>
          <span className="text-slate-600 text-xs">({alertMails.length})</span>
        </div>
        <div className="space-y-2">
          {alertMails.map(config => (
            <MailCard key={config.id} config={config} sending={sending} result={result}
              onToggle={toggleMail} onTest={sendTest} onPreview={setPreviewConfig} />
          ))}
        </div>
      </div>

      {/* Preview modal */}
      {previewConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg relative">
            <button onClick={() => setPreviewConfig(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={18} /></button>
            <div className="p-6">
              <h2 className="text-white font-semibold text-lg mb-1">Aperçu</h2>
              <p className="text-slate-400 text-xs mb-4">{previewConfig.name}</p>
              <div className="bg-white rounded-xl p-6 overflow-auto max-h-[60vh]"
                dangerouslySetInnerHTML={{ __html: getTestEmailHtml(previewConfig) }} />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setPreviewConfig(null)}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                  Fermer
                </button>
                <button onClick={() => { setPreviewConfig(null); sendTest(previewConfig) }}
                  disabled={sending !== null}
                  className="flex-1 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  <Send size={14} /> Envoyer le test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MailCard({ config, sending, result, onToggle, onTest, onPreview }: {
  config: MailConfig
  sending: string | null
  result: { id: string; success: boolean; message: string } | null
  onToggle: (id: string) => void
  onTest: (config: MailConfig) => void
  onPreview: (config: MailConfig) => void
}) {
  const isSending = sending === config.id
  const hasResult = result?.id === config.id
  const Icon = config.type === 'client' ? FileText : AlertTriangle

  return (
    <div className={`bg-[#111118] border rounded-xl p-4 transition-colors ${config.enabled ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          config.type === 'client' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
        }`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white text-sm font-medium">{config.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              config.type === 'client' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {config.type === 'client' ? 'Client' : 'Interne'}
            </span>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">{config.description}</p>
          {hasResult && (
            <div className={`flex items-center gap-1.5 mt-2 text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? <Check size={12} /> : <X size={12} />}
              {result.message}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onPreview(config)}
            disabled={!config.enabled}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 transition-colors"
          >
            <Eye size={12} />
            Aperçu
          </button>
          <button
            onClick={() => onTest(config)}
            disabled={isSending || !config.enabled}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 transition-colors"
          >
            {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Test
          </button>
          <button
            onClick={() => onToggle(config.id)}
            className={`relative w-10 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'left-5' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
