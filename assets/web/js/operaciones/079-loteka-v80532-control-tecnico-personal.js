(function (global) {
  'use strict';

  if (global.GOControlTecnico && global.GOControlTecnico.version === '807.00') return;

  const VERSION = '807.00';
  const TABLE = 'control_tecnico_personal';
  const PAGE_SIZES = [10, 20, 50];
  const MAX_EVIDENCE_FILES = 12;
  const MAX_EVIDENCE_BYTES = 15 * 1024 * 1024;

  const STATES = [
    'PENDIENTE', 'POR_VERIFICAR', 'EN_COORDINACION', 'PROGRAMADO', 'EN_PROCESO',
    'FALTA_EQUIPO', 'REQUIERE_CAMBIO', 'REQUIERE_NUEVA_VISITA', 'RESUELTO',
    'NO_REALIZADO', 'ARCHIVADO'
  ];

  const STATE_LABEL = {
    PENDIENTE: 'Pendiente',
    POR_VERIFICAR: 'Por verificar',
    EN_COORDINACION: 'En coordinación',
    PROGRAMADO: 'Programado',
    EN_PROCESO: 'En proceso',
    FALTA_EQUIPO: 'Falta equipo',
    REQUIERE_CAMBIO: 'Requiere cambio',
    REQUIERE_NUEVA_VISITA: 'Requiere nueva visita',
    RESUELTO: 'Resuelto',
    NO_REALIZADO: 'No realizado',
    ARCHIVADO: 'Archivado'
  };

  const CAT_LABEL = {
    INSTALACION: 'Instalación pendiente',
    AVERIA_CAMARA: 'Avería de cámara',
    OTRO: 'Otro seguimiento'
  };

  const CATEGORY_DEFAULT_SUBJECT = {
    INSTALACION: 'Instalación pendiente',
    AVERIA_CAMARA: 'Avería de cámara pendiente',
    OTRO: 'Seguimiento técnico pendiente'
  };

  const state = {
    ready: false,
    items: [],
    filtered: [],
    page: 1,
    pageSize: 10,
    editing: null,
    importRows: [],
    importCategory: null,
    activeCategory: '',
    formEvidence: [],
    pendingFiles: [],
    saving: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = (value) => String(value == null ? '' : value).trim();
  const esc = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const padAgency = (value) => {
    const digits = text(value).replace(/\D/g, '');
    return digits ? (digits.length < 4 ? digits.padStart(4, '0') : digits) : '';
  };

  function runtime() {
    return global.GOApp && global.GOApp.__phase2aRuntime ? global.GOApp : null;
  }

  function client() {
    try {
      const appRuntime = runtime();
      const connected = appRuntime && appRuntime.supabase.getClient();
      if (connected && connected.from) return connected;
    } catch (_error) {}
    return global.lotekaSupabase || global.supabaseClient || global.__supabaseClient || null;
  }

  function toast(message, tone = 'info') {
    try {
      if (global.showToast) return global.showToast(message, tone);
    } catch (_error) {}
    (tone === 'error' ? console.error : console.log)('[Control técnico]', message);
  }

  function uuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
  }

  function agencies() {
    return (Array.isArray(global.agencias) ? global.agencias : []).filter((agency) => {
      const status = text(agency.estado || agency.estado_operativo);
      return agency.activo !== false && !/cerrad|inactiv|desactiv/i.test(status);
    });
  }

  function groups() {
    return (Array.isArray(global.grupos) ? global.grupos : []).filter((group) => {
      const label = text(group.nombre || group.codigo);
      return group.activo !== false && !/prueba|test|cerrad|desactiv/i.test(label);
    });
  }

  function agencyId(agency) {
    for (const value of [agency?.supabaseId, agency?.id_supabase, agency?.agencia_id, agency?.id]) {
      if (uuid(value)) return text(value);
    }
    return '';
  }

  function agencyNum(agency) {
    return padAgency(agency?.numero || agency?.codigo || agency?.agencia);
  }

  function agencyName(agency) {
    return text(agency?.nombre || agency?.descripcion || agency?.nombre_agencia) || `Agencia ${agencyNum(agency)}`;
  }

  function groupId(group) {
    for (const value of [group?.supabaseId, group?.id_supabase, group?.grupo_id, group?.id]) {
      if (uuid(value)) return text(value);
    }
    return '';
  }

  function groupLabel(group) {
    return text(group?.codigo || group?.nombre || group?.numero) || 'Sin grupo';
  }

  function normalizeGroupKey(value) {
    return text(value).toLowerCase().replace(/^g\s*[-:]?\s*/i, '').replace(/^0+/, '') || '0';
  }

  function agencyGroupCandidates(agency) {
    return [agency?.grupoId, agency?.grupo_id, agency?.group_id, agency?.grupo, agency?.grupo_codigo, agency?.codigo_grupo, agency?.grupoNumero]
      .map(text).filter(Boolean);
  }

  function groupFor(agency) {
    const candidates = agencyGroupCandidates(agency);
    if (!candidates.length) return null;
    return groups().find((group) => {
      const identifiers = [groupId(group), group?.id, group?.codigo, group?.nombre, group?.numero].map(text).filter(Boolean);
      return candidates.some((candidate) => identifiers.some((identifier) => (
        candidate === identifier || normalizeGroupKey(candidate) === normalizeGroupKey(identifier)
      )));
    }) || null;
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(`${String(value).slice(0, 10)}T00:00:00`));
    } catch (_error) {
      return text(value);
    }
  }

  function today() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function isResolved(item) {
    return text(item?.estado).toUpperCase() === 'RESUELTO';
  }

  function normalizeEvidence(value) {
    let list = value;
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch (_error) { list = []; }
    }
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => {
      if (typeof item === 'string') return { url: item, name: `Foto ${index + 1}`, type: 'image/*', uploaded_at: null };
      if (!item || typeof item !== 'object' || !text(item.url || item.publicUrl || item.public_url)) return null;
      return {
        url: text(item.url || item.publicUrl || item.public_url),
        name: text(item.name || item.nombre || item.filename || `Foto ${index + 1}`),
        type: text(item.type || item.mime || 'image/*'),
        uploaded_at: item.uploaded_at || item.created_at || null
      };
    }).filter(Boolean);
  }

  function badgeClass(status) {
    if (/RESUELTO/.test(status)) return 'ok';
    if (/FALTA|CAMBIO|NO_REALIZADO/.test(status)) return 'bad';
    if (/PROCESO|PROGRAMADO|COORDINACION/.test(status)) return 'run';
    return 'wait';
  }

  function injectStyles() {
    if ($('#goct-style')) return;
    const style = document.createElement('style');
    style.id = 'goct-style';
    style.textContent = `
      #goct-root{font-family:Inter,system-ui;color:#103b5b;padding-bottom:34px}.goct-hero{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:24px;border-radius:22px;border:1px solid #cde2ef;background:linear-gradient(135deg,#f7fcff,#e8f7ff);box-shadow:0 15px 34px rgba(18,73,109,.08);margin-bottom:15px}.goct-hero h2{margin:0;font-size:28px;color:#0b4166}.goct-hero p{margin:7px 0 0;color:#647f93}.goct-actions,.goct-tabs,.goct-pagination{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.goct-btn{border:1px solid #c9ddea;background:#fff;color:#086796;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;transition:.16s ease}.goct-btn:hover:not(:disabled){transform:translateY(-1px)}.goct-btn:disabled{opacity:.5;cursor:not-allowed}.goct-btn.primary{border:0;color:#fff;background:linear-gradient(135deg,#087dbb,#05a8d4)}.goct-btn.danger{color:#b42318}.goct-btn.small{padding:7px 9px;font-size:12px}.goct-tabs{background:#edf6fb;padding:5px;border-radius:13px;width:max-content;max-width:100%;margin-bottom:14px}.goct-tab{border:0;background:transparent;color:#607b8e;padding:9px 14px;border-radius:9px;font-weight:900;cursor:pointer}.goct-tab.active{background:#fff;color:#0870a4;box-shadow:0 4px 13px #aac6d655}.goct-stats{display:grid;grid-template-columns:repeat(5,minmax(125px,1fr));gap:11px;margin-bottom:14px}.goct-stat,.goct-card{background:#fff;border:1px solid #d6e5ef;border-radius:17px;padding:16px;box-shadow:0 10px 24px rgba(11,61,95,.055)}.goct-stat span{font-size:11px;color:#6b8497;font-weight:900;text-transform:uppercase}.goct-stat strong{display:block;font-size:26px;margin-top:4px;color:#0b456d}.goct-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.goct-card h3{margin:0}.goct-toolbar{display:grid;grid-template-columns:2fr repeat(3,minmax(150px,1fr)) auto;gap:10px;margin-bottom:12px}.goct-input,.goct-select,.goct-textarea{width:100%;box-sizing:border-box;border:1px solid #c8dce8;border-radius:11px;padding:10px 11px;font:inherit;background:#fff}.goct-table-wrap{overflow:auto;border:1px solid #dbe8f0;border-radius:14px}.goct-table{width:100%;border-collapse:collapse;min-width:1120px}.goct-table th,.goct-table td{padding:11px;border-bottom:1px solid #e7eff4;text-align:left;font-size:13px;vertical-align:top}.goct-table th{background:#eff8fc;color:#5e788c;font-size:11px;text-transform:uppercase;position:sticky;top:0}.goct-table tr:hover td{background:#f9fdff}.goct-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:1000}.goct-badge.ok{background:#e5f8ed;color:#087448}.goct-badge.bad{background:#fff0ef;color:#b42318}.goct-badge.run{background:#e7f5ff;color:#08689c}.goct-badge.wait{background:#fff7dc;color:#876400}.goct-empty{text-align:center;padding:35px;color:#71899a}.goct-pagination{justify-content:space-between;margin-top:12px}.goct-pages{display:flex;gap:6px;align-items:center}.goct-page{min-width:34px;height:34px;border:1px solid #d0e0e9;border-radius:9px;background:#fff;font-weight:900;cursor:pointer}.goct-page.active{background:#0786bd;color:#fff;border-color:#0786bd}.goct-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#072c4775;z-index:11000;padding:20px}.goct-modal.open{display:flex}.goct-dialog{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 80px #071c2c66}.goct-dialog.viewer{width:min(1040px,96vw)}.goct-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.goct-field.full{grid-column:1/-1}.goct-field label{display:block;font-size:11px;font-weight:1000;color:#5c7588;text-transform:uppercase;margin-bottom:6px}.goct-preview{max-height:380px;overflow:auto;border:1px solid #d8e6ef;border-radius:13px}.goct-preview-row{display:grid;grid-template-columns:95px 120px 1fr 125px;gap:8px;padding:9px 11px;border-bottom:1px solid #eaf1f5;font-size:12px}.goct-private{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#e9f8ee;color:#087449;font-weight:900;font-size:12px}.goct-help{padding:11px 13px;border-radius:12px;background:#f4f9fc;border:1px solid #d7e8f1;color:#5d788c;font-size:12px;line-height:1.5}.goct-evidence-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-top:10px}.goct-evidence-card{position:relative;border:1px solid #d4e4ed;border-radius:13px;overflow:hidden;background:#f6fbfd;min-height:125px}.goct-evidence-card img{display:block;width:100%;height:105px;object-fit:cover}.goct-evidence-card span{display:block;padding:7px 8px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goct-evidence-remove{position:absolute;right:6px;top:6px;width:28px;height:28px;border:0;border-radius:999px;background:#a61b1bea;color:#fff;cursor:pointer;font-weight:900}.goct-viewer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:13px}.goct-viewer-item{border:1px solid #d7e5ed;border-radius:14px;overflow:hidden;background:#f8fcfe}.goct-viewer-item img{display:block;width:100%;height:210px;object-fit:contain;background:#0b1d2b}.goct-viewer-item div{padding:9px;font-size:12px}.goct-upload-status{display:none;padding:10px 12px;border-radius:11px;background:#e9f7ff;color:#075f8c;font-weight:900;margin-top:10px}.goct-upload-status.show{display:block}@media(max-width:1100px){.goct-stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.goct-hero{align-items:flex-start;flex-direction:column}.goct-stats{grid-template-columns:repeat(2,1fr)}.goct-toolbar{grid-template-columns:1fr}.goct-grid{grid-template-columns:1fr}.goct-field.full{grid-column:auto}.goct-tabs{width:100%;overflow:auto;flex-wrap:nowrap}.goct-tab{white-space:nowrap}}
    `;
    document.head.appendChild(style);
  }

  function injectView() {
    const host = $('#vista-ops-control-tecnico');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.innerHTML = `
      <div id="goct-root">
        <section class="goct-hero"><div><span class="goct-private"><i class="fas fa-lock"></i> Control interno</span><h2>Control técnico</h2><p>Seguimiento de instalaciones, averías de cámaras y acciones técnicas. Los levantamientos fotográficos se administran en el módulo Levantamientos por grupo.</p></div><div class="goct-actions"><button class="goct-btn" id="goct-open-surveys"><i class="fas fa-clipboard-check"></i> Abrir Levantamientos</button><button class="goct-btn" id="goct-import"><i class="fas fa-paste"></i> Entrada rápida</button><button class="goct-btn primary" id="goct-new"><i class="fas fa-plus"></i> Nuevo registro</button></div></section>
        <div class="goct-tabs"><button class="goct-tab active" data-cat="">Todos activos</button><button class="goct-tab" data-cat="INSTALACION">Instalaciones</button><button class="goct-tab" data-cat="AVERIA_CAMARA">Averías de cámaras</button><button class="goct-tab" data-cat="RESUELTO">Resueltos</button></div>
        <div class="goct-stats"><div class="goct-stat"><span>Total activo</span><strong id="goct-s-total">0</strong></div><div class="goct-stat"><span>Pendientes</span><strong id="goct-s-pending">0</strong></div><div class="goct-stat"><span>En proceso</span><strong id="goct-s-process">0</strong></div><div class="goct-stat"><span>Falta equipo/cambio</span><strong id="goct-s-equipment">0</strong></div><div class="goct-stat"><span>Resueltos</span><strong id="goct-s-resolved">0</strong></div></div>
        <section class="goct-card"><div class="goct-card-head"><div><h3 id="goct-list-title">Seguimiento activo</h3><small id="goct-count-label">0 registros</small></div><button class="goct-btn small" id="goct-refresh"><i class="fas fa-rotate"></i> Actualizar</button></div><div class="goct-toolbar"><input class="goct-input" id="goct-search" placeholder="Buscar agencia, problema, equipo o nota"><select class="goct-select" id="goct-state"><option value="">Todos los estados</option>${STATES.map((item) => `<option value="${item}">${STATE_LABEL[item]}</option>`).join('')}</select><select class="goct-select" id="goct-group"><option value="">Todos los grupos</option></select><button class="goct-btn" id="goct-clear">Limpiar</button></div><div id="goct-table"></div><div class="goct-pagination"><div><select class="goct-select" id="goct-size" style="width:auto">${PAGE_SIZES.map((size) => `<option ${size === 10 ? 'selected' : ''}>${size}</option>`).join('')}</select> <small>por página</small></div><div class="goct-pages" id="goct-pages"></div></div></section>
      </div>
      <div class="goct-modal" id="goct-form-modal"><div class="goct-dialog"><div class="goct-card-head"><div><h3 id="goct-form-title">Nuevo registro</h3><small>Control técnico interno</small></div><button class="goct-btn" data-close="goct-form-modal">Cerrar</button></div><div class="goct-grid"><div class="goct-field"><label>Categoría</label><select class="goct-select" id="goct-f-cat"><option value="INSTALACION">Instalación pendiente</option><option value="AVERIA_CAMARA">Avería de cámara</option><option value="OTRO">Otro seguimiento</option></select></div><div class="goct-field"><label>Agencia</label><select class="goct-select" id="goct-f-agency"></select></div><div class="goct-field"><label>Tipo / equipo</label><input class="goct-input" id="goct-f-equipment" placeholder="Ej. Registro fotográfico, cámara domo, PTZ"></div><div class="goct-field"><label>Estado</label><select class="goct-select" id="goct-f-state">${STATES.map((item) => `<option value="${item}">${STATE_LABEL[item]}</option>`).join('')}</select></div><div class="goct-field"><label>Fecha reportada</label><input class="goct-input" type="date" id="goct-f-date"></div><div class="goct-field full"><label>Problema / trabajo pendiente</label><textarea class="goct-textarea" rows="3" id="goct-f-subject" placeholder="Describe la instalación, avería o levantamiento pendiente"></textarea></div><div class="goct-field full"><label>Observaciones</label><textarea class="goct-textarea" rows="3" id="goct-f-notes"></textarea></div><div class="goct-field full"><label>Fotos / evidencias técnicas</label><input class="goct-input" type="file" id="goct-f-files" accept="image/*" multiple><div class="goct-help">Puedes tomar o seleccionar hasta ${MAX_EVIDENCE_FILES} fotos para documentar la instalación o avería.</div><div class="goct-upload-status" id="goct-upload-status"></div><div class="goct-evidence-grid" id="goct-form-evidence"></div></div></div><div class="goct-actions" style="justify-content:flex-end;margin-top:16px"><button class="goct-btn" data-close="goct-form-modal">Cancelar</button><button class="goct-btn primary" id="goct-save">Guardar</button></div></div></div>
      <div class="goct-modal" id="goct-import-modal"><div class="goct-dialog"><div class="goct-card-head"><div><h3 id="goct-import-title">Entrada rápida</h3><small>Pega listas desde WhatsApp o Bloc de notas</small></div><button class="goct-btn" data-close="goct-import-modal">Cerrar</button></div><div id="goct-import-rule" class="goct-help" style="margin-bottom:12px">Todos los registros se guardarán en la categoría seleccionada.</div><div class="goct-field"><label>Texto</label><textarea class="goct-textarea" rows="9" id="goct-import-text" placeholder="1502 (DOMO)\n1576 (PTZ)\n1175 G-11 (verificar)\n1058 G-11: 17-7-2026"></textarea></div><div class="goct-actions" style="margin:12px 0"><div id="goct-import-category-label" class="goct-private">Categoría</div><button class="goct-btn" id="goct-preview-btn">Analizar lista</button></div><div class="goct-preview" id="goct-preview"><div class="goct-empty">Pega una lista y pulsa Analizar.</div></div><div class="goct-actions" style="justify-content:flex-end;margin-top:14px"><button class="goct-btn primary" id="goct-import-save" disabled>Guardar registros válidos</button></div></div></div>
      <div class="goct-modal" id="goct-viewer-modal"><div class="goct-dialog viewer"><div class="goct-card-head"><div><h3 id="goct-viewer-title">Evidencias</h3><small id="goct-viewer-subtitle"></small></div><button class="goct-btn" data-close="goct-viewer-modal">Cerrar</button></div><div class="goct-viewer-grid" id="goct-viewer-grid"></div></div></div>
    `;
  }

  function fillAgencyOptions() {
    const agencySelect = $('#goct-f-agency');
    if (!agencySelect) return;
    const validAgencies = agencies().filter((agency) => agencyId(agency));
    agencySelect.innerHTML = '<option value="">Selecciona una agencia</option>' + validAgencies
      .sort((a, b) => Number(agencyNum(a)) - Number(agencyNum(b)))
      .map((agency) => `<option value="${agencyId(agency)}">AG ${agencyNum(agency)} · ${esc(agencyName(agency))} · ${esc(groupLabel(groupFor(agency)))}</option>`)
      .join('');
    const groupFilter = $('#goct-group');
    if (groupFilter) {
      groupFilter.innerHTML = '<option value="">Todos los grupos</option>' + groups()
        .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'es', { numeric: true }))
        .map((group) => `<option value="${groupId(group) || esc(groupLabel(group))}">${esc(groupLabel(group))}</option>`).join('');
    }
  }

  function updateContextActions() {
    const importButton = $('#goct-import');
    const listTitle = $('#goct-list-title');
    const category = state.activeCategory;
    if (listTitle) listTitle.textContent = category === 'RESUELTO' ? 'Registros resueltos' : (category ? CAT_LABEL[category] : 'Seguimiento activo');
    if (!importButton) return;
    const importable = ['INSTALACION', 'AVERIA_CAMARA'].includes(category);
    importButton.disabled = !importable;
    importButton.title = importable ? '' : 'Selecciona Instalaciones o Averías para usar la entrada rápida.';
    importButton.innerHTML = category === 'AVERIA_CAMARA' ? '<i class="fas fa-paste"></i> Entrada rápida de averías' : category === 'INSTALACION' ? '<i class="fas fa-paste"></i> Entrada rápida de instalaciones' : '<i class="fas fa-paste"></i> Entrada rápida';
  }

  function open(navElement) {
    injectStyles(); injectView(); bind();
    const link = navElement || $('#navControlTecnico');
    if (typeof global.cambiarVista === 'function') global.cambiarVista('ops-control-tecnico', link);
    else {
      $$('[id^="vista-"]').forEach((view) => view.classList.add('hidden'));
      $('#vista-ops-control-tecnico')?.classList.remove('hidden');
      $$('.sidebar-link').forEach((item) => item.classList.remove('active'));
      link?.classList.add('active');
    }
    try { global.setSidebarSectionOpen?.('operaciones', true); } catch (_error) {}
    fillAgencyOptions(); updateContextActions(); load();
  }

  async function load() {
    const connected = client();
    if (!connected) return toast('No se encontró conexión con Supabase.', 'error');
    $('#goct-table').innerHTML = '<div class="goct-empty">Cargando control técnico…</div>';
    try {
      const response = await connected.from(TABLE).select('*').order('creado_en', { ascending: false });
      if (response.error) throw response.error;
      state.items = (response.data || []).filter((item) => item.categoria !== 'LEVANTAMIENTO').map((item) => ({ ...item, evidencias: normalizeEvidence(item.evidencias) }));
      applyFilters(); renderStats();
    } catch (error) {
      toast(error.message || 'No se pudo cargar Control técnico.', 'error');
      $('#goct-table').innerHTML = '<div class="goct-empty">No se pudieron cargar los registros.</div>';
    }
  }

  function renderStats() {
    const activeItems = state.items.filter((item) => !isResolved(item));
    $('#goct-s-total').textContent = activeItems.length;
    $('#goct-s-pending').textContent = activeItems.filter((item) => ['PENDIENTE', 'POR_VERIFICAR', 'EN_COORDINACION'].includes(item.estado)).length;
    $('#goct-s-process').textContent = activeItems.filter((item) => ['PROGRAMADO', 'EN_PROCESO'].includes(item.estado)).length;
    $('#goct-s-equipment').textContent = activeItems.filter((item) => ['FALTA_EQUIPO', 'REQUIERE_CAMBIO'].includes(item.estado)).length;
    $('#goct-s-resolved').textContent = state.items.filter(isResolved).length;
  }

  function applyFilters() {
    const query = text($('#goct-search')?.value).toLowerCase();
    const status = $('#goct-state')?.value || '';
    const group = $('#goct-group')?.value || '';
    const activeTab = state.activeCategory || '';
    state.filtered = state.items.filter((item) => {
      if (activeTab === 'RESUELTO') { if (!isResolved(item)) return false; }
      else { if (isResolved(item)) return false; if (activeTab && item.categoria !== activeTab) return false; }
      if (status && item.estado !== status) return false;
      if (group && item.grupo_id !== group && normalizeGroupKey(item.grupo_codigo) !== normalizeGroupKey(group)) return false;
      if (query) {
        const searchable = [item.agencia_numero, item.grupo_codigo, item.asunto, item.equipo, item.observaciones, CAT_LABEL[item.categoria], STATE_LABEL[item.estado]].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
    const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page > pages) state.page = pages;
    renderTable(); renderPagination(); updateContextActions();
  }

  function renderTable() {
    const start = (state.page - 1) * state.pageSize;
    const list = state.filtered.slice(start, start + state.pageSize);
    $('#goct-count-label').textContent = `${state.filtered.length} registros`;
    if (!list.length) { $('#goct-table').innerHTML = '<div class="goct-empty">No hay registros para estos filtros.</div>'; return; }
    $('#goct-table').innerHTML = `<div class="goct-table-wrap"><table class="goct-table"><thead><tr><th>Agencia</th><th>Grupo</th><th>Categoría</th><th>Equipo / tipo</th><th>Problema o pendiente</th><th>Fecha</th><th>Fotos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map((item) => {
      const evidence = normalizeEvidence(item.evidencias);
      return `<tr><td><b>AG ${esc(item.agencia_numero || '-')}</b></td><td>${esc(item.grupo_codigo || '-')}</td><td>${esc(CAT_LABEL[item.categoria] || item.categoria)}</td><td>${esc(item.equipo || '-')}</td><td>${esc(item.asunto || '-')}${item.observaciones ? `<br><small>${esc(item.observaciones)}</small>` : ''}</td><td>${formatDate(item.fecha_reportada)}</td><td>${evidence.length ? `<button class="goct-btn small" data-view="${item.id}"><i class="fas fa-images"></i> ${evidence.length}</button>` : '<span>-</span>'}</td><td><span class="goct-badge ${badgeClass(item.estado)}">${esc(STATE_LABEL[item.estado] || item.estado)}</span></td><td><div class="goct-actions"><button class="goct-btn small" data-edit="${item.id}">Editar</button>${!isResolved(item) ? `<button class="goct-btn small" data-control-survey="${item.id}">Levantamiento</button><button class="goct-btn small" data-resolve="${item.id}">Resolver</button>` : ''}<button class="goct-btn small danger" data-delete="${item.id}">Eliminar</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
    const table = $('#goct-table');
    $$('[data-edit]', table).forEach((button) => { button.onclick = () => editItem(button.dataset.edit); });
    $$('[data-control-survey]', table).forEach((button) => { button.onclick = () => openControlSurvey(button.dataset.controlSurvey); });
    $$('[data-resolve]', table).forEach((button) => { button.onclick = () => quickResolve(button.dataset.resolve); });
    $$('[data-delete]', table).forEach((button) => { button.onclick = () => deleteItem(button.dataset.delete); });
    $$('[data-view]', table).forEach((button) => { button.onclick = () => viewEvidence(button.dataset.view); });
  }

  function renderPagination() {
    const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    const wrap = $('#goct-pages'); if (!wrap) return;
    let buttons = `<button class="goct-page" data-page="${Math.max(1, state.page - 1)}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    const from = Math.max(1, state.page - 2), to = Math.min(pages, from + 4);
    for (let page = from; page <= to; page += 1) buttons += `<button class="goct-page ${page === state.page ? 'active' : ''}" data-page="${page}">${page}</button>`;
    buttons += `<button class="goct-page" data-page="${Math.min(pages, state.page + 1)}" ${state.page === pages ? 'disabled' : ''}>›</button><small>Página ${state.page} de ${pages}</small>`;
    wrap.innerHTML = buttons;
    $$('[data-page]', wrap).forEach((button) => { button.onclick = () => { state.page = Number(button.dataset.page); renderTable(); renderPagination(); }; });
  }

  function categoryForNewItem() {
    return ['INSTALACION', 'AVERIA_CAMARA'].includes(state.activeCategory) ? state.activeCategory : 'INSTALACION';
  }

  function newItem() {
    state.editing = null; state.formEvidence = []; state.pendingFiles = [];
    const category = categoryForNewItem();
    $('#goct-form-title').textContent = 'Nuevo registro'; $('#goct-f-cat').value = category; $('#goct-f-agency').value = '';
    $('#goct-f-equipment').value = '';
    $('#goct-f-state').value = 'PENDIENTE'; $('#goct-f-date').value = today();
    $('#goct-f-subject').value = CATEGORY_DEFAULT_SUBJECT[category]; $('#goct-f-notes').value = ''; $('#goct-f-files').value = '';
    setUploadStatus(''); renderFormEvidence(); $('#goct-form-modal').classList.add('open');
  }

  function editItem(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    state.editing = item; state.formEvidence = normalizeEvidence(item.evidencias); state.pendingFiles = [];
    $('#goct-form-title').textContent = 'Editar registro'; $('#goct-f-cat').value = item.categoria; $('#goct-f-agency').value = item.agencia_id || '';
    $('#goct-f-equipment').value = item.equipo || ''; $('#goct-f-state').value = item.estado;
    $('#goct-f-date').value = item.fecha_reportada || today(); $('#goct-f-subject').value = item.asunto || ''; $('#goct-f-notes').value = item.observaciones || '';
    $('#goct-f-files').value = ''; setUploadStatus(''); renderFormEvidence(); $('#goct-form-modal').classList.add('open');
  }

  function setUploadStatus(message) {
    const element = $('#goct-upload-status'); if (!element) return;
    element.textContent = message; element.classList.toggle('show', Boolean(message));
  }

  function renderFormEvidence() {
    const wrap = $('#goct-form-evidence'); if (!wrap) return;
    const existingCards = state.formEvidence.map((item, index) => `<div class="goct-evidence-card"><button type="button" class="goct-evidence-remove" data-remove-existing="${index}" title="Quitar foto">×</button><img src="${esc(item.url)}" alt="${esc(item.name)}" loading="lazy"><span>${esc(item.name)}</span></div>`);
    const pendingCards = state.pendingFiles.map((item, index) => `<div class="goct-evidence-card"><button type="button" class="goct-evidence-remove" data-remove-pending="${index}" title="Quitar foto">×</button><img src="${esc(item.preview)}" alt="${esc(item.file.name)}"><span>${esc(item.file.name)} · pendiente</span></div>`);
    wrap.innerHTML = [...existingCards, ...pendingCards].join('') || '<div class="goct-help">Todavía no hay fotos agregadas.</div>';
    $$('[data-remove-existing]', wrap).forEach((button) => { button.onclick = () => { state.formEvidence.splice(Number(button.dataset.removeExisting), 1); renderFormEvidence(); }; });
    $$('[data-remove-pending]', wrap).forEach((button) => { button.onclick = () => { const removed = state.pendingFiles.splice(Number(button.dataset.removePending), 1)[0]; if (removed?.preview) URL.revokeObjectURL(removed.preview); renderFormEvidence(); }; });
  }

  function addPendingFiles(fileList) {
    const incoming = Array.from(fileList || []); if (!incoming.length) return;
    const available = MAX_EVIDENCE_FILES - state.formEvidence.length - state.pendingFiles.length;
    if (available <= 0) return toast(`Solo se permiten ${MAX_EVIDENCE_FILES} fotos por registro.`, 'error');
    const accepted = [];
    for (const file of incoming.slice(0, available)) {
      if (!text(file.type).startsWith('image/')) { toast(`${file.name}: solo se permiten imágenes.`, 'error'); continue; }
      if (file.size > MAX_EVIDENCE_BYTES) { toast(`${file.name}: supera el límite de 15 MB.`, 'error'); continue; }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    state.pendingFiles.push(...accepted); $('#goct-f-files').value = ''; renderFormEvidence();
  }

  async function apiAuthHeaders() {
    try { if (typeof global.lotekaGetApiAuthHeaders === 'function') return await global.lotekaGetApiAuthHeaders(); } catch (_error) {}
    try {
      const response = await client()?.auth?.getSession?.(); const token = response?.data?.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch (_error) { return {}; }
  }

  async function uploadEvidence(file, agencyNumber, index, total) {
    const form = new FormData(); form.append('file', file, file.name || `foto-${Date.now()}.jpg`); form.append('codigo', `control-tecnico-AG-${agencyNumber || 'sin-agencia'}`); form.append('origen', 'control-tecnico-web');
    setUploadStatus(`Subiendo foto ${index + 1} de ${total}…`);
    const response = await fetch('/api/r2-upload', { method: 'POST', headers: await apiAuthHeaders(), body: form, cache: 'no-store', credentials: 'same-origin' });
    const raw = await response.text(); let result = {}; try { result = raw ? JSON.parse(raw) : {}; } catch (_error) {}
    if (!response.ok || result.ok === false) throw new Error(result.message || result.error || `No se pudo subir ${file.name}.`);
    const url = result.url || result.publicUrl || result.public_url || result.location; if (!url) throw new Error(`R2 no devolvió la URL de ${file.name}.`);
    return { url, name: file.name || `Foto ${index + 1}`, type: file.type || 'image/*', uploaded_at: new Date().toISOString() };
  }

  async function uploadPendingEvidence(agencyNumber) {
    const uploaded = [];
    for (let index = 0; index < state.pendingFiles.length; index += 1) uploaded.push(await uploadEvidence(state.pendingFiles[index].file, agencyNumber, index, state.pendingFiles.length));
    return uploaded;
  }

  async function saveItem() {
    if (state.saving) return;
    const connected = client(); if (!connected) return toast('No se encontró conexión con Supabase.', 'error');
    const agencyIdValue = $('#goct-f-agency').value;
    const agency = agencies().find((item) => agencyId(item) === agencyIdValue); if (!agency) return toast('Selecciona una agencia.', 'error');
    const category = $('#goct-f-cat').value, selectedStatus = $('#goct-f-state').value, subject = text($('#goct-f-subject').value);
    const totalEvidence = state.formEvidence.length + state.pendingFiles.length;
    if (!subject) return toast('Describe el trabajo o problema.', 'error');
    const group = groupFor(agency), saveButton = $('#goct-save'); state.saving = true; saveButton.disabled = true; saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando';
    try {
      const uploaded = await uploadPendingEvidence(agencyNum(agency));
      const payload = {
        categoria: category, agencia_id: agencyIdValue, agencia_numero: agencyNum(agency), grupo_id: group ? groupId(group) || null : null,
        grupo_codigo: group ? groupLabel(group) : null, equipo: text($('#goct-f-equipment').value) || null, asunto: subject,
        estado: selectedStatus, fecha_reportada: $('#goct-f-date').value || today(),
        fecha_resolucion: selectedStatus === 'RESUELTO' ? (state.editing?.fecha_resolucion || new Date().toISOString()) : null,
        observaciones: text($('#goct-f-notes').value) || null, evidencias: [...state.formEvidence, ...uploaded]
      };
      const response = state.editing ? await connected.from(TABLE).update(payload).eq('id', state.editing.id) : await connected.from(TABLE).insert(payload);
      if (response.error) throw response.error;
      state.pendingFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)); state.pendingFiles = [];
      $('#goct-form-modal').classList.remove('open'); toast(state.editing ? 'Registro actualizado.' : 'Registro creado.', 'success'); await load();
    } catch (error) { toast(error.message || 'No se pudo guardar el registro.', 'error'); }
    finally { state.saving = false; saveButton.disabled = false; saveButton.innerHTML = 'Guardar'; setUploadStatus(''); }
  }

  async function quickResolve(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    if (!global.confirm('¿Marcar este registro como resuelto? Se quitará de las listas activas y pasará a Resueltos.')) return;
    try {
      const response = await client().from(TABLE).update({ estado: 'RESUELTO', fecha_resolucion: new Date().toISOString() }).eq('id', id);
      if (response.error) throw response.error; toast('Marcado como resuelto y movido a Resueltos.', 'success'); await load();
    } catch (error) { toast(error.message || 'No se pudo resolver el registro.', 'error'); }
  }

  async function deleteItem(id) {
    if (!global.confirm('¿Eliminar este registro de Control técnico? Esta acción no elimina la agencia ni sus operaciones.')) return;
    try { const response = await client().from(TABLE).delete().eq('id', id); if (response.error) throw response.error; toast('Registro eliminado.', 'success'); await load(); }
    catch (error) { toast(error.message || 'No se pudo eliminar el registro.', 'error'); }
  }

  function viewEvidence(id) {
    const item = state.items.find((record) => record.id === id); if (!item) return;
    const evidence = normalizeEvidence(item.evidencias);
    $('#goct-viewer-title').textContent = `Evidencias · AG ${item.agencia_numero || '-'}`;
    $('#goct-viewer-subtitle').textContent = `${CAT_LABEL[item.categoria] || item.categoria} · ${evidence.length} foto(s)`;
    $('#goct-viewer-grid').innerHTML = evidence.map((photo, index) => `<a class="goct-viewer-item" href="${esc(photo.url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(photo.url)}" alt="${esc(photo.name || `Foto ${index + 1}`)}" loading="lazy"><div>${esc(photo.name || `Foto ${index + 1}`)}</div></a>`).join('') || '<div class="goct-empty">Este registro no tiene evidencias.</div>';
    $('#goct-viewer-modal').classList.add('open');
  }

  function openControlSurvey(id) {
    const item = state.items.find((record) => record.id === id);
    if (!item) return toast('No se encontró el registro técnico.', 'error');
    const agency = agencies().find((record) => agencyId(record) === text(item.agencia_id) || agencyNum(record) === padAgency(item.agencia_numero));
    const group = agency ? groupFor(agency) : groups().find((record) => normalizeGroupKey(groupLabel(record)) === normalizeGroupKey(item.grupo_codigo));
    if (!agency || !group) return toast('No se pudo identificar la agencia o su grupo.', 'error');
    if (!global.GOLevantamientosGrupos) return toast('El módulo Levantamientos todavía no está disponible.', 'error');
    global.GOLevantamientosGrupos.openFromControl({
      controlId: item.id,
      originId: item.id,
      agencyId: agencyId(agency),
      groupId: groupId(group),
      groupCode: groupLabel(group),
      responsible: '',
      name: `Levantamiento técnico · ${item.asunto || CAT_LABEL[item.categoria] || 'Control técnico'}`,
      metadata: { control_categoria: item.categoria, control_equipo: item.equipo || null }
    });
  }

  function parseDate(line) {
    const match = line.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/); if (!match) return null;
    let year = Number(match[3]); if (year < 100) year += 2000;
    return `${year}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  function parseImport() {
    const category = state.importCategory;
    if (!['INSTALACION', 'AVERIA_CAMARA'].includes(category)) return toast('La categoría de entrada rápida no está definida.', 'error');
    state.importRows = text($('#goct-import-text').value).split(/\n+/).map(text).filter(Boolean).map((line, index) => {
      const agencyNumber = padAgency((line.match(/^\s*(\d{1,5})/) || [])[1]);
      const groupMatch = line.match(/G\s*[-:]?\s*(\d{1,3})/i), reportedDate = parseDate(line);
      let equipment = '';
      const parenthesis = line.match(/\(([^)]+)\)/); if (parenthesis) equipment = text(parenthesis[1]);
      if (/\bDOMO\b/i.test(line)) equipment = 'Cámara domo'; if (/\bPTZ\b/i.test(line)) equipment = 'Cámara PTZ';
      const agency = agencies().find((item) => agencyNum(item) === agencyNumber && agencyId(item)); const group = agency ? groupFor(agency) : null;
      let subject = line.replace(/^\s*\d{1,5}\s*/, '').replace(/G\s*[-:]?\s*\d{1,3}/i, '').replace(/\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/, '').replace(/[():-]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!subject) subject = CATEGORY_DEFAULT_SUBJECT[category];
      return { line: index + 1, valid: Boolean(agency), agency, agencia_numero: agencyNumber, grupo_codigo: group ? groupLabel(group) : (groupMatch ? `G-${groupMatch[1]}` : '-'), categoria: category, equipo: equipment, asunto: subject, fecha_reportada: reportedDate || today(), estado: /cambiar/i.test(line) ? 'REQUIERE_CAMBIO' : /verificar/i.test(line) ? 'POR_VERIFICAR' : 'PENDIENTE' };
    });
    renderImportPreview();
  }

  function renderImportPreview() {
    const preview = $('#goct-preview');
    if (!state.importRows.length) { preview.innerHTML = '<div class="goct-empty">No se detectaron líneas.</div>'; $('#goct-import-save').disabled = true; return; }
    preview.innerHTML = '<div class="goct-preview-row" style="font-weight:900;background:#eef7fb"><span>Agencia</span><span>Grupo</span><span>Detalle</span><span>Resultado</span></div>' + state.importRows.map((row) => `<div class="goct-preview-row"><span>AG ${esc(row.agencia_numero || '-')}</span><span>${esc(row.grupo_codigo)}</span><span>${esc(row.asunto)}${row.equipo ? ` · ${esc(row.equipo)}` : ''}</span><span>${row.valid ? '✅ Válido' : '⚠️ No existe'}</span></div>`).join('');
    $('#goct-import-save').disabled = !state.importRows.some((row) => row.valid);
  }

  async function saveImport() {
    const rows = state.importRows.filter((row) => row.valid).map((row) => {
      const group = groupFor(row.agency);
      return { categoria: state.importCategory, agencia_id: agencyId(row.agency), agencia_numero: row.agencia_numero, grupo_id: group ? groupId(group) || null : null, grupo_codigo: row.grupo_codigo, equipo: row.equipo || null, asunto: row.asunto, estado: row.estado, fecha_reportada: row.fecha_reportada, observaciones: 'Importado desde entrada rápida', evidencias: [] };
    });
    if (!rows.length) return;
    try { const response = await client().from(TABLE).insert(rows); if (response.error) throw response.error; toast(`${rows.length} registros guardados.`, 'success'); $('#goct-import-modal').classList.remove('open'); $('#goct-import-text').value = ''; state.importRows = []; await load(); }
    catch (error) { toast(error.message || 'No se pudo guardar la entrada rápida.', 'error'); }
  }

  function openImport(category) {
    const chosen = category || state.activeCategory;
    if (!['INSTALACION', 'AVERIA_CAMARA'].includes(chosen)) return toast('Selecciona primero Instalaciones o Averías de cámaras.', 'error');
    state.importCategory = chosen; state.importRows = [];
    const label = CAT_LABEL[chosen] || chosen;
    $('#goct-import-title').textContent = `Entrada rápida — ${label}`; $('#goct-import-category-label').textContent = label; $('#goct-import-rule').textContent = `Todos los registros de esta entrada se guardarán en ${label}.`;
    $('#goct-preview').innerHTML = '<div class="goct-empty">Pega una lista y pulsa Analizar.</div>'; $('#goct-import-save').disabled = true; $('#goct-import-modal').classList.add('open');
  }

  function closeModal(id) {
    $(`#${id}`)?.classList.remove('open');
    if (id === 'goct-import-modal') { state.importCategory = null; state.importRows = []; }
    if (id === 'goct-form-modal' && !state.saving) { state.pendingFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)); state.pendingFiles = []; state.formEvidence = []; }
  }

  function bind() {
    if (state.ready) return; state.ready = true; state.activeCategory = $('.goct-tab.active', $('#goct-root'))?.dataset.cat || '';
    $('#goct-new').onclick = newItem; $('#goct-import').onclick = () => openImport(); $('#goct-open-surveys').onclick = () => global.GOLevantamientosGrupos ? global.GOLevantamientosGrupos.open($('#navLevantamientos')) : toast('El módulo Levantamientos todavía no está disponible.','error'); $('#goct-refresh').onclick = load; $('#goct-save').onclick = saveItem; $('#goct-preview-btn').onclick = parseImport; $('#goct-import-save').onclick = saveImport; $('#goct-f-files').onchange = (event) => addPendingFiles(event.target.files);
    $('#goct-search').oninput = () => { state.page = 1; applyFilters(); };
    ['#goct-state', '#goct-group'].forEach((selector) => { $(selector).onchange = () => { state.page = 1; applyFilters(); }; });
    $('#goct-clear').onclick = () => { $('#goct-search').value = ''; $('#goct-state').value = ''; $('#goct-group').value = ''; state.page = 1; applyFilters(); };
    $('#goct-size').onchange = (event) => { state.pageSize = Number(event.target.value); state.page = 1; applyFilters(); };
    $$('.goct-tab', $('#goct-root')).forEach((button) => { button.onclick = () => { $$('.goct-tab', $('#goct-root')).forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.activeCategory = button.dataset.cat || ''; state.page = 1; applyFilters(); }; });
    const host = $('#vista-ops-control-tecnico');
    $$('[data-close]', host).forEach((button) => { button.onclick = () => closeModal(button.dataset.close); });
    $$('.goct-modal', host).forEach((modal) => { modal.onclick = (event) => { if (event.target === modal) closeModal(modal.id); }; });
  }

  function init() {
    injectStyles(); injectView(); bind(); fillAgencyOptions(); updateContextActions();
    try { runtime()?.modules.register('control-tecnico-personal', { version: VERSION, open, refresh: load }); } catch (_error) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
  global.GOControlTecnico = { version: VERSION, open, refresh: load, openLevantamiento: openControlSurvey };
})(window);
