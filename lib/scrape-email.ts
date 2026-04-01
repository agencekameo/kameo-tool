const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
}

const JUNK_DOMAINS = ['example.', 'wixpress', 'sentry', 'wordpress.org', 'gravatar', 'schema.org', 'cloudflare',
  'google', 'facebook', 'w3.org', 'apache.org', 'microsoft', 'jquery', 'bootstrap', 'github', 'npm',
  'protection', 'sentry.io', 'gstatic', 'googleapis', 'fontawesome', 'cdnjs', 'polyfill', 'recaptcha']

async function fetchAndExtractEmails(pageUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    if (!res.ok) return []
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return []
    const html = await res.text()

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
    const allFound = new Set<string>()

    // 1. Raw HTML
    for (const m of html.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())

    // 2. mailto: links
    const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi
    for (const m of html.matchAll(mailtoRegex)) allFound.add(m[1].toLowerCase())

    // 3. HTML entities
    const decoded = html.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    for (const m of decoded.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())

    // 4. Obfuscation patterns
    const deobfuscated = html
      .replace(/\s*\[at\]\s*/gi, '@').replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(at\)\s*/gi, '@').replace(/\s*\(dot\)\s*/gi, '.')
      .replace(/\s*\{at\}\s*/gi, '@').replace(/\s*\{dot\}\s*/gi, '.')
      .replace(/\s*&#64;\s*/g, '@').replace(/\s*%40\s*/g, '@')
    for (const m of deobfuscated.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())

    // 5. JSON-LD structured data
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    for (const m of html.matchAll(jsonLdRegex)) {
      try {
        const data = JSON.parse(m[1])
        const extractFromObj = (obj: Record<string, unknown>) => {
          if (typeof obj !== 'object' || !obj) return
          for (const v of Object.values(obj)) {
            if (typeof v === 'string' && v.match(emailRegex)) {
              for (const em of v.matchAll(emailRegex)) allFound.add(em[0].toLowerCase())
            } else if (typeof v === 'object') extractFromObj(v as Record<string, unknown>)
          }
        }
        extractFromObj(Array.isArray(data) ? { items: data } : data)
      } catch { /* */ }
    }

    // 6. Meta tags
    const metaRegex = /<meta[^>]+content=["']([^"']*@[^"']*?)["'][^>]*>/gi
    for (const m of html.matchAll(metaRegex)) {
      for (const em of m[1].matchAll(emailRegex)) allFound.add(em[0].toLowerCase())
    }

    // 7. Data attributes
    const dataAttrRegex = /(?:data-[a-z-]+|aria-label|title|alt|value)=["']([^"']*@[^"']*?)["']/gi
    for (const m of html.matchAll(dataAttrRegex)) {
      for (const em of m[1].matchAll(emailRegex)) allFound.add(em[0].toLowerCase())
    }

    // 8. Strip all tags and re-extract
    const stripped = html.replace(/<[^>]+>/g, '')
    for (const m of stripped.matchAll(emailRegex)) allFound.add(m[0].toLowerCase())

    // 9. URL-encoded mailto
    const encodedMailto = /mailto:([^"'\s&]+)/gi
    for (const m of html.matchAll(encodedMailto)) {
      try {
        const dec = decodeURIComponent(m[1]).split('?')[0]
        if (dec.match(emailRegex)) allFound.add(dec.toLowerCase())
      } catch { /* */ }
    }

    return [...allFound].filter(e =>
      !JUNK_DOMAINS.some(j => e.includes(j)) &&
      !e.includes('.png') && !e.includes('.jpg') && !e.includes('.svg') && !e.endsWith('.webp') &&
      !e.includes('.css') && !e.includes('.js') && !e.includes('.woff') &&
      !e.startsWith('test@') && !e.startsWith('user@') && !e.startsWith('placeholder') &&
      !e.startsWith('your') && !e.startsWith('email@') && !e.startsWith('name@') &&
      !e.startsWith('info@example') && !e.startsWith('admin@example') &&
      !e.startsWith('noreply@') && !e.startsWith('no-reply@') &&
      !e.startsWith('mailer@') && !e.startsWith('postmaster@') &&
      !e.endsWith('@sentry.io') && !e.endsWith('@wix.com') &&
      e.length < 60 && e.length > 5 &&
      /\.[a-z]{2,}$/.test(e)
    )
  } catch {
    return []
  }
}

export async function scrapeEmail(url: string): Promise<string | null> {
  try {
    let baseUrl = url
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1)
    let origin: string
    try { origin = new URL(baseUrl).origin } catch { return null }

    const allEmails: string[] = []
    const addEmails = (emails: string[]) => {
      for (const e of emails) if (!allEmails.includes(e)) allEmails.push(e)
    }

    // Step 1: Homepage
    if (baseUrl.startsWith('http://')) {
      const httpsUrl = baseUrl.replace('http://', 'https://')
      addEmails(await fetchAndExtractEmails(httpsUrl))
      if (allEmails.length === 0) addEmails(await fetchAndExtractEmails(baseUrl))
      else origin = origin.replace('http://', 'https://')
    } else {
      addEmails(await fetchAndExtractEmails(baseUrl))
    }

    // Step 2: Contact pages
    if (allEmails.length === 0) {
      const contactPaths = [
        '/contact', '/nous-contacter', '/contactez-nous', '/contact-us',
        '/contact/', '/nous-contacter/', '/contactez-nous/', '/contact.html',
        '/contact.php', '/fr/contact', '/fr/nous-contacter',
      ]
      const results = await Promise.all(contactPaths.map(p => fetchAndExtractEmails(origin + p)))
      for (const r of results) addEmails(r)
    }

    // Step 3: About/legal pages
    if (allEmails.length === 0) {
      const morePaths = [
        '/a-propos', '/about', '/about-us', '/qui-sommes-nous',
        '/mentions-legales', '/mentions-legales/', '/legal', '/cgv',
        '/equipe', '/team', '/agence', '/societe', '/entreprise', '/infos',
        '/footer', '/plan-du-site', '/politique-de-confidentialite',
        '/fr/a-propos', '/fr/mentions-legales',
      ]
      const results = await Promise.all(morePaths.slice(0, 8).map(p => fetchAndExtractEmails(origin + p)))
      for (const r of results) addEmails(r)
      if (allEmails.length === 0) {
        const results2 = await Promise.all(morePaths.slice(8).map(p => fetchAndExtractEmails(origin + p)))
        for (const r of results2) addEmails(r)
      }
    }

    // Step 4: Dynamic discovery
    if (allEmails.length === 0) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        const res = await fetch(origin, { signal: controller.signal, headers: BROWSER_HEADERS, redirect: 'follow' })
        clearTimeout(timeout)
        const html = await res.text()

        const linkRegex = /href=["']([^"']*(?:contact|contac|nous-contacter|equipe|team|about|a-propos)[^"']*?)["']/gi
        const foundLinks = new Set<string>()
        for (const m of html.matchAll(linkRegex)) {
          let linkUrl = m[1]
          if (linkUrl.startsWith('mailto:') || linkUrl.startsWith('tel:') || linkUrl.startsWith('#')) continue
          if (linkUrl.startsWith('/')) linkUrl = origin + linkUrl
          else if (!linkUrl.startsWith('http')) linkUrl = origin + '/' + linkUrl
          foundLinks.add(linkUrl)
        }

        if (foundLinks.size > 0) {
          const results = await Promise.all([...foundLinks].slice(0, 5).map(u => fetchAndExtractEmails(u)))
          for (const r of results) addEmails(r)
        }

        const mailtoLinks = /href=["']mailto:([^"'?]+)/gi
        for (const m of html.matchAll(mailtoLinks)) {
          const email = m[1].toLowerCase().trim()
          if (email.includes('@') && !allEmails.includes(email)) allEmails.push(email)
        }
      } catch { /* */ }
    }

    if (allEmails.length === 0) return null

    // Prioritize business emails
    const preferred = allEmails.find(e => /^(contact|info|hello|bonjour|accueil|agence|cabinet|direction|commercial|bienvenue)@/i.test(e))
    if (preferred) return preferred

    // Same-domain emails
    try {
      const hostname = new URL(origin).hostname.replace('www.', '')
      const domainBase = hostname.split('.')[0]
      const sameDomain = allEmails.find(e => e.includes('@') && e.split('@')[1].includes(domainBase))
      if (sameDomain) return sameDomain
    } catch { /* */ }

    return allEmails[0]
  } catch {
    return null
  }
}
