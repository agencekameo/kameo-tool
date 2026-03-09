'use client'

import { useState, useEffect, useCallback } from 'react'
import { Presentation, Lightbulb, Play, ChevronRight, ChevronDown, Video, Mic, Target, MonitorPlay, Clock, MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, XCircle, TrendingUp, User, Users } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
type Tab = 'structure' | 'conseils' | 'videos' | 'ameliorations'

interface Step {
  label: string
  duration: string
  objectif: string
  details: string[]
  exemple?: string
}

interface DoOrDont {
  text: string
}

interface ConseilCard {
  title: string
  icon: typeof Lightbulb
  color: string
  dos: DoOrDont[]
  donts: DoOrDont[]
}

interface VideoItem {
  title: string
  description: string
  url: string
  duration: string
  category: string
}

interface AmeliorationSection {
  title: string
  icon: typeof User
  color: string
  bgColor: string
  items: { key: string; text: string }[]
}

// ─── Data : Structure du speech visio ───────────────────────────────────────
const VISIO_STEPS: Step[] = [
  {
    label: 'Brise-glace & connexion',
    duration: '2-3 min',
    objectif: 'Créer un lien humain et mettre à l\'aise le prospect.',
    details: [
      'Saluer avec énergie et sourire (webcam allumée obligatoire)',
      'Petit talk naturel : "Comment ça va ? Vous êtes basé où exactement ?"',
      'Montrer qu\'on a fait ses devoirs : "J\'ai vu que vous aviez lancé [activité], c\'est super"',
      'Annoncer le cadre : "Je vous propose qu\'on prenne 30 min, je vais d\'abord vous poser quelques questions, puis je vous montre ce qu\'on peut faire pour vous. Ça vous va ?"',
    ],
  },
  {
    label: 'Découverte & diagnostic',
    duration: '8-10 min',
    objectif: 'Comprendre les besoins, la situation actuelle, les douleurs.',
    details: [
      'Poser des questions ouvertes : "Comment vos clients vous trouvent aujourd\'hui ?"',
      'Creuser les problèmes : "Qu\'est-ce qui vous freine le plus pour développer votre activité en ligne ?"',
      'Quantifier : "Combien de demandes vous recevez par mois via le web ?"',
      'Identifier la situation rêvée : "Dans un monde idéal, qu\'est-ce que vous aimeriez que votre site vous apporte ?"',
    ],
    exemple: 'Reformuler : "Si je comprends bien, aujourd\'hui vous dépendez surtout du bouche-à-oreille et vous aimeriez que votre site devienne une vraie source de clients. C\'est bien ça ?"',
  },
  {
    label: 'Présentation de l\'agence',
    duration: '3-5 min',
    objectif: 'Positionner Kameo comme la solution experte et de confiance.',
    details: [
      'Présenter Kameo en 30s : "On est une agence web spécialisée dans la création de sites qui génèrent des résultats concrets"',
      'Montrer 2-3 références clients dans le même secteur ou similaire',
      'Partager un chiffre clé / résultat : "+200% de trafic en 6 mois pour [client]"',
      'Montrer la différence : "Contrairement à beaucoup d\'agences, on ne fait pas juste un joli site. On construit un outil de conversion."',
    ],
  },
  {
    label: 'Présentation de la solution',
    duration: '8-10 min',
    objectif: 'Montrer concrètement ce qu\'on va faire pour le prospect.',
    details: [
      'Partager son écran avec les maquettes / exemples de sites similaires',
      'Relier chaque fonctionnalité à un besoin exprimé en phase découverte',
      'Montrer l\'audit SEO / PageSpeed du site actuel si pertinent',
      'Expliquer le process étape par étape : brief → maquette → développement → mise en ligne',
      'Insister sur ce qui est inclus : SEO, responsive, maintenance, support',
    ],
    exemple: 'Vous m\'avez dit que vous perdiez des clients parce que votre site n\'inspire pas confiance. Regardez ce qu\'on a fait pour [client] qui avait exactement le même problème...',
  },
  {
    label: 'Annonce du tarif',
    duration: '2-3 min',
    objectif: 'Présenter le prix avec assurance et justification de la valeur.',
    details: [
      'Résumer la valeur avant d\'annoncer le prix : "Donc on parle d\'un site complet, optimisé SEO, avec suivi pendant 12 mois..."',
      'Annoncer le prix clairement et se taire — ne pas justifier immédiatement',
      'Si besoin, ramener au coût par jour/mois : "Ça revient à X€ par jour, soit le prix d\'un café"',
      'Proposer 2 formules si possible (pas 3) pour cadrer le choix',
    ],
  },
  {
    label: 'Gestion des objections',
    duration: '3-5 min',
    objectif: 'Rassurer et lever les freins avec empathie.',
    details: [
      '"C\'est trop cher" → "Je comprends. Combien vous coûte aujourd\'hui le fait de ne PAS avoir de site performant ? Un seul client gagné rembourse l\'investissement."',
      '"Je dois réfléchir" → "Bien sûr. Qu\'est-ce qui vous fait hésiter exactement ? Comme ça je peux vous aider à y voir plus clair."',
      '"J\'ai déjà un prestataire" → "Super, et vous êtes satisfait des résultats ? On peut faire un audit gratuit pour comparer objectivement."',
      '"C\'est pas le bon moment" → "Je comprends. Sachez que le SEO prend 3-6 mois pour donner des résultats. Plus on attend, plus on perd de terrain face à la concurrence."',
    ],
  },
  {
    label: 'Closing & next steps',
    duration: '2-3 min',
    objectif: 'Obtenir un engagement concret.',
    details: [
      'Résumer les bénéfices : "Donc avec cette solution, vous allez [bénéfice 1], [bénéfice 2] et [bénéfice 3]"',
      'Proposer le choix, pas le oui/non : "On part plutôt sur la formule A ou la formule B ?"',
      'Fixer la prochaine étape immédiatement : "Je vous envoie le devis cet après-midi et on se recale jeudi pour valider ?"',
      'Créer un sentiment d\'urgence naturel : "On a de la dispo ce mois-ci pour démarrer rapidement"',
      'Remercier : "Merci pour votre temps, c\'était un super échange."',
    ],
  },
]

