import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning previous demo data...')

  // Find all existing DEMO users
  const existingDemoUsers = await prisma.user.findMany({ where: { role: 'DEMO' }, select: { id: true } })
  const demoUserIds = existingDemoUsers.map(u => u.id)

  if (demoUserIds.length > 0) {
    // Delete data created by demo users
    await prisma.task.deleteMany({ where: { project: { createdById: { in: demoUserIds } } } })
    await prisma.projectAssignee.deleteMany({ where: { project: { createdById: { in: demoUserIds } } } })
    await prisma.project.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.quoteItem.deleteMany({ where: { quote: { createdById: { in: demoUserIds } } } })
    await prisma.quote.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.audit.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.client.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.expense.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.maintenanceContract.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.resource.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.contract.deleteMany({ where: { createdById: { in: demoUserIds } } })
    await prisma.articleTemplate.deleteMany({ where: { createdById: { in: demoUserIds } } })
    // Delete prospects assigned to demo users
    await prisma.prospect.deleteMany({ where: { assignedTo: { in: demoUserIds } } })
    // Delete demo users themselves
    await prisma.user.deleteMany({ where: { role: 'DEMO' } })
  }

  // Also clean up any orphan demo data from old seed (by known emails)
  const oldDemoEmails = ['demo@agence-kameo.fr', 'hugo.martin@demo.fr', 'emma.leroy@demo.fr', 'lucas.bernard@demo.fr', 'lea.moreau@demo.fr']
  const oldDemoUsers = await prisma.user.findMany({ where: { email: { in: oldDemoEmails } }, select: { id: true } })
  if (oldDemoUsers.length > 0) {
    const oldIds = oldDemoUsers.map(u => u.id)
    await prisma.project.deleteMany({ where: { createdById: { in: oldIds } } })
    await prisma.quote.deleteMany({ where: { createdById: { in: oldIds } } })
    await prisma.audit.deleteMany({ where: { createdById: { in: oldIds } } })
    await prisma.prospect.deleteMany({ where: { assignedTo: { in: oldIds } } })
    await prisma.user.deleteMany({ where: { email: { in: oldDemoEmails } } })
  }

  // Clean orphan demo data by known patterns
  await prisma.client.deleteMany({ where: { email: { in: ['sophie@boulangerie-marchand.fr', 'thomas@durand-archi.fr', 'marie@yoga-zen.fr', 'pierre@lambert-immo.fr', 'julie@fleurspetit.fr', 'antoine@garage-moreau.fr', 'claire@dubois-avocats.fr', 'nicolas@roux-traiteur.fr'] } } })
  await prisma.maintenanceContract.deleteMany({ where: { clientName: { in: ['Boulangerie Marchand', 'Durand Architecture', 'Yoga Zen Studio', 'Cabinet Dubois'] } } })
  await prisma.expense.deleteMany({ where: { name: { in: ['Hébergement Vercel', 'Figma Pro', 'Adobe Creative Cloud', 'Domaines OVH', 'Assurance RC Pro', 'Banque Qonto', 'Notion Team', 'Salaire Hugo', 'Salaire Emma'] } } })
  await prisma.contract.deleteMany({ where: { clientName: { in: ['Boulangerie Marchand', 'Durand Architecture', 'Lambert Immobilier'] } } })

  console.log('Seeding demo data...')

  // ── 1. Demo user ────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('demo2025', 10)
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@agence-kameo.fr',
      password,
      name: 'Compte Démo',
      role: 'DEMO',
    },
  })
  console.log(`  Demo user: demo@agence-kameo.fr / demo2025 (id: ${demoUser.id})`)

  // ── Fake team members (all DEMO role) ─────────────────────────────────────
  const fakeMembers = [
    { email: 'hugo.martin@demo.fr', name: 'Hugo Martin' },
    { email: 'emma.leroy@demo.fr', name: 'Emma Leroy' },
    { email: 'lucas.bernard@demo.fr', name: 'Lucas Bernard' },
    { email: 'lea.moreau@demo.fr', name: 'Léa Moreau' },
  ]
  const teamMembers = [demoUser]
  for (const m of fakeMembers) {
    const user = await prisma.user.create({
      data: { email: m.email, password, name: m.name, role: 'DEMO' },
    })
    teamMembers.push(user)
  }
  console.log(`  ${teamMembers.length} team members created (all DEMO role)`)

  // ── 2. Clients ──────────────────────────────────────────────────────────────
  const clientsData = [
    { name: 'Sophie Marchand', email: 'sophie@boulangerie-marchand.fr', phone: '06 12 34 56 78', company: 'Boulangerie Marchand', website: 'https://boulangerie-marchand.fr', address: '12 Rue du Pain', postalCode: '75011', city: 'Paris', maintenancePlan: 'CLASSIQUE' as const, maintenancePrice: 49 },
    { name: 'Thomas Durand', email: 'thomas@durand-archi.fr', phone: '06 23 45 67 89', company: 'Durand Architecture', website: 'https://durand-architecture.fr', address: '8 Avenue des Arts', postalCode: '69003', city: 'Lyon', maintenancePlan: 'SEO' as const, maintenancePrice: 99 },
    { name: 'Marie Fontaine', email: 'marie@yoga-zen.fr', phone: '06 34 56 78 90', company: 'Yoga Zen Studio', website: 'https://yoga-zen-studio.fr', address: '45 Rue de la Paix', postalCode: '33000', city: 'Bordeaux', maintenancePlan: 'CONTENU' as const, maintenancePrice: 79 },
    { name: 'Pierre Lambert', email: 'pierre@lambert-immo.fr', phone: '06 45 67 89 01', company: 'Lambert Immobilier', website: 'https://lambert-immobilier.fr', address: '3 Place du Marché', postalCode: '44000', city: 'Nantes', maintenancePlan: 'HEBERGEMENT' as const, maintenancePrice: 29 },
    { name: 'Julie Petit', email: 'julie@fleurspetit.fr', phone: '06 56 78 90 12', company: 'Fleurs Petit', website: 'https://fleurspetit.fr', address: '22 Rue des Lilas', postalCode: '31000', city: 'Toulouse', maintenancePlan: 'NONE' as const, maintenancePrice: null },
    { name: 'Antoine Moreau', email: 'antoine@garage-moreau.fr', phone: '06 67 89 01 23', company: 'Garage Moreau', website: 'https://garage-moreau.fr', address: '15 Bd Industriel', postalCode: '13001', city: 'Marseille', maintenancePlan: 'CLASSIQUE' as const, maintenancePrice: 49 },
    { name: 'Claire Dubois', email: 'claire@dubois-avocats.fr', phone: '06 78 90 12 34', company: 'Cabinet Dubois Avocats', website: 'https://dubois-avocats.fr', address: '50 Rue du Palais', postalCode: '67000', city: 'Strasbourg', maintenancePlan: 'SEO' as const, maintenancePrice: 99 },
    { name: 'Nicolas Roux', email: 'nicolas@roux-traiteur.fr', phone: '06 89 01 23 45', company: 'Roux Traiteur', website: 'https://roux-traiteur.fr', address: '7 Rue Gastronomique', postalCode: '06000', city: 'Nice', maintenancePlan: 'NONE' as const, maintenancePrice: null },
  ]

  const clients = []
  for (const c of clientsData) {
    const client = await prisma.client.create({ data: { ...c, createdById: demoUser.id } })
    clients.push(client)
  }
  console.log(`  ${clients.length} clients created`)

  // ── 3. Projects ─────────────────────────────────────────────────────────────
  const projectsData = [
    { name: 'Site vitrine Boulangerie', clientIdx: 0, type: 'WORDPRESS' as const, status: 'DEVELOPPEMENT' as const, price: 2500, services: ['Site vitrine', 'SEO', 'Responsive'] },
    { name: 'Portfolio Architecture', clientIdx: 1, type: 'FRAMER' as const, status: 'MAQUETTE' as const, price: 3800, services: ['Design', 'Animations', 'Portfolio'] },
    { name: 'Site Yoga Zen', clientIdx: 2, type: 'WORDPRESS' as const, status: 'LIVRAISON' as const, price: 1800, services: ['Site vitrine', 'Booking', 'Blog'] },
    { name: 'Plateforme immobilière', clientIdx: 3, type: 'CUSTOM' as const, status: 'DEVELOPPEMENT' as const, price: 8500, services: ['App web', 'API', 'Dashboard'] },
    { name: 'E-commerce Fleurs', clientIdx: 4, type: 'ECOMMERCE' as const, status: 'BRIEF' as const, price: 4200, services: ['E-commerce', 'Paiement', 'Livraison'] },
    { name: 'Site Garage Moreau', clientIdx: 5, type: 'WORDPRESS' as const, status: 'MAINTENANCE' as const, price: 2200, services: ['Site vitrine', 'SEO local', 'Formulaire'] },
    { name: 'Site Cabinet Avocats', clientIdx: 6, type: 'FRAMER' as const, status: 'REVIEW' as const, price: 3200, services: ['Design premium', 'Blog', 'Contact'] },
    { name: 'Landing Roux Traiteur', clientIdx: 7, type: 'FRAMER' as const, status: 'REDACTION' as const, price: 1500, services: ['Landing page', 'Menu', 'Réservation'] },
  ]

  const projects = []
  for (const p of projectsData) {
    const assigneeIdx = Math.floor(Math.random() * teamMembers.length)
    const project = await prisma.project.create({
      data: {
        name: p.name,
        clientId: clients[p.clientIdx].id,
        type: p.type,
        status: p.status,
        price: p.price,
        services: p.services,
        createdById: demoUser.id,
        startDate: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        deadline: new Date(2026, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1),
      },
    })
    await prisma.projectAssignee.create({
      data: {
        projectId: project.id,
        userId: teamMembers[assigneeIdx].id,
        price: p.price * 0.6,
        status: 'VALIDE',
      },
    })
    projects.push(project)
  }
  console.log(`  ${projects.length} projects created`)

  // ── 4. Tasks ────────────────────────────────────────────────────────────────
  const taskTemplates = [
    'Maquette desktop', 'Maquette mobile', 'Intégration header', 'Intégration footer',
    'SEO on-page', 'Rédaction contenu', 'Optimisation images', 'Configuration formulaire',
    'Tests responsive', 'Corrections client', 'Mise en production', 'Setup hébergement',
    'Configuration DNS', 'Rédaction CGV', 'Intégration blog', 'Design page accueil',
    'Animation scroll', 'Setup analytics', 'Backup initial', 'Formation client',
  ]
  const statuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

  let taskCount = 0
  for (const project of projects) {
    const numTasks = 4 + Math.floor(Math.random() * 6)
    for (let i = 0; i < numTasks; i++) {
      const tmpl = taskTemplates[Math.floor(Math.random() * taskTemplates.length)]
      await prisma.task.create({
        data: {
          title: tmpl,
          projectId: project.id,
          assigneeId: teamMembers[Math.floor(Math.random() * teamMembers.length)].id,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          position: i,
          dueDate: new Date(2026, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1),
        },
      })
      taskCount++
    }
  }
  console.log(`  ${taskCount} tasks created`)

  // ── 5. Quotes ───────────────────────────────────────────────────────────────
  const quoteStatuses = ['EN_ATTENTE', 'BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE'] as const
  const quoteItems = [
    { description: 'Création site vitrine WordPress', unitPrice: 2500, unit: 'forfait' },
    { description: 'Design UX/UI sur mesure', unitPrice: 1800, unit: 'forfait' },
    { description: 'Référencement SEO initial', unitPrice: 800, unit: 'forfait' },
    { description: 'Maintenance mensuelle', unitPrice: 49, unit: 'mois', quantity: 12 },
    { description: 'Rédaction de contenu (10 pages)', unitPrice: 120, unit: 'page', quantity: 10 },
    { description: 'Développement sur mesure', unitPrice: 450, unit: 'jour', quantity: 5 },
    { description: 'Formation administration site', unitPrice: 350, unit: 'session' },
    { description: 'E-commerce WooCommerce', unitPrice: 3500, unit: 'forfait' },
  ]

  for (let i = 0; i < 6; i++) {
    const client = clients[i]
    const status = quoteStatuses[Math.floor(Math.random() * quoteStatuses.length)]
    const quote = await prisma.quote.create({
      data: {
        number: `DEMO-2026-${String(i + 1).padStart(3, '0')}`,
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        clientAddress: `${client.address}, ${client.postalCode} ${client.city}`,
        subject: `Création site web — ${client.company}`,
        status,
        validUntil: new Date(2026, 6, 30),
        createdById: demoUser.id,
      },
    })
    const numItems = 2 + Math.floor(Math.random() * 3)
    const shuffled = [...quoteItems].sort(() => Math.random() - 0.5).slice(0, numItems)
    for (let j = 0; j < shuffled.length; j++) {
      await prisma.quoteItem.create({
        data: {
          quoteId: quote.id,
          description: shuffled[j].description,
          unitPrice: shuffled[j].unitPrice,
          unit: shuffled[j].unit,
          quantity: shuffled[j].quantity ?? 1,
          position: j,
        },
      })
    }
  }
  console.log('  6 quotes created')

  // ── 6. Prospects ──────────────────────────────────────────────────────────
  const prospectsData = [
    { name: 'Camille Rousseau', company: 'Rousseau Consulting', email: 'camille@rousseau-consulting.fr', phone: '06 11 22 33 44', status: 'VISIO_PLANIFIE' as const, budget: 3000, source: 'Google' },
    { name: 'Maxime Girard', company: 'Girard Auto', email: 'max@girard-auto.fr', phone: '06 22 33 44 55', status: 'A_CONTACTER' as const, budget: 2500, source: 'Recommandation' },
    { name: 'Elise Bonnet', company: 'Bonnet Déco', email: 'elise@bonnet-deco.fr', phone: '06 33 44 55 66', status: 'DEVIS_ENVOYE' as const, budget: 4500, source: 'Instagram' },
    { name: 'Romain Lefebvre', company: 'Lefebvre Tech', email: 'romain@lefebvre-tech.fr', phone: '06 44 55 66 77', status: 'A_RAPPELER' as const, budget: 7000, source: 'LinkedIn' },
    { name: 'Pauline Garnier', company: 'Pauline Photo', email: 'pauline@paulinephoto.fr', phone: '06 55 66 77 88', status: 'SIGNE' as const, budget: 1800, source: 'Événement' },
    { name: 'Vincent Michel', company: 'Michel Plomberie', email: 'vincent@michel-plomberie.fr', phone: '06 66 77 88 99', status: 'REFUSE' as const, budget: 1200, source: 'Google' },
    { name: 'Aurélie Simon', company: 'Simon Bijoux', email: 'aurelie@simon-bijoux.fr', phone: '06 77 88 99 00', status: 'DEVIS_TRANSMETTRE' as const, budget: 5000, source: 'Salon' },
  ]

  for (const p of prospectsData) {
    await prisma.prospect.create({
      data: { ...p, assignedTo: teamMembers[Math.floor(Math.random() * teamMembers.length)].id },
    })
  }
  console.log('  7 prospects created')

  // ── 7. Expenses ─────────────────────────────────────────────────────────────
  const expensesData = [
    { name: 'Hébergement Vercel', amount: 20, category: 'ABONNEMENT' as const },
    { name: 'Figma Pro', amount: 12, category: 'LOGICIEL' as const },
    { name: 'Adobe Creative Cloud', amount: 59.99, category: 'LOGICIEL' as const },
    { name: 'Domaines OVH', amount: 35, category: 'ABONNEMENT' as const },
    { name: 'Assurance RC Pro', amount: 45, category: 'ASSURANCE' as const },
    { name: 'Banque Qonto', amount: 9, category: 'BANQUE' as const },
    { name: 'Notion Team', amount: 8, category: 'LOGICIEL' as const },
    { name: 'Salaire Hugo', amount: 2800, category: 'SALAIRE' as const },
    { name: 'Salaire Emma', amount: 2600, category: 'SALAIRE' as const },
  ]
  for (const e of expensesData) {
    await prisma.expense.create({ data: { ...e, createdById: demoUser.id } })
  }
  console.log('  9 expenses created')

  // ── 8. Maintenance Contracts ────────────────────────────────────────────────
  const maintenanceData = [
    { clientName: 'Boulangerie Marchand', url: 'boulangerie-marchand.fr', cms: 'WordPress', type: 'WEB' as const, priceHT: 49, billing: 'MENSUEL' as const },
    { clientName: 'Durand Architecture', url: 'durand-architecture.fr', cms: 'Framer', type: 'WEB' as const, priceHT: 99, billing: 'MENSUEL' as const },
    { clientName: 'Yoga Zen Studio', url: 'yoga-zen-studio.fr', cms: 'WordPress', type: 'WEB' as const, priceHT: 79, billing: 'MENSUEL' as const },
    { clientName: 'Cabinet Dubois', url: 'dubois-avocats.fr', cms: 'Framer', type: 'GOOGLE' as const, priceHT: 99, billing: 'TRIMESTRIEL' as const },
  ]
  for (const m of maintenanceData) {
    await prisma.maintenanceContract.create({
      data: { ...m, startDate: new Date(2025, 6, 1), active: true, createdById: demoUser.id },
    })
  }
  console.log('  4 maintenance contracts created')

  // ── 9. Resources (wiki) ─────────────────────────────────────────────────────
  const resourcesData = [
    { title: 'Process de création de site WordPress', content: '## Étapes\n\n1. Brief client\n2. Maquette Figma\n3. Développement\n4. Tests\n5. Livraison\n\n### Détails\n\nChaque projet suit ce workflow standard...', category: 'PROCESS' as const, tags: ['wordpress', 'process'] },
    { title: 'Checklist SEO On-Page', content: '## Checklist SEO\n\n- [ ] Meta title (30-60 car.)\n- [ ] Meta description (120-160 car.)\n- [ ] H1 unique\n- [ ] Hiérarchie Hn\n- [ ] Images alt\n- [ ] Sitemap XML\n- [ ] Robots.txt', category: 'SEO' as const, tags: ['seo', 'checklist'] },
    { title: 'Guide onboarding client', content: '## Accueil nouveau client\n\n1. Envoyer le questionnaire\n2. Planifier le kick-off\n3. Créer le projet sur l\'outil\n4. Assigner l\'équipe\n5. Lancer la rédaction', category: 'GUIDE' as const, tags: ['client', 'onboarding'] },
  ]
  for (const r of resourcesData) {
    await prisma.resource.create({ data: { ...r, createdById: demoUser.id } })
  }
  console.log('  3 resources created')

  // ── 10. Contracts ───────────────────────────────────────────────────────────
  const contractsData = [
    { clientName: 'Boulangerie Marchand', subject: 'Création site vitrine', type: 'PRESTATION', priceHT: 2500, contactName: 'Sophie Marchand', contactEmail: 'sophie@boulangerie-marchand.fr' },
    { clientName: 'Durand Architecture', subject: 'Refonte site + SEO', type: 'PRESTATION', priceHT: 3800, contactName: 'Thomas Durand', contactEmail: 'thomas@durand-archi.fr' },
    { clientName: 'Lambert Immobilier', subject: 'Plateforme web sur mesure', type: 'PRESTATION', priceHT: 8500, contactName: 'Pierre Lambert', contactEmail: 'pierre@lambert-immo.fr' },
  ]
  for (const c of contractsData) {
    await prisma.contract.create({
      data: { ...c, startDate: new Date(2025, 8, 1), active: true, createdById: demoUser.id },
    })
  }
  console.log('  3 contracts created')

  // ── 11. Article templates ───────────────────────────────────────────────────
  const articlesData = [
    { name: 'Site vitrine WordPress', unitPrice: 2500, unit: 'forfait', category: 'Création' },
    { name: 'Landing page Framer', unitPrice: 1299, unit: 'forfait', category: 'Création' },
    { name: 'E-commerce WooCommerce', unitPrice: 4200, unit: 'forfait', category: 'Création' },
    { name: 'Maintenance mensuelle classique', unitPrice: 49, unit: 'mois', category: 'Maintenance' },
    { name: 'Maintenance SEO', unitPrice: 99, unit: 'mois', category: 'Maintenance' },
    { name: 'Rédaction page web', unitPrice: 120, unit: 'page', category: 'Contenu' },
    { name: 'Design UX/UI', unitPrice: 450, unit: 'jour', category: 'Design' },
    { name: 'Développement sur mesure', unitPrice: 450, unit: 'jour', category: 'Développement' },
  ]
  for (const a of articlesData) {
    await prisma.articleTemplate.create({ data: { ...a, createdById: demoUser.id } })
  }
  console.log('  8 article templates created')

  console.log('\nDemo seed complete!')
  console.log('Login: demo@agence-kameo.fr / demo2025')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
