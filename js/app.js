'use strict';

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIAS     = ['Blusa','Pantalón','Vestido','Falda','Chamarra','Conjunto','Sudadera','Short','Zapatos','Bolsa','Accesorio','Otro'];
const NIVELES        = ['Básico','Silver','Gold','Platinum'];
const MEDIDAS_POR_CATEGORIA = {
  Pantalón:  ['Cintura', 'Cadera'],  Leggings:  ['Cintura', 'Cadera'],
  Pants:     ['Cintura', 'Cadera'],  Short:     ['Cintura', 'Cadera'],
  Bermuda:   ['Cintura', 'Cadera'],  Jeans:     ['Cintura', 'Cadera'],
  Blusa:     ['Busto',   'Largo'],   Camisa:    ['Busto',   'Largo'],
  Blusón:    ['Busto',   'Largo'],   Playera:   ['Busto',   'Largo'],
  Sudadera:  ['Busto',   'Largo'],   'Suéter':  ['Busto',   'Largo'],
  Vestido:   ['Busto',   'Cintura'], Jumpsuit:  ['Busto',   'Cintura'],
  Chamarra:  ['Busto',   'Largo'],   Abrigo:    ['Busto',   'Largo'],
  Gabardina: ['Busto',   'Largo'],   Blazer:    ['Busto',   'Largo'],
  Saco:      ['Busto',   'Largo'],   Chaleco:   ['Busto',   'Largo'],
  Falda:     ['Cintura', 'Largo'],
};

function getMedidas(categoria) {
  return MEDIDAS_POR_CATEGORIA[categoria] || ['Medida 1', 'Medida 2'];
}

function actualizarLabelesMedidas(prefix, categoria) {
  const [m1, m2] = getMedidas(categoria === '__nueva__' ? '' : (categoria || ''));
  const l1 = document.getElementById(`${prefix}Medida1Label`);
  const l2 = document.getElementById(`${prefix}Medida2Label`);
  if (l1) l1.textContent = `${m1} (cm)`;
  if (l2) l2.textContent = `${m2} (cm)`;
}

const CATEGORIAS_GASTOS = [
  { grupo: 'Compras',     items: ['Paca RAC', 'Paca SAL', 'Compra directa'] },
  { grupo: 'Operación',   items: ['Insumos', 'Salarios', 'Comisiones', 'Empaques', 'Capacitación'] },
  { grupo: 'Tecnología',  items: ['IAs', 'Mantenimiento web', 'Software'] },
  { grupo: 'Ventas',      items: ['Publicidad', 'Envíos', 'Muestras'] },
  { grupo: 'Otros',       items: ['Gasolina', 'Casetas', 'Contabilidad', 'Otros'] },
];
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
  financiero:   'Resumen Financiero',
  prendas:      'Subir Prendas',
  inventario:   'Inventario',
  pedidos:      'Pedidos',
  vendedoras:   'Visionarias',
  clientes:     'Clientas',
  devoluciones: 'Devoluciones',
  gastos:       'Gastos',
  categorias:   'Categorías de Prendas',
};

let _currentSection = '';

function navigate(section) {
  if (!SECTION_TITLES[section]) section = 'financiero';
  _currentSection = section;

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.section === section)
  );
  document.getElementById('sectionTitle').textContent = SECTION_TITLES[section];
  location.hash = section;

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  if (section === 'pedidos') updatePedidosBadge(0);

  const renders = { financiero: renderFinanciero, prendas: renderPrendas,
    inventario: renderInventario, pedidos: renderPedidos,
    vendedoras: renderVendedoras, clientes: renderClientes,
    devoluciones: renderDevoluciones, gastos: renderGastos, categorias: renderCategorias };
  if (renders[section]) renders[section]();
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: SUBIR PRENDAS
// ══════════════════════════════════════════════════════════════════════════════
let selectedFotosPrenda   = [];
let selectedFotosEtiqueta = [];

async function loadCategorias() {
  const { data, error } = await db
    .from('categorias_prendas')
    .select('id, nombre')
    .order('nombre', { ascending: true });
  if (error) {
    console.error('[loadCategorias] error:', error);
    return [];
  }
  return data || [];
}

function fillCategoriaSelect(cats) {
  const sel = document.getElementById('fCategoria');
  if (!sel) return;
  const anchor = sel.querySelector('option[value="__nueva__"]');
  cats.forEach(c => {
    const opt = new Option(c.nombre, c.nombre);
    sel.insertBefore(opt, anchor);
  });
  if (!cats.length) {
    const placeholder = new Option('(sin categorías en BD)', '', false, false);
    placeholder.disabled = true;
    sel.insertBefore(placeholder, anchor);
  }
}

async function renderPrendas() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = '<div class="table-loading">Cargando formulario…</div>';

  main.innerHTML = `
    <div class="upload-form-container">
      <form id="prendaForm" class="prenda-form">

        <!-- 1. ID / Número -->
        <div class="form-section">
          <div class="form-section-title">ID / Número</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label>ID de la prenda *</label>
              <input type="text" id="fNumero" required placeholder="Ej: SAL-001, RAC-045…">
            </div>
          </div>
        </div>

        <!-- 2. Departamento -->
        <div class="form-section">
          <div class="form-section-title">Departamento</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <select id="fDepartamento">
                <option value="DAMA" selected>DAMA</option>
                <option value="CABALLERO">CABALLERO</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 3. Categoría -->
        <div class="form-section">
          <div class="form-section-title">Categoría</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <select id="fCategoria">
                <option value="">Sin categoría</option>
                <option value="__nueva__">＋ Nueva categoría</option>
              </select>
              <div id="fCatNuevaWrap" class="cat-nueva-inline hidden">
                <input type="text" id="fCatNuevaInput" placeholder="Nombre de la categoría…" maxlength="60">
                <button type="button" id="fCatNuevaBtn" class="btn-cat-add">Agregar</button>
                <button type="button" id="fCatNuevaCancelar" class="btn-cat-cancel">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Medidas (dinámicas según categoría) -->
        <div class="form-section">
          <div class="form-section-title">Medidas</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label id="fMedida1Label">Medida 1 (cm)</label>
              <input type="number" id="fMedida1Valor" min="0" step="0.5" placeholder="0">
            </div>
            <div class="form-group">
              <label id="fMedida2Label">Medida 2 (cm)</label>
              <input type="number" id="fMedida2Valor" min="0" step="0.5" placeholder="0">
            </div>
          </div>
        </div>

        <!-- 5. Talla real -->
        <div class="form-section">
          <div class="form-section-title">Talla real</div>
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <input type="text" id="fTallaReal" placeholder="Ej: M, L, 38">
            </div>
          </div>
        </div>

        <!-- 6. Precio mínimo con cálculo automático -->
        <div class="form-section">
          <div class="form-section-title">Precio</div>
          <div class="form-grid form-grid-3">
            <div class="form-group">
              <label>Precio mínimo *</label>
              <div class="input-prefix">
                <span>$</span>
                <input type="number" id="fPrecioMin" min="0" step="1" placeholder="0" required>
              </div>
            </div>
            <div class="form-group price-readonly">
              <label>Precio visionaria <span class="label-auto">auto 70%</span></label>
              <div class="input-prefix">
                <span>$</span>
                <input type="number" id="fPrecioVendedora" min="0" step="1" placeholder="—" tabindex="-1" readonly>
              </div>
            </div>
            <div class="form-group price-readonly">
              <label>Precio máximo <span class="label-auto">auto</span></label>
              <div class="input-prefix">
                <span>$</span>
                <input type="number" id="fPrecioMax" min="0" step="1" placeholder="—" tabindex="-1" readonly>
              </div>
            </div>
          </div>
          <p class="precios-note">Precio visionaria = 70% del mínimo. Máximo: SAL ×1.10 · RAC ×1.25 · JOY/INT ×1.40</p>
        </div>

        <!-- 7. Fotos de la prenda -->
        <div class="form-section">
          <div class="form-section-title">
            Fotos de la prenda
            <span class="foto-section-badge">Se publican en el catálogo</span>
          </div>
          <div class="photo-upload-area" id="photoAreaPrenda">
            <input type="file" id="fotosInputPrenda" accept="image/*" multiple hidden>
            <div class="photo-upload-placeholder" id="photoPlaceholderPrenda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <p>Arrastra fotos aquí o <span>selecciona archivos</span></p>
              <p class="text-muted">JPG, PNG, WEBP — Máx 5 MB por foto</p>
            </div>
            <div class="photo-previews" id="photoPreviewsPrenda"></div>
          </div>
        </div>

        <p class="fotos-note">Puedes agregar las fotos después. La prenda aparecerá en el catálogo hasta que la actives manualmente.</p>

        <!-- 8. Fotos de etiquetas (solo para IA) -->
        <div class="form-section">
          <div class="form-section-title">
            Fotos de etiquetas
            <span class="foto-section-badge foto-section-badge--ia">Solo para análisis de IA</span>
          </div>
          <div class="photo-upload-area photo-upload-area--etiqueta" id="photoAreaEtiqueta">
            <input type="file" id="fotosInputEtiqueta" accept="image/*" multiple hidden>
            <div class="photo-upload-placeholder" id="photoPlaceholderEtiqueta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="6" width="18" height="13" rx="2"/>
                <path d="M3 10h18M8 6V4M16 6V4"/>
              </svg>
              <p>Sube al menos una foto de etiqueta para activar la IA</p>
              <p class="text-muted">Lee talla, composición y cuidado — no se guardan</p>
            </div>
            <div class="photo-previews" id="photoPreviewsEtiqueta"></div>
          </div>
        </div>

        <!-- 9. Observaciones -->
        <div class="form-section">
          <div class="form-section-title">Observaciones</div>
          <div class="form-group">
            <textarea id="fObservaciones" rows="3" style="resize:vertical"
              placeholder="Agrega notas sobre la prenda que ayuden a la IA a generar una mejor descripción. Ej: la tela es muy suave, el corte es generoso, ideal para ocasiones formales…"></textarea>
          </div>
        </div>

        <!-- 10. Botón Generar con IA -->
        <div class="ia-btn-row hidden" id="iaBtnRow">
          <button type="button" id="btnGenerarIA" class="btn-ia">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Generar con IA
          </button>
          <span class="ia-hint">Rellena nombre, marca, talla y descripción automáticamente</span>
        </div>
        <!-- ══ CAMPOS EDITABLES (IA los rellena, admin puede editar) ══ -->
        <div id="iaResultsSection" class="ia-results-section">

          <div class="ia-results-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Revisa y edita antes de guardar
          </div>

          <!-- 11. Nombre -->
          <div class="form-section">
            <div class="form-section-title">Nombre de la prenda *</div>
            <div class="form-group">
              <input type="text" id="fNombre" placeholder="Máx 5 palabras incluyendo marca" maxlength="120">
              <p class="field-hint">Ej: "Blazer Structured Negro Theory" — máx 5 palabras, tono boutique</p>
            </div>
          </div>

          <!-- 12. Marca -->
          <div class="form-section">
            <div class="form-section-title">Marca</div>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <input type="text" id="fMarca" placeholder="Marca de la prenda">
              </div>
            </div>
          </div>

          <!-- 13. Talla marcada -->
          <div class="form-section">
            <div class="form-section-title">Talla marcada</div>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <input type="text" id="fTallaEtiqueta" placeholder="Talla exacta de la etiqueta">
              </div>
            </div>
          </div>

          <!-- 14. Descripción completa -->
          <div class="form-section">
            <div class="form-section-title">Descripción completa</div>
            <div class="form-group">
              <textarea id="fDescripcion" rows="8" style="resize:vertical"
                placeholder="La IA llenará este campo con argumentos de venta, cliente ideal y cómo presentarla…"></textarea>
            </div>
          </div>

          <!-- 15. Guardar -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" id="submitPrendaBtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;flex-shrink:0">
                <path d="M5 12l5 5L20 7"/>
              </svg>
              Guardar prenda
            </button>
          </div>

        </div>

        <!-- Campos técnicos ocultos (llenados por IA) -->
        <input type="hidden" id="fColor" value="">
        <input type="hidden" id="fVendedora" value="">
        <input type="hidden" id="fPrecioCosto" value="0">
        <input type="hidden" id="fMaterial" value="">
        <input type="hidden" id="fComposicion" value="">
        <input type="hidden" id="fCuidado" value="">

      </form>
    </div>`;

  selectedFotosPrenda   = [];
  selectedFotosEtiqueta = [];
  bindPhotoSection('photoAreaPrenda',   'fotosInputPrenda',   'photoPreviewsPrenda',   selectedFotosPrenda,   renderPrendaPreviews);
  bindPhotoSection('photoAreaEtiqueta', 'fotosInputEtiqueta', 'photoPreviewsEtiqueta', selectedFotosEtiqueta, renderEtiquetaPreviews);
  document.getElementById('btnGenerarIA').addEventListener('click', handleGenerarIA);
  document.getElementById('prendaForm').addEventListener('submit', handlePrendaSubmit);
  bindCatNuevaForm('fCategoria', 'fCatNuevaWrap', 'fCatNuevaInput', 'fCatNuevaBtn', 'fCatNuevaCancelar');

  document.getElementById('fCategoria').addEventListener('change', e => {
    actualizarLabelesMedidas('f', e.target.value);
  });

  loadCategorias().then(fillCategoriaSelect);
  updateIAButton();
}

