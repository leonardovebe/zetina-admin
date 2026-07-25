// Asistente IA financiero de ZETINA.
// Recibe { messages: [...], contexto: {} }, consulta KPIs frescos de Supabase
// y responde con Claude usando esos datos en el system prompt.

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://pxngdrkysnizzplmrdxg.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4bmdkcmt5c25penpwbG1yZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDEyMDIsImV4cCI6MjA5NTAxNzIwMn0.7MsAt9Vrw_ZIsWfnPnOAzkOkxCKJfmAd5jLlNETU93I';

async function sb(path) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.error('[chat-financiero] supabase error', path, res.status);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error('[chat-financiero] supabase fetch failed', path, err.message);
    return [];
  }
}

const MXN = n => '$' + Math.round(+n || 0).toLocaleString('es-MX');
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function construirContexto() {
  const now       = new Date();
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mesNum    = now.getMonth() + 1;
  const anioNum   = now.getFullYear();

  const [detalles, gastos, ventas, vendedoras, prendasDisp, devoluciones] = await Promise.all([
    sb('detalle_pedidos?select=precio,pedidos(estado,fecha,created_at,vendedora_id)'),
    sb('gastos?select=monto,mes,anio,categoria'),
    sb('ventas?select=monto,vendedora_id,fecha'),
    sb('vendedoras?select=id,nombre,credito'),
    sb('prendas?select=nombre,numero,fecha_adquisicion&disponible=eq.true&baja=eq.false&order=fecha_adquisicion.asc&limit=15'),
    sb('devoluciones?select=estado'),
  ]);

  // ── Ingresos (detalle_pedidos de pedidos Pagado/Entregado) ──
  const pagados = detalles.filter(d => d.pedidos?.estado === 'Pagado' || d.pedidos?.estado === 'Entregado');
  const _mesPed = d => (d.pedidos?.fecha || d.pedidos?.created_at || '').slice(0, 7);
  const ingresosHistoricos = pagados.reduce((s, d) => s + (+d.precio || 0), 0);
  const ingresosMes        = pagados.filter(d => _mesPed(d) === mesActual).reduce((s, d) => s + (+d.precio || 0), 0);
  const porCobrar          = detalles
    .filter(d => d.pedidos?.estado === 'En proceso' || d.pedidos?.estado === 'En camino')
    .reduce((s, d) => s + (+d.precio || 0), 0);

  // ── Gastos del mes (total y por categoría) ──
  const gastosMesArr   = gastos.filter(g => g.mes === mesNum && g.anio === anioNum);
  const gastosMes      = gastosMesArr.reduce((s, g) => s + (+g.monto || 0), 0);
  const gastosPorCat   = {};
  gastosMesArr.forEach(g => { const c = g.categoria || 'Sin categoría'; gastosPorCat[c] = (gastosPorCat[c] || 0) + (+g.monto || 0); });

  // ── Top Visionarias por ingresos (de ventas) ──
  const nombreVis = Object.fromEntries(vendedoras.map(v => [v.id, v.nombre]));
  const ventasPorVis = {};
  ventas.forEach(v => { const n = nombreVis[v.vendedora_id] || 'Sin asignar'; ventasPorVis[n] = (ventasPorVis[n] || 0) + (+v.monto || 0); });
  const topVis = Object.entries(ventasPorVis).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // ── Otros KPIs ──
  const creditosEmitidos = vendedoras.reduce((s, v) => s + (+v.credito || 0), 0);
  const devAprobadas     = devoluciones.filter(d => d.estado === 'Aprobada').length;

  const lineas = [];
  lineas.push(`FECHA ACTUAL: ${MESES[now.getMonth()]} ${anioNum}`);
  lineas.push('');
  lineas.push('INGRESOS ZETINA (precio pagado por las Visionarias):');
  lineas.push(`- Ingresos del mes: ${MXN(ingresosMes)}`);
  lineas.push(`- Ingresos históricos: ${MXN(ingresosHistoricos)}`);
  lineas.push(`- Por cobrar (pedidos en proceso/en camino): ${MXN(porCobrar)}`);
  lineas.push('');
  lineas.push('GASTOS:');
  lineas.push(`- Gastos del mes: ${MXN(gastosMes)}`);
  if (Object.keys(gastosPorCat).length) {
    Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]).forEach(([c, m]) => lineas.push(`  · ${c}: ${MXN(m)}`));
  }
  lineas.push(`- Ganancia neta del mes (ingresos − gastos): ${MXN(ingresosMes - gastosMes)}`);
  lineas.push('');
  lineas.push('TOP VISIONARIAS POR VENTAS (a sus clientas):');
  if (topVis.length) topVis.forEach(([n, m], i) => lineas.push(`  ${i + 1}. ${n}: ${MXN(m)}`));
  else lineas.push('  (sin ventas registradas)');
  lineas.push('');
  lineas.push('INVENTARIO:');
  lineas.push(`- Prendas disponibles en catálogo: ${prendasDisp.length}${prendasDisp.length === 15 ? '+ (mostrando las 15 más antiguas)' : ''}`);
  lineas.push('- Prendas más antiguas sin venderse (fecha de adquisición):');
  if (prendasDisp.length) {
    prendasDisp.forEach(p => {
      const dias = p.fecha_adquisicion ? Math.max(0, Math.round((now - new Date(p.fecha_adquisicion)) / 86400000)) : null;
      lineas.push(`  · ${p.numero || 's/n'} ${p.nombre || ''} — ${dias != null ? dias + ' días en inventario' : 'sin fecha'}`);
    });
  } else lineas.push('  (sin prendas disponibles)');
  lineas.push('');
  lineas.push('OTROS:');
  lineas.push(`- Créditos emitidos a Visionarias (saldo a favor por devoluciones): ${MXN(creditosEmitidos)}`);
  lineas.push(`- Devoluciones aprobadas (histórico): ${devAprobadas}`);

  return lineas.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no está configurada en las variables de entorno de Vercel' });
  }

  const { messages } = req.body || {};

  // Si no hay historial, arrancamos pidiendo el mensaje de bienvenida con resumen.
  let convo = Array.isArray(messages) ? messages.filter(m => m && m.role && m.content) : [];
  if (!convo.length) {
    convo = [{ role: 'user', content: 'Dame la bienvenida en 1-2 líneas y luego un resumen breve del estado actual del negocio con los números clave del mes (ingresos, gastos, ganancia neta y quién vende más). Termina invitándome a preguntarte lo que necesite.' }];
  }

  let datosContexto = '';
  try {
    datosContexto = await construirContexto();
  } catch (err) {
    console.error('[chat-financiero] error construyendo contexto:', err.message);
    datosContexto = '(No se pudieron cargar los datos del negocio en este momento.)';
  }

  const systemPrompt = `Eres el asistente financiero y estratégico de ZETINA, una marca de moda selecta mexicana con red de Visionarias (vendedoras independientes). Tienes acceso a los datos reales del negocio que se incluyen a continuación. Responde en español, sé directo y usa números reales. Puedes analizar tendencias, identificar oportunidades, alertar sobre problemas y hacer recomendaciones concretas. Cuando no tengas datos suficientes para responder algo, dilo claramente.

=== DATOS REALES DEL NEGOCIO (actualizados en tiempo real) ===
${datosContexto}
=== FIN DE LOS DATOS ===`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: convo.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      return res.status(anthropicRes.status).json({
        error: errBody.error?.message || `Error de la API de Anthropic (${anthropicRes.status})`,
      });
    }

    const apiData = await anthropicRes.json();
    const reply = (apiData.content?.[0]?.text || '').trim();
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
};
