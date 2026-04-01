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

    // Get next reference number
    const year = new Date().getFullYear()
    const prefix = `M${year}-`
    const lastMandat = await prisma.mandat.findFirst({
      where: { referenceMandat: { startsWith: prefix } },
      orderBy: { referenceMandat: 'desc' },
      select: { referenceMandat: true },
    })
    let nextNum = lastMandat?.referenceMandat ? parseInt(lastMandat.referenceMandat.replace(prefix, ''), 10) + 1 : 1

    const results: { filename: string; success: boolean; error?: string; mandatId?: string }[] = []

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
                text: `Analyse ce mandat de prélèvement SEPA et extrais les informations suivantes au format JSON strict (sans markdown, juste le JSON).
Si une info n'est pas trouvée, mets null.

Champs à extraire:
- clientName: nom ou dénomination sociale du client/débiteur (pas Kameo)
- clientPrenom: prénom du client
- clientEmail: email du client
- clientAddress: adresse du client
- clientPostalCode: code postal (string)
- clientCity: ville
- clientCountry: pays (défaut "France")
- bic: code BIC bancaire
- iban: numéro IBAN (sans espaces)
- referenceContrat: référence/numéro du contrat associé
- descriptionContrat: description du contrat associé
- paymentType: RECURRENT ou PONCTUEL
- subject: sujet du mandat
- signedAt: date de signature au format YYYY-MM-DD si trouvée
- signedCity: ville de signature`
              },
            ],
          }],
        })

        const jsonText = (response.content[0] as { type: string; text: string }).text
        const data = JSON.parse(jsonText.replace(/```json?\n?/g, '').replace(/```/g, '').trim())

        const referenceMandat = `${prefix}${String(nextNum).padStart(3, '0')}`
        nextNum++

        const mandat = await prisma.mandat.create({
          data: {
            referenceMandat,
            clientName: data.clientName || file.name.replace(/\.pdf$/i, ''),
            clientPrenom: data.clientPrenom || null,
            clientEmail: data.clientEmail || null,
            subject: data.subject || 'Mandat de prélèvement SEPA',
            billing: 'MENSUEL',
            active: true,
            signatureStatus: 'SIGNE',
            signedAt: data.signedAt ? new Date(data.signedAt) : new Date(),
            signedCity: data.signedCity || null,
            clientAddress: data.clientAddress || null,
            clientPostalCode: data.clientPostalCode || null,
            clientCity: data.clientCity || null,
            clientCountry: data.clientCountry || 'France',
            bic: data.bic || null,
            iban: data.iban ? String(data.iban).replace(/\s/g, '').toUpperCase() : null,
            paymentType: data.paymentType || 'RECURRENT',
            referenceContrat: data.referenceContrat || null,
            descriptionContrat: data.descriptionContrat || null,
            createdById: session.user.id,
          },
        })

        results.push({ filename: file.name, success: true, mandatId: mandat.id })
      } catch (err) {
        results.push({ filename: file.name, success: false, error: (err as Error).message })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error('[POST /api/mandats/import]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