function bindCatNuevaForm(selectId, wrapId, inputId, btnAddId, btnCancelId, tableName = 'categorias_prendas') {
  const sel    = document.getElementById(selectId);
  const wrap   = document.getElementById(wrapId);
  const input  = document.getElementById(inputId);
  const btnAdd = document.getElementById(btnAddId);
  const btnCan = document.getElementById(btnCancelId);
  if (!sel || !wrap) return;

  sel.addEventListener('change', () => {
    if (sel.value === '__nueva__') {
      wrap.classList.remove('hidden');
      input.focus();
    } else {
      wrap.classList.add('hidden');
    }
  });

  const cancelar = () => {
    wrap.classList.add('hidden');
    input.value = '';
    sel.value = '';
  };
  if (btnCan) btnCan.addEventListener('click', cancelar);

  btnAdd.addEventListener('click', async () => {
    const nombre = input.value.trim();
    if (!nombre) { showToast('Escribe un nombre para la categoría', 'info'); input.focus(); return; }

    btnAdd.disabled = true;
    const prev = btnAdd.textContent;
    btnAdd.textContent = '…';

    const { data, error } = await db.from(tableName).insert({ nombre }).select().single();
    btnAdd.disabled = false;
    btnAdd.textContent = prev;

    if (error) {
      showToast(
        (error.message.includes('duplicate') || error.message.includes('unique'))
          ? 'Esa categoría ya existe'
          : error.message,
        'error'
      );
      return;
    }

    const opt = new Option(data.nombre, data.nombre, true, true);
    sel.insertBefore(opt, sel.querySelector('option[value="__nueva__"]'));
    sel.value = data.nombre;
    wrap.classList.add('hidden');
    input.value = '';
    showToast(`Categoría "${data.nombre}" agregada`);
  });
}

function _aplicarPreciosAuto(min, prefijo, vendEl, maxEl) {
  const mult     = { SAL: 1.10, RAC: 1.25, JOY: 1.40, INT: 1.40 }[prefijo];
  const vend     = min > 0 ? Math.ceil(min * 0.70 / 10) * 10 : '';
  const precioMax = (mult && min > 0) ? Math.round(min * mult) : '';

  vendEl.value = vend;
  maxEl.value  = precioMax;
}

function calcularPreciosAuto() {
  const prefijo  = document.getElementById('fNumero')?.value?.trim().toUpperCase().substring(0, 3) ?? '';
  const precioMin = parseFloat(document.getElementById('fPrecioMin')?.value) || 0;
  const vendEl   = document.getElementById('fPrecioVendedora');
  const maxEl    = document.getElementById('fPrecioMax');
  if (!vendEl || !maxEl) return;
  _aplicarPreciosAuto(precioMin, prefijo, vendEl, maxEl);
}

function _calcularPreciosModal() {
  const prefijo  = document.getElementById('eId')?.value?.trim().toUpperCase().substring(0, 3) ?? '';
  const precioMin = parseFloat(document.getElementById('ePrecioMin')?.value) || 0;
  const vendEl   = document.getElementById('eCosto');
  const maxEl    = document.getElementById('ePrecioMax');
  if (!vendEl || !maxEl) return;
  _aplicarPreciosAuto(precioMin, prefijo, vendEl, maxEl);
}

function bindPhotoSection(areaId, inputId, previewsId, store, renderFn) {
  const area  = document.getElementById(areaId);
  const input = document.getElementById(inputId);
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    _addFotosTo(e.dataTransfer.files, store, renderFn);
  });
  input.addEventListener('change', () => { _addFotosTo(input.files, store, renderFn); input.value = ''; });
}

function _addFotosTo(files, store, renderFn) {
  const valid = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
  if (valid.length < files.length) showToast('Algunas fotos superan 5 MB y fueron ignoradas.', 'info');
  store.push(...valid);
  renderFn();
  updateIAButton();
}

function _renderPhotoArea(store, previewsId, placeholderId, renderFn) {
  const container   = document.getElementById(previewsId);
  const placeholder = document.getElementById(placeholderId);
  if (!container) return;
  if (store.length === 0) {
    if (placeholder) placeholder.style.display = '';
    container.innerHTML = '';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';
  container.innerHTML = store.map((f, i) => `
    <div class="photo-preview-item">
      <img src="${URL.createObjectURL(f)}" alt="${f.name}">
      <button type="button" class="photo-remove-btn" data-i="${i}">×</button>
    </div>`).join('');
  container.querySelectorAll('.photo-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      store.splice(+btn.dataset.i, 1);
      renderFn();
      updateIAButton();
    });
  });
}

function renderPrendaPreviews()   { _renderPhotoArea(selectedFotosPrenda,   'photoPreviewsPrenda',   'photoPlaceholderPrenda',   renderPrendaPreviews);   }
function renderEtiquetaPreviews() { _renderPhotoArea(selectedFotosEtiqueta, 'photoPreviewsEtiqueta', 'photoPlaceholderEtiqueta', renderEtiquetaPreviews); }

function updateIAButton() {
  const btn = document.getElementById('btnGenerarIA');
  if (!btn) return;
  const row = btn.closest('.ia-btn-row');
  if (row) row.classList.toggle('hidden', selectedFotosEtiqueta.length === 0);
  btn.disabled = btn.classList.contains('loading');
}

function _compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1200 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen')),
        'image/jpeg', 0.85
      );
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

