import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'No userId provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

    // Helper: find a value by trying multiple possible column names (case-insensitive)
    const getField = (row: Record<string, string>, ...keys: string[]): string | null => {
      for (const key of keys) {
        const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase())
        if (found && row[found]?.toString().trim()) return row[found].toString().trim()
      }
      return null
    }

    const prospects = rows
      .filter((row) => getField(row, 'Nom', 'Name', 'Prospect', 'Client', 'Société', 'Entreprise'))
      .map((row) => ({
        name: getField(row, 'Nom', 'Name', 'Prospect', 'Client') || getField(row, 'Société', 'Entreprise', 'Company') || '',
        company: getField(row, 'Entreprise', 'Société', 'Company', 'Raison sociale'),
        email: getField(row, 'Email', 'E-mail', 'Mail', 'Adresse email', 'Courriel'),
        phone: getField(row, 'Téléphone', 'Tel', 'Tél', 'Phone', 'Portable', 'Mobile', 'Numéro'),
        address: getField(row, 'Adresse', 'Address', 'Rue', 'Voie'),
        postalCode: getField(row, 'Code postal', 'Code Postal', 'CP', 'Postal', 'Zip'),
        city: getField(row, 'Ville', 'City', 'Commune', 'Localité'),
        budget: (() => { const v = getField(row, 'Budget', 'Montant'); return v ? parseFloat(v) || null : null })(),
        source: getField(row, 'Source', 'Origine', 'Canal'),
        notes: getField(row, 'Notes', 'Remarques', 'Commentaire', 'Commentaires', 'Observation'),
        status: 'A_CONTACTER' as const,
        assignedTo: userId,
      }))

    if (prospects.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 })
    }

    await prisma.prospect.createMany({ data: prospects })

    return NextResponse.json({ count: prospects.length })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to import file' }, { status: 500 })
  }
}