// ─── Data : Conseils pratiques (Do / Don't) ─────────────────────────────────
const CONSEILS: ConseilCard[] = [
  {
    title: 'Avant la visio',
    icon: Target,
    color: 'bg-[#E14B89]/15 text-[#E14B89]',
    dos: [
      { text: 'Visiter le site du prospect et noter 3 points à améliorer' },
      { text: 'Préparer un audit PageSpeed / SEO rapide à montrer en live' },
      { text: 'Vérifier son LinkedIn et comprendre son activité' },
      { text: 'Tester sa webcam, micro et connexion 5 min avant' },
      { text: 'Avoir 2-3 exemples de réalisations prêts à partager' },
    ],
    donts: [
      { text: 'Arriver sans avoir regardé le site du prospect' },
      { text: 'Être en retard (même 2 min, ça donne une mauvaise image)' },
      { text: 'Avoir un fond bordélique ou pas de cadre pro' },
      { text: 'Ne pas avoir de plan / structure de l\'appel en tête' },
    ],
  },
  {
    title: 'Pendant la visio',
    icon: MonitorPlay,
    color: 'bg-blue-500/15 text-blue-400',
    dos: [
      { text: 'Garder la webcam allumée et regarder la caméra (pas l\'écran)' },
      { text: 'Écouter 60% du temps, parler 40%' },
      { text: 'Reformuler ce que dit le prospect pour montrer qu\'on écoute' },
      { text: 'Utiliser le prénom du prospect régulièrement' },
      { text: 'Partager son écran pour montrer des exemples concrets' },
      { text: 'Prendre des notes visiblement (ça montre l\'intérêt)' },
    ],
    donts: [
      { text: 'Couper la parole au prospect' },
      { text: 'Faire un monologue de 15 min sur l\'agence' },
      { text: 'Lire un script mot pour mot (ça doit rester naturel)' },
      { text: 'Regarder son téléphone ou être distrait' },
      { text: 'Parler en jargon technique ("responsive", "SPA", "headless"...)' },
    ],
  },
  {
    title: 'Annonce du prix',
    icon: MessageSquare,
    color: 'bg-amber-500/15 text-amber-400',
    dos: [
      { text: 'Récapituler la valeur AVANT de donner le prix' },
      { text: 'Annoncer le prix avec assurance, voix posée' },
      { text: 'Se taire après l\'annonce — laisser le prospect réagir' },
      { text: 'Proposer 2 options maximum pour cadrer le choix' },
      { text: 'Ramener au ROI : "1 client gagné = investissement remboursé"' },
    ],
    donts: [
      { text: 'S\'excuser du prix ("je sais que c\'est un budget...")' },
      { text: 'Baisser le prix sans contrepartie' },
      { text: 'Donner le prix par mail sans l\'avoir annoncé en live' },
      { text: 'Proposer 4-5 options (le prospect ne saura pas choisir)' },
    ],
  },
  {
    title: 'Après la visio',
    icon: Clock,
    color: 'bg-emerald-500/15 text-emerald-400',
    dos: [
      { text: 'Envoyer le devis dans les 2h qui suivent (pas le lendemain)' },
      { text: 'Inclure un récap personnalisé des besoins discutés' },
      { text: 'Planifier la relance J+2 dans le CRM immédiatement' },
      { text: 'Mettre à jour le statut du lead tout de suite' },
      { text: 'Envoyer un message LinkedIn en complément du mail' },
    ],
    donts: [
      { text: 'Attendre que le prospect revienne de lui-même' },
      { text: 'Envoyer un devis générique sans personnalisation' },
      { text: 'Relancer plus de 3 fois sans apporter de nouvelle valeur' },
      { text: 'Oublier de mettre à jour le CRM (les stats sont faussées)' },
    ],
  },
]