async function handleGenerarIA() {
  const btn = document.getElementById('btnGenerarIA');
  btn.classList.add('loading');
  btn.disabled = true;
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-sm"></span> Analizando…`;

  const sessionId = Date.now().toString(36);
  const tempPaths = [];

  try {
    const uploadForAI = async (file, type, idx) => {
      const blob = await _compressImage(file);
      const path = `ia-temp/${sessionId}/${type}-${idx}.jpg`;
      const { data, error } = await db.storage.from('prenda-fotos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      tempPaths.push(data.path);
      const { data: u } = db.storage.from('prenda-fotos').getPublicUrl(data.path);
      return { url: u.publicUrl, type };
    };

    const images = [];
    for (let i = 0; i < selectedFotosPrenda.length; i++) {
      images.push(await uploadForAI(selectedFotosPrenda[i], 'prenda', i));
    }
    for (let i = 0; i < selectedFotosEtiqueta.length; i++) {
      images.push(await uploadForAI(selectedFotosEtiqueta[i], 'etiqueta', i));
    }

    const idVal  = document.getElementById('fNumero').value.trim().toUpperCase();
    const prefix = idVal.slice(0, 3);
    const categoriaLabels = { SAL: 'Saldo', RAC: 'Ropa alta calidad', JOY: 'Joyería/Accesorios', INT: 'Ropa interior' };
    const contexto = {
      categoria:     categoriaLabels[prefix] || null,
      tallaReal:     document.getElementById('fTallaReal').value.trim()     || null,
      precioMin:     parseFloat(document.getElementById('fPrecioMin').value)  || null,
      precioMax:     parseFloat(document.getElementById('fPrecioMax').value)  || null,
      observaciones: document.getElementById('fObservaciones')?.value.trim() || null,
    };

    const res = await fetch('/api/generar-descripcion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, contexto }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    const r = await res.json();

    // Campos visibles editables
    if (r.nombre)  document.getElementById('fNombre').value       = r.nombre;
    if (r.marca)   document.getElementById('fMarca').value        = r.marca;
    if (r.talla)   document.getElementById('fTallaEtiqueta').value = r.talla;

    // Descripción completa: combinar los campos de ventas en un solo textarea
    const partes = [r.por_que_vale, r.cliente_ideal, r.como_presentarla].filter(Boolean);
    if (partes.length) document.getElementById('fDescripcion').value = partes.join('\n\n');

    // Campos técnicos ocultos
    if (r.color)       document.getElementById('fColor').value       = r.color;
    if (r.material)    document.getElementById('fMaterial').value    = r.material;
    if (r.composicion) document.getElementById('fComposicion').value = r.composicion;
    if (r.cuidado)     document.getElementById('fCuidado').value     = r.cuidado;

    showToast('¡Campos llenados con IA! Revisa y edita antes de guardar.', 'success');
  } catch (err) {
    showToast(err.message || 'Error al conectar con la IA', 'error');
  } finally {
    if (tempPaths.length) {
      db.storage.from('prenda-fotos').remove(tempPaths).catch(() => {});
    }
    btn.classList.remove('loading');
    btn.innerHTML = originalHTML;
    updateIAButton();
  }
}

async function uploadFoto(file, prendaId) {
  const blob = await _compressImage(file);
  const path = `prendas/${prendaId}/${Date.now()}.jpg`;
  const { data, error } = await db.storage.from('prenda-fotos').upload(path, blob, { contentType: 'image/jpeg' });
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
    const _desc = {
      material:         document.getElementById('fMaterial').value.trim()    || null,
      composicion:      document.getElementById('fComposicion').value.trim() || null,
      cuidado:          document.getElementById('fCuidado').value.trim()     || null,
      por_que_vale:     document.getElementById('fDescripcion')?.value.trim() || null,
    };
    const cat = document.getElementById('fCategoria').value;
    const prendaData = {
      numero:            document.getElementById('fNumero').value.trim(),
      nombre:            document.getElementById('fNombre')?.value.trim() || document.getElementById('fNumero').value.trim(),
      marca:             document.getElementById('fMarca')?.value.trim()           || null,
      color:             document.getElementById('fColor').value.trim()            || null,
      categoria:         cat                                                        || null,
      departamento:      document.getElementById('fDepartamento').value            || 'DAMA',
      vendedora_id:      document.getElementById('fVendedora').value               || null,
      talla_etiqueta:    document.getElementById('fTallaEtiqueta')?.value.trim()   || null,
      talla_real:        document.getElementById('fTallaReal').value.trim()        || null,
      medida_1_nombre:   getMedidas(cat)[0],
      medida_1_valor:    parseFloat(document.getElementById('fMedida1Valor').value) || null,
      medida_2_nombre:   getMedidas(cat)[1],
      medida_2_valor:    parseFloat(document.getElementById('fMedida2Valor').value) || null,
      precio_costo:      parseFloat(document.getElementById('fPrecioVendedora').value) || 0,
      precio_min:        parseFloat(document.getElementById('fPrecioMin').value)     || 0,
      precio_max:        parseFloat(document.getElementById('fPrecioMax').value)     || 0,
      disponible:        false,
      baja:              false,
      fecha_adquisicion: new Date().toISOString(),
      descripcion:       Object.values(_desc).some(Boolean) ? JSON.stringify(_desc) : null,
      observaciones:     document.getElementById('fObservaciones')?.value.trim()   || null,
    };

    const { data: prenda, error } = await db.from('prendas').insert(prendaData).select().single();
    if (error) throw error;

    let uploadErrors = 0;
    const fotoErrorMsgs = [];
    for (const foto of selectedFotosPrenda) {
      try {
        const url = await uploadFoto(foto, prenda.id);
        await db.from('fotos_prendas').insert({ prenda_id: prenda.id, url });
      } catch (fotoErr) {
        uploadErrors++;
        fotoErrorMsgs.push(`${foto.name}: ${fotoErr.message || JSON.stringify(fotoErr)}`);
      }
    }

    selectedFotosPrenda   = [];
    selectedFotosEtiqueta = [];
    e.target.reset();
    renderPrendaPreviews();
    renderEtiquetaPreviews();
    updateIAButton();

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
      showToast(`Prenda "${prenda.nombre}" guardada. Actívala en Inventario para publicarla.`, 'info');
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
    const { data: dpDates } = await db
      .from('detalle_pedidos')
      .select('prenda_id, pedidos(fecha, estado)');
    const ventaFechaMap = {};
    (dpDates || []).forEach(d => {
      if (!d.prenda_id || !d.pedidos?.fecha) return;
      if (d.pedidos.estado !== 'Pagado' && d.pedidos.estado !== 'Entregado') return;
      const f = d.pedidos.fecha;
      if (!ventaFechaMap[d.prenda_id] || f > ventaFechaMap[d.prenda_id]) ventaFechaMap[d.prenda_id] = f;
    });

    let q = db.from('prendas')
      .select('id, nombre, marca, categoria, talla_etiqueta, talla_real, medida_1_nombre, medida_1_valor, medida_2_nombre, medida_2_valor, precio_costo, precio_min, precio_max, disponible, baja, emoji, fecha_adquisicion, vendedoras(nombre), fotos_prendas(url)')
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
            <th>Min / Max</th><th>Visionaria</th><th>Estado</th><th>Medidas</th><th>Adquirida</th><th>Vendida</th><th>Acciones</th>
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
                <td class="td-medidas-inv">${(p.medida_1_valor != null || p.medida_2_valor != null)
                    ? `${p.medida_1_nombre || 'M1'}: ${p.medida_1_valor ?? '—'} / ${p.medida_2_nombre || 'M2'}: ${p.medida_2_valor ?? '—'}`
                    : '<span class="text-muted">—</span>'}</td>
                <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${p.fecha_adquisicion ? formatDate(p.fecha_adquisicion) : '—'}</td>
                <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${ventaFechaMap[p.id] ? formatDate(ventaFechaMap[p.id]) : '—'}</td>
                <td class="td-actions">
                  ${(() => {
                    const st = prendaPublishState(p);
                    return `
                      <button class="btn-sm btn-outline" onclick="abrirEditarPrenda('${p.id}')">Editar</button>
                      ${(st === 'incompleta' || st === 'lista')
                        ? `<button class="btn-sm btn-outline" title="Agregar fotos" onclick="abrirEditarPrenda('${p.id}')">📷 Fotos</button>`
                        : ''}
                      ${st === 'lista'
                        ? `<button class="btn-sm btn-publish" onclick="publicarPrenda('${p.id}')">✅ Publicar</button>`
                        : ''}
                      ${!p.baja
                        ? `<button class="btn-icon" title="${p.disponible ? 'Marcar vendida' : 'Marcar disponible'}"
                             onclick="toggleDisp('${p.id}',${p.disponible})">${p.disponible ? '✓' : '↩'}</button>
                           <button class="btn-icon btn-warn" title="Dar de baja" onclick="darBaja('${p.id}')">↓</button>`
                        : `<button class="btn-icon" title="Reactivar" onclick="reactivar('${p.id}')">↑</button>`}
                      <button class="btn-icon btn-danger" title="Eliminar"
                        onclick="deletePrenda('${p.id}','${escQ(p.nombre)}')">🗑</button>`;
                  })()}
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

function prendaPublishState(p) {
  if (p.baja)       return 'baja';
  if (p.disponible) return 'publicada';
  if (p.fotos_prendas?.length > 0) return 'lista';
  return 'incompleta';
}

function estadoBadge(p) {
  if (p.baja) return '<span class="badge badge-muted">Baja</span>';
  switch (prendaPublishState(p)) {
    case 'publicada':   return '<span class="badge badge-success">Publicada</span>';
    case 'lista':       return '<span class="badge badge-warning">Lista para publicar</span>';
    default:            return '<span class="badge badge-muted">Incompleta</span>';
  }
}

async function publicarPrenda(id) {
  const { error } = await db.from('prendas').update({ disponible: true }).eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Prenda publicada al catálogo');
  loadInventario();
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
  const [{ data: vendedoras }, { data: cats }] = await Promise.all([
    db.from('vendedoras').select('id, nombre').order('nombre'),
    db.from('categorias_prendas').select('id, nombre').order('nombre'),
  ]);
  const categorias = cats || [];

  // Try fetching with optional columns (numero, categoria); fall back if they don't exist yet
  let p, hasExtras = true;
  const fullSel = 'id, nombre, marca, color, categoria, departamento, numero, emoji, gradiente, talla_etiqueta, talla_real, medida_1_nombre, medida_1_valor, medida_2_nombre, medida_2_valor, precio_costo, precio_min, precio_max, disponible, baja, vendedora_id, descripcion, fotos_prendas(id, url)';
  const safeSel = 'id, nombre, marca, color, emoji, gradiente, talla_etiqueta, talla_real, precio_costo, precio_min, precio_max, disponible, baja, vendedora_id, descripcion, fotos_prendas(id, url)';

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
  const desc = parseDesc(p.descripcion);

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
          <div class="form-group">
            <label>Color</label>
            <input type="text" id="eColor" value="${escHtml(p.color)}" placeholder="Ej: Negro, Rosa, Multicolor">
          </div>
          ${hasExtras ? `<div class="form-group">
            <label>Categoría</label>
            <select id="eCategoria">
              <option value="">Sin categoría</option>
              ${categorias.map(c => `<option value="${c.nombre}" ${p.categoria === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
              <option value="__nueva__">＋ Nueva categoría</option>
            </select>
            <div id="eCatNuevaWrap" class="cat-nueva-inline hidden">
              <input type="text" id="eCatNuevaInput" placeholder="Nombre de la categoría…" maxlength="60">
              <button type="button" id="eCatNuevaBtn" class="btn-cat-add">Agregar</button>
              <button type="button" id="eCatNuevaCancelar" class="btn-cat-cancel">✕</button>
            </div>
          </div>` : ''}
          <div class="form-group">
            <label>Departamento</label>
            <select id="eDepartamento">
              <option value="DAMA"      ${(p.departamento || 'DAMA') === 'DAMA'      ? 'selected' : ''}>DAMA</option>
              <option value="CABALLERO" ${p.departamento === 'CABALLERO' ? 'selected' : ''}>CABALLERO</option>
            </select>
          </div>
          <div class="form-group">
            <label>Visionaria</label>
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
            <label>Talla marcada</label>
            <input type="text" id="eTallaEtiqueta" value="${p.talla_etiqueta || ''}">
          </div>
          <div class="form-group">
            <label>Talla real</label>
            <input type="text" id="eTallaReal" value="${p.talla_real || ''}">
          </div>
        </div>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Medidas</div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label id="eMedida1Label">${escHtml(p.medida_1_nombre || getMedidas(p.categoria || '')[0])} (cm)</label>
            <input type="number" id="eMedida1Valor" min="0" step="0.5" value="${p.medida_1_valor != null ? p.medida_1_valor : ''}" placeholder="0">
          </div>
          <div class="form-group">
            <label id="eMedida2Label">${escHtml(p.medida_2_nombre || getMedidas(p.categoria || '')[1])} (cm)</label>
            <input type="number" id="eMedida2Valor" min="0" step="0.5" value="${p.medida_2_valor != null ? p.medida_2_valor : ''}" placeholder="0">
          </div>
        </div>
      </div>

      <div class="edit-section">
        <div class="form-section-title">Precios</div>
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label>Precio mínimo</label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="ePrecioMin" min="0" step="1" value="${p.precio_min || ''}">
            </div>
          </div>
          <div class="form-group price-readonly">
            <label>Precio visionaria <span class="label-auto">auto 70%</span></label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="eCosto" min="0" step="1" value="${p.precio_costo || ''}" tabindex="-1" readonly>
            </div>
          </div>
          <div class="form-group price-readonly">
            <label>Precio máximo <span class="label-auto">auto</span></label>
            <div class="input-prefix"><span>$</span>
              <input type="number" id="ePrecioMax" min="0" step="1" value="${p.precio_max || ''}" tabindex="-1" readonly>
            </div>
          </div>
        </div>
        <p class="precios-note">Precio visionaria = 70% del mínimo. Máximo: SAL ×1.10 · RAC ×1.25 · JOY/INT ×1.40</p>
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

      <div class="edit-section">
        <div class="form-section-title">Descripción</div>
        <div class="form-section-subtitle">Ficha técnica</div>
        <div class="form-grid form-grid-3">
          <div class="form-group">
            <label>Material</label>
            <input type="text" id="eMaterial" value="${escHtml(desc.material)}" placeholder="Ej: Algodón, Poliéster…">
          </div>
          <div class="form-group">
            <label>Composición</label>
            <input type="text" id="eComposicion" value="${escHtml(desc.composicion)}" placeholder="Ej: 80% algodón, 20% poliéster">
          </div>
          <div class="form-group">
            <label>Instrucciones de cuidado</label>
            <input type="text" id="eCuidado" value="${escHtml(desc.cuidado)}" placeholder="Ej: Lavar a mano, no planchar">
          </div>
        </div>
        <div class="form-section-subtitle">Cómo vender</div>
        <div class="form-group">
          <label>Por qué vale lo que cuesta</label>
          <textarea id="ePorQueVale" rows="3" placeholder="Argumentos de valor: calidad, exclusividad, durabilidad…">${escHtml(desc.por_que_vale)}</textarea>
        </div>
        <div class="form-group">
          <label>Cliente ideal</label>
          <textarea id="eClienteIdeal" rows="2" placeholder="A quién le queda perfecto esta prenda…">${escHtml(desc.cliente_ideal)}</textarea>
        </div>
        <div class="form-group">
          <label>Cómo presentarla</label>
          <textarea id="eComoPresentarla" rows="3" placeholder="Tips para mostrarla, con qué combinarla, cómo usarla…">${escHtml(desc.como_presentarla)}</textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="editSubmitBtn">Guardar cambios</button>
      </div>
    </form>`, true);

  _renderEditFotos();
  bindCatNuevaForm('eCategoria', 'eCatNuevaWrap', 'eCatNuevaInput', 'eCatNuevaBtn', 'eCatNuevaCancelar');
  if (hasExtras) {
    document.getElementById('eCategoria')?.addEventListener('change', e => {
      actualizarLabelesMedidas('e', e.target.value);
    });
  }

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

  // Auto-cálculo de precios en tiempo real
  document.getElementById('ePrecioMin')?.addEventListener('input', _calcularPreciosModal);
  if (hasExtras) document.getElementById('eId')?.addEventListener('input', _calcularPreciosModal);
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
    const _eDesc = {
      material:         document.getElementById('eMaterial').value.trim()         || null,
      composicion:      document.getElementById('eComposicion').value.trim()      || null,
      cuidado:          document.getElementById('eCuidado').value.trim()          || null,
      por_que_vale:     document.getElementById('ePorQueVale').value.trim()       || null,
      cliente_ideal:    document.getElementById('eClienteIdeal').value.trim()     || null,
      como_presentarla: document.getElementById('eComoPresentarla').value.trim()  || null,
    };
    const payload = {
      nombre:         document.getElementById('eNombre').value.trim(),
      marca:          document.getElementById('eMarca').value.trim()         || null,
      color:          document.getElementById('eColor').value.trim()         || null,
      departamento:   document.getElementById('eDepartamento').value         || null,
      vendedora_id:   document.getElementById('eVendedora').value            || null,
      talla_etiqueta:  document.getElementById('eTallaEtiqueta').value.trim() || null,
      talla_real:      document.getElementById('eTallaReal').value.trim()     || null,
      medida_1_nombre: (document.getElementById('eMedida1Label')?.textContent || '').replace(' (cm)', '') || null,
      medida_1_valor:  parseFloat(document.getElementById('eMedida1Valor')?.value) || null,
      medida_2_nombre: (document.getElementById('eMedida2Label')?.textContent || '').replace(' (cm)', '') || null,
      medida_2_valor:  parseFloat(document.getElementById('eMedida2Valor')?.value) || null,
      precio_costo:   parseFloat(document.getElementById('eCosto').value)    || 0,
      precio_min:     parseFloat(document.getElementById('ePrecioMin').value) || 0,
      precio_max:     parseFloat(document.getElementById('ePrecioMax').value) || 0,
      disponible:     estadoVal === 'disponible',
      baja:           estadoVal === 'baja',
      descripcion:    Object.values(_eDesc).some(Boolean) ? JSON.stringify(_eDesc) : null,
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
            <th>Número</th><th>Visionaria</th><th>Fecha</th>
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
    console.log('[Zetina Admin] Marcando Entregado — pedido_id:', id);

    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .select('vendedora_id, detalle_pedidos(prenda_id)')
      .eq('id', id)
      .single();

    console.log('[Zetina Admin] Pedido leído:', pedido, '| Error:', errPedido);

    if (errPedido) { showToast(`Error leyendo pedido: ${errPedido.message}`, 'error'); return; }

    const prendaIds = (pedido.detalle_pedidos || []).map(d => d.prenda_id).filter(Boolean);
    console.log('[Zetina Admin] prenda_ids del detalle:', prendaIds);
    console.log('[Zetina Admin] vendedora_id del pedido:', pedido.vendedora_id);

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

    console.log('[Zetina Admin] Registros a insertar en inventario_vendedoras:', registros);

    const { data: invData, error: errInv } = await db
      .from('inventario_vendedoras')
      .insert(registros)
      .select();

    console.log('[Zetina Admin] Resultado insert inventario_vendedoras:', invData, '| Error:', errInv);

    if (errInv) { showToast(`Error registrando inventario: ${errInv.message}`, 'error'); return; }

    showToast(`Entregado — ${prendaIds.length} prenda${prendaIds.length > 1 ? 's' : ''} agregada${prendaIds.length > 1 ? 's' : ''} al inventario de la visionaria`);
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
    .select('*, vendedoras(nombre), detalle_pedidos(*), direccion_entrega_texto')
    .eq('id', pedidoId).single();
  if (!p) return;

  const items = p.detalle_pedidos || [];
  const total = items.reduce((s, d) => s + (d.precio || 0), 0);

  openModal(`
    <div class="modal-header">
      <h3>Pedido ${p.numero || formatZtId(p.id)}</h3>
      <p class="text-muted">${p.vendedoras?.nombre || '—'} · ${formatDate(p.fecha || p.created_at)}</p>
      ${p.direccion_entrega_texto ? `<p class="text-muted" style="font-size:0.8rem;margin-top:4px">📦 ${p.direccion_entrega_texto}</p>` : ''}
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
  main.innerHTML = '<div class="table-loading">Cargando visionarias…</div>';

  try {
    const now = new Date();
    const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    const [vendsR, statsR, ventasMesR, invR, clientasR] = await Promise.all([
      db.from('vendedoras').select('id, nombre, nivel, telefono, foto_url').order('nombre'),
      db.from('visionaria_stats').select('vendedora_id, puntos, nivel_actual, logros, matches_totales'),
      db.from('ventas').select('monto, vendedora_id').gte('fecha', primerDiaMes),
      db.from('inventario_vendedoras').select('vendedora_id, estado'),
      db.from('clientes').select('id, vendedora_id'),
    ]);

    const vends     = vendsR.data     || [];
    const stats     = (statsR.data    || []);
    const ventasMes = ventasMesR.data || [];
    const inv       = invR.data       || [];
    const clientas  = clientasR.data  || [];

    const statsMap   = Object.fromEntries(stats.map(s => [s.vendedora_id, s]));
    const ventasMap  = {};
    ventasMes.forEach(v => { ventasMap[v.vendedora_id] = (ventasMap[v.vendedora_id] || 0) + (+v.monto || 0); });
    const invMap = {};
    inv.forEach(i => {
      if (!invMap[i.vendedora_id]) invMap[i.vendedora_id] = { activas: 0, prestadas: 0 };
      if (i.estado === 'prestado' || i.estado === 'prestada') invMap[i.vendedora_id].prestadas++;
      else invMap[i.vendedora_id].activas++;
    });
    const clientasMap = {};
    clientas.forEach(c => { clientasMap[c.vendedora_id] = (clientasMap[c.vendedora_id] || 0) + 1; });

    const nivelBadge = { 'Básico': 'muted', 'Silver': '', 'Gold': 'warning', 'Platinum': 'accent' };

    main.innerHTML = `
      <div class="section-toolbar">
        <div class="stats-row" style="margin:0">
          <div class="stat-chip accent"><span class="stat-num">${vends.length}</span><span class="stat-label">Visionarias</span></div>
        </div>
        <button class="btn btn-primary" onclick="abrirFormVendedora()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px;flex-shrink:0"><path d="M12 5v14M5 12h14"/></svg>
          Nueva visionaria
        </button>
      </div>

      ${!vends.length
        ? `<div class="empty-state">No hay visionarias registradas.<br><br>
             <button class="btn btn-primary" onclick="abrirFormVendedora()">+ Agregar primera visionaria</button></div>`
        : `<div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Visionaria</th><th>Nivel</th><th>Puntos</th>
                <th>Ganancia del mes</th><th>Inv. activo</th><th>Prestadas</th>
                <th>Clientas</th><th>Acciones</th>
              </tr></thead>
              <tbody>
                ${vends.map(v => {
                  const st   = statsMap[v.id] || {};
                  const gan  = ventasMap[v.id] || 0;
                  const invD = invMap[v.id]    || { activas: 0, prestadas: 0 };
                  const nCli = clientasMap[v.id] || 0;
                  return `<tr>
                    <td>
                      <div class="vendedora-cell">
                        ${v.foto_url
                          ? `<img src="${v.foto_url}" class="avatar" alt="">`
                          : `<div class="avatar-placeholder">${v.nombre.charAt(0).toUpperCase()}</div>`}
                        <button class="vis-nombre-btn" onclick="renderDetalleVisionaria('${v.id}')">${v.nombre}</button>
                      </div>
                    </td>
                    <td><span class="badge badge-${nivelBadge[v.nivel] || ''}">${v.nivel || 'Básico'}</span></td>
                    <td>${st.puntos != null ? `<span class="vis-puntos">${st.puntos} pts</span>` : '—'}</td>
                    <td style="font-weight:600;color:var(--success)">${gan > 0 ? formatPeso(gan) : '—'}</td>
                    <td>${invD.activas > 0 ? `<span class="vis-inv-badge">${invD.activas}</span>` : '—'}</td>
                    <td>${invD.prestadas > 0 ? `<span class="vis-prest-badge">${invD.prestadas}</span>` : '—'}</td>
                    <td>${nCli > 0 ? nCli : '—'}</td>
                    <td class="td-actions">
                      <button class="btn-sm btn-outline" onclick="renderDetalleVisionaria('${v.id}')">Ver perfil</button>
                      <button class="btn-sm btn-outline" onclick="abrirFormVendedora('${v.id}')">Editar</button>
                      <button class="btn-sm btn-danger" onclick="deleteVendedora('${v.id}','${escQ(v.nombre)}')">Eliminar</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}`;

  } catch (err) {
    main.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

async function renderDetalleVisionaria(vendedoraId) {
  const main = document.getElementById('sectionContent');
  main.innerHTML = '<div class="table-loading">Cargando perfil…</div>';

  try {
    const now = new Date();
    const primerDiaMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    const [vendR, statsR, ventasMesR, invR, clientasR] = await Promise.all([
      db.from('vendedoras').select('id, nombre, nivel, telefono, email, credito, foto_url, created_at').eq('id', vendedoraId).single(),
      db.from('visionaria_stats').select('*').eq('vendedora_id', vendedoraId).maybeSingle(),
      db.from('ventas').select('monto, fecha, created_at').eq('vendedora_id', vendedoraId).gte('fecha', primerDiaMes).order('fecha', { ascending: false }),
      db.from('inventario_vendedoras').select('estado, prendas(id, nombre, numero, precio_costo, fotos_prendas(url))').eq('vendedora_id', vendedoraId),
      db.from('clientes').select('id, nombre, telefono').eq('vendedora_id', vendedoraId).order('nombre'),
    ]);

    const vend      = vendR.data      || {};
    const stats     = statsR.data     || {};
    const ventasMes = ventasMesR.data || [];
    const invItems  = invR.data       || [];
    const clientas  = clientasR.data  || [];

    const totalVentasMes  = ventasMes.reduce((s, v) => s + (+v.monto || 0), 0);
    const prendasActivas  = invItems.filter(i => i.estado !== 'prestado' && i.estado !== 'prestada');
    const prendasPrestadas = invItems.filter(i => i.estado === 'prestado' || i.estado === 'prestada');
    const nivelBadge = { 'Básico': 'muted', 'Silver': '', 'Gold': 'warning', 'Platinum': 'accent' };

    const logrosCount = stats.logros != null
      ? (Array.isArray(stats.logros) ? stats.logros.length : +stats.logros || 0)
      : null;

    main.innerHTML = `
      <div class="vis-detalle">
        <button class="vis-back-btn" onclick="renderVendedoras()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;flex-shrink:0"><path d="m15 18-6-6 6-6"/></svg>
          Volver a visionarias
        </button>

        <div class="vis-perfil-header">
          ${vend.foto_url
            ? `<img src="${vend.foto_url}" class="vis-avatar" alt="">`
            : `<div class="vis-avatar vis-avatar-placeholder">${(vend.nombre||'?').charAt(0).toUpperCase()}</div>`}
          <div class="vis-perfil-info">
            <h2 class="vis-nombre">${vend.nombre || '—'}</h2>
            <div class="vis-meta">
              <span class="badge badge-${nivelBadge[vend.nivel] || ''}">${vend.nivel || 'Básico'}</span>
              ${vend.telefono ? `<span class="text-muted" style="font-size:0.85rem">${vend.telefono}</span>` : ''}
              ${vend.email    ? `<span class="text-muted" style="font-size:0.85rem">${vend.email}</span>`    : ''}
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top:10px" onclick="abrirFormVendedora('${vend.id}')">Editar visionaria</button>
          </div>
        </div>

        <div class="vis-stats-grid">
          ${stats.puntos        != null ? `<div class="vis-stat-card"><div class="vis-stat-val">${stats.puntos}</div><div class="vis-stat-label">Puntos</div></div>` : ''}
          <div class="vis-stat-card accent"><div class="vis-stat-val">${formatPeso(totalVentasMes)}</div><div class="vis-stat-label">Ventas del mes</div></div>
          <div class="vis-stat-card"><div class="vis-stat-val">${prendasActivas.length}</div><div class="vis-stat-label">Prendas activas</div></div>
          <div class="vis-stat-card"><div class="vis-stat-val">${prendasPrestadas.length}</div><div class="vis-stat-label">Prestadas</div></div>
          <div class="vis-stat-card"><div class="vis-stat-val">${clientas.length}</div><div class="vis-stat-label">Clientas</div></div>
          <div class="vis-stat-card"><div class="vis-stat-val">${formatPeso(vend.credito || 0)}</div><div class="vis-stat-label">Crédito</div></div>
          ${logrosCount != null ? `<div class="vis-stat-card"><div class="vis-stat-val">${logrosCount}</div><div class="vis-stat-label">Logros</div></div>` : ''}
          ${stats.matches_totales != null ? `<div class="vis-stat-card"><div class="vis-stat-val">${stats.matches_totales}</div><div class="vis-stat-label">Matches</div></div>` : ''}
        </div>

        <div class="vis-section">
          <div class="vis-section-title">Ventas del mes (${ventasMes.length})</div>
          ${!ventasMes.length
            ? '<p class="text-muted" style="padding:12px 0;font-size:0.85rem">Sin ventas este mes.</p>'
            : `<div class="table-wrap"><table class="data-table">
                <thead><tr><th>Fecha</th><th style="text-align:right">Monto</th></tr></thead>
                <tbody>${ventasMes.map(v => `<tr>
                  <td>${formatDate(v.fecha || v.created_at)}</td>
                  <td style="text-align:right;font-weight:600;color:var(--success)">${formatPeso(v.monto)}</td>
                </tr>`).join('')}</tbody>
                <tfoot><tr>
                  <td style="padding:10px 16px;font-weight:600;color:var(--text-muted)">Total</td>
                  <td style="padding:10px 16px;text-align:right;font-weight:700;font-family:'Montserrat',sans-serif;color:var(--success)">${formatPeso(totalVentasMes)}</td>
                </tr></tfoot>
              </table></div>`}
        </div>

        <div class="vis-section">
          <div class="vis-section-title">Prendas activas (${prendasActivas.length})</div>
          ${!prendasActivas.length
            ? '<p class="text-muted" style="padding:12px 0;font-size:0.85rem">Sin prendas en inventario.</p>'
            : `<div class="vis-inv-grid">${prendasActivas.map(i => {
                const p = i.prendas || {};
                const foto = p.fotos_prendas?.[0]?.url;
                return `<div class="vis-inv-card">
                  ${foto ? `<img src="${foto}" alt="">` : `<div class="vis-inv-thumb-empty">👚</div>`}
                  <div class="vis-inv-name">${p.nombre || '—'}</div>
                  <div class="vis-inv-num">${p.numero || ''}</div>
                </div>`;
              }).join('')}</div>`}
        </div>

        ${prendasPrestadas.length ? `
        <div class="vis-section">
          <div class="vis-section-title">Prendas prestadas (${prendasPrestadas.length})</div>
          <div class="vis-inv-grid">${prendasPrestadas.map(i => {
            const p = i.prendas || {};
            const foto = p.fotos_prendas?.[0]?.url;
            return `<div class="vis-inv-card vis-inv-card--prest">
              ${foto ? `<img src="${foto}" alt="">` : `<div class="vis-inv-thumb-empty">👗</div>`}
              <div class="vis-inv-name">${p.nombre || '—'}</div>
              <div class="vis-inv-num">${p.numero || ''}</div>
            </div>`;
          }).join('')}</div>
        </div>` : ''}

        <div class="vis-section">
          <div class="vis-section-title">Clientas (${clientas.length})</div>
          ${!clientas.length
            ? '<p class="text-muted" style="padding:12px 0;font-size:0.85rem">Sin clientas registradas.</p>'
            : `<div class="table-wrap"><table class="data-table">
                <thead><tr><th>Nombre</th><th>Teléfono</th></tr></thead>
                <tbody>${clientas.map(c => `<tr>
                  <td class="td-name">${c.nombre}</td>
                  <td>${c.telefono || '—'}</td>
                </tr>`).join('')}</tbody>
              </table></div>`}
        </div>
      </div>`;

  } catch (err) {
    main.innerHTML = `<div class="error-state">Error: ${err.message}<br>
      <button class="btn btn-outline" style="margin-top:12px" onclick="renderVendedoras()">← Volver</button></div>`;
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
      <h3>${v ? 'Editar visionaria' : 'Nueva visionaria'}</h3>
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
            placeholder="${v ? 'Nueva contraseña (opcional)' : 'Contraseña de acceso para la visionaria'}">
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
        <button type="submit" class="btn btn-primary">${v ? 'Guardar cambios' : 'Crear visionaria'}</button>
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
      btn.textContent = v ? 'Guardar cambios' : 'Crear visionaria';
    } else {
      showToast(id ? 'Visionaria actualizada' : 'Visionaria creada');
      closeModal();
      renderVendedoras();
    }
  });
}

async function deleteVendedora(id, nombre) {
  if (!confirm(`¿Eliminar a "${nombre}"?\nSe eliminarán también sus prendas, pedidos y clientas.`)) return;
  const { error } = await db.from('vendedoras').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Visionaria eliminada');
  renderVendedoras();
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
        <option value="">Todas las visionarias</option>
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
            <th>Nombre</th><th>Visionaria</th><th>Teléfono</th>
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
    const [ventasR, abonosR, pedidosR, vendedorasR, clientesR, prendasR, gastosR, detallesR] = await Promise.all([
      db.from('ventas').select('monto, fecha, created_at, vendedoras(nombre)'),
      db.from('abonos').select('monto, fecha, created_at'),
      db.from('pedidos').select('estado, created_at'),
      db.from('vendedoras').select('id, nombre, credito, nivel'),
      db.from('clientes').select('id, vendedora_id'),
      db.from('prendas').select('disponible, baja'),
      db.from('gastos').select('monto, mes, anio, categoria'),
      db.from('detalle_pedidos').select('precio, prendas(precio_costo, numero, marca, fecha_adquisicion), pedidos(fecha, estado)'),
    ]);

    const ventas     = ventasR.data    || [];
    const abonos     = abonosR.data    || [];
    const pedidos    = pedidosR.data   || [];
    const vendedoras = vendedorasR.data|| [];
    const clientes   = clientesR.data  || [];
    const prendas    = prendasR.data   || [];
    const gastosFin  = gastosR.data    || [];
    const detallesTodos = detallesR.data || [];
    const detalles = detallesTodos.filter(d => d.pedidos?.estado === 'Pagado' || d.pedidos?.estado === 'Entregado');

    // Margen por prefijo de categoría
    const PREFIJOS_CAT = { SAL: 'Saldo', RAC: 'Rack calidad', JOY: 'Joyería', INT: 'Interior' };
    const margenCat = {};
    Object.keys(PREFIJOS_CAT).forEach(p => { margenCat[p] = { total: 0, count: 0 }; });
    detalles.forEach(d => {
      if (!d.prendas) return;
      const pf = (d.prendas.numero || '').slice(0, 3).toUpperCase();
      if (!margenCat[pf]) return;
      const pv = +d.precio || 0; const pc = +d.prendas.precio_costo || 0;
      if (pv <= 0) return;
      margenCat[pf].total += (pv - pc) / pv * 100;
      margenCat[pf].count++;
    });

    // Top marcas por margen
    const margenMarca = {};
    detalles.forEach(d => {
      if (!d.prendas?.marca) return;
      const pv = +d.precio || 0; const pc = +d.prendas.precio_costo || 0;
      if (pv <= 0) return;
      const m = d.prendas.marca;
      if (!margenMarca[m]) margenMarca[m] = { total: 0, count: 0 };
      margenMarca[m].total += (pv - pc) / pv * 100;
      margenMarca[m].count++;
    });
    const topMarcas = Object.entries(margenMarca)
      .map(([m, d]) => ({ marca: m, margen: d.total / d.count, count: d.count }))
      .sort((a, b) => b.margen - a.margen).slice(0, 5);

    // Rotación por categoría
    const rotCat = {};
    Object.keys(PREFIJOS_CAT).forEach(p => { rotCat[p] = { total: 0, count: 0 }; });
    detalles.forEach(d => {
      if (!d.prendas?.fecha_adquisicion || !d.pedidos?.fecha) return;
      const pf = (d.prendas.numero || '').slice(0, 3).toUpperCase();
      if (!rotCat[pf]) return;
      const dias = Math.max(0, Math.round((new Date(d.pedidos.fecha) - new Date(d.prendas.fecha_adquisicion)) / 86400000));
      rotCat[pf].total += dias; rotCat[pf].count++;
    });
    const maxMargen = Math.max(...Object.values(margenCat).map(d => d.count > 0 ? d.total / d.count : 0), 1);

    const totalVentas  = ventas.reduce((s, v) => s + (v.monto || 0), 0);
    const totalAbonos  = abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const porCobrar    = Math.max(0, totalVentas - totalAbonos);

    const now       = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ventasMes = ventas.filter(v => (v.fecha || v.created_at || '').slice(0, 7) === mesActual);
    const abonosMes = abonos.filter(a => (a.fecha || a.created_at || '').slice(0, 7) === mesActual);
    const totalVentasMes  = ventasMes.reduce((s, v) => s + (v.monto || 0), 0);
    const totalAbonosMes  = abonosMes.reduce((s, a) => s + (a.monto || 0), 0);

    const mesNum  = now.getMonth() + 1;
    const anioNum = now.getFullYear();
    const gastosMesArr       = gastosFin.filter(g => g.mes === mesNum && g.anio === anioNum);
    const totalGastosMes     = gastosMesArr.reduce((s, g) => s + (+g.monto || 0), 0);
    const totalGastosHistorico = gastosFin.reduce((s, g) => s + (+g.monto || 0), 0);
    const utilidadNeta       = totalVentasMes - totalGastosMes;

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

      <!-- KPIs gastos -->
      <div class="fin-grid fin-grid-3">
        <div class="kpi-card kpi-danger">
          <div class="kpi-label">Gastos del mes</div>
          <div class="kpi-value">${formatPeso(totalGastosMes)}</div>
          <div class="kpi-sub">${gastosMesArr.length} gastos registrados</div>
        </div>
        <div class="kpi-card ${utilidadNeta >= 0 ? 'kpi-accent' : 'kpi-warning'}">
          <div class="kpi-label">Utilidad neta del mes</div>
          <div class="kpi-value">${formatPeso(utilidadNeta)}</div>
          <div class="kpi-sub">Ventas − Gastos</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Gastos históricos</div>
          <div class="kpi-value">${formatPeso(totalGastosHistorico)}</div>
          <div class="kpi-sub">${gastosFin.length} registros totales</div>
        </div>
      </div>

      <!-- KPIs secundarios -->
      <div class="fin-grid fin-grid-3">
        <div class="kpi-card">
          <div class="kpi-label">Visionarias</div>
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
          <h3 class="fin-card-title">Top visionarias por ventas</h3>
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
      </div>

      <!-- Rentabilidad -->
      <div class="fin-section-divider">Rentabilidad</div>
      <div class="fin-row">
        <div class="fin-card">
          <h3 class="fin-card-title">Margen promedio por categoría</h3>
          <div style="display:flex;flex-direction:column;gap:14px">
            ${Object.entries(PREFIJOS_CAT).map(([pf, label]) => {
              const d   = margenCat[pf];
              const avg = d.count > 0 ? d.total / d.count : 0;
              const pct = maxMargen > 0 ? avg / maxMargen * 100 : 0;
              const color = avg >= 40 ? '#22c55e' : avg >= 20 ? '#DEFF00' : '#855AA2';
              return `<div class="rent-bar-row">
                <div class="rent-bar-label">
                  <span>${label}</span>
                  <span class="rent-bar-pct" style="color:${color}">${avg.toFixed(1)}%</span>
                </div>
                <div class="rent-bar-track">
                  <div class="rent-bar-fill" style="width:${Math.min(100,pct)}%;background:${color}"></div>
                </div>
                <span class="text-muted" style="font-size:0.72rem">${d.count} vtas.</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="fin-card">
          <h3 class="fin-card-title">Marcas más rentables</h3>
          ${!topMarcas.length
            ? '<p class="text-muted">Sin datos todavía.</p>'
            : topMarcas.map((m, i) => `
              <div class="rank-row" style="gap:8px">
                <span class="rank-num">${i+1}</span>
                <span class="rank-name">${m.marca}</span>
                <span class="rent-margen-badge">${m.margen.toFixed(1)}%</span>
                <span class="text-muted" style="font-size:0.73rem;margin-left:auto">${m.count} vtas.</span>
              </div>`).join('')}
        </div>
      </div>

      <div class="fin-card" style="margin-top:16px">
        <h3 class="fin-card-title">Rotación de inventario — días promedio entre adquisición y venta</h3>
        <div class="rot-grid">
          ${Object.entries(PREFIJOS_CAT).map(([pf, label]) => {
            const d   = rotCat[pf];
            const avg = d.count > 0 ? Math.round(d.total / d.count) : null;
            const color = avg != null ? (avg <= 14 ? '#22c55e' : avg <= 30 ? '#DEFF00' : '#855AA2') : null;
            return `<div class="rot-card">
              <div class="rot-dias" style="${color ? `color:${color}` : ''}">${avg != null ? avg : '—'}</div>
              <div class="rot-sub">${avg != null ? 'días promedio' : 'sin datos'}</div>
              <div class="rot-cat">${label}</div>
              ${d.count > 0 ? `<div class="rot-count">${d.count} prendas</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`;

  } catch (err) {
    main.innerHTML = `<div class="error-state">Error al cargar datos: ${err.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: DEVOLUCIONES
// ══════════════════════════════════════════════════════════════════════════════
let _devFiltro = 'Pendiente';
const _devCache = new Map();

async function renderDevoluciones() {
  const main = document.getElementById('sectionContent');
  main.innerHTML = `
    <div class="section-toolbar">
      <div class="filter-tabs" id="devTabs">
        <button class="filter-tab active" data-filtro="Pendiente">Pendientes</button>
        <button class="filter-tab" data-filtro="Aprobada">Aprobadas</button>
        <button class="filter-tab" data-filtro="Rechazada">Rechazadas</button>
        <button class="filter-tab" data-filtro="todas">Todas</button>
      </div>
    </div>
    <div id="devStats" class="stats-row"></div>
    <div id="devList"></div>`;

  document.querySelectorAll('#devTabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _devFiltro = tab.dataset.filtro;
      document.querySelectorAll('#devTabs .filter-tab').forEach(t =>
        t.classList.toggle('active', t === tab)
      );
      loadDevoluciones();
    });
  });

  await loadDevoluciones();
}

async function loadDevoluciones() {
  const listEl = document.getElementById('devList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    let q = db.from('devoluciones')
      .select('*, vendedoras(id, nombre, telefono), prendas(id, nombre, precio_costo)')
      .order('created_at', { ascending: false });

    if (_devFiltro !== 'todas') q = q.eq('estado', _devFiltro);

    const { data: devs, error } = await q;
    if (error) throw error;

    _devCache.clear();
    devs.forEach(d => _devCache.set(d.id, d));

    const statsEl = document.getElementById('devStats');
    const pendientes = devs.filter(d => d.estado === 'Pendiente').length;
    const aprobadas  = devs.filter(d => d.estado === 'Aprobada').length;
    const rechazadas = devs.filter(d => d.estado === 'Rechazada').length;
    statsEl.innerHTML = `
      <div class="stat-chip accent"><span class="stat-num">${devs.length}</span><span class="stat-label">Total</span></div>
      <div class="stat-chip warning"><span class="stat-num">${pendientes}</span><span class="stat-label">Pendientes</span></div>
      <div class="stat-chip"><span class="stat-num">${aprobadas}</span><span class="stat-label">Aprobadas</span></div>
      <div class="stat-chip muted"><span class="stat-num">${rechazadas}</span><span class="stat-label">Rechazadas</span></div>`;

    if (!devs.length) {
      listEl.innerHTML = '<div class="empty-state">No hay devoluciones que mostrar.</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Visionaria</th><th>ID Prenda</th><th>Prenda</th>
            <th>Motivo</th><th>Fecha</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>
            ${devs.map(d => {
              const isPendiente = d.estado === 'Pendiente';
              const badgeClass  = d.estado === 'Aprobada' ? 'success' : d.estado === 'Rechazada' ? 'danger' : 'warning';
              return `<tr>
                <td class="td-name">${d.vendedoras?.nombre || '—'}</td>
                <td><span class="id-badge">${formatZtId(d.prenda_id)}</span></td>
                <td>${d.prendas?.nombre || '—'}</td>
                <td>${d.motivo || '—'}</td>
                <td>${formatDate(d.created_at)}</td>
                <td><span class="badge badge-${badgeClass}">${d.estado || '—'}</span></td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-outline" onclick="contactarVendedora('${d.id}')">
                    WhatsApp
                  </button>
                  ${isPendiente ? `
                  <button class="btn btn-sm btn-primary" onclick="aprobarDevolucion('${d.id}')">
                    Aprobar
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="rechazarDevolucion('${d.id}')">
                    Rechazar
                  </button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error al cargar devoluciones: ${err.message}</div>`;
  }
}

function contactarVendedora(devId) {
  const dev = _devCache.get(devId);
  if (!dev) return;
  const telefono = dev.vendedoras?.telefono;
  if (!telefono) { showToast('Esta visionaria no tiene teléfono registrado', 'error'); return; }
  const numero   = telefono.replace(/\D/g, '');
  const prenda   = dev.prendas?.nombre || 'la prenda';
  const msg      = encodeURIComponent(
    `Hola ${dev.vendedoras?.nombre || ''}, te contactamos de ZETINA para coordinar la devolución de "${prenda}". ¿Puedes enviárnosla? Te decimos la dirección de envío. ¡Gracias!`
  );
  const destino = numero.startsWith('52') ? numero : `52${numero}`;
  window.open(`https://wa.me/${destino}?text=${msg}`, '_blank');
}

async function aprobarDevolucion(devId) {
  const dev = _devCache.get(devId);
  if (!dev) return;
  const nombrePrenda = dev.prendas?.nombre || 'esta prenda';
  const costo        = dev.prendas?.precio_costo || 0;
  if (!confirm(`¿Aprobar la devolución de "${nombrePrenda}"?\nSe acreditarán ${formatPeso(costo)} a la vendedora.`)) return;

  try {
    const { error: e1 } = await db.from('devoluciones')
      .update({ estado: 'Aprobada' }).eq('id', devId);
    if (e1) throw e1;

    const { error: e2 } = await db.from('prendas')
      .update({ disponible: true, baja: false }).eq('id', dev.prenda_id);
    if (e2) throw e2;

    const { error: e3 } = await db.from('inventario_vendedoras')
      .delete().eq('prenda_id', dev.prenda_id);
    if (e3) throw e3;

    const { data: vend, error: e4 } = await db.from('vendedoras')
      .select('credito').eq('id', dev.vendedora_id).single();
    if (e4) throw e4;

    const { error: e5 } = await db.from('vendedoras')
      .update({ credito: (vend.credito || 0) + costo }).eq('id', dev.vendedora_id);
    if (e5) throw e5;

    showToast(`Devolución aprobada. Se acreditaron ${formatPeso(costo)} a la vendedora.`);
    loadDevoluciones();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function rechazarDevolucion(devId) {
  const dev = _devCache.get(devId);
  if (!dev) return;
  const nombrePrenda = dev.prendas?.nombre || 'esta prenda';
  if (!confirm(`¿Rechazar la devolución de "${nombrePrenda}"?\nLa prenda no regresará al inventario.`)) return;

  try {
    const { error } = await db.from('devoluciones')
      .update({ estado: 'Rechazada' }).eq('id', devId);
    if (error) throw error;
    showToast('Devolución rechazada.');
    loadDevoluciones();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: GASTOS
// ══════════════════════════════════════════════════════════════════════════════
let _gastosFilter = {};

async function renderGastos() {
  const now = new Date();
  if (!_gastosFilter.mes) {
    _gastosFilter = { mes: now.getMonth() + 1, anio: now.getFullYear(), categoria: '' };
  }
  const main = document.getElementById('sectionContent');
  const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesesOpts = mesesNombres.map((m, i) =>
    `<option value="${i+1}" ${_gastosFilter.mes === i+1 ? 'selected' : ''}>${m}</option>`).join('');
  const aniosOpts = [now.getFullYear()-1, now.getFullYear()]
    .map(y => `<option value="${y}" ${_gastosFilter.anio === y ? 'selected' : ''}>${y}</option>`).join('');
  const catOpts = CATEGORIAS_GASTOS.flatMap(g => g.items)
    .map(c => `<option value="${c}" ${_gastosFilter.categoria === c ? 'selected' : ''}>${c}</option>`).join('');

  main.innerHTML = `
    <div id="gastosStats" class="stats-row"></div>
    <div class="section-toolbar">
      <div class="gastos-filtros">
        <select id="gastosMesFilt" class="select-filter">${mesesOpts}</select>
        <select id="gastosAnioFilt" class="select-filter">${aniosOpts}</select>
        <select id="gastosCatFilt" class="select-filter">
          <option value="" ${!_gastosFilter.categoria ? 'selected' : ''}>Todas las categorías</option>
          ${catOpts}
        </select>
      </div>
      <button class="btn btn-primary" id="btnAbrirGasto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px;flex-shrink:0"><path d="M12 5v14M5 12h14"/></svg>
        Registrar gasto
      </button>
    </div>
    <div id="gastosListEl"></div>
    <div class="gastos-subcats-section">
      <div class="gastos-subcats-title">Subcategorías de Insumos</div>
      <div id="gastosSubcatsEl"><div class="table-loading">Cargando…</div></div>
    </div>`;

  document.getElementById('btnAbrirGasto').addEventListener('click', abrirModalGasto);
  ['gastosMesFilt','gastosAnioFilt','gastosCatFilt'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      _gastosFilter.mes       = +document.getElementById('gastosMesFilt').value;
      _gastosFilter.anio      = +document.getElementById('gastosAnioFilt').value;
      _gastosFilter.categoria =  document.getElementById('gastosCatFilt').value;
      _loadGastosLista();
      _loadGastosStats();
    });
  });

  await Promise.all([_loadGastosLista(), _loadGastosStats(), _loadSubcatsInsumos()]);
}

async function _loadGastosStats() {
  const statsEl = document.getElementById('gastosStats');
  if (!statsEl) return;

  const [{ data: gastosMesD }, { data: gastosAll }] = await Promise.all([
    db.from('gastos').select('monto, categoria').eq('mes', _gastosFilter.mes).eq('anio', _gastosFilter.anio),
    db.from('gastos').select('monto'),
  ]);

  const totalMes       = (gastosMesD || []).reduce((s, g) => s + (+g.monto || 0), 0);
  const totalHistorico = (gastosAll  || []).reduce((s, g) => s + (+g.monto || 0), 0);

  const desglose = {};
  (gastosMesD || []).forEach(g => { desglose[g.categoria] = (desglose[g.categoria] || 0) + (+g.monto || 0); });
  const topCats = Object.entries(desglose).sort((a, b) => b[1] - a[1]).slice(0, 4);

  statsEl.innerHTML = `
    <div class="stat-chip accent">
      <span class="stat-num">${formatPeso(totalMes)}</span>
      <span class="stat-label">Gastos del período</span>
    </div>
    <div class="stat-chip muted">
      <span class="stat-num">${formatPeso(totalHistorico)}</span>
      <span class="stat-label">Total histórico</span>
    </div>
    ${topCats.map(([cat, monto]) => `
    <div class="stat-chip warning">
      <span class="stat-num" style="font-size:0.88rem">${formatPeso(monto)}</span>
      <span class="stat-label">${cat}</span>
    </div>`).join('')}`;
}

async function _loadGastosLista() {
  const listEl = document.getElementById('gastosListEl');
  if (!listEl) return;
  listEl.innerHTML = '<div class="table-loading">Cargando…</div>';

  try {
    let q = db.from('gastos')
      .select('id, categoria, subcategoria, descripcion, monto, fecha')
      .eq('mes', _gastosFilter.mes)
      .eq('anio', _gastosFilter.anio)
      .order('fecha', { ascending: false });
    if (_gastosFilter.categoria) q = q.eq('categoria', _gastosFilter.categoria);

    const { data: gastos, error } = await q;
    if (error) throw error;

    if (!(gastos || []).length) {
      listEl.innerHTML = '<div class="empty-state">No hay gastos registrados para este período.</div>';
      return;
    }

    const total = gastos.reduce((s, g) => s + (+g.monto || 0), 0);

    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Fecha</th><th>Categoría</th><th>Subcategoría</th>
            <th>Descripción</th><th style="text-align:right">Monto</th><th></th>
          </tr></thead>
          <tbody>
            ${gastos.map(g => `<tr>
              <td style="white-space:nowrap">${formatDate(g.fecha)}</td>
              <td><span class="gasto-cat-badge">${escHtml(g.categoria)}</span></td>
              <td style="color:var(--text-muted);font-size:0.83rem">${g.subcategoria ? escHtml(g.subcategoria) : '—'}</td>
              <td class="td-desc-gasto">${g.descripcion ? escHtml(g.descripcion) : '<span class="text-muted">—</span>'}</td>
              <td style="text-align:right;font-weight:600;color:var(--danger);white-space:nowrap">${formatPeso(g.monto)}</td>
              <td><button class="btn-icon btn-danger" title="Eliminar" onclick="deleteGasto('${g.id}')">🗑</button></td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="gastos-tfoot-row">
              <td colspan="4">Total del período</td>
              <td style="text-align:right">${formatPeso(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  } catch (err) {
    listEl.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
  }
}

async function abrirModalGasto() {
  const { data: subcats } = await db.from('subcategorias_insumos').select('id, nombre').order('nombre');
  const subcatsList = subcats || [];
  const today = new Date().toISOString().split('T')[0];

  const catOptgroups = CATEGORIAS_GASTOS.map(grupo =>
    `<optgroup label="${grupo.grupo}">${grupo.items.map(item =>
      `<option value="${item}">${item}</option>`).join('')}</optgroup>`
  ).join('');

  const subcatsOpts = subcatsList.map(s =>
    `<option value="${s.nombre}">${s.nombre}</option>`).join('');

  openModal(`
    <div class="modal-header">
      <h3>Registrar gasto</h3>
    </div>
    <form id="gastoForm" class="modal-form">
      <div class="form-group">
        <label>Categoría *</label>
        <select id="gCategoria" required>
          <option value="">Selecciona una categoría</option>
          ${catOptgroups}
        </select>
      </div>
      <div id="gSubcatWrap" class="hidden">
        <div class="form-group" style="margin-top:4px">
          <label>Subcategoría de insumo</label>
          <select id="gSubcategoria">
            <option value="">Sin subcategoría</option>
            ${subcatsOpts}
            <option value="__nueva__">＋ Nueva subcategoría</option>
          </select>
          <div id="gSubcatNuevaWrap" class="cat-nueva-inline hidden">
            <input type="text" id="gSubcatNuevaInput" placeholder="Nombre de la subcategoría…" maxlength="60">
            <button type="button" id="gSubcatNuevaBtn" class="btn-cat-add">Agregar</button>
            <button type="button" id="gSubcatNuevaCancelar" class="btn-cat-cancel">✕</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <input type="text" id="gDescripcion" placeholder="Detalle del gasto (opcional)…" maxlength="200">
      </div>
      <div class="form-grid form-grid-2">
        <div class="form-group">
          <label>Monto *</label>
          <div class="input-prefix">
            <span>$</span>
            <input type="number" id="gMonto" min="0.01" step="0.01" placeholder="0.00" required>
          </div>
        </div>
        <div class="form-group">
          <label>Fecha *</label>
          <input type="date" id="gFecha" value="${today}" required>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="gastoSubmitBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px;flex-shrink:0"><path d="M5 12l5 5L20 7"/></svg>
          Guardar gasto
        </button>
      </div>
    </form>`);

  document.getElementById('gCategoria').addEventListener('change', e => {
    document.getElementById('gSubcatWrap').classList.toggle('hidden', e.target.value !== 'Insumos');
    if (e.target.value !== 'Insumos') document.getElementById('gSubcategoria').value = '';
  });
  bindCatNuevaForm('gSubcategoria', 'gSubcatNuevaWrap', 'gSubcatNuevaInput', 'gSubcatNuevaBtn', 'gSubcatNuevaCancelar', 'subcategorias_insumos');
  document.getElementById('gastoForm').addEventListener('submit', _handleGastoSubmit);
}

async function _handleGastoSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('gastoSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const fechaVal  = document.getElementById('gFecha').value;
    const fechaDate = new Date(fechaVal + 'T12:00:00');
    const categoria = document.getElementById('gCategoria').value;
    const subcatEl  = document.getElementById('gSubcategoria');
    const subcatVal = subcatEl?.value;

    const payload = {
      categoria,
      subcategoria:  (categoria === 'Insumos' && subcatVal && subcatVal !== '__nueva__') ? subcatVal : null,
      descripcion:   document.getElementById('gDescripcion').value.trim() || null,
      monto:         parseFloat(document.getElementById('gMonto').value) || 0,
      fecha:         new Date(fechaVal + 'T12:00:00').toISOString(),
      mes:           fechaDate.getMonth() + 1,
      anio:          fechaDate.getFullYear(),
    };

    const { error } = await db.from('gastos').insert(payload);
    if (error) throw error;

    closeModal();
    showToast('Gasto registrado correctamente.');
    _gastosFilter.mes  = payload.mes;
    _gastosFilter.anio = payload.anio;
    await Promise.all([_loadGastosLista(), _loadGastosStats()]);

  } catch (err) {
    showToast(err.message || 'Error al guardar el gasto', 'error');
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:15px;height:15px;flex-shrink:0"><path d="M5 12l5 5L20 7"/></svg> Guardar gasto`;
  }
}

async function deleteGasto(id) {
  if (!confirm('¿Eliminar este gasto?')) return;
  const { error } = await db.from('gastos').delete().eq('id', id);
  if (error) { showToast(error.message, 'error'); return; }
  showToast('Gasto eliminado');
  await Promise.all([_loadGastosLista(), _loadGastosStats()]);
}

async function _loadSubcatsInsumos() {
  const el = document.getElementById('gastosSubcatsEl');
  if (!el) return;

  const { data: subcats, error } = await db.from('subcategorias_insumos').select('id, nombre').order('nombre');
  if (error) { el.innerHTML = `<div class="error-state">Error: ${error.message}</div>`; return; }

  el.innerHTML = `
    <div class="cats-add-row">
      <input type="text" id="subcatNewInput" class="cat-text-input" placeholder="Nueva subcategoría de insumo…" maxlength="60">
      <button class="btn btn-primary btn-sm" id="subcatAddBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;flex-shrink:0"><path d="M12 5v14M5 12h14"/></svg>
        Agregar
      </button>
    </div>
    <div class="cats-list">
      ${!(subcats || []).length
        ? '<p class="text-muted" style="padding:16px 20px;font-size:0.85rem">No hay subcategorías todavía.</p>'
        : (subcats || []).map(s => `
          <div class="cat-item" data-id="${s.id}" data-nombre="${escHtml(s.nombre)}">
            <div class="cat-item-view">
              <span class="cat-item-name">${escHtml(s.nombre)}</span>
              <div class="cat-item-actions">
                <button class="btn-sm btn-danger subcat-del-btn">Eliminar</button>
              </div>
            </div>
          </div>`).join('')}
    </div>`;

  document.getElementById('subcatAddBtn').addEventListener('click', _agregarSubcat);
  document.getElementById('subcatNewInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') _agregarSubcat();
  });
  document.querySelectorAll('.subcat-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item   = btn.closest('.cat-item');
      const nombre = item.dataset.nombre;
      const id     = item.dataset.id;
      if (!confirm(`¿Eliminar la subcategoría "${nombre}"?`)) return;
      btn.disabled = true;
      const { error } = await db.from('subcategorias_insumos').delete().eq('id', id);
      if (error) { showToast(error.message, 'error'); btn.disabled = false; return; }
      showToast(`"${nombre}" eliminada`);
      await _loadSubcatsInsumos();
    });
  });
}

async function _agregarSubcat() {
  const input  = document.getElementById('subcatNewInput');
  const nombre = (input?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre para la subcategoría', 'info'); input?.focus(); return; }
  const btn = document.getElementById('subcatAddBtn');
  btn.disabled = true;
  const { error } = await db.from('subcategorias_insumos').insert({ nombre });
  btn.disabled = false;
  if (error) {
    showToast(
      (error.message.includes('duplicate') || error.message.includes('unique')) ? 'Esa subcategoría ya existe' : error.message,
      'error'
    );
    return;
  }
  input.value = '';
  showToast(`Subcategoría "${nombre}" agregada`);
  await _loadSubcatsInsumos();
}

// ══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN: CATEGORÍAS
// ══════════════════════════════════════════════════════════════════════════════
async function renderCategorias() {
  document.getElementById('sectionContent').innerHTML = '<div class="table-loading">Cargando categorías…</div>';
  await _loadCategoriasSection();
}

async function _loadCategoriasSection() {
  const main = document.getElementById('sectionContent');
  try {
    const { data: cats, error } = await db.from('categorias_prendas').select('id, nombre').order('nombre');
    if (error) throw error;

    main.innerHTML = `
      <div class="cats-container">
        <div class="cats-add-row">
          <input type="text" id="catNewInput" class="cat-text-input" placeholder="Nueva categoría…" maxlength="60">
          <button class="btn btn-primary btn-sm" id="catAddBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;flex-shrink:0">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Agregar
          </button>
        </div>
        <div class="cats-list" id="catsList">
          ${!(cats || []).length
            ? '<p class="text-muted" style="padding:20px">No hay categorías. Agrega la primera arriba.</p>'
            : (cats || []).map(_catItemHtml).join('')}
        </div>
      </div>`;

    document.getElementById('catAddBtn').addEventListener('click', _agregarCat);
    document.getElementById('catNewInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') _agregarCat();
    });
    _bindCatListActions();

  } catch (err) {
    if (err.message && err.message.includes('does not exist')) {
      main.innerHTML = `<div class="error-state" style="font-size:0.875rem">
        <p>La tabla <strong>categorias_prendas</strong> no existe en la base de datos.</p>
        <p style="margin-top:8px;color:var(--text-muted)">Ejecuta la migración SQL en Supabase → SQL Editor para crearla.</p>
      </div>`;
    } else {
      main.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
    }
  }
}

function _catItemHtml(cat) {
  return `
    <div class="cat-item" data-id="${cat.id}" data-nombre="${escHtml(cat.nombre)}">
      <div class="cat-item-view">
        <span class="cat-item-name">${escHtml(cat.nombre)}</span>
        <div class="cat-item-actions">
          <button class="btn-sm btn-outline cat-edit-btn">Editar</button>
          <button class="btn-sm btn-danger cat-del-btn">Eliminar</button>
        </div>
      </div>
      <div class="cat-item-edit hidden">
        <input type="text" class="cat-edit-input cat-text-input" value="${escHtml(cat.nombre)}" maxlength="60">
        <button class="btn-sm btn-primary cat-save-btn">Guardar</button>
        <button class="btn-sm btn-outline cat-cancel-btn">Cancelar</button>
      </div>
    </div>`;
}

function _bindCatListActions() {
  document.querySelectorAll('.cat-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.cat-item');
      item.querySelector('.cat-item-view').classList.add('hidden');
      item.querySelector('.cat-item-edit').classList.remove('hidden');
      item.querySelector('.cat-edit-input').focus();
    });
  });

  document.querySelectorAll('.cat-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.cat-item');
      item.querySelector('.cat-edit-input').value = item.dataset.nombre;
      item.querySelector('.cat-item-view').classList.remove('hidden');
      item.querySelector('.cat-item-edit').classList.add('hidden');
    });
  });

  document.querySelectorAll('.cat-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.cat-item');
      const id = item.dataset.id;
      const nuevoNombre = item.querySelector('.cat-edit-input').value.trim();
      if (!nuevoNombre) { showToast('El nombre no puede estar vacío', 'error'); return; }

      btn.disabled = true;
      btn.textContent = '…';

      const { error } = await db.from('categorias_prendas').update({ nombre: nuevoNombre }).eq('id', id);
      if (error) {
        showToast(
          (error.message.includes('duplicate') || error.message.includes('unique'))
            ? 'Esa categoría ya existe'
            : error.message,
          'error'
        );
        btn.disabled = false;
        btn.textContent = 'Guardar';
        return;
      }

      showToast('Categoría actualizada');
      await _loadCategoriasSection();
    });
  });

  document.querySelectorAll('.cat-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.cat-item');
      const id = item.dataset.id;
      const nombre = item.dataset.nombre;

      btn.disabled = true;
      const { count, error: cntErr } = await db
        .from('prendas')
        .select('*', { count: 'exact', head: true })
        .eq('categoria', nombre);
      btn.disabled = false;

      if (cntErr) { showToast(cntErr.message, 'error'); return; }

      if (count > 0) {
        showToast(
          `No se puede eliminar: ${count} prenda${count > 1 ? 's' : ''} usa${count > 1 ? 'n' : ''} esta categoría`,
          'error'
        );
        return;
      }

      if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;

      btn.disabled = true;
      const { error } = await db.from('categorias_prendas').delete().eq('id', id);
      if (error) { showToast(error.message, 'error'); btn.disabled = false; return; }

      showToast(`Categoría "${nombre}" eliminada`);
      await _loadCategoriasSection();
    });
  });
}

