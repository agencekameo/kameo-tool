import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const maxDuration = 60

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Tu es l'assistant IA de l'Agence Kameo, intégré dans leur outil de gestion interne. Tu peux créer des devis, des clients, consulter les projets et les statistiques.

Règles :
- Réponds toujours en français, de manière concise et professionnelle
- Quand tu crées quelque chose, confirme avec les détails (numéro de devis, nom du client, etc.)
- Si tu as besoin d'informations manquantes pour exécuter une action, demande-les
- Pour les montants, utilise toujours des chiffres précis en euros HT
- Tu peux enchaîner plusieurs actions si nécessaire
- Formate tes réponses avec du markdown quand c'est pertinent (listes, gras, etc.)
- Sois direct et efficace, pas de blabla inutile`

const ACTION_WORDS = ['créer', 'modifier', 'supprimer', 'envoyer', 'générer', 'planifier', 'lancer', 'ajouter', 'mettre à jour', 'changer', 'crée', 'modifie', 'supprime', 'envoie', 'génère', 'planifie', 'lance', 'ajoute', 'liste', 'combien', 'montre', 'affiche']

function detectComplexity(message: string): 'simple' | 'complex' {
  const lower = message.toLowerCase()
  return ACTION_WORDS.some(w => lower.includes(w)) ? 'complex' : 'simple'
}

const tools: Anthropic.Tool[] = [
  {
    name: 'create_quote',
    description: 'Créer un nouveau devis pour un client',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientName: { type: 'string', description: 'Nom du client' },
        clientEmail: { type: 'string', description: 'Email du client' },
        subject: { type: 'string', description: 'Objet du devis' },
        deliveryDays: { type: 'number', description: 'Délai de livraison en jours' },
        paymentTerms: { type: 'string', description: 'Conditions: 50_50, 100_COMMANDE, 100_LIVRAISON, 30_70, 30_30_40' },
        items: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, unitPrice: { type: 'number' }, quantity: { type: 'number' } } } },
      },
      required: ['clientName', 'subject', 'items'],
    },
  },
  {
    name: 'create_client',
    description: 'Créer un nouveau client',
    input_schema: {
      type: 'object' as const,
      properties: {
        firstName: { type: 'string' }, lastName: { type: 'string' }, company: { type: 'string' },
        email: { type: 'string' }, phone: { type: 'string' }, website: { type: 'string' }, city: { type: 'string' },
      },
      required: ['firstName', 'lastName'],
    },
  },
  {
    name: 'list_quotes',
    description: 'Lister les devis existants',
    input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'list_clients',
    description: 'Lister ou rechercher des clients',
    input_schema: { type: 'object' as const, properties: { search: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'list_projects',
    description: 'Lister les projets',
    input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'get_stats',
    description: 'Obtenir les statistiques globales (clients, projets, devis, revenus)',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'update_quote_status',
    description: "Changer le statut d'un devis",
    input_schema: {
      type: 'object' as const,
      properties: { quoteNumber: { type: 'string' }, status: { type: 'string', description: 'EN_ATTENTE, ENVOYE, ACCEPTE, REFUSE' } },
      required: ['quoteNumber', 'status'],
    },
  },
  {
    name: 'search_prospects',
    description: 'Rechercher des prospects/leads',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string' } } },
  },
]

async function getNextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DEVIS-${year}-`
  const last = await prisma.quote.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { number: true } })
  if (!last) return `${prefix}001`
  const num = parseInt(last.number.split('-').pop() || '0') + 1
  return `${prefix}${String(num).padStart(3, '0')}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: any, userId: string): Promise<string> {
  switch (name) {
    case 'create_quote': {
      const number = await getNextQuoteNumber()
      const quote = await prisma.quote.create({
        data: {
          number, clientName: input.clientName, clientEmail: input.clientEmail || null,
          subject: input.subject, status: 'EN_ATTENTE',
          paymentTerms: input.paymentTerms || null,
          deliveryDays: input.deliveryDays ? parseInt(input.deliveryDays) : null,
          createdById: userId,
          items: { create: (input.items || []).map((item: { description: string; unitPrice: number; quantity?: number }, i: number) => ({ description: item.description, unit: 'forfait', quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice) || 0, tva: 20, position: i })) },
        },
        include: { items: true },
      })
      const totalHT = quote.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
      return JSON.stringify({ success: true, number: quote.number, client: quote.clientName, subject: quote.subject, totalHT: totalHT.toFixed(2) + ' € HT', items: quote.items.length })
    }
    case 'create_client': {
      const name = `${input.firstName || ''} ${input.lastName || ''}`.trim()
      const client = await prisma.client.create({ data: { name, firstName: input.firstName || null, lastName: input.lastName || null, company: input.company || null, email: input.email || null, phone: input.phone || null, website: input.website || null, city: input.city || null } })
      return JSON.stringify({ success: true, id: client.id, name: client.name, company: client.company })
    }
    case 'list_quotes': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}; if (input.status) where.status = input.status
      const quotes = await prisma.quote.findMany({ where, take: Math.min(input.limit || 10, 50), orderBy: { createdAt: 'desc' }, select: { number: true, clientName: true, subject: true, status: true, createdAt: true, items: { select: { quantity: true, unitPrice: true } } } })
      return JSON.stringify({ count: quotes.length, quotes: quotes.map(q => ({ number: q.number, client: q.clientName, subject: q.subject, status: q.status, totalHT: q.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0).toFixed(2) + ' €', date: q.createdAt.toISOString().split('T')[0] })) })
    }
    case 'list_clients': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}; if (input.search) where.OR = [{ name: { contains: input.search, mode: 'insensitive' } }, { company: { contains: input.search, mode: 'insensitive' } }]
      const clients = await prisma.client.findMany({ where, take: Math.min(input.limit || 10, 50), orderBy: { createdAt: 'desc' }, select: { name: true, company: true, email: true, phone: true, city: true } })
      return JSON.stringify({ count: clients.length, clients })
    }
    case 'list_projects': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}; if (input.status) where.status = input.status
      const projects = await prisma.project.findMany({ where, take: Math.min(input.limit || 10, 50), orderBy: { createdAt: 'desc' }, select: { name: true, status: true, type: true, price: true, client: { select: { name: true } } } })
      return JSON.stringify({ count: projects.length, projects: projects.map(p => ({ name: p.name, client: p.client.name, status: p.status, type: p.type, price: p.price ? p.price + ' €' : null })) })
    }
    case 'get_stats': {
      const [clientCount, projectCount, quoteCount, quotes] = await Promise.all([prisma.client.count(), prisma.project.count(), prisma.quote.count(), prisma.quote.findMany({ where: { status: 'ACCEPTE' }, select: { items: { select: { quantity: true, unitPrice: true } } } })])
      const revenue = quotes.reduce((t, q) => t + q.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0), 0)
      return JSON.stringify({ clients: clientCount, projects: projectCount, totalQuotes: quoteCount, revenueSignes: revenue.toFixed(2) + ' €' })
    }
    case 'update_quote_status': {
      const quote = await prisma.quote.findUnique({ where: { number: input.quoteNumber } })
      if (!quote) return JSON.stringify({ error: `Devis ${input.quoteNumber} introuvable` })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.quote.update({ where: { number: input.quoteNumber }, data: { status: input.status as any } })
      return JSON.stringify({ success: true, number: input.quoteNumber, newStatus: input.status })
    }
    case 'search_prospects': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {}; if (input.query) where.OR = [{ name: { contains: input.query, mode: 'insensitive' } }, { company: { contains: input.query, mode: 'insensitive' } }]
      const prospects = await prisma.prospect.findMany({ where, take: 20, orderBy: { createdAt: 'desc' }, select: { name: true, company: true, email: true, phone: true, status: true } })
      return JSON.stringify({ count: prospects.length, prospects })
    }
    default: return JSON.stringify({ error: `Outil inconnu: ${name}` })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

  const { messages } = await req.json()
  if (!messages || !Array.isArray(messages)) return new Response(JSON.stringify({ error: 'Messages required' }), { status: 400 })

  const userId = (session.user as { id: string }).id
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
  const model = lastUserMsg ? (detectComplexity(lastUserMsg.content) === 'complex' ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001') : 'claude-haiku-4-5-20251001'

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) }
      try {
        const msgs: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        let loop = true
        while (loop) {
          loop = false
          // Stream the response for real-time text display
          const aiStream = anthropic.messages.stream({ model, max_tokens: 4096, system: SYSTEM_PROMPT, tools, messages: msgs })

          for await (const event of aiStream) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use') {
                send({ tool: event.content_block.name, status: 'executing' })
              }
            } else if (event.type === 'content_block_delta') {
              if ('delta' in event && event.delta.type === 'text_delta') {
                send({ text: event.delta.text })
              }
            }
          }

          // Get the final message to process tool calls
          const finalMessage = await aiStream.finalMessage()

          // Process tool calls
          for (const block of finalMessage.content) {
            if (block.type === 'tool_use') {
              try {
                const result = await executeTool(block.name, block.input, userId)
                send({ tool: block.name, status: 'done', result: JSON.parse(result) })
                msgs.push({ role: 'assistant', content: finalMessage.content })
                msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: result }] })
                loop = true
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                send({ tool: block.name, status: 'error', error: errMsg })
                msgs.push({ role: 'assistant', content: finalMessage.content })
                msgs.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: errMsg }), is_error: true }] })
                loop = true
              }
            }
          }
        }
        send({ done: true })
      } catch (err) {
        send({ error: err instanceof Error ? err.message : String(err) })
        // Log error cost (at least the input tokens were consumed)
        try { await prisma.apiCostLog.create({ data: { service: 'anthropic', action: 'chat', cost: 0.001, userId, details: { error: true } } }) } catch { /* ignore */ }
      }
      finally { controller.close() }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
}
