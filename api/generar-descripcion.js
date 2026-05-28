module.exports = async function handler(req, res) {
  console.log('[generar-descripcion] request received:', req.method);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { images, contexto } = req.body || {};
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

  if (contexto && Object.values(contexto).some(Boolean)) {
    const lineas = [];
    if (contexto.categoria)     lineas.push(`- Categoría: ${contexto.categoria}`);
    if (contexto.tallaEtiqueta) lineas.push(`- Talla etiqueta: ${contexto.tallaEtiqueta}`);
    if (contexto.tallaReal)     lineas.push(`- Talla real: ${contexto.tallaReal}`);
    if (contexto.precioMin)     lineas.push(`- Precio mínimo de venta: $${contexto.precioMin}`);
    if (contexto.precioMax)     lineas.push(`- Precio máximo de venta: $${contexto.precioMax}`);
    content.push({
      type: 'text',
      text: `CONTEXTO DE ESTA PRENDA (ya conocido — úsalo en los argumentos de venta):\n${lineas.join('\n')}`,
    });
  }

  content.push({
    type: 'text',
    text: `Eres una mentora de ventas experta en moda femenina, ayudando a vendedoras mexicanas a justificar el precio de sus prendas con confianza.

Analiza las imágenes y devuelve ÚNICAMENTE un JSON válido sin markdown, sin explicaciones, sin texto adicional antes o después. El JSON debe tener exactamente estos campos:
{
  "nombre": "nombre comercial y atractivo de la prenda en español, máx 60 caracteres",
  "marca": "marca si es legible en alguna imagen, o null si no se ve",
  "color": "color o colores principales de la prenda",
  "talla": "talla exacta tal como aparece en la etiqueta (ej: S, M, L, XL, XS, 38, 40, 28, 30) o null",
  "material": "material o materiales principales (ej: Algodón, Poliéster, Viscosa) o null",
  "composicion": "composición completa tal como aparece en la etiqueta (ej: 95% algodón, 5% elastano) o null",
  "cuidado": "instrucciones de cuidado de la etiqueta en texto conciso, o null",
  "por_que_vale": "2-3 oraciones que justifiquen el precio con argumentos reales: si es marca internacional como Theory, Maje, Hobbs o Marc Bouwer, menciona que en Liverpool o El Palacio de Hierro estas marcas se venden a precio completo mucho mayor; si es Vero Moda u ONLY, destaca que esta pieza es fabricación para el mercado asiático o europeo con diseños exclusivos que nunca llegan a México; si la etiqueta menciona lana, cachemira, seda u otros materiales premium, ese es el argumento central. Tono directo y seguro, como si le dijeras a una amiga por qué vale la pena.",
  "cliente_ideal": "2-3 oraciones describiendo a quién le queda perfecto: tipo de cuerpo favorecido por el corte, estilo de vida, ocasiones que frecuenta. Habla de ella de forma concreta: 'Es perfecta para la chava que...' o 'Tu clienta que trabaja en oficina y...'",
  "como_presentarla": "guión corto de 2-4 oraciones para presentar la prenda y cerrar la venta: qué destacar primero, cómo resaltar lo que más llama la atención, y cómo invitar a probársela o apartarla. Si el CONTEXTO incluye tallas, menciona para qué tipo de cuerpo o talla real queda bien. Tono natural, como plática de amigas.",
  "manejo_objecion": "respuesta lista para cuando la clienta diga 'está muy caro'. 2-3 oraciones que reencuadren el valor sin rebajar el precio ni ponerse a la defensiva: si el CONTEXTO incluye precio máximo, úsalo como referencia ('por solo $X llevas...'); compara con el precio en tienda departamental si aplica, o argumenta el costo por uso si es una prenda versátil y duradera."
}

REGLAS IMPORTANTES:
- Nunca menciones que la prenda es de segunda mano, usada o que tuvo dueño anterior
- Usa español mexicano natural, no neutro ni formal
- Cada campo debe ser accionable — la vendedora lo debe poder leer y usarlo de inmediato
- Si recibiste CONTEXTO al inicio, úsalo activamente en por_que_vale, como_presentarla y manejo_objecion`,
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
