import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, count } = await req.json()
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = await prisma.gmbProject.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const nbPosts = count || project.postsPerMonth || 4

  try {
    const anthropic = new Anthropic()
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: `Tu es un expert en SEO local et Google My Business. Génère ${nbPosts} posts Google pour une fiche Google My Business.

Informations du projet :
- Entreprise : ${project.businessName || project.locationName}
- Secteur : ${project.sector || 'Non précisé'}
- Zone : ${project.zone || 'Non précisée'}
- Mots-clés : ${project.keywords.join(', ') || 'Non précisés'}
- Public cible : ${project.targetAudience || 'Non précisé'}
- Ton : ${project.tone || 'professionnel'}
- Services : ${project.services || 'Non précisés'}
- Points forts : ${project.uniquePoints || 'Non précisés'}
${project.directives ? `- Directives : ${project.directives}` : ''}

Règles :
- Chaque post doit faire entre 100 et 300 caractères
- Varier les types : actualité, offre, conseil, témoignage, événement
- Inclure les mots-clés naturellement
- Adapter au ton demandé
- Ajouter un appel à l'action à la fin de chaque post
- Les posts doivent être prêts à publier sur Google My Business

Réponds UNIQUEMENT en JSON array :
[{"content": "texte du post", "topicType": "STANDARD ou OFFER ou EVENT"}]` }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ error: 'Erreur de génération IA' }, { status: 500 })

    const generated: { content: string; topicType: string }[] = JSON.parse(match[0])

    // Schedule posts across the month
    const now = new Date()
    const postDays = project.postDays.length > 0 ? project.postDays : ['MONDAY', 'THURSDAY']
    const dayMap: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
    const targetDays = postDays.map(d => dayMap[d] ?? 1)
    const [hours, minutes] = (project.postTime || '10:00').split(':').map(Number)

    const scheduledPosts = []
    let datePointer = new Date(now)
    datePointer.setDate(datePointer.getDate() + 1) // Start tomorrow

    for (let i = 0; i < generated.length; i++) {
      // Find next target day
      while (!targetDays.includes(datePointer.getDay())) {
        datePointer.setDate(datePointer.getDate() + 1)
      }
      const scheduledAt = new Date(datePointer)
      scheduledAt.setHours(hours, minutes, 0, 0)

      const post = await prisma.gmbScheduledPost.create({
        data: {
          projectId,
          content: generated[i].content,
          topicType: generated[i].topicType || 'STANDARD',
          scheduledAt,
          status: 'PLANIFIE',
          aiGenerated: true,
        },
      })
      scheduledPosts.push(post)

      // Move to next day
      datePointer.setDate(datePointer.getDate() + 1)
    }

    return NextResponse.json({ posts: scheduledPosts })
  } catch (err) {
    console.error('GMB post generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
