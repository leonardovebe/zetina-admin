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
  const mesDe     = s => (s || '').toString().slice(0, 7);

  const [
    vendedoras, prendas, ventas, abonos, pedidos, detalles,
    devoluciones, gastos, clientes, invVis, prestamos, stats, interacciones,
  ] = await Promise.all([
    sb('vendedoras?select=id,nombre,credito,slug'),
    sb('prendas?select=id,numero,nombre,marca,categoria,precio_costo,precio_vendedora,precio_min,precio_max,disponible,baja,fecha_adquisicion,fecha_baja,motivo_baja'),
    sb('ventas?select=id,vendedora_id,cliente_id,prenda_id,monto,fecha,estado,nombre_prenda,marca'),
    sb('abonos?select=id,vendedora_id,cliente_id,monto,fecha'),
    sb('pedidos?select=id,vendedora_id,estado,created_at,credito_aplicado'),
    sb('detalle_pedidos?select=id,pedido_id,prenda_id,precio'),
    sb('devoluciones?select=id,vendedora_id,prenda_id,estado,motivo,created_at,prendas(precio_vendedora,nombre)'),
    sb('gastos?select=id,categoria,subcategoria,monto,fecha'),
    sb('clientes?select=id,vendedora_id,nombre,talla_ropa,talla_pantalon'),
    sb('inventario_vendedoras?select=id,vendedora_id,prenda_id,estado,fecha_entrega'),
    sb('prestamos?select=id,vendedora_id,prenda_id,clienta_id,estado,fecha_devolucion'),
    sb('visionaria_stats?select=vendedora_id,puntos_historicos,puntos_temporada,matches_historicos,matches_temporada'),
    sb('interacciones_clienta?select=id,vendedora_id,clienta_id,prenda_id,resultado,fecha'),
  ]);

  const nombreVis  = Object.fromEntries(vendedoras.map(v => [v.id, v.nombre || 'Sin nombre']));
  const statsPorVis = Object.fromEntries(stats.map(s => [s.vendedora_id, s]));

  // ── INGRESOS ZETINA (detalle_pedidos de pedidos Pagado/Entregado) ──
  const pedidoPorId = Object.fromEntries(pedidos.map(p => [p.id, p]));
  const detCon   = detalles.map(d => ({ ...d, pedido: pedidoPorId[d.pedido_id] }));
  const esPagado = ped => ped && (ped.estado === 'Pagado' || ped.estado === 'Entregado');
  const enCurso  = ped => ped && (ped.estado === 'En proceso' || ped.estado === 'En camino');
  const ingresosHistoricos = detCon.filter(d => esPagado(d.pedido)).reduce((s, d) => s + (+d.precio || 0), 0);
  const ingresosMes        = detCon.filter(d => esPagado(d.pedido) && mesDe(d.pedido.created_at) === mesActual).reduce((s, d) => s + (+d.precio || 0), 0);
  const porCobrar          = detCon.filter(d => enCurso(d.pedido)).reduce((s, d) => s + (+d.precio || 0), 0);

  // ── VENTAS a clientas ──
  const ventasHist = ventas.reduce((s, v) => s + (+v.monto || 0), 0);
  const ventasMes  = ventas.filter(v => mesDe(v.fecha) === mesActual).reduce((s, v) => s + (+v.monto || 0), 0);

  // ── GASTOS ──
  const gastosMesArr = gastos.filter(g => mesDe(g.fecha) === mesActual);
  const gastosMes    = gastosMesArr.reduce((s, g) => s + (+g.monto || 0), 0);
  const gastosHist   = gastos.reduce((s, g) => s + (+g.monto || 0), 0);
  const gastosPorCat = {};
  gastosMesArr.forEach(g => { const c = g.categoria || 'Sin categoría'; gastosPorCat[c] = (gastosPorCat[c] || 0) + (+g.monto || 0); });

  // ── INVENTARIO ──
  const disponibles = prendas.filter(p => p.disponible && !p.baja);
  const vendidas    = prendas.filter(p => !p.disponible && !p.baja);
  const bajas       = prendas.filter(p => p.baja);
  const bajasPorMotivo = {};
  bajas.forEach(p => { const m = p.motivo_baja || 'Sin motivo'; bajasPorMotivo[m] = (bajasPorMotivo[m] || 0) + 1; });
  const invPorEstado = {};
  invVis.forEach(i => { const e = i.estado || 'Sin estado'; invPorEstado[e] = (invPorEstado[e] || 0) + 1; });
  const enVisionarias = invVis.filter(i => !/(devuelt|vendid)/i.test(i.estado || '')).length;
  const oldest = disponibles
    .filter(p => p.fecha_adquisicion)
    .sort((a, b) => new Date(a.fecha_adquisicion) - new Date(b.fecha_adquisicion))
    .slice(0, 12);

  // ── DEVOLUCIONES ──
  const devPorEstado = {};
  const devPorVis    = {};
  const devPorMes    = {};
  const devCountPorVisId = {};
  devoluciones.forEach(d => {
    const e = d.estado || 'Sin estado';        devPorEstado[e] = (devPorEstado[e] || 0) + 1;
    const n = nombreVis[d.vendedora_id] || 'Sin asignar'; devPorVis[n] = (devPorVis[n] || 0) + 1;
    const m = mesDe(d.created_at) || 'Sin fecha'; devPorMes[m] = (devPorMes[m] || 0) + 1;
    devCountPorVisId[d.vendedora_id] = (devCountPorVisId[d.vendedora_id] || 0) + 1;
  });

  // ── VISIONARIAS (ventas del mes, puntos, devoluciones, crédito) ──
  const ventasMesPorVis = {};
  ventas.filter(v => mesDe(v.fecha) === mesActual).forEach(v => { ventasMesPorVis[v.vendedora_id] = (ventasMesPorVis[v.vendedora_id] || 0) + (+v.monto || 0); });
  const visionarias = vendedoras.map(v => ({
    nombre: v.nombre || 'Sin nombre',
    ventasMes: ventasMesPorVis[v.id] || 0,
    puntos: statsPorVis[v.id]?.puntos_historicos ?? 0,
    devoluciones: devCountPorVisId[v.id] || 0,
    credito: +v.credito || 0,
  })).sort((a, b) => b.ventasMes - a.ventasMes);

  // ── CLIENTES (total y con saldo pendiente) ──
  const cargoPorCliente = {};
  ventas.forEach(v => { if (v.cliente_id != null) cargoPorCliente[v.cliente_id] = (cargoPorCliente[v.cliente_id] || 0) + (+v.monto || 0); });
  const abonoPorCliente = {};
  abonos.forEach(a => { if (a.cliente_id != null) abonoPorCliente[a.cliente_id] = (abonoPorCliente[a.cliente_id] || 0) + (+a.monto || 0); });
  const clientesConSaldo   = clientes.filter(c => ((cargoPorCliente[c.id] || 0) - (abonoPorCliente[c.id] || 0)) > 0).length;
  const saldoTotalClientes = clientes.reduce((s, c) => s + Math.max(0, (cargoPorCliente[c.id] || 0) - (abonoPorCliente[c.id] || 0)), 0);

  // ── PRÉSTAMOS ──
  const prestamosActivos = prestamos.filter(p => !/(devuelt|finaliz|cerrad)/i.test(p.estado || '') && !p.fecha_devolucion);
  const prestPorEstado = {};
  prestamos.forEach(p => { const e = p.estado || 'Sin estado'; prestPorEstado[e] = (prestPorEstado[e] || 0) + 1; });

  // ── OTROS ──
  const creditosEmitidos = vendedoras.reduce((s, v) => s + (+v.credito || 0), 0);
  const intPorResultado = {};
  interacciones.forEach(i => { const r = i.resultado || 'Sin resultado'; intPorResultado[r] = (intPorResultado[r] || 0) + 1; });

  // ── Construir texto ──
  const L = [];
  L.push(`FECHA ACTUAL: ${MESES[now.getMonth()]} ${now.getFullYear()}`);
  L.push('');
  L.push('=== RESUMEN DEL NEGOCIO ===');
  L.push(`- Ventas a clientas (mes): ${MXN(ventasMes)}`);
  L.push(`- Ventas a clientas (histórico): ${MXN(ventasHist)}`);
  L.push(`- Ingresos ZETINA / pagado por Visionarias (mes): ${MXN(ingresosMes)}`);
  L.push(`- Ingresos ZETINA (histórico): ${MXN(ingresosHistoricos)}`);
  L.push(`- Por cobrar a Visionarias (pedidos en proceso/en camino): ${MXN(porCobrar)}`);
  L.push(`- Gastos (mes): ${MXN(gastosMes)}`);
  L.push(`- Ganancia neta del mes (ingresos − gastos): ${MXN(ingresosMes - gastosMes)}`);
  L.push('');
  L.push('=== INVENTARIO ===');
  L.push(`- Disponibles en catálogo: ${disponibles.length}`);
  L.push(`- En visionarias (entregadas/en poder): ${enVisionarias}`);
  L.push(`- Vendidas: ${vendidas.length}`);
  L.push(`- Bajas: ${bajas.length}`);
  if (Object.keys(bajasPorMotivo).length) {
    Object.entries(bajasPorMotivo).sort((a, b) => b[1] - a[1]).forEach(([m, n]) => L.push(`  · baja "${m}": ${n}`));
  }
  if (Object.keys(invPorEstado).length) {
    L.push('- Inventario en visionarias por estado:');
    Object.entries(invPorEstado).sort((a, b) => b[1] - a[1]).forEach(([e, n]) => L.push(`  · ${e}: ${n}`));
  }
  L.push('- Prendas más antiguas sin venderse (por fecha de adquisición):');
  if (oldest.length) {
    oldest.forEach(p => {
      const dias = Math.max(0, Math.round((now - new Date(p.fecha_adquisicion)) / 86400000));
      L.push(`  · ${p.numero || 's/n'} ${p.nombre || ''}${p.categoria ? ' (' + p.categoria + ')' : ''} — ${dias} días en inventario`);
    });
  } else L.push('  (sin prendas disponibles con fecha)');
  L.push('');
  L.push('=== VISIONARIAS (ordenadas por ventas del mes) ===');
  if (visionarias.length) {
    visionarias.slice(0, 15).forEach((v, i) => L.push(`  ${i + 1}. ${v.nombre} — ventas mes: ${MXN(v.ventasMes)} · puntos: ${v.puntos} · devoluciones: ${v.devoluciones} · crédito: ${MXN(v.credito)}`));
  } else L.push('  (sin visionarias registradas)');
  L.push('');
  L.push('=== DEVOLUCIONES ===');
  L.push(`- Total: ${devoluciones.length}`);
  if (Object.keys(devPorEstado).length) {
    L.push('- Por estado:');
    Object.entries(devPorEstado).sort((a, b) => b[1] - a[1]).forEach(([e, n]) => L.push(`  · ${e}: ${n}`));
  }
  if (Object.keys(devPorVis).length) {
    L.push('- Por visionaria:');
    Object.entries(devPorVis).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([n, c]) => L.push(`  · ${n}: ${c}`));
  }
  if (Object.keys(devPorMes).length) {
    L.push('- Por mes:');
    Object.entries(devPorMes).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6).forEach(([m, c]) => L.push(`  · ${m}: ${c}`));
  }
  L.push('');
  L.push('=== CLIENTES ===');
  L.push(`- Total de clientes: ${clientes.length}`);
  L.push(`- Con saldo pendiente: ${clientesConSaldo}`);
  L.push(`- Saldo pendiente total (ventas − abonos): ${MXN(saldoTotalClientes)}`);
  L.push('');
  L.push('=== GASTOS ===');
  L.push(`- Gastos del mes: ${MXN(gastosMes)}`);
  L.push(`- Gastos históricos: ${MXN(gastosHist)}`);
  if (Object.keys(gastosPorCat).length) {
    L.push('- Del mes por categoría:');
    Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]).forEach(([c, m]) => L.push(`  · ${c}: ${MXN(m)}`));
  }
  L.push('');
  L.push('=== PRÉSTAMOS ACTIVOS ===');
  L.push(`- Préstamos activos (sin devolver): ${prestamosActivos.length}`);
  if (Object.keys(prestPorEstado).length) {
    L.push('- Todos por estado:');
    Object.entries(prestPorEstado).sort((a, b) => b[1] - a[1]).forEach(([e, n]) => L.push(`  · ${e}: ${n}`));
  }
  L.push('');
  L.push('=== CRÉDITO E INTERACCIONES ===');
  L.push(`- Créditos emitidos a Visionarias (saldo a favor por devoluciones): ${MXN(creditosEmitidos)}`);
  if (Object.keys(intPorResultado).length) {
    L.push('- Interacciones con clientas por resultado:');
    Object.entries(intPorResultado).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => L.push(`  · ${r}: ${n}`));
  }

  return L.join('\n');
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
