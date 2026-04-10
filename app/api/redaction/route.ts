import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 180

const anthropic = new Anthropic()

// GET: list all redactions (history)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const redactions = await prisma.redaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true, company: true } } } },
      createdBy: { select: { name: true } },
    },
  })
  return NextResponse.json(redactions)
}

// PUT: save analysis + content to DB
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, analysis, content, cost, costDetails } = await req.json()
  if (!projectId || !analysis) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  const redaction = await prisma.redaction.create({
    data: {
      projectId,
      analysis,
      content: content || null,
      cost: cost != null ? Number(cost) : null,
      costDetails: costDetails || null,
      createdById: session.user.id,
    },
  })

  return NextResponse.json(redaction)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
  await prisma.redaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { projectId, step, analysis: bodyAnalysis } = body
  if (!projectId) return NextResponse.json({ error: 'projectId requis' }, { status: 400 })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      clientForm: true,
      cahiersDesCharges: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  const cdcData = (project.clientForm?.cdcData as Record<string, unknown>) || {}
  const briefData = (project.clientForm?.briefData as Record<string, unknown>) || {}
  const cahier = project.cahiersDesCharges[0]?.content || ''
  const projectContext = buildProjectContext(project, cdcData, briefData, cahier)

  // Detect if refonte (existing site)
  const isRefonte = !!(cdcData.isRefonte || cdcData.refonteUrl || cdcData.siteActuel)
  const existingUrl = (cdcData.refonteUrl || cdcData.siteActuel || (project.client as Record<string, unknown>)?.website || '') as string

  try {
    if (step === 'analyse') {
      // 1. Extract seed keywords (now includes LSI + PAA questions)
      const seedKeywords = await extractSeedKeywords(projectContext)
      // 2. Fetch DataForSEO: volumes + suggestions + SERP + backlinks (all in parallel)
      const seoData = await fetchAllSEOData(seedKeywords, existingUrl)
      // 3. If refonte, scrape existing site (multi-page)
      let scrapedContent = ''
      if (isRefonte && existingUrl) {
        scrapedContent = await scrapeMultiPage(existingUrl)
      }
      // 4. Competitor analysis from SERP data
      const competitorData = await analyzeTopCompetitors(seoData.serp, existingUrl)
      // 5. Build enriched context
      const enrichedContext = projectContext + '\n\n' + formatSEOData(seoData, competitorData) + (scrapedContent ? '\n\n' + scrapedContent : '')
      return streamResponse(enrichedContext, 'analyse')
    } else if (step === 'redaction') {
      // Use Opus for premium quality redaction + multi-pass + quality audit
      return streamRedactionWithReview(projectContext, bodyAnalysis || '')
    } else {
      const analysis = await generateText(projectContext, 'analyse')
      const content = await generateText(projectContext, 'redaction', analysis)
      return NextResponse.json({ analysis, content })
    }
  } catch (error) {
    console.error('[POST /api/redaction]', error)
    return NextResponse.json({ error: 'Erreur lors de la génération' }, { status: 500 })
  }
}

function buildProjectContext(
  project: Record<string, unknown>,
  cdcData: Record<string, unknown>,
  briefData: Record<string, unknown>,
  cahier: string
): string {
  const client = project.client as Record<string, unknown> | null
  const parts: string[] = []

  parts.push(`## Projet : ${project.name}`)
  parts.push(`Type : ${project.type}`)
  if (client) {
    parts.push(`\n## Client`)
    if (client.name) parts.push(`Nom : ${client.name}`)
    if (client.company) parts.push(`Entreprise : ${client.company}`)
    if (client.website) parts.push(`Site actuel : ${client.website}`)
    if (client.city) parts.push(`Ville : ${client.city}`)
  }

  if (project.clientBrief) parts.push(`\n## Brief client\n${project.clientBrief}`)
  if (project.notes) parts.push(`\n## Notes projet\n${project.notes}`)

  if (Object.keys(cdcData).length > 0) {
    parts.push(`\n## Cahier des charges`)
    if (cdcData.missionType) parts.push(`Type de mission : ${cdcData.missionType}`)
    if (cdcData.technologie) parts.push(`Technologie : ${cdcData.technologie}`)
    if (cdcData.siteType) parts.push(`Type de site : ${cdcData.siteType}`)
    if (cdcData.isRefonte) parts.push(`Refonte : Oui`)
    if (cdcData.refonteUrl) parts.push(`Site existant : ${cdcData.refonteUrl}`)
    if (cdcData.arborescence) parts.push(`Arborescence : ${cdcData.arborescence}`)
    if (cdcData.espaceClient) parts.push(`Espace client : Oui`)
    if (cdcData.fonctionnalites && Array.isArray(cdcData.fonctionnalites) && cdcData.fonctionnalites.length > 0) {
      parts.push(`Fonctionnalités : ${(cdcData.fonctionnalites as string[]).join(', ')}`)
    }
    if (cdcData.formulaireChamps) parts.push(`Champs formulaire : ${cdcData.formulaireChamps}`)
    if (cdcData.catalogueInfo) parts.push(`Catalogue : ${cdcData.catalogueInfo}`)
    if (cdcData.livraisonInfo) parts.push(`Livraison : ${cdcData.livraisonInfo}`)
    if (cdcData.paiementInfo) parts.push(`Paiement : ${cdcData.paiementInfo}`)
    if (cdcData.autresInfos) parts.push(`Autres infos : ${cdcData.autresInfos}`)
  }

  if (Object.keys(briefData).length > 0) {
    parts.push(`\n## Brief marketing`)
    if (briefData.offreResume) parts.push(`Résumé offre : ${briefData.offreResume}`)
    if (briefData.offreDetail) parts.push(`Détail offre : ${briefData.offreDetail}`)
    if (briefData.fourchettePrix) parts.push(`Fourchette de prix : ${briefData.fourchettePrix}`)
    if (briefData.differenciation) parts.push(`Différenciation : ${briefData.differenciation}`)
    if (briefData.usp) parts.push(`USP : ${briefData.usp}`)
    if (briefData.personaTypes) parts.push(`Personas : ${briefData.personaTypes}`)
    if (briefData.personaPeurs) parts.push(`Peurs / objections : ${briefData.personaPeurs}`)
    if (briefData.parcoursAchat) parts.push(`Parcours d'achat : ${briefData.parcoursAchat}`)
    if (briefData.toneOfVoice) parts.push(`Ton de voix : ${briefData.toneOfVoice}`)
    if (briefData.valeurs) parts.push(`Valeurs : ${briefData.valeurs}`)
    if (briefData.sujetsInterdits) parts.push(`Sujets interdits : ${briefData.sujetsInterdits}`)
    if (briefData.termesInterdits) parts.push(`Termes interdits : ${briefData.termesInterdits}`)
  }

  if (cahier) {
    parts.push(`\n## Cahier des charges détaillé\n${cahier.substring(0, 3000)}`)
  }

  return parts.join('\n')
}

