'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Star, MapPin, Phone, RefreshCw, CheckCircle2, XCircle, Loader2, Unlink,
  Building2, Globe, ShieldCheck, MessageSquare, ChevronDown, ChevronRight,
  ExternalLink, LayoutDashboard, Settings, Image as ImageIcon, FileText,
  Search, Plus, Send, X, Eye, Save, Upload, Reply, Sparkles, Calendar,
  FolderOpen, Mail, Copy, Link,
} from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'

// ── Types ──

type TabKey = 'dashboard' | 'optimize' | 'photos' | 'reviews' | 'posts' | 'project' | 'recaps'

interface GmbLocation {
  name?: string; title?: string
  storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string; regionCode?: string }
  websiteUri?: string; phoneNumbers?: { primaryPhone?: string }
  categories?: { primaryCategory?: { displayName?: string } }
  metadata?: { hasVoiceOfMerchant?: boolean; mapsUri?: string; placeId?: string }
  regularHours?: { periods?: { openDay?: string; openTime?: string; closeDay?: string; closeTime?: string }[] }
  profile?: { description?: string }
  accountName?: string; accountDisplayName?: string
}
interface GmbReview {
  reviewId?: string; reviewer?: { displayName?: string }; starRating?: string
  comment?: string; createTime?: string; reviewReply?: { comment?: string }
}
interface GmbMedia {
  name?: string; googleUrl?: string; thumbnailUrl?: string; createTime?: string; category?: string
}
interface GmbPost {
  name?: string; summary?: string; topicType?: string; createTime?: string
  media?: { googleUrl?: string }[]
}
interface GmbPerf {
  impressions: number; callClicks: number; websiteClicks: number; directionRequests: number
  daily?: { date: string; impressions: number; websiteClicks: number; callClicks: number; directionRequests: number }[]
}

// ── Helpers ──

