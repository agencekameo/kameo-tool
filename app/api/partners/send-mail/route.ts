import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  validateEmails,
  getQuotaForToday,
  incrementQuota,
  getRandomDelay,
  SEND_CONFIG,
} from '@/lib/email-safety'

const GMAIL_ACCOUNTS: Record<string, { user: string | undefined; pass: string | undefined; name: string; email: string }> = {
  benjamin: { user: process.env.GMAIL_BENJAMIN_USER, pass: process.env.GMAIL_BENJAMIN_PASSWORD, name: 'Benjamin Dayan — Agence Kameo', email: 'contact@agence-kameo.fr' },
  kameo: { user: process.env.GMAIL_KAMEO_USER, pass: process.env.GMAIL_KAMEO_PASSWORD, name: 'Agence Kameo', email: 'contact@agence-kameo.fr' },
  louison: { user: process.env.GMAIL_LOUISON_USER, pass: process.env.GMAIL_LOUISON_PASSWORD, name: 'Louison — Agence Kameo', email: 'louison@agence-kameo.fr' },
}

function getTransporter(senderId: string = 'benjamin') {
  const account = GMAIL_ACCOUNTS[senderId] || GMAIL_ACCOUNTS.benjamin
  return {
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user: account.user, pass: account.pass },
    }),
    from: `"${account.name}" <${account.email}>`,
    replyTo: account.email,
  }
}