// ─── Data : Vidéos ──────────────────────────────────────────────────────────
const VIDEOS: VideoItem[] = [
  {
    title: 'Structure complète d\'un RDV visio',
    description: 'Walkthrough de A à Z d\'un rendez-vous commercial en visio avec un vrai prospect.',
    url: '',
    duration: '25 min',
    category: 'Fondamentaux',
  },
  {
    title: 'Réussir sa phase découverte',
    description: 'Les bonnes questions à poser et comment creuser pour identifier les vrais besoins.',
    url: '',
    duration: '15 min',
    category: 'Techniques',
  },
  {
    title: 'Gérer les objections en live',
    description: 'Simulations d\'objections courantes et comment y répondre avec assurance.',
    url: '',
    duration: '20 min',
    category: 'Techniques',
  },
  {
    title: 'Présenter un audit SEO pour vendre',
    description: 'Comment transformer un audit technique en argument de vente concret et compréhensible.',
    url: '',
    duration: '18 min',
    category: 'Outils',
  },
  {
    title: 'L\'art du closing en agence web',
    description: 'Techniques pour conclure un deal sans être pushy, avec des exemples concrets.',
    url: '',
    duration: '15 min',
    category: 'Techniques',
  },
  {
    title: 'Utiliser le CRM Kameo au quotidien',
    description: 'Tour de l\'outil : leads, statuts, relances et suivi de pipeline commercial.',
    url: '',
    duration: '12 min',
    category: 'Outils',
  },
]

// ─── Data : Points à améliorer ──────────────────────────────────────────────
const AMELIORATIONS: AmeliorationSection[] = [
  {
    title: 'Benjamin',
    icon: User,
    color: 'text-[#E14B89]',
    bgColor: 'bg-[#E14B89]/10 border-[#E14B89]/20',
    items: [
      { key: 'ben-1', text: 'Je parle trop vite' },
      { key: 'ben-2', text: 'J\'articule pas assez' },
      { key: 'ben-3', text: 'Me forcer à avoir une voix plus grave' },
      { key: 'ben-4', text: 'Je parle un peu trop' },
      { key: 'ben-5', text: 'Un peu trop excité' },
      { key: 'ben-6', text: 'Moins me justifier' },
    ],
  },
  {
    title: 'Louison',
    icon: User,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    items: [
      { key: 'lou-1', text: 'Un petit peu trop éteint / réservé' },
      { key: 'lou-2', text: 'L\'éclairage du soleil (on dirait que t\'es dehors)' },
      { key: 'lou-3', text: 'Être un peu plus chaleureux' },
    ],
  },
  {
    title: 'Général',
    icon: Users,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    items: [
      { key: 'gen-1', text: 'Expliquer moins le service mais plus la conséquence de nos services' },
      { key: 'gen-2', text: 'Apporter de l\'autorité (nombre de projets, clients actuels...)' },
      { key: 'gen-3', text: 'S\'appuyer avec un PDF / présentation' },
      { key: 'gen-4', text: 'Poser plus de questions sur la partie closing / objectifs / douleurs' },
      { key: 'gen-5', text: 'Poser le cadre en ouverture : "Voilà comment on va structurer cet appel"' },
      { key: 'gen-6', text: 'Anticiper les problèmes métier du client pour montrer qu\'on comprend son secteur' },
      { key: 'gen-7', text: 'Tester le closing avant de raccrocher : "Qu\'est-ce qui fait qu\'aujourd\'hui vous travaillerez plus avec une agence qu\'une autre ?"' },
    ],
  },
]