function getSystemPrompt(type: 'analyse' | 'redaction'): string {
  if (type === 'analyse') {
    return `Tu es un expert SEO senior avec plus de 10 ans d'expérience en stratégie de référencement naturel. Tu travailles pour l'Agence Kameo, une agence web premium.

Tu dois produire une analyse SEO complète, professionnelle et actionnable. Ton analyse doit être en français, structurée en Markdown.

RÈGLES CRITIQUES :

1. VOLUMES DE RECHERCHE — DONNÉES RÉELLES DATAFORSEO
- Des données réelles DataForSEO (volumes mensuels, CPC, concurrence Google Ads) sont fournies dans le contexte du projet
- UTILISE EXCLUSIVEMENT ces données réelles pour tes recommandations de mots-clés
- Cite les volumes exacts, CPC et niveaux de concurrence fournis
- Si un mot-clé pertinent n'a pas de données DataForSEO, indique "Volume inconnu — à tester"
- NE JAMAIS inventer de volumes ou chiffres qui ne sont pas dans les données fournies

2. SEO LOCAL — PRIORITÉ ABSOLUE pour les prestataires de services
- Si le client a une zone géographique identifiable (ville, département, région), le SEO local est le levier #1
- Recommander systématiquement : Google Business Profile optimisé, pages locales par zone, stratégie d'avis clients
- Intégrer des mots-clés géolocalisés dans la stratégie (ex: "[service] + [ville/département]")

3. DONNÉES STRUCTURÉES (Schema Markup)
- Recommander les schemas pertinents : LocalBusiness, Organization, Service, Person, FAQPage, BreadcrumbList
- Expliquer pourquoi chaque schema est pertinent pour le projet

4. CTA DIFFÉRENCIÉS PAR PERSONA
- Chaque persona identifié dans le brief doit avoir un CTA adapté à son parcours d'achat
- Ne jamais mettre "Demander un devis" partout — c'est générique et inefficace
- Proposer des CTA contextuels (télécharger un guide, planifier un appel, voir une étude de cas, simulateur...)

5. STRATÉGIE DE CONTENU AVANCÉE
- Proposer un cocon sémantique / cluster de contenu si pertinent
- Suggérer un calendrier éditorial (blog, actualités) avec des sujets concrets
- Penser au maillage interne comme un tunnel de conversion

6. ANALYSE CONCURRENTIELLE
- Identifier les types de concurrents (locaux, nationaux, plateformes)
- Analyser leur positionnement probable (pas de données réelles, mais raisonnement logique)
- Identifier les angles différenciants exploitables

7. ANALYSE SERP ENRICHIE
- Analyser les featured snippets détectés dans les données SERP : quel format (paragraphe, liste, tableau) ? Quelle opportunité de les capturer ?
- Exploiter les questions PAA (People Also Ask) comme H2/H3 potentiels et sujets de FAQ
- Utiliser les recherches associées pour enrichir le champ lexical

8. SCORING DE DIFFICULTÉ PAR MOT-CLÉ
- Pour chaque mot-clé principal, évaluer la difficulté sur 10 basée sur : volume, CPC (indicateur de valeur commerciale), autorité des sites en top 3
- Classer en : Facile (1-3), Moyen (4-6), Difficile (7-8), Très difficile (9-10)

9. ESTIMATION DU TRAFIC POTENTIEL
- Pour les 5 mots-clés principaux, estimer le trafic mensuel si le site atteint le top 3 (CTR position 1 ≈ 28%, position 2 ≈ 15%, position 3 ≈ 11%)
- Donner un total de trafic organique potentiel mensuel

10. PRIORITISATION DES PAGES
- Classer chaque page par ROI potentiel = (volume recherche × intention transactionnelle × faisabilité)
- Format tableau : Page | Priorité | Mot-clé | Volume | Difficulté | ROI estimé

11. DÉTECTION DE CANNIBALISATION
- Vérifier si plusieurs pages risquent de cibler le même mot-clé
- Si oui, recommander des angles différenciants

12. ANALYSE DES CONCURRENTS RÉELS
- Des données de scraping des concurrents sont fournies. Analyser : nombre de mots, structure, headings
- Identifier ce que les concurrents font bien et ce que le client peut faire mieux

IMPORTANT :
- Raisonne comme un vrai expert SEO humain, pas comme une IA
- Adapte chaque analyse au secteur et à la cible du client
- Pense conversion ET référencement
- Ne sois jamais générique — chaque recommandation doit être spécifique au projet`
  }
  return `Tu es un rédacteur web SEO professionnel de haut niveau, combinant copywriting et conversion. Tu travailles pour l'Agence Kameo, une agence web premium.

Tu dois rédiger le contenu complet de chaque page du site, en te basant sur l'analyse SEO fournie.

RÈGLES CRITIQUES :

1. FORMULES DE COPYWRITING
- Page d'accueil : AIDA (Attention → Intérêt → Désir → Action)
- Pages services : PAS (Problème → Agitation → Solution)
- Page à propos : Storytelling (Origine → Défi → Mission → Vision)
- Blog : PASO (Problème → Agitation → Solution → Outcome)
- Chaque page doit suivre sa formule de copywriting appropriée

2. HOOKS D'OUVERTURE (CRITIQUE)
- Chaque page DOIT commencer par un hook qui retient en 3 secondes
- Techniques : statistique choc, question provocante, scénario "imaginez si...", affirmation contre-intuitive
- Le hook est AVANT le H1 (c'est le texte d'accroche au-dessus du H1)
- Exemples : "93% des expériences en ligne commencent par un moteur de recherche.", "Et si votre site web travaillait pour vous pendant que vous dormez ?"

3. CTA DIFFÉRENCIÉS PAR PERSONA (JAMAIS "Demander un devis" partout)
- Varier selon la page et le persona : "Planifier un appel découverte", "Télécharger notre guide", "Voir nos réalisations", "Simuler votre projet"
- Proposer 2 variantes de CTA par page pour A/B testing
- Inclure un CTA secondaire (moins engageant) pour les visiteurs pas encore prêts

4. OBJECTIONS ET RÉPONSES
- Chaque page service doit inclure un bloc "Questions fréquentes" (3-5 FAQ)
- Les FAQ doivent répondre aux vraies objections du persona (prix, délais, qualité, confiance)
- Utiliser les questions PAA de l'analyse SEO si disponibles
- Format Schema FAQ (mentionner en commentaire)

5. H1 = PROMESSE FORTE (bénéfice + mot-clé)
- Le H1 de la page d'accueil et des pages services/produits DOIT être une promesse forte, orientée bénéfice client
- PAS de H1 descriptif générique ("Nos services", "Bienvenue")
- Le H1 doit répondre à : "Pourquoi ce client devrait choisir CE prestataire ?"
- Exemples de bons H1 : "Inspections techniques par drone : précision millimétrique, coûts divisés par 3", "Votre site e-commerce qui convertit dès le premier mois"
- Le H1 doit contenir le mot-clé principal ET une proposition de valeur

6. STRUCTURE DE PAGE OBLIGATOIRE
- **Hook** : Accroche émotionnelle ou factuelle (2 lignes max)
- **H1** : Promesse forte (bénéfice + mot-clé)
- **Bandeau social proof** : chiffres clés du client
- **Points forts** : 3-5 avantages différenciants (icônes + titre + description)
- **Contenu principal** : selon la formule copywriting de la page
- **FAQ** : 3-5 questions/réponses (pages services)
- **CTA final** : bloc de conversion avec CTA principal + CTA secondaire

7. SEO AVANCÉ
- Densité mot-clé principal : 1-2% (naturel, pas forcé)
- Mentions des mots-clés secondaires et LSI dans le corps du texte
- Chaque H2 doit répondre à une intention de recherche identifiable
- Maillage interne explicite : pour chaque page, indiquer [Lien vers : page-x] aux endroits pertinents

8. NOMBRE DE MOTS PAR TYPE DE PAGE
- Page d'accueil : 800-1200 mots
- Page service/produit : 800-1500 mots
- Page à propos : 600-800 mots
- Page contact : 200-400 mots
- Article de blog : 1500-2500 mots
- Page FAQ : 800-1200 mots

9. AUTHENTICITÉ & TONALITÉ (CRITIQUE — ANTI-IA)
- Ton humain, fluide, naturel — JAMAIS robotique, JAMAIS détectable comme IA
- INTERDICTIONS ABSOLUES : pas de "dans un monde où...", "il est essentiel de...", "n'hésitez pas à...", "force est de constater", "il convient de", "en effet", "ainsi", "par ailleurs". Ces tournures crient "texte IA".
- Écrire comme un humain expert qui parle à un autre humain : phrases directes, concrètes, parfois courtes, parfois longues. Varier le rythme.
- Utiliser des exemples concrets et spécifiques au secteur du client (pas des généralités)
- Vocabulaire technique du secteur (ça rassure les pros et ça ranke)
- Éléments de réassurance CONCRETS : vrais chiffres, vraies certifications, vrais noms de technologies — pas de "des années d'expérience" mais "12 ans d'expérience" (ou [X années] si pas dans le brief)
- Adapter le ton par page : services = expert direct, à propos = humain/storytelling, blog = pédagogue passionné

10. VALEUR AJOUTÉE (CRITIQUE)
- Le contenu DOIT apporter de la valeur au lecteur, pas juste remplir des mots pour le SEO
- Chaque paragraphe doit contenir une information UTILE, un conseil ACTIONNABLE, ou un argument de vente CONCRET
- INTERDICTION du remplissage : si une phrase n'apporte rien de concret, la supprimer
- Chaque page doit répondre à une vraie question du visiteur et le faire avancer dans sa décision
- Penser : "est-ce qu'un humain lirait ce paragraphe jusqu'au bout ?" Si non, le réécrire
- Intégrer des insights métier que seul un expert du secteur connaîtrait (pas des évidences)

11. MICRO-COPY
- Proposer les textes des boutons CTA (pas juste "En savoir plus")
- Proposer les alt text pour les images recommandées
- Proposer les textes de formulaire (labels, placeholder, message de confirmation)

12. META DESCRIPTIONS OPTIMISÉES
- Chaque meta description DOIT contenir : le mot-clé principal, un bénéfice client, un CTA implicite
- Maximum 155 caractères, style engageant

12. CAS REFONTE
- Si c'est une refonte : réécrire entièrement, ne jamais copier l'existant
- Moderniser le discours, améliorer le SEO, renforcer la conversion

FORMAT pour chaque page (en Markdown) :
- **Slug** optimisé SEO
- **Meta title** (< 60 caractères, optimisé CTR + SEO)
- **Meta description** (< 155 caractères, engageante, avec CTA implicite)
- **Schema markup recommandé** (en commentaire)
- **Hook** : accroche percutante (2 lignes max, AVANT le H1)
- **H1** = promesse forte (bénéfice + mot-clé)
- **Social proof** : bandeau chiffres clés juste après H1
- **Points forts** : 3-5 avantages différenciants
- **Contenu complet** avec H2/H3, texte, listes, CTA contextuel
- **FAQ** : 3-5 questions/réponses (pages services)
- **CTA principal** + **CTA secondaire**
- **Alt text** pour chaque image suggérée`
}