function partnerEmailHtml(companyName: string, type: 'initial' | 'relance1' | 'relance2', trackingId?: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://kameo-tool.vercel.app'
  const pixelUrl = trackingId ? `${baseUrl}/api/partners/track?tid=${trackingId}` : ''
  const unsubUrl = trackingId ? `${baseUrl}/api/partners/unsubscribe?tid=${trackingId}` : ''

  const subjects: Record<string, string> = {
    initial: 'Proposition de partenariat',
    relance1: 'Suite à notre proposition de partenariat',
    relance2: 'Dernière relance | Partenariat Agence Kameo',
  }

  const intros: Record<string, string> = {
    initial: `<strong style="color:#1a1a2e;">Chaque mois, des clients vous sollicitent pour des projets web que vous ne pouvez pas traiter, et ce chiffre d'affaires vous échappe.</strong><br><br>Je me permets de vous contacter car je sais que <strong>${companyName}</strong> reçoit ce type de demandes régulièrement : création de site internet, refonte, application web… Des projets que vous n'avez pas le temps ou les ressources de gérer en interne.<br><br>Résultat : <strong>le client part ailleurs, et vous perdez une opportunité de revenus</strong>.`,
    relance1: `Je reviens vers vous suite à mon précédent message. J'imagine que votre planning est chargé, c'est justement pour ça que notre partenariat ne vous demande aucun temps.`,
    relance2: `Dernier message de ma part. Si le timing n'est pas le bon, gardez simplement mes coordonnées. On pourra en reparler quand vous le souhaiterez.`,
  }

  return {
    subject: subjects[type],
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td></tr>
<tr><td align="center" style="padding:32px 40px 24px;"><img src="${baseUrl}/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" /></td></tr>
<tr><td style="padding:0 40px 40px;">

<p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">${intros[type]}</p>

<p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px;">Nous sommes <strong style="color:#1a1a2e;">Agence Kameo</strong>, spécialisée dans la <strong style="color:#1a1a2e;">création de sites internet haut de gamme et de web apps personnalisées</strong>. On s'occupe de tout : devis, réalisation, livraison. Votre client est entre de bonnes mains.</p>

<div style="background:#f8f9fa;border-radius:10px;padding:24px;margin:0 0 28px;">
<h2 style="font-size:16px;color:#1a1a2e;margin:0 0 16px;">Ce que ça change pour vous :</h2>
<ul style="font-size:14px;color:#444;line-height:2;margin:0;padding:0 0 0 20px;">
<li><strong>Vous ne perdez plus de clients</strong> : au lieu de refuser la demande, vous nous la transmettez</li>
<li><strong>Vous gagnez de l'argent sans rien faire</strong> : <span style="background:linear-gradient(135deg,#E14B89,#F8903C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;">20% de commission</span> sur chaque mission (sites à partir de 2 000€)</li>
<li><strong>Commission payée sous 48h</strong> après le paiement du client, par virement</li>
<li><strong>Zéro effort, zéro temps</strong> : un simple message suffit pour nous transmettre un contact</li>
<li><strong>Votre client reste votre client</strong> : on travaille en marque blanche si vous le souhaitez</li>
<li><strong>Concrètement</strong> : un seul client transmis peut vous rapporter <span style="background:linear-gradient(135deg,#E14B89,#F8903C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;">entre 400€ et 2 000€ de commission</span></li>
</ul>
</div>

<p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 28px;">Ça prend 30 secondes pour en discuter :</p>

<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding-bottom:14px;">
<a href="https://calendly.com/contact-agence-kameo/visioconference-clone" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">Prendre rendez-vous</a>
</td></tr>
<tr><td align="center">
<a href="https://wa.me/33662379985" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 30px;border-radius:10px;font-size:14px;font-weight:600;">&#9742; Discuter sur WhatsApp</a>
</td></tr>
</table>

<p style="font-size:14px;color:#888;margin:28px 0 0;line-height:1.6;">N'hésitez pas à me contacter directement si vous avez la moindre question.</p>

<!-- Signature -->
<table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #eee;padding-top:24px;">
<tr>
<td style="padding-right:24px;vertical-align:top;width:64px;">
<img src="${baseUrl}/benjamin-dayan.png" alt="Benjamin Dayan" width="56" height="56" style="border-radius:50%;display:block;width:56px;height:56px;" />
<div style="height:16px;"></div>
<img src="${baseUrl}/kameo-logo-light.png" alt="Kameo" width="40" style="border-radius:8px;display:block;width:40px;margin:0 auto;" />
</td>
<td style="vertical-align:top;padding-left:8px;">
<p style="margin:0;font-size:14px;font-weight:600;color:#1a1a2e;">Benjamin Dayan</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">Directeur commercial</p>
<p style="margin:3px 0 0;font-size:12px;color:#888;">Agence Kameo</p>

<p style="margin:14px 0 0;font-size:12px;">
<a href="tel:+33662379985" style="color:#666;text-decoration:none;">06 62 37 99 85</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="mailto:contact@agence-kameo.fr" style="color:#666;text-decoration:none;">contact@agence-kameo.fr</a>
</p>
<p style="margin:3px 0 0;font-size:12px;">
<a href="https://www.agence-kameo.fr" target="_blank" style="color:#E14B89;text-decoration:none;font-weight:500;">www.agence-kameo.fr</a>
</p>
</td>
</tr>
</table>

</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
<tr><td style="padding:24px 40px 32px;text-align:center;">
<p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">Agence Kameo | 9 rue des colonnes, Paris 75002<br>contact@agence-kameo.fr | 06 62 37 99 85</p>
${unsubUrl ? `<p style="font-size:11px;color:#ccc;margin:8px 0 0;"><a href="${unsubUrl}" style="color:#ccc;text-decoration:underline;">Se désinscrire</a></p>` : ''}
</td></tr>
</table>
</td></tr></table>
${pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ''}
</body></html>`,
  }
}

// ── SSE helper ──
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { partnerIds, type = 'initial', senderId = 'benjamin', customSubject } = await req.json()

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return NextResponse.json({ error: 'Aucun partenaire sélectionné' }, { status: 400 })
  }

  // ── Check daily quota ──
  const quota = await getQuotaForToday()
  if (quota.remaining === 0) {
    return NextResponse.json({
      error: `Quota journalier atteint (${quota.maxToday} mails). Réessayez demain.`,
      quota,
    }, { status: 429 })
  }

  // ── Fetch partners ──
  const partners = await prisma.partner.findMany({
    where: { id: { in: partnerIds }, email: { not: null } },
  })

  if (partners.length === 0) {
    return NextResponse.json({ error: 'Aucun partenaire avec email trouvé' }, { status: 400 })
  }

  // Cap to remaining quota
  const maxToSend = Math.min(partners.length, quota.remaining)
  const partnersToSend = partners.slice(0, maxToSend)

  // ── SSE streaming response ──
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(sseEvent(data))) } catch { /* stream closed */ }
      }

      const { transporter, from, replyTo } = getTransporter(senderId)

      let sent = 0
      let failed = 0
      let bounced = 0
      let skippedInvalid = 0
      let stopped = false

      // ── Step 1: Validate emails ──
      send({ step: 'validation', message: 'Vérification des emails...', progress: 0 })

      const emailList = partnersToSend
        .filter(p => p.email)
        .map(p => ({ id: p.id, email: p.email! }))

      const { valid, invalid } = await validateEmails(emailList)
      skippedInvalid = invalid.length

      if (invalid.length > 0) {
        send({
          step: 'validation',
          message: `${invalid.length} email(s) invalide(s) retiré(s)`,
          progress: 5,
          invalidEmails: invalid.map(e => ({ email: e.email, reason: e.reason })),
        })
      }

      if (valid.length === 0) {
        send({ step: 'done', message: 'Aucun email valide à envoyer', sent: 0, failed: 0, skippedInvalid, total: 0 })
        controller.close()
        return
      }

      // ── Step 2: Split into batches ──
      const batches: typeof valid[] = []
      for (let i = 0; i < valid.length; i += SEND_CONFIG.BATCH_SIZE) {
        batches.push(valid.slice(i, i + SEND_CONFIG.BATCH_SIZE))
      }

      send({
        step: 'start',
        message: `Envoi de ${valid.length} mail(s) en ${batches.length} vague(s)`,
        progress: 5,
        totalValid: valid.length,
        totalBatches: batches.length,
        skippedInvalid,
      })

      // ── Step 3: Send in batches ──
      for (let batchIdx = 0; batchIdx < batches.length && !stopped; batchIdx++) {
        const batch = batches[batchIdx]

        if (batchIdx > 0) {
          // Wait between batches
          const batchWait = SEND_CONFIG.DELAY_BETWEEN_BATCHES
          const batchWaitMin = Math.round(batchWait / 60_000)
          send({
            step: 'batch_pause',
            message: `Pause de ${batchWaitMin}min avant la vague ${batchIdx + 1}/${batches.length}...`,
            progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
            nextBatch: batchIdx + 1,
            waitMinutes: batchWaitMin,
          })
          await new Promise(r => setTimeout(r, batchWait))
        }

        send({
          step: 'batch_start',
          message: `Vague ${batchIdx + 1}/${batches.length} — ${batch.length} mail(s)`,
          progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
          batch: batchIdx + 1,
          batchSize: batch.length,
        })

        for (let i = 0; i < batch.length && !stopped; i++) {
          const item = batch[i]
          const partner = partnersToSend.find(p => p.id === item.id)!
          const trackingId = partner.trackingId || `tk_${partner.id}_${Date.now()}`
          const { subject: defaultSubject, html } = partnerEmailHtml(partner.name, type as 'initial' | 'relance1' | 'relance2', trackingId)
          const subject = customSubject || defaultSubject

          try {
            await transporter.sendMail({
              from,
              replyTo,
              to: item.email,
              subject,
              html,
            })

            // Update partner status
            const updateData: Record<string, unknown> = { trackingId }
            if (type === 'initial') {
              updateData.status = 'MAIL_ENVOYE'
              updateData.mailSentAt = new Date()
            } else if (type === 'relance1') {
              updateData.status = 'RELANCE_1'
              updateData.relance1At = new Date()
            } else if (type === 'relance2') {
              updateData.status = 'RELANCE_2'
              updateData.relance2At = new Date()
            }

            await prisma.partner.update({ where: { id: partner.id }, data: updateData })
            await incrementQuota('default', 'sent')
            sent++

            send({
              step: 'sent',
              message: `✓ ${partner.name} (${item.email})`,
              progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
              sent,
              failed,
              current: sent + failed,
              total: valid.length,
            })
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error'
            const isBounce = errMsg.includes('550') || errMsg.includes('551') || errMsg.includes('552') ||
                             errMsg.includes('553') || errMsg.includes('554') || errMsg.includes('Invalid') ||
                             errMsg.includes('not exist') || errMsg.includes('unknown user')

            if (isBounce) {
              bounced++
              await incrementQuota('default', 'bounce')
            } else {
              await incrementQuota('default', 'fail')
            }
            failed++

            send({
              step: 'error',
              message: `✗ ${partner.name} (${item.email}) — ${isBounce ? 'Bounce' : 'Erreur'}`,
              progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
              sent,
              failed,
              bounced,
              isBounce,
              current: sent + failed,
              total: valid.length,
            })

            // ── Auto-stop: bounce rate too high ──
            const totalProcessed = sent + failed
            if (totalProcessed >= 3 && bounced / totalProcessed > SEND_CONFIG.MAX_BOUNCE_RATE) {
              stopped = true
              send({
                step: 'auto_stop',
                message: `⚠ ARRÊT AUTO : taux de bounce trop élevé (${bounced}/${totalProcessed} = ${Math.round(bounced / totalProcessed * 100)}%). Envoi stoppé pour protéger le domaine.`,
                progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
                sent,
                failed,
                bounced,
                reason: 'bounce_rate',
              })
              break
            }

            console.error(`[MAIL] Failed to send to ${item.email}:`, err)
          }

          // ── Random delay between emails (30-90s) ──
          if (i < batch.length - 1 && !stopped) {
            const delay = getRandomDelay()
            send({
              step: 'waiting',
              message: `Attente ${Math.round(delay / 1000)}s...`,
              progress: Math.round(((sent + failed) / valid.length) * 90 + 5),
              delaySec: Math.round(delay / 1000),
            })
            await new Promise(r => setTimeout(r, delay))
          }
        }
      }

      // ── Done ──
      send({
        step: 'done',
        message: stopped
          ? `Envoi interrompu : ${sent} envoyé(s), ${failed} échec(s), ${skippedInvalid} invalide(s)`
          : `Terminé : ${sent} envoyé(s), ${failed} échec(s), ${skippedInvalid} invalide(s)`,
        progress: 100,
        sent,
        failed,
        bounced,
        skippedInvalid,
        total: valid.length,
        stopped,
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
