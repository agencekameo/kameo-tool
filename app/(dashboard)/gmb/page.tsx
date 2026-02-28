'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  Settings,
  Image,
  Star,
  FileText,
  Search,
  MapPin,
  Phone,
  Eye,
  TrendingUp,
  Plus,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lock,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'dashboard' | 'optimize' | 'photos' | 'reviews' | 'posts' | 'audit'

interface Tab {
  key: TabKey
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: Tab[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'optimize', label: 'Optimiser', icon: Settings },
  { key: 'photos', label: 'Photos', icon: Image },
  { key: 'reviews', label: 'Avis', icon: Star },
  { key: 'posts', label: 'Google Posts', icon: FileText },
  { key: 'audit', label: 'Audit', icon: Search },
]

const OPTIMIZE_ITEMS = [
  { label: 'Description complète', done: false },
  { label: 'Horaires à jour', done: true },
  { label: 'Photos récentes (< 3 mois)', done: false },
  { label: 'Services listés', done: true },
  { label: 'Questions-réponses actives', done: false },
  { label: 'Catégorie principale définie', done: true },
  { label: 'Numéro de téléphone vérifié', done: true },
]

const AUDIT_ITEMS = [
  { label: 'Description & présentation', score: 45 },
  { label: 'Galerie photos', score: 30 },
  { label: 'Avis clients & réponses', score: 60 },
  { label: 'Horaires d\'ouverture', score: 85 },
  { label: 'Catégories & attributs', score: 70 },
  { label: 'Posts & actualités', score: 10 },
  { label: 'Questions-réponses', score: 20 },
]

