type WAInput = { to?: string; body: string }

export default async function sendWhatsApp({ to, body }: WAInput) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const recipient = to || process.env.WHATSAPP_TEST_TO

  // Mode mock si pas de creds
  if (!token || !phoneId || !recipient) {
    console.log('[WA MOCK]', { to: recipient, body })
    return
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: { body },
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`WhatsApp error ${res.status}: ${txt}`)
  }
}
