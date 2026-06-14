module.exports = async function handler(req, res) {
  console.log('[generar-descripcion] request received:', req.method);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { images, contexto = {} } = req.body || {};
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

  const lineasContexto = [];
  if (contexto.categoria)     lineasContexto.push(`- Categoría: ${contexto.categoria}`);
  if (contexto.tallaEtiqueta) lineasContexto.push(`- Talla etiqueta: ${contexto.tallaEtiqueta}`);
  if (contexto.tallaReal)     lineasContexto.push(`- Talla real: ${contexto.tallaReal}`);
  if (contexto.precioMin)     lineasContexto.push(`- Precio mínimo de venta: $${contexto.precioMin}`);
  if (contexto.precioMax)     lineasContexto.push(`- Precio máximo de venta: $${contexto.precioMax}`);

  if (lineasContexto.length) {
    content.push({
      type: 'text',
      text: `CONTEXTO DE ESTA PRENDA (ya conocido — úsalo en los argumentos de venta):\n${lineasContexto.join('\n')}`,
    });
  }

  if (contexto.observaciones) {
    content.push({
      type: 'text',
      text: `Observaciones del vendedor sobre esta prenda: ${contexto.observaciones}. Tómalas en cuenta para generar una descripción más precisa y útil.`,
    });
  }

  content.push({
    type: 'text',
    text: `Eres una asesora de imagen y ventas especializada en moda femenina de calidad, ayudando a vendedoras mexicanas a presentar sus prendas con un discurso aspiracional, elegante y cercano.

Analiza las imágenes y devuelve ÚNICAMENTE un JSON válido sin markdown, sin explicaciones, sin texto adicional antes o después. El JSON debe tener exactamente estos campos:
{
  "nombre": "nombre comercial y atractivo de la prenda en español. Máximo 5 palabras en total, incluyendo la marca si la hay. Ejemplo correcto: 'Blazer Structured Negro Theory'. Ejemplo incorrecto: 'Elegante Blazer Structured de Corte Recto en Color Negro'. Debe sonar a boutique, no a mercado.",
  "marca": "marca si es legible en alguna imagen, o null si no se ve",
  "color": "color o colores principales de la prenda en términos elegantes (ej: vino, nude, azul marino, marfil)",
  "talla": "talla exacta tal como aparece en la etiqueta (ej: S, M, L, XL, XS, 38, 40, 28, 30) o null",
  "material": "material o materiales principales (ej: Algodón, Poliéster, Viscosa) o null",
  "composicion": "composición completa tal como aparece en la etiqueta (ej: 95% algodón, 5% elastano) o null",
  "cuidado": "instrucciones de cuidado de la etiqueta en texto conciso, o null",
  "por_que_vale": "2-3 oraciones que justifiquen el precio como una inversión inteligente. Si la marca lo justifica (Theory, Maje, Vero Moda, Zara, Hobbs, ONLY u otras reconocidas), incluye una comparación de precio real aproximado en tienda — por ejemplo: 'Una pieza similar de esta marca puede costar $X en tienda.' Si no tienes certeza del precio de referencia, omite la comparación en lugar de inventar un número. Si la etiqueta menciona lana, cachemira, seda u otros materiales premium, ese es el argumento central. Tono seguro y aspiracional — habla de inversión en estilo, no de precio costoso.",
  "cliente_ideal": "2-3 oraciones describiendo a la clienta ideal por su estilo de vida y personalidad, NO por su nivel socioeconómico. Ejemplos de tono correcto: 'Para una mujer práctica que no se complica', 'Para una mujer que disfruta la formalidad sin perder comodidad', 'Para una mujer activa que busca piezas versátiles'. Menciona el tipo de silueta favorecida por el corte usando términos como 'silueta estilizada', 'figura definida', 'talla curvy' o 'silueta amplia' según corresponda.",
  "como_presentarla": "guión de 2-4 oraciones para presentar la prenda y cerrar la venta. Qué destacar primero, cómo resaltar sus atributos visuales, y cómo invitar a probarla o apartarla. Si el CONTEXTO incluye tallas, menciona la silueta o tipo de cuerpo que favorece. Tono cálido pero profesional — como una asesora de imagen, no como una vendedora de tianguis."
}

VOCABULARIO PROHIBIDO — nunca usar estas palabras ni expresiones:
- "cara" para referirse al precio → usar siempre "costosa", "de inversión" o "con un precio que refleja su calidad"
- "grande", "talla grande" o "talla extra grande" → usar "curvy", "plus", "talla generosa" o "silueta amplia"
- Expresiones coloquiales: "chava", "plática de amigas", "te late", "está padrísima", "no manches" o similares
- Lenguaje de regateo o disculpa por el precio
- Términos de clase social: "clase media", "clase alta", "nivel socioeconómico" o cualquier clasificación similar — describe siempre por estilo de vida o personalidad
- Palabras que sugieran el origen de la prenda: "saldo", "saldos", "liquidación", "outlet", "segunda mano", "usado", "pre-owned" — la clienta final no debe saber el origen, preséntala como una prenda de marca en excelente estado

REGLAS DE TONO:
- Aspiracional y cercano: la clienta ideal aspira a verse y sentirse bien
- Accesible pero sofisticado: cálido y cercano, sin perder clase
- Nunca menciones que la prenda es de segunda mano, usada o que tuvo dueño anterior
- Cada campo debe ser accionable — la vendedora lo lee y lo usa de inmediato
- Si recibiste CONTEXTO al inicio, úsalo activamente en por_que_vale y como_presentarla`,
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
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
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