const MOCK_REVIEWS = [
  { name: 'Sophie M.', rating: 5, comment: 'Excellent service, site très professionnel et livré dans les délais.', avatar: 'S', color: 'from-violet-500 to-purple-700' },
  { name: 'Thomas R.', rating: 4, comment: 'Très bonne expérience, équipe réactive et à l\'écoute de nos besoins.', avatar: 'T', color: 'from-blue-500 to-blue-700' },
  { name: 'Marie L.', rating: 5, comment: 'Je recommande vivement ! Résultat impeccable et suivi parfait.', avatar: 'M', color: 'from-emerald-500 to-teal-700' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionNote() {
  return (
    <div className="mt-6 flex items-center gap-2.5 px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-500">
      <Lock size={13} className="flex-shrink-0 text-slate-600" />
      <span>
        Connexion Google requise pour accéder aux données réelles. Les informations affichées sont des exemples.
      </span>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  change,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  change?: string
}) {
  return (
    <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
        {change && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-500 mb-1">{value}</p>
      <p className="text-slate-500 text-xs">{label}</p>
    </div>
  )
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function DashboardTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Vues du profil" value="--" icon={Eye} color="bg-blue-500/15 text-blue-400" change="+--%" />
        <KpiCard label="Recherches" value="--" icon={Search} color="bg-violet-500/15 text-violet-400" change="+--%" />
        <KpiCard label="Appels téléphoniques" value="--" icon={Phone} color="bg-emerald-500/15 text-emerald-400" />
        <KpiCard label="Itinéraires" value="--" icon={MapPin} color="bg-amber-500/15 text-amber-400" />
      </div>

      {/* Chart placeholder */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-medium">Visibilité sur 30 jours</h3>
            <p className="text-slate-500 text-xs mt-0.5">Vues, recherches et actions</p>
          </div>
          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs border border-slate-800 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={11} /> Actualiser
          </button>
        </div>
        <div className="h-48 bg-[#0d0d14] border border-slate-800/60 rounded-xl flex flex-col items-center justify-center gap-3">
          <TrendingUp size={32} className="text-slate-700" />
          <p className="text-slate-600 text-sm">Graphique de visibilité</p>
          <p className="text-slate-700 text-xs">Données disponibles après connexion Google</p>
        </div>
      </div>

      {/* Recent actions */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Actions récentes</h3>
        <div className="space-y-2">
          {['Mise à jour des horaires', 'Réponse à un avis', 'Publication d\'un post', 'Ajout d\'une photo'].map((action, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#0d0d14] border border-slate-800/60">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />
              <span className="text-slate-500 text-sm flex-1">{action}</span>
              <span className="text-slate-700 text-xs">--/--/----</span>
            </div>
          ))}
        </div>
      </div>

      <ConnectionNote />
    </div>
  )
}

function OptimizeTab() {
  const done = OPTIMIZE_ITEMS.filter(i => i.done).length
  const total = OPTIMIZE_ITEMS.length
  const pct = Math.round((done / total) * 100)

  return (
    <div className="space-y-5">
      {/* Score summary */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-medium">Score d&apos;optimisation</h3>
            <p className="text-slate-500 text-xs mt-0.5">{done}/{total} critères remplis</p>
          </div>
          <span className="text-2xl font-bold text-amber-400">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl divide-y divide-slate-800">
        {OPTIMIZE_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            {item.done ? (
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
            ) : (
              <XCircle size={18} className="text-rose-400 flex-shrink-0" />
            )}
            <span className={`flex-1 text-sm ${item.done ? 'text-slate-300' : 'text-slate-400'}`}>
              {item.label}
            </span>
            {!item.done && (
              <button className="flex items-center gap-1.5 text-xs text-[#E14B89] hover:text-[#F8903C] border border-[#E14B89]/30 hover:border-[#F8903C]/40 px-3 py-1.5 rounded-lg transition-colors">
                Améliorer <ChevronRight size={12} />
              </button>
            )}
            {item.done && (
              <span className="text-xs text-emerald-600 font-medium">Complété</span>
            )}
          </div>
        ))}
      </div>

      <ConnectionNote />
    </div>
  )
}

function PhotosTab() {
  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Ajouter des photos</h3>
        <div className="border-2 border-dashed border-slate-700 hover:border-[#E14B89]/40 rounded-xl p-10 flex flex-col items-center gap-3 transition-colors cursor-pointer group">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 group-hover:bg-[#E14B89]/10 flex items-center justify-center transition-colors">
            <Image size={24} className="text-slate-600 group-hover:text-[#E14B89] transition-colors" />
          </div>
          <p className="text-slate-400 text-sm text-center">
            Glisser-déposer des photos ou{' '}
            <span className="text-[#E14B89]">cliquer pour sélectionner</span>
          </p>
          <p className="text-slate-600 text-xs">PNG, JPG, WebP — max 5 Mo par fichier</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Photos au total', value: '--', color: 'text-slate-500' },
          { label: 'Vues ce mois', value: '--', color: 'text-slate-500' },
          { label: 'Score photos', value: '--/100', color: 'text-slate-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
            <p className="text-slate-600 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Photo grid placeholder */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Galerie publiée</h3>
          <button className="flex items-center gap-1.5 text-xs bg-[#E14B89]/10 text-[#E14B89] hover:bg-[#E14B89]/20 px-3 py-1.5 rounded-lg transition-colors border border-[#E14B89]/20">
            <Plus size={12} /> Planifier publication
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-[#0d0d14] border border-slate-800/60 flex items-center justify-center"
            >
              <Image size={16} className="text-slate-800" />
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs text-center mt-4">
          Connectez votre compte pour voir vos photos Google
        </p>
      </div>

      <ConnectionNote />
    </div>
  )
}

function ReviewsTab() {
  const avgRating = 4.7

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5 sm:col-span-1">
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <p className="text-5xl font-bold text-white">{avgRating}</p>
            <StarRating rating={5} size={20} />
            <p className="text-slate-500 text-sm">-- avis au total</p>
          </div>
        </div>
        <div className="sm:col-span-2 bg-[#111118] border border-slate-800 rounded-2xl p-5">
          <h3 className="text-white font-medium mb-4">Répartition des notes</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(stars => {
              const widths: Record<number, string> = { 5: '75%', 4: '15%', 3: '7%', 2: '2%', 1: '1%' }
              return (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs w-3">{stars}</span>
                  <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full opacity-40"
                      style={{ width: widths[stars] }}
                    />
                  </div>
                  <span className="text-slate-600 text-xs w-8 text-right">{widths[stars]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {MOCK_REVIEWS.map((review, i) => (
          <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${review.color} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-white text-sm font-bold">{review.avatar}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-sm font-medium">{review.name}</p>
                  <span className="text-slate-600 text-xs flex-shrink-0">il y a -- jours</span>
                </div>
                <StarRating rating={review.rating} size={12} />
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed opacity-60">{review.comment}</p>
            <div className="mt-4 flex justify-end">
              <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors">
                Répondre <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConnectionNote />
    </div>
  )
}

function PostsTab() {
  const POST_TYPES = [
    { label: 'Actualité', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    { label: 'Offre', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    { label: 'Événement', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  ]

  return (
    <div className="space-y-5">
      {/* Create post */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium">Créer un post Google</h3>
            <p className="text-slate-500 text-xs mt-0.5">Publiez des actualités, offres et événements</p>
          </div>
          <button className="flex items-center gap-2 bg-[#E14B89] hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <Plus size={15} /> Créer un post
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {POST_TYPES.map(type => (
            <button
              key={type.label}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors hover:opacity-80 ${type.color}`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled posts */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-medium mb-4">Posts planifiés</h3>
        <div className="space-y-3">
          {[
            { type: 'Actualité', title: 'Nouveau service de maintenance SEO', date: '--/--/----', color: 'bg-blue-500/15 text-blue-400' },
            { type: 'Offre', title: 'Promotion été — 20% sur les sites vitrines', date: '--/--/----', color: 'bg-emerald-500/15 text-emerald-400' },
            { type: 'Événement', title: 'Webinaire : optimiser son SEO local', date: '--/--/----', color: 'bg-amber-500/15 text-amber-400' },
          ].map((post, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3.5 bg-[#0d0d14] border border-slate-800/60 rounded-xl opacity-60"
            >
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${post.color}`}>
                {post.type}
              </span>
              <span className="text-slate-400 text-sm flex-1 truncate">{post.title}</span>
              <span className="text-slate-600 text-xs flex-shrink-0">{post.date}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs text-center mt-4">
          Aucun post planifié — connectez votre compte pour commencer
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {['Vues des posts', 'Clics', 'Posts ce mois'].map((label, i) => (
          <div key={i} className="bg-[#111118] border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-600 mb-1">--</p>
            <p className="text-slate-600 text-xs">{label}</p>
          </div>
        ))}
      </div>

      <ConnectionNote />
    </div>
  )
}

function AuditTab() {
  const overallScore = Math.round(
    AUDIT_ITEMS.reduce((sum, item) => sum + item.score, 0) / AUDIT_ITEMS.length
  )

  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dash = (overallScore / 100) * circumference

  const scoreColor =
    overallScore >= 70 ? '#4ade80' : overallScore >= 45 ? '#fb923c' : '#f87171'
  const scoreTextColor =
    overallScore >= 70 ? 'text-emerald-400' : overallScore >= 45 ? 'text-orange-400' : 'text-rose-400'

  const itemScoreColor = (score: number) =>
    score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-orange-400' : 'text-rose-400'

  const itemBarColor = (score: number) =>
    score >= 70 ? 'bg-emerald-400' : score >= 40 ? 'bg-orange-400' : 'bg-rose-400'

  return (
    <div className="space-y-5">
      {/* Score card */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-8">
          {/* Circular score */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="relative" style={{ width: 128, height: 128 }}>
              <svg width={128} height={128} className="-rotate-90">
                <circle cx={64} cy={64} r={radius} fill="none" stroke="#1e1e2e" strokeWidth={10} />
                <circle
                  cx={64}
                  cy={64}
                  r={radius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth={10}
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${scoreTextColor}`}>{overallScore}</span>
                <span className="text-slate-600 text-xs">/100</span>
              </div>
            </div>
            <p className="text-slate-400 text-xs">Score GMB global</p>
          </div>

          {/* Score details */}
          <div className="flex-1">
            <h3 className="text-white font-medium mb-1">Audit de votre fiche</h3>
            <p className="text-slate-500 text-xs mb-4">
              {overallScore < 50
                ? 'Votre fiche nécessite des améliorations importantes'
                : overallScore < 75
                ? 'Votre fiche est correcte mais peut être améliorée'
                : 'Votre fiche est bien optimisée'}
            </p>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-400">Bon (70+)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span className="text-slate-400">Moyen (40–69)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-slate-400">Faible (&lt;40)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audit checklist */}
      <div className="bg-[#111118] border border-slate-800 rounded-2xl divide-y divide-slate-800">
        {AUDIT_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className={`text-sm font-bold w-10 text-right flex-shrink-0 ${itemScoreColor(item.score)}`}>
              {item.score}%
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 text-sm mb-1.5">{item.label}</p>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${itemBarColor(item.score)}`}
                  style={{ width: `${item.score}%`, opacity: 0.7 }}
                />
              </div>
            </div>
            {item.score < 70 && (
              <button className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-500 hover:text-white border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors">
                Améliorer <ChevronRight size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      <ConnectionNote />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GmbPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')

  const tabContent: Record<TabKey, React.ReactNode> = {
    dashboard: <DashboardTab />,
    optimize: <OptimizeTab />,
    photos: <PhotosTab />,
    reviews: <ReviewsTab />,
    posts: <PostsTab />,
    audit: <AuditTab />,
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <span
              className="text-lg font-black leading-none"
              style={{
                background: 'linear-gradient(135deg, #4285F4 0%, #EA4335 40%, #FBBC05 70%, #34A853 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              G
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Google My Business</h1>
        </div>
        <p className="text-slate-400 text-sm mt-1 ml-12">Gérez vos fiches Google</p>
      </div>

      {/* Connection banner */}
      <div className="bg-[#111118] border border-[#4285F4]/30 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span
              className="text-2xl font-black leading-none"
              style={{
                background: 'linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              G
            </span>
          </div>
          <div>
            <p className="text-white font-medium">Compte Google non connecté</p>
            <p className="text-slate-400 text-sm mt-0.5">
              Connectez-vous pour gérer vos fiches Google My Business
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-white text-slate-800 font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-slate-100 transition-colors flex-shrink-0 shadow-sm">
          <span
            className="text-base font-black leading-none"
            style={{
              background: 'linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            G
          </span>
          Connecter Google
        </button>
      </div>

      {/* Feature tabs */}
      <div className="flex gap-1 bg-[#111118] border border-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === tab.key
                  ? 'bg-[#E14B89] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]}</div>
    </div>
  )
}
