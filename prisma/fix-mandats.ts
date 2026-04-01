/**
 * Script one-shot pour corriger les références mandats:
 * 1. Renommer M2026-003 (CompareTonCuisiniste) → M2026-004
 * 2. Créer le second mandat Defikart en M2026-003
 *
 * Usage: npx tsx prisma/fix-mandats.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Trouver et renommer CompareTonCuisiniste de M2026-003 → M2026-004
  const compareTon = await prisma.mandat.findFirst({
    where: { referenceMandat: 'M2026-003' },
  })

  if (compareTon) {
    await prisma.mandat.update({
      where: { id: compareTon.id },
      data: { referenceMandat: 'M2026-004' },
    })
    console.log(`✓ ${compareTon.clientName} : M2026-003 → M2026-004`)
  } else {
    console.log('⚠ Aucun mandat M2026-003 trouvé à renommer')
  }

  // 2. Créer le second mandat Defikart (M2026-003)
  const existing003 = await prisma.mandat.findFirst({
    where: { referenceMandat: 'M2026-003' },
  })

  if (existing003) {
    console.log(`⚠ M2026-003 existe déjà (${existing003.clientName}), pas de création`)
  } else {
    const mandat = await prisma.mandat.create({
      data: {
        referenceMandat: 'M2026-003',
        clientName: 'DEFIKART TOULOUSE',
        bic: 'CCBPFRPPTLS',
        iban: 'FR7617807000115552164305667',
        subject: 'Mandat de prélèvement SEPA',
        billing: 'MENSUEL',
        priceHT: 240,
        paymentType: 'RECURRENT',
        active: true,
        signatureStatus: 'SIGNE',
        signedAt: new Date('2026-03-17'),
        startDate: new Date('2026-03-17'),
        endDate: new Date('2027-02-17'),
      },
    })
    console.log(`✓ Mandat Defikart créé : M2026-003 (id: ${mandat.id})`)
  }

  // Vérification
  const all = await prisma.mandat.findMany({
    where: { referenceMandat: { startsWith: 'M2026-' } },
    orderBy: { referenceMandat: 'asc' },
    select: { referenceMandat: true, clientName: true },
  })
  console.log('\nMandats 2026 après correction :')
  all.forEach(m => console.log(`  ${m.referenceMandat} — ${m.clientName}`))
  console.log(`\n→ Prochain mandat auto-généré sera M2026-005`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
