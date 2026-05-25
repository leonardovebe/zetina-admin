'use strict';

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIAS     = ['Blusa','Pantalón','Vestido','Falda','Chamarra','Conjunto','Sudadera','Short','Zapatos','Bolsa','Accesorio','Otro'];
const NIVELES        = ['Básico','Silver','Gold','Platinum'];
const ESTADOS_PEDIDO = ['En proceso','Pagado','En camino','Entregado'];

// ── Utilidades ────────────────────────────────────────────────────────────────
function formatPeso(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00'))
    .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatZtId(uuid) {
  return 'ZT-' + uuid.slice(0, 8).toUpperCase();
}

let _toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(html, wide = false) {
  document.getElementById('modalBody').innerHTML = html;
  document.querySelector('.modal-box').classList.toggle('modal-box--lg', wide);
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── Navegación ────────────────────────────────────────────────────────────────
const SECTION_TITLES = {
  financiero: 'Resumen Financiero',
  prendas:    'Subir Prendas',
  inventario: 'Inventario',
  pedidos:    'Pedidos',
  vendedoras: 'Vendedoras',
  clientes:   'Clientas'
};

function navigate(section) {
  if (!SECTION_TITLES[section]) section = 'financiero';

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.section === section)
  );
  document.getElementById('sectionTitle').textContent = SECTION_TITLES[section];
  location.hash = section;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  const renders = { financiero: renderFinanciero, prendas: renderPrendas,
    inventario: renderInventario, pedidos: renderPedidos,
    vendedoras: renderVendedoras, clientes: renderClientes };
  if (renders[section]) renders[section]();
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: SUBIR PRENDAS
// ══════════════════════════════════════════════════════════════════════════════
let selectedFotos = [];

async function renderPrendas() {
  const main = document.getElementById('sectionContent');
  const { data: vendedoras } = await db.from('vendedoras').select('id, nombre').order('nombre');

  main.innerHTML = `
    <div class="upload-form-container">
      <form id="prendaForm" class="prenda-form">

        <div class="form-section">
          <div class="form-section-title">Fotos</div>
          <div class="photo-upload-area" id="photoArea">
            <input type="file" id="fotosInput" accept="image/*" multiple hidden>
            <div class="photo-upload-placeholder" id="photoPlaceholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <p>Arrastra fotos aquí o <span>selecciona archivos</span></p>
              <p class="text-muted">JPG, PNG, WEBP — Máx 5 MB por foto</p>
            </div>
            <div class="photo-previews" id="photoPreviews"></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Información</div>
          <div class="form-grid">
            <div class="form-group">
              <label>ID *</label>
              <input type="text" id="fId" required placeholder="Ej: ZT-001">
            </div>
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" id="fNombre" required placeholder="Ej: Blusa Floral Rosa">
            </div>
            <div class="form-group">
              <label>Marca</label>
              <input type="text" id="fMarca" placeholder="Ej: Shein, Zara…">
            </div>
            <div class="form-group">
              <label>Categoría</label>
              <select id="fCategoria">
                <option value="">Sin categoría</option>
                ${CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Asignar a vendedora</label>
              <select id="fVendedora">
                <option value="">Catálogo general</option>
                ${(vendedoras || []).map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Tallas</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>Talla etiqueta</label>
              <input type="text" id="fTallaEtiqueta" placeholder="Ej: L, XL, 38">
            </div>
            <div class="form-group">
              <label>Talla real</label>
              <input type="text" id="fTallaReal" placeholder="Ej: M, L">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Precios</div>
          <div class="form-grid form-grid-3">
            <div class="form-group">
              <label>Costo *</label>
              <div class="input-prefix"><span>$</span>
                <input type="number" id="fCosto" required min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="form-group">
              <label>Precio mínimo</label>
              <div class="input-prefix"><span>$</span>
                <input type="number" id="fPrecioMin" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
            <div class="form-group">
              <label>Precio máximo</label>
              <div class="input-prefix"><span>$</span>
                <input type="number" id="fPrecioMax" min="0" step="0.01" placeholder="0.00">
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="submitPrendaBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Guardar prenda
          </button>
        </div>
      </form>
    </div>`;

  selectedFotos = [];
  bindPhotoUpload();
  document.getElementById('prendaForm').addEventListener('submit', handlePrendaSubmit);
}

function bindPhotoUpload() {
  const area   = document.getElementById('photoArea');
  const input  = document.getElementById('fotosInput');

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    addFotos(e.dataTransfer.files);
  });
  input.addEventListener('change', () => addFotos(input.files));
}

function addFotos(files) {
  const valid = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
  if (valid.length < files.length) showToast('Algunas fotos superan 5 MB y fueron ignoradas.', 'info');
  selectedFotos = [...selectedFotos, ...valid];
  renderFotoPreviews();
}

function renderFotoPreviews() {
  const container   = document.getElementById('photoPreviews');
  const placeholder = document.getElementById('photoPlaceholder');
  if (selectedFotos.length === 0) {
    placeholder.style.display = '';
    container.innerHTML = '';
    return;
  }
  placeholder.style.display = 'none';
  container.innerHTML = selectedFotos.map((f, i) => `
    <div class="photo-preview-item">
      <img src="${URL.createObjectURL(f)}" alt="${f.name}">
      <button type="button" class="photo-remove-btn" data-i="${i}">×</button>
    </div>`).join('');
  container.querySelectorAll('.photo-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      selectedFotos.splice(+btn.dataset.i, 1);
      renderFotoPreviews();
    });
  });
}

