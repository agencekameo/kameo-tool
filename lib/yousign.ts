const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY || ''
const YOUSIGN_BASE_URL = process.env.YOUSIGN_BASE_URL || 'https://api.yousign.app/v3'

function headers(contentType = 'application/json') {
  return {
    Authorization: `Bearer ${YOUSIGN_API_KEY}`,
    'Content-Type': contentType,
  }
}

export async function createSignatureRequest(name: string) {
  const res = await fetch(`${YOUSIGN_BASE_URL}/signature_requests`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name,
      delivery_mode: 'email',
      timezone: 'Europe/Paris',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yousign createSignatureRequest failed: ${res.status} ${err}`)
  }
  return res.json()
}

export async function uploadDocument(signatureRequestId: string, pdfBuffer: Buffer, fileName: string) {
  const formData = new FormData()
  const uint8 = new Uint8Array(pdfBuffer)
  formData.append('file', new Blob([uint8], { type: 'application/pdf' }), fileName)
  formData.append('nature', 'signable_document')

  const res = await fetch(`${YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${YOUSIGN_API_KEY}`,
    },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yousign uploadDocument failed: ${res.status} ${err}`)
  }
  return res.json()
}

export async function addSigner(
  signatureRequestId: string,
  documentId: string,
  signer: { firstName: string; lastName: string; email: string; phone?: string },
  signaturePage: number,
) {
  const res = await fetch(`${YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/signers`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      info: {
        first_name: signer.firstName,
        last_name: signer.lastName,
        email: signer.email,
        ...(signer.phone ? { phone_number: signer.phone } : {}),
        locale: 'fr',
      },
      signature_level: 'electronic_signature',
      signature_authentication_mode: 'no_otp',
      fields: [
        {
          document_id: documentId,
          type: 'signature',
          page: signaturePage,
          x: 410,
          y: 650,
          width: 180,
          height: 78,
        },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yousign addSigner failed: ${res.status} ${err}`)
  }
  return res.json()
}

export async function activateSignatureRequest(signatureRequestId: string) {
  const res = await fetch(`${YOUSIGN_BASE_URL}/signature_requests/${signatureRequestId}/activate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${YOUSIGN_API_KEY}`,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yousign activate failed: ${res.status} ${err}`)
  }
  return res.json()
}