function getUserPrompt(context: string, type: 'analyse' | 'redaction', analysis?: string): string {
  if (type === 'analyse') {
    return `Voici les données complètes du projet. Produis une analyse SEO complète et structurée.

${context}

---

Produis l'analyse suivante en Markdown. RAPPEL : ne jamais inventer de volumes de recherche chiffrés.

## 1. Analyse marché
- Compréhension du secteur et de ses spécificités
- Types de concurrents (locaux, nationaux, plateformes, annuaires)
- Positionnement probable des concurrents et angles différenciants
- Niveau de difficulté SEO (justifié)
- Opportunités de positionnement concrètes

## 2. SEO Local (si pertinent)
- Stratégie Google Business Profile
- Mots-clés géolocalisés recommandés
- Pages locales à créer (par ville, département, zone)
- Stratégie d'avis clients

## 3. Analyse mots-clés
IMPORTANT : Des données DataForSEO réelles (volumes, CPC, concurrence) sont fournies dans le contexte. UTILISE CES DONNÉES RÉELLES. Ne jamais inventer de volumes.
Pour chaque page identifiée dans l'arborescence :
- Mot-clé principal (avec volume réel DataForSEO + CPC + niveau de concurrence)
- Mots-clés secondaires (avec volumes réels)
- Longue traîne
- Intention de recherche (informationnelle / transactionnelle / navigationnelle)
- Si un mot-clé n'a pas de données DataForSEO, indiquer "Volume inconnu — à tester"

## 4. Stratégie SEO par page
Pour chaque page :
- Mot-clé principal et secondaires
- Intention de recherche
- Objectif (conversion, info, branding)
- Persona cible principal
- CTA recommandé (adapté au persona — PAS "demander un devis" partout)
- Nombre de mots recommandé
- Structure Hn recommandée
- Angle éditorial

## 5. Données structurées (Schema Markup)
Pour chaque page, recommander les schemas pertinents :
- LocalBusiness, Organization, Service, Person, FAQPage, BreadcrumbList, etc.
- Justifier pourquoi chaque schema est pertinent

## 6. Maillage interne & Cocon sémantique
- Architecture du cocon sémantique (pages piliers → pages satellites)
- Liens recommandés entre pages
- Logique du tunnel de conversion via le maillage

## 7. Stratégie de contenu (Blog / Actualités)
- 5 à 10 sujets d'articles concrets à publier
- Fréquence de publication recommandée
- Objectif de chaque article (trafic, autorité, conversion)

## 8. Analyse SERP & Opportunités
- Featured snippets détectés et stratégie pour les capturer (format : paragraphe, liste, tableau)
- Questions PAA exploitables comme H2/H3 ou sujets FAQ
- Recherches associées à intégrer dans le contenu et le champ lexical

## 9. Tableau de priorités
Pour chaque page, en format tableau :
| Page | Mot-clé principal | Volume | Difficulté /10 | Trafic estimé (top 3) | Priorité |

## 10. Analyse concurrentielle
- Forces et faiblesses des 3 premiers concurrents identifiés (basé sur les données de scraping fournies)
- Opportunités de différenciation concrètes
- Gaps de contenu à exploiter`
  }

  return `Voici le contexte du projet et l'analyse SEO. Rédige le contenu complet de chaque page.

## CONTEXTE PROJET
${context}

## ANALYSE SEO
${analysis || ''}

---

RAPPELS CRITIQUES :
- CTA différenciés par persona (JAMAIS "demander un devis" partout)
- Vocabulaire technique du secteur du client
- Références géographiques si pertinent (SEO local)
- Formule de copywriting adaptée par page : AIDA (accueil), PAS (services), Storytelling (à propos)
- Schema markup recommandé en commentaire pour chaque page
- Tu DOIS rédiger TOUTES les pages listées dans l'arborescence du projet, sans exception
- Chaque page doit être séparée par un "---" et commencer par un titre H1 clair

RAPPELS SUPPLÉMENTAIRES :
- Chaque page service : inclure un bloc FAQ (3-5 questions avec réponses, format compatible Schema FAQ)
- Maillage interne : indiquer explicitement [Lien vers : nom-de-la-page] dans le texte là où un lien interne est pertinent
- Alt text : pour chaque image suggérée, proposer un alt text optimisé SEO
- 2 variantes de CTA par page (principal + secondaire)
- Hook d'ouverture obligatoire avant le H1
- Minimum 800 mots par page service (pas 400)
- Micro-copy : proposer textes de boutons, labels de formulaire, placeholders

IMPORTANT : Rédige le contenu complet de CHAQUE page identifiée dans l'arborescence. Tu ne dois oublier AUCUNE page. Si l'arborescence mentionne Accueil, À propos, Services, Contact — tu dois rédiger les 4 pages.

Pour chaque page, utilise ce format :

---

# Page : [Nom de la page]

**Slug** : slug-optimise
**Meta Title** : Titre optimisé (< 60 car.)
**Meta Description** : Description (< 155 car.)
**Schema Markup** : Types recommandés

**Hook** : [Accroche percutante avant le H1]

[Contenu complet avec H1, H2, H3, texte, listes, FAQ, CTA principal + CTA secondaire, alt text images]`
}

