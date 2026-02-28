import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Clé API Anthropic non configurée' }, { status: 503 })
  }

  const { prompt, title } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Le résumé est requis' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `Tu es un expert en rédaction de cahiers des charges pour une agence web nommée Kameo.
Tu rédiges des cahiers des charges professionnels, complets et structurés en français, au format Markdown.
Sois précis, professionnel et adapte le contenu au contexte du projet décrit.
Si certaines informations ne sont pas fournies, propose des éléments cohérents et plausibles.`

  const userPrompt = `Rédige un cahier des charges professionnel et complet pour le projet suivant.

**Titre du projet :** ${title || 'Projet web'}

**Résumé / Description :**
${prompt}

---

Le cahier des charges doit suivre exactement cette structure :

# CAHIER DES CHARGES — ${title || 'Projet web'}

**Date :** ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
**Prestataire :** Kameo
**Statut :** Brouillon

---

## 1. Présentation du projet

### 1.1 Contexte
[Contexte dans lequel s'inscrit le projet]

### 1.2 Description générale
[Description détaillée du projet]

### 1.3 Enjeux
[Principaux enjeux du projet]

---

## 2. Objectifs

### 2.1 Objectifs principaux
[Liste des objectifs]

### 2.2 Indicateurs de succès (KPIs)
[Métriques pour mesurer le succès]

---

## 3. Public cible

### 3.1 Personas utilisateurs
[Description des types d'utilisateurs]

### 3.2 Besoins et attentes
[Ce que les utilisateurs recherchent]

---

## 4. Périmètre du projet

### 4.1 Inclus dans le projet
[Ce qui est inclus]

### 4.2 Hors périmètre
[Ce qui n'est pas inclus]

---

## 5. Fonctionnalités attendues

### 5.1 Fonctionnalités prioritaires (Must-have)
[Liste numérotée des fonctionnalités essentielles]

### 5.2 Fonctionnalités secondaires (Should-have)
[Liste des fonctionnalités importantes]

### 5.3 Fonctionnalités souhaitées (Nice-to-have)
[Liste des fonctionnalités optionnelles]

---

## 6. Arborescence et structure

[Schéma textuel ou liste hiérarchique des pages/sections]

---

## 7. Design et charte graphique

### 7.1 Style général
[Ambiance visuelle souhaitée]

### 7.2 Couleurs et typographie
[Palette, polices]

### 7.3 Références et inspirations
[Sites ou projets de référence]

---

## 8. Contraintes techniques

### 8.1 Technologies
[Technologies souhaitées ou imposées]

### 8.2 Hébergement et infrastructure
[Hébergement, nom de domaine, CDN]

### 8.3 Performance et SEO
[Objectifs de performance, référencement]

### 8.4 Compatibilité
[Navigateurs, appareils, accessibilité]

---

## 9. Contenu

### 9.1 Fourniture du contenu
[Qui fournit quoi]

### 9.2 Langues
[Langues supportées]

### 9.3 Médias
[Images, vidéos, documents]

---

## 10. Planning prévisionnel

| Phase | Description | Durée estimée |
|-------|-------------|---------------|
| Phase 1 | Brief & cadrage | ... |
| Phase 2 | Conception & maquettes | ... |
| Phase 3 | Développement | ... |
| Phase 4 | Recette & corrections | ... |
| Phase 5 | Mise en ligne | ... |

---

## 11. Budget estimatif

[Fourchette budgétaire et répartition si connue]

---

## 12. Livrables

[Liste des livrables attendus à la fin du projet]

---

## 13. Critères de réception

[Conditions de validation et d'acceptation du projet]

---

## 14. Intervenants

| Rôle | Responsabilités |
|------|-----------------|
| Chef de projet | ... |
| Designer | ... |
| Développeur | ... |
| Client | ... |

---

*Document rédigé par Kameo · ${new Date().getFullYear()}*`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    return NextResponse.json({ content: content.text })
  } catch (error) {
    console.error('Anthropic error:', error)
    return NextResponse.json({ error: 'Échec de la génération IA' }, { status: 500 })
  }
}
