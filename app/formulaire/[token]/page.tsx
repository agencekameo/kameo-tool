'use client'

import { useEffect, useState, useRef, useCallback, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2, AlertCircle, Loader2, ChevronRight,
  FileText, Send, FolderOpen, Phone, Mail,
  Palette, Scale, Upload, X, File, Image, FileSpreadsheet, FileArchive,
  Megaphone, Paintbrush, KeyRound,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormDataResponse {
  id: string
  token: string
  docsData: DocsData | null
  briefData: BriefData | null
  designData: DesignData | null
  accesData: AccesData | null
  docsCompleted: boolean
  briefCompleted: boolean
  designCompleted: boolean
  accesCompleted: boolean
  project: {
    id: string
    name: string
    type: string
    client: { name: string; company?: string }
  }
}

interface BriefData {
  // Offre
  offreResume?: string
  offreDetail?: string
  fourchettePrix?: string
  differenciation?: string
  usp?: string
  // Persona
  personaTypes?: string
  personaPeurs?: string
  parcoursAchat?: string
  // Branding
  toneOfVoice?: string
  valeurs?: string
  sujetsInterdits?: string
  termesInterdits?: string
  documentationInterne?: string
  // Contact
  contactEmail?: string
  contactPhone?: string
}

interface DesignData {
  fond?: 'clair' | 'obscur'
  formes?: 'arrondis' | 'carre'
  stylesSouhaites?: string[]
  sitesExemple?: string
  // Legacy
  styleSouhaite?: string
  contactEmail?: string
  contactPhone?: string
}

interface AccesData {
  emailPro?: string
  emailProMdp?: string
  facebook?: string
  instagram?: string
  linkedin?: string
  calendlyAcces?: string
  stripeAcces?: string
  autresAcces?: string
  // SMTP
  smtpHost?: string
  smtpPort?: string
  smtpEncryption?: 'SSL' | 'TLS' | ''
  smtpLogin?: string
  smtpPassword?: string
  smtpFromEmail?: string
  smtpFromName?: string
}

interface UploadedFile {
  name: string
  url: string
  filename: string
  size: number
}

interface DocsData {
  categories: Record<string, UploadedFile[]>
  notes?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  'Minimaliste / Épuré',
  'Moderne / Tendance',
  'Créatif / Artistique',
  'Corporate / Professionnel',
  'Luxe / Premium',
  'Fun / Coloré',
  'Tech / Digital',
]

const DOC_CATEGORIES_FORM = [
  {
    key: 'identite_visuelle',
    label: 'Identité visuelle',
    icon: Palette,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    hoverBorder: 'hover:border-pink-500/40',
    documents: [
      { name: 'Logo', description: 'Format SVG, PNG ou AI de préférence', optional: false },
      { name: 'Charte graphique', description: 'Couleurs, typographies, règles d\'utilisation', optional: true },
    ],
  },
  {
    key: 'documents_legaux',
    label: 'Documents légaux',
    icon: Scale,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/40',
    documents: [
      { name: 'Mentions légales', description: 'SIRET, adresse, responsable publication...', optional: false },
      { name: 'CGV / CGU', description: 'Conditions générales de vente ou d\'utilisation', optional: true },
      { name: 'Politique de confidentialité', description: 'RGPD, données personnelles', optional: true },
    ],
  },
  {
    key: 'contenu_client',
    label: 'Contenu',
    optional: true,
    icon: FileText,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    hoverBorder: 'hover:border-teal-500/40',
    documents: [
      { name: 'Textes du site', description: 'Contenus rédigés pour les différentes pages' },
      { name: 'Photos / Médias', description: 'Photos, vidéos, illustrations à intégrer' },
    ],
  },
  {
    key: 'autres',
    label: 'Autres documents',
    icon: FolderOpen,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/20',
    hoverBorder: 'hover:border-slate-500/40',
    documents: [
      { name: 'Autre document', description: 'Tout fichier utile au projet' },
    ],
  },
]

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return Image
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive
  if (['pdf'].includes(ext)) return FileText
  return File
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── Upload Card Component ───────────────────────────────────────────────────

function UploadCard({
  doc,
  catKey,
  token,
  files,
  onUpload,
  onRemove,
  borderColor,
  hoverBorder,
  bgColor,
}: {
  doc: { name: string; description: string; optional?: boolean }
  catKey: string
  token: string
  files: UploadedFile[]
  onUpload: (catKey: string, docName: string, file: UploadedFile) => void
  onRemove: (catKey: string, idx: number) => void
  borderColor: string
  hoverBorder: string
  bgColor: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const docFiles = files.filter(f => f.name === doc.name)
  const hasFile = docFiles.length > 0

  const handleUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('token', token)
        formData.append('category', catKey)
        formData.append('docName', doc.name)

        const res = await fetch('/api/formulaire/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        onUpload(catKey, doc.name, {
          name: doc.name,
          url: data.url,
          filename: data.filename,
          size: data.size,
        })
      }
    } catch (err) {
      console.error('Upload error:', err)
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [token, catKey, doc.name, onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }, [handleUpload])

  return (
    <div className="space-y-2">
      {/* Upload zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragOver
            ? `${borderColor} ${bgColor} scale-[1.01]`
            : hasFile
              ? `${borderColor} ${bgColor}`
              : `border-slate-700/50 hover:border-slate-600 ${hoverBorder}`
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />

        {uploading ? (
          <Loader2 size={24} className="text-[#E14B89] animate-spin" />
        ) : hasFile ? (
          <CheckCircle2 size={24} className="text-emerald-400" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#1a1a24] border border-slate-700 flex items-center justify-center">
            <Upload size={18} className="text-slate-500" />
          </div>
        )}

        <div className="text-center">
          <p className={`text-sm font-medium ${hasFile ? 'text-white' : 'text-slate-300'}`}>
            {doc.name}{doc.optional && <span className="text-slate-500 text-xs font-normal ml-1">(optionnel)</span>}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {uploading ? 'Import en cours...' : hasFile ? `${docFiles.length} fichier${docFiles.length > 1 ? 's' : ''} importé${docFiles.length > 1 ? 's' : ''}` : doc.description}
          </p>
        </div>

        {!hasFile && !uploading && (
          <span className="text-[10px] text-slate-600 mt-1">
            Cliquez ou glissez-déposez vos fichiers
          </span>
        )}
      </div>

      {/* Uploaded files list */}
      {docFiles.length > 0 && (
        <div className="space-y-1">
          {docFiles.map((f, i) => {
            const FileIcon = getFileIcon(f.filename)
            const globalIdx = files.findIndex(x => x === f)
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#1a1a24] rounded-lg group">
                <FileIcon size={14} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-300 truncate flex-1">{f.filename}</span>
                <span className="text-[10px] text-slate-600 flex-shrink-0">{formatFileSize(f.size)}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onRemove(catKey, globalIdx) }}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
          {/* Add more button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-3 py-1"
          >
            <Upload size={10} /> Ajouter un autre fichier
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FormulairePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a12] flex items-center justify-center"><Loader2 className="animate-spin text-[#E14B89]" size={32} /></div>}>
      <FormulaireContent params={params} />
    </Suspense>
  )
}

function FormulaireContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get('section') as 'docs' | 'brief' | 'design' | 'acces' | 'form' | null

  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<FormDataResponse | null>(null)
  const [error, setError] = useState('')
  const initialStep = sectionParam === 'design' ? 2 : sectionParam === 'acces' ? 3 : sectionParam === 'docs' ? 4 : 1
  const [formStep, setFormStep] = useState(initialStep) // 1=brief, 2=design, 3=acces, 4=docs
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ docs: boolean; brief: boolean; design: boolean; acces: boolean }>({ docs: false, brief: false, design: false, acces: false })

  // Docs form state
  const [docs, setDocs] = useState<DocsData>({
    categories: {
      identite_visuelle: [],
      contenu_client: [],
      documents_legaux: [],
      autres: [],
    },
    notes: '',
  })

  // Brief form state
  const [brief, setBrief] = useState<BriefData>({})

  // Design form state
  const [design, setDesign] = useState<DesignData>({})

  // Acces form state
  const [acces, setAcces] = useState<AccesData>({})

  useEffect(() => {
    fetch(`/api/formulaire/${token}`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
      .then((data: FormDataResponse) => {
        setFormData(data)
        if (data.docsData) {
          setDocs(data.docsData)
          setSubmitted(s => ({ ...s, docs: data.docsCompleted }))
        }
        if (data.briefData) {
          setBrief(data.briefData)
          setSubmitted(s => ({ ...s, brief: data.briefCompleted }))
        }
        if (data.designData) {
          setDesign(data.designData)
          setSubmitted(s => ({ ...s, design: data.designCompleted }))
        }
        if (data.accesData) {
          setAcces(data.accesData)
          setSubmitted(s => ({ ...s, acces: data.accesCompleted }))
        }
      })
      .catch(() => setError('Formulaire introuvable ou lien expiré.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSubmitDocs(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/formulaire/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docsData: docs }),
      })
      setSubmitted(s => ({ ...s, docs: true }))
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  async function handleSubmitBrief(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/formulaire/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefData: brief }),
      })
      setSubmitted(s => ({ ...s, brief: true }))
      setFormStep(2) // Auto-advance to Design
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  async function handleSubmitDesign(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/formulaire/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designData: design }),
      })
      setSubmitted(s => ({ ...s, design: true }))
      setFormStep(3) // Auto-advance to Accès
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  async function handleSubmitAcces(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch(`/api/formulaire/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accesData: acces }),
      })
      setSubmitted(s => ({ ...s, acces: true }))
      setFormStep(4) // Auto-advance to Documents
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  const handleFileUpload = useCallback((catKey: string, _docName: string, file: UploadedFile) => {
    setDocs(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: [...(prev.categories[catKey] || []), file],
      },
    }))
  }, [])

  const handleFileRemove = useCallback((catKey: string, idx: number) => {
    setDocs(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catKey]: prev.categories[catKey].filter((_, i) => i !== idx),
      },
    }))
  }, [])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#E14B89]" size={32} />
    </div>
  )

  if (error || !formData) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-6">
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 max-w-md text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-white font-semibold text-lg mb-2">Erreur</h1>
        <p className="text-slate-400 text-sm">{error || 'Formulaire introuvable.'}</p>
      </div>
    </div>
  )

  // All forms completed
  const allDone = submitted.brief && submitted.design && submitted.docs
  if (allDone && !sectionParam) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-6">
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h1 className="text-white font-semibold text-xl mb-2">Merci !</h1>
        <p className="text-slate-400 text-sm">
          Tous les formulaires ont bien été envoyés. L&apos;équipe Kameo va les analyser et reviendra vers vous rapidement.
        </p>
      </div>
    </div>
  )
  // Single-section done check
  const sectionDone = (sectionParam === 'form' || sectionParam === 'brief' || sectionParam === 'design' || sectionParam === 'docs') ? (submitted.brief && submitted.design && submitted.docs) : false
  if (sectionDone && sectionParam) return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-6">
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-400" />
        </div>
        <h1 className="text-white font-semibold text-xl mb-2">Merci !</h1>
        <p className="text-slate-400 text-sm">Le formulaire a bien été complété.</p>
      </div>
    </div>
  )

  const totalUploaded = Object.values(docs.categories).reduce((acc, files) => acc + files.length, 0)

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#111118]/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E14B89] to-[#F8903C] flex items-center justify-center">
              <span className="text-white text-xs font-bold">K</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">{formData.project.name}</h1>
              <p className="text-slate-500 text-xs">{formData.project.client.name}{formData.project.client.company ? ` · ${formData.project.client.company}` : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Welcome message */}
        <div className="mb-8">
          <h2 className="text-white text-2xl font-bold mb-2">
            {sectionParam ? 'Formulaire projet' : 'Bienvenue 👋'}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Merci de prendre le temps de remplir ces formulaires. Ils nous permettront de mieux comprendre votre projet et de vous fournir un résultat sur mesure.
          </p>
        </div>


        {/* 4-step stepper: Brief → Design → Accès → Documents */}
        <div className="mb-8">
          <div className="relative flex items-center justify-between max-w-lg mx-auto">
            {/* Connector lines */}
            <div className="absolute top-5 left-[calc(12.5%)] right-[calc(12.5%)] h-px bg-slate-800 z-0" />
            {[
              { step: 1, label: 'Brief', icon: Megaphone, done: submitted.brief },
              { step: 2, label: 'Design', icon: Paintbrush, done: submitted.design },
              { step: 3, label: 'Accès', icon: KeyRound, done: submitted.acces },
              { step: 4, label: 'Documents', icon: FolderOpen, done: submitted.docs },
            ].map(({ step, label, icon: StepIcon, done }) => {
              const isActive = formStep === step
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setFormStep(step)}
                  className="flex flex-col items-center gap-1.5 relative z-10 group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                    isActive
                      ? 'bg-gradient-to-br from-[#E14B89] to-[#F8903C] border-transparent shadow-lg shadow-[#E14B89]/30'
                      : done
                      ? 'bg-emerald-500/15 border-emerald-500/40'
                      : 'bg-[#111118] border-slate-700 group-hover:border-slate-500'
                  }`}>
                    {done && !isActive
                      ? <CheckCircle2 size={16} className="text-emerald-400" />
                      : <StepIcon size={16} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                    }
                  </div>
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-white' : done ? 'text-emerald-400/70' : 'text-slate-600 group-hover:text-slate-400'
                  }`}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            4-STEP FORM: Brief → Design → Accès → Documents
        ══════════════════════════════════════════════════════════════════ */}
        {formStep === 1 && (
          <form onSubmit={handleSubmitBrief} className="space-y-6">

            {/* Section 1 — L'offre */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#E14B89]/10 flex items-center justify-center">
                  <span className="text-[#E14B89] text-xs font-bold">1</span>
                </div>
                <h3 className="text-white font-semibold">Votre offre</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">En une phrase, que vendez-vous / proposez-vous ?</label>
                  <input
                    value={brief.offreResume || ''}
                    onChange={e => setBrief(p => ({ ...p, offreResume: e.target.value }))}
                    placeholder="Ex: Nous proposons des formations en ligne pour les entrepreneurs"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Décrivez votre offre en détail</label>
                  <p className="text-slate-500 text-xs mb-2">Ce que vous vendez, ce que vous ne proposez pas. Si vous avez un document existant, décrivez-le ici.</p>
                  <textarea
                    value={brief.offreDetail || ''}
                    onChange={e => setBrief(p => ({ ...p, offreDetail: e.target.value }))}
                    rows={4}
                    placeholder="Détaillez vos produits/services, ce qui est inclus et exclu..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Fourchette de prix et justification</label>
                  <textarea
                    value={brief.fourchettePrix || ''}
                    onChange={e => setBrief(p => ({ ...p, fourchettePrix: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Entre 500€ et 2000€ selon la formule. Le prix se justifie par..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Qu&apos;est-ce qui vous différencie de la concurrence ?</label>
                  <textarea
                    value={brief.differenciation || ''}
                    onChange={e => setBrief(p => ({ ...p, differenciation: e.target.value }))}
                    rows={3}
                    placeholder="Pourquoi un client devrait vous choisir plutôt qu'un concurrent ?"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">USP (Unique Selling Proposition)</label>
                  <p className="text-slate-500 text-xs mb-2">En une phrase : vous vendez quoi, pour qui, pour quels résultats ?</p>
                  <input
                    value={brief.usp || ''}
                    onChange={e => setBrief(p => ({ ...p, usp: e.target.value }))}
                    placeholder="Ex: Nous aidons les PME à doubler leur visibilité en ligne en 3 mois"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 2 — Persona */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-400 text-xs font-bold">2</span>
                </div>
                <h3 className="text-white font-semibold">Vos clients cibles (Persona)</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Décrivez vos différents profils clients</label>
                  <p className="text-slate-500 text-xs mb-2">Classe sociale, type de profil, stéréotypes... Tout ce qui aide à comprendre à qui vous vous adressez.</p>
                  <textarea
                    value={brief.personaTypes || ''}
                    onChange={e => setBrief(p => ({ ...p, personaTypes: e.target.value }))}
                    rows={4}
                    placeholder="Ex: Femmes 30-45 ans, cadres, soucieuses de leur bien-être, budget moyen-haut..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Peurs, motivations, besoins et freins à l&apos;achat</label>
                  <textarea
                    value={brief.personaPeurs || ''}
                    onChange={e => setBrief(p => ({ ...p, personaPeurs: e.target.value }))}
                    rows={4}
                    placeholder="Quelles sont leurs craintes ? Qu'est-ce qui les motive ? Qu'est-ce qui les empêche d'acheter ?"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Place du site web dans le parcours d&apos;achat</label>
                  <p className="text-slate-500 text-xs mb-2">Comment le client arrive sur le site ? Que fait-il ensuite ? (devis, achat, redirection...)</p>
                  <textarea
                    value={brief.parcoursAchat || ''}
                    onChange={e => setBrief(p => ({ ...p, parcoursAchat: e.target.value }))}
                    rows={3}
                    placeholder="Ex: Découverte via Instagram → visite du site → demande de devis via formulaire"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3 — Branding */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <span className="text-amber-400 text-xs font-bold">3</span>
                </div>
                <h3 className="text-white font-semibold">Branding & ton de voix</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Quel est votre ton de communication ?</label>
                  <p className="text-slate-500 text-xs mb-2">Tutoiement/vouvoiement, amical, formel, humoristique...</p>
                  <textarea
                    value={brief.toneOfVoice || ''}
                    onChange={e => setBrief(p => ({ ...p, toneOfVoice: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Vouvoiement, ton professionnel mais accessible, pas trop corporate"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Valeurs de votre entreprise</label>
                  <textarea
                    value={brief.valeurs || ''}
                    onChange={e => setBrief(p => ({ ...p, valeurs: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Transparence, innovation, proximité client, qualité artisanale..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Sujets ou prestations dont vous ne voulez pas parler</label>
                  <textarea
                    value={brief.sujetsInterdits || ''}
                    onChange={e => setBrief(p => ({ ...p, sujetsInterdits: e.target.value }))}
                    rows={2}
                    placeholder="Y a-t-il des aspects de votre activité à ne pas mentionner ?"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Termes ou mots à ne pas utiliser</label>
                  <p className="text-slate-500 text-xs mb-2">Restrictions liées à des certifications, au secteur, ou à votre image.</p>
                  <textarea
                    value={brief.termesInterdits || ''}
                    onChange={e => setBrief(p => ({ ...p, termesInterdits: e.target.value }))}
                    rows={2}
                    placeholder="Ex: Ne pas utiliser le mot 'cheap', éviter 'garantie' sans précision juridique..."
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">Documentation interne</label>
                  <p className="text-slate-500 text-xs mb-2">Avez-vous des documents internes (plaquette, brand book, vision...) à nous partager ? Décrivez-les ici.</p>
                  <textarea
                    value={brief.documentationInterne || ''}
                    onChange={e => setBrief(p => ({ ...p, documentationInterne: e.target.value }))}
                    rows={3}
                    placeholder="Listez les documents disponibles ou collez des liens vers ceux-ci"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4 — Contact */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#E14B89]/10 flex items-center justify-center">
                  <span className="text-[#E14B89] text-xs font-bold">4</span>
                </div>
                <h3 className="text-white font-semibold">Informations de contact</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                    <Mail size={12} /> Email
                  </label>
                  <input
                    type="email"
                    value={brief.contactEmail || ''}
                    onChange={e => setBrief(p => ({ ...p, contactEmail: e.target.value }))}
                    placeholder="vous@exemple.com"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                    <Phone size={12} /> Téléphone
                  </label>
                  <input
                    type="tel"
                    value={brief.contactPhone || ''}
                    onChange={e => setBrief(p => ({ ...p, contactPhone: e.target.value }))}
                    placeholder="06 12 34 56 78"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              {submitting ? 'Envoi en cours...' : 'Enregistrer et continuer'}
            </button>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2: Design
        ══════════════════════════════════════════════════════════════════ */}
        {formStep === 2 && (
          <form onSubmit={handleSubmitDesign} className="space-y-6">

            {/* Fond & Formes */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Préférences générales</h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Fond du site</label>
                  <div className="flex gap-2">
                    {[{ value: 'clair', label: 'Clair' }, { value: 'obscur', label: 'Obscur' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDesign(p => ({ ...p, fond: opt.value as 'clair' | 'obscur' }))}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          design.fond === opt.value
                            ? 'bg-[#E14B89]/10 border border-[#E14B89]/40 text-white font-medium'
                            : 'bg-[#1a1a24] border border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm mb-2">Style des formes</label>
                  <div className="flex gap-2">
                    {[{ value: 'arrondis', label: 'Arrondis' }, { value: 'carre', label: 'Carré' }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDesign(p => ({ ...p, formes: opt.value as 'arrondis' | 'carre' }))}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          design.formes === opt.value
                            ? 'bg-[#E14B89]/10 border border-[#E14B89]/40 text-white font-medium'
                            : 'bg-[#1a1a24] border border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Style visuel — multi-select */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Style visuel souhaité</h3>
              <p className="text-slate-500 text-xs mb-4">Sélectionnez un ou plusieurs styles qui correspondent à votre image</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STYLE_OPTIONS.map(s => {
                  const selected = design.stylesSouhaites?.includes(s) || false
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDesign(p => ({
                        ...p,
                        stylesSouhaites: selected
                          ? (p.stylesSouhaites || []).filter(x => x !== s)
                          : [...(p.stylesSouhaites || []), s],
                      }))}
                      className={`px-3 py-2.5 rounded-xl text-sm transition-all ${
                        selected
                          ? 'bg-[#E14B89]/10 border border-[#E14B89]/40 text-white font-medium'
                          : 'bg-[#1a1a24] border border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sites d'exemple — optionnel */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Sites d&apos;exemple <span className="text-slate-500 text-xs font-normal">(optionnel)</span></h3>
              <p className="text-slate-500 text-xs mb-4">Partagez des liens de sites que vous aimez (design, structure, fonctionnalités...)</p>
              <textarea
                value={design.sitesExemple || ''}
                onChange={e => setDesign(p => ({ ...p, sitesExemple: e.target.value }))}
                rows={3}
                placeholder="https://exemple1.com&#10;https://exemple2.com"
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormStep(1)}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-400 hover:text-white py-3.5 rounded-xl text-sm font-medium transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                {submitting ? 'Envoi en cours...' : 'Enregistrer et continuer'}
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3: Accès
        ══════════════════════════════════════════════════════════════════ */}
        {formStep === 3 && (
          <form onSubmit={handleSubmitAcces} className="space-y-6">

            {/* Email pro */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Adresse email pour le site</h3>
              <p className="text-slate-500 text-xs mb-4">L&apos;adresse email professionnelle qui sera affichée sur le site et utilisée pour les envois de mail</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Email</label>
                  <input
                    type="email"
                    value={acces.emailPro || ''}
                    onChange={e => setAcces(p => ({ ...p, emailPro: e.target.value }))}
                    placeholder="contact@votre-entreprise.fr"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Mot de passe</label>
                  <input
                    type="text"
                    value={acces.emailProMdp || ''}
                    onChange={e => setAcces(p => ({ ...p, emailProMdp: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Réseaux sociaux */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Liens réseaux sociaux <span className="text-slate-500 text-xs font-normal">(optionnel)</span></h3>
              <p className="text-slate-500 text-xs mb-4">Pour les intégrer au site web</p>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </label>
                  <input
                    value={acces.facebook || ''}
                    onChange={e => setAcces(p => ({ ...p, facebook: e.target.value }))}
                    placeholder="https://facebook.com/votre-page"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-pink-400"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </label>
                  <input
                    value={acces.instagram || ''}
                    onChange={e => setAcces(p => ({ ...p, instagram: e.target.value }))}
                    placeholder="https://instagram.com/votre-compte"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-300"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </label>
                  <input
                    value={acces.linkedin || ''}
                    onChange={e => setAcces(p => ({ ...p, linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/company/votre-entreprise"
                    className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Calendly */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-1">Accès Calendly</h3>
                <p className="text-slate-500 text-xs mb-4">Lien de votre page Calendly pour l&apos;intégration au site</p>
                <input
                  value={acces.calendlyAcces || ''}
                  onChange={e => setAcces(p => ({ ...p, calendlyAcces: e.target.value }))}
                  placeholder="https://calendly.com/votre-lien"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>

            {/* Stripe */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-1">Accès Stripe</h3>
                <p className="text-slate-500 text-xs mb-4">Clé API ou lien vers votre dashboard Stripe pour le paiement en ligne</p>
                <input
                  value={acces.stripeAcces || ''}
                  onChange={e => setAcces(p => ({ ...p, stripeAcces: e.target.value }))}
                  placeholder="sk_live_... ou lien dashboard"
                  className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                />
              </div>

            {/* SMTP */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                <Mail size={16} className="text-[#E14B89]" />
                Envoi d&apos;emails depuis votre site
                <span className="text-slate-500 text-xs font-normal">(optionnel)</span>
              </h3>
              <p className="text-slate-500 text-xs mb-4">
                Ces informations permettent à votre site d&apos;envoyer des emails (formulaire de contact, confirmations…).
                Vous les trouverez dans les paramètres de votre fournisseur email (Gmail, OVH, Brevo, Mailgun…).
                Si vous ne savez pas où les trouver, pas d&apos;inquiétude, nous vous guiderons !
              </p>

              <div className="space-y-4">
                {/* Serveur SMTP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Serveur d&apos;envoi (hôte SMTP)</label>
                    <input
                      value={acces.smtpHost || ''}
                      onChange={e => setAcces(p => ({ ...p, smtpHost: e.target.value }))}
                      placeholder="Ex : smtp.gmail.com, smtp.brevo.com"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Port</label>
                    <input
                      value={acces.smtpPort || ''}
                      onChange={e => setAcces(p => ({ ...p, smtpPort: e.target.value }))}
                      placeholder="465 ou 587"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                </div>

                {/* Chiffrement */}
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5">Type de sécurité</label>
                  <div className="flex gap-3">
                    {(['SSL', 'TLS'] as const).map(enc => (
                      <button
                        key={enc}
                        type="button"
                        onClick={() => setAcces(p => ({ ...p, smtpEncryption: p.smtpEncryption === enc ? '' : enc }))}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          acces.smtpEncryption === enc
                            ? 'bg-[#E14B89]/15 border-[#E14B89]/40 text-[#E14B89]'
                            : 'bg-[#1a1a24] border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {enc} {enc === 'SSL' ? '(port 465)' : '(port 587)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identifiants */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Identifiant (login SMTP)</label>
                    <input
                      value={acces.smtpLogin || ''}
                      onChange={e => setAcces(p => ({ ...p, smtpLogin: e.target.value }))}
                      placeholder="Souvent votre adresse email"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5">Mot de passe SMTP (ou clé API)</label>
                    <input
                      type="text"
                      value={acces.smtpPassword || ''}
                      onChange={e => setAcces(p => ({ ...p, smtpPassword: e.target.value }))}
                      placeholder="Mot de passe ou clé API"
                      className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                    />
                  </div>
                </div>

                {/* Adresse expéditeur */}
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-slate-500 text-xs mb-3">Adresse qui apparaîtra comme expéditeur des emails envoyés par le site</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Email expéditeur</label>
                      <input
                        type="email"
                        value={acces.smtpFromEmail || ''}
                        onChange={e => setAcces(p => ({ ...p, smtpFromEmail: e.target.value }))}
                        placeholder="Ex : contact@monsite.fr"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-xs mb-1.5">Nom affiché</label>
                      <input
                        value={acces.smtpFromName || ''}
                        onChange={e => setAcces(p => ({ ...p, smtpFromName: e.target.value }))}
                        placeholder="Ex : Équipe MonSite"
                        className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Autres accès */}
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Autres accès <span className="text-slate-500 text-xs font-normal">(optionnel)</span></h3>
              <p className="text-slate-500 text-xs mb-4">Autres accès, identifiants ou informations utiles pour le projet</p>
              <textarea
                value={acces.autresAcces || ''}
                onChange={e => setAcces(p => ({ ...p, autresAcces: e.target.value }))}
                rows={3}
                placeholder="Ex: Accès hébergeur, identifiants CMS actuel, accès Google Analytics..."
                className="w-full bg-[#1a1a24] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E14B89] transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormStep(2)}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-400 hover:text-white py-3.5 rounded-xl text-sm font-medium transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                {submitting ? 'Envoi en cours...' : 'Enregistrer et continuer'}
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 4: Documents
        ══════════════════════════════════════════════════════════════════ */}
        {formStep === 4 && (
          <form onSubmit={handleSubmitDocs} className="space-y-6">

            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Transmission de vos documents</h3>
              <p className="text-slate-500 text-xs">
                Importez vos fichiers directement en cliquant sur chaque zone. Vous pouvez aussi glisser-déposer vos documents.
              </p>
              {totalUploaded > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-400 text-xs font-medium">{totalUploaded} fichier{totalUploaded > 1 ? 's' : ''} importé{totalUploaded > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {DOC_CATEGORIES_FORM.map(cat => {
              const CatIcon = cat.icon
              const catFiles = docs.categories[cat.key] || []

              return (
                <div key={cat.key} className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className={`w-7 h-7 rounded-lg ${cat.bgColor} flex items-center justify-center`}>
                      <CatIcon size={14} className={cat.color} />
                    </div>
                    <h3 className="text-white font-semibold">{cat.label} {'optional' in cat && (cat as { optional?: boolean }).optional && <span className="text-slate-500 text-xs font-normal">(optionnel)</span>}</h3>
                    {catFiles.length > 0 && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 font-medium">
                        {catFiles.length} fichier{catFiles.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className={`grid gap-3 ${cat.documents.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {cat.documents.map(doc => (
                      <UploadCard
                        key={doc.name}
                        doc={doc}
                        catKey={cat.key}
                        token={token}
                        files={catFiles}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                        borderColor={cat.borderColor}
                        hoverBorder={cat.hoverBorder}
                        bgColor={cat.bgColor}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormStep(3)}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-700 text-slate-400 hover:text-white py-3.5 rounded-xl text-sm font-medium transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-[2] flex items-center justify-center gap-2 bg-gradient-to-r from-[#E14B89] to-[#F8903C] hover:opacity-90 text-white py-3.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? 'Envoi en cours...' : 'Envoyer mes documents'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="mt-12 pb-8 text-center">
          <p className="text-slate-600 text-xs">Propulsé par <span className="text-[#E14B89]">Agence Kameo</span></p>
        </div>
      </div>
    </div>
  )
}