// ─── Streaming helpers ───────────────────────────────────────────────────────

// Pricing per 1M tokens (USD, May 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
}
// DataForSEO cost per API call type (approximate)
const DATAFORSEO_COSTS = { keywords: 0.05, suggestions: 0.05, serp: 0.10, backlinks: 0.20 }

function calcTokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model as keyof typeof PRICING] || PRICING['claude-sonnet-4-20250514']
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

function streamResponse(context: string, type: 'analyse' | 'redaction', analysis?: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const model = 'claude-sonnet-4-20250514'
        const messageStream = anthropic.messages.stream({
          model,
          max_tokens: type === 'analyse' ? 8000 : 12000,
          system: getSystemPrompt(type),
          messages: [{ role: 'user', content: getUserPrompt(context, type, analysis) }],
        })
        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }
        // Get real token usage
        const final = await messageStream.finalMessage()
        const usage = final.usage
        const aiCost = calcTokenCost(model, usage?.input_tokens || 0, usage?.output_tokens || 0)
        // DataForSEO costs for analyse step (keywords + suggestions + serp + backlinks)
        const dfCost = type === 'analyse' ? (DATAFORSEO_COSTS.keywords + DATAFORSEO_COSTS.suggestions + DATAFORSEO_COSTS.serp + DATAFORSEO_COSTS.backlinks) : 0
        // Seed keywords extraction cost (separate Sonnet call)
        const seedCost = type === 'analyse' ? 0.02 : 0
        const totalCost = Math.round((aiCost + dfCost + seedCost) * 1000) / 1000

        controller.enqueue(encoder.encode(JSON.stringify({
          done: true,
          cost: { total: totalCost, ai: Math.round(aiCost * 1000) / 1000, dataForSeo: dfCost, inputTokens: usage?.input_tokens || 0, outputTokens: usage?.output_tokens || 0, model }
        }) + '\n'))
        controller.close()
      } catch (err) {
        console.error('[stream error]', err)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'Erreur de génération' }) + '\n'))
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

