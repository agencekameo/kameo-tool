import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

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

  const { projectId, analysis, content } = await req.json()
  if (!projectId || !analysis) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  const redaction = await prisma.redaction.create({
    data: {
      projectId,
      analysis,
      content: content || null,
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
      // 1. Extract seed keywords
      const seedKeywords = await extractSeedKeywords(projectContext)
      // 2. Fetch DataForSEO: volumes + suggestions + SERP + backlinks (all in parallel)
      const seoData = await fetchAllSEOData(seedKeywords, existingUrl)
      // 3. If refonte, scrape existing site (multi-page)
      let scrapedContent = ''
      if (isRefonte && existingUrl) {
        scrapedContent = await scrapeMultiPage(existingUrl)
      }
      // 4. Build enriched context
      const enrichedContext = projectContext + '\n\n' + formatSEOData(seoData) + (scrapedContent ? '\n\n' + scrapedContent : '')
      return streamResponse(enrichedContext, 'analyse')
    } else if (step === 'redaction') {
      // Use Opus for premium quality redaction + multi-pass
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

IMPORTANT :
- Raisonne comme un vrai expert SEO humain, pas comme une IA
- Adapte chaque analyse au secteur et à la cible du client
- Pense conversion ET référencement
- Ne sois jamais générique — chaque recommandation doit être spécifique au projet`
  }
  return `Tu es un rédacteur web SEO professionnel de haut niveau, combinant copywriting et conversion. Tu travailles pour l'Agence Kameo, une agence web premium.

Tu dois rédiger le contenu complet de chaque page du site, en te basant sur l'analyse SEO fournie.

RÈGLES CRITIQUES :

1. CTA DIFFÉRENCIÉS PAR PERSONA
- Chaque page doit avoir un CTA adapté au persona cible de cette page
- Un responsable technique ne réagit pas comme un directeur général
- Varier : "Planifier un appel découverte", "Télécharger notre guide technique", "Voir nos réalisations", "Obtenir une étude de faisabilité"
- JAMAIS "Demander un devis" sur toutes les pages — c'est paresseux et inefficace

2. SEO LOCAL
- Intégrer naturellement les références géographiques dans le contenu si pertinent
- Mentions de zones d'intervention, villes, départements dans les textes

3. DONNÉES STRUCTURÉES
- Pour chaque page, indiquer en commentaire les schemas à implémenter (FAQPage, Service, etc.)

4. AUTHENTICITÉ
- Ton humain, fluide, naturel — jamais robotique ni IA
- Style expert + pédagogue : montrer qu'on maîtrise le sujet
- Utiliser le vocabulaire technique du secteur (ça rassure et ça ranke)
- Éléments de réassurance concrets : chiffres, certifications, noms de technologies, cadre réglementaire

5. H1 = PROMESSE FORTE (CRITIQUE)
- Le H1 de la page d'accueil et des pages services/produits DOIT être une promesse forte, orientée bénéfice client
- PAS de H1 descriptif générique ("Nos services", "Bienvenue")
- Le H1 doit répondre à : "Pourquoi ce client devrait choisir CE prestataire ?"
- Exemples de bons H1 : "Inspections techniques par drone : précision millimétrique, coûts divisés par 3", "Votre site e-commerce qui convertit dès le premier mois"
- Le H1 doit contenir le mot-clé principal ET une proposition de valeur

6. STRUCTURE DE PAGE OBLIGATOIRE (dans cet ordre)
- **H1** : Promesse forte (bénéfice + mot-clé)
- **Bandeau social proof** (juste après le H1) : adapter au client — exemples :
  - "X clients accompagnés" / "X projets réalisés" / "X avis 5 étoiles"
  - "X commandes livrées" / "Certifié [norme]" / "Depuis [année]"
  - Utiliser les vrais chiffres du brief si disponibles, sinon proposer des placeholders [À compléter]
- **Points forts / Valeur ajoutée** (juste après le social proof) : 3 à 5 points clés en format visuel (icônes + titre + description courte), qui différencient le client de ses concurrents. S'appuyer sur l'USP, la différenciation, et les valeurs du brief.
- Puis le reste du contenu : Problème → Solution → Détails → Preuve → CTA

7. STRUCTURE ORIENTÉE CONVERSION
- Paragraphes courts (3-4 lignes max)
- Listes à puces pour les bénéfices et fonctionnalités
- Sous-titres H2/H3 qui répondent à des questions réelles
- Chaque section doit faire avancer le visiteur vers l'action

8. CAS REFONTE
- Si c'est une refonte : réécrire entièrement, ne jamais copier l'existant
- Moderniser le discours, améliorer le SEO, renforcer la conversion

FORMAT pour chaque page (en Markdown) :
- **Slug** optimisé SEO
- **Meta title** (< 60 caractères, optimisé CTR + SEO)
- **Meta description** (< 155 caractères, engageante, avec CTA implicite)
- **Schema markup recommandé** (en commentaire)
- **H1** = promesse forte (bénéfice + mot-clé)
- **Social proof** : bandeau chiffres clés juste après H1
- **Points forts** : 3-5 avantages différenciants
- **Contenu complet** avec H2/H3, texte, listes, CTA contextuel
- Chaque page : minimum 400 mots`
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
- Objectif de chaque article (trafic, autorité, conversion)`
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
- Structure : Accroche → Problème → Solution → Preuve → CTA
- Schema markup recommandé en commentaire pour chaque page
- Minimum 400 mots par page
- Tu DOIS rédiger TOUTES les pages listées dans l'arborescence du projet, sans exception
- Chaque page doit être séparée par un "---" et commencer par un titre H1 clair

IMPORTANT : Rédige le contenu complet de CHAQUE page identifiée dans l'arborescence. Tu ne dois oublier AUCUNE page. Si l'arborescence mentionne Accueil, À propos, Services, Contact — tu dois rédiger les 4 pages.

Pour chaque page, utilise ce format :

---

# Page : [Nom de la page]

**Slug** : slug-optimise
**Meta Title** : Titre optimisé (< 60 car.)
**Meta Description** : Description (< 155 car.)
**Schema Markup** : Types recommandés

[Contenu complet avec H2, H3, texte, listes, CTA contextuel]`
}

// ─── Streaming helpers ───────────────────────────────────────────────────────

function streamResponse(context: string, type: 'analyse' | 'redaction', analysis?: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: type === 'analyse' ? 12000 : 16000,
          system: getSystemPrompt(type),
          messages: [{ role: 'user', content: getUserPrompt(context, type, analysis) }],
        })
        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }
        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
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

// ─── [AMÉLIORATION 6] Opus for redaction + [7] Multi-pass review ─────────────

function streamRedactionWithReview(context: string, analysis: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Pass 1: Draft with Opus (premium quality)
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'draft' }) + '\n'))
        let draft = ''
        const draftStream = anthropic.messages.stream({
          model: 'claude-opus-4-20250514',
          max_tokens: 16000,
          system: getSystemPrompt('redaction'),
          messages: [{ role: 'user', content: getUserPrompt(context, 'redaction', analysis) }],
        })
        for await (const event of draftStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            draft += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Pass 2: Review & improve with Opus
        controller.enqueue(encoder.encode(JSON.stringify({ phase: 'review' }) + '\n'))
        const reviewStream = anthropic.messages.stream({
          model: 'claude-opus-4-20250514',
          max_tokens: 16000,
          system: `Tu es un relecteur SEO senior et copywriter expert. Tu relis un contenu rédigé par un autre rédacteur et tu l'améliores.

RÈGLES DE RELECTURE :
- Renforcer les H1 si la promesse n'est pas assez forte
- Vérifier que chaque CTA est différencié par persona (pas de "Demander un devis" partout)
- Ajouter du social proof manquant
- Renforcer les arguments de vente faibles
- Corriger les répétitions et les formulations génériques
- S'assurer que le vocabulaire technique du secteur est utilisé
- Vérifier la densité de mots-clés (ni trop ni trop peu)
- Améliorer les transitions entre sections
- Renforcer les éléments de réassurance

FORMAT : Renvoie le contenu complet AMÉLIORÉ (pas juste les corrections). Garde le même format Markdown.`,
          messages: [{
            role: 'user',
            content: `Voici le contenu à relire et améliorer :\n\n${draft}\n\n---\nRenvoie la version améliorée complète.`,
          }],
        })

        // Clear draft and stream the reviewed version
        controller.enqueue(encoder.encode(JSON.stringify({ clear: true }) + '\n'))
        for await (const event of reviewStream) {
          if (event.type === 'content_block_delta' && 'delta' in event && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + '\n'))
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
    model: type === 'redaction' ? 'claude-opus-4-20250514' : 'claude-sonnet-4-20250514',
    max_tokens: type === 'analyse' ? 12000 : 16000,
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
}

interface SERPResult {
  keyword: string
  items: { rank: number; domain: string; title: string; url: string }[]
}

interface BacklinkSummary {
  domain: string
  backlinks: number
  referring_domains: number
  rank: number
}

interface FullSEOData {
  volumes: KeywordData[]
  suggestions: KeywordData[]
  serp: SERPResult[]
  backlinks: BacklinkSummary | null
  clusters: Record<string, string[]>
}

// Extract seed keywords with clustering intent
async function extractSeedKeywords(context: string): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `Expert SEO. Extrais 20 mots-clés de recherche Google pertinents pour ce projet.
Inclus :
- 5 mots-clés principaux (courte traîne, fort volume)
- 5 mots-clés géolocalisés (si ville/région mentionnée)
- 5 mots-clés longue traîne (questions, "comment", "meilleur")
- 5 mots-clés concurrentiels (ce que les concurrents ciblent probablement)
Réponds UNIQUEMENT en JSON array de strings.`,
      messages: [{ role: 'user', content: context }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch (err) {
    console.error('[extractSeedKeywords]', err)
    return []
  }
}

// [AMÉLIORATION 3] Keyword clustering
async function clusterKeywords(keywords: KeywordData[]): Promise<Record<string, string[]>> {
  try {
    const kwList = keywords.filter(k => k.search_volume).map(k => k.keyword).join(', ')
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: 'Expert SEO. Regroupe ces mots-clés par intention de recherche et thématique. Réponds UNIQUEMENT en JSON: {"cluster_name": ["keyword1", "keyword2"]}. Maximum 8 clusters.',
      messages: [{ role: 'user', content: kwList }],
    })
    const text = (response.content[0] as { text: string }).text.trim()
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch { return {} }
}

// [AMÉLIORATION 1+4] Fetch ALL SEO data: volumes + suggestions + SERP + backlinks
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

    // Parse SERP results
    const serp: SERPResult[] = []
    for (let i = 0; i < 3; i++) {
      const serpData = await getResult(2 + i)
      if (serpData?.tasks?.[0]?.result?.[0]) {
        const result = serpData.tasks[0].result[0]
        const items = (result.items || [])
          .filter((item: Record<string, unknown>) => item.type === 'organic')
          .slice(0, 10)
          .map((item: Record<string, unknown>) => ({
            rank: item.rank_group,
            domain: item.domain,
            title: item.title,
            url: item.url,
          }))
        serp.push({ keyword: topKeywords[i], items })
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

// Format all SEO data for Claude context
function formatSEOData(data: FullSEOData): string {
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

  // SERP Analysis
  if (data.serp.length > 0) {
    parts.push('\n### Analyse SERP — Qui ranke sur les mots-clés cibles')
    for (const s of data.serp) {
      parts.push(`\n**"${s.keyword}"** — Top ${s.items.length} résultats :`)
      for (const item of s.items) {
        parts.push(`${item.rank}. ${item.domain} — "${item.title}"`)
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

  parts.push('\n⚠️ Source : DataForSEO / Google — ' + new Date().toLocaleDateString('fr-FR'))
  return parts.join('\n')
}

// ─── [AMÉLIORATION 2] Multi-page scraping for refonte ───────────────────────

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
