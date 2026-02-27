import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create team members
  const [benjamin, louison, aysha] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'benjamin@kameo.fr' },
      update: {},
      create: {
        name: 'Benjamin',
        email: 'benjamin@kameo.fr',
        password: await bcrypt.hash('kameo2024', 10),
        role: 'ADMIN',
      },
    }),
    prisma.user.upsert({
      where: { email: 'louison@kameo.fr' },
      update: {},
      create: {
        name: 'Louison',
        email: 'louison@kameo.fr',
        password: await bcrypt.hash('kameo2024', 10),
        role: 'ADMIN',
      },
    }),
    prisma.user.upsert({
      where: { email: 'aysha@kameo.fr' },
      update: {},
      create: {
        name: 'Aysha',
        email: 'aysha@kameo.fr',
        password: await bcrypt.hash('kameo2024', 10),
        role: 'MEMBER',
      },
    }),
  ])

  console.log('✅ Users created: Benjamin, Louison, Aysha')

  // Seed wiki resources
  await prisma.resource.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Prompt — Audit SEO complet',
        category: 'PROMPT',
        pinned: true,
        tags: ['seo', 'audit', 'analyse'],
        content: `Tu vas réaliser un audit complet du site que je t'indique. Communique moi uniquement les informations demandées, et organisé et listé comme je te l'envoie. Utilise la recherche web et les outils disponibles pour collecter les données réelles. Structure ta réponse exactement ainsi :

**— PARTIE 1 — DONNÉES DU SITE**
• **Technologie** : CMS ou stack technique utilisée
• **Trafic** : estimation des clics mensuels
• **Mots-clés** : volume de mots-clés indexés estimé

**— PARTIE 2 — ANALYSE DÉTAILLÉE** indique uniquement les note

🚀 **Performances** — Note /100
Basée sur PageSpeed Insights. Indique uniquement le score mobile, le score desktop, et la moyenne des deux.

⚙️ **Technique SEO** — Note /100
Évalue : configuration et structure des balises (title, H1-H6, meta description), respect des tailles recommandées.

🎨 **Expérience utilisateur** — Note /100
Évalue : design graphique (UI), accessibilité (UX), clarté de la navigation, lisibilité.

📱 **Responsive** — Note /100
Évalue : adaptabilité sur tous les écrans (mobile, tablette, desktop).

**— PARTIE 3 — SCORE SEO GLOBAL**
Calcule le score final /100 avec la pondération suivante :
- Performances : coefficient 1/4
- Technique SEO : coefficient 1/4
- Expérience utilisateur : coefficient 0.5/4
- Responsive : coefficient 1/4

**— PARTIE 4 — AXES D'AMÉLIORATION PRIORITAIRES**
Liste les problèmes identifiés sous ce format :
**Problème** | Complexité : Simple / Modérée / Complexe | Urgence : Secondaire / Important / Critique`,
      },
      {
        title: 'Prompt — Rédaction page service',
        category: 'PROMPT',
        pinned: false,
        tags: ['redaction', 'seo', 'content'],
        content: `Rédige une page de service optimisée SEO pour une agence web.

Contraintes :
- Ton : professionnel, direct, orienté résultats
- Structure : H1 principal avec mot-clé cible, 3-5 sections H2, FAQ en bas
- Longueur : 600-900 mots
- Inclure des mots-clés LSI naturellement
- CTA clair à mi-page et en bas
- Éviter le jargon technique sauf si audience pro

Informations à fournir :
- Service : [ex: création site WordPress]
- Ville/Région ciblée : [ex: Paris]
- Client type : [ex: PME, restaurant, e-commerce]
- Prix indicatif : [ex: à partir de 2 499€]`,
      },
      {
        title: 'Plugins essentiels WordPress',
        category: 'PLUGIN',
        pinned: true,
        tags: ['wordpress', 'plugins', 'essentiel'],
        content: `PLUGINS ESSENTIELS KAMEO — WordPress

🔒 SÉCURITÉ
- Wordfence Security — Protection anti-malware, firewall
- WPS Hide Login — Masquer l'URL de connexion
- UpdraftPlus — Sauvegardes automatiques

⚡ PERFORMANCE
- WP Rocket — Cache (licence agence)
- Imagify — Compression images WebP (licence agence)
- Autoptimize — Minification CSS/JS

🔍 SEO
- Yoast SEO Premium — Optimisation on-page (licence agence)
- Rank Math — Alternative gratuite

📊 ANALYTICS & TRACKING
- MonsterInsights — Google Analytics dans WP
- PixelYourSite — Meta Pixel + Google Tag Manager

🔧 UTILITAIRES
- Elementor Pro — Page builder (licence agence)
- WPForms — Formulaires de contact
- Polylang — Multilingue
- TablePress — Tableaux responsive
- Safe SVG — Upload SVG sécurisé

Notes :
- Licences agence disponibles pour WP Rocket, Imagify, Yoast, Elementor Pro
- Mettre à jour les plugins après chaque livraison
- Ne jamais activer de plugins nulled`,
      },
      {
        title: 'Checklist livraison projet',
        category: 'GUIDE',
        pinned: true,
        tags: ['livraison', 'checklist', 'qualite'],
        content: `CHECKLIST LIVRAISON PROJET KAMEO

✅ TECHNIQUE
□ Favicon configuré
□ Titre et meta description sur toutes les pages
□ Balises H1 uniques par page
□ Images optimisées (WebP, < 200ko)
□ Attributs alt sur toutes les images
□ Site en HTTPS avec certificat SSL valide
□ Redirections 301 configurées si migration
□ Fichier robots.txt présent
□ Sitemap.xml soumis dans Search Console
□ Google Analytics / GA4 configuré
□ Google Tag Manager installé (si prévu)

📱 RESPONSIVE
□ Testé sur mobile (iPhone + Android)
□ Testé sur tablette
□ Testé sur desktop (1280px+)
□ Pas de débordements horizontaux

⚡ PERFORMANCES
□ Score PageSpeed mobile > 70
□ Score PageSpeed desktop > 85
□ Cache activé (WP Rocket ou équivalent)
□ Images en lazy loading
□ Fonts optimisées (preload)

🔍 SEO
□ Balises Open Graph configurées
□ Données structurées Schema.org (si pertinent)
□ Liens internes cohérents
□ Ancres de lien descriptives
□ Pas de contenu dupliqué

🔒 SÉCURITÉ
□ WordPress à jour (core + plugins)
□ Admin URL modifiée
□ Wordfence activé et configuré
□ Sauvegarde initiale effectuée

📝 CLIENT
□ Formation CMS réalisée (30min)
□ Accès transmis (hébergeur, WP admin)
□ Documentation remise
□ Facture envoyée`,
      },
      {
        title: 'Guide Framer — Bonnes pratiques',
        category: 'GUIDE',
        pinned: false,
        tags: ['framer', 'design', 'animation'],
        content: `FRAMER — BONNES PRATIQUES KAMEO

STRUCTURE DU PROJET
- Nommer les layers de façon descriptive (pas "Frame 23")
- Utiliser des composants pour les éléments répétés (header, footer, cards)
- Créer des variables de couleur et typo en début de projet

TYPOGRAPHIE
- Maximum 2 familles de polices
- Utiliser les breakpoints : Desktop 1440, Tablet 768, Mobile 390
- Tailles recommandées : H1 60-80px, H2 40-52px, Body 16-18px, Small 14px

ANIMATIONS
- Durée : 0.3-0.5s pour micro-interactions, 0.6-0.8s pour transitions de page
- Easing recommandé : ease-out pour entrées, ease-in-out pour hover
- Éviter les animations simultanées trop nombreuses (max 3)

EXPORT / LIVRAISON
- Vérifier le SEO Framer (titre, meta, slug des pages)
- Configurer le domaine personnalisé dans les settings
- Activer Analytics Framer ou connecter GA4
- Tester formulaires de contact avant livraison
- Vérifier les redirections depuis l'ancien site

PERFORMANCE
- Images : utiliser WebP, max 1920px de large
- Vidéos : héberger sur Vimeo/YouTube plutôt que directement
- Limiter les plugins CMS (ralentissent le chargement)`,
      },
    ],
  })

  console.log('✅ Wiki resources seeded')
  console.log('\n🎉 Seed terminé !')
  console.log('\n📋 Comptes créés :')
  console.log('   benjamin@kameo.fr / kameo2024')
  console.log('   louison@kameo.fr / kameo2024')
  console.log('   aysha@kameo.fr / kameo2024')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