// ─── Opus for redaction + Multi-pass review + Quality audit ─────────────────

function streamRedactionWithReview(context: string, analysis: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const costs: { model: string; input: number; output: number; cost: number }[] = []

        // Pass 1: Draft with Opus (premium quality)
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'draft' }) + '\n'))
        let draft = ''
        const opusModel = 'claude-opus-4-20250514'
        const draftModel = opusModel
        const draftStream = anthropic.messages.stream({
          model: draftModel,
          max_tokens: 12000,
          system: getSystemPrompt('redaction'),
          messages: [{ role: 'user', content: getUserPrompt(context, 'redaction', analysis) }],
        })
        for await (const event of draftStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            draft += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Track draft cost and send immediately
        const draftFinal = await draftStream.finalMessage()
        const draftUsage = draftFinal.usage
        const draftCost = calcTokenCost(draftModel, draftUsage?.input_tokens || 0, draftUsage?.output_tokens || 0)
        costs.push({ model: draftModel, input: draftUsage?.input_tokens || 0, output: draftUsage?.output_tokens || 0, cost: draftCost })
        controller.enqueue(encoder.encode(JSON.stringify({ passCost: { pass: 'draft', cost: draftCost, inputTokens: draftUsage?.input_tokens || 0, outputTokens: draftUsage?.output_tokens || 0 } }) + '\n'))

        // Pass 2: Strict review & improve with Opus
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'review' }) + '\n'))
        let reviewedContent = ''
        const reviewStream = anthropic.messages.stream({
          model: opusModel,
          max_tokens: 12000,
          system: `Tu es un directeur éditorial senior, expert SEO et copywriting. Tu relis un contenu et tu l'améliores DRASTIQUEMENT.

CHECKLIST DE RELECTURE OBLIGATOIRE :
1. HOOKS — Chaque page commence-t-elle par un hook percutant ? Si non, en ajouter un.
2. H1 — Le H1 contient-il le mot-clé ET une promesse de valeur ? Si c'est générique ("Nos services"), le réécrire.
3. CTA — Les CTA sont-ils TOUS différents ? Si "Demander un devis" apparaît plus d'une fois, remplacer par des CTA contextuels.
4. FAQ — Chaque page service a-t-elle un bloc FAQ ? Si non, en ajouter 3-5 questions.
5. MAILLAGE — Y a-t-il des [Lien vers : page-x] dans le contenu ? Si non, en ajouter 2-3 par page.
6. LONGUEUR — Chaque page service fait-elle 800+ mots ? Si non, développer.
7. SOCIAL PROOF — Y a-t-il des éléments de réassurance concrets (chiffres, certifications) ? Si non, ajouter des placeholders [À compléter].
8. FORMULE — La page suit-elle sa formule copywriting (AIDA pour accueil, PAS pour services) ? Réorganiser si besoin.
9. DENSITÉ MOT-CLÉ — Le mot-clé principal apparaît-il 3-5 fois de manière naturelle dans le texte ?
10. MICRO-COPY — Les alt text d'images et textes de boutons sont-ils proposés ?
11. TON HUMAIN — Traquer et supprimer TOUTES les tournures IA : "dans un monde où", "il est essentiel", "n'hésitez pas", "force est de constater", "il convient de", "par ailleurs", "en effet", "ainsi". Réécrire de manière directe et naturelle.
12. VALEUR AJOUTÉE — Chaque paragraphe apporte-t-il une info concrète, un conseil actionnable, ou un argument de vente ? Si c'est du remplissage, réécrire ou supprimer.

Si un point est manquant, AJOUTE-LE. Ne te contente pas de commenter, CORRIGE directement.
FORMAT : Renvoie le contenu complet AMÉLIORÉ (pas juste les corrections). Garde le même format Markdown.`,
          messages: [{
            role: 'user',
            content: `Voici le contenu à relire et améliorer :\n\n${draft}\n\n---\nApplique la checklist complète et renvoie la version améliorée.`,
          }],
        })

        // Clear draft and stream the reviewed version
        controller.enqueue(encoder.encode(JSON.stringify({ clear: true }) + '\n'))
        for await (const event of reviewStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            reviewedContent += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Track review cost and send immediately
        const reviewFinal = await reviewStream.finalMessage()
        const reviewUsage = reviewFinal.usage
        const reviewCost = calcTokenCost(opusModel, reviewUsage?.input_tokens || 0, reviewUsage?.output_tokens || 0)
        costs.push({ model: opusModel, input: reviewUsage?.input_tokens || 0, output: reviewUsage?.output_tokens || 0, cost: reviewCost })
        controller.enqueue(encoder.encode(JSON.stringify({ passCost: { pass: 'review', cost: reviewCost, inputTokens: reviewUsage?.input_tokens || 0, outputTokens: reviewUsage?.output_tokens || 0 } }) + '\n'))

        // Pass 3: Quality audit with Haiku (fast, very cheap)
        const auditModel = 'claude-haiku-4-5-20251001'
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'audit' }) + '\n'))
        const auditResponse = await anthropic.messages.create({
          model: auditModel,
          max_tokens: 1000,
          system: `Tu es un auditeur qualité SEO et copywriting. Tu évalues un contenu web final et tu donnes un score.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans explication.
Format exact :
{"qualityAudit":{"seo":X,"marketing":X,"readability":X,"overall":X,"issues":["issue1","issue2"]}}
Chaque score est sur 10. Issues = maximum 5 points d'amélioration restants.
Critères SEO : densité mots-clés, meta tags, structure Hn, maillage interne, schema markup.
Critères Marketing : hooks, CTA différenciés, social proof, formules copywriting, FAQ.
Critères Readability : ton naturel, paragraphes courts, vocabulaire technique, fluidité.`,
          messages: [{
            role: 'user',
            content: `Évalue ce contenu :\n\n${reviewedContent.substring(0, 12000)}`,
          }],
        })
        const auditText = (auditResponse.content[0] as { text: string }).text.trim()
        try {
          const auditJson = JSON.parse(auditText)
          controller.enqueue(encoder.encode(JSON.stringify({ audit: auditJson }) + '\n'))
        } catch {
          controller.enqueue(encoder.encode(JSON.stringify({ audit: { qualityAudit: { seo: 0, marketing: 0, readability: 0, overall: 0, issues: ['Audit parse error'] } } }) + '\n'))
        }

        // Track audit cost
        const auditUsage = auditResponse.usage
        costs.push({ model: auditModel, input: auditUsage?.input_tokens || 0, output: auditUsage?.output_tokens || 0, cost: calcTokenCost(auditModel, auditUsage?.input_tokens || 0, auditUsage?.output_tokens || 0) })

        const totalCost = Math.round(costs.reduce((s, c) => s + c.cost, 0) * 1000) / 1000
        const totalInput = costs.reduce((s, c) => s + c.input, 0)
        const totalOutput = costs.reduce((s, c) => s + c.output, 0)

        controller.enqueue(encoder.encode(JSON.stringify({
          done: true,
          cost: { total: totalCost, passes: costs, inputTokens: totalInput, outputTokens: totalOutput }
        }) + '\n'))
        controller.close()
      } catch (err) {
        console.error('[stream redaction+review]', err)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'Erreur de génération' }) + '\n'))
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

