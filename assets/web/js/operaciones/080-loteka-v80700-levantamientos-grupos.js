(function (global) {
  'use strict';

  if (global.GOLevantamientosGrupos?.version === '807.06') return;

  const VERSION = '807.06';
  const TABLES = {
    campaigns: 'ops_levantamiento_campanas',
    agencies: 'ops_levantamiento_agencias',
    responses: 'ops_levantamiento_respuestas',
    findings: 'ops_levantamiento_hallazgos',
    evidence: 'ops_levantamiento_evidencias',
    reports: 'ops_levantamiento_reportes',
    intakes: 'ops_jotform_levantamientos_ingresos'
  };

  try { if (typeof global.levInit === 'function') global.removeEventListener('DOMContentLoaded', global.levInit); } catch (_error) {}

  const state = {
    initialized: false,
    campaigns: [],
    filteredCampaigns: [],
    selectedCampaign: null,
    expedients: [],
    findings: [],
    evidence: [],
    allReports: [],
    campaignReports: [],
    intakes: [],
    config: null,
    campaignTab: 'AGENCIES',
    mainTab: 'CAMPAIGNS',
    reportEditing: null,
    reportSnapshot: [],
    reportProblem: null,
    sourceContext: null,
    realtime: null,
    legacyLoadTimer: null,
    loadingAll: false,
    catalogGroups: [],
    catalogAgencies: [],
    catalogLoaded: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = (value) => String(value == null ? '' : value).trim();
  const esc = (value) => text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const normalize = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value));
  const normalizeGroup = (value) => text(value).replace(/^\s*(?:grupo|g)\s*[-:]?\s*/i, '').replace(/^0+/, '') || '';
  const padAgency = (value) => {
    const digits = text(value).replace(/\D/g, '');
    return digits ? (digits.length < 4 ? digits.padStart(4, '0') : digits) : '';
  };
  const today = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  };

  function runtime() {
    return global.GOApp && global.GOApp.__phase2aRuntime ? global.GOApp : null;
  }

  function client() {
    try {
      const connected = runtime()?.supabase?.getClient?.();
      if (connected?.from) return connected;
    } catch (_error) {}
    return global.lotekaSupabase || global.supabaseClient || global.__supabaseClient || null;
  }

  function toast(message, tone = 'info') {
    const title = 'Levantamientos';
    try { if (typeof global.showToastNotification === 'function') return global.showToastNotification(title, message, tone); } catch (_error) {}
    try { if (typeof global.lotekaToast === 'function') return global.lotekaToast(title, message, tone); } catch (_error) {}
    try { if (typeof global.notify === 'function') return global.notify(message, tone); } catch (_error) {}
    try { if (typeof global.showToast === 'function') return global.showToast(title, message, tone); } catch (_error) {}
    (tone === 'error' ? console.error : console.log)('[Levantamientos de grupo]', message);
    if (tone === 'error') try { global.alert(message); } catch (_error) {}
  }

  function currentProfileText() {
    const runtimeProfile = runtime()?.state?.get?.('perfil') || {};
    const authProfile = global.lotekaAuthState?.perfil || global.lotekaAuthState?.profile || {};
    const domRole = text($('.loteka-topbar-user-role')?.textContent);
    const domTitle = text($('.loteka-topbar-user')?.getAttribute('title'));
    const values = [
      runtimeProfile.rol_nombre, runtimeProfile.rol, runtimeProfile.puesto_nombre, runtimeProfile.puesto,
      runtimeProfile.roles?.nombre, runtimeProfile.puestos?.nombre,
      authProfile.rol_nombre, authProfile.rol, authProfile.puesto_nombre, authProfile.puesto,
      authProfile.roles?.nombre, authProfile.puestos?.nombre,
      domRole, domTitle
    ];
    return values.map(text).join(' ').toLowerCase();
  }

  function permissionSet() {
    const values = runtime()?.state?.get?.('permissions') || global.lotekaAuthState?.permissions || [];
    return new Set(Array.isArray(values) ? values.map((value) => String(value?.codigo || value)) : []);
  }

  function hasPermission(code) {
    const permissions = permissionSet();
    if (permissions.has('*') || permissions.has(code)) return true;
    try { return typeof global.lotekaHasPermission === 'function' && global.lotekaHasPermission(code); } catch (_error) { return false; }
  }

  function canView() {
    return hasPermission('ver_operaciones') || hasPermission('ver_levantamientos') || hasPermission('gestionar_levantamientos') || /administrador|auxiliar de operaciones|gerente|supervisor/.test(currentProfileText());
  }

  function canManage() {
    return hasPermission('gestionar_levantamientos') || hasPermission('gestionar_operaciones') || /administrador|auxiliar de operaciones|gerente de operaciones/.test(currentProfileText());
  }

  function requireManage() {
    if (canManage()) return true;
    toast('No tienes permiso para modificar Levantamientos.', 'error');
    return false;
  }

  async function apiHeaders(json = false) {
    let headers = {};
    try {
      if (typeof global.lotekaGetApiAuthHeaders === 'function') headers = await global.lotekaGetApiAuthHeaders();
      else {
        const result = await client()?.auth?.getSession?.();
        const token = result?.data?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch (_error) {}
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  function rawAgencies() {
    if (Array.isArray(state.catalogAgencies) && state.catalogAgencies.length) return state.catalogAgencies;
    return Array.isArray(global.agencias) ? global.agencias : [];
  }

  function agencies() {
    return rawAgencies().filter((agency) => {
      const status = text(agency?.estado || agency?.estado_operativo);
      return agency?.activo !== false && !/cerrad|inactiv|desactiv/i.test(status);
    });
  }

  function rawGroups() {
    if (Array.isArray(state.catalogGroups) && state.catalogGroups.length) return state.catalogGroups;
    const globals = Array.isArray(global.grupos) ? global.grupos : [];
    if (globals.length) return globals;

    const codes = [...new Set(rawAgencies().map((agency) => normalizeGroup(
      agency?.grupo_codigo || agency?.codigo_grupo || agency?.grupo_numero || agency?.grupo_nombre || agency?.grupo
    )).filter(Boolean))];
    return codes.map((code) => ({ codigo: code, numero: code, nombre: `Grupo ${code}`, activo: true, _synthetic: true }));
  }

  function groups() {
    return rawGroups().filter((group) => group?.activo !== false && !/prueba|test|desactiv/i.test(text(group?.nombre || group?.codigo)));
  }

  async function fetchAllCatalogRows(tableName) {
    const connected = client();
    if (!connected) return [];
    const pageSize = 1000;
    const rows = [];
    for (let from = 0; from < 50000; from += pageSize) {
      const response = await connected.from(tableName).select('*').order('id', { ascending: true }).range(from, from + pageSize - 1);
      if (response.error) throw response.error;
      const batch = response.data || [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  }

  async function loadCatalog(force = false) {
    if (state.catalogLoaded && !force && groups().length) return;
    const globalGroups = Array.isArray(global.grupos) ? global.grupos : [];
    const globalAgencies = Array.isArray(global.agencias) ? global.agencias : [];
    try {
      const [groupRows, agencyRows] = await Promise.all([
        fetchAllCatalogRows('grupos'),
        fetchAllCatalogRows('agencias')
      ]);
      state.catalogGroups = groupRows.length ? groupRows : globalGroups;
      state.catalogAgencies = agencyRows.length ? agencyRows : globalAgencies;
      state.catalogLoaded = true;
    } catch (error) {
      state.catalogGroups = globalGroups;
      state.catalogAgencies = globalAgencies;
      state.catalogLoaded = true;
      console.warn('[Levantamientos de grupo] No se pudo cargar el catálogo directo desde Supabase:', error);
    }
  }

  function agencyId(agency) {
    for (const value of [agency?.supabaseId, agency?.id_supabase, agency?.agencia_id, agency?.id]) if (uuid(value)) return text(value);
    return '';
  }

  function agencyNumber(agency) {
    return padAgency(agency?.numero || agency?.codigo || agency?.agencia);
  }

  function agencyDisplay(value) {
    const digits = text(value).replace(/\D/g, '');
    return digits ? digits.replace(/^0+(?=\d)/, '') : text(value);
  }

  function agencyName(agency) {
    return text(agency?.nombre || agency?.descripcion || agency?.nombre_agencia) || `Agencia ${agencyDisplay(agencyNumber(agency))}`;
  }

  function groupId(group) {
    for (const value of [group?.supabaseId, group?.id_supabase, group?.grupo_id, group?.id]) if (uuid(value)) return text(value);
    return '';
  }

  function groupLabel(group) {
    return normalizeGroup(group?.codigo || group?.nombre || group?.numero) || 'Sin grupo';
  }

  function groupForAgency(agency) {
    const candidates = [agency?.grupoId, agency?.grupo_id, agency?.group_id, agency?.grupo, agency?.grupo_codigo, agency?.codigo_grupo]
      .map(text).filter(Boolean);
    return groups().find((group) => {
      const values = [groupId(group), group?.id, group?.codigo, group?.nombre, group?.numero].map(text).filter(Boolean);
      return candidates.some((candidate) => values.some((value) => candidate === value || normalizeGroup(candidate) === normalizeGroup(value)));
    }) || null;
  }

  function agencyByIdOrNumber(id, number) {
    return agencies().find((agency) => (id && agencyId(agency) === id) || (number && agencyNumber(agency) === padAgency(number))) || null;
  }

  function agencyGroupCode(agency) {
    const linkedGroup = groupForAgency(agency);
    if (linkedGroup) return normalizeGroup(groupLabel(linkedGroup));
    return normalizeGroup(agency?.grupo_codigo || agency?.codigo_grupo || agency?.grupo || agency?.grupo_numero || agency?.grupo_nombre);
  }

  function formatDate(value, includeTime = false) {
    if (!value) return '-';
    try {
      const raw = String(value);
      const date = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
      return new Intl.DateTimeFormat('es-DO', includeTime
        ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    } catch (_error) { return text(value); }
  }

  function campaignStatusLabel(status) {
    return ({ BORRADOR: 'Borrador', ABIERTO: 'Abierto', EN_REVISION: 'En revisión', CERRADO: 'Cerrado', ARCHIVADO: 'Archivado' })[status] || status;
  }

  function findingStatusLabel(status) {
    return ({ PENDIENTE: 'Pendiente', EN_COORDINACION: 'En coordinación', EN_PROCESO: 'En proceso', RESUELTO: 'Resuelto', DESCARTADO: 'Descartado' })[status] || status;
  }

  function badgeClass(status) {
    if (/CERRADO|RESUELTO|SIN_HALLAZGOS/.test(status)) return 'ok';
    if (/ABIERTO|RECIBIDO|EN_REVISION|EN_PROCESO/.test(status)) return 'run';
    if (/CON_HALLAZGOS|PENDIENTE|URGENTE|ALTA/.test(status)) return 'warn';
    if (/ARCHIVADO|ANULADO|DESCARTADO/.test(status)) return 'muted';
    return 'wait';
  }

  function injectStyles() {
    if ($('#golevg-style')) return;
    const style = document.createElement('style');
    style.id = 'golevg-style';
    style.textContent = `
      #golevg-root{font-family:Inter,system-ui;color:#103b5b;padding-bottom:36px}.golevg-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:25px;border:1px solid #cfe2ee;border-radius:22px;background:linear-gradient(135deg,#f8fdff,#e9f7ff);box-shadow:0 16px 38px rgba(10,63,97,.08);margin-bottom:15px}.golevg-hero h2{margin:7px 0 0;color:#073e64;font-size:29px}.golevg-hero p{margin:7px 0 0;color:#637e92;max-width:830px;line-height:1.55}.golevg-kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#dff5ff;color:#06709f;font-size:11px;font-weight:1000;text-transform:uppercase}.golevg-actions,.golevg-tabs,.golevg-inline{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.golevg-btn{border:1px solid #c8dce8;background:#fff;color:#086895;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;transition:.15s}.golevg-btn:hover:not(:disabled){transform:translateY(-1px)}.golevg-btn:disabled{opacity:.5;cursor:not-allowed}.golevg-btn.primary{border:0;color:#fff;background:linear-gradient(135deg,#087fba,#05a9d4)}.golevg-btn.success{border:0;color:#fff;background:#07875a}.golevg-btn.danger{color:#b42318}.golevg-btn.small{padding:7px 9px;font-size:12px}.golevg-tabs{background:#edf6fb;border-radius:13px;padding:5px;width:max-content;max-width:100%;margin-bottom:14px}.golevg-tab{border:0;background:transparent;color:#607b8e;padding:9px 14px;border-radius:9px;font-weight:900;cursor:pointer}.golevg-tab.active{background:#fff;color:#0871a3;box-shadow:0 4px 13px #aac6d655}.golevg-panel{display:none}.golevg-panel.active{display:block}.golevg-stats{display:grid;grid-template-columns:repeat(5,minmax(125px,1fr));gap:10px;margin-bottom:14px}.golevg-stat,.golevg-card{background:#fff;border:1px solid #d6e5ee;border-radius:17px;padding:16px;box-shadow:0 10px 24px rgba(11,61,95,.05)}.golevg-stat span{display:block;color:#6b8496;font-size:10px;font-weight:1000;text-transform:uppercase}.golevg-stat strong{display:block;color:#0a456c;font-size:27px;margin-top:5px}.golevg-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.golevg-card-head h3{margin:0}.golevg-card-head small{color:#718a9b}.golevg-filter{display:grid;grid-template-columns:2fr repeat(2,minmax(150px,1fr)) auto;gap:9px;margin-bottom:13px}.golevg-input,.golevg-select,.golevg-textarea{width:100%;box-sizing:border-box;border:1px solid #c9dce8;border-radius:11px;padding:10px 11px;background:#fff;font:inherit}.golevg-campaign-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:13px}.golevg-campaign{border:1px solid #d4e4ed;border-radius:18px;padding:17px;background:#fff;box-shadow:0 10px 24px rgba(11,61,95,.05)}.golevg-campaign h3{margin:7px 0 4px;font-size:18px;color:#0a4167}.golevg-campaign p{margin:0;color:#6d8495;font-size:12px;line-height:1.45}.golevg-code{font-size:11px;font-weight:1000;color:#0874a6;text-transform:uppercase}.golevg-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:13px 0}.golevg-metric{border:1px solid #dce9f0;border-radius:11px;padding:9px;background:#f8fcfe}.golevg-metric span{display:block;font-size:9px;text-transform:uppercase;font-weight:1000;color:#738b9d}.golevg-metric b{display:block;margin-top:3px;color:#104766}.golevg-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:1000}.golevg-badge.ok{background:#e5f8ed;color:#087448}.golevg-badge.run{background:#e7f5ff;color:#08689c}.golevg-badge.warn{background:#fff3d7;color:#8a6200}.golevg-badge.muted{background:#edf1f4;color:#667986}.golevg-badge.wait{background:#f0f5f8;color:#587486}.golevg-table-wrap{overflow:auto;border:1px solid #dbe8ef;border-radius:14px}.golevg-table{width:100%;border-collapse:collapse;min-width:1080px}.golevg-table th,.golevg-table td{padding:11px;border-bottom:1px solid #e7eff4;text-align:left;font-size:13px;vertical-align:top}.golevg-table th{background:#eff8fc;color:#5e788c;font-size:10px;text-transform:uppercase}.golevg-table tr:hover td{background:#f9fdff}.golevg-empty{text-align:center;padding:38px;color:#71899a}.golevg-detail-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:14px}.golevg-detail-head h2{margin:3px 0 5px;color:#0a4166}.golevg-detail-meta{display:flex;gap:8px;flex-wrap:wrap}.golevg-problem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}.golevg-problem{border:1px solid #d5e5ee;border-radius:16px;padding:15px;background:#fff}.golevg-problem h4{margin:5px 0 6px;color:#0a4166;font-size:16px}.golevg-problem p{margin:0;color:#6b8294;font-size:12px}.golevg-report-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}.golevg-report{border:1px solid #d6e5ed;border-radius:17px;padding:15px;background:#fff}.golevg-report h4{margin:7px 0;color:#0a4167}.golevg-report-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.golevg-report-info div{padding:9px;border:1px solid #dce9f0;border-radius:10px;background:#f8fcfe}.golevg-report-info span{display:block;font-size:9px;text-transform:uppercase;font-weight:1000;color:#71899a}.golevg-report-info b{display:block;margin-top:3px}.golevg-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#062d4875;z-index:12000;padding:20px}.golevg-modal.open{display:flex}.golevg-dialog{width:min(950px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 80px #071c2c66}.golevg-dialog.wide{width:min(1160px,97vw)}.golevg-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.golevg-field.full{grid-column:1/-1}.golevg-field label{display:block;font-size:10px;font-weight:1000;color:#5e778a;text-transform:uppercase;margin-bottom:6px}.golevg-help{padding:11px 13px;border-radius:12px;background:#f4f9fc;border:1px solid #d7e8f1;color:#5d788c;font-size:12px;line-height:1.5}.golevg-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.golevg-photo{border:1px solid #d7e5ed;border-radius:13px;overflow:hidden;background:#f8fcfe}.golevg-photo img{width:100%;height:160px;object-fit:contain;background:#0b1d2b;display:block}.golevg-photo div{padding:8px;font-size:11px}.golevg-agency-result{border:1px solid #d7e5ed;border-radius:14px;margin-bottom:10px;overflow:hidden}.golevg-agency-result-head{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#e9f6fd;padding:10px 13px;font-weight:1000}.golevg-agency-result-body{padding:13px}.golevg-check-row{display:grid;grid-template-columns:34px 100px 1fr 100px;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #e8eff3}.golevg-link{color:#0675a8;font-weight:900;cursor:pointer;text-decoration:none}@media(max-width:1000px){.golevg-stats{grid-template-columns:repeat(2,1fr)}.golevg-filter{grid-template-columns:1fr 1fr}.golevg-hero,.golevg-detail-head{flex-direction:column}.golevg-grid{grid-template-columns:1fr}.golevg-field.full{grid-column:auto}}@media(max-width:650px){.golevg-filter{grid-template-columns:1fr}.golevg-tabs{width:100%;overflow:auto;flex-wrap:nowrap}.golevg-tab{white-space:nowrap}.golevg-campaign-grid,.golevg-problem-grid,.golevg-report-grid{grid-template-columns:1fr}.golevg-report-info{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function injectView() {
    const host = $('#vista-ops-levantamientos');
    if (!host || host.dataset.golevgReady) return;
    host.dataset.golevgReady = '1';
    host.innerHTML = `
      <div id="golevg-root">
        <section class="golevg-hero">
          <div><span class="golevg-kicker"><i class="fas fa-layer-group"></i> Levantamientos por grupo</span><h2>Levantamientos de agencias</h2><p>El técnico utiliza siempre el mismo enlace general de Jotform. El sistema identifica la agencia, consulta su grupo oficial y la coloca automáticamente en el levantamiento abierto correspondiente, aunque el trabajo dure varios días.</p></div>
          <div class="golevg-actions"><button class="golevg-btn" id="golevg-refresh"><i class="fas fa-rotate"></i> Actualizar</button><button class="golevg-btn" id="golevg-copy-form"><i class="fas fa-link"></i> Copiar enlace Jotform</button><button class="golevg-btn primary" id="golevg-new"><i class="fas fa-plus"></i> Nuevo levantamiento de grupo</button></div>
        </section>
        <div class="golevg-tabs" id="golevg-main-tabs"><button class="golevg-tab active" data-main="CAMPAIGNS">Levantamientos</button><button class="golevg-tab" data-main="PENDING">Jotform sin vincular <span id="golevg-pending-badge"></span></button><button class="golevg-tab" data-main="REPORTS">Reportes guardados</button></div>
        <section class="golevg-panel active" data-main-panel="CAMPAIGNS">
          <div class="golevg-stats" id="golevg-stats"></div>
          <div class="golevg-card"><div class="golevg-card-head"><div><h3>Levantamientos de grupo</h3><small id="golevg-count">0 levantamientos</small></div></div><div class="golevg-filter"><input class="golevg-input" id="golevg-search" placeholder="Buscar código, grupo, responsable o nombre"><select class="golevg-select" id="golevg-status"><option value="">Todos los estados</option><option value="ABIERTO">Abiertos</option><option value="EN_REVISION">En revisión</option><option value="CERRADO">Cerrados</option><option value="ARCHIVADO">Archivados</option></select><select class="golevg-select" id="golevg-group"><option value="">Todos los grupos</option></select><button class="golevg-btn" id="golevg-clear">Limpiar</button></div><div class="golevg-campaign-grid" id="golevg-campaigns"></div></div>
        </section>
        <section class="golevg-panel" data-main-panel="PENDING"><div class="golevg-card"><div class="golevg-card-head"><div><h3>Formularios pendientes de vincular</h3><small>Ninguno de estos formularios entra en reportes hasta asignarlo a un levantamiento.</small></div></div><div id="golevg-pending"></div></div></section>
        <section class="golevg-panel" data-main-panel="REPORTS"><div class="golevg-card"><div class="golevg-card-head"><div><h3>Reportes guardados</h3><small>Documentos históricos generados desde un levantamiento específico.</small></div></div><div class="golevg-report-grid" id="golevg-all-reports"></div></div></section>
        <section id="golevg-detail" style="display:none"></section>
      </div>

      <div class="golevg-modal" id="golevg-campaign-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Nuevo levantamiento de grupo</h3><small>Puede durar todos los días que sean necesarios.</small></div><button class="golevg-btn" data-close="golevg-campaign-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field"><label>Grupo</label><select class="golevg-select" id="golevg-f-group"></select></div><div class="golevg-field"><label>Responsable</label><input class="golevg-input" id="golevg-f-responsible" placeholder="Técnico o encargado"></div><div class="golevg-field full"><label>Nombre</label><input class="golevg-input" id="golevg-f-name" value="Levantamiento general de agencias"></div><div class="golevg-field"><label>Fecha de inicio</label><input class="golevg-input" id="golevg-f-start" type="date"></div><div class="golevg-field"><label>Agencias esperadas (opcional)</label><input class="golevg-input" id="golevg-f-expected" type="number" min="0"></div><div class="golevg-field full"><label>Descripción</label><textarea class="golevg-textarea" id="golevg-f-description" rows="3"></textarea></div></div><div class="golevg-help" id="golevg-campaign-status" style="display:none;margin-top:14px"></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-campaign-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-save-campaign">Crear levantamiento</button></div></div></div>

      <div class="golevg-modal" id="golevg-jotform-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Abrir formulario de agencia</h3><small id="golevg-jotform-campaign"></small></div><button class="golevg-btn" data-close="golevg-jotform-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field full"><label>Agencia del grupo</label><select class="golevg-select" id="golevg-j-agency"></select></div><div class="golevg-field"><label>Técnico / responsable</label><input class="golevg-input" id="golevg-j-tech"></div><div class="golevg-field"><label>Fecha de inspección</label><input class="golevg-input" type="date" id="golevg-j-date"></div><div class="golevg-field full"><div class="golevg-help" id="golevg-j-help">El formulario recibirá ocultamente el código del levantamiento, grupo, agencia y origen. Así podrá enviarse hoy o varios días después sin mezclarse.</div></div></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-jotform-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-open-jotform"><i class="fas fa-up-right-from-square"></i> Abrir Jotform</button></div></div></div>

      <div class="golevg-modal" id="golevg-problem-modal"><div class="golevg-dialog wide"><div class="golevg-card-head"><div><h3 id="golevg-problem-title">Agencias con problemas</h3><small id="golevg-problem-subtitle"></small></div><button class="golevg-btn" data-close="golevg-problem-modal">Cerrar</button></div><div id="golevg-problem-content"></div></div></div>

      <div class="golevg-modal" id="golevg-report-modal"><div class="golevg-dialog wide"><div class="golevg-card-head"><div><h3>Preparar reporte</h3><small>Selecciona las agencias que formarán parte del documento.</small></div><button class="golevg-btn" data-close="golevg-report-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field full"><label>Título</label><input class="golevg-input" id="golevg-r-title"></div><div class="golevg-field"><label>Responsable</label><input class="golevg-input" id="golevg-r-responsible"></div><div class="golevg-field"><label>Estado del reporte</label><select class="golevg-select" id="golevg-r-status"><option value="BORRADOR">Borrador</option><option value="FINAL">Final</option></select></div><div class="golevg-field full"><label>Observación</label><textarea class="golevg-textarea" id="golevg-r-observation" rows="2"></textarea></div><div class="golevg-field full"><label>Agencias incluidas</label><div id="golevg-r-items" style="border:1px solid #d7e5ed;border-radius:13px;max-height:390px;overflow:auto"></div></div></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-report-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-save-report">Guardar reporte</button></div></div></div>

      <div class="golevg-modal" id="golevg-link-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Vincular formulario</h3><small>El formulario se reprocesará dentro del levantamiento seleccionado.</small></div><button class="golevg-btn" data-close="golevg-link-modal">Cerrar</button></div><div class="golevg-field"><label>Levantamiento abierto</label><select class="golevg-select" id="golevg-link-campaign"></select></div><input type="hidden" id="golevg-link-intake"><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn primary" id="golevg-link-save">Vincular y procesar</button></div></div></div>
    `;
  }

  function installNavigation() {
    const nav = $('#navLevantamientos');
    if (!nav) return;
    nav.href = '#';
    nav.onclick = (event) => { event?.preventDefault?.(); open(nav); return false; };
  }

  function showModuleView(navElement) {
    if (typeof global.cambiarVista === 'function') global.cambiarVista('ops-levantamientos', navElement || $('#navLevantamientos'));
    else {
      $$('[id^="vista-"]').forEach((view) => view.classList.add('hidden'));
      $('#vista-ops-levantamientos')?.classList.remove('hidden');
      $$('.sidebar-link').forEach((link) => link.classList.remove('active'));
      (navElement || $('#navLevantamientos'))?.classList.add('active');
    }
    try { global.setSidebarSectionOpen?.('operaciones', true); } catch (_error) {}
  }

  async function loadConfig(force = false) {
    if (state.config && !force) return state.config;
    try {
      const response = await fetch('/api/levantamientos-config', { cache: 'no-store' });
      state.config = response.ok ? await response.json() : { configured: false, formUrl: '' };
    } catch (_error) { state.config = { configured: false, formUrl: '' }; }
    return state.config;
  }

  function fillGroupOptions() {
    const current = $('#golevg-group')?.value || '';
    const labels = [...new Set([...groups().map(groupLabel), ...state.campaigns.map((item) => normalizeGroup(item.grupo_codigo)).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    const html = '<option value="">Todos los grupos</option>' + labels.map((label) => `<option value="${esc(label)}">Grupo ${esc(label)}</option>`).join('');
    if ($('#golevg-group')) { $('#golevg-group').innerHTML = html; $('#golevg-group').value = labels.includes(current) ? current : ''; }
    const create = $('#golevg-f-group');
    if (create) create.innerHTML = '<option value="">Selecciona un grupo</option>' + groups().sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'es', { numeric: true })).map((group) => `<option value="${groupId(group)}" data-code="${esc(groupLabel(group))}">Grupo ${esc(groupLabel(group))}</option>`).join('');
  }

  async function open(navElement) {
    if (!canView()) return toast('No tienes permiso para abrir Levantamientos.', 'error');
    injectStyles(); injectView(); installNavigation(); bind(); showModuleView(navElement);
    await Promise.all([loadConfig(), loadCatalog()]);
    await loadAll();
  }

  async function loadAll() {
    const connected = client();
    if (!connected) return toast('Supabase todavía no está disponible.', 'error');
    await loadCatalog();
    $('#golevg-campaigns').innerHTML = '<div class="golevg-empty">Cargando levantamientos…</div>';
    try {
      const [campaigns, reports, intakes] = await Promise.all([
        connected.from(TABLES.campaigns).select('*').order('actualizado_en', { ascending: false }),
        connected.from(TABLES.reports).select('*, ops_levantamiento_campanas(codigo,grupo_codigo,nombre)').order('creado_en', { ascending: false }),
        connected.from(TABLES.intakes).select('*').in('estado', ['PENDIENTE_VINCULO', 'ERROR']).order('recibido_en', { ascending: false }).limit(100)
      ]);
      if (campaigns.error) throw campaigns.error;
      if (reports.error) throw reports.error;
      if (intakes.error) throw intakes.error;
      state.campaigns = campaigns.data || [];
      state.allReports = reports.data || [];
      state.intakes = intakes.data || [];
      fillGroupOptions(); applyCampaignFilters(); renderStats(); renderPending(); renderAllReports();
      $('#golevg-pending-badge').textContent = state.intakes.length ? `(${state.intakes.length})` : '';
    } catch (error) {
      toast(error.message || 'No se pudieron cargar los levantamientos.', 'error');
      $('#golevg-campaigns').innerHTML = '<div class="golevg-empty">No fue posible cargar los datos. Ejecuta primero el SQL del parche.</div>';
    }
  }

  function renderStats() {
    const active = state.campaigns.filter((item) => ['ABIERTO', 'EN_REVISION'].includes(item.estado));
    const items = [
      ['Levantamientos abiertos', active.length],
      ['Agencias recibidas', state.campaigns.reduce((sum, item) => sum + Number(item.agencias_recibidas || 0), 0)],
      ['Problemas activos', state.campaigns.reduce((sum, item) => sum + Number(item.hallazgos_activos || 0), 0)],
      ['Problemas resueltos', state.campaigns.reduce((sum, item) => sum + Number(item.hallazgos_resueltos || 0), 0)],
      ['Reportes guardados', state.allReports.length]
    ];
    $('#golevg-stats').innerHTML = items.map(([label, value]) => `<div class="golevg-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
    if ($('#golevg-new')) $('#golevg-new').style.display = canManage() ? '' : 'none';
  }

  function applyCampaignFilters() {
    const search = normalize($('#golevg-search')?.value || '');
    const status = $('#golevg-status')?.value || '';
    const group = normalizeGroup($('#golevg-group')?.value || '');
    state.filteredCampaigns = state.campaigns.filter((item) => {
      if (status && item.estado !== status) return false;
      if (group && normalizeGroup(item.grupo_codigo) !== group) return false;
      if (search && !normalize([item.codigo, item.grupo_codigo, item.nombre, item.responsable_nombre, item.descripcion].join(' ')).includes(search)) return false;
      return true;
    });
    renderCampaigns();
  }

  function renderCampaigns() {
    $('#golevg-count').textContent = `${state.filteredCampaigns.length} levantamiento(s)`;
    if (!state.filteredCampaigns.length) {
      $('#golevg-campaigns').innerHTML = '<div class="golevg-empty">No hay levantamientos con estos filtros.</div>';
      return;
    }
    $('#golevg-campaigns').innerHTML = state.filteredCampaigns.map((item) => {
      const expected = item.agencias_esperadas == null ? '-' : item.agencias_esperadas;
      return `<article class="golevg-campaign"><span class="golevg-code">${esc(item.codigo)}</span><h3>Grupo ${esc(item.grupo_codigo)} · ${esc(item.nombre)}</h3><p>${esc(item.descripcion || 'Sin descripción adicional.')}</p><div class="golevg-metrics"><div class="golevg-metric"><span>Agencias</span><b>${item.agencias_recibidas}/${expected}</b></div><div class="golevg-metric"><span>Problemas activos</span><b>${item.hallazgos_activos || 0}</b></div><div class="golevg-metric"><span>Fotos en R2</span><b>${item.evidencias_count || 0}</b></div></div><div class="golevg-inline" style="justify-content:space-between"><span class="golevg-badge ${badgeClass(item.estado)}">${campaignStatusLabel(item.estado)}</span><span style="font-size:11px;color:#73899a">Inicio: ${formatDate(item.fecha_inicio)}</span></div><div class="golevg-actions" style="margin-top:13px"><button class="golevg-btn primary small" data-open-campaign="${item.id}">Abrir</button><button class="golevg-btn small" data-toggle-campaign="${item.id}" data-next="${item.estado === 'CERRADO' ? 'ABIERTO' : 'CERRADO'}">${item.estado === 'CERRADO' ? 'Reabrir' : 'Cerrar'}</button></div></article>`;
    }).join('');
    $$('[data-open-campaign]', $('#golevg-campaigns')).forEach((button) => { button.onclick = () => openCampaign(button.dataset.openCampaign); });
    $$('[data-toggle-campaign]', $('#golevg-campaigns')).forEach((button) => { button.onclick = () => toggleCampaign(button.dataset.toggleCampaign, button.dataset.next); });
  }

  function setCampaignStatus(message, tone = 'info') {
    const holder = $('#golevg-campaign-status');
    if (!holder) return;
    holder.style.display = message ? 'block' : 'none';
    holder.textContent = message || '';
    holder.style.borderColor = tone === 'error' ? '#f0b7b7' : '#d7e8f1';
    holder.style.background = tone === 'error' ? '#fff3f3' : '#f4f9fc';
    holder.style.color = tone === 'error' ? '#a12622' : '#5d788c';
  }

  async function createCampaign() {
    if (!requireManage()) return;
    const button = $('#golevg-save-campaign');
    const originalButton = button?.innerHTML || 'Crear levantamiento';
    const selected = $('#golevg-f-group');
    const option = selected?.selectedOptions?.[0];
    const groupIdValue = selected?.value || '';
    const groupCode = option?.dataset?.code || '';
    const name = text($('#golevg-f-name').value);
    if (!groupCode || !name) {
      setCampaignStatus('Selecciona el grupo y escribe el nombre del levantamiento.', 'error');
      return toast('Selecciona el grupo y escribe el nombre.', 'error');
    }
    const activeExisting = state.campaigns.find((item) => item.origen === 'MANUAL' && normalizeGroup(item.grupo_codigo) === normalizeGroup(groupCode) && ['ABIERTO', 'EN_REVISION'].includes(item.estado));
    if (activeExisting) {
      closeModal('golevg-campaign-modal');
      toast(`El grupo ${groupCode} ya tiene el levantamiento abierto ${activeExisting.codigo}.`, 'info');
      return openCampaign(activeExisting.id);
    }
    const payload = {
      grupo_id: uuid(groupIdValue) ? groupIdValue : null,
      grupo_codigo: groupCode,
      nombre: name,
      descripcion: text($('#golevg-f-description').value) || null,
      responsable_nombre: text($('#golevg-f-responsible').value) || null,
      origen: 'MANUAL',
      origen_id: null,
      estado: 'ABIERTO',
      fecha_inicio: $('#golevg-f-start').value || today(),
      agencias_esperadas: Number($('#golevg-f-expected').value) || null
    };
    try {
      const connected = client();
      if (!connected?.from) throw new Error('La conexión con Supabase no está disponible. Recarga el sistema e inicia sesión nuevamente.');
      if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando…'; }
      setCampaignStatus(`Creando levantamiento para el Grupo ${groupCode}…`);
      const response = await connected.from(TABLES.campaigns).insert(payload).select('*').single();
      if (response.error) throw response.error;
      if (!response.data?.id) throw new Error('Supabase no devolvió el levantamiento creado.');
      closeModal('golevg-campaign-modal');
      toast(`Levantamiento ${response.data.codigo} creado correctamente.`, 'success');
      await loadAll();
      await openCampaign(response.data.id);
    } catch (error) {
      console.error('[Levantamientos de grupo] Error creando levantamiento:', error, payload);
      const message = text(error?.message || error) || 'No se pudo crear el levantamiento.';
      setCampaignStatus(message, 'error');
      toast(message, 'error');
    } finally {
      if (button) { button.disabled = false; button.innerHTML = originalButton; }
    }
  }

  async function openCampaignModal() {
    if (!requireManage()) return;
    if (!groups().length) {
      await loadCatalog(true);
      fillGroupOptions();
    } else fillGroupOptions();
    if (!groups().length) {
      toast('No se encontraron grupos activos en Supabase.', 'error');
      return;
    }
    $('#golevg-f-group').value = '';
    $('#golevg-f-name').value = 'Levantamiento general de agencias';
    $('#golevg-f-responsible').value = '';
    $('#golevg-f-description').value = '';
    $('#golevg-f-start').value = today();
    $('#golevg-f-expected').value = '';
    setCampaignStatus('');
    $('#golevg-campaign-modal').classList.add('open');
  }

  async function toggleCampaign(id, next) {
    if (!requireManage()) return;
    const item = state.campaigns.find((row) => row.id === id);
    if (!item) return;
    const message = next === 'CERRADO'
      ? `¿Cerrar ${item.codigo}? Los próximos formularios generales de este grupo crearán o utilizarán otro levantamiento abierto.`
      : `¿Reabrir ${item.codigo}?`;
    if (!global.confirm(message)) return;
    const response = await client().from(TABLES.campaigns).update({ estado: next }).eq('id', id);
    if (response.error) return toast(response.error.message, 'error');
    toast(next === 'CERRADO' ? 'Levantamiento cerrado.' : 'Levantamiento reabierto.', 'success');
    await loadAll();
    if (state.selectedCampaign?.id === id) openCampaign(id);
  }

  async function openCampaign(id, options = {}) {
    const requestedTab = options.tab || (state.selectedCampaign?.id === id ? state.campaignTab : 'AGENCIES');
    const connected = client();
    $('#golevg-detail').style.display = 'block';
    $('#golevg-detail').innerHTML = '<div class="golevg-card"><div class="golevg-empty">Cargando detalle del levantamiento…</div></div>';
    $('[data-main-panel="CAMPAIGNS"]').classList.remove('active');
    try {
      const [campaign, expedients, findings, evidence, reports] = await Promise.all([
        connected.from(TABLES.campaigns).select('*').eq('id', id).single(),
        connected.from(TABLES.agencies).select('*').eq('campana_id', id).order('agencia_numero'),
        connected.from(TABLES.findings).select('*').eq('campana_id', id).order('creado_en'),
        connected.from(TABLES.evidence).select('*').eq('campana_id', id).order('orden'),
        connected.from(TABLES.reports).select('*').eq('campana_id', id).order('creado_en', { ascending: false })
      ]);
      for (const result of [campaign, expedients, findings, evidence, reports]) if (result.error) throw result.error;
      state.selectedCampaign = campaign.data;
      state.expedients = expedients.data || [];
      state.findings = findings.data || [];
      state.evidence = evidence.data || [];
      state.campaignReports = reports.data || [];
      state.campaignTab = requestedTab;
      renderCampaignDetail();
      $('#golevg-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast(error.message || 'No se pudo abrir el levantamiento.', 'error');
      $('#golevg-detail').innerHTML = '<div class="golevg-card"><div class="golevg-empty">No se pudo cargar el detalle.</div></div>';
    }
  }

  function renderCampaignDetail() {
    const c = state.selectedCampaign;
    if (!c) return;
    const activeFindings = state.findings.filter((item) => ['PENDIENTE', 'EN_COORDINACION', 'EN_PROCESO'].includes(item.estado));
    $('#golevg-detail').innerHTML = `
      <div class="golevg-detail-head"><div><a class="golevg-link" id="golevg-back">← Volver a levantamientos</a><h2>${esc(c.codigo)} · Grupo ${esc(c.grupo_codigo)}</h2><div class="golevg-detail-meta"><span class="golevg-badge ${badgeClass(c.estado)}">${campaignStatusLabel(c.estado)}</span><span class="golevg-badge wait">Responsable: ${esc(c.responsable_nombre || 'Sin asignar')}</span><span class="golevg-badge wait">Inicio: ${formatDate(c.fecha_inicio)}</span>${c.fecha_cierre ? `<span class="golevg-badge ok">Cierre: ${formatDate(c.fecha_cierre)}</span>` : ''}</div></div><div class="golevg-actions"><button class="golevg-btn primary" id="golevg-detail-form"><i class="fas fa-link"></i> Copiar enlace general de Jotform</button><button class="golevg-btn" id="golevg-detail-refresh"><i class="fas fa-rotate"></i> Actualizar</button><button class="golevg-btn" id="golevg-detail-close">${c.estado === 'CERRADO' ? 'Reabrir' : 'Cerrar levantamiento'}</button></div></div>
      <div class="golevg-help" style="margin-bottom:13px"><b>Recepción automática:</b> el técnico no necesita entrar al sistema ni escoger este levantamiento. Envía el formulario general; la agencia entra aquí cuando su grupo oficial coincide y este es el levantamiento manual abierto del grupo.</div>
      <div class="golevg-stats"><div class="golevg-stat"><span>Agencias inspeccionadas</span><strong>${state.expedients.length}</strong></div><div class="golevg-stat"><span>Problemas activos</span><strong>${activeFindings.length}</strong></div><div class="golevg-stat"><span>Problemas resueltos</span><strong>${state.findings.filter((item) => item.estado === 'RESUELTO').length}</strong></div><div class="golevg-stat"><span>Fotos en R2</span><strong>${state.evidence.filter((item) => item.estado_r2 === 'MIGRADO').length}</strong></div><div class="golevg-stat"><span>Reportes</span><strong>${state.campaignReports.length}</strong></div></div>
      <div class="golevg-tabs" id="golevg-campaign-tabs"><button class="golevg-tab active" data-campaign-tab="AGENCIES">Agencias</button><button class="golevg-tab" data-campaign-tab="PROBLEMS">Agencias por problema</button><button class="golevg-tab" data-campaign-tab="RESOLVED">Resueltos / descartados</button><button class="golevg-tab" data-campaign-tab="REPORTS">Reportes</button></div>
      <div class="golevg-card" id="golevg-campaign-content"></div>`;
    $('#golevg-back').onclick = closeCampaignDetail;
    $('#golevg-detail-form')?.addEventListener('click', copyGeneralJotformLink);
    $('#golevg-detail-refresh').onclick = () => openCampaign(c.id);
    $('#golevg-detail-close').onclick = () => toggleCampaign(c.id, c.estado === 'CERRADO' ? 'ABIERTO' : 'CERRADO');
    $$('[data-campaign-tab]', $('#golevg-campaign-tabs')).forEach((button) => {
      button.onclick = () => {
        $$('[data-campaign-tab]', $('#golevg-campaign-tabs')).forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        state.campaignTab = button.dataset.campaignTab;
        renderCampaignContent();
      };
    });
    renderCampaignContent();
  }

  function closeCampaignDetail() {
    state.selectedCampaign = null;
    $('#golevg-detail').style.display = 'none';
    $('#golevg-detail').innerHTML = '';
    $('[data-main-panel="CAMPAIGNS"]').classList.add('active');
    window.scrollTo({ top: $('#golevg-root').offsetTop - 20, behavior: 'smooth' });
  }

  function evidenceForExpedient(expedientId) {
    return state.evidence.filter((item) => item.expediente_id === expedientId && item.estado_r2 === 'MIGRADO' && item.r2_url);
  }

  function evidenceForFinding(finding) {
    // Un reporte por problema nunca debe heredar fotografías generales del
    // expediente. Solo acepta evidencia vinculada al hallazgo exacto o marcada
    // explícitamente con la misma problema_clave por el webhook.
    return state.evidence.filter((item) => {
      if (item.estado_r2 !== 'MIGRADO' || !item.r2_url) return false;
      if (item.hallazgo_id === finding.id) return true;
      return !item.hallazgo_id && item.metadata?.problema_clave === finding.problema_clave;
    });
  }

  function renderCampaignContent() {
    const holder = $('#golevg-campaign-content');
    if (!holder) return;
    if (state.campaignTab === 'AGENCIES') return renderAgencyTable(holder);
    if (state.campaignTab === 'PROBLEMS') return renderProblemGroups(holder, false);
    if (state.campaignTab === 'RESOLVED') return renderProblemGroups(holder, true);
    renderCampaignReports(holder);
  }

  function renderAgencyTable(holder) {
    if (!state.expedients.length) { holder.innerHTML = '<div class="golevg-empty">Todavía no se han recibido formularios para este levantamiento.</div>'; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>Agencias inspeccionadas</h3><small>Cada agencia conserva su propia fecha, aunque el levantamiento dure varios días.</small></div></div><div class="golevg-table-wrap"><table class="golevg-table"><thead><tr><th>Agencia</th><th>Fecha de inspección</th><th>Técnico</th><th>Estado</th><th>Problemas activos</th><th>Fotos R2</th><th>Acciones</th></tr></thead><tbody>${state.expedients.map((item) => `<tr><td><b>AG ${esc(agencyDisplay(item.agencia_numero))}</b><br><small>Grupo ${esc(item.grupo_codigo)}</small></td><td>${formatDate(item.fecha_inspeccion)}</td><td>${esc(item.tecnico_nombre || '-')}</td><td><span class="golevg-badge ${badgeClass(item.estado)}">${esc(item.estado.replace(/_/g, ' '))}</span></td><td>${item.hallazgos_activos || 0}</td><td>${item.evidencias_count || 0}${state.evidence.some((e) => e.expediente_id === item.id && e.estado_r2 === 'ERROR') ? ' ⚠️' : ''}</td><td><div class="golevg-actions"><button class="golevg-btn small" data-exp-detail="${item.id}">Ver</button>${state.evidence.some((e) => e.expediente_id === item.id && e.estado_r2 !== 'MIGRADO') ? `<button class="golevg-btn small" data-retry-r2="${item.id}">Reintentar fotos</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-exp-detail]', holder).forEach((button) => { button.onclick = () => showExpedient(button.dataset.expDetail); });
    $$('[data-retry-r2]', holder).forEach((button) => { button.onclick = () => retryR2(button.dataset.retryR2); });
  }

  function aggregateProblems(resolved = false) {
    const validStates = resolved ? ['RESUELTO', 'DESCARTADO'] : ['PENDIENTE', 'EN_COORDINACION', 'EN_PROCESO'];
    const map = new Map();
    state.findings.filter((item) => validStates.includes(item.estado)).forEach((finding) => {
      const key = finding.problema_clave;
      const current = map.get(key) || { key, label: finding.problema_etiqueta, findings: [], agencies: new Set(), photos: 0 };
      current.findings.push(finding);
      current.agencies.add(finding.agencia_numero);
      current.photos += evidenceForFinding(finding).length;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.agencies.size - a.agencies.size || a.label.localeCompare(b.label));
  }

  function renderProblemGroups(holder, resolved) {
    const groupsList = aggregateProblems(resolved);
    if (!groupsList.length) { holder.innerHTML = `<div class="golevg-empty">No hay problemas ${resolved ? 'cerrados' : 'activos'} en este levantamiento.</div>`; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>${resolved ? 'Problemas resueltos o descartados' : 'Agencias agrupadas por el mismo problema'}</h3><small>La agrupación se limita a ${esc(state.selectedCampaign.codigo)}. Nunca mezcla otros levantamientos del grupo.</small></div></div><div class="golevg-problem-grid">${groupsList.map((item) => `<article class="golevg-problem"><span class="golevg-code">Levantamiento ${esc(state.selectedCampaign.codigo)}</span><h4>Agencias con ${esc(item.label.toLowerCase())}</h4><p>${item.agencies.size} agencia(s) · ${item.photos} foto(s)</p><div class="golevg-actions" style="margin-top:12px"><button class="golevg-btn small" data-view-problem="${esc(item.key)}" data-resolved="${resolved ? '1' : '0'}">Ver agencias</button>${!resolved ? `<button class="golevg-btn primary small" data-report-problem="${esc(item.key)}">Crear reporte</button><button class="golevg-btn small" data-excel-problem="${esc(item.key)}">Excel</button>` : ''}</div></article>`).join('')}</div>`;
    $$('[data-view-problem]', holder).forEach((button) => { button.onclick = () => showProblem(button.dataset.viewProblem, button.dataset.resolved === '1'); });
    $$('[data-report-problem]', holder).forEach((button) => { button.onclick = () => prepareReport(button.dataset.reportProblem); });
    $$('[data-excel-problem]', holder).forEach((button) => { button.onclick = () => exportProblemExcel(button.dataset.excelProblem); });
  }

  function problemFindings(key, resolved = false) {
    const states = resolved ? ['RESUELTO', 'DESCARTADO'] : ['PENDIENTE', 'EN_COORDINACION', 'EN_PROCESO'];
    return state.findings.filter((item) => item.problema_clave === key && states.includes(item.estado));
  }

  function showProblem(key, resolved = false) {
    const findings = problemFindings(key, resolved);
    if (!findings.length) return;
    const label = findings[0].problema_etiqueta;
    $('#golevg-problem-title').textContent = `Agencias con ${label.toLowerCase()}`;
    $('#golevg-problem-subtitle').textContent = `${state.selectedCampaign.codigo} · Grupo ${state.selectedCampaign.grupo_codigo} · ${findings.length} agencia(s)`;
    $('#golevg-problem-content').innerHTML = findings.map((finding) => {
      const photos = evidenceForFinding(finding);
      return `<article class="golevg-agency-result"><div class="golevg-agency-result-head"><span>AGENCIA ${esc(agencyDisplay(finding.agencia_numero))} · G-${esc(finding.grupo_codigo)}</span><span class="golevg-badge ${badgeClass(finding.estado)}">${findingStatusLabel(finding.estado)}</span></div><div class="golevg-agency-result-body"><p><b>${esc(finding.elemento_etiqueta)}</b> · ${esc(finding.condicion_reportada || '')}</p><p>${esc(finding.descripcion || 'Sin descripción.')}</p>${photos.length ? `<div class="golevg-photo-grid">${photos.map((photo) => `<a class="golevg-photo" href="${esc(photo.r2_url)}" target="_blank" rel="noopener"><img src="${esc(photo.r2_url)}" alt="${esc(photo.etiqueta)}"><div>${esc(photo.etiqueta)}</div></a>`).join('')}</div>` : '<div class="golevg-help">No hay fotografía vinculada a este problema.</div>'}<div class="golevg-actions" style="margin-top:12px">${!resolved ? `<select class="golevg-select" style="width:auto" data-finding-state="${finding.id}"><option value="PENDIENTE" ${finding.estado === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option><option value="EN_COORDINACION" ${finding.estado === 'EN_COORDINACION' ? 'selected' : ''}>En coordinación</option><option value="EN_PROCESO" ${finding.estado === 'EN_PROCESO' ? 'selected' : ''}>En proceso</option><option value="RESUELTO">Resuelto</option><option value="DESCARTADO">Descartado</option></select>` : ''}</div></div></article>`;
    }).join('');
    $$('[data-finding-state]', $('#golevg-problem-content')).forEach((select) => { select.onchange = () => updateFindingState(select.dataset.findingState, select.value); });
    $('#golevg-problem-modal').classList.add('open');
  }

  async function updateFindingState(id, status) {
    if (!requireManage()) return;
    const finding = state.findings.find((item) => item.id === id);
    if (!finding) return;
    let resolution = finding.resolucion || null;
    if (status === 'RESUELTO') {
      resolution = global.prompt('Describe brevemente cómo se resolvió:', resolution || '') || resolution || 'Marcado como resuelto.';
      if (!global.confirm('Al resolverlo, la agencia desaparecerá de los problemas activos y pasará a Resueltos. ¿Continuar?')) return showProblem(finding.problema_clave, false);
    } else if (status === 'DESCARTADO') {
      resolution = global.prompt('Indica por qué se descarta este hallazgo:', resolution || '') || resolution || 'Hallazgo descartado.';
      if (!global.confirm('El hallazgo dejará de aparecer como problema activo. ¿Continuar?')) return showProblem(finding.problema_clave, false);
    }
    const response = await client().from(TABLES.findings).update({ estado: status, resolucion: resolution, resuelto_por: ['RESUELTO','DESCARTADO'].includes(status) ? 'Usuario del sistema' : null }).eq('id', id);
    if (response.error) return toast(response.error.message, 'error');
    toast('Estado del problema actualizado.', 'success');
    closeModal('golevg-problem-modal');
    await openCampaign(state.selectedCampaign.id, { tab: status === 'RESUELTO' ? 'RESOLVED' : 'PROBLEMS' });
  }

  function buildSnapshot(key) {
    return problemFindings(key, false).map((finding) => {
      const expedition = state.expedients.find((item) => item.id === finding.expediente_id);
      return {
        finding_id: finding.id,
        agency_number: finding.agencia_numero,
        group_code: finding.grupo_codigo,
        inspection_date: expedition?.fecha_inspeccion || null,
        technician: expedition?.tecnico_nombre || null,
        element: finding.elemento_etiqueta,
        condition: finding.condicion_reportada,
        description: finding.descripcion,
        priority: finding.prioridad,
        photos: evidenceForFinding(finding).map((photo) => ({ url: photo.r2_url, label: photo.etiqueta, name: photo.nombre_archivo }))
      };
    });
  }

  function prepareReport(key, existing = null) {
    const findings = problemFindings(key, false);
    const label = existing?.problema_etiqueta || findings[0]?.problema_etiqueta;
    if (!label) return toast('No hay agencias activas para este problema.', 'error');
    state.reportEditing = existing;
    state.reportProblem = { key, label };
    const currentRows = buildSnapshot(key);
    if (existing?.snapshot?.length) {
      const existingIds = new Set(existing.snapshot.map((item) => item.finding_id));
      state.reportSnapshot = [
        ...existing.snapshot.map((item) => ({ ...item, _included: true })),
        ...currentRows.filter((item) => !existingIds.has(item.finding_id)).map((item) => ({ ...item, _included: false }))
      ];
    } else state.reportSnapshot = currentRows.map((item) => ({ ...item, _included: true }));
    $('#golevg-r-title').value = existing?.titulo || `Agencias con ${label.toLowerCase()}`;
    $('#golevg-r-responsible').value = existing?.responsable_nombre || state.selectedCampaign.responsable_nombre || '';
    $('#golevg-r-status').value = existing?.estado || 'BORRADOR';
    $('#golevg-r-observation').value = existing?.observacion || '';
    renderReportItems();
    $('#golevg-report-modal').classList.add('open');
  }

  function renderReportItems() {
    $('#golevg-r-items').innerHTML = state.reportSnapshot.map((item, index) => `<label class="golevg-check-row"><input type="checkbox" data-report-index="${index}" ${item._included === false ? '' : 'checked'}><b>AG ${esc(agencyDisplay(item.agency_number))}</b><span>${esc(item.description || item.element || '')}</span><small>${(item.photos || []).length} foto(s)</small></label>`).join('') || '<div class="golevg-empty">No hay agencias disponibles.</div>';
  }

  async function saveReport() {
    if (!requireManage()) return;
    const included = $$('[data-report-index]:checked', $('#golevg-r-items')).map((input) => state.reportSnapshot[Number(input.dataset.reportIndex)]).filter(Boolean).map(({ _included, ...item }) => item);
    if (!included.length) return toast('Selecciona al menos una agencia.', 'error');
    const payload = {
      campana_id: state.selectedCampaign.id,
      problema_clave: state.reportProblem.key,
      problema_etiqueta: state.reportProblem.label,
      titulo: text($('#golevg-r-title').value) || `Agencias con ${state.reportProblem.label.toLowerCase()}`,
      responsable_nombre: text($('#golevg-r-responsible').value) || null,
      observacion: text($('#golevg-r-observation').value) || null,
      estado: $('#golevg-r-status').value,
      agencias_count: included.length,
      fotos_count: included.reduce((sum, item) => sum + (item.photos || []).length, 0),
      snapshot: included
    };
    const response = state.reportEditing
      ? await client().from(TABLES.reports).update(payload).eq('id', state.reportEditing.id).select('*').single()
      : await client().from(TABLES.reports).insert(payload).select('*').single();
    if (response.error) return toast(response.error.message, 'error');
    closeModal('golevg-report-modal');
    toast('Reporte guardado correctamente.', 'success');
    await loadAll();
    await openCampaign(state.selectedCampaign.id, { tab: 'REPORTS' });
  }

  function renderCampaignReports(holder) {
    if (!state.campaignReports.length) { holder.innerHTML = '<div class="golevg-empty">Todavía no se han creado reportes para este levantamiento.</div>'; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>Reportes guardados</h3><small>El contenido queda congelado al guardarse.</small></div></div><div class="golevg-report-grid">${state.campaignReports.map(reportCard).join('')}</div>`;
    bindReportCards(holder);
  }

  function reportCard(report) {
    return `<article class="golevg-report"><span class="golevg-code">${esc(report.codigo || 'Reporte')}</span><h4>${esc(report.titulo)}</h4><div class="golevg-report-info"><div><span>Grupo</span><b>${esc(report.ops_levantamiento_campanas?.grupo_codigo || (state.selectedCampaign?.id === report.campana_id ? state.selectedCampaign.grupo_codigo : '-'))}</b></div><div><span>Responsable</span><b>${esc(report.responsable_nombre || '-')}</b></div><div><span>Fecha</span><b>${formatDate(report.creado_en)}</b></div><div><span>Contenido</span><b>${report.agencias_count} agencias · ${report.fotos_count} fotos</b></div></div><p style="font-size:12px;color:#6d8394">${esc(report.observacion || 'Sin observación.')}</p><div class="golevg-actions"><button class="golevg-btn primary small" data-print-report="${report.id}">Generar PDF</button><button class="golevg-btn small" data-edit-report="${report.id}">Ver / Editar</button><button class="golevg-btn small" data-excel-report="${report.id}">Excel</button><button class="golevg-btn danger small" data-delete-report="${report.id}">Eliminar</button></div></article>`;
  }

  function renderAllReports() {
    const holder = $('#golevg-all-reports');
    if (!state.allReports.length) { holder.innerHTML = '<div class="golevg-empty">No hay reportes guardados.</div>'; return; }
    holder.innerHTML = state.allReports.map(reportCard).join('');
    bindReportCards(holder);
  }

  function bindReportCards(holder) {
    $$('[data-print-report]', holder).forEach((button) => { button.onclick = () => printReport(findReport(button.dataset.printReport)); });
    $$('[data-edit-report]', holder).forEach((button) => {
      button.onclick = async () => {
        let report = findReport(button.dataset.editReport);
        if (!report) return;
        if (!state.selectedCampaign || state.selectedCampaign.id !== report.campana_id) await openCampaign(report.campana_id);
        report = state.campaignReports.find((item) => item.id === report.id) || report;
        prepareReport(report.problema_clave, report);
      };
    });
    $$('[data-excel-report]', holder).forEach((button) => { button.onclick = () => exportReportExcel(findReport(button.dataset.excelReport)); });
    $$('[data-delete-report]', holder).forEach((button) => { button.onclick = () => deleteReport(button.dataset.deleteReport); });
  }

  function findReport(id) {
    return state.campaignReports.find((item) => item.id === id) || state.allReports.find((item) => item.id === id) || null;
  }

  async function deleteReport(id) {
    if (!requireManage()) return;
    if (!global.confirm('¿Eliminar este reporte guardado?')) return;
    const response = await client().from(TABLES.reports).delete().eq('id', id);
    if (response.error) return toast(response.error.message, 'error');
    toast('Reporte eliminado.', 'success');
    if (state.selectedCampaign) { await loadAll(); await openCampaign(state.selectedCampaign.id, { tab: 'REPORTS' }); } else await loadAll();
  }

  function printableHtml(report) {
    const campaign = state.campaigns.find((item) => item.id === report.campana_id) || state.selectedCampaign || report.ops_levantamiento_campanas || {};
    const rows = Array.isArray(report.snapshot) ? report.snapshot : [];
    const agencyHtml = rows.map((item) => `<section class="agency"><h2>AGENCIA ${esc(agencyDisplay(item.agency_number))} · G-${esc(item.group_code || campaign.grupo_codigo || '-')}</h2><div class="body">${(item.photos || []).length ? `<div class="photos">${item.photos.map((photo) => `<img src="${esc(photo.url)}" alt="Evidencia">`).join('')}</div>` : '<div class="no-photo">Sin fotografía</div>'}<div class="description"><b>${esc(item.element || '')}</b><p>${esc(item.description || '')}</p><small>Inspección: ${formatDate(item.inspection_date)} · Técnico: ${esc(item.technician || '-')}</small></div></div></section>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.titulo)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17364d;margin:0}header{border-bottom:2px solid #bcdcea;padding-bottom:14px;margin-bottom:18px}header h1{font-size:21px;color:#0a4369;margin:0 0 8px;text-transform:uppercase}header p{font-size:12px;margin:3px 0;color:#536e82}.agency{page-break-inside:avoid;margin:0 0 22px}.agency h2{font-size:14px;background:#e5f3fb;border:1px solid #bcddeb;border-radius:9px;padding:8px 11px;color:#0a4165}.body{display:grid;grid-template-columns:42% 1fr;gap:18px;border:1px solid #d8e6ed;border-radius:10px;padding:11px}.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.photos img{width:100%;max-height:240px;object-fit:contain;background:#eef3f5;border-radius:6px}.description{font-size:13px;line-height:1.45}.description p{white-space:pre-wrap}.description small{color:#6c8190}.no-photo{background:#f2f5f7;padding:35px;text-align:center;color:#80909a;border-radius:6px}@media print{button{display:none}}</style></head><body><header><h1>GRUPO ${esc(campaign.grupo_codigo || '-')}</h1><h1>${esc(report.titulo)}</h1><p>Levantamiento: ${esc(campaign.codigo || '-')} · Fecha del reporte: ${formatDate(report.creado_en || new Date().toISOString())}</p><p>Responsable: ${esc(report.responsable_nombre || campaign.responsable_nombre || '-')} · Agencias: ${rows.length} · Fotografías: ${report.fotos_count || 0}</p>${report.observacion ? `<p>${esc(report.observacion)}</p>` : ''}</header>${agencyHtml}<script>window.onload=function(){var imgs=Array.from(document.images);var pending=imgs.filter(function(img){return !img.complete;});var done=false;function printNow(){if(done)return;done=true;setTimeout(function(){window.print();},250)};pending.forEach(function(img){img.addEventListener('load',printIfReady,{once:true});img.addEventListener('error',printIfReady,{once:true})});function printIfReady(){pending=pending.filter(function(img){return !img.complete});if(!pending.length)printNow()}if(!pending.length)printNow();setTimeout(printNow,7000)};<\/script></body></html>`;
  }

  function printReport(report) {
    if (!report?.id) return toast('No se encontró el reporte.', 'error');
    const win = global.open('', '_blank');
    if (!win) return toast('El navegador bloqueó la ventana del PDF.', 'error');
    win.document.open(); win.document.write(printableHtml(report)); win.document.close();
  }

  function downloadExcel(rows, fileName, title) {
    if (!rows.length) return toast('No hay datos para exportar.', 'error');
    const headers = Object.keys(rows[0]);
    const safe = (value) => esc(value == null ? '' : value);
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h2>${safe(title)}</h2><table border="1"><thead><tr>${headers.map((header) => `<th>${safe(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${safe(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
  }

  function exportProblemExcel(key) {
    const findings = problemFindings(key, false);
    if (!findings.length) return;
    const rows = findings.map((finding) => {
      const expedition = state.expedients.find((item) => item.id === finding.expediente_id);
      return { Agencia: agencyDisplay(finding.agencia_numero), Grupo: finding.grupo_codigo, Problema: finding.problema_etiqueta, Elemento: finding.elemento_etiqueta, Condición: finding.condicion_reportada, Descripción: finding.descripcion, Fecha: formatDate(expedition?.fecha_inspeccion), Técnico: expedition?.tecnico_nombre || '', Fotos: evidenceForFinding(finding).map((photo) => photo.r2_url).join(' | ') };
    });
    downloadExcel(rows, `${state.selectedCampaign.codigo}_${key}.xls`, `Grupo ${state.selectedCampaign.grupo_codigo} - ${findings[0].problema_etiqueta}`);
  }

  function exportReportExcel(report) {
    if (!report?.id) return;
    const rows = (report.snapshot || []).map((item) => ({ Agencia: agencyDisplay(item.agency_number), Grupo: item.group_code, Problema: report.problema_etiqueta, Elemento: item.element, Condición: item.condition, Descripción: item.description, Fecha: formatDate(item.inspection_date), Técnico: item.technician || '', Fotos: (item.photos || []).map((photo) => photo.url).join(' | ') }));
    downloadExcel(rows, `${report.codigo || 'reporte'}.xls`, report.titulo);
  }

  function photoCards(photos) {
    if (!photos.length) return '<div class="golevg-empty">Sin fotografía asociada.</div>';
    return `<div class="golevg-photo-grid">${photos.map((photo) => `<a class="golevg-photo" href="${esc(photo.r2_url)}" target="_blank" rel="noopener"><img src="${esc(photo.r2_url)}" loading="lazy" alt="${esc(photo.etiqueta || 'Evidencia')}"><div>${esc(photo.etiqueta || 'Evidencia')}</div></a>`).join('')}</div>`;
  }

  async function showExpedient(id) {
    const item = state.expedients.find((row) => row.id === id);
    if (!item) return;
    const findings = state.findings.filter((row) => row.expediente_id === id);
    const photos = evidenceForExpedient(id);
    const usedPhotoIds = new Set();

    const findingSections = findings.map((finding) => {
      const linkedPhotos = evidenceForFinding(finding).filter((photo) => photo.expediente_id === id);
      linkedPhotos.forEach((photo) => usedPhotoIds.add(photo.id));
      return `<section class="golevg-card" style="margin-top:12px">
        <div class="golevg-card-head"><div><span class="golevg-code">${esc(finding.area_etiqueta || 'Hallazgo')}</span><h3>${esc(finding.problema_etiqueta)}</h3></div><span class="golevg-badge ${badgeClass(finding.estado)}">${esc((finding.estado || '').replace(/_/g, ' '))}</span></div>
        <p><b>Elemento:</b> ${esc(finding.elemento_etiqueta || '-')}</p>
        <p><b>Condición:</b> ${esc(finding.condicion_reportada || '-')}</p>
        <p><b>Descripción:</b> ${esc(finding.descripcion || 'Sin descripción.')}</p>
        <div style="margin-top:10px"><b>Evidencias de este problema</b>${photoCards(linkedPhotos)}</div>
      </section>`;
    }).join('');

    const generalPhotos = photos.filter((photo) => !usedPhotoIds.has(photo.id));
    $('#golevg-problem-title').textContent = `Agencia ${agencyDisplay(item.agencia_numero)}`;
    $('#golevg-problem-subtitle').textContent = `${state.selectedCampaign.codigo} · Inspección ${formatDate(item.fecha_inspeccion)}`;
    $('#golevg-problem-content').innerHTML = `
      <div class="golevg-grid"><div class="golevg-card"><span class="golevg-code">Técnico</span><h3>${esc(item.tecnico_nombre || '-')}</h3></div><div class="golevg-card"><span class="golevg-code">Resultado</span><h3>${esc(item.estado.replace(/_/g, ' '))}</h3></div></div>
      <div class="golevg-card" style="margin-top:12px"><h3>Observación general</h3><p>${esc(item.observacion_general || 'Sin observación.')}</p></div>
      <div class="golevg-card" style="margin-top:12px"><div class="golevg-card-head"><div><h3>Hallazgos y evidencias asociadas</h3><small>Cada fotografía aparece únicamente en el problema que la originó.</small></div>${item.jotform_submission_id ? `<button class="golevg-btn small" id="golevg-rebuild-evidence">Sincronizar evidencias desde Jotform</button>` : ''}</div>${findings.length ? findingSections : '<div class="golevg-empty">Sin hallazgos detectados.</div>'}</div>
      ${generalPhotos.length ? `<div class="golevg-card" style="margin-top:12px"><h3>Otras fotografías del levantamiento</h3><p style="font-size:12px;color:#6d8394">Son evidencias informativas de elementos que no generaron un problema. No se incluyen en reportes de otros hallazgos.</p>${photoCards(generalPhotos)}</div>` : ''}`;
    const rebuildButton = $('#golevg-rebuild-evidence');
    if (rebuildButton) rebuildButton.onclick = () => retryR2(item.id);
    $('#golevg-problem-modal').classList.add('open');
  }
  async function retryR2(expedientId) {
    if (!requireManage()) return;
    toast('Reconstruyendo las fotografías reales desde Jotform y trasladándolas a R2…', 'info');
    const response = await fetch('/api/jotform-levantamientos?action=retry', { method: 'POST', headers: await apiHeaders(true), body: JSON.stringify({ expedienteId: expedientId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast(data.message || 'No se pudieron reprocesar las fotos.', 'error');
    toast(`${data.rebuilt ?? data.retried ?? 0} archivo(s) detectado(s); ${data.migrated || 0} migrado(s) a R2; ${data.deduplicated || 0} duplicado(s) técnico(s) eliminado(s); ${data.errors || 0} con error.`, data.errors ? 'info' : 'success');
    openCampaign(state.selectedCampaign.id);
  }

  async function copyGeneralJotformLink() {
    const config = await loadConfig(true);
    const url = text(config?.formUrl);
    if (!url) return toast('Falta configurar JOTFORM_LEVANTAMIENTOS_FORM_URL en Vercel.', 'error');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const area = document.createElement('textarea');
        area.value = url;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      toast('Enlace general de Jotform copiado. Este mismo enlace se comparte con todos los técnicos.', 'success');
    } catch (_error) {
      global.prompt('Copia el enlace general de Jotform:', url);
    }
  }

  function agenciesForCampaign(campaign) {
    const expectedGroup = normalizeGroup(campaign.grupo_codigo);
    return agencies().filter((agency) => agencyGroupCode(agency) === expectedGroup);
  }

  async function openJotformModal(campaignId, context = null) {
    const campaign = state.campaigns.find((item) => item.id === campaignId) || state.selectedCampaign;
    if (!campaign) return toast('No se encontró el levantamiento.', 'error');
    if (campaign.estado !== 'ABIERTO') return toast('El levantamiento debe estar abierto para recibir formularios.', 'error');
    state.sourceContext = context || state.sourceContext;
    const list = agenciesForCampaign(campaign).sort((a, b) => Number(agencyNumber(a)) - Number(agencyNumber(b)));
    $('#golevg-j-agency').innerHTML = '<option value="">Selecciona una agencia</option>' + list.map((agency) => `<option value="${agencyId(agency)}" data-number="${agencyNumber(agency)}">AG ${agencyDisplay(agencyNumber(agency))} · ${esc(agencyName(agency))}</option>`).join('');
    if (context?.agencyId) $('#golevg-j-agency').value = context.agencyId;
    $('#golevg-j-tech').value = context?.responsible || campaign.responsable_nombre || '';
    $('#golevg-j-date').value = today();
    $('#golevg-jotform-campaign').textContent = `${campaign.codigo} · Grupo ${campaign.grupo_codigo}`;
    const config = await loadConfig();
    $('#golevg-j-help').innerHTML = config.formUrl ? `El formulario está configurado. Se enviará con <b>${esc(campaign.codigo)}</b> y no se mezclará con otro levantamiento.` : 'Falta configurar JOTFORM_LEVANTAMIENTOS_FORM_URL en Vercel.';
    $('#golevg-jotform-modal').dataset.campaignId = campaign.id;
    $('#golevg-jotform-modal').classList.add('open');
  }

  function buildJotformUrl(campaign, agency, context) {
    const base = campaign.jotform_form_url || state.config?.formUrl;
    if (!base) return '';
    const url = new URL(base, global.location.origin);
    const origin = context?.origin || campaign.origen || 'MANUAL';
    const originRecordId = context?.originRecordId || '';
    const values = {
      levantamiento_id: campaign.id,
      levantamiento_codigo: campaign.codigo,
      grupo_codigo: campaign.grupo_codigo,
      agencia_id: agencyId(agency),
      agencia_numero: agencyNumber(agency),
      tecnico: text($('#golevg-j-tech').value),
      fecha_inspeccion: $('#golevg-j-date').value || today(),
      origen: origin,
      origen_id: originRecordId
    };
    Object.entries(values).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    return url.toString();
  }

  function launchJotform() {
    if (!requireManage()) return;
    const campaignId = $('#golevg-jotform-modal').dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId) || state.selectedCampaign;
    const selectedId = $('#golevg-j-agency').value;
    const agency = agencyByIdOrNumber(selectedId, $('#golevg-j-agency').selectedOptions?.[0]?.dataset?.number);
    if (!agency) return toast('Selecciona una agencia del grupo.', 'error');
    const url = buildJotformUrl(campaign, agency, state.sourceContext);
    if (!url) return toast('Falta configurar la URL del formulario de Jotform.', 'error');
    const opened = global.open(url, '_blank');
    if (!opened) return toast('El navegador bloqueó la ventana de Jotform.', 'error');
    try { opened.opener = null; } catch (_error) {}
    closeModal('golevg-jotform-modal');
    toast(`Jotform abierto para AG ${agencyDisplay(agencyNumber(agency))} dentro de ${campaign.codigo}.`, 'success');
    state.sourceContext = null;
  }

  function renderPending() {
    const holder = $('#golevg-pending');
    if (!state.intakes.length) { holder.innerHTML = '<div class="golevg-empty">No hay formularios pendientes ni errores de recepción.</div>'; return; }
    holder.innerHTML = `<div class="golevg-table-wrap"><table class="golevg-table"><thead><tr><th>Submission</th><th>Estado</th><th>Fecha recibida</th><th>Código recibido</th><th>Motivo</th><th>Acción</th></tr></thead><tbody>${state.intakes.map((item) => `<tr><td><b>${esc(item.submission_id)}</b></td><td><span class="golevg-badge ${item.estado === 'ERROR' ? 'warn' : 'wait'}">${esc(item.estado)}</span></td><td>${formatDate(item.recibido_en, true)}</td><td>${esc(item.levantamiento_codigo_recibido || '-')}</td><td>${esc(item.error || 'Sin levantamiento válido')}</td><td>${item.estado === 'PENDIENTE_VINCULO' ? `<button class="golevg-btn primary small" data-link-intake="${item.id}">Vincular</button>` : '<span style="font-size:11px;color:#7b8f9c">Corrige el motivo y reenvía desde Jotform.</span>'}</td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-link-intake]', holder).forEach((button) => { button.onclick = () => openLinkModal(button.dataset.linkIntake); });
  }

  function openLinkModal(intakeId) {
    const openCampaigns = state.campaigns.filter((item) => item.estado === 'ABIERTO');
    if (!openCampaigns.length) return toast('No hay levantamientos abiertos.', 'error');
    $('#golevg-link-intake').value = intakeId;
    $('#golevg-link-campaign').innerHTML = openCampaigns.map((item) => `<option value="${item.id}">${esc(item.codigo)} · Grupo ${esc(item.grupo_codigo)} · ${esc(item.nombre)}</option>`).join('');
    $('#golevg-link-modal').classList.add('open');
  }

  async function linkIntake() {
    if (!requireManage()) return;
    const intakeId = $('#golevg-link-intake').value;
    const campaignId = $('#golevg-link-campaign').value;
    const response = await fetch('/api/jotform-levantamientos?action=link', { method: 'POST', headers: await apiHeaders(true), body: JSON.stringify({ intakeId, campaignId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return toast(data.message || 'No se pudo vincular.', 'error');
    closeModal('golevg-link-modal');
    toast(`Formulario vinculado a ${data.campaignCode}.`, 'success');
    await loadAll();
  }

  async function ensureOriginCampaign(context) {
    const connected = client();
    const groupCode = normalizeGroup(context.groupCode);
    if (!groupCode) throw new Error('No se pudo identificar el grupo de la agencia.');
    const origin = context.origin;
    const originId = text(context.originId || context.planId || context.controlId || `AUTO-${groupCode}`);
    const existing = await connected.from(TABLES.campaigns).select('*').eq('origen', origin).eq('origen_id', originId).eq('grupo_codigo', groupCode).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (!['ABIERTO', 'EN_REVISION'].includes(existing.data.estado)) {
        const reopened = await connected.from(TABLES.campaigns).update({ estado: 'ABIERTO' }).eq('id', existing.data.id).select('*').single();
        if (reopened.error) throw reopened.error;
        return reopened.data;
      }
      return existing.data;
    }
    const inserted = await connected.from(TABLES.campaigns).insert({
      grupo_id: context.groupId || null,
      grupo_codigo: groupCode,
      nombre: context.name || (origin === 'MANTENIMIENTO_PREVENTIVO' ? 'Levantamiento de mantenimiento preventivo' : 'Levantamiento solicitado por Control técnico'),
      responsable_nombre: context.responsible || null,
      origen,
      origen_id: originId,
      estado: 'ABIERTO',
      fecha_inicio: today(),
      metadata: context.metadata || {}
    }).select('*').single();
    if (inserted.error) throw inserted.error;
    state.campaigns.unshift(inserted.data);
    return inserted.data;
  }

  async function openFromMaintenance(context) {
    if (!requireManage()) return;
    try {
      await open($('#navLevantamientos'));
      const campaign = await ensureOriginCampaign({ ...context, origin: 'MANTENIMIENTO_PREVENTIVO', originId: context.planId });
      await loadAll();
      await openCampaign(campaign.id);
      await openJotformModal(campaign.id, { origin: 'MANTENIMIENTO_PREVENTIVO', originRecordId: context.planAgencyId, agencyId: context.agencyId, responsible: context.responsible });
    } catch (error) { toast(error.message || 'No se pudo abrir el levantamiento de mantenimiento.', 'error'); }
  }

  async function openFromControl(context) {
    if (!requireManage()) return;
    try {
      await open($('#navLevantamientos'));
      const campaign = await ensureOriginCampaign({ ...context, origin: 'CONTROL_TECNICO', originId: context.originId || context.controlId || `CONTROL-${normalizeGroup(context.groupCode)}` });
      await loadAll();
      await openCampaign(campaign.id);
      if (context.agencyId) await openJotformModal(campaign.id, { origin: 'CONTROL_TECNICO', originRecordId: context.controlId, agencyId: context.agencyId, responsible: context.responsible });
    } catch (error) { toast(error.message || 'No se pudo abrir el levantamiento técnico.', 'error'); }
  }

  function switchMainTab(tab) {
    state.mainTab = tab;
    $$('.golevg-tab[data-main]', $('#golevg-main-tabs')).forEach((button) => button.classList.toggle('active', button.dataset.main === tab));
    $$('[data-main-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.mainPanel === tab));
    $('#golevg-detail').style.display = 'none';
  }

  function closeModal(id) {
    $(`#${id}`)?.classList.remove('open');
    if (id === 'golevg-jotform-modal') state.sourceContext = null;
  }

  function subscribeRealtime() {
    if (state.realtime || !client()?.channel) return;
    try {
      state.realtime = client().channel('ops-levantamientos-grupo-v807')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.campaigns }, () => state.selectedCampaign ? openCampaign(state.selectedCampaign.id) : loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.agencies }, () => state.selectedCampaign ? openCampaign(state.selectedCampaign.id) : loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.findings }, () => state.selectedCampaign ? openCampaign(state.selectedCampaign.id) : loadAll())
        .subscribe();
    } catch (_error) {}
  }

  function bind() {
    if (state.initialized) return;
    state.initialized = true;
    $('#golevg-refresh').onclick = () => state.selectedCampaign ? openCampaign(state.selectedCampaign.id) : loadAll();
    $('#golevg-new').onclick = openCampaignModal;
    $('#golevg-copy-form').onclick = copyGeneralJotformLink;
    $('#golevg-save-campaign').onclick = createCampaign;
    $('#golevg-open-jotform').onclick = launchJotform;
    $('#golevg-save-report').onclick = saveReport;
    $('#golevg-link-save').onclick = linkIntake;
    $('#golevg-search').oninput = applyCampaignFilters;
    $('#golevg-status').onchange = applyCampaignFilters;
    $('#golevg-group').onchange = applyCampaignFilters;
    $('#golevg-clear').onclick = () => { $('#golevg-search').value = ''; $('#golevg-status').value = ''; $('#golevg-group').value = ''; applyCampaignFilters(); };
    $$('[data-main]', $('#golevg-main-tabs')).forEach((button) => { button.onclick = () => switchMainTab(button.dataset.main); });
    $$('[data-close]', $('#vista-ops-levantamientos')).forEach((button) => { button.onclick = () => closeModal(button.dataset.close); });
    $$('.golevg-modal', $('#vista-ops-levantamientos')).forEach((modal) => { modal.onclick = (event) => { if (event.target === modal) closeModal(modal.id); }; });
    subscribeRealtime();
  }

  function installAgencyDetailBridge() {
    global.agencyRenderLevantamientos = async function (agency) {
      const body = $('#agencyLevantamientosBody');
      if (!body) return;
      const number = agencyNumber(agency);
      if (!number || !client()) { body.innerHTML = '<tr><td colspan="6">Sin levantamientos.</td></tr>'; return; }
      body.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
      const result = await client().from(TABLES.agencies).select('*, ops_levantamiento_campanas(codigo,grupo_codigo,nombre,estado)').eq('agencia_numero', number).order('fecha_inspeccion', { ascending: false });
      if (result.error || !result.data?.length) { body.innerHTML = '<tr><td colspan="6">Sin levantamientos registrados.</td></tr>'; return; }
      body.innerHTML = result.data.map((item) => `<tr><td><b>${esc(item.ops_levantamiento_campanas?.codigo || '-')}</b></td><td>${formatDate(item.fecha_inspeccion)}</td><td>${esc(item.tecnico_nombre || '-')}</td><td>${esc(item.estado.replace(/_/g, ' '))}</td><td>${item.hallazgos_activos || 0}</td><td><button class="btn-secondary" onclick="GOLevantamientosGrupos.openCampaign('${item.campana_id}')">Abrir</button></td></tr>`).join('');
    };
  }

  function scheduleLegacyLoad() {
    clearTimeout(state.legacyLoadTimer);
    state.legacyLoadTimer = setTimeout(async () => {
      const host = $('#vista-ops-levantamientos');
      if (!host || host.classList.contains('hidden') || state.loadingAll) return;
      state.loadingAll = true;
      try {
        injectStyles(); injectView(); bind();
        await Promise.all([loadConfig(), loadCatalog()]);
        await loadAll();
      } finally {
        state.loadingAll = false;
      }
    }, 70);
  }

  function installLegacyNavigationBridge() {
    global.levRender = scheduleLegacyLoad;
    const host = $('#vista-ops-levantamientos');
    if (!host || host.dataset.golevgObserverReady) return;
    host.dataset.golevgObserverReady = '1';
    const observer = new MutationObserver(() => {
      if (!host.classList.contains('hidden')) scheduleLegacyLoad();
    });
    observer.observe(host, { attributes: true, attributeFilter: ['class'] });
  }

  function init() {
    injectStyles(); injectView(); installNavigation(); bind(); installAgencyDetailBridge(); installLegacyNavigationBridge();
    try { runtime()?.modules?.register?.('levantamientos-grupos', { version: VERSION, open, refresh: loadAll }); } catch (_error) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);

  global.GOLevantamientosGrupos = {
    version: VERSION,
    open,
    refresh: loadAll,
    openCampaign: async (id) => { await open($('#navLevantamientos')); return openCampaign(id); },
    openFromMaintenance,
    openFromControl,
    copyGeneralJotformLink
  };
  global.GOLevantamientos = global.GOLevantamientosGrupos;
})(window);