const RATING_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
function ratingToNumber(r?: string) { if (!r) return 0; return RATING_MAP[r] ?? (parseInt(r, 10) || 0) }

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return <div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />)}</div>
}
function formatAddress(loc: GmbLocation) {
  const a = loc.storefrontAddress; if (!a) return ''
  return [...(a.addressLines ?? []), [a.postalCode, a.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
const AVATARS = ['from-violet-500 to-purple-700', 'from-blue-500 to-blue-700', 'from-emerald-500 to-teal-700', 'from-rose-500 to-pink-700', 'from-amber-500 to-orange-700', 'from-cyan-500 to-sky-700']

function getLocDomain(loc: GmbLocation): string | null {
  if (!loc.websiteUri) return null
  try { const u = loc.websiteUri.startsWith('http') ? loc.websiteUri : `https://${loc.websiteUri}`; return new URL(u).hostname.replace(/^www\./, '') } catch { return null }
}

function LocLogo({ loc, fallbackColor }: { loc: GmbLocation; fallbackColor: string }) {
  const [failed, setFailed] = useState(false)
  const domain = getLocDomain(loc)
  if (!domain || failed) {
    const initial = (loc.title || '?')[0].toUpperCase()
    return <div className={`w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center flex-shrink-0`}><span className={`text-[10px] font-bold ${fallbackColor}`}>{initial}</span></div>
  }
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-6 h-6 rounded-md object-contain bg-white/10 flex-shrink-0" onError={() => setFailed(true)} />
}

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'project', label: 'Projet', icon: FolderOpen },
  { key: 'reviews', label: 'Avis', icon: Star },
  { key: 'optimize', label: 'Optimiser', icon: Settings },
  { key: 'photos', label: 'Photos', icon: ImageIcon },
  { key: 'posts', label: 'Google Posts', icon: FileText },
  { key: 'recaps', label: 'Récaps', icon: Mail },
]

const inputClass = 'w-full bg-[#0d0d14] border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-[#E14B89]'

// ── Smooth curve helper (same as finances) ──
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const tension = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

const PERF_CURVES = [
  { key: 'impressions', label: 'Vues', color: '#4ade80', defaultOn: true },
  { key: 'websiteClicks', label: 'Site web', color: '#a78bfa', defaultOn: true },
  { key: 'callClicks', label: 'Appels', color: '#f472b6', defaultOn: true },
  { key: 'directionRequests', label: 'Itinéraires', color: '#38bdf8', defaultOn: true },
] as const

type PerfDaily = { date: string; impressions: number; websiteClicks: number; callClicks: number; directionRequests: number }

function PerfChart({ daily }: { daily: PerfDaily[] }) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PERF_CURVES.map(c => [c.key, c.defaultOn]))
  )
  const toggle = (key: string) => setVisible(v => ({ ...v, [key]: !v[key] }))
  const [hovered, setHovered] = useState<number | null>(null)

  const W = 700, H = 220, PL = 50, PR = 10, PT = 15, PB = 30
  const chartW = W - PL - PR, chartH = H - PT - PB

  const getMax = () => {
    let max = 0
    daily.forEach(d => {
      PERF_CURVES.forEach(c => { if (visible[c.key]) max = Math.max(max, d[c.key]) })
    })
    return max * 1.25 || 1
  }
  const maxVal = getMax()

  const xPos = (i: number) => PL + (i / Math.max(1, daily.length - 1)) * chartW
  const yPos = (val: number) => PT + chartH - (maxVal > 0 ? (val / maxVal) * chartH : 0)
  const baseline = yPos(0)

  const curveData: Record<string, { x: number; y: number }[]> = {}
  PERF_CURVES.forEach(c => {
    curveData[c.key] = daily.map((d, i) => ({ x: xPos(i), y: yPos(d[c.key]) }))
  })

  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxVal / 4) * i
    return { val, posY: yPos(val) }
  })

  const primaryCurve = PERF_CURVES.find(c => visible[c.key]) || PERF_CURVES[0]

  return (
    <div className="bg-[#0a0a12] border border-slate-800/50 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-2">
        <h3 className="text-white font-semibold text-sm">Performances (30 derniers jours)</h3>
        <div className="flex items-center gap-1 flex-wrap">
          {PERF_CURVES.map(c => (
            <button key={c.key} onClick={() => toggle(c.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                visible[c.key] ? 'bg-white/5 text-white' : 'text-slate-600 hover:text-slate-400'
              }`}>
              <span className="w-3 h-1 rounded-full transition-opacity" style={{
                backgroundColor: c.color, opacity: visible[c.key] ? 1 : 0.25,
              }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            {PERF_CURVES.map(c => (
              <linearGradient key={c.key} id={`areaGrad_${c.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.color} stopOpacity="0.25" />
                <stop offset="60%" stopColor={c.color} stopOpacity="0.06" />
                <stop offset="100%" stopColor={c.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <filter id="perfGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Grid lines + Y labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} y1={t.posY} x2={W - PR} y2={t.posY} stroke="#1e293b" strokeWidth="0.5" opacity="0.5" />
              <text x={PL - 10} y={t.posY + 3} textAnchor="end" fill="#475569" fontSize="9" fontFamily="system-ui">
                {t.val >= 1000 ? `${(t.val / 1000).toFixed(0)}k` : Math.round(t.val).toString()}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {daily.filter((_, i) => i % Math.ceil(daily.length / 8) === 0 || i === daily.length - 1).map((p) => {
            const idx = daily.indexOf(p)
            return <text key={idx} x={xPos(idx)} y={H - 8} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="system-ui">{p.date.slice(5)}</text>
          })}

          {/* Area fills */}
          {PERF_CURVES.map(c => {
            if (!visible[c.key] || !curveData[c.key]) return null
            const path = smoothPath(curveData[c.key])
            const lastIdx = daily.length - 1
            return <path key={`area-${c.key}`} d={path + ` L${xPos(lastIdx)},${baseline} L${xPos(0)},${baseline} Z`} fill={`url(#areaGrad_${c.key})`} />
          })}

          {/* Lines */}
          {PERF_CURVES.map(c => {
            if (!visible[c.key] || !curveData[c.key]) return null
            return <path key={`line-${c.key}`} d={smoothPath(curveData[c.key])} fill="none" stroke={c.color} strokeWidth={2} strokeLinejoin="round" filter="url(#perfGlow)" />
          })}

          {/* Hover line + dots */}
          {hovered !== null && (
            <g>
              <line x1={xPos(hovered)} y1={PT} x2={xPos(hovered)} y2={PT + chartH} stroke="#475569" strokeWidth="0.5" strokeDasharray="4 4" />
              {PERF_CURVES.map(c => {
                if (!visible[c.key] || !curveData[c.key]) return null
                const pt = curveData[c.key][hovered]
                return <circle key={c.key} cx={pt.x} cy={pt.y} r={4} fill={c.color} stroke="#0a0a12" strokeWidth={2} />
              })}
            </g>
          )}

          {/* Invisible hover areas */}
          {daily.map((_, i) => (
            <rect key={i} x={xPos(i) - chartW / daily.length / 2} y={PT} width={chartW / daily.length} height={chartH}
              fill="transparent" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
          ))}
        </svg>

        {/* Tooltip */}
        {hovered !== null && (
          <div className="absolute top-0 bg-[#111118] border border-slate-700 rounded-xl px-3 py-2 shadow-xl pointer-events-none z-10"
            style={{ left: `${(xPos(hovered) / W) * 100}%`, transform: 'translateX(-50%)' }}>
            <p className="text-slate-400 text-[10px] mb-1">{daily[hovered].date}</p>
            {PERF_CURVES.map(c => visible[c.key] ? (
              <div key={c.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-slate-400">{c.label}:</span>
                <span className="text-white font-medium">{daily[hovered][c.key]}</span>
              </div>
            ) : null)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──

export default function GmbPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [gmbConnected, setGmbConnected] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [locations, setLocations] = useState<GmbLocation[]>([])
  const [sel, setSel] = useState<GmbLocation | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [reviews, setReviews] = useState<GmbReview[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [media, setMedia] = useState<GmbMedia[]>([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [posts, setPosts] = useState<GmbPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [perf, setPerf] = useState<GmbPerf | null>(null)
  const [loadingPerf, setLoadingPerf] = useState(false)
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({})

  // Modals & forms
  const [showPostModal, setShowPostModal] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [postType, setPostType] = useState('STANDARD')
  const [creatingPost, setCreatingPost] = useState(false)

  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'replied' | 'unreplied'>('all')
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  const [editField, setEditField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [showGallery, setShowGallery] = useState(false)

  // Project & scheduling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [gmbProject, setGmbProject] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scheduledPhotos, setScheduledPhotos] = useState<any[]>([])
  const [generatingPosts, setGeneratingPosts] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [projectForm, setProjectForm] = useState({
    businessName: '', sector: '', zone: '', keywords: '', targetAudience: '',
    tone: 'professionnel', directives: '', services: '', uniquePoints: '',
    postsPerMonth: 4, postTime: '10:00', recapEnabled: false,
    recapFrequency: 'MENSUEL', recapEmail: '',
    recapIncludeReviews: true, recapIncludePerf: true, recapIncludePosts: true,
    recapIncludePhotos: true, recapIncludeOptimize: true,
  })
  const [portalUrl, setPortalUrl] = useState('')
  const [creatingPortal, setCreatingPortal] = useState(false)
  const schedPhotoRef = useRef<HTMLInputElement>(null)
  const [schedPhotoDate, setSchedPhotoDate] = useState('')
  const [uploadingSchedPhoto, setUploadingSchedPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [initialLoaded, setInitialLoaded] = useState(false)

  const sortLocs = useCallback((locs: GmbLocation[]) => {
    const sorted = [...locs].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr'))
    setLocations(sorted)
    return sorted
  }, [])

  useEffect(() => {
    if (initialLoaded) return
    fetch('/api/gmb/data').then(r => r.json()).then(data => {
      setGmbConnected(data.connected ?? false)
      const sorted = sortLocs(data.locations ?? [])
      if (sorted.length > 0) setSel(sorted[0])
      setInitialLoaded(true)
      setPageLoading(false)
    }).catch(() => { setInitialLoaded(true); setPageLoading(false) })
  }, [initialLoaded, sortLocs])

  const refreshData = useCallback(() => {
    fetch('/api/gmb/data').then(r => r.json()).then(data => {
      setGmbConnected(data.connected ?? false)
      const sorted = sortLocs(data.locations ?? [])
      if (sel) { if (!sorted.find(l => l.name === sel.name) && sorted.length > 0) setSel(sorted[0]) }
      else if (sorted.length > 0) setSel(sorted[0])
    }).catch(() => {})
  }, [sel, sortLocs])
  usePolling(refreshData)

  // Fetch data for selected location
  useEffect(() => {
    if (!sel?.name || !sel?.accountName || !gmbConnected) {
      setReviews([]); setMedia([]); setPosts([]); setPerf(null); return
    }
    const a = encodeURIComponent(sel.accountName), l = encodeURIComponent(sel.name)
    setApiErrors({})

    setLoadingReviews(true)
    fetch(`/api/gmb/reviews?account=${a}&location=${l}`)
      .then(r => r.json()).then(d => {
        setReviews(d.reviews ?? [])
        if (d.error) setApiErrors(prev => ({ ...prev, reviews: d.error }))
      })
      .catch(e => { setReviews([]); setApiErrors(prev => ({ ...prev, reviews: String(e) })) })
      .finally(() => setLoadingReviews(false))

    setLoadingMedia(true)
    fetch(`/api/gmb/media?account=${a}&location=${l}`)
      .then(r => r.json()).then(d => {
        setMedia(d.media ?? [])
        if (d.error) setApiErrors(prev => ({ ...prev, media: d.error }))
      })
      .catch(e => { setMedia([]); setApiErrors(prev => ({ ...prev, media: String(e) })) })
      .finally(() => setLoadingMedia(false))

    setLoadingPosts(true)
    fetch(`/api/gmb/posts?account=${a}&location=${l}`)
      .then(r => r.json()).then(d => {
        setPosts(d.posts ?? [])
        if (d.error) setApiErrors(prev => ({ ...prev, posts: d.error }))
      })
      .catch(e => { setPosts([]); setApiErrors(prev => ({ ...prev, posts: String(e) })) })
      .finally(() => setLoadingPosts(false))

    setLoadingPerf(true)
    fetch(`/api/gmb/performance?location=${l}`)
      .then(r => r.json()).then(d => {
        setPerf(d.performance ?? null)
        if (d.error) setApiErrors(prev => ({ ...prev, performance: d.error }))
      })
      .catch(e => { setPerf(null); setApiErrors(prev => ({ ...prev, performance: String(e) })) })
      .finally(() => setLoadingPerf(false))

    // Fetch project data
    fetch(`/api/gmb/project?locationId=${l}`)
      .then(r => r.json()).then(d => {
        if (d.project) {
          setGmbProject(d.project)
          setProjectForm({
            businessName: d.project.businessName || '', sector: d.project.sector || '',
            zone: d.project.zone || '', keywords: (d.project.keywords || []).join(', '),
            targetAudience: d.project.targetAudience || '', tone: d.project.tone || 'professionnel',
            directives: d.project.directives || '', services: d.project.services || '',
            uniquePoints: d.project.uniquePoints || '', postsPerMonth: d.project.postsPerMonth || 4,
            postTime: d.project.postTime || '10:00', recapEnabled: d.project.recapEnabled || false,
            recapFrequency: d.project.recapFrequency || 'MENSUEL', recapEmail: d.project.recapEmail || '',
            recapIncludeReviews: true, recapIncludePerf: true, recapIncludePosts: true,
            recapIncludePhotos: true, recapIncludeOptimize: true,
          })
          if (d.project.clientPortal?.token) {
            setPortalUrl(`${window.location.origin}/gmb-photos/${d.project.clientPortal.token}`)
          }
          // Fetch scheduled posts & photos
          fetch(`/api/gmb/scheduled-posts?projectId=${d.project.id}`).then(r => r.json()).then(sp => setScheduledPosts(sp.posts ?? []))
          fetch(`/api/gmb/scheduled-photos?projectId=${d.project.id}`).then(r => r.json()).then(sp => setScheduledPhotos(sp.photos ?? []))
        }
      }).catch(() => {})
  }, [sel?.name, sel?.accountName, gmbConnected])

  async function handleRefresh() {
    setRefreshing(true)
    try { const r = await fetch('/api/gmb/data'); const d = await r.json(); setGmbConnected(d.connected ?? false); const s = sortLocs(d.locations ?? []); if (s.length > 0 && !sel) setSel(s[0]) }
    catch { setGmbConnected(false) } finally { setRefreshing(false) }
  }
  function handleConnect() { setConnecting(true); window.location.href = '/api/gmb/connect' }
  async function handleDisconnect() {
    if (!confirm('Déconnecter le compte Google My Business ?')) return
    setDisconnecting(true)
    try { await fetch('/api/gmb/data', { method: 'DELETE' }); setGmbConnected(false); setLocations([]); setSel(null) }
    finally { setDisconnecting(false) }
  }

  // ── Actions ──

  async function saveField(field: string, value: string) {
    if (!sel?.name) return
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = { locationName: sel.name }
      if (field === 'description') body.description = value
      if (field === 'phone') body.phone = value
      if (field === 'website') body.website = value
      if (field === 'address') {
        // Parse "rue, code postal ville" format
        const parts = value.split(',').map(p => p.trim())
        const addressLine = parts[0] || ''
        const cityPart = parts[1] || ''
        const postalMatch = cityPart.match(/^(\d{5})\s*(.*)$/)
        body.address = {
          addressLines: [addressLine],
          postalCode: postalMatch?.[1] || '',
          locality: postalMatch?.[2] || cityPart,
          regionCode: 'FR',
        }
      }
      const res = await fetch('/api/gmb/location', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await res.json()
      if (result.error) alert(`Erreur: ${result.error}`)
      else handleRefresh()
    } finally { setSaving(false); setEditField(null) }
  }

  async function handleReply(reviewId: string) {
    if (!replyText.trim() || !sel?.accountName || !sel?.name) return
    setSendingReply(true)
    try {
      await fetch('/api/gmb/reviews/reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: sel.accountName, location: sel.name, reviewId, comment: replyText.trim() }),
      })
      // Refresh reviews
      const a = encodeURIComponent(sel.accountName), l = encodeURIComponent(sel.name)
      const r = await fetch(`/api/gmb/reviews?account=${a}&location=${l}`)
      const d = await r.json(); setReviews(d.reviews ?? [])
    } finally { setSendingReply(false); setReplyingTo(null); setReplyText('') }
  }

  async function handleUploadPhoto(file: File) {
    if (!sel?.accountName || !sel?.name) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('account', sel.accountName); form.append('location', sel.name); form.append('file', file)
      await fetch('/api/gmb/media/upload', { method: 'POST', body: form })
      // Refresh media
      const a = encodeURIComponent(sel.accountName), l = encodeURIComponent(sel.name)
      const r = await fetch(`/api/gmb/media?account=${a}&location=${l}`)
      const d = await r.json(); setMedia(d.media ?? [])
    } finally { setUploading(false) }
  }

  async function handleCreatePost() {
    if (!postContent.trim() || !sel?.accountName || !sel?.name) return
    setCreatingPost(true)
    try {
      await fetch('/api/gmb/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: sel.accountName, location: sel.name, summary: postContent.trim(), topicType: postType }),
      })
      setPostContent(''); setShowPostModal(false)
      const a = encodeURIComponent(sel.accountName), l = encodeURIComponent(sel.name)
      const r = await fetch(`/api/gmb/posts?account=${a}&location=${l}`)
      const d = await r.json(); setPosts(d.posts ?? [])
    } finally { setCreatingPost(false) }
  }

  // ── Computed ──
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + ratingToNumber(r.starRating), 0) / reviews.length : 0
  const totalReviews = reviews.length
  const isVerified = sel?.metadata?.hasVoiceOfMerchant ?? false
  const ratingDist = [5, 4, 3, 2, 1].map(s => ({ stars: s, count: reviews.filter(r => ratingToNumber(r.starRating) === s).length }))

  // status: 'empty' = not filled, 'filled' = filled but not optimized, 'optimized' = matches Google best practices
  type OptStatus = 'empty' | 'filled' | 'optimized'
  interface OptItem { label: string; status: OptStatus; field: string; hint: string }

  const optimizeItems: OptItem[] = sel ? [
    { label: 'Catégorie principale', field: '',
      status: !sel.categories?.primaryCategory?.displayName ? 'empty' : 'optimized',
      hint: 'Choisir la catégorie la plus précise possible' },
    { label: 'Numéro de téléphone', field: 'phone',
      status: !sel.phoneNumbers?.primaryPhone ? 'empty' : 'optimized',
      hint: 'Numéro local recommandé (pas de 08)' },
    { label: 'Site web', field: 'website',
      status: !sel.websiteUri ? 'empty' : sel.websiteUri.startsWith('https://') ? 'optimized' : 'filled',
      hint: 'HTTPS obligatoire, URL propre sans paramètres' },
    { label: 'Adresse complète', field: 'address',
      status: !sel.storefrontAddress?.addressLines?.length ? 'empty' : (sel.storefrontAddress.locality && sel.storefrontAddress.postalCode) ? 'optimized' : 'filled',
      hint: 'Rue + code postal + ville requis' },
    { label: 'Description de l\'établissement', field: 'description',
      status: !sel.profile?.description ? 'empty' : (sel.profile.description.length >= 250) ? 'optimized' : 'filled',
      hint: 'Min. 250 caractères, inclure mots-clés du secteur et de la zone géographique' },
    { label: 'Horaires d\'ouverture', field: '',
      status: !sel.regularHours?.periods?.length ? 'empty' : (sel.regularHours.periods.length >= 5) ? 'optimized' : 'filled',
      hint: 'Renseigner tous les jours (y compris fermé), Google pénalise les fiches sans horaires' },
    { label: 'Photos', field: '',
      status: media.length === 0 ? 'empty' : media.length >= 10 ? 'optimized' : 'filled',
      hint: '10+ photos recommandé (logo, couverture, intérieur, équipe, produits). Fiches avec photos = +42% de demandes d\'itinéraire' },
    { label: 'Avis clients', field: '',
      status: totalReviews === 0 ? 'empty' : totalReviews >= 15 && avgRating >= 4.0 ? 'optimized' : 'filled',
      hint: '15+ avis avec note >= 4.0. Répondre à TOUS les avis (positifs et négatifs)' },
    { label: 'Réponses aux avis', field: '',
      status: totalReviews === 0 ? 'empty' : reviews.every(r => r.reviewReply?.comment) ? 'optimized' : reviews.some(r => r.reviewReply?.comment) ? 'filled' : 'empty',
      hint: 'Google favorise les fiches qui répondent à 100% des avis' },
    { label: 'Fiche vérifiée', field: '',
      status: isVerified ? 'optimized' : 'empty',
      hint: 'Fiche non vérifiée = invisible dans les résultats locaux' },
    { label: 'Google Posts', field: '',
      status: posts.length === 0 ? 'empty' : posts.length >= 4 ? 'optimized' : 'filled',
      hint: '4+ posts/mois recommandé. Les fiches actives sont mieux classées' },
  ] : []
  const optimizedCount = optimizeItems.filter(i => i.status === 'optimized').length
  const optimizePct = optimizeItems.length > 0 ? Math.round((optimizedCount / optimizeItems.length) * 100) : 0
  const itemsToImprove = optimizeItems.filter(i => i.status !== 'optimized')

  const auditItems = sel ? [
    { label: 'Informations de base', score: [sel.categories?.primaryCategory, sel.phoneNumbers?.primaryPhone, sel.websiteUri, sel.storefrontAddress?.addressLines?.length].filter(Boolean).length * 25 },
    { label: 'Description', score: sel.profile?.description ? 80 : 10 },
    { label: 'Galerie photos', score: media.length >= 10 ? 90 : media.length >= 5 ? 70 : media.length >= 1 ? 40 : 5 },
    { label: 'Avis clients', score: totalReviews >= 20 ? 90 : totalReviews >= 10 ? 70 : totalReviews >= 5 ? 50 : totalReviews > 0 ? 30 : 5 },
    { label: 'Horaires', score: sel.regularHours?.periods?.length ? 90 : 10 },
    { label: 'Posts', score: posts.length >= 3 ? 80 : posts.length >= 1 ? 50 : 5 },
    { label: 'Vérification', score: isVerified ? 100 : 0 },
  ] : []
  const auditScore = auditItems.length > 0 ? Math.round(auditItems.reduce((s, i) => s + i.score, 0) / auditItems.length) : 0

  // ═══ TABS ═══

  function renderDashboard() {
    const totalImpressions = perf?.impressions ?? 0
    const kpis = [
      { label: 'Note moyenne', value: avgRating > 0 ? avgRating.toFixed(1) : '--', icon: Star, color: 'bg-amber-500/15 text-amber-400' },
      { label: 'Nombre d\'avis', value: totalReviews > 0 ? String(totalReviews) : '--', icon: MessageSquare, color: 'bg-blue-500/15 text-blue-400' },
      { label: 'Vues profil (30j)', value: loadingPerf ? '...' : totalImpressions > 0 ? totalImpressions.toLocaleString('fr-FR') : '--', icon: Eye, color: 'bg-emerald-500/15 text-emerald-400' },
      { label: 'Clics site web (30j)', value: loadingPerf ? '...' : perf?.websiteClicks ? String(perf.websiteClicks) : '--', icon: Globe, color: 'bg-violet-500/15 text-violet-400' },
      { label: 'Clics appel (30j)', value: loadingPerf ? '...' : perf?.callClicks ? String(perf.callClicks) : '--', icon: Phone, color: 'bg-rose-500/15 text-rose-400' },
      { label: 'Itinéraires (30j)', value: loadingPerf ? '...' : perf?.directionRequests ? String(perf.directionRequests) : '--', icon: MapPin, color: 'bg-cyan-500/15 text-cyan-400' },
    ]

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
              <div className="mb-3"><div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.color}`}><kpi.icon size={14} /></div></div>
              <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
              <p className="text-slate-500 text-xs">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Performance chart */}
        {perf?.daily && perf.daily.length > 0 && <PerfChart daily={perf.daily!} />}

        {/* Infos fiche */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Informations de la fiche</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formatAddress(sel!) && (
              <a href={sel!.metadata?.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(sel!))}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                <MapPin size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div><p className="text-slate-600 text-xs mb-0.5">Adresse</p><p className="text-slate-300 text-sm group-hover:text-[#E14B89] transition-colors">{formatAddress(sel!)} <ExternalLink size={10} className="inline text-slate-600" /></p></div>
              </a>
            )}
            {sel!.phoneNumbers?.primaryPhone && (
              <div className="flex items-start gap-3"><Phone size={14} className="text-slate-500 mt-0.5 flex-shrink-0" /><div><p className="text-slate-600 text-xs mb-0.5">Téléphone</p><p className="text-slate-300 text-sm">{sel!.phoneNumbers.primaryPhone}</p></div></div>
            )}
            {sel!.websiteUri && (
              <div className="flex items-start gap-3"><Globe size={14} className="text-slate-500 mt-0.5 flex-shrink-0" /><div><p className="text-slate-600 text-xs mb-0.5">Site web</p><p className="text-slate-300 text-sm truncate max-w-[250px]">{sel!.websiteUri.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p></div></div>
            )}
            {sel!.categories?.primaryCategory?.displayName && (
              <div className="flex items-start gap-3"><Building2 size={14} className="text-slate-500 mt-0.5 flex-shrink-0" /><div><p className="text-slate-600 text-xs mb-0.5">Catégorie</p><p className="text-slate-300 text-sm">{sel!.categories.primaryCategory.displayName}</p></div></div>
            )}
          </div>
        </div>

        {/* API errors debug */}
        {Object.keys(apiErrors).length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <p className="text-red-400 text-xs font-medium mb-2">Erreurs API Google :</p>
            {Object.entries(apiErrors).map(([key, err]) => (
              <p key={key} className="text-red-400/70 text-xs mb-1"><span className="font-medium">{key}:</span> {err}</p>
            ))}
          </div>
        )}

        {/* Points à améliorer */}
        {itemsToImprove.length > 0 && (
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/15"><Settings size={16} className="text-violet-400" /></div>
              <div>
                <h3 className="text-white font-medium">Optimisation : {optimizePct}%</h3>
                <p className="text-slate-500 text-xs">{optimizedCount}/{optimizeItems.length} optimisés — {itemsToImprove.length} à améliorer</p>
              </div>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: `${optimizePct}%` }} />
            </div>
            <div className="space-y-2">
              {itemsToImprove.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-3 bg-[#0d0d14] border border-slate-800/60 rounded-xl">
                  <XCircle size={14} className="text-rose-400 flex-shrink-0" />
                  <span className="text-slate-400 text-sm flex-1">{item.label}</span>
                  {item.field && (
                    <button onClick={() => { setEditField(item.field); setEditValue(''); setActiveTab('optimize') }}
                      className="text-xs text-[#E14B89] hover:text-[#F8903C] transition-colors flex-shrink-0">Corriger</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderReviews() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex flex-col items-center gap-2 mb-5">
              <p className="text-5xl font-bold text-white">{avgRating > 0 ? avgRating.toFixed(1) : '--'}</p>
              <StarRating rating={Math.round(avgRating)} size={20} />
              <p className="text-slate-500 text-sm">{totalReviews} avis</p>
            </div>
            <div className="space-y-2">
              {ratingDist.map(({ stars, count }) => {
                const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                return <div key={stars} className="flex items-center gap-3"><span className="text-slate-400 text-xs w-3">{stars}</span><Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" /><div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-slate-600 text-xs w-6 text-right">{count}</span></div>
              })}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium">Avis</h3>
                {loadingReviews && <Loader2 size={14} className="animate-spin text-slate-500" />}
              </div>
              <div className="flex items-center gap-1">
                {([
                  { key: 'all' as const, label: 'Tous', count: reviews.length },
                  { key: 'unreplied' as const, label: 'Sans réponse', count: reviews.filter(r => !r.reviewReply?.comment).length },
                  { key: 'replied' as const, label: 'Répondus', count: reviews.filter(r => r.reviewReply?.comment).length },
                ]).map(f => (
                  <button key={f.key} onClick={() => setReviewFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${reviewFilter === f.key ? 'bg-[#E14B89] text-white' : 'text-slate-500 hover:text-white'}`}>
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </div>
            {!loadingReviews && reviews.length === 0 && (
              <div className="bg-[#111118] border border-slate-800 rounded-2xl p-8 text-center">
                <MessageSquare size={32} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucun avis récupéré</p>
              </div>
            )}
            {reviews.filter(r => reviewFilter === 'all' ? true : reviewFilter === 'replied' ? !!r.reviewReply?.comment : !r.reviewReply?.comment).map((review, i) => {
              const rating = ratingToNumber(review.starRating)
              const name = review.reviewer?.displayName || 'Anonyme'
              const date = review.createTime ? new Date(review.createTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
              return (
                <div key={review.reviewId || i} className={`bg-[#111118] border rounded-2xl p-5 ${review.reviewReply?.comment ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATARS[i % AVATARS.length]} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-sm font-bold">{name[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2"><p className="text-white text-sm font-medium truncate">{name}</p><span className="text-slate-600 text-xs flex-shrink-0">{date}</span></div>
                      <StarRating rating={rating} size={12} />
                    </div>
                  </div>
                  {review.comment && <p className="text-slate-400 text-sm leading-relaxed">{review.comment}</p>}
                  {review.reviewReply?.comment ? (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-slate-800">
                      <p className="text-slate-600 text-xs mb-1 font-medium">Votre réponse</p>
                      <p className="text-slate-500 text-sm">{review.reviewReply.comment}</p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      {replyingTo === review.reviewId ? (
                        <div className="flex gap-2">
                          <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Votre réponse..." className={inputClass + ' flex-1'} onKeyDown={e => { if (e.key === 'Enter') handleReply(review.reviewId!) }} />
                          <button onClick={() => handleReply(review.reviewId!)} disabled={sendingReply || !replyText.trim()}
                            className="px-3 py-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
                            {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          </button>
                          <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="px-2 py-2 text-slate-500 hover:text-white"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setReplyingTo(review.reviewId!); setReplyText('') }}
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#E14B89] transition-colors">
                          <Reply size={12} /> Répondre
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderOptimize() {
    const STATUS_ICON = { empty: XCircle, filled: Settings, optimized: CheckCircle2 }
    const STATUS_COLOR = { empty: 'text-rose-400', filled: 'text-amber-400', optimized: 'text-emerald-400' }
    const STATUS_LABEL = { empty: 'Vide', filled: 'À optimiser', optimized: 'Optimisé' }
    const STATUS_LABEL_COLOR = { empty: 'text-rose-400 bg-rose-500/10', filled: 'text-amber-400 bg-amber-500/10', optimized: 'text-emerald-400 bg-emerald-500/10' }

    const filledCount = optimizeItems.filter(i => i.status === 'filled').length
    const emptyCount = optimizeItems.filter(i => i.status === 'empty').length

    // Circular score (from audit)
    const radius = 52, circumference = 2 * Math.PI * radius, dash = (optimizePct / 100) * circumference
    const sColor = optimizePct >= 70 ? '#4ade80' : optimizePct >= 40 ? '#fb923c' : '#f87171'
    const sText = optimizePct >= 70 ? 'text-emerald-400' : optimizePct >= 40 ? 'text-orange-400' : 'text-rose-400'

    return (
      <div className="space-y-5">
        {/* Score card with circle */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="relative" style={{ width: 120, height: 120 }}>
                <svg width={120} height={120} className="-rotate-90">
                  <circle cx={60} cy={60} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={10} />
                  <circle cx={60} cy={60} r={radius} fill="none" stroke={sColor} strokeWidth={10} strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${sText}`}>{optimizePct}</span>
                  <span className="text-slate-600 text-xs">/100</span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">Score d&apos;optimisation</h3>
              <p className="text-slate-500 text-xs mb-3">
                {optimizedCount} optimisé{optimizedCount > 1 ? 's' : ''} · {filledCount} à optimiser · {emptyCount} vide{emptyCount > 1 ? 's' : ''}
              </p>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-slate-500">Optimisé</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-slate-500">À optimiser</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-400" /><span className="text-slate-500">Vide</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111118] border border-slate-800 rounded-2xl divide-y divide-slate-800">
          {optimizeItems.map((item, i) => {
            const Icon = STATUS_ICON[item.status]
            return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-4">
                <Icon size={18} className={`${STATUS_COLOR[item.status]} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${item.status === 'optimized' ? 'text-slate-300' : 'text-slate-400'}`}>{item.label}</span>
                  <p className="text-slate-600 text-xs mt-0.5">{item.hint}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_LABEL_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                {item.field && (
                  <button onClick={() => { setEditField(item.field); setEditValue(item.field === 'description' ? (sel?.profile?.description || '') : item.field === 'phone' ? (sel?.phoneNumbers?.primaryPhone || '') : item.field === 'website' ? (sel?.websiteUri || '') : item.field === 'address' ? formatAddress(sel!) : '') }}
                    className="flex items-center gap-1.5 text-xs text-[#E14B89] hover:text-[#F8903C] border border-[#E14B89]/30 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
                    Modifier <ChevronRight size={12} />
                  </button>
                )}
              </div>
              {/* Inline edit */}
              {editField === item.field && item.field && (
                <div className="mt-3 flex gap-2 ml-8">
                  {item.field === 'description' ? (
                    <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} className={inputClass + ' flex-1 resize-none'} placeholder="Description de votre établissement..." />
                  ) : (
                    <input value={editValue} onChange={e => setEditValue(e.target.value)} className={inputClass + ' flex-1'}
                      placeholder={item.field === 'phone' ? '01 23 45 67 89' : item.field === 'website' ? 'https://...' : item.field === 'address' ? '64 Avenue André Morizet, 92100 Boulogne-Billancourt' : ''} />
                  )}
                  <div className="flex flex-col gap-1">
                    <button onClick={() => saveField(item.field, editValue)} disabled={saving}
                      className="px-3 py-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm transition-colors">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    </button>
                    <button onClick={() => setEditField(null)} className="px-3 py-2 text-slate-500 hover:text-white text-sm"><X size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )})}
        </div>
      </div>
    )
  }

  function renderPhotos() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-white mb-1">{media.length}</p><p className="text-slate-600 text-xs">Photos</p></div>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className={`text-2xl font-bold mb-1 ${media.length >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>{media.length >= 10 ? 'Bon' : media.length >= 5 ? 'Correct' : 'Insuffisant'}</p><p className="text-slate-600 text-xs">Score</p></div>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-violet-400 mb-1">5+</p><p className="text-slate-600 text-xs">Recommandé</p></div>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Galerie</h3>
            <div className="flex items-center gap-2">
              {loadingMedia && <Loader2 size={14} className="animate-spin text-slate-500" />}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0]) }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-[#E14B89]/10 text-[#E14B89] hover:bg-[#E14B89]/20 px-3 py-1.5 rounded-lg transition-colors border border-[#E14B89]/20 disabled:opacity-50">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Ajouter une photo
              </button>
            </div>
          </div>
          {/* Upload zone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-[#E14B89]/40 rounded-xl p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer group mb-4"
            onClick={() => fileRef.current?.click()}>
            <ImageIcon size={24} className="text-slate-600 group-hover:text-[#E14B89] transition-colors" />
            <p className="text-slate-400 text-xs text-center">Glisser-déposer ou <span className="text-[#E14B89]">cliquer pour ajouter</span></p>
          </div>
          {media.length > 0 ? (
            <>
              <button onClick={() => setShowGallery(!showGallery)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-3">
                <ChevronRight size={12} className={`transition-transform ${showGallery ? 'rotate-90' : ''}`} />
                {showGallery ? 'Masquer' : 'Voir'} les {media.length} photos publiées
              </button>
              {showGallery && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                  {media.map((m, i) => (
                    <a key={i} href={m.googleUrl || '#'} target="_blank" rel="noopener noreferrer"
                      className="aspect-square rounded-xl overflow-hidden bg-[#0d0d14] border border-slate-800/60 hover:border-[#E14B89]/40 transition-colors">
                      {(m.googleUrl || m.thumbnailUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.thumbnailUrl || m.googleUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-slate-800" /></div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : !loadingMedia ? (
            <div className="py-4 text-center"><p className="text-slate-500 text-sm">Aucune photo</p></div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderPosts() {
    const TYPE_LABELS: Record<string, { label: string; color: string }> = {
      STANDARD: { label: 'Actualité', color: 'bg-blue-500/15 text-blue-400' },
      OFFER: { label: 'Offre', color: 'bg-emerald-500/15 text-emerald-400' },
      EVENT: { label: 'Événement', color: 'bg-amber-500/15 text-amber-400' },
      ALERT: { label: 'Alerte', color: 'bg-red-500/15 text-red-400' },
    }
    return (
      <div className="space-y-5">
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div><h3 className="text-white font-medium">Google Posts</h3><p className="text-slate-500 text-xs mt-0.5">Publiez sur votre fiche</p></div>
            <button onClick={() => setShowPostModal(true)} className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"><Plus size={15} /> Créer un post</button>
          </div>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="text-white font-medium">Posts publiés ({posts.length})</h3>{loadingPosts && <Loader2 size={14} className="animate-spin text-slate-500" />}</div>
          {posts.length > 0 ? (
            <div className="space-y-3">
              {posts.map((post, i) => {
                const t = TYPE_LABELS[post.topicType || 'STANDARD'] || TYPE_LABELS.STANDARD
                const d = post.createTime ? new Date(post.createTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
                return (
                  <div key={i} className="flex items-start gap-4 px-4 py-3.5 bg-[#0d0d14] border border-slate-800/60 rounded-xl">
                    {post.media?.[0]?.googleUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media[0].googleUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span><span className="text-slate-600 text-xs">{d}</span></div>
                      <p className="text-slate-300 text-sm line-clamp-2">{post.summary || '(sans contenu)'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : !loadingPosts ? (
            <div className="py-8 text-center"><FileText size={32} className="text-slate-700 mx-auto mb-3" /><p className="text-slate-400 text-sm">Aucun post</p></div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderAudit() {
    const radius = 52, circumference = 2 * Math.PI * radius, dash = (auditScore / 100) * circumference
    const sColor = auditScore >= 70 ? '#4ade80' : auditScore >= 45 ? '#fb923c' : '#f87171'
    const sText = auditScore >= 70 ? 'text-emerald-400' : auditScore >= 45 ? 'text-orange-400' : 'text-rose-400'
    const iColor = (s: number) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-orange-400' : 'text-rose-400'
    const iBar = (s: number) => s >= 70 ? 'bg-emerald-400' : s >= 40 ? 'bg-orange-400' : 'bg-rose-400'
    return (
      <div className="space-y-5">
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="relative" style={{ width: 128, height: 128 }}>
                <svg width={128} height={128} className="-rotate-90">
                  <circle cx={64} cy={64} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={10} />
                  <circle cx={64} cy={64} r={radius} fill="none" stroke={sColor} strokeWidth={10} strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className={`text-3xl font-bold ${sText}`}>{auditScore}</span><span className="text-slate-600 text-xs">/100</span></div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium mb-1">Audit de votre fiche</h3>
              <p className="text-slate-500 text-xs mb-4">{auditScore < 50 ? 'Améliorations nécessaires' : auditScore < 75 ? 'Correcte, peut être améliorée' : 'Bien optimisée'}</p>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /><span className="text-slate-400">Bon (70+)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-400" /><span className="text-slate-400">Moyen</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span className="text-slate-400">Faible</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#111118] border border-slate-800 rounded-2xl divide-y divide-slate-800">
          {auditItems.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className={`text-sm font-bold w-10 text-right flex-shrink-0 ${iColor(item.score)}`}>{item.score}%</div>
              <div className="flex-1 min-w-0"><p className="text-slate-300 text-sm mb-1.5">{item.label}</p><div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${iBar(item.score)}`} style={{ width: `${item.score}%`, opacity: 0.7 }} /></div></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Project tab ──
  async function saveProject() {
    if (!sel?.name || !sel?.accountName) return
    setSavingProject(true)
    try {
      const res = await fetch('/api/gmb/project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: sel.name, locationName: sel.title || '', accountId: sel.accountName,
          businessName: projectForm.businessName, sector: projectForm.sector, zone: projectForm.zone,
          keywords: projectForm.keywords.split(',').map(k => k.trim()).filter(Boolean),
          targetAudience: projectForm.targetAudience, tone: projectForm.tone,
          directives: projectForm.directives, services: projectForm.services,
          uniquePoints: projectForm.uniquePoints, postsPerMonth: projectForm.postsPerMonth,
          postTime: projectForm.postTime, recapEnabled: projectForm.recapEnabled,
          recapFrequency: projectForm.recapFrequency, recapEmail: projectForm.recapEmail,
        }),
      })
      const d = await res.json()
      setGmbProject(d.project)
    } finally { setSavingProject(false) }
  }

  async function createPortal() {
    if (!sel?.name || !sel?.accountName) return
    setCreatingPortal(true)
    try {
      // Auto-create project if needed
      let projectId = gmbProject?.id
      if (!projectId) {
        const projRes = await fetch('/api/gmb/project', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId: sel.name, locationName: sel.title || '', accountId: sel.accountName, businessName: sel.title || '' }),
        })
        const projData = await projRes.json()
        projectId = projData.project?.id
        setGmbProject(projData.project)
      }
      if (!projectId) return
      const res = await fetch('/api/gmb/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clientName: projectForm.businessName || sel.title }),
      })
      const d = await res.json()
      if (d.portal?.token) setPortalUrl(`${window.location.origin}/gmb-photos/${d.portal.token}`)
    } finally { setCreatingPortal(false) }
  }

  async function generateAiPosts() {
    if (!gmbProject?.id) { alert('Sauvegardez le projet d\'abord'); return }
    setGeneratingPosts(true)
    try {
      const res = await fetch('/api/gmb/scheduled-posts/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: gmbProject.id, count: projectForm.postsPerMonth }),
      })
      const d = await res.json()
      if (d.posts) setScheduledPosts(prev => [...prev, ...d.posts])
      if (d.error) alert(`Erreur: ${d.error}`)
    } finally { setGeneratingPosts(false) }
  }

  async function deleteScheduledPost(id: string) {
    await fetch(`/api/gmb/scheduled-posts?id=${id}`, { method: 'DELETE' })
    setScheduledPosts(prev => prev.filter(p => p.id !== id))
  }

  async function uploadScheduledPhoto(file: File) {
    if (!gmbProject?.id || !schedPhotoDate) return
    setUploadingSchedPhoto(true)
    try {
      const form = new FormData()
      form.append('projectId', gmbProject.id)
      form.append('file', file)
      form.append('scheduledAt', new Date(schedPhotoDate).toISOString())
      const res = await fetch('/api/gmb/scheduled-photos', { method: 'POST', body: form })
      const d = await res.json()
      if (d.photo) setScheduledPhotos(prev => [...prev, d.photo])
    } finally { setUploadingSchedPhoto(false) }
  }

  async function deleteScheduledPhoto(id: string) {
    await fetch(`/api/gmb/scheduled-photos?id=${id}`, { method: 'DELETE' })
    setScheduledPhotos(prev => prev.filter(p => p.id !== id))
  }

  function renderProject() {
    const f = projectForm
    const set = (field: string, val: string | number | boolean) => setProjectForm(prev => ({ ...prev, [field]: val }))
    return (
      <div className="space-y-5">
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-5">Informations du projet</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-slate-400 text-xs mb-1.5 block">Nom de l&apos;entreprise</label><input value={f.businessName} onChange={e => set('businessName', e.target.value)} className={inputClass} placeholder="Ex: Atelier Songe" /></div>
            <div><label className="text-slate-400 text-xs mb-1.5 block">Secteur d&apos;activité</label><input value={f.sector} onChange={e => set('sector', e.target.value)} className={inputClass} placeholder="Ex: Restauration de meubles" /></div>
            <div><label className="text-slate-400 text-xs mb-1.5 block">Zone géographique</label><input value={f.zone} onChange={e => set('zone', e.target.value)} className={inputClass} placeholder="Ex: Montgeron, Essonne" /></div>
            <div><label className="text-slate-400 text-xs mb-1.5 block">Public cible</label><input value={f.targetAudience} onChange={e => set('targetAudience', e.target.value)} className={inputClass} placeholder="Ex: Particuliers, antiquaires" /></div>
            <div className="sm:col-span-2"><label className="text-slate-400 text-xs mb-1.5 block">Mots-clés cibles (séparés par des virgules)</label><input value={f.keywords} onChange={e => set('keywords', e.target.value)} className={inputClass} placeholder="Ex: restauration meuble, ébéniste, meuble ancien" /></div>
            <div className="sm:col-span-2"><label className="text-slate-400 text-xs mb-1.5 block">Services proposés</label><textarea value={f.services} onChange={e => set('services', e.target.value)} rows={2} className={inputClass + ' resize-none'} placeholder="Ex: Restauration, relooking, patine, vernis..." /></div>
            <div className="sm:col-span-2"><label className="text-slate-400 text-xs mb-1.5 block">Points forts / différenciants</label><textarea value={f.uniquePoints} onChange={e => set('uniquePoints', e.target.value)} rows={2} className={inputClass + ' resize-none'} placeholder="Ex: 20 ans d'expérience, travail artisanal..." /></div>
          </div>
        </div>

        <button onClick={saveProject} disabled={savingProject}
          className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
          {savingProject ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Sauvegarder le projet
        </button>
      </div>
    )
  }

  function renderRecaps() {
    const f = projectForm
    const set = (field: string, val: string | number | boolean) => setProjectForm(prev => ({ ...prev, [field]: val }))
    return (
      <div className="space-y-5">
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-medium">Récaps automatiques</h3>
              <p className="text-slate-500 text-xs mt-0.5">Envoyez un rapport automatique au client sur l&apos;activité de sa fiche</p>
            </div>
            <button onClick={() => set('recapEnabled', !f.recapEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${f.recapEnabled ? 'bg-[#E14B89]' : 'bg-slate-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${f.recapEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {f.recapEnabled && (
            <div className="space-y-4">
              <div><label className="text-slate-400 text-xs mb-1.5 block">Email du client</label><input type="email" value={f.recapEmail} onChange={e => set('recapEmail', e.target.value)} className={inputClass} placeholder="client@example.com" /></div>
              <div><label className="text-slate-400 text-xs mb-1.5 block">Fréquence</label>
                <select value={f.recapFrequency} onChange={e => set('recapFrequency', e.target.value)} className={inputClass}>
                  <option value="HEBDO">Hebdomadaire</option><option value="MENSUEL">Mensuel</option>
                </select>
              </div>
              <div className="bg-[#0d0d14] border border-slate-800/60 rounded-xl p-4">
                <p className="text-slate-400 text-xs font-medium mb-3">Contenu du récap :</p>
                <div className="space-y-2.5">
                  {[
                    { key: 'recapIncludeReviews', label: 'Note moyenne et nombre d\'avis' },
                    { key: 'recapIncludePerf', label: 'Vues du profil et interactions' },
                    { key: 'recapIncludePosts', label: 'Posts publiés sur la période' },
                    { key: 'recapIncludePhotos', label: 'Photos ajoutées' },
                    { key: 'recapIncludeOptimize', label: 'Recommandations d\'optimisation' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        (f as unknown as Record<string, boolean>)[opt.key] ? 'bg-[#E14B89] border-[#E14B89]' : 'border-slate-600 group-hover:border-slate-500'
                      }`} onClick={() => set(opt.key, !(f as unknown as Record<string, boolean>)[opt.key])}>
                        {(f as unknown as Record<string, boolean>)[opt.key] ? <CheckCircle2 size={10} className="text-white" /> : null}
                      </div>
                      <span className="text-slate-400 text-xs">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <button onClick={saveProject} disabled={savingProject}
          className="w-full bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
          {savingProject ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Sauvegarder
        </button>
      </div>
    )
  }

  // Update photos tab to include scheduling + portal
  const renderPhotosEnhanced = () => {
    const planned = scheduledPhotos.filter(p => p.status === 'PLANIFIE')

    return (
      <div className="space-y-5">
        {/* Actions bar */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span><span className="text-white font-bold text-sm">{media.length}</span> sur Google</span>
              <span className="text-slate-700">|</span>
              <span><span className="text-violet-400 font-bold text-sm">{planned.length}</span> planifiées</span>
            </div>
            <div className="flex items-center gap-2">
              {portalUrl ? (
                <button onClick={() => navigator.clipboard.writeText(portalUrl)} className="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  <Copy size={12} /> Drive client
                </button>
              ) : (
                <button onClick={createPortal} disabled={creatingPortal} className="flex items-center gap-1.5 text-xs bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-50">
                  {creatingPortal ? <Loader2 size={12} className="animate-spin" /> : <Link size={12} />} Créer drive client
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0]) }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-xs bg-[#E14B89]/10 text-[#E14B89] px-3 py-1.5 rounded-lg border border-[#E14B89]/20 disabled:opacity-50">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Publier maintenant
              </button>
            </div>
          </div>
          {portalUrl && <p className="text-slate-500 text-xs font-mono bg-[#0d0d14] rounded-lg px-3 py-2 mt-3 truncate">{portalUrl}</p>}
        </div>

        {/* Planifier */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-medium mb-3">Planifier une photo</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1"><label className="text-slate-400 text-xs mb-1.5 block">Date</label><input type="date" value={schedPhotoDate} onChange={e => setSchedPhotoDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className={inputClass} /></div>
            <input ref={schedPhotoRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadScheduledPhoto(e.target.files[0]) }} />
            <button onClick={() => schedPhotoRef.current?.click()} disabled={uploadingSchedPhoto || !schedPhotoDate}
              className="px-4 py-2.5 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
              {uploadingSchedPhoto ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />} Planifier
            </button>
          </div>
          {/* Photos planifiées inline */}
          {planned.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-4">
              {planned.map(p => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-[#0d0d14] border border-violet-500/20 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 flex items-center justify-between">
                    <span className="text-white text-[9px]">{new Date(p.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                    <button onClick={() => deleteScheduledPhoto(p.id)} className="text-red-400 hover:text-red-300"><X size={9} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Galerie Google */}
        {media.length > 0 && (
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <button onClick={() => setShowGallery(!showGallery)} className="flex items-center gap-2 text-sm text-white font-medium w-full">
              <ChevronRight size={14} className={`transition-transform text-slate-500 ${showGallery ? 'rotate-90' : ''}`} />
              Photos publiées ({media.length})
              {loadingMedia && <Loader2 size={12} className="animate-spin text-slate-500 ml-auto" />}
            </button>
            {showGallery && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {media.map((m, i) => (
                  <a key={i} href={m.googleUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden bg-[#0d0d14] border border-slate-800/60 hover:border-[#E14B89]/40 transition-colors">
                    {(m.googleUrl || m.thumbnailUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnailUrl || m.googleUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-slate-800" /></div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Update posts tab with AI generation + scheduling
  const renderPostsEnhanced = () => {
    const TYPE_LABELS: Record<string, { label: string; color: string }> = {
      STANDARD: { label: 'Actualité', color: 'bg-blue-500/15 text-blue-400' },
      OFFER: { label: 'Offre', color: 'bg-emerald-500/15 text-emerald-400' },
      EVENT: { label: 'Événement', color: 'bg-amber-500/15 text-amber-400' },
    }
    const planned = scheduledPosts.filter(p => p.status === 'PLANIFIE')
    const published = scheduledPosts.filter(p => p.status === 'PUBLIE')

    return (
      <div className="space-y-5">
        {/* Actions */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div><h3 className="text-white font-medium">Google Posts</h3><p className="text-slate-500 text-xs mt-0.5">{projectForm.postsPerMonth} posts/mois configurés</p></div>
            <div className="flex items-center gap-2">
              <button onClick={generateAiPosts} disabled={generatingPosts || !gmbProject}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                {generatingPosts ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Générer {projectForm.postsPerMonth} posts IA
              </button>
              <button onClick={() => setShowPostModal(true)}
                className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                <Plus size={14} /> Manuel
              </button>
            </div>
          </div>
          {!gmbProject && <p className="text-amber-400 text-xs mt-3">Remplissez l&apos;onglet Projet pour utiliser la génération IA</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-violet-400 mb-1">{planned.length}</p><p className="text-slate-600 text-xs">Planifiés</p></div>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-emerald-400 mb-1">{published.length}</p><p className="text-slate-600 text-xs">Publiés auto</p></div>
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center"><p className="text-2xl font-bold text-blue-400 mb-1">{posts.length}</p><p className="text-slate-600 text-xs">Sur Google</p></div>
        </div>

        {/* Planned posts */}
        {planned.length > 0 && (
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-medium mb-3">Posts planifiés</h3>
            <div className="space-y-3">
              {planned.map(post => {
                const t = TYPE_LABELS[post.topicType] || TYPE_LABELS.STANDARD
                return (
                  <div key={post.id} className="flex items-start gap-4 px-4 py-3.5 bg-[#0d0d14] border border-slate-800/60 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span>
                        <span className="text-slate-600 text-xs flex items-center gap-1"><Calendar size={10} />{new Date(post.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        {post.aiGenerated && <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400"><Sparkles size={9} className="inline mr-0.5" />IA</span>}
                      </div>
                      <p className="text-slate-300 text-sm">{post.content}</p>
                    </div>
                    <button onClick={() => deleteScheduledPost(post.id)} className="text-slate-600 hover:text-red-400 flex-shrink-0 mt-1"><X size={14} /></button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Published posts from Google */}
        {posts.length > 0 && (
          <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <h3 className="text-white font-medium mb-3">Posts publiés sur Google ({posts.length})</h3>
            <div className="space-y-3">
              {posts.map((post, i) => {
                const t = TYPE_LABELS[post.topicType || 'STANDARD'] || TYPE_LABELS.STANDARD
                const d = post.createTime ? new Date(post.createTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
                return (
                  <div key={i} className="flex items-start gap-4 px-4 py-3.5 bg-[#0d0d14] border border-slate-800/60 rounded-xl">
                    {post.media?.[0]?.googleUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media[0].googleUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span><span className="text-slate-600 text-xs">{d}</span></div>
                      <p className="text-slate-300 text-sm line-clamp-2">{post.summary || '(sans contenu)'}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Paramètres de contenu */}
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-medium mb-4">Paramètres de contenu</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-slate-400 text-xs mb-1.5 block">Ton du contenu</label>
              <select value={projectForm.tone} onChange={e => setProjectForm(prev => ({ ...prev, tone: e.target.value }))} className={inputClass}>
                <option value="professionnel">Professionnel</option><option value="convivial">Convivial</option><option value="expert">Expert</option><option value="decontracte">Décontracté</option>
              </select>
            </div>
            <div><label className="text-slate-400 text-xs mb-1.5 block">Posts par mois</label><input type="number" min={1} max={30} value={projectForm.postsPerMonth} onChange={e => setProjectForm(prev => ({ ...prev, postsPerMonth: parseInt(e.target.value) || 4 }))} className={inputClass} /></div>
            <div><label className="text-slate-400 text-xs mb-1.5 block">Heure de publication</label><input type="time" value={projectForm.postTime} onChange={e => setProjectForm(prev => ({ ...prev, postTime: e.target.value }))} className={inputClass} /></div>
            <div className="sm:col-span-2"><label className="text-slate-400 text-xs mb-1.5 block">Directives personnalisées</label><textarea value={projectForm.directives} onChange={e => setProjectForm(prev => ({ ...prev, directives: e.target.value }))} rows={3} className={inputClass + ' resize-none'} placeholder="Ex: Ne pas mentionner les prix, toujours inclure un emoji..." /></div>
          </div>
          <button onClick={saveProject} disabled={savingProject} className="mt-4 flex items-center gap-2 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            {savingProject ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
          </button>
        </div>
      </div>
    )
  }

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    dashboard: renderDashboard, reviews: renderReviews, optimize: renderOptimize,
    photos: renderPhotosEnhanced, posts: renderPostsEnhanced,
    project: renderProject, recaps: renderRecaps,
  }

  // ═══ RENDER ═══
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {pageLoading ? (
        <div className="flex items-center justify-center py-32"><Loader2 size={24} className="animate-spin text-slate-500" /></div>
      ) : !gmbConnected ? (
        <div className="bg-[#111118] border border-[#4285F4]/30 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-2xl font-black leading-none" style={{ background: 'linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>
            </div>
            <div><p className="text-white font-medium">Compte Google non connecté</p><p className="text-slate-400 text-sm mt-0.5">Connectez-vous pour gérer vos fiches</p></div>
          </div>
          <button onClick={handleConnect} disabled={connecting} className="flex items-center gap-2 bg-white text-slate-800 font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50 transition-colors flex-shrink-0 shadow-sm">
            {connecting ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base font-black leading-none" style={{ background: 'linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>G</span>}
            Connecter Google
          </button>
        </div>
      ) : (
        <>
          {((): React.ReactNode => {
            const selVerified = sel?.metadata?.hasVoiceOfMerchant ?? false
            const borderColor = selVerified ? 'border-emerald-500/30' : 'border-amber-500/30'
            const iconBg = selVerified ? 'bg-emerald-500/15' : 'bg-amber-500/15'
            const iconColor = selVerified ? 'text-emerald-400' : 'text-amber-400'
            const StatusIcon = selVerified ? CheckCircle2 : ShieldCheck
            const verifiedLocs = locations.filter(l => l.metadata?.hasVoiceOfMerchant)
            const unverifiedLocs = locations.filter(l => !l.metadata?.hasVoiceOfMerchant)

            return (
              <div className={`bg-[#111118] border ${borderColor} rounded-2xl p-5 mb-6`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}><StatusIcon size={20} className={iconColor} /></div>
                    <div className="relative flex-1 min-w-0">
                      <button onClick={() => setShowPicker(!showPicker)} className="flex items-center gap-2 w-full text-left">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium text-sm truncate">{sel?.title || 'Sélectionner une fiche'}</p>
                            {sel && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${selVerified ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{selVerified ? 'Validée' : 'Non validée'}</span>}
                          </div>
                          <p className="text-slate-500 text-xs truncate">{sel ? (sel.categories?.primaryCategory?.displayName || formatAddress(sel)) : `${locations.length} fiche${locations.length > 1 ? 's' : ''}`}</p>
                        </div>
                        <ChevronDown size={14} className={`text-slate-500 flex-shrink-0 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                      </button>
                      {showPicker && (
                        <div className="absolute top-full left-0 mt-2 w-full sm:w-96 bg-[#0d0d14] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                          <div className="max-h-80 overflow-y-auto">
                            {verifiedLocs.length > 0 && (
                              <>
                                <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2"><ShieldCheck size={12} className="text-emerald-400" /><span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Validées ({verifiedLocs.length})</span></div>
                                {verifiedLocs.map((loc, i) => (
                                  <button key={`v-${i}`} onClick={() => { setSel(loc); setShowPicker(false) }} className={`w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-center gap-3 ${sel?.name === loc.name ? 'bg-slate-800/30' : ''}`}>
                                    <LocLogo loc={loc} fallbackColor="text-emerald-400" />
                                    <div className="min-w-0 flex-1"><p className="text-white text-sm truncate">{loc.title || 'Sans nom'}</p><p className="text-slate-500 text-xs truncate">{formatAddress(loc)}</p></div>
                                    {sel?.name === loc.name && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                                  </button>
                                ))}
                              </>
                            )}
                            {unverifiedLocs.length > 0 && (
                              <>
                                <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2"><ShieldCheck size={12} className="text-amber-400" /><span className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider">Non validées ({unverifiedLocs.length})</span></div>
                                {unverifiedLocs.map((loc, i) => (
                                  <button key={`u-${i}`} onClick={() => { setSel(loc); setShowPicker(false) }} className={`w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-center gap-3 ${sel?.name === loc.name ? 'bg-slate-800/30' : ''}`}>
                                    <LocLogo loc={loc} fallbackColor="text-amber-400" />
                                    <div className="min-w-0 flex-1"><p className="text-white text-sm truncate">{loc.title || 'Sans nom'}</p><p className="text-slate-500 text-xs truncate">{formatAddress(loc)}</p></div>
                                    {sel?.name === loc.name && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleRefresh} disabled={refreshing} className="flex items-center justify-center w-9 h-9 border border-slate-700 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 rounded-xl transition-colors" title="Rafraîchir"><RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /></button>
                    <button onClick={handleDisconnect} disabled={disconnecting} className="flex items-center gap-2 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-medium px-3.5 py-2 rounded-xl text-xs transition-colors">
                      {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />} Déconnecter
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
          {sel ? (
            <>
              <div className="flex gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
                {TABS.map(tab => { const Icon = tab.icon; return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 ${activeTab === tab.key ? 'bg-[#E14B89] text-white' : 'text-slate-400 hover:text-white'}`}><Icon size={13} /> {tab.label}</button>
                )})}
              </div>
              <div>{tabContent[activeTab]()}</div>
            </>
          ) : (
            <div className="bg-[#111118] border border-slate-800 rounded-2xl p-12 text-center"><Building2 size={40} className="text-slate-700 mx-auto mb-3" /><p className="text-slate-400 text-sm">Aucune fiche trouvée</p></div>
          )}
        </>
      )}

      {/* Post modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPostModal(false)} />
          <div className="relative bg-[#111118] border border-slate-800 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5"><h2 className="text-white font-semibold text-lg">Créer un post</h2><button onClick={() => setShowPostModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button></div>
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Type</label>
                <div className="flex gap-2">
                  {[{ key: 'STANDARD', label: 'Actualité', c: 'border-blue-500/30 text-blue-400' }, { key: 'OFFER', label: 'Offre', c: 'border-emerald-500/30 text-emerald-400' }, { key: 'EVENT', label: 'Événement', c: 'border-amber-500/30 text-amber-400' }].map(t => (
                    <button key={t.key} onClick={() => setPostType(t.key)} className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${postType === t.key ? `${t.c} bg-white/5` : 'border-slate-700 text-slate-500'}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Contenu *</label>
                <textarea value={postContent} onChange={e => setPostContent(e.target.value)} rows={5} placeholder="Écrivez votre post..." className={inputClass + ' resize-none'} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPostModal(false)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white py-2.5 rounded-xl text-sm transition-colors">Annuler</button>
                <button onClick={handleCreatePost} disabled={creatingPost || !postContent.trim()} className="flex-1 bg-[#E14B89] hover:opacity-90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {creatingPost ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