// Non-streaming version
async function generateText(context: string, type: 'analyse' | 'redaction', analysis?: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: type === 'analyse' ? 8000 : 12000,
    system: getSystemPrompt(type),
    messages: [{ role: 'user', content: getUserPrompt(context, type, analysis) }],
  })
  return (response.content[0] as { text: string }).text
}

// ─── DataForSEO Integration (enhanced) ──────────────────────────────────────

interface KeywordData {
  keyword: string
  search_volume: number | null
  competition: string | null
  competition_index: number | null
  cpc: number | null
  monthly_searches?: { year: number; month: number; search_volume: number }[] | null
}

interface SERPResult {
  keyword: string
  items: { rank: number; domain: string; title: string; url: string }[]
  featured_snippet: { title: string; description: string; url: string } | null
  people_also_ask: string[]
  related_searches: string[]
}

interface BacklinkSummary {
  domain: string
  backlinks: number
  referring_domains: number
  rank: number
}

interface CompetitorAnalysis {
  domain: string
  url: string
  word_count: number
  h1: string
  meta_title: string
  h2_count: number
  internal_link_count: number
}

interface FullSEOData {
  volumes: KeywordData[]
  suggestions: KeywordData[]
  serp: SERPResult[]
  backlinks: BacklinkSummary | null
  clusters: Record<string, string[]>
}