async function uploadFoto(file, prendaId) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `prendas/${prendaId}/${Date.now()}.${ext}`;
  const { data, error } = await db.storage.from('prenda-fotos').upload(path, file, { contentType: file.type });
  if (error) {
    console.error('[uploadFoto] Error completo de Supabase:', error);
    console.error('[uploadFoto] Archivo:', file.name, '| Tamaño:', file.size, 'bytes | Tipo:', file.type);
    console.error('[uploadFoto] Path destino:', path);
    throw error;
  }
  const { data: u } = db.storage.from('prenda-fotos').getPublicUrl(data.path);
  return u.publicUrl;
}

async function handlePrendaSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitPrendaBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const prendaData = {
      numero:         document.getElementById('fId').value.trim(),
      nombre:         document.getElementById('fNombre').value.trim(),
      marca:          document.getElementById('fMarca').value.trim()        || null,
      categoria:      document.getElementById('fCategoria').value           || null,
      vendedora_id:   document.getElementById('fVendedora').value           || null,
      talla_etiqueta: document.getElementById('fTallaEtiqueta').value.trim()|| null,
      talla_real:     document.getElementById('fTallaReal').value.trim()    || null,
      precio_costo:   parseFloat(document.getElementById('fCosto').value)   || 0,
      precio_min:     parseFloat(document.getElementById('fPrecioMin').value)|| 0,
      precio_max:     parseFloat(document.getElementById('fPrecioMax').value)|| 0,
      disponible:     true,
      baja:           false
    };

    const { data: prenda, error } = await db.from('prendas').insert(prendaData).select().single();
    if (error) throw error;

    let uploadErrors = 0;
    const fotoErrorMsgs = [];
    for (const foto of selectedFotos) {
      try {
        const url = await uploadFoto(foto, prenda.id);
        await db.from('fotos_prendas').insert({ prenda_id: prenda.id, url });
      } catch (fotoErr) {
        uploadErrors++;
        fotoErrorMsgs.push(`${foto.name}: ${fotoErr.message || JSON.stringify(fotoErr)}`);
      }
    }

    selectedFotos = [];
    e.target.reset();
    renderFotoPreviews();

    if (uploadErrors > 0) {
      const errDetail = fotoErrorMsgs.join('\n');
      console.error('[Subir Prendas] Errores al subir fotos:\n' + errDetail);
      showToast(`Prenda guardada. ${uploadErrors} foto(s) no se subieron — revisa la consola (F12) para ver el error exacto.`, 'error');
      // Show inline error below the form
      const errEl = document.createElement('div');
      errEl.className = 'upload-foto-error';
      errEl.innerHTML = `<strong>Error al subir ${uploadErrors} foto(s):</strong><pre>${errDetail}</pre>`;
      document.getElementById('prendaForm').appendChild(errEl);
    } else {
      showToast(`Prenda "${prenda.nombre}" guardada exitosamente.`);
    }

  } catch (err) {
    showToast(err.message || 'Error al guardar la prenda', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M12 5v14M5 12l7 7 7-7"/></svg> Guardar prenda`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: INVENTARIO
// ══════════════════════════════════════════════════════════════════════════════
let _invFilter = 'todas';
let _editFotosExistentes = []; // [{id, url, deleted}]
let _editFotosNuevas     = []; // File[]
let _invSearch = '';
let _invDebounce;

async function renderInventario() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `
    <div class="section-toolbar">
      <div class="filter-tabs" id="invTabs">
        ${['todas','disponible','vendido','baja'].map(f => `
          <button class="filter-tab ${_invFilter === f ? 'active' : ''}" data-f="${f}">
            ${f.charAt(0).toUpperCase() + f.slice(1)}
          </button>`).join('')}
      </div>
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="invSearch" placeholder="Buscar nombre o marca…" value="${_invSearch}">
      </div>
    </div>
    <div id="invStats" class="stats-row"></div>
    <div id="invList"></div>`;

  document.querySelectorAll('#invTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _invFilter = tab.dataset.f;
      document.querySelectorAll('#invTabs .filter-tab').forEach(t => t.classList.toggle('active', t === tab));
      loadInventario();
    });
  });

  document.getElementById('invSearch').addEventListener('input', e => {
    _invSearch = e.target.value;
    clearTimeout(_invDebounce);
    _invDebounce = setTimeout(loadInventario, 280);
  });

  await loadInventario();
}

