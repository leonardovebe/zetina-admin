export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) {
    console.error('[notify-new-prenda] ONESIGNAL_REST_API_KEY no configurada');
    return res.status(500).json({ error: 'ONESIGNAL_REST_API_KEY no configurada en Vercel' });
  }

  const payload = {
    app_id: 'a2f3738d-e19b-4555-8eaa-02986bd16437',
    included_segments: ['All'],
    headings:  { es: '¡Nueva prenda en ZETINA! ✨', en: '¡Nueva prenda en ZETINA! ✨' },
    contents:  { es: '🌟 Nueva prenda en el catálogo — ¡entra a verla antes que nadie!', en: '🌟 Nueva prenda en el catálogo — ¡entra a verla antes que nadie!' },
  };

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[notify-new-prenda] OneSignal error:', data);
    return res.status(response.status).json(data);
  }
  return res.status(200).json({ success: true, id: data.id });
}
