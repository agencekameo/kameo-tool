import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { demoGuard } from '@/lib/demo'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const guard = demoGuard(session)
  if (guard) return guard

  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const results: { filename: string; success: boolean; error?: string; contractId?: string }[] = []

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const base64 = buffer.toString('base64')

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              },
              {
                type: 'text',
                text: `Analyse ce contrat et extrais les informations suivantes au format JSON strict (sans markdown, juste le JSON).
Si une info n'est pas trouvée, mets null.

Champs à extraire:
- clientName: nom ou dénomination sociale du client (pas Kameo, l'autre partie)
- clientEmail: email du client
- clientAddress: adresse du client
- clientPostalCode: code postal (string)
- clientCity: ville
- clientCountry: pays (défaut "France")
- clientPhone: téléphone
- clientSiren: numéro SIREN ou SIRET
- type: type de contrat parmi PACK_COM, MAINTENANCE_WEB, FICHE_GOOGLE, ARTICLES_BLOG (déduis-le du contenu)
- maintenanceLevel: si type=MAINTENANCE_WEB, le niveau 1-4 selon les services inclus (1=hébergement seul, 2=hébergement+domaine+elementor+maj+sauvegarde+support, 3=niveau2+1h dev, 4=niveau3+appel trimestriel)
- priceHT: prix HT mensuel (nombre décimal, sans le symbole €)
- billing: MENSUEL, TRIMESTRIEL ou ANNUEL
- duration: durée du contrat (ex: "12 mois", "1 an")
- startDate: date de début au format YYYY-MM-DD si trouvée
- endDate: date de fin au format YYYY-MM-DD si trouvée
- subject: sujet/titre du contrat`
              },
            ],
          }],
        })

        const jsonText = (response.content[0] as { type: string; text: string }).text
        const data = JSON.parse(jsonText.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

        const contract = await prisma.contract.create({
          data: {
            clientName: data.clientName || file.name.replace(/\.pdf$/i, ''),
            clientEmail: data.clientEmail || null,
            subject: data.subject || null,
            type: data.type || 'PRESTATION',
            billing: data.billing || 'MENSUEL',
            priceHT: data.priceHT ? parseFloat(String(data.priceHT)) : null,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
            active: true,
            signatureStatus: 'SIGNE',
            clientAddress: data.clientAddress || null,
            clientPostalCode: data.clientPostalCode || null,
            clientCity: data.clientCity || null,
            clientCountry: data.clientCountry || 'France',
            clientPhone: data.clientPhone || null,
            clientSiren: data.clientSiren || null,
            duration: data.duration || null,
            maintenanceLevel: data.maintenanceLevel ? parseInt(String(data.maintenanceLevel)) : null,
            createdById: session.user.id,
          },
        })

        results.push({ filename: file.name, success: true, contractId: contract.id })
      } catch (err) {
        results.push({ filename: file.name, success: false, error: (err as Error).message })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[POST /api/contracts/import]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
