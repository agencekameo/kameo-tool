'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, Copy, CheckCircle2, FileText, Search } from 'lucide-react'

interface RedactionData {
  id: string
  analysis: string
  content?: string | null
  createdAt: string
  project: { id: string; name: string; client: { name: string; company?: string } }
  createdBy: { name: string }
}

export default function RedactionViewPage() {
  const { id } = useParams()
  const [data, setData] = useState<RedactionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'analysis' | 'content'>('analysis')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/redaction/${id}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    if (!data) return
    const text = `# Analyse SEO\n\n${data.analysis}\n\n---\n\n# Contenu rédigé\n\n${data.content || ''}`
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redaction-${data.project.name.replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function renderMarkdown(md: string) {
    return md.split('\n').map((line, i) => {
      if (line.startsWith('#### ')) return <h4 key={i} className="text-white font-medium text-sm mt-4 mb-1">{line.slice(5)}</h4>
      if (line.startsWith('### ')) return <h3 key={i} className="text-white font-semibold mt-5 mb-2">{line.slice(4)}</h3>
      if (line.startsWith('## ')) return <h2 key={i} className="text-[#E14B89] font-bold text-lg mt-6 mb-3 pb-2 border-b border-slate-800">{line.slice(3)}</h2>
      if (line.startsWith('# ')) return <h1 key={i} className="text-white font-bold text-xl mt-6 mb-3">{line.slice(2)}</h1>
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.slice(2)
        const parts = text.split(/(\*\*[^*]+\*\*)/g)
        return <li key={i} className="text-slate-300 text-sm ml-4 mb-0.5 list-disc">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong> : p)}</li>
      }
      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[#E14B89] pl-3 text-slate-400 text-sm italic my-2">{line.slice(2)}</blockquote>
      if (line.trim() === '') return <div key={i} className="h-2" />
      if (line.startsWith('---')) return <hr key={i} className="border-slate-800 my-6" />
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return <p key={i} className="text-slate-300 text-sm mb-1 leading-relaxed">{parts.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong> : p)}</p>
    })
  }

  if (loading) return <div className="p-8 text-slate-500 text-sm">Chargement...</div>
  if (!data) return <div className="p-8 text-red-400 text-sm">Rédaction introuvable</div>

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <Link href="/redaction" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white text-xs mb-5 transition-colors">
        <ArrowLeft size={13} /> Retour aux rédactions
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{data.project.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data.project.client.company || data.project.client.name} · {data.createdBy.name} · {new Date(data.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleCopy(activeTab === 'analysis' ? data.analysis : data.content || '')}
            className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
            <Copy size={13} /> {copied ? 'Copié !' : 'Copier'}
          </button>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 bg-[#111118] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white px-3 py-2.5 rounded-xl text-xs transition-colors">
            <Download size={13} /> Télécharger
          </button>
        </div>
      </div>

      <div className="flex bg-[#111118] border border-slate-800 rounded-xl p-0.5 mb-4 w-fit">
        <button onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'analysis' ? 'bg-[#E14B89]/10 text-[#E14B89]' : 'text-slate-400 hover:text-white'}`}>
          <Search size={13} /> Analyse SEO
        </button>
        <button onClick={() => setActiveTab('content')} disabled={!data.content}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === 'content' ? 'bg-[#F8903C]/10 text-[#F8903C]' : 'text-slate-400 hover:text-white'} disabled:opacity-30`}>
          <FileText size={13} /> Contenu rédigé
        </button>
      </div>

      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6 sm:p-8 max-h-[70vh] overflow-y-auto">
        {activeTab === 'analysis' && renderMarkdown(data.analysis)}
        {activeTab === 'content' && data.content && renderMarkdown(data.content)}
      </div>
    </div>
  )
}
