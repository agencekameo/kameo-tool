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
    // Also sanitizes against CSV/formula injection (=, +, -, @, |, %)
    const sanitize = (val: string | null): string | null => {
      if (!val) return null
      return /^[=+\-@|%]/.test(val) ? `'${val}` : val
    }
    const getField = (row: Record<string, string>, ...keys: string[]): string | null => {
      for (const key of keys) {
        const found = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase())
        if (found && row[found]?.toString().trim()) return sanitize(row[found].toString().trim())
      }
      return null
    }

    const prospects = rows
      .filter((row) => getField(row, 'Nom', 'Name', 'Prospect', 'Client', 'Société', 'Entreprise'))
      .filter((row) => getField(row, 'Téléphone', 'Tel', 'Tél', 'Phone', 'Portable', 'Mobile', 'Numéro'))
      .map((row) => ({
        name: getField(row, 'Nom', 'Name', 'Prospect', 'Client') || getField(row, 'Société', 'Entreprise', 'Company') || '',
        company: getField(row, 'Entreprise', 'Société', 'Company', 'Raison sociale', 'Statut d\'entreprise', 'Statut'),
        email: getField(row, 'Email', 'E-mail', 'Mail', 'Adresse email', 'Courriel'),
        phone: getField(row, 'Téléphone', 'Tel', 'Tél', 'Phone', 'Portable', 'Mobile', 'Numéro'),
        website: getField(row, 'Site internet', 'Site web', 'Website', 'Site', 'URL', 'Url'),
        googleUrl: (() => {
          const url = getField(row, 'Fiche Google', 'Google', 'Fiche google', 'Google Maps', 'GMB')
          if (!url) return null
          // Convert directions URLs to place/search URLs (not itinerary)
          if (url.includes('/maps/dir/')) {
            // Extract destination name from directions URL
            const parts = url.split('/maps/dir/')[1]?.split('/')
            const dest = parts?.[1] || parts?.[0]
            if (dest) return `https://www.google.com/maps/place/${encodeURIComponent(dest)}`
          }
          // Convert maps search URLs to place URLs
          if (url.includes('/maps/search/') || url.includes('/maps/place/')) {
            return url
          }
          // If it's a short Google Maps URL or other format, keep as-is
          return url
        })(),
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

    // Deduplicate against ALL existing prospects (cross-user)
    const existingProspects = await prisma.prospect.findMany({
      select: { name: true, phone: true },
    })
    const existingNames = new Set(existingProspects.map(p => p.name.toLowerCase().trim()))
    const existingPhones = new Set(existingProspects.filter(p => p.phone).map(p => p.phone!.replace(/\s/g, '')))

    const unique = prospects.filter(p => {
      const nameLower = p.name.toLowerCase().trim()
      const phone = p.phone?.replace(/\s/g, '') || ''
      if (existingNames.has(nameLower)) return false
      if (phone && existingPhones.has(phone)) return false
      existingNames.add(nameLower)
      if (phone) existingPhones.add(phone)
      return true
    })

    if (unique.length === 0) {
      return NextResponse.json({ count: 0, duplicates: prospects.length })
    }

    await prisma.prospect.createMany({ data: unique })

    return NextResponse.json({ count: unique.length, duplicates: prospects.length - unique.length })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Failed to import file' }, { status: 500 })
  }
}
