/**
 * HTML email templates for Kameo Tool
 */

interface SignatureEmailParams {
  signerFirstName: string
  signerLastName: string
  quoteNumber: string
  subject: string
  signingUrl: string
  expiresAt: string // formatted date string
}

export function buildSignatureEmailHtml(params: SignatureEmailParams): string {
  const { signerFirstName, signerLastName, quoteNumber, subject, signingUrl, expiresAt } = params

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Devis ${quoteNumber} — Signature</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Gradient Header -->
          <tr>
            <td style="height:5px;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);"></td>
          </tr>

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:32px 40px 20px 40px;">
              <img src="https://kameo-tool.vercel.app/kameo-logo-light.svg" alt="Agence Kameo" height="32" style="height:32px;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <h1 style="font-size:22px;color:#1a1a2e;margin:0 0 20px 0;font-weight:600;">Devis à signer</h1>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
                Bonjour ${signerFirstName} ${signerLastName},
              </p>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 16px 0;">
                Veuillez trouver le devis <strong style="color:#1a1a2e;">N° ${quoteNumber}</strong> concernant :
              </p>

              <div style="background-color:#f8f9fa;border-left:4px solid #E14B89;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 24px 0;">
                <p style="font-size:15px;color:#1a1a2e;margin:0;font-weight:600;">${subject}</p>
              </div>

              <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 28px 0;">
                Vous pouvez consulter et signer ce devis en cliquant sur le bouton ci-dessous.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${signingUrl}" target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,#E14B89 0%,#F8903C 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      Consulter et signer le devis
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:13px;color:#888;line-height:1.5;margin:28px 0 0 0;text-align:center;">
                Ce lien est valable jusqu'au <strong>${expiresAt}</strong>.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #eee;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px;text-align:center;">
              <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
                Agence Kameo — 9 rue des colonnes, Paris 75002<br>
                contact@agencekameo.fr — 06 76 23 00 37<br>
                SIRET : 980 573 984 00013
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildSignatureEmailText(params: SignatureEmailParams): string {
  const { signerFirstName, signerLastName, quoteNumber, subject, signingUrl, expiresAt } = params

  return `Bonjour ${signerFirstName} ${signerLastName},

Veuillez trouver le devis N° ${quoteNumber} concernant : ${subject}

Vous pouvez consulter et signer ce devis en suivant ce lien :
${signingUrl}

Ce lien est valable jusqu'au ${expiresAt}.

---
Agence Kameo — 9 rue des colonnes, Paris 75002
contact@agencekameo.fr — 06 76 23 00 37
SIRET : 980 573 984 00013`
}