async function _agregarCat() {
  const input = document.getElementById('catNewInput');
  const nombre = (input?.value || '').trim();
  if (!nombre) { showToast('Escribe un nombre para la categoría', 'info'); input?.focus(); return; }

  const btn = document.getElementById('catAddBtn');
  btn.disabled = true;

  const { error } = await db.from('categorias_prendas').insert({ nombre });
  btn.disabled = false;

  if (error) {
    showToast(
      (error.message.includes('duplicate') || error.message.includes('unique'))
        ? 'Esa categoría ya existe'
        : error.message,
      'error'
    );
    return;
  }

  input.value = '';
  showToast(`Categoría "${nombre}" agregada`);
  await _loadCategoriasSection();
}

// ── Helpers internos ──────────────────────────────────────────────────────────
function escQ(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseDesc(json) {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTO-REFRESH: Supabase Realtime
// ══════════════════════════════════════════════════════════════════════════════
const _TABLE_SECTION_MAP = {
  prendas:               ['inventario', 'financiero'],
  fotos_prendas:         ['inventario'],
  detalle_pedidos:       ['inventario', 'pedidos', 'financiero'],
  pedidos:               ['pedidos', 'financiero'],
  vendedoras:            ['vendedoras', 'financiero'],
  inventario_vendedoras: ['vendedoras'],
  clientes:              ['clientes', 'vendedoras', 'financiero'],
  devoluciones:          ['devoluciones'],
  gastos:                ['gastos', 'financiero'],
  ventas:                ['financiero', 'vendedoras'],
  abonos:                ['financiero'],
  visionaria_stats:      ['vendedoras'],
};

const _SECTION_RELOAD = {
  inventario:   () => loadInventario(),
  pedidos:      () => loadPedidos(),
  vendedoras:   () => { if (!document.querySelector('.vis-back-btn')) renderVendedoras(); },
  clientes:     () => loadClientes(),
  devoluciones: () => loadDevoluciones(),
  gastos:       () => Promise.all([_loadGastosLista(), _loadGastosStats()]),
  financiero:   () => renderFinanciero(),
};

let _realtimeDebounce;

function _onRealtimeChange(table) {
  const sections = _TABLE_SECTION_MAP[table] || [];
  if (!sections.includes(_currentSection)) return;
  clearTimeout(_realtimeDebounce);
  _realtimeDebounce = setTimeout(() => {
    const fn = _SECTION_RELOAD[_currentSection];
    if (fn) {
      fn();
      showToast('Datos actualizados', 'realtime');
    }
  }, 1200);
}

function initRealtimeAutoRefresh() {
  let ch = db.channel('admin-auto-refresh');
  Object.keys(_TABLE_SECTION_MAP).forEach(table => {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => _onRealtimeChange(table));
  });
  ch.subscribe();
}

function manualRefresh() {
  const btn = document.getElementById('refreshBtn');
  if (btn) {
    btn.classList.remove('spinning');
    void btn.offsetWidth; // reflow para reiniciar animación
    btn.classList.add('spinning');
    btn.addEventListener('animationend', () => btn.classList.remove('spinning'), { once: true });
  }
  const fn = _SECTION_RELOAD[_currentSection];
  if (fn) fn();
}

// ══════════════════════════════════════════════════════════════════════════════
//  BADGE PEDIDOS NUEVOS
// ══════════════════════════════════════════════════════════════════════════════
function updatePedidosBadge(count) {
  const badge = document.getElementById('pedidosBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function initPedidosRealtime() {
  const { count } = await db
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'En proceso');
  updatePedidosBadge(count || 0);

  db.channel('pedidos-nuevos')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, async () => {
      if (location.hash === '#pedidos') return;
      const { count: n } = await db
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'En proceso');
      updatePedidosBadge(n || 0);
    })
    .subscribe();
}

// ══════════════════════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('input', function(e) {
  if (e.target.id === 'fPrecioMin' || e.target.id === 'fNumero') {
    calcularPreciosAuto();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initPedidosRealtime();
  initRealtimeAutoRefresh();

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