const TABS: { key: Tab; label: string; icon: typeof Presentation }[] = [
  { key: 'structure', label: 'Script & Structure', icon: Presentation },
  { key: 'conseils', label: 'Do & Don\'t', icon: Lightbulb },
  { key: 'ameliorations', label: 'Points à améliorer', icon: TrendingUp },
  { key: 'videos', label: 'Vidéos', icon: Play },
]

// ─── Component ──────────────────────────────────────────────────────────────
export default function SkillsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('structure')
  const [expandedStep, setExpandedStep] = useState<number | null>(0)
  const [progress, setProgress] = useState<Record<string, boolean>>({})

  // Fetch progress on mount
  const fetchProgress = useCallback(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => { if (data && typeof data === 'object') setProgress(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  // Toggle an item
  async function toggleItem(key: string) {
    const newValue = !progress[key]
    setProgress(prev => ({ ...prev, [key]: newValue }))

    await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey: key, completed: newValue }),
    })
  }

  // Count completed items
  const totalItems = AMELIORATIONS.reduce((sum, s) => sum + s.items.length, 0)
  const completedItems = AMELIORATIONS.reduce(
    (sum, s) => sum + s.items.filter(i => progress[i.key]).length,
    0
  )

  const totalDuration = '30-40 min'

  return (
    <div className="min-h-screen bg-[#0a0a12] p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Skills</h1>
        <p className="text-slate-500 text-sm mt-1">Guide de vente en visio — structure, bonnes pratiques et ressources</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#E14B89]/10 text-[#E14B89] border border-[#E14B89]/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.key === 'ameliorations' && completedItems > 0 && (
                <span className="ml-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                  {completedItems}/{totalItems}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══ TAB 1 : Script & Structure ═══ */}
      {activeTab === 'structure' && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-gradient-to-r from-[#E14B89]/10 to-[#F8903C]/10 border border-[#E14B89]/20 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-white font-semibold text-sm">Structure d&apos;un RDV visio de vente</h2>
              <p className="text-slate-400 text-xs mt-0.5">{VISIO_STEPS.length} étapes &middot; Durée totale : {totalDuration}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Video size={14} className="text-[#E14B89]" />
              <span className="text-[#E14B89] text-xs font-medium">Visio Google Meet / Zoom</span>
            </div>
          </div>

          {/* Steps timeline */}
          <div className="space-y-3">
            {VISIO_STEPS.map((step, idx) => {
              const isExpanded = expandedStep === idx
              return (
                <div
                  key={idx}
                  className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : idx)}
                    className="w-full flex items-center gap-4 p-4 md:p-5 text-left hover:bg-slate-800/20 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E14B89] to-[#F8903C] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm">{step.label}</h3>
                        <span className="text-slate-500 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded-md">{step.duration}</span>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{step.objectif}</p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-600 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 md:px-5 pb-5 space-y-3">
                      <div className="flex items-start gap-2.5 bg-[#E14B89]/5 border border-[#E14B89]/10 rounded-xl px-4 py-3">
                        <Target size={14} className="text-[#E14B89] mt-0.5 flex-shrink-0" />
                        <p className="text-slate-300 text-sm"><span className="text-[#E14B89] font-medium">Objectif :</span> {step.objectif}</p>
                      </div>

                      <ul className="space-y-2 ml-1">
                        {step.details.map((detail, dIdx) => (
                          <li key={dIdx} className="flex items-start gap-2.5 text-sm">
                            <ChevronRight size={12} className="text-[#F8903C] mt-1 flex-shrink-0" />
                            <span className="text-slate-300 leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>

                      {step.exemple && (
                        <div className="bg-[#0a0a12] border border-slate-800/60 rounded-xl p-4 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Mic size={12} className="text-amber-400" />
                            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Exemple</span>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed italic">
                            &ldquo;{step.exemple}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ TAB 2 : Do & Don't ═══ */}
      {activeTab === 'conseils' && (
        <div className="space-y-5">
          {CONSEILS.map((card, idx) => {
            const Icon = card.icon
            return (
              <div
                key={idx}
                className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="text-white font-semibold text-sm">{card.title}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
                  <div className="p-4 md:p-5 space-y-2.5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">À faire</span>
                    </div>
                    {card.dos.map((item, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-2.5">
                        <ThumbsUp size={12} className="text-emerald-500/60 mt-1 flex-shrink-0" />
                        <p className="text-slate-300 text-sm leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 md:p-5 space-y-2.5">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle size={14} className="text-red-400" />
                      <span className="text-red-400 text-xs font-bold uppercase tracking-wider">À éviter</span>
                    </div>
                    {card.donts.map((item, dIdx) => (
                      <div key={dIdx} className="flex items-start gap-2.5">
                        <ThumbsDown size={12} className="text-red-500/60 mt-1 flex-shrink-0" />
                        <p className="text-slate-300 text-sm leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TAB 3 : Points à améliorer ═══ */}
      {activeTab === 'ameliorations' && (
        <div className="space-y-5">
          {/* Progress bar */}
          <div className="bg-[#111118] border border-slate-800 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-semibold">Progression globale</p>
              <span className="text-emerald-400 text-sm font-bold">{completedItems}/{totalItems}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E14B89] to-[#F8903C] rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>

          {AMELIORATIONS.map((section, sIdx) => {
            const Icon = section.icon
            const sectionCompleted = section.items.filter(i => progress[i.key]).length
            return (
              <div
                key={sIdx}
                className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden"
              >
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${section.bgColor}`}>
                      <Icon size={16} className={section.color} />
                    </div>
                    <h3 className="text-white font-semibold text-sm">{section.title}</h3>
                  </div>
                  <span className={`text-xs font-bold ${sectionCompleted === section.items.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {sectionCompleted}/{section.items.length}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-800/40">
                  {section.items.map(item => {
                    const isCompleted = !!progress[item.key]
                    return (
                      <button
                        key={item.key}
                        onClick={() => toggleItem(item.key)}
                        className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-slate-800/20 transition-colors group"
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-slate-600 group-hover:border-slate-400'
                        }`}>
                          {isCompleted && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Text */}
                        <span className={`text-sm transition-all ${
                          isCompleted
                            ? 'text-slate-500 line-through'
                            : 'text-slate-300'
                        }`}>
                          {item.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ TAB 4 : Vidéos ═══ */}
      {activeTab === 'videos' && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
              Les vidéos seront ajoutées prochainement. Voici les sujets prévus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {VIDEOS.map((video, idx) => (
              <div
                key={idx}
                className="bg-[#111118] border border-slate-800 rounded-2xl overflow-hidden group hover:border-slate-700 transition-colors"
              >
                <div className="aspect-video bg-[#0a0a12] flex items-center justify-center relative">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <Play size={22} className="text-white/30 ml-0.5 group-hover:text-white/50 transition-colors" />
                  </div>
                  <span className="absolute top-2.5 right-2.5 bg-black/70 text-slate-300 text-[10px] px-2 py-0.5 rounded-md font-medium backdrop-blur-sm">
                    {video.duration}
                  </span>
                  <span className="absolute top-2.5 left-2.5 bg-[#E14B89]/20 text-[#E14B89] text-[10px] px-2 py-0.5 rounded-md font-medium backdrop-blur-sm">
                    {video.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold text-sm mb-1.5">{video.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{video.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