// Extract seed keywords with clustering intent + LSI + PAA questions
async function extractSeedKeywords(context: string): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Expert SEO. Extrais des mots-clés de recherche Google pertinents pour ce projet.
Inclus :
- 5 mots-clés principaux (courte traîne, fort volume)
- 5 mots-clés géolocalisés (si ville/région mentionnée)
- 5 mots-clés longue traîne (questions, "comment", "meilleur")
- 5 mots-clés concurrentiels (ce que les concurrents ciblent probablement)
- 5 mots-clés LSI (sémantiquement liés, synonymes, termes du même champ lexical)
- 3 questions PAA (People Also Ask) pertinentes en français ("comment...", "pourquoi...", "quel est...")
Réponds UNIQUEMENT en JSON array de strings (28 éléments max).`,
      messages: [{ role: 'user', content: context }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch (err) {
    console.error('[extractSeedKeywords]', err)
    return []
  }
}

// Keyword clustering
async function clusterKeywords(keywords: KeywordData[]): Promise<Record<string, string[]>> {
  try {
    const kwList = keywords.filter(k => k.search_volume).map(k => k.keyword).join(', ')
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Expert SEO. Regroupe ces mots-clés par intention de recherche et thématique. Réponds UNIQUEMENT en JSON: {"cluster_name": ["keyword1", "keyword2"]}. Maximum 8 clusters.',
      messages: [{ role: 'user', content: kwList }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch { return {} }
}

// Analyze top 3 competitor pages from SERP results
async function analyzeTopCompetitors(serpResults: SERPResult[], existingUrl: string): Promise<CompetitorAnalysis[]> {
  try {
    // Collect unique competitor domains (excluding client's domain)
    const clientDomain = existingUrl ? existingUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : ''
    const seenDomains = new Set<string>()
    const competitorUrls: { domain: string; url: string }[] = []

    for (const serp of serpResults) {
      for (const item of serp.items) {
        const domain = item.domain.replace(/^www\./, '')
        if (domain !== clientDomain && !seenDomains.has(domain) && competitorUrls.length < 3) {
          seenDomains.add(domain)
          competitorUrls.push({ domain, url: item.url })
        }
      }
    }

    if (competitorUrls.length === 0) return []

    const results: CompetitorAnalysis[] = []
    const fetches = competitorUrls.map(async ({ domain, url }) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoBot/1.0)' },
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return null
        const html = await res.text()

        // Extract metrics
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const word_count = textContent.split(/\s+/).length

        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : ''

        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const meta_title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''

        const h2Matches = html.match(/<h2[^>]*>/gi)
        const h2_count = h2Matches ? h2Matches.length : 0

        const internalLinkRegex = new RegExp(`href=["'](\/[^"']*|https?:\/\/(www\\.)?${domain.replace('.', '\\.')}[^"']*)`, 'gi')
        const internalLinks = html.match(internalLinkRegex)
        const internal_link_count = internalLinks ? internalLinks.length : 0

        return { domain, url, word_count, h1, meta_title, h2_count, internal_link_count } as CompetitorAnalysis
      } catch {
        return null
      }
    })

    const fetchResults = await Promise.allSettled(fetches)
    for (const r of fetchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value)
      }
    }

    return results
  } catch (err) {
    console.error('[analyzeTopCompetitors]', err)
    return []
  }
}

// Fetch ALL SEO data: volumes + suggestions + SERP + backlinks
async function fetchAllSEOData(keywords: string[], existingUrl: string): Promise<FullSEOData> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password || keywords.length === 0) {
    return { volumes: [], suggestions: [], serp: [], backlinks: null, clusters: {} }
  }

  const authHeader = Buffer.from(`${login}:${password}`).toString('base64')
  const headers = { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' }

  const topKeywords = keywords.slice(0, 5)

  try {
    const fetches: Promise<Response>[] = [
      // 1. Search volumes (20 keywords)
      fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST', headers,
        body: JSON.stringify([{ keywords: keywords.slice(0, 20), language_code: 'fr', location_code: 2250 }]),
      }),
      // 2. Keyword suggestions (5 seed keywords)
      fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
        method: 'POST', headers,
        body: JSON.stringify([{ keywords: topKeywords, language_code: 'fr', location_code: 2250 }]),
      }),
      // 3. SERP for top 3 keywords
      ...topKeywords.slice(0, 3).map(kw =>
        fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST', headers,
          body: JSON.stringify([{ keyword: kw, language_code: 'fr', location_code: 2250, depth: 10 }]),
        })
      ),
    ]

    // 4. Backlinks for existing site (if available)
    if (existingUrl) {
      const domain = existingUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      fetches.push(
        fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
          method: 'POST', headers,
          body: JSON.stringify([{ target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }]),
        })
      )
    }

    const responses = await Promise.allSettled(fetches)
    const getResult = async (idx: number) => {
      const r = responses[idx]
      if (r.status !== 'fulfilled') return null
      try { return await r.value.json() } catch { return null }
    }

    const volData = await getResult(0)
    const sugData = await getResult(1)

    const volumes: KeywordData[] = volData?.tasks?.[0]?.result || []
    const suggestions: KeywordData[] = (sugData?.tasks?.[0]?.result || [])
      .filter((k: KeywordData) => k.search_volume && k.search_volume > 0)
      .sort((a: KeywordData, b: KeywordData) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, 40)

    // Parse SERP results (enriched with featured snippets, PAA, related searches)
    const serp: SERPResult[] = []
    for (let i = 0; i < 3; i++) {
      const serpData = await getResult(2 + i)
      if (serpData?.tasks?.[0]?.result?.[0]) {
        const result = serpData.tasks[0].result[0]
        const allItems = result.items || []

        // Organic results
        const organicItems = allItems
          .filter((item: Record<string, unknown>) => item.type === 'organic')
          .slice(0, 10)
          .map((item: Record<string, unknown>) => ({
            rank: item.rank_group,
            domain: item.domain,
            title: item.title,
            url: item.url,
          }))

        // Featured snippet
        let featured_snippet: SERPResult['featured_snippet'] = null
        const fsItem = allItems.find((item: Record<string, unknown>) => item.type === 'featured_snippet')
        if (fsItem) {
          featured_snippet = {
            title: (fsItem as Record<string, unknown>).title as string || '',
            description: (fsItem as Record<string, unknown>).description as string || '',
            url: (fsItem as Record<string, unknown>).url as string || '',
          }
        }

        // People Also Ask
        const people_also_ask: string[] = []
        const paaItems = allItems.filter((item: Record<string, unknown>) => item.type === 'people_also_ask')
        for (const paa of paaItems) {
          const paaData = paa as Record<string, unknown>
          if (paaData.title) people_also_ask.push(paaData.title as string)
          if (Array.isArray(paaData.items)) {
            for (const subItem of paaData.items as Record<string, unknown>[]) {
              if (subItem.title) people_also_ask.push(subItem.title as string)
            }
          }
        }

        // Related searches
        const related_searches: string[] = []
        const relatedItems = allItems.filter((item: Record<string, unknown>) => item.type === 'related_searches')
        for (const rel of relatedItems) {
          const relData = rel as Record<string, unknown>
          if (relData.title) related_searches.push(relData.title as string)
          if (Array.isArray(relData.items)) {
            for (const subItem of relData.items as Record<string, unknown>[]) {
              if (subItem.title) related_searches.push(subItem.title as string)
            }
          }
        }

        serp.push({ keyword: topKeywords[i], items: organicItems, featured_snippet, people_also_ask, related_searches })
      }
    }

    // Parse backlinks
    let backlinks: BacklinkSummary | null = null
    if (existingUrl) {
      const blData = await getResult(2 + Math.min(3, topKeywords.length))
      if (blData?.tasks?.[0]?.result?.[0]) {
        const r = blData.tasks[0].result[0]
        backlinks = {
          domain: existingUrl,
          backlinks: r.backlinks || 0,
          referring_domains: r.referring_domains || 0,
          rank: r.rank || 0,
        }
      }
    }

    // Cluster keywords
    const allKw = [...volumes, ...suggestions].filter(k => k.search_volume)
    const clusters = await clusterKeywords(allKw)

    return { volumes, suggestions, serp, backlinks, clusters }
  } catch (err) {
    console.error('[fetchAllSEOData]', err)
    return { volumes: [], suggestions: [], serp: [], backlinks: null, clusters: {} }
  }
}

// Format monthly search trends from keyword data
function formatMonthlyTrends(volumes: KeywordData[]): string {
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const parts: string[] = []

  const kwWithTrends = volumes.filter(k => k.monthly_searches && k.monthly_searches.length > 0)
  if (kwWithTrends.length === 0) return ''

  parts.push('\n### Tendances saisonnières (recherches mensuelles)')
  for (const kw of kwWithTrends.slice(0, 5)) {
    if (!kw.monthly_searches || kw.monthly_searches.length === 0) continue
    const sorted = [...kw.monthly_searches].sort((a, b) => b.search_volume - a.search_volume)
    const peak = sorted[0]
    const low = sorted[sorted.length - 1]
    const peakMonth = monthNames[(peak.month - 1) % 12]
    const lowMonth = monthNames[(low.month - 1) % 12]

    parts.push(`\n**"${kw.keyword}"** :`)
    parts.push(`- Pic : ${peakMonth} ${peak.year} (${peak.search_volume} rech.)`)
    parts.push(`- Creux : ${lowMonth} ${low.year} (${low.search_volume} rech.)`)
    parts.push(`- Tendance : ${kw.monthly_searches.map(m => `${monthNames[(m.month - 1) % 12]}:${m.search_volume}`).join(' → ')}`)
  }

  return parts.join('\n')
}

// Format all SEO data for Claude context
function formatSEOData(data: FullSEOData, competitors: CompetitorAnalysis[]): string {
  const parts: string[] = ['## DONNÉES SEO RÉELLES (DataForSEO — France)']
  parts.push('Ces données sont RÉELLES. Utilise-les dans ton analyse.\n')

  // Volumes
  if (data.volumes.length > 0) {
    parts.push('### Volumes de recherche — Mots-clés du projet')
    parts.push('| Mot-clé | Volume/mois | Concurrence | CPC |')
    parts.push('|---------|-------------|-------------|-----|')
    for (const k of data.volumes) {
      parts.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
    }
  }

  // Suggestions
  if (data.suggestions.length > 0) {
    parts.push('\n### Mots-clés associés (opportunités)')
    parts.push('| Mot-clé | Volume/mois | Concurrence | CPC |')
    parts.push('|---------|-------------|-------------|-----|')
    for (const k of data.suggestions.slice(0, 30)) {
      parts.push(`| ${k.keyword} | ${k.search_volume ?? 'N/A'} | ${k.competition || 'N/A'} | ${k.cpc ? k.cpc.toFixed(2) + '€' : 'N/A'} |`)
    }
  }

  // Monthly trends
  const trendsSection = formatMonthlyTrends(data.volumes)
  if (trendsSection) parts.push(trendsSection)

  // SERP Analysis (enriched)
  if (data.serp.length > 0) {
    parts.push('\n### Analyse SERP — Qui ranke sur les mots-clés cibles')
    for (const s of data.serp) {
      parts.push(`\n**"${s.keyword}"** — Top ${s.items.length} résultats :`)
      for (const item of s.items) {
        parts.push(`${item.rank}. ${item.domain} — "${item.title}"`)
      }

      // Featured snippet
      if (s.featured_snippet) {
        parts.push(`\n🎯 **Featured Snippet détecté** :`)
        parts.push(`- URL : ${s.featured_snippet.url}`)
        parts.push(`- Titre : ${s.featured_snippet.title}`)
        parts.push(`- Extrait : ${s.featured_snippet.description.substring(0, 200)}`)
      }

      // People Also Ask
      if (s.people_also_ask.length > 0) {
        parts.push(`\n❓ **Questions PAA (People Also Ask)** :`)
        for (const q of s.people_also_ask) {
          parts.push(`- ${q}`)
        }
      }

      // Related searches
      if (s.related_searches.length > 0) {
        parts.push(`\n🔗 **Recherches associées** :`)
        for (const r of s.related_searches) {
          parts.push(`- ${r}`)
        }
      }
    }
  }

  // Backlinks
  if (data.backlinks) {
    parts.push(`\n### Profil de backlinks — ${data.backlinks.domain}`)
    parts.push(`- Backlinks dofollow : ${data.backlinks.backlinks}`)
    parts.push(`- Domaines référents : ${data.backlinks.referring_domains}`)
    parts.push(`- DataForSEO Rank : ${data.backlinks.rank}`)
  }

  // Clusters
  if (Object.keys(data.clusters).length > 0) {
    parts.push('\n### Clusters de mots-clés (regroupement par intention)')
    for (const [cluster, kws] of Object.entries(data.clusters)) {
      parts.push(`\n**${cluster}** : ${kws.join(', ')}`)
    }
  }

  // Competitor analysis
  if (competitors.length > 0) {
    parts.push('\n### Analyse des concurrents (scraping réel)')
    parts.push('| Domaine | Mots | H1 | Meta Title | H2 | Liens internes |')
    parts.push('|---------|------|----|------------|-----|---------------|')
    for (const c of competitors) {
      parts.push(`| ${c.domain} | ${c.word_count} | ${c.h1.substring(0, 50)} | ${c.meta_title.substring(0, 50)} | ${c.h2_count} | ${c.internal_link_count} |`)
    }
    for (const c of competitors) {
      parts.push(`\n**${c.domain}** (${c.url}) :`)
      parts.push(`- Nombre de mots : ${c.word_count}`)
      parts.push(`- H1 : "${c.h1}"`)
      parts.push(`- Meta Title : "${c.meta_title}"`)
      parts.push(`- Nombre de H2 : ${c.h2_count}`)
      parts.push(`- Liens internes : ${c.internal_link_count}`)
    }
  }

  parts.push('\n⚠️ Source : DataForSEO / Google — ' + new Date().toLocaleDateString('fr-FR'))
  return parts.join('\n')
}