async function loadInventario() {
  const listEl = document.getElementById('invList');
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    let q = db.from('prendas')
      .select('id, nombre, marca, categoria, talla_etiqueta, talla_real, precio_costo, precio_min, precio_max, disponible, baja, emoji, vendedoras(nombre), fotos_prendas(url)')
      .order('created_at', { ascending: false });

    if (_invFilter === 'disponible') q = q.eq('disponible', true).eq('baja', false);
    else if (_invFilter === 'vendido')    q = q.eq('disponible', false).eq('baja', false);
    else if (_invFilter === 'baja')       q = q.eq('baja', true);

    if (_invSearch.trim()) {
      q = q.or(`nombre.ilike.%${_invSearch}%,marca.ilike.%${_invSearch}%`);
    }

    const { data: prendas, error } = await q;
    if (error) throw error;

    // Stats (full set for counters, not filtered)
    const statsEl = document.getElementById('invStats');
    if (statsEl) {
      const disp  = prendas.filter(p =>  p.disponible && !p.baja).length;
      const vend  = prendas.filter(p => !p.disponible && !p.baja).length;
      const baja  = prendas.filter(p =>  p.baja).length;
      statsEl.innerHTML = `
        <div class="stat-chip"><span class="stat-num">${prendas.length}</span><span class="stat-label">Total</span></div>
        <div class="stat-chip accent"><span class="stat-num">${disp}</span><span class="stat-label">Disponibles</span></div>
        <div class="stat-chip warning"><span class="stat-num">${vend}</span><span class="stat-label">Vendidas</span></div>
        <div class="stat-chip muted"><span class="stat-num">${baja}</span><span class="stat-label">Bajas</span></div>`;
    }

    if (!prendas.length) {
      listEl.innerHTML = '<div class="empty-state">No hay prendas en esta vista.</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Foto</th><th>ID</th><th>Nombre</th><th>Marca</th>
            <th>Categoría</th><th>Talla</th><th>Costo</th>
            <th>Min / Max</th><th>Vendedora</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${prendas.map(p => {
              const foto = p.fotos_prendas?.[0]?.url;
              return `<tr>
                <td>${foto
                  ? `<img src="${foto}" class="table-thumb" alt="">`
                  : `<div class="table-thumb-empty">${p.emoji || '👚'}</div>`}</td>
                <td><span class="id-badge">${formatZtId(p.id)}</span></td>
                <td class="td-name">${p.nombre}</td>
                <td>${p.marca || '—'}</td>
                <td>${p.categoria || '—'}</td>
                <td>${p.talla_etiqueta || '—'}</td>
                <td>${formatPeso(p.precio_costo)}</td>
                <td class="td-precios">${formatPeso(p.precio_min)} – ${formatPeso(p.precio_max)}</td>
                <td>${p.vendedoras?.nombre || '<span class="text-muted">Catálogo</span>'}</td>
                <td>${estadoBadge(p)}</td>
                <td class="td-actions">
                  <button class="btn-sm btn-outline" onclick="abrirEditarPrenda('${p.id}')">Editar</button>
                  ${!p.baja
                    ? `<button class="btn-icon" title="${p.disponible ? 'Marcar vendida' : 'Marcar disponible'}"
                         onclick="toggleDisp('${p.id}',${p.disponible})">${p.disponible ? '✓' : '↩'}</button>
                       <button class="btn-icon btn-warn" title="Dar de baja" onclick="darBaja('${p.id}')">↓</button>`
                    : `<button class="btn-icon" title="Reactivar" onclick="reactivar('${p.id}')">↑</button>`}
                  <button class="btn-icon btn-danger" title="Eliminar"
                    onclick="deletePrenda('${p.id}','${escQ(p.nombre)}')">🗑</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

function estadoBadge(p) {
  if (p.baja)       return '<span class="badge badge-muted">Baja</span>';
  if (p.disponible) return '<span class="badge badge-success">Disponible</span>';
  return '<span class="badge badge-warning">Vendida</span>';
}

async function toggleDisp(id, current) {
  const { error } = await db.from('prendas').update({ disponible: !current }).eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast(current ? 'Marcada como vendida' : 'Marcada como disponible');
  loadInventario();
}

async function darBaja(id) {
  if (!confirm('¿Dar de baja esta prenda? Quedará inactiva en el inventario.')) return;
  const { error } = await db.from('prendas').update({ baja: true, disponible: false }).eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Prenda dada de baja');
  loadInventario();
}

async function reactivar(id) {
  const { error } = await db.from('prendas').update({ baja: false, disponible: true }).eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Prenda reactivada');
  loadInventario();
}

async function deletePrenda(id, nombre) {
  if (!confirm(`¿Eliminar permanentemente "${nombre}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await db.from('prendas').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Prenda eliminada');
  loadInventario();
}

async function abrirEditarPrenda(id) {
  const { data: vendedoras } = await db.from('vendedoras').select('id, nombre').order('nombre');

  // Try fetching with optional columns (numero, categoria); fall back if they don't exist yet
  let p, hasExtras = true;
  const fullSel = 'id, nombre, marca, categoria, numero, emoji, gradiente, talla_etiqueta, talla_real, precio_costo, precio_min, precio_max, disponible, baja, vendedora_id, fotos_prendas(id, url)';
  const safeSel = 'id, nombre, marca, emoji, gradiente, talla_etiqueta, talla_real, precio_costo, precio_min, precio_max, disponible, baja, vendedora_id, fotos_prendas(id, url)';

  let { data, error } = await db.from('prendas').select(fullSel).eq('id', id).single();
  if (error && error.message.includes('does not exist')) {
    hasExtras = false;
    const res = await db.from('prendas').select(safeSel).eq('id', id).single();
    if (res.error) { showToast(res.error.message, 'error'); return; }
    p = { ...res.data, numero: null, categoria: null };
  } else if (error) {
    showToast(error.message, 'error'); return;
  } else {
    p = data;
  }

  _editFotosExistentes = (p.fotos_prendas || []).map(f => ({ id: f.id, url: f.url, deleted: false }));
  _editFotosNuevas = [];

  const estadoVal = p.baja ? 'baja' : p.disponible ? 'disponible' : 'vendida';

  openModal(`
    <div class="modal-header">
      <h3>Editar prenda</h3>
      <p class="text-muted">${p.nombre}</p>
    </div>
    <form id="editPrendaForm" class="modal-form">

      <div class="edit-section">
        <div class="form-section-title">Fotos</div>
        <div id="editFotosGrid" class="edit-fotos-grid"></div>
        <label class="btn btn-outline btn-sm edit-add-foto-label">
          + Agregar fotos
          <input type="file" id="editFotosInput" accept="image/*" multiple hidden>
        </label>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Información</div>
        <div class="form-grid">
          ${hasExtras ? `<div class="form-group">
            <label>ID</label>
            <input type="text" id="eId" value="${p.numero || ''}" placeholder="Ej: ZT-001">
          </div>` : ''}
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" id="eNombre" required value="${p.nombre || ''}">
          </div>
          <div class="form-group">
            <label>Marca</label>
            <input type="text" id="eMarca" value="${p.marca || ''}">
          </div>
          ${hasExtras ? `<div class="form-group">
            <label>Categoría</label>
            <select id="eCategoria">
              <option value="">Sin categoría</option>
              ${CATEGORIAS.map(c => `<option value="${c}" ${p.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>` : ''}
          <div class="form-group">
            <label>Vendedora</label>
            <select id="eVendedora">
              <option value="">Catálogo general</option>
              ${(vendedoras || []).map(v => `<option value="${v.id}" ${p.vendedora_id === v.id ? 'selected' : ''}>${v.nombre}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Tallas</div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label>Talla etiqueta</label>
            <input type="text" id="eTallaEtiqueta" value="${p.talla_etiqueta || ''}">
          </div>
          <div class="form-group">
            <label>Talla real</label>
            <input type="text" id="eTallaReal" value="${p.talla_real || ''}">
          </div>
        </div>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Precios</div>
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label>Costo *</label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="eCosto" required min="0" step="0.01" value="${p.precio_costo || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Precio mínimo</label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="ePrecioMin" min="0" step="0.01" value="${p.precio_min || ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Precio máximo</label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="ePrecioMax" min="0" step="0.01" value="${p.precio_max || ''}">
            </div>
          </div>
        </div>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Estado</div>
        <div class="form-group" style="max-width:240px">
          <label>Estado de la prenda</label>
          <select id="eEstado">
            <option value="disponible" ${estadoVal === 'disponible' ? 'selected' : ''}>Disponible</option>
            <option value="vendida"    ${estadoVal === 'vendida'    ? 'selected' : ''}>Vendida</option>
            <option value="baja"       ${estadoVal === 'baja'       ? 'selected' : ''}>Baja</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="editSubmitBtn">Guardar cambios</button>
      </div>
    </form>`, true);

  _renderEditFotos();

  document.getElementById('editFotosInput').addEventListener('change', e => {
    const valid = Array.from(e.target.files).filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (valid.length < e.target.files.length) showToast('Algunas fotos superan 5 MB y fueron ignoradas.', 'info');
    _editFotosNuevas = [..._editFotosNuevas, ...valid];
    _renderEditFotos();
    e.target.value = '';
  });

  document.getElementById('editPrendaForm').addEventListener('submit', e => {
    e.preventDefault();
    guardarEditPrenda(id, hasExtras);
  });
}

function _renderEditFotos() {
  const grid = document.getElementById('editFotosGrid');
  if (!grid) return;

  const existHtml = _editFotosExistentes.map((f, i) => `
    <div class="edit-foto-item${f.deleted ? ' edit-foto-item--deleted' : ''}">
      <img src="${f.url}" alt="">
      <button type="button" class="edit-foto-del" data-i="${i}" data-type="exist" title="${f.deleted ? 'Deshacer' : 'Eliminar'}">
        ${f.deleted ? '↩' : '×'}
      </button>
      ${f.deleted ? '<div class="edit-foto-overlay">Eliminar</div>' : ''}
    </div>`).join('');

  const newHtml = _editFotosNuevas.map((f, i) => `
    <div class="edit-foto-item edit-foto-item--new">
      <img src="${URL.createObjectURL(f)}" alt="${f.name}">
      <button type="button" class="edit-foto-del" data-i="${i}" data-type="new" title="Quitar">×</button>
      <div class="edit-foto-badge">Nueva</div>
    </div>`).join('');

  grid.innerHTML = existHtml + newHtml ||
    '<p class="text-muted" style="font-size:0.8rem;margin:0">Sin fotos. Agrega con el botón de abajo.</p>';

  grid.querySelectorAll('.edit-foto-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      if (btn.dataset.type === 'exist') {
        _editFotosExistentes[i].deleted = !_editFotosExistentes[i].deleted;
      } else {
        _editFotosNuevas.splice(i, 1);
      }
      _renderEditFotos();
    });
  });
}

async function guardarEditPrenda(id, hasExtras) {
  const btn = document.getElementById('editSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const estadoVal = document.getElementById('eEstado').value;
    const payload = {
      nombre:         document.getElementById('eNombre').value.trim(),
      marca:          document.getElementById('eMarca').value.trim()         || null,
      vendedora_id:   document.getElementById('eVendedora').value            || null,
      talla_etiqueta: document.getElementById('eTallaEtiqueta').value.trim() || null,
      talla_real:     document.getElementById('eTallaReal').value.trim()     || null,
      precio_costo:   parseFloat(document.getElementById('eCosto').value)    || 0,
      precio_min:     parseFloat(document.getElementById('ePrecioMin').value) || 0,
      precio_max:     parseFloat(document.getElementById('ePrecioMax').value) || 0,
      disponible:     estadoVal === 'disponible',
      baja:           estadoVal === 'baja',
    };
    if (hasExtras) {
      payload.numero    = document.getElementById('eId').value.trim()    || null;
      payload.categoria = document.getElementById('eCategoria').value    || null;
    }

    const { error: updErr } = await db.from('prendas').update(payload).eq('id', id);
    if (updErr) throw updErr;

    // Delete fotos marked for removal
    const toDelete = _editFotosExistentes.filter(f => f.deleted).map(f => f.id);
    if (toDelete.length) {
      const { error: delErr } = await db.from('fotos_prendas').delete().in('id', toDelete);
      if (delErr) console.warn('Error al eliminar fotos:', delErr.message);
    }

    // Upload and register new fotos
    let uploadErrors = 0;
    const fotoErrorMsgs = [];
    for (const file of _editFotosNuevas) {
      try {
        const url = await uploadFoto(file, id);
        await db.from('fotos_prendas').insert({ prenda_id: id, url });
      } catch (fotoErr) {
        uploadErrors++;
        fotoErrorMsgs.push(`${file.name}: ${fotoErr.message || JSON.stringify(fotoErr)}`);
      }
    }

    closeModal();
    if (uploadErrors > 0) {
      const errDetail = fotoErrorMsgs.join(' | ');
      console.error('[Editar Prenda] Errores al subir fotos:\n' + fotoErrorMsgs.join('\n'));
      showToast(`Guardado. ${uploadErrors} foto(s) fallaron: ${errDetail}`, 'error');
    } else {
      showToast('Prenda actualizada correctamente.');
    }
    loadInventario();

  } catch (err) {
    showToast(err.message || 'Error al guardar cambios', 'error');
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: PEDIDOS
// ══════════════════════════════════════════════════════════════════════════════
let _pedidosEstado = '';
let _pedidosPrendaIds = {};

async function renderPedidos() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `
    <div class="section-toolbar">
      <div class="filter-tabs" id="pedidoTabs">
        ${[['', 'Todos'], ...ESTADOS_PEDIDO.map(e => [e, e])].map(([val, label]) => `
          <button class="filter-tab ${_pedidosEstado === val ? 'active' : ''}" data-e="${val}">${label}</button>`
        ).join('')}
      </div>
    </div>
    <div id="pedidosStats" class="stats-row"></div>
    <div id="pedidosList"></div>`;

  document.querySelectorAll('#pedidoTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _pedidosEstado = tab.dataset.e;
      document.querySelectorAll('#pedidoTabs .filter-tab').forEach(t => t.classList.toggle('active', t === tab));
      loadPedidos();
    });
  });

  await loadPedidos();
}

async function loadPedidos() {
  const listEl = document.getElementById('pedidosList');
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    let q = db.from('pedidos')
      .select('id, numero, fecha, estado, created_at, vendedoras(nombre), detalle_pedidos(prenda_id, precio, nombre, marca, emoji)')
      .order('created_at', { ascending: false });

    if (_pedidosEstado) q = q.eq('estado', _pedidosEstado);

    const { data: pedidos, error } = await q;
    if (error) throw error;

    _pedidosPrendaIds = {};
    pedidos.forEach(p => {
      _pedidosPrendaIds[p.id] = (p.detalle_pedidos || []).map(d => d.prenda_id).filter(Boolean);
    });
    console.log('[Zetina] _pedidosPrendaIds cargados:', _pedidosPrendaIds);

    const statsEl = document.getElementById('pedidosStats');
    if (statsEl) {
      const counts = Object.fromEntries(ESTADOS_PEDIDO.map(e => [e, 0]));
      pedidos.forEach(p => { if (counts[p.estado] !== undefined) counts[p.estado]++; });
      statsEl.innerHTML = `
        <div class="stat-chip warning"><span class="stat-num">${counts['En proceso']}</span><span class="stat-label">En proceso</span></div>
        <div class="stat-chip info"><span class="stat-num">${counts['Pagado']}</span><span class="stat-label">Pagados</span></div>
        <div class="stat-chip"><span class="stat-num">${counts['En camino']}</span><span class="stat-label">En camino</span></div>
        <div class="stat-chip accent"><span class="stat-num">${counts['Entregado']}</span><span class="stat-label">Entregados</span></div>`;
    }

    if (!pedidos.length) {
      listEl.innerHTML = '<div class="empty-state">No hay pedidos en esta vista.</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Número</th><th>Vendedora</th><th>Fecha</th>
            <th>Artículos</th><th>Total</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${pedidos.map(p => {
              const total  = (p.detalle_pedidos || []).reduce((s, d) => s + (d.precio || 0), 0);
              const items  = (p.detalle_pedidos || []).length;
              const badgeClass = { 'En proceso': 'warning', 'Pagado': 'info', 'En camino': 'muted', 'Entregado': 'success' }[p.estado] || 'muted';
              return `<tr>
                <td><span class="id-badge">${p.numero || formatZtId(p.id)}</span></td>
                <td>${p.vendedoras?.nombre || '—'}</td>
                <td>${formatDate(p.fecha || p.created_at)}</td>
                <td>${items} art.</td>
                <td>${formatPeso(total)}</td>
                <td>
                  <select class="estado-select" onchange="updateEstadoPedido('${p.id}', this.value)">
                    ${ESTADOS_PEDIDO.map(e => `<option value="${e}" ${e === p.estado ? 'selected' : ''}>${e}</option>`).join('')}
                  </select>
                </td>
                <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
                  <button class="btn-sm btn-outline" onclick="verDetallePedido('${p.id}')">Ver detalle</button>
                  <button class="btn-sm btn-danger" onclick="eliminarPedido('${p.id}')">Eliminar</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

async function updateEstadoPedido(id, estado) {
  const { error } = await db.from('pedidos').update({ estado }).eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }

  if (estado === 'Pagado') {
    const { data: detalles, error: errDetalles } = await db
      .from('detalle_pedidos')
      .select('prenda_id')
      .eq('pedido_id', id);

    if (errDetalles) { showToast(`Error leyendo detalles: ${errDetalles.message}`, 'error'); return; }

    const prendaIds = (detalles || []).map(d => d.prenda_id).filter(Boolean);

    if (!prendaIds.length) {
      showToast('Pagado — sin prendas vinculadas en este pedido', 'warning');
      return;
    }

    const { error: errPrendas } = await db
      .from('prendas')
      .update({ disponible: false })
      .in('id', prendaIds);

    if (errPrendas) { showToast(`Error actualizando prendas: ${errPrendas.message}`, 'error'); return; }

    showToast(`Pagado — ${prendaIds.length} prenda${prendaIds.length > 1 ? 's' : ''} marcada${prendaIds.length > 1 ? 's' : ''} como vendida${prendaIds.length > 1 ? 's' : ''}`);
    if (document.getElementById('invList')) loadInventario();
    return;
  }

  if (estado === 'Entregado') {
    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .select('vendedora_id, detalle_pedidos(prenda_id)')
      .eq('id', id)
      .single();

    if (errPedido) { showToast(`Error leyendo pedido: ${errPedido.message}`, 'error'); return; }

    const prendaIds = (pedido.detalle_pedidos || []).map(d => d.prenda_id).filter(Boolean);

    if (!prendaIds.length) {
      showToast('Entregado — sin prendas vinculadas en este pedido', 'warning');
      return;
    }

    const fechaHoy = new Date().toISOString().split('T')[0];
    const registros = prendaIds.map(prenda_id => ({
      vendedora_id: pedido.vendedora_id,
      prenda_id,
      pedido_id: id,
      fecha_entrega: fechaHoy,
      estado: 'activo',
    }));

    const { error: errInv } = await db.from('inventario_vendedoras').insert(registros);
    if (errInv) { showToast(`Error registrando inventario: ${errInv.message}`, 'error'); return; }

    showToast(`Entregado — ${prendaIds.length} prenda${prendaIds.length > 1 ? 's' : ''} agregada${prendaIds.length > 1 ? 's' : ''} al inventario de la vendedora`);
    return;
  }

  showToast(`Estado → ${estado}`);
}

async function eliminarPedido(id) {
  if (!confirm('¿Eliminar este pedido? Las prendas volverán al catálogo.')) return;

  const ids = _pedidosPrendaIds[id] || [];
  if (ids.length) await db.from('prendas').update({ disponible: true }).in('id', ids);

  const { error } = await db.from('pedidos').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }

  showToast('Pedido eliminado');
  loadPedidos();
}

async function verDetallePedido(pedidoId) {
  const { data: p } = await db.from('pedidos')
    .select('*, vendedoras(nombre), detalle_pedidos(*)')
    .eq('id', pedidoId).single();
  if (!p) return;

  const items = p.detalle_pedidos || [];
  const total = items.reduce((s, d) => s + (d.precio || 0), 0);

  openModal(`
    <div class="modal-header">
      <h3>Pedido ${p.numero || formatZtId(p.id)}</h3>
      <p class="text-muted">${p.vendedoras?.nombre || '—'} · ${formatDate(p.fecha || p.created_at)}</p>
    </div>
    <div class="modal-section">
      ${!items.length ? '<p class="text-muted">Sin artículos registrados.</p>' : `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Artículo</th><th>Marca</th><th>Precio</th></tr></thead>
            <tbody>
              ${items.map(i => `<tr>
                <td>${i.emoji || ''} ${i.nombre || '—'}</td>
                <td>${i.marca || '—'}</td>
                <td>${formatPeso(i.precio)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-total">Total: <strong>${formatPeso(total)}</strong></div>`}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
    </div>`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: VENDEDORAS
// ══════════════════════════════════════════════════════════════════════════════
async function renderVendedoras() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `
    <div class="section-toolbar">
      <div></div>
      <button class="btn btn-primary" onclick="abrirFormVendedora()">+ Nueva vendedora</button>
    </div>
    <div id="vendStats" class="stats-row"></div>
    <div id="vendList"></div>`;
  await loadVendedoras();
}

async function loadVendedoras() {
  const listEl = document.getElementById('vendList');
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    const { data: vendedoras, error } = await db.from('vendedoras').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const statsEl = document.getElementById('vendStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-chip accent"><span class="stat-num">${vendedoras.length}</span><span class="stat-label">Vendedoras</span></div>`;
    }

    if (!vendedoras.length) {
      listEl.innerHTML = `<div class="empty-state">No hay vendedoras registradas.<br><br>
        <button class="btn btn-primary" onclick="abrirFormVendedora()">+ Agregar primera vendedora</button></div>`;
      return;
    }

    const nivelBadge = { 'Básico': 'muted', 'Silver': '', 'Gold': 'warning', 'Platinum': 'accent' };

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Vendedora</th><th>Nivel</th><th>Teléfono</th>
            <th>Email</th><th>Crédito</th><th>Acceso</th><th>Registro</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${vendedoras.map(v => `<tr>
              <td>
                <div class="vendedora-cell">
                  ${v.foto_url
                    ? `<img src="${v.foto_url}" class="avatar" alt="">`
                    : `<div class="avatar-placeholder">${v.nombre.charAt(0).toUpperCase()}</div>`}
                  <span class="td-name">${v.nombre}</span>
                </div>
              </td>
              <td><span class="badge badge-${nivelBadge[v.nivel] || ''}">${v.nivel || 'Básico'}</span></td>
              <td>${v.telefono || '—'}</td>
              <td>${v.email || '—'}</td>
              <td>${formatPeso(v.credito)}</td>
              <td>${v.password_temporal
                ? '<span class="badge badge-warning" title="Tiene contraseña temporal activa">🔑 Temporal</span>'
                : '<span class="text-muted">—</span>'}</td>
              <td>${formatDate(v.created_at)}</td>
              <td class="td-actions">
                <button class="btn-sm btn-outline" onclick="abrirFormVendedora('${v.id}')">Editar</button>
                <button class="btn-sm btn-danger" onclick="deleteVendedora('${v.id}','${escQ(v.nombre)}')">Eliminar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

async function abrirFormVendedora(id = null) {
  let v = null;
  if (id) {
    const { data } = await db.from('vendedoras').select('*').eq('id', id).single();
    v = data;
  }

  openModal(`
    <div class="modal-header">
      <h3>${v ? 'Editar vendedora' : 'Nueva vendedora'}</h3>
    </div>
    <form id="vendForm" class="modal-form">
      <div class="form-group">
        <label>Nombre *</label>
        <input type="text" id="vNombre" required value="${v?.nombre || ''}" placeholder="Nombre completo">
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="vTelefono" value="${v?.telefono || ''}" placeholder="55 1234 5678">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="vEmail" value="${v?.email || ''}" placeholder="correo@ejemplo.com">
        </div>
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Nivel</label>
          <select id="vNivel">
            ${NIVELES.map(n => `<option value="${n}" ${(v?.nivel || 'Básico') === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Crédito disponible</label>
          <div class="input-prefix"><span>$</span>
            <input type="number" id="vCredito" value="${v?.credito || 0}" min="0" step="0.01">
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Contraseña temporal${v ? ' — dejar vacío para no cambiar' : ''}</label>
        <div class="password-wrap">
          <input type="password" id="vPassword" autocomplete="new-password"
            placeholder="${v ? 'Nueva contraseña (opcional)' : 'Contraseña de acceso para la vendedora'}">
          <button type="button" class="toggle-pw" id="toggleVPw" tabindex="-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${v ? 'Guardar cambios' : 'Crear vendedora'}</button>
      </div>
    </form>`);

  document.getElementById('toggleVPw').addEventListener('click', () => {
    const input = document.getElementById('vPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('vendForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    const payload = {
      nombre:   document.getElementById('vNombre').value.trim(),
      telefono: document.getElementById('vTelefono').value.trim() || null,
      email:    document.getElementById('vEmail').value.trim()    || null,
      nivel:    document.getElementById('vNivel').value,
      credito:  parseFloat(document.getElementById('vCredito').value) || 0
    };

    const pwVal = document.getElementById('vPassword').value;
    if (pwVal) {
      payload.password_hash     = await hashPassword(pwVal);
      payload.password_temporal = true;
    }

    const { error } = id
      ? await db.from('vendedoras').update(payload).eq('id', id)
      : await db.from('vendedoras').insert(payload);

    if (error) {
      showToast(error.message, 'error');
      btn.disabled = false;
      btn.textContent = v ? 'Guardar cambios' : 'Crear vendedora';
    } else {
      showToast(id ? 'Vendedora actualizada' : 'Vendedora creada');
      closeModal();
      loadVendedoras();
    }
  });
}

async function deleteVendedora(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}"?\nSe eliminarán también sus prendas, pedidos y clientes.`)) return;
  const { error } = await db.from('vendedoras').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Vendedora eliminada');
  loadVendedoras();
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
let _clienteSearch = '';
let _clienteVend   = '';
let _clienteDebounce;

async function renderClientes() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `
    <div class="section-toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" id="clienteSearch" placeholder="Buscar clienta…" value="${_clienteSearch}">
      </div>
      <select id="clienteVendFilt" class="select-filter">
        <option value="">Todas las vendedoras</option>
      </select>
    </div>
    <div id="clientesStats" class="stats-row"></div>
    <div id="clientesList"></div>`;

  const { data: vends } = await db.from('vendedoras').select('id, nombre').order('nombre');
  const filtEl = document.getElementById('clienteVendFilt');
  (vends || []).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.nombre;
    if (v.id === _clienteVend) opt.selected = true;
    filtEl.appendChild(opt);
  });

  document.getElementById('clienteSearch').addEventListener('input', e => {
    _clienteSearch = e.target.value;
    clearTimeout(_clienteDebounce);
    _clienteDebounce = setTimeout(loadClientes, 280);
  });

  filtEl.addEventListener('change', e => {
    _clienteVend = e.target.value;
    loadClientes();
  });

  await loadClientes();
}

async function loadClientes() {
  const listEl = document.getElementById('clientesList');
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    let q = db.from('clientes')
      .select('id, nombre, telefono, talla_ropa, talla_pantalon, talla_calzado, fecha_cumpleanos, notas, created_at, vendedoras(nombre)')
      .order('created_at', { ascending: false });

    if (_clienteVend)   q = q.eq('vendedora_id', _clienteVend);
    if (_clienteSearch) q = q.ilike('nombre', `%${_clienteSearch}%`);

    const { data: clientes, error } = await q;
    if (error) throw error;

    const statsEl = document.getElementById('clientesStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-chip accent"><span class="stat-num">${clientes.length}</span><span class="stat-label">Clientas</span></div>`;
    }

    if (!clientes.length) {
      listEl.innerHTML = '<div class="empty-state">No hay clientas que mostrar.</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Nombre</th><th>Vendedora</th><th>Teléfono</th>
            <th>T. Ropa</th><th>T. Pantalón</th><th>T. Calzado</th>
            <th>Cumpleaños</th><th>Registro</th>
          </tr></thead>
          <tbody>
            ${clientes.map(c => `<tr>
              <td class="td-name">${c.nombre}</td>
              <td>${c.vendedoras?.nombre || '—'}</td>
              <td>${c.telefono || '—'}</td>
              <td>${c.talla_ropa || '—'}</td>
              <td>${c.talla_pantalon || '—'}</td>
              <td>${c.talla_calzado || '—'}</td>
              <td>${c.fecha_cumpleanos ? formatDate(c.fecha_cumpleanos) : '—'}</td>
              <td>${formatDate(c.created_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: FINANCIERO
// ══════════════════════════════════════════════════════════════════════════════
async function renderFinanciero() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `<div class="fin-loading"><div class="spinner"></div> Calculando resumen…</div>`;

  try {
    const [ventasR, abonosR, pedidosR, vendedorasR, clientesR, prendasR] = await Promise.all([
      db.from('ventas').select('monto, fecha, created_at, vendedoras(nombre)'),
      db.from('abonos').select('monto, fecha, created_at'),
      db.from('pedidos').select('estado, created_at'),
      db.from('vendedoras').select('id, nombre, credito, nivel'),
      db.from('clientes').select('id, vendedora_id'),
      db.from('prendas').select('disponible, baja')
    ]);

    const ventas    = ventasR.data    || [];
    const abonos    = abonosR.data    || [];
    const pedidos   = pedidosR.data   || [];
    const vendedoras= vendedorasR.data|| [];
    const clientes  = clientesR.data  || [];
    const prendas   = prendasR.data   || [];

    const totalVentas  = ventas.reduce((s, v) => s + (v.monto || 0), 0);
    const totalAbonos  = abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const porCobrar    = Math.max(0, totalVentas - totalAbonos);

    const now       = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ventasMes = ventas.filter(v => (v.fecha || v.created_at || '').slice(0, 7) === mesActual);
    const abonosMes = abonos.filter(a => (a.fecha || a.created_at || '').slice(0, 7) === mesActual);
    const totalVentasMes  = ventasMes.reduce((s, v) => s + (v.monto || 0), 0);
    const totalAbonosMes  = abonosMes.reduce((s, a) => s + (a.monto || 0), 0);

    const pedCounts = Object.fromEntries(ESTADOS_PEDIDO.map(e => [e, 0]));
    pedidos.forEach(p => { if (pedCounts[p.estado] !== undefined) pedCounts[p.estado]++; });

    const dispCount = prendas.filter(p =>  p.disponible && !p.baja).length;
    const vendCount = prendas.filter(p => !p.disponible && !p.baja).length;

    // Ventas por vendedora
    const ventasMap = {};
    ventas.forEach(v => {
      const nombre = v.vendedoras?.nombre || 'Sin asignar';
      ventasMap[nombre] = (ventasMap[nombre] || 0) + (v.monto || 0);
    });
    const topVendedoras = Object.entries(ventasMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    main.innerHTML = `
      <!-- KPIs principales -->
      <div class="fin-grid">
        <div class="kpi-card kpi-accent">
          <div class="kpi-label">Total vendido (histórico)</div>
          <div class="kpi-value">${formatPeso(totalVentas)}</div>
          <div class="kpi-sub">${ventas.length} ventas registradas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total cobrado</div>
          <div class="kpi-value">${formatPeso(totalAbonos)}</div>
          <div class="kpi-sub">${abonos.length} abonos recibidos</div>
        </div>
        <div class="kpi-card kpi-warning">
          <div class="kpi-label">Por cobrar</div>
          <div class="kpi-value">${formatPeso(porCobrar)}</div>
          <div class="kpi-sub">Saldo pendiente</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ventas este mes</div>
          <div class="kpi-value">${formatPeso(totalVentasMes)}</div>
          <div class="kpi-sub">Abonos mes: ${formatPeso(totalAbonosMes)}</div>
        </div>
      </div>

      <!-- KPIs secundarios -->
      <div class="fin-grid fin-grid-3">
        <div class="kpi-card">
          <div class="kpi-label">Vendedoras</div>
          <div class="kpi-value">${vendedoras.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total clientas</div>
          <div class="kpi-value">${clientes.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inventario disponible</div>
          <div class="kpi-value">${dispCount} <span style="font-size:0.9rem;color:var(--text-muted)">/ ${dispCount + vendCount}</span></div>
        </div>
      </div>

      <!-- Pedidos + Ranking -->
      <div class="fin-row">
        <div class="fin-card">
          <h3 class="fin-card-title">Pedidos por estado</h3>
          <div class="pedidos-estados">
            ${ESTADOS_PEDIDO.map(e => {
              const barClass = e === 'Entregado' ? 'bar-success' : e === 'En camino' ? 'bar-info' : '';
              const badgeClass = e === 'Entregado' ? 'success' : e === 'En camino' ? 'info' : 'warning';
              const pct = pedidos.length ? (pedCounts[e] / pedidos.length * 100) : 0;
              return `
                <div class="estado-row">
                  <span class="badge badge-${badgeClass}">${e}</span>
                  <div class="estado-bar-wrap">
                    <div class="estado-bar ${barClass}" style="width:${pct}%"></div>
                  </div>
                  <span class="estado-count">${pedCounts[e]}</span>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="fin-card">
          <h3 class="fin-card-title">Top vendedoras por ventas</h3>
          <div class="vendedoras-rank">
            ${topVendedoras.length === 0
              ? '<p class="text-muted">Sin datos de ventas aún.</p>'
              : topVendedoras.map(([nombre, monto], i) => `
                <div class="rank-row">
                  <span class="rank-num">${i + 1}</span>
                  <span class="rank-name">${nombre}</span>
                  <span class="rank-value">${formatPeso(monto)}</span>
                </div>`).join('')}
          </div>
        </div>
      </div>`;

  } catch (err) {
    main.innerHTML = `<div class="error-state">Error al cargar datos: ${err.message}</div>`;
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function escQ(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ══════════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const session = getSession();
  if (session) {
    const el = document.getElementById('adminName');
    if (el) el.textContent = session.nombre || session.username;
  }

  document.querySelectorAll('.nav-item').forEach(item =>
    item.addEventListener('click', () => navigate(item.dataset.section))
  );

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) { pinLogout(); }
  });

  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  document.getElementById('menuToggle')?.addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('open')
  );

  const initialSection = location.hash.replace('#', '') || 'financiero';
  navigate(initialSection);
});
