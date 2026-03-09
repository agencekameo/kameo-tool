import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siret = req.nextUrl.searchParams.get('siret')
  if (!siret || siret.length < 9) {
    return NextResponse.json({ error: 'SIRET invalide' }, { status: 400 })
  }

  const cleanSiret = siret.replace(/\s/g, '')
  const headers = { 'Accept': 'application/json', 'User-Agent': 'Kameo-CRM/1.0' }

  // Try recherche-entreprises.api.gouv.fr first (free, no key)
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&page=1&per_page=1`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      const results = data.results || []
      if (results.length > 0) {
        const entreprise = results[0]
        const siege = entreprise.siege || {}
        return NextResponse.json({
          company: entreprise.nom_complet || entreprise.nom_raison_sociale || '',
          address: [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(' '),
          postalCode: siege.code_postal || '',
          city: siege.libelle_commune || '',
          siret: siege.siret || cleanSiret,
        })
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback: api.insee.fr open data (SIREN endpoint)
  try {
    const res = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret/${cleanSiret}`,
      { headers: { ...headers, 'Authorization': `Bearer ${process.env.INSEE_TOKEN || ''}` } }
    )
    if (res.ok) {
      const data = await res.json()
      const etab = data.etablissement
      const adresse = etab?.adresseEtablissement || {}
      const ul = etab?.uniteLegale || {}
      return NextResponse.json({
        company: ul.denominationUniteLegale || [ul.prenomUsuelUniteLegale, ul.nomUniteLegale].filter(Boolean).join(' ') || '',
        address: [adresse.numeroVoieEtablissement, adresse.typeVoieEtablissement, adresse.libelleVoieEtablissement].filter(Boolean).join(' '),
        postalCode: adresse.codePostalEtablissement || '',
        city: adresse.libelleCommuneEtablissement || '',
        siret: cleanSiret,
      })
    }
  } catch {
    // Continue
  }

  // Fallback 2: opendatasoft open SIRENE dataset (no auth needed)
  try {
    const res = await fetch(
      `https://data.opendatasoft.com/api/records/1.0/search/?dataset=economicref-france-sirene-v3%40public&q=${cleanSiret}&rows=1`,
      { headers }
    )
    if (res.ok) {
      const data = await res.json()
      const records = data.records || []
      if (records.length > 0) {
        const fields = records[0].fields || {}
        return NextResponse.json({
          company: fields.denominationunitelegale || fields.nomunitelegale || '',
          address: [fields.numerovoieetablissement, fields.typevoieetablissement, fields.libellevoieetablissement].filter(Boolean).join(' '),
          postalCode: fields.codepostaletablissement || '',
          city: fields.libellecommuneetablissement || '',
          siret: cleanSiret,
        })
      }
    }
  } catch {
    // All failed
  }

  return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 })
}