// ─── Multi-page scraping for refonte ───────────────────────────────────────

async function scrapeMultiPage(baseUrl: string): Promise<string> {
  try {
    const normalized = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
    const fetchPage = async (url: string): Promise<string> => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KameoBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return ''
        return await res.text()
      } catch { return '' }
    }

    // Fetch homepage
    const homepage = await fetchPage(normalized)
    if (!homepage) return ''

    // Extract internal links
    const linkRegex = /href=["'](\/[^"'#?]*|https?:\/\/[^"'#?]*)/gi
    const domain = new URL(normalized).hostname
    const links = new Set<string>()
    let match
    while ((match = linkRegex.exec(homepage)) !== null) {
      let href = match[1]
      if (href.startsWith('/')) href = new URL(href, normalized).href
      try {
        const u = new URL(href)
        if (u.hostname === domain && !href.match(/\.(jpg|png|gif|svg|css|js|pdf|zip)/i)) {
          links.add(href)
        }
      } catch { /* skip */ }
    }

    // Fetch up to 8 internal pages in parallel
    const pagesToFetch = Array.from(links).slice(0, 8)
    const pageContents = await Promise.all(pagesToFetch.map(fetchPage))

    const stripHtml = (html: string) => {
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
      const meta = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || ''
      const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 800)
      return `Title: ${title}\nH1: ${h1}\nMeta: ${meta}\nContenu: ${body}`
    }

    const parts = ['## CONTENU DU SITE EXISTANT (scraping multi-pages)\n']
    parts.push(`### Page d'accueil — ${normalized}`)
    parts.push(stripHtml(homepage))

    pagesToFetch.forEach((url, i) => {
      if (pageContents[i]) {
        parts.push(`\n### ${url}`)
        parts.push(stripHtml(pageContents[i]))
      }
    })

    return parts.join('\n')
  } catch (err) {
    console.error('[scrapeMultiPage]', err)
    return ''
  }
}
