module.exports = async function handler(req, res) {
  console.log('[generar-descripcion] request received:', req.method);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { images } = req.body || {};
  if (!Array.isArray(images) || !images.length) {
    return res.status(400).json({ error: 'Se requiere al menos una imagen' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no está configurada en las variables de entorno de Vercel' });
  }

  const content = [];

  const etiquetas = images.filter(i => i.type === 'etiqueta');
  const prendas   = images.filter(i => i.type === 'prenda');

  if (etiquetas.length) {
    content.push({ type: 'text', text: 'Estas son las fotos de las ETIQUETAS de la prenda (úsalas para leer talla, composición, material e instrucciones de cuidado):' });
    for (const img of etiquetas) {
      content.push({ type: 'image', source: { type: 'url', url: img.url } });
    }
  }

  if (prendas.length) {
    content.push({ type: 'text', text: `${etiquetas.length ? '\n' : ''}Estas son las fotos de la PRENDA (úsalas para describir estilo, color, corte y dar tips de combinación):` });
    for (const img of prendas) {
      content.push({ type: 'image', source: { type: 'url', url: img.url } });
    }
  }

  content.push({
    type: 'text',
    text: `Eres experta en moda femenina latinoamericana. Analiza las imágenes y devuelve ÚNICAMENTE un JSON válido sin markdown, sin explicaciones, sin texto adicional antes o después. El JSON debe tener exactamente estos campos:
{
  "nombre": "nombre comercial y atractivo de la prenda en español, máx 60 caracteres",
  "marca": "marca si es legible en alguna imagen, o null si no se ve",
  "color": "color o colores principales de la prenda",
  "talla": "talla exacta tal como aparece en la etiqueta (ej: S, M, L, XL, XS, 38, 40, 28, 30) o null",
  "material": "material o materiales principales (ej: Algodón, Poliéster, Viscosa) o null",
  "composicion": "composición completa tal como aparece en la etiqueta (ej: 95% algodón, 5% elastano) o null",
  "cuidado": "instrucciones de cuidado de la etiqueta en texto conciso, o null",
  "descripcion_general": "descripción comercial y atractiva de 2-3 oraciones que resalte el estilo, silueta, corte y para qué ocasiones se recomienda",
  "como_usar": "3-4 ideas concretas de cómo usar y combinar la prenda, separadas por punto y coma"
}`,
  });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      return res.status(anthropicRes.status).json({
        error: errBody.error?.message || `Error de la API de Anthropic (${anthropicRes.status})`,
      });
    }

    const apiData = await anthropicRes.json();
    const rawText = (apiData.content?.[0]?.text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: 'La IA devolvió una respuesta inesperada' });
      parsed = JSON.parse(match[0]);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
};
