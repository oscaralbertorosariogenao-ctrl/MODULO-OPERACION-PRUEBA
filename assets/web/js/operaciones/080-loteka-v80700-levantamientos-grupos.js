(function (global) {
  'use strict';

  if (global.GOLevantamientosGrupos?.version === '808.28') return;

  const VERSION = '808.28';
  const UI_STATE_KEY = 'go-levantamientos-ui-v1';
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
    mainTab: 'SUMMARY',
    reportEditing: null,
    reportSnapshot: [],
    reportProblem: null,
    sourceContext: null,
    realtime: null,
    realtimeRefreshTimer: null,
    legacyLoadTimer: null,
    pendingCleanups: [],
    deleteContext: null,
    uiRestoring: false,
    scrollSaveTimer: null,
    loadingAll: false,
    catalogGroups: [],
    catalogAgencies: [],
    catalogLoaded: false,
    summary: null,
    summaryRecent: [],
    recentActivity: [],
    campaignTotal: 0,
    currentListStatus: null,
    openPage: 0,
    closedPage: 0,
    listPageSize: 20,
    reportPage: 0,
    reportPageSize: 24,
    reportTotal: 0,
    globalSearchResults: [],
    listSearchTimer: null,
    detailReturnTab: 'SUMMARY'
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

  function isModuleVisible() {
    const host = $('#vista-ops-levantamientos');
    return !!(host && !host.classList.contains('hidden') && !host.closest('.hidden'));
  }

  function readUiState() {
    try {
      const raw = sessionStorage.getItem(UI_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) { return null; }
  }

  function clearUiState() {
    try { sessionStorage.removeItem(UI_STATE_KEY); } catch (_error) {}
  }

  function captureUiState(scrollOverride) {
    return {
      version: 2,
      mainTab: state.mainTab || 'SUMMARY',
      campaignTab: state.campaignTab || 'AGENCIES',
      selectedCampaignId: state.selectedCampaign?.id || null,
      open: {
        search: $('#golevg-open-search')?.value || '',
        group: $('#golevg-open-group')?.value || '',
        date: $('#golevg-open-date')?.value || '',
        sort: $('#golevg-open-sort')?.value || 'ULTIMA_ACTIVIDAD',
        page: state.openPage || 0
      },
      closed: {
        search: $('#golevg-closed-search')?.value || '',
        group: $('#golevg-closed-group')?.value || '',
        date: $('#golevg-closed-date')?.value || '',
        sort: $('#golevg-closed-sort')?.value || 'RECIENTES',
        page: state.closedPage || 0
      },
      reports: { page: state.reportPage || 0 },
      globalSearch: $('#golevg-global-search')?.value || '',
      scrollY: Number.isFinite(Number(scrollOverride)) ? Number(scrollOverride) : Math.max(0, Number(global.scrollY || 0)),
      savedAt: Date.now()
    };
  }

  function saveUiState(scrollOverride) {
    if (state.uiRestoring) return;
    try { sessionStorage.setItem(UI_STATE_KEY, JSON.stringify(captureUiState(scrollOverride))); } catch (_error) {}
  }

  function applyStoredFilters(saved) {
    if (!saved) return;
    const legacySearch = text(saved.search);
    const legacyGroup = normalizeGroup(saved.group);
    const open = saved.open || {};
    const closed = saved.closed || {};
    if ($('#golevg-open-search')) $('#golevg-open-search').value = text(open.search || legacySearch);
    if ($('#golevg-open-date')) $('#golevg-open-date').value = text(open.date);
    if ($('#golevg-open-sort')) $('#golevg-open-sort').value = text(open.sort) || 'ULTIMA_ACTIVIDAD';
    if ($('#golevg-closed-search')) $('#golevg-closed-search').value = text(closed.search || legacySearch);
    if ($('#golevg-closed-date')) $('#golevg-closed-date').value = text(closed.date);
    if ($('#golevg-closed-sort')) $('#golevg-closed-sort').value = text(closed.sort) || 'RECIENTES';
    if ($('#golevg-global-search')) $('#golevg-global-search').value = text(saved.globalSearch);
    state.openPage = Math.max(0, Number(open.page || 0));
    state.closedPage = Math.max(0, Number(closed.page || 0));
    state.reportPage = Math.max(0, Number(saved.reports?.page || 0));

    const setGroup = (selector, wantedRaw) => {
      const element = $(selector);
      if (!element) return;
      const wanted = normalizeGroup(wantedRaw || legacyGroup);
      const optionExists = [...element.options].some((option) => normalizeGroup(option.value) === wanted);
      element.value = wanted && optionExists ? wanted : '';
    };
    setGroup('#golevg-open-group', open.group);
    setGroup('#golevg-closed-group', closed.group);
  }

  function restoreScroll(saved) {
    const top = Math.max(0, Number(saved?.scrollY || 0));
    requestAnimationFrame(() => requestAnimationFrame(() => global.scrollTo({ top, behavior: 'auto' })));
  }

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

  function canDelete() {
    // Acción destructiva: SIN fallback por nombre de rol. El backend vuelve a
    // validar el mismo permiso antes de tocar Supabase o Cloudflare R2.
    return hasPermission('eliminar_levantamiento');
  }

  function requireDelete() {
    if (canDelete()) return true;
    toast('No tienes permiso para eliminar levantamientos.', 'error');
    return false;
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

  async function deleteApi(payload) {
    const response = await fetch('/api/levantamientos-delete', {
      method: 'POST',
      headers: await apiHeaders(true),
      cache: 'no-store',
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 207) {
      const error = new Error(data.message || `El backend respondió ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return data;
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

  function formatDateTime(value) {
    return formatDate(value, true);
  }

  function relativeTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatDateTime(value);
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Hace menos de 1 minuto';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} día${days === 1 ? '' : 's'}`;
  }

  function durationText(startValue, endValue = null, precise = true) {
    if (!startValue) return '-';
    const raw = String(startValue);
    const start = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
    const endRaw = endValue ? String(endValue) : '';
    const end = endValue ? new Date(endRaw.length === 10 ? `${endRaw}T23:59:59` : endRaw) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
    const totalHours = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 3600000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (!precise) {
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      const daysBetween = Math.max(0, Math.round((endDay.getTime() - startDay.getTime()) / 86400000));
      return `${daysBetween} día${daysBetween === 1 ? '' : 's'}`;
    }
    if (!days) return `${hours} hora${hours === 1 ? '' : 's'}`;
    return `${days} día${days === 1 ? '' : 's'}${hours ? ` ${hours} hora${hours === 1 ? '' : 's'}` : ''}`;
  }

  function debounce(fn, wait = 320) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
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
    if (/CON_HALLAZGOS|PENDIENTE/.test(status)) return 'warn';
    if (/ARCHIVADO|ANULADO|DESCARTADO/.test(status)) return 'muted';
    return 'wait';
  }

  function injectStyles() {
    if ($('#golevg-style')) return;
    const style = document.createElement('style');
    style.id = 'golevg-style';
    style.textContent = `
      #golevg-root{font-family:Inter,system-ui;color:#103b5b;padding-bottom:36px}.golevg-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:25px;border:1px solid #cfe2ee;border-radius:22px;background:linear-gradient(135deg,#f8fdff,#e9f7ff);box-shadow:0 16px 38px rgba(10,63,97,.08);margin-bottom:15px}.golevg-hero h2{margin:7px 0 0;color:#073e64;font-size:29px}.golevg-hero p{margin:7px 0 0;color:#637e92;max-width:830px;line-height:1.55}.golevg-kicker{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:#dff5ff;color:#06709f;font-size:11px;font-weight:1000;text-transform:uppercase}.golevg-actions,.golevg-tabs,.golevg-inline{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.golevg-btn{border:1px solid #c8dce8;background:#fff;color:#086895;border-radius:11px;padding:10px 13px;font-weight:900;cursor:pointer;transition:.15s}.golevg-btn:hover:not(:disabled){transform:translateY(-1px)}.golevg-btn:disabled{opacity:.5;cursor:not-allowed}.golevg-btn.primary{border:0;color:#fff;background:linear-gradient(135deg,#087fba,#05a9d4)}.golevg-btn.success{border:0;color:#fff;background:#07875a}.golevg-btn.danger{color:#b42318}.golevg-btn.danger.solid{border-color:#b42318;background:#b42318;color:#fff}.golevg-cleanup-banner{display:none;margin:0 0 14px;padding:12px 14px;border:1px solid #f2c26b;border-radius:13px;background:#fff8e8;color:#7a5410}.golevg-cleanup-banner.show{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.golevg-delete-summary{display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:9px;margin:14px 0}.golevg-delete-summary div{border:1px solid #e1e9ee;border-radius:11px;padding:10px;background:#fafcfd}.golevg-delete-summary span{display:block;font-size:10px;text-transform:uppercase;font-weight:1000;color:#728796}.golevg-delete-summary b{display:block;margin-top:3px;color:#173f59}.golevg-danger-box{border:1px solid #f1b7b2;background:#fff4f3;color:#8e281f;border-radius:12px;padding:12px;line-height:1.5}.golevg-btn.small{padding:7px 9px;font-size:12px}.golevg-tabs{background:#edf6fb;border-radius:13px;padding:5px;width:max-content;max-width:100%;margin-bottom:14px}.golevg-tab{border:0;background:transparent;color:#607b8e;padding:9px 14px;border-radius:9px;font-weight:900;cursor:pointer}.golevg-tab.active{background:#fff;color:#0871a3;box-shadow:0 4px 13px #aac6d655}.golevg-panel{display:none}.golevg-panel.active{display:block}.golevg-stats{display:grid;grid-template-columns:repeat(5,minmax(125px,1fr));gap:10px;margin-bottom:14px}.golevg-stat,.golevg-card{background:#fff;border:1px solid #d6e5ee;border-radius:17px;padding:16px;box-shadow:0 10px 24px rgba(11,61,95,.05)}.golevg-stat span{display:block;color:#6b8496;font-size:10px;font-weight:1000;text-transform:uppercase}.golevg-stat strong{display:block;color:#0a456c;font-size:27px;margin-top:5px}.golevg-card-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.golevg-card-head h3{margin:0}.golevg-card-head small{color:#718a9b}.golevg-filter{display:grid;grid-template-columns:2fr repeat(2,minmax(150px,1fr)) auto;gap:9px;margin-bottom:13px}.golevg-input,.golevg-select,.golevg-textarea{width:100%;box-sizing:border-box;border:1px solid #c9dce8;border-radius:11px;padding:10px 11px;background:#fff;font:inherit}.golevg-campaign-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:13px}.golevg-campaign{border:1px solid #d4e4ed;border-radius:18px;padding:17px;background:#fff;box-shadow:0 10px 24px rgba(11,61,95,.05)}.golevg-campaign h3{margin:7px 0 4px;font-size:18px;color:#0a4167}.golevg-campaign p{margin:0;color:#6d8495;font-size:12px;line-height:1.45}.golevg-code{font-size:11px;font-weight:1000;color:#0874a6;text-transform:uppercase}.golevg-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:13px 0}.golevg-metric{border:1px solid #dce9f0;border-radius:11px;padding:9px;background:#f8fcfe}.golevg-metric span{display:block;font-size:9px;text-transform:uppercase;font-weight:1000;color:#738b9d}.golevg-metric b{display:block;margin-top:3px;color:#104766}.golevg-badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:1000}.golevg-badge.ok{background:#e5f8ed;color:#087448}.golevg-badge.run{background:#e7f5ff;color:#08689c}.golevg-badge.warn{background:#fff3d7;color:#8a6200}.golevg-badge.muted{background:#edf1f4;color:#667986}.golevg-badge.wait{background:#f0f5f8;color:#587486}.golevg-table-wrap{overflow:auto;border:1px solid #dbe8ef;border-radius:14px}.golevg-table{width:100%;border-collapse:collapse;min-width:1080px}.golevg-table th,.golevg-table td{padding:11px;border-bottom:1px solid #e7eff4;text-align:left;font-size:13px;vertical-align:top}.golevg-table th{background:#eff8fc;color:#5e788c;font-size:10px;text-transform:uppercase}.golevg-table tr:hover td{background:#f9fdff}.golevg-empty{text-align:center;padding:38px;color:#71899a}.golevg-detail-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:14px}.golevg-detail-head h2{margin:3px 0 5px;color:#0a4166}.golevg-detail-meta{display:flex;gap:8px;flex-wrap:wrap}.golevg-problem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}.golevg-problem{border:1px solid #d5e5ee;border-radius:16px;padding:15px;background:#fff}.golevg-problem h4{margin:5px 0 6px;color:#0a4166;font-size:16px}.golevg-problem p{margin:0;color:#6b8294;font-size:12px}.golevg-report-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}.golevg-report{border:1px solid #d6e5ed;border-radius:17px;padding:15px;background:#fff}.golevg-report h4{margin:7px 0;color:#0a4167}.golevg-report-info{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.golevg-report-info div{padding:9px;border:1px solid #dce9f0;border-radius:10px;background:#f8fcfe}.golevg-report-info span{display:block;font-size:9px;text-transform:uppercase;font-weight:1000;color:#71899a}.golevg-report-info b{display:block;margin-top:3px}.golevg-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#062d4875;z-index:12000;padding:20px}.golevg-modal.open{display:flex}.golevg-dialog{width:min(950px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 30px 80px #071c2c66}.golevg-dialog.wide{width:min(1160px,97vw)}.golevg-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.golevg-field.full{grid-column:1/-1}.golevg-field label{display:block;font-size:10px;font-weight:1000;color:#5e778a;text-transform:uppercase;margin-bottom:6px}.golevg-help{padding:11px 13px;border-radius:12px;background:#f4f9fc;border:1px solid #d7e8f1;color:#5d788c;font-size:12px;line-height:1.5}.golevg-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.golevg-photo{border:1px solid #d7e5ed;border-radius:13px;overflow:hidden;background:#f8fcfe}.golevg-photo img{width:100%;height:160px;object-fit:contain;background:#0b1d2b;display:block}.golevg-photo div{padding:8px;font-size:11px}.golevg-agency-result{border:1px solid #d7e5ed;border-radius:14px;margin-bottom:10px;overflow:hidden}.golevg-agency-result-head{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#e9f6fd;padding:10px 13px;font-weight:1000}.golevg-agency-result-body{padding:13px}.golevg-check-row{display:grid;grid-template-columns:34px 100px 1fr 100px;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #e8eff3}.golevg-link{color:#0675a8;font-weight:900;cursor:pointer;text-decoration:none}@media(max-width:1000px){.golevg-stats{grid-template-columns:repeat(2,1fr)}.golevg-filter{grid-template-columns:1fr 1fr}.golevg-hero,.golevg-detail-head{flex-direction:column}.golevg-grid{grid-template-columns:1fr}.golevg-field.full{grid-column:auto}}@media(max-width:650px){.golevg-filter{grid-template-columns:1fr}.golevg-tabs{width:100%;overflow:auto;flex-wrap:nowrap}.golevg-tab{white-space:nowrap}.golevg-campaign-grid,.golevg-problem-grid,.golevg-report-grid{grid-template-columns:1fr}.golevg-report-info{grid-template-columns:1fr}}

      .golevg-summary-stats{grid-template-columns:repeat(6,minmax(125px,1fr))}.golevg-detail-stats{grid-template-columns:repeat(4,minmax(125px,1fr))}.golevg-section-stack{display:grid;gap:14px}.golevg-section-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:12px}.golevg-section-title h3{margin:0;color:#0a4167}.golevg-section-title p{margin:4px 0 0;color:#71899a;font-size:12px}.golevg-list-filter{display:grid;grid-template-columns:minmax(220px,2fr) minmax(130px,1fr) minmax(145px,1fr) minmax(175px,1fr) auto;gap:9px;margin-bottom:13px}.golevg-list-meta{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:8px 0 12px;color:#71899a;font-size:12px}.golevg-campaign-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.golevg-campaign-details div{border:1px solid #e0ebf1;background:#fbfdfe;border-radius:10px;padding:9px}.golevg-campaign-details span{display:block;color:#738b9d;font-size:9px;font-weight:1000;text-transform:uppercase}.golevg-campaign-details b{display:block;color:#174967;margin-top:3px;font-size:12px}.golevg-activity{display:grid;gap:8px}.golevg-activity-item{display:grid;grid-template-columns:115px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid #e8f0f4}.golevg-activity-item:last-child{border-bottom:0}.golevg-activity-time{font-size:11px;font-weight:900;color:#0b709e}.golevg-activity-title{font-weight:900;color:#173f59}.golevg-activity-detail{margin-top:2px;color:#708697;font-size:12px}.golevg-search-results{display:grid;gap:8px;margin-top:12px}.golevg-search-result{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #dce8ef;border-radius:12px;padding:11px;background:#fbfdfe}.golevg-search-result strong{display:block;color:#0a4167}.golevg-search-result small{color:#71899a}.golevg-pager{display:flex;justify-content:center;align-items:center;gap:9px;margin-top:14px}.golevg-report-meta{font-size:11px;color:#71899a;line-height:1.55}.golevg-subtle{color:#71899a;font-size:12px}.golevg-stat.is-clickable{cursor:pointer}.golevg-stat.is-clickable:hover{border-color:#8bc8e3;transform:translateY(-1px)}
      @media(max-width:1180px){.golevg-summary-stats{grid-template-columns:repeat(3,1fr)}.golevg-detail-stats{grid-template-columns:repeat(2,1fr)}.golevg-list-filter{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:700px){.golevg-summary-stats{grid-template-columns:repeat(2,1fr)}.golevg-detail-stats{grid-template-columns:1fr 1fr}.golevg-list-filter{grid-template-columns:1fr}.golevg-campaign-details{grid-template-columns:1fr}.golevg-activity-item{grid-template-columns:1fr;gap:3px}.golevg-search-result{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function injectView() {
    const host = $('#vista-ops-levantamientos');
    if (!host || host.dataset.golevgReady === VERSION) return;
    host.dataset.golevgReady = VERSION;
    host.innerHTML = `
      <div id="golevg-root">
        <section class="golevg-hero">
          <div><span class="golevg-kicker"><i class="fas fa-layer-group"></i> Operaciones · Levantamientos</span><h2>Levantamientos de agencias</h2><p>Centro de control para recibir inspecciones, identificar hallazgos y generar los documentos PDF/Excel que se entregan a los departamentos correspondientes.</p></div>
          <div class="golevg-actions"><button class="golevg-btn" id="golevg-refresh"><i class="fas fa-rotate"></i> Actualizar</button><button class="golevg-btn" id="golevg-copy-form"><i class="fas fa-link"></i> Copiar enlace Jotform</button><button class="golevg-btn primary" id="golevg-new"><i class="fas fa-plus"></i> Nuevo levantamiento</button></div>
        </section>
        <div class="golevg-tabs" id="golevg-main-tabs">
          <button class="golevg-tab active" data-main="SUMMARY">Resumen</button>
          <button class="golevg-tab" data-main="OPEN">Abiertos</button>
          <button class="golevg-tab" data-main="CLOSED">Cerrados</button>
          <button class="golevg-tab" data-main="PENDING">Jotform sin vincular <span id="golevg-pending-badge"></span></button>
          <button class="golevg-tab" data-main="REPORTS">Reportes generados</button>
        </div>
        <div class="golevg-cleanup-banner" id="golevg-cleanup-banner"></div>

        <section class="golevg-panel active" data-main-panel="SUMMARY">
          <div class="golevg-stats golevg-summary-stats" id="golevg-summary-stats"></div>
          <div class="golevg-section-stack">
            <div class="golevg-card"><div class="golevg-section-title"><div><h3>Levantamientos abiertos</h3><p>Trabajo actual más reciente. Solo se muestran algunos para mantener el Resumen ligero.</p></div><button class="golevg-btn small" id="golevg-summary-open-all">Ver todos</button></div><div class="golevg-campaign-grid" id="golevg-summary-open"></div></div>
            <div class="golevg-card"><div class="golevg-section-title"><div><h3>Actividad reciente</h3><p>Eventos que pueden reconstruirse con fecha/hora real desde Supabase.</p></div></div><div class="golevg-activity" id="golevg-activity"></div></div>
            <div class="golevg-card"><div class="golevg-section-title"><div><h3>Buscar en Levantamientos</h3><p>Busca por código, grupo o número exacto de agencia sin descargar todo el histórico.</p></div></div><div class="golevg-inline"><input class="golevg-input" id="golevg-global-search" placeholder="Ej.: 1088, G-44 o LEV-G44-2026-0001" style="flex:1;min-width:240px"><button class="golevg-btn primary" id="golevg-global-search-btn">Buscar</button></div><div class="golevg-search-results" id="golevg-global-results"></div></div>
          </div>
        </section>

        <section class="golevg-panel" data-main-panel="OPEN">
          <div class="golevg-card"><div class="golevg-section-title"><div><h3>Levantamientos abiertos</h3><p>Trabajo actual. Esta pantalla consulta únicamente estado ABIERTO.</p></div><small id="golevg-open-count">0 levantamientos</small></div>
            <div class="golevg-list-filter"><input class="golevg-input" id="golevg-open-search" placeholder="Buscar código o agencia"><select class="golevg-select" id="golevg-open-group"><option value="">Todos los grupos</option></select><input class="golevg-input" id="golevg-open-date" type="date"><select class="golevg-select" id="golevg-open-sort"><option value="ULTIMA_ACTIVIDAD">Última actividad</option><option value="RECIENTES">Más recientes</option><option value="ANTIGUOS">Más antiguos</option><option value="GRUPO">Grupo</option><option value="MAS_AGENCIAS">Más agencias</option><option value="MAS_HALLAZGOS">Más hallazgos</option></select><button class="golevg-btn" id="golevg-open-clear">Limpiar</button></div>
            <div class="golevg-campaign-grid" id="golevg-open-campaigns"></div><div class="golevg-pager" id="golevg-open-pager"></div>
          </div>
        </section>

        <section class="golevg-panel" data-main-panel="CLOSED">
          <div class="golevg-card"><div class="golevg-section-title"><div><h3>Levantamientos cerrados</h3><p>Histórico de campañas terminadas. Cerrado significa que ya no se esperan más inspecciones dentro del levantamiento.</p></div><small id="golevg-closed-count">0 levantamientos</small></div>
            <div class="golevg-list-filter"><input class="golevg-input" id="golevg-closed-search" placeholder="Buscar código o agencia"><select class="golevg-select" id="golevg-closed-group"><option value="">Todos los grupos</option></select><input class="golevg-input" id="golevg-closed-date" type="date"><select class="golevg-select" id="golevg-closed-sort"><option value="RECIENTES">Más recientes</option><option value="ANTIGUOS">Más antiguos</option><option value="ULTIMA_ACTIVIDAD">Última actividad</option><option value="GRUPO">Grupo</option><option value="MAS_AGENCIAS">Más agencias</option><option value="MAS_HALLAZGOS">Más hallazgos</option></select><button class="golevg-btn" id="golevg-closed-clear">Limpiar</button></div>
            <div class="golevg-campaign-grid" id="golevg-closed-campaigns"></div><div class="golevg-pager" id="golevg-closed-pager"></div>
          </div>
        </section>

        <section class="golevg-panel" data-main-panel="PENDING"><div class="golevg-card"><div class="golevg-card-head"><div><h3>Jotform sin vincular</h3><small>Bandeja de excepciones: formularios que no pudieron completar el flujo automático.</small></div></div><div id="golevg-pending"></div></div></section>
        <section class="golevg-panel" data-main-panel="REPORTS"><div class="golevg-card"><div class="golevg-card-head"><div><h3>Reportes generados</h3><small>Archivo documental de los entregables PDF/Excel creados desde los hallazgos.</small></div><small id="golevg-report-count">0 reportes</small></div><div class="golevg-report-grid" id="golevg-all-reports"></div><div class="golevg-pager" id="golevg-report-pager"></div></div></section>
        <section id="golevg-detail" style="display:none"></section>
      </div>

      <div class="golevg-modal" id="golevg-campaign-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Nuevo levantamiento de grupo</h3><small>Puede durar todos los días que sean necesarios.</small></div><button class="golevg-btn" data-close="golevg-campaign-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field"><label>Grupo</label><select class="golevg-select" id="golevg-f-group"></select></div><div class="golevg-field"><label>Responsable</label><input class="golevg-input" id="golevg-f-responsible" placeholder="Técnico o encargado"></div><div class="golevg-field full"><label>Nombre</label><input class="golevg-input" id="golevg-f-name" value="Levantamiento general de agencias"></div><div class="golevg-field"><label>Fecha de inicio</label><input class="golevg-input" id="golevg-f-start" type="date"></div><div class="golevg-field"><label>Agencias esperadas (opcional)</label><input class="golevg-input" id="golevg-f-expected" type="number" min="0"></div><div class="golevg-field full"><label>Descripción</label><textarea class="golevg-textarea" id="golevg-f-description" rows="3"></textarea></div></div><div class="golevg-help" id="golevg-campaign-status" style="display:none;margin-top:14px"></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-campaign-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-save-campaign">Crear levantamiento</button></div></div></div>

      <div class="golevg-modal" id="golevg-jotform-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Abrir formulario de agencia</h3><small id="golevg-jotform-campaign"></small></div><button class="golevg-btn" data-close="golevg-jotform-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field full"><label>Agencia del grupo</label><select class="golevg-select" id="golevg-j-agency"></select></div><div class="golevg-field"><label>Técnico / responsable</label><input class="golevg-input" id="golevg-j-tech"></div><div class="golevg-field"><label>Fecha de inspección</label><input class="golevg-input" type="date" id="golevg-j-date"></div><div class="golevg-field full"><div class="golevg-help" id="golevg-j-help">El formulario general conserva el flujo actual: agencia → grupo oficial → levantamiento abierto del grupo.</div></div></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-jotform-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-open-jotform"><i class="fas fa-up-right-from-square"></i> Abrir Jotform</button></div></div></div>

      <div class="golevg-modal" id="golevg-problem-modal"><div class="golevg-dialog wide"><div class="golevg-card-head"><div><h3 id="golevg-problem-title">Agencias por hallazgo</h3><small id="golevg-problem-subtitle"></small></div><button class="golevg-btn" data-close="golevg-problem-modal">Cerrar</button></div><div id="golevg-problem-content"></div></div></div>

      <div class="golevg-modal" id="golevg-report-modal"><div class="golevg-dialog wide"><div class="golevg-card-head"><div><h3>Preparar reporte</h3><small>Selecciona las agencias incluidas en este entregable documental.</small></div><button class="golevg-btn" data-close="golevg-report-modal">Cerrar</button></div><div class="golevg-grid"><div class="golevg-field full"><label>Título</label><input class="golevg-input" id="golevg-r-title"></div><div class="golevg-field"><label>Responsable</label><input class="golevg-input" id="golevg-r-responsible"></div><div class="golevg-field"><label>Estado del reporte</label><select class="golevg-select" id="golevg-r-status"><option value="BORRADOR">Borrador</option><option value="FINAL">Final</option></select></div><div class="golevg-field full"><label>Observación</label><textarea class="golevg-textarea" id="golevg-r-observation" rows="2"></textarea></div><div class="golevg-field full"><label>Agencias incluidas</label><div id="golevg-r-items" style="border:1px solid #d7e5ed;border-radius:13px;max-height:390px;overflow:auto"></div></div></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-report-modal">Cancelar</button><button class="golevg-btn primary" id="golevg-save-report">Guardar reporte</button></div></div></div>

      <div class="golevg-modal" id="golevg-link-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Vincular formulario</h3><small>El formulario se reprocesará dentro del levantamiento seleccionado.</small></div><button class="golevg-btn" data-close="golevg-link-modal">Cerrar</button></div><div class="golevg-field"><label>Levantamiento abierto</label><select class="golevg-select" id="golevg-link-campaign"></select></div><input type="hidden" id="golevg-link-intake"><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn primary" id="golevg-link-save">Vincular y procesar</button></div></div></div>

      <div class="golevg-modal" id="golevg-delete-modal"><div class="golevg-dialog"><div class="golevg-card-head"><div><h3>Eliminar levantamiento</h3><small id="golevg-delete-subtitle">Acción permanente</small></div><button class="golevg-btn" data-close="golevg-delete-modal">Cerrar</button></div><div id="golevg-delete-body"><div class="golevg-empty">Preparando eliminación…</div></div><div class="golevg-help" id="golevg-delete-status" style="display:none;margin-top:12px"></div><div class="golevg-actions" style="justify-content:flex-end;margin-top:15px"><button class="golevg-btn" data-close="golevg-delete-modal" id="golevg-delete-cancel">Cancelar</button><button class="golevg-btn danger" id="golevg-delete-retry" style="display:none">Reintentar limpieza R2</button><button class="golevg-btn danger solid" id="golevg-delete-confirm" disabled>Eliminar definitivamente</button></div></div></div>
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

  function renderPendingCleanups() {
    const banner = $('#golevg-cleanup-banner');
    if (!banner) return;
    if (!canDelete() || !state.pendingCleanups.length) {
      banner.classList.remove('show');
      banner.innerHTML = '';
      return;
    }
    const first = state.pendingCleanups[0];
    const extra = Math.max(0, state.pendingCleanups.length - 1);
    banner.classList.add('show');
    banner.innerHTML = `<div><b>Limpieza R2 pendiente</b><div style="font-size:12px;margin-top:3px">${esc(first.codigo)}${extra ? ` · ${extra} adicional(es)` : ''}. Los datos de Supabase ya fueron eliminados, pero Cloudflare R2 todavía debe verificarse.</div></div><button class="golevg-btn danger small" id="golevg-cleanup-retry-banner">Reintentar limpieza</button>`;
    $('#golevg-cleanup-retry-banner').onclick = () => retryCleanup(first.id, first.codigo);
  }

  async function loadPendingCleanups() {
    if (!canDelete()) {
      state.pendingCleanups = [];
      renderPendingCleanups();
      return;
    }
    try {
      const data = await deleteApi({ action: 'pending' });
      state.pendingCleanups = Array.isArray(data.pending) ? data.pending : [];
    } catch (error) {
      console.warn('[Levantamientos] No se pudieron consultar limpiezas R2 pendientes:', error);
      state.pendingCleanups = [];
    }
    renderPendingCleanups();
  }

  function fillGroupOptions() {
    const labels = [...new Set(groups().map(groupLabel).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    const filterHtml = '<option value="">Todos los grupos</option>' + labels.map((label) => `<option value="${esc(label)}">Grupo ${esc(label)}</option>`).join('');
    for (const selector of ['#golevg-open-group', '#golevg-closed-group']) {
      const element = $(selector);
      if (!element) continue;
      const current = normalizeGroup(element.value);
      element.innerHTML = filterHtml;
      element.value = labels.includes(current) ? current : '';
    }
    const create = $('#golevg-f-group');
    if (create) create.innerHTML = '<option value="">Selecciona un grupo</option>' + groups().sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'es', { numeric: true })).map((group) => `<option value="${groupId(group)}" data-code="${esc(groupLabel(group))}">Grupo ${esc(groupLabel(group))}</option>`).join('');
  }


  function normalizedMainTab(tab) {
    const value = text(tab).toUpperCase();
    if (value === 'CAMPAIGNS') return 'SUMMARY';
    return ['SUMMARY','OPEN','CLOSED','PENDING','REPORTS'].includes(value) ? value : 'SUMMARY';
  }

  function normalizedCampaignTab(tab) {
    const value = text(tab).toUpperCase();
    if (value === 'PROBLEMS' || value === 'RESOLVED') return 'FINDINGS';
    return ['AGENCIES','FINDINGS','REPORTS'].includes(value) ? value : 'AGENCIES';
  }

  function listFilters(status) {
    const prefix = status === 'CERRADO' ? 'closed' : 'open';
    return {
      search: text($(`#golevg-${prefix}-search`)?.value),
      group: normalizeGroup($(`#golevg-${prefix}-group`)?.value),
      date: text($(`#golevg-${prefix}-date`)?.value) || null,
      sort: text($(`#golevg-${prefix}-sort`)?.value) || (status === 'CERRADO' ? 'RECIENTES' : 'ULTIMA_ACTIVIDAD')
    };
  }

  async function loadPendingCount() {
    const connected = client();
    if (!connected?.from) return 0;
    const result = await connected.from(TABLES.intakes).select('id', { count: 'exact', head: true }).in('estado', ['PENDIENTE_VINCULO','ERROR']);
    const count = result.error ? 0 : Number(result.count || 0);
    if ($('#golevg-pending-badge')) $('#golevg-pending-badge').textContent = count ? `(${count})` : '(0)';
    return count;
  }

  async function loadSummary() {
    const connected = client();
    if (!connected?.rpc) throw new Error('Supabase no está disponible.');
    $('#golevg-summary-open').innerHTML = '<div class="golevg-empty">Cargando trabajo actual…</div>';
    $('#golevg-activity').innerHTML = '<div class="golevg-empty">Cargando actividad…</div>';
    const [summary, recent, activity] = await Promise.all([
      connected.rpc('ops_levantamiento_resumen_v1'),
      connected.rpc('ops_levantamiento_listar_v1', { p_estado: 'ABIERTO', p_buscar: null, p_grupo: null, p_fecha_inicio: null, p_orden: 'ULTIMA_ACTIVIDAD', p_limit: 6, p_offset: 0 }),
      connected.rpc('ops_levantamiento_actividad_reciente_v1', { p_limit: 8 })
    ]);
    for (const result of [summary, recent, activity]) if (result.error) throw result.error;
    state.summary = Array.isArray(summary.data) ? (summary.data[0] || {}) : (summary.data || {});
    state.summaryRecent = recent.data || [];
    state.recentActivity = activity.data || [];
    renderStats();
    renderSummaryOpen();
    renderActivity();
    if ($('#golevg-pending-badge')) $('#golevg-pending-badge').textContent = `(${Number(state.summary.jotform_sin_vincular || 0)})`;
  }

  async function loadCampaignList(status, options = {}) {
    const connected = client();
    if (!connected?.rpc) throw new Error('Supabase no está disponible.');
    const closed = status === 'CERRADO';
    const pageKey = closed ? 'closedPage' : 'openPage';
    if (options.resetPage) state[pageKey] = 0;
    const page = Math.max(0, Number(state[pageKey] || 0));
    const filters = listFilters(status);
    const holder = $(closed ? '#golevg-closed-campaigns' : '#golevg-open-campaigns');
    if (holder) holder.innerHTML = '<div class="golevg-empty">Cargando levantamientos…</div>';
    const result = await connected.rpc('ops_levantamiento_listar_v1', {
      p_estado: status,
      p_buscar: filters.search || null,
      p_grupo: filters.group || null,
      p_fecha_inicio: filters.date,
      p_orden: filters.sort,
      p_limit: state.listPageSize,
      p_offset: page * state.listPageSize
    });
    if (result.error) throw result.error;
    state.campaigns = result.data || [];
    if (!state.campaigns.length && page > 0) { state[pageKey] = 0; return loadCampaignList(status); }
    state.filteredCampaigns = state.campaigns;
    state.campaignTotal = Number(state.campaigns[0]?.total_count || 0);
    state.currentListStatus = status;
    renderCampaigns();
    saveUiState();
  }

  async function loadPending() {
    const connected = client();
    const result = await connected.from(TABLES.intakes).select('*', { count: 'exact' }).in('estado', ['PENDIENTE_VINCULO','ERROR']).order('recibido_en', { ascending: false }).limit(100);
    if (result.error) throw result.error;
    state.intakes = result.data || [];
    renderPending();
    if ($('#golevg-pending-badge')) $('#golevg-pending-badge').textContent = `(${Number(result.count || state.intakes.length)})`;
  }

  async function enrichReportCreators(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const ids = [...new Set(list.map((item) => item.creado_por).filter(uuid))];
    const names = new Map();
    if (ids.length) {
      const profiles = await client().from('perfiles').select('id,nombre_completo').in('id', ids);
      if (!profiles.error) (profiles.data || []).forEach((item) => names.set(item.id, item.nombre_completo));
    }
    list.forEach((item) => { item._creator_name = item.creado_por ? (names.get(item.creado_por) || 'No registrado') : 'No registrado'; });
    return list;
  }

  async function loadReports() {
    const connected = client();
    const start = state.reportPage * state.reportPageSize;
    const end = start + state.reportPageSize - 1;
    const result = await connected.from(TABLES.reports)
      .select('*, ops_levantamiento_campanas(id,codigo,grupo_codigo,nombre,estado)', { count: 'exact' })
      .order('creado_en', { ascending: false })
      .range(start, end);
    if (result.error) throw result.error;
    state.allReports = result.data || [];
    state.reportTotal = Number(result.count || 0);
    if (!state.allReports.length && state.reportPage > 0) { state.reportPage = 0; return loadReports(); }
    await enrichReportCreators(state.allReports);
    renderAllReports();
  }

  async function loadMainTab(tab = state.mainTab) {
    const normalized = normalizedMainTab(tab);
    if (normalized === 'SUMMARY') await loadSummary();
    else if (normalized === 'OPEN') await loadCampaignList('ABIERTO');
    else if (normalized === 'CLOSED') await loadCampaignList('CERRADO');
    else if (normalized === 'PENDING') await loadPending();
    else if (normalized === 'REPORTS') await loadReports();
    if (normalized !== 'SUMMARY' && normalized !== 'PENDING') await loadPendingCount();
    await loadPendingCleanups();
  }

  function renderStats() {
    const summary = state.summary || {};
    const items = [
      ['Levantamientos abiertos', Number(summary.levantamientos_abiertos || 0), 'OPEN'],
      ['Agencias recibidas hoy', Number(summary.agencias_recibidas_hoy || 0), null],
      ['Hallazgos detectados', Number(summary.hallazgos_detectados || 0), null],
      ['Fotos en R2', Number(summary.fotos_r2 || 0), null],
      ['Jotform sin vincular', Number(summary.jotform_sin_vincular || 0), 'PENDING'],
      ['Reportes generados', Number(summary.reportes_generados || 0), 'REPORTS']
    ];
    const holder = $('#golevg-summary-stats');
    if (holder) holder.innerHTML = items.map(([label, value, tab]) => `<div class="golevg-stat ${tab ? 'is-clickable' : ''}" ${tab ? `data-summary-tab="${tab}"` : ''}><span>${label}</span><strong>${value}</strong></div>`).join('');
    $$('[data-summary-tab]', holder).forEach((item) => { item.onclick = () => switchMainTab(item.dataset.summaryTab); });
    if ($('#golevg-new')) $('#golevg-new').style.display = canManage() ? '' : 'none';
  }

  function campaignCard(item, mode = 'LIST') {
    const isClosed = item.estado === 'CERRADO';
    const hallazgos = Number(item.hallazgos_detectados ?? (Number(item.hallazgos_activos || 0) + Number(item.hallazgos_resueltos || 0)));
    const photos = Number(item.fotos_r2 ?? item.evidencias_count ?? 0);
    const reports = Number(item.reportes_generados || 0);
    const startMoment = item.creado_en || item.fecha_inicio;
    const timeLabel = isClosed ? 'Duración' : 'Tiempo abierto';
    const timeValue = isClosed ? durationText(item.fecha_inicio || startMoment, item.fecha_cierre, false) : durationText(startMoment);
    const actions = mode === 'SUMMARY'
      ? `<button class="golevg-btn primary small" data-open-campaign="${item.id}">Abrir</button>`
      : `<button class="golevg-btn primary small" data-open-campaign="${item.id}">Abrir</button>${canManage() ? `<button class="golevg-btn small" data-toggle-campaign="${item.id}" data-next="${isClosed ? 'ABIERTO' : 'CERRADO'}">${isClosed ? 'Reabrir' : 'Cerrar'}</button>` : ''}${canDelete() ? `<button class="golevg-btn danger small" data-delete-campaign="${item.id}">Eliminar</button>` : ''}`;
    return `<article class="golevg-campaign"><div class="golevg-inline" style="justify-content:space-between"><span class="golevg-code">${esc(item.codigo || '-')}</span><span class="golevg-badge ${badgeClass(item.estado)}">${campaignStatusLabel(item.estado)}</span></div><h3>Grupo ${esc(item.grupo_codigo)} · ${esc(item.nombre || 'Levantamiento')}</h3><div class="golevg-campaign-details"><div><span>Inicio</span><b>${formatDate(item.fecha_inicio)}</b></div>${isClosed ? `<div><span>Cierre</span><b>${formatDate(item.fecha_cierre)}</b></div>` : `<div><span>Última actividad</span><b>${formatDateTime(item.actualizado_en)}</b><small class="golevg-subtle">${relativeTime(item.actualizado_en)}</small></div>`}<div><span>${timeLabel}</span><b>${timeValue}</b></div><div><span>Agencias</span><b>${Number(item.agencias_recibidas || 0)}</b></div><div><span>Hallazgos</span><b>${hallazgos}</b></div><div><span>Fotos R2</span><b>${photos}</b></div><div><span>Reportes generados</span><b>${reports}</b></div></div><div class="golevg-actions">${actions}</div></article>`;
  }

  function bindCampaignCards(holder) {
    $$('[data-open-campaign]', holder).forEach((button) => { button.onclick = () => openCampaign(button.dataset.openCampaign); });
    $$('[data-toggle-campaign]', holder).forEach((button) => { button.onclick = () => toggleCampaign(button.dataset.toggleCampaign, button.dataset.next); });
    $$('[data-delete-campaign]', holder).forEach((button) => { button.onclick = () => openDeleteModal(button.dataset.deleteCampaign); });
  }

  function renderSummaryOpen() {
    const holder = $('#golevg-summary-open');
    if (!holder) return;
    if (!state.summaryRecent.length) { holder.innerHTML = '<div class="golevg-empty">No hay levantamientos abiertos.</div>'; return; }
    holder.innerHTML = state.summaryRecent.map((item) => campaignCard(item, 'SUMMARY')).join('');
    bindCampaignCards(holder);
  }

  function renderActivity() {
    const holder = $('#golevg-activity');
    if (!holder) return;
    if (!state.recentActivity.length) { holder.innerHTML = '<div class="golevg-empty">Todavía no hay actividad reciente disponible.</div>'; return; }
    holder.innerHTML = state.recentActivity.map((item) => `<div class="golevg-activity-item"><div class="golevg-activity-time">${formatDateTime(item.ocurrido_en)}</div><div><div class="golevg-activity-title">${esc(item.titulo || 'Actividad')}</div><div class="golevg-activity-detail">${esc(item.detalle || '')}${item.campana_codigo ? ` · ${esc(item.campana_codigo)}` : ''}</div></div></div>`).join('');
  }

  function renderPager(holderId, page, total, pageSize, onPage) {
    const holder = $(holderId);
    if (!holder) return;
    const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));
    if (pages <= 1) { holder.innerHTML = ''; return; }
    holder.innerHTML = `<button class="golevg-btn small" data-page-prev ${page <= 0 ? 'disabled' : ''}>Anterior</button><span class="golevg-subtle">Página ${page + 1} de ${pages}</span><button class="golevg-btn small" data-page-next ${page >= pages - 1 ? 'disabled' : ''}>Siguiente</button>`;
    $('[data-page-prev]', holder)?.addEventListener('click', () => onPage(Math.max(0, page - 1)));
    $('[data-page-next]', holder)?.addEventListener('click', () => onPage(Math.min(pages - 1, page + 1)));
  }

  function applyCampaignFilters() {
    const status = state.mainTab === 'CLOSED' ? 'CERRADO' : 'ABIERTO';
    return loadCampaignList(status, { resetPage: true });
  }

  function renderCampaigns() {
    const closed = state.currentListStatus === 'CERRADO';
    const holder = $(closed ? '#golevg-closed-campaigns' : '#golevg-open-campaigns');
    const count = $(closed ? '#golevg-closed-count' : '#golevg-open-count');
    if (count) count.textContent = `${state.campaignTotal} levantamiento(s)`;
    if (!holder) return;
    if (!state.campaigns.length) holder.innerHTML = `<div class="golevg-empty">No hay levantamientos ${closed ? 'cerrados' : 'abiertos'} con estos filtros.</div>`;
    else { holder.innerHTML = state.campaigns.map((item) => campaignCard(item, 'LIST')).join(''); bindCampaignCards(holder); }
    const pageKey = closed ? 'closedPage' : 'openPage';
    renderPager(closed ? '#golevg-closed-pager' : '#golevg-open-pager', state[pageKey], state.campaignTotal, state.listPageSize, async (nextPage) => {
      state[pageKey] = nextPage;
      await loadCampaignList(closed ? 'CERRADO' : 'ABIERTO');
      window.scrollTo({ top: Math.max(0, (holder?.getBoundingClientRect().top || 0) + window.scrollY - 120), behavior: 'smooth' });
    });
  }

  async function searchGlobal() {
    const term = text($('#golevg-global-search')?.value);
    const holder = $('#golevg-global-results');
    if (!holder) return;
    if (!term) { holder.innerHTML = '<div class="golevg-empty">Escribe un código, grupo o agencia.</div>'; return; }
    holder.innerHTML = '<div class="golevg-empty">Buscando…</div>';
    const result = await client().rpc('ops_levantamiento_listar_v1', { p_estado: null, p_buscar: term, p_grupo: null, p_fecha_inicio: null, p_orden: 'ULTIMA_ACTIVIDAD', p_limit: 50, p_offset: 0 });
    if (result.error) { holder.innerHTML = '<div class="golevg-empty">No se pudo realizar la búsqueda.</div>'; return toast(result.error.message, 'error'); }
    state.globalSearchResults = result.data || [];
    if (!state.globalSearchResults.length) { holder.innerHTML = '<div class="golevg-empty">No se encontraron levantamientos.</div>'; return; }
    holder.innerHTML = state.globalSearchResults.map((item) => `<div class="golevg-search-result"><div><strong>${esc(item.codigo)} · Grupo ${esc(item.grupo_codigo)}</strong><small>${campaignStatusLabel(item.estado)} · Inicio ${formatDate(item.fecha_inicio)} · ${Number(item.agencias_recibidas || 0)} agencias · ${Number(item.hallazgos_detectados || 0)} hallazgos</small></div><button class="golevg-btn small" data-search-open="${item.id}">Abrir</button></div>`).join('');
    $$('[data-search-open]', holder).forEach((button) => { button.onclick = () => openCampaign(button.dataset.searchOpen, { returnTab: 'SUMMARY' }); });
    saveUiState();
  }

  async function open(navElement) {
    if (!canView()) return toast('No tienes permiso para abrir Levantamientos.', 'error');
    const saved = readUiState();
    injectStyles(); injectView(); installNavigation(); bind(); showModuleView(navElement);
    await Promise.all([loadConfig(), loadCatalog()]);
    fillGroupOptions();
    await restoreUiState(saved);
  }

  async function loadAll() {
    try {
      await loadMainTab(state.mainTab || 'SUMMARY');
    } catch (error) {
      console.error('[Levantamientos] Error cargando pestaña:', error);
      toast(error.message || 'No se pudieron cargar los datos de Levantamientos.', 'error');
    }
  }

  async function restoreUiState(saved) {
    state.uiRestoring = true;
    try {
      applyStoredFilters(saved || {});
      const tab = normalizedMainTab(saved?.mainTab || 'SUMMARY');
      state.mainTab = tab;
      await switchMainTab(tab, { persist: false, load: true });
      if (tab === 'SUMMARY' && text(saved?.globalSearch)) await searchGlobal();
      const selectedId = text(saved?.selectedCampaignId);
      if (selectedId) {
        await openCampaign(selectedId, {
          tab: normalizedCampaignTab(saved?.campaignTab),
          scroll: false,
          persist: false,
          returnTab: tab
        });
      }
      restoreScroll(saved || {});
    } finally {
      state.uiRestoring = false;
      saveUiState(saved?.scrollY || 0);
    }
  }

  async function refreshPreservingUiState() {
    if (!isModuleVisible() || state.loadingAll) return;
    const snapshot = captureUiState();
    state.loadingAll = true;
    try {
      applyStoredFilters(snapshot);
      await loadMainTab(snapshot.mainTab || 'SUMMARY');
      switchMainTab(snapshot.mainTab || 'SUMMARY', { persist: false, load: false });
      if (snapshot.selectedCampaignId) {
        await openCampaign(snapshot.selectedCampaignId, { tab: normalizedCampaignTab(snapshot.campaignTab), scroll: false, persist: false, returnTab: snapshot.mainTab });
      }
      restoreScroll(snapshot);
    } catch (error) {
      console.warn('[Levantamientos] Actualización preservando navegación falló:', error);
    } finally {
      state.loadingAll = false;
      saveUiState(snapshot.scrollY);
    }
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
    try {
      const connected = client();
      if (!connected?.from) throw new Error('La conexión con Supabase no está disponible.');
      const existing = await connected.from(TABLES.campaigns).select('*').eq('origen', 'MANUAL').eq('grupo_codigo', groupCode).in('estado', ['ABIERTO','EN_REVISION']).order('creado_en', { ascending: false }).limit(1).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        closeModal('golevg-campaign-modal');
        toast(`El grupo ${groupCode} ya tiene el levantamiento activo ${existing.data.codigo}.`, 'info');
        return openCampaign(existing.data.id, { returnTab: 'OPEN' });
      }
      const payload = {
        grupo_id: uuid(groupIdValue) ? groupIdValue : null,
        grupo_codigo: groupCode,
        nombre,
        descripcion: text($('#golevg-f-description').value) || null,
        responsable_nombre: text($('#golevg-f-responsible').value) || null,
        origen: 'MANUAL', origen_id: null, estado: 'ABIERTO',
        fecha_inicio: $('#golevg-f-start').value || today(),
        agencias_esperadas: Number($('#golevg-f-expected').value) || null
      };
      if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando…'; }
      setCampaignStatus(`Creando levantamiento para el Grupo ${groupCode}…`);
      const response = await connected.from(TABLES.campaigns).insert(payload).select('*').single();
      if (response.error) throw response.error;
      closeModal('golevg-campaign-modal');
      toast(`Levantamiento ${response.data.codigo} creado correctamente.`, 'success');
      await switchMainTab('OPEN', { load: true });
      await openCampaign(response.data.id, { returnTab: 'OPEN' });
    } catch (error) {
      console.error('[Levantamientos de grupo] Error creando levantamiento:', error);
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
    let item = state.campaigns.find((row) => row.id === id) || state.summaryRecent.find((row) => row.id === id) || state.globalSearchResults.find((row) => row.id === id) || (state.selectedCampaign?.id === id ? state.selectedCampaign : null);
    if (!item) {
      const lookup = await client().from(TABLES.campaigns).select('*').eq('id', id).single();
      if (lookup.error) return toast(lookup.error.message, 'error');
      item = lookup.data;
    }
    const message = next === 'CERRADO'
      ? `¿Cerrar ${item.codigo}? Cerrado significa que ya no esperamos más inspecciones dentro de esta campaña.`
      : `¿Reabrir ${item.codigo}? Volverá a aparecer como trabajo actual.`;
    if (!global.confirm(message)) return;
    const response = await client().from(TABLES.campaigns).update({ estado: next }).eq('id', id);
    if (response.error) return toast(response.error.message, 'error');
    toast(next === 'CERRADO' ? 'Levantamiento cerrado.' : 'Levantamiento reabierto.', 'success');
    if (state.selectedCampaign?.id === id) closeCampaignDetail({ scroll: false, persist: false });
    await loadMainTab(state.mainTab);
    saveUiState();
  }

  async function openCampaign(id, options = {}) {
    const requestedTab = normalizedCampaignTab(options.tab || (state.selectedCampaign?.id === id ? state.campaignTab : 'AGENCIES'));
    const connected = client();
    state.detailReturnTab = normalizedMainTab(options.returnTab || state.mainTab || 'SUMMARY');
    $$('.golevg-tab[data-main]', $('#golevg-main-tabs')).forEach((button) => button.classList.toggle('active', button.dataset.main === state.detailReturnTab));
    $$('[data-main-panel]').forEach((panel) => panel.classList.remove('active'));
    $('#golevg-detail').style.display = 'block';
    $('#golevg-detail').innerHTML = '<div class="golevg-card"><div class="golevg-empty">Cargando detalle del levantamiento…</div></div>';
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
      await enrichReportCreators(state.campaignReports);
      state.campaignTab = requestedTab;
      renderCampaignDetail();
      if (options.scroll !== false) $('#golevg-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (options.persist !== false) saveUiState();
    } catch (error) {
      toast(error.message || 'No se pudo abrir el levantamiento.', 'error');
      $('#golevg-detail').innerHTML = '<div class="golevg-card"><div class="golevg-empty">No se pudo cargar el detalle.</div></div>';
    }
  }

  function renderCampaignDetail() {
    const c = state.selectedCampaign;
    if (!c) return;
    const detected = state.findings.filter((item) => item.estado !== 'DESCARTADO');
    const migratedPhotos = state.evidence.filter((item) => item.estado_r2 === 'MIGRADO').length;
    $('#golevg-detail').innerHTML = `
      <div class="golevg-detail-head"><div><a class="golevg-link" id="golevg-back">← Volver a ${state.detailReturnTab === 'CLOSED' ? 'cerrados' : state.detailReturnTab === 'OPEN' ? 'abiertos' : state.detailReturnTab === 'REPORTS' ? 'reportes generados' : 'resumen'}</a><h2>${esc(c.codigo)} · Grupo ${esc(c.grupo_codigo)}</h2><div class="golevg-detail-meta"><span class="golevg-badge ${badgeClass(c.estado)}">${campaignStatusLabel(c.estado)}</span><span class="golevg-badge wait">Responsable: ${esc(c.responsable_nombre || 'Sin asignar')}</span><span class="golevg-badge wait">Inicio: ${formatDate(c.fecha_inicio)}</span>${c.fecha_cierre ? `<span class="golevg-badge ok">Cierre: ${formatDate(c.fecha_cierre)}</span>` : ''}</div></div><div class="golevg-actions"><button class="golevg-btn primary" id="golevg-detail-form"><i class="fas fa-link"></i> Copiar enlace general de Jotform</button><button class="golevg-btn" id="golevg-detail-refresh"><i class="fas fa-rotate"></i> Actualizar</button>${canManage() ? `<button class="golevg-btn" id="golevg-detail-close">${c.estado === 'CERRADO' ? 'Reabrir' : 'Cerrar levantamiento'}</button>` : ''}${canDelete() ? '<button class="golevg-btn danger" id="golevg-detail-delete">Eliminar</button>' : ''}</div></div>
      <div class="golevg-help" style="margin-bottom:13px"><b>Flujo actual:</b> el levantamiento detecta hallazgos y permite generar PDF/Excel. El seguimiento de reparación o resolución no forma parte de esta fase.</div>
      <div class="golevg-stats golevg-detail-stats"><div class="golevg-stat"><span>Agencias inspeccionadas</span><strong>${state.expedients.length}</strong></div><div class="golevg-stat"><span>Hallazgos detectados</span><strong>${detected.length}</strong></div><div class="golevg-stat"><span>Fotos en R2</span><strong>${migratedPhotos}</strong></div><div class="golevg-stat"><span>Reportes generados</span><strong>${state.campaignReports.length}</strong></div></div>
      <div class="golevg-tabs" id="golevg-campaign-tabs"><button class="golevg-tab ${state.campaignTab === 'AGENCIES' ? 'active' : ''}" data-campaign-tab="AGENCIES">Agencias</button><button class="golevg-tab ${state.campaignTab === 'FINDINGS' ? 'active' : ''}" data-campaign-tab="FINDINGS">Hallazgos por tipo</button><button class="golevg-tab ${state.campaignTab === 'REPORTS' ? 'active' : ''}" data-campaign-tab="REPORTS">Reportes generados</button></div>
      <div class="golevg-card" id="golevg-campaign-content"></div>`;
    $('#golevg-back').onclick = closeCampaignDetail;
    $('#golevg-detail-form')?.addEventListener('click', copyGeneralJotformLink);
    $('#golevg-detail-refresh').onclick = () => openCampaign(c.id, { scroll: false, returnTab: state.detailReturnTab });
    if ($('#golevg-detail-close')) $('#golevg-detail-close').onclick = () => toggleCampaign(c.id, c.estado === 'CERRADO' ? 'ABIERTO' : 'CERRADO');
    if ($('#golevg-detail-delete')) $('#golevg-detail-delete').onclick = () => openDeleteModal(c.id);
    $$('[data-campaign-tab]', $('#golevg-campaign-tabs')).forEach((button) => {
      button.onclick = () => {
        $$('[data-campaign-tab]', $('#golevg-campaign-tabs')).forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        state.campaignTab = button.dataset.campaignTab;
        renderCampaignContent();
        saveUiState();
      };
    });
    renderCampaignContent();
  }

  function closeCampaignDetail(options = {}) {
    state.selectedCampaign = null;
    $('#golevg-detail').style.display = 'none';
    $('#golevg-detail').innerHTML = '';
    const tab = normalizedMainTab(state.detailReturnTab || state.mainTab || 'SUMMARY');
    state.mainTab = tab;
    $$('[data-main-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.mainPanel === tab));
    $$('.golevg-tab[data-main]', $('#golevg-main-tabs')).forEach((button) => button.classList.toggle('active', button.dataset.main === tab));
    if (options.scroll !== false) window.scrollTo({ top: Math.max(0, $('#golevg-root').offsetTop - 20), behavior: 'smooth' });
    if (options.persist !== false) saveUiState();
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
    if (state.campaignTab === 'FINDINGS') return renderProblemGroups(holder, false);
    renderCampaignReports(holder);
  }

  function renderAgencyTable(holder) {
    if (!state.expedients.length) { holder.innerHTML = '<div class="golevg-empty">Todavía no se han recibido formularios para este levantamiento.</div>'; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>Agencias inspeccionadas</h3><small>Cada agencia conserva su fecha de recepción e inspección dentro de esta campaña.</small></div></div><div class="golevg-table-wrap"><table class="golevg-table"><thead><tr><th>Agencia</th><th>Fecha de inspección</th><th>Técnico</th><th>Hallazgos</th><th>Fotos R2</th><th>Acciones</th></tr></thead><tbody>${state.expedients.map((item) => { const findings = state.findings.filter((finding) => finding.expediente_id === item.id && finding.estado !== 'DESCARTADO').length; return `<tr><td><b>AG ${esc(agencyDisplay(item.agencia_numero))}</b><br><small>Grupo ${esc(item.grupo_codigo)}</small></td><td>${formatDate(item.fecha_inspeccion)}</td><td>${esc(item.tecnico_nombre || '-')}</td><td>${findings}</td><td>${item.evidencias_count || 0}${state.evidence.some((e) => e.expediente_id === item.id && e.estado_r2 === 'ERROR') ? ' ⚠️' : ''}</td><td><div class="golevg-actions"><button class="golevg-btn small" data-exp-detail="${item.id}">Ver</button>${state.evidence.some((e) => e.expediente_id === item.id && e.estado_r2 !== 'MIGRADO') ? `<button class="golevg-btn small" data-retry-r2="${item.id}">Reintentar fotos</button>` : ''}</div></td></tr>`; }).join('')}</tbody></table></div>`;
    $$('[data-exp-detail]', holder).forEach((button) => { button.onclick = () => showExpedient(button.dataset.expDetail); });
    $$('[data-retry-r2]', holder).forEach((button) => { button.onclick = () => retryR2(button.dataset.retryR2); });
  }

  function aggregateProblems(_resolved = false) {
    const map = new Map();
    state.findings.filter((item) => item.estado !== 'DESCARTADO').forEach((finding) => {
      const key = finding.problema_clave;
      const current = map.get(key) || { key, label: finding.problema_etiqueta, findings: [], agencies: new Set(), photos: 0 };
      current.findings.push(finding);
      current.agencies.add(finding.agencia_numero);
      current.photos += evidenceForFinding(finding).length;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.agencies.size - a.agencies.size || a.label.localeCompare(b.label));
  }

  function renderProblemGroups(holder, _resolved = false) {
    const groupsList = aggregateProblems(false);
    if (!groupsList.length) { holder.innerHTML = '<div class="golevg-empty">No hay hallazgos detectados en este levantamiento.</div>'; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>Hallazgos por tipo</h3><small>La agrupación se limita a ${esc(state.selectedCampaign.codigo)} y no mezcla otros levantamientos.</small></div></div><div class="golevg-problem-grid">${groupsList.map((item) => `<article class="golevg-problem"><span class="golevg-code">Hallazgo</span><h4>${esc(item.label)}</h4><p>${item.agencies.size} agencia(s) · ${item.photos} foto(s)</p><div class="golevg-actions" style="margin-top:12px"><button class="golevg-btn small" data-view-problem="${esc(item.key)}">Ver agencias</button><button class="golevg-btn primary small" data-report-problem="${esc(item.key)}">Crear reporte</button><button class="golevg-btn small" data-excel-problem="${esc(item.key)}">Excel</button></div></article>`).join('')}</div>`;
    $$('[data-view-problem]', holder).forEach((button) => { button.onclick = () => showProblem(button.dataset.viewProblem, false); });
    $$('[data-report-problem]', holder).forEach((button) => { button.onclick = () => prepareReport(button.dataset.reportProblem); });
    $$('[data-excel-problem]', holder).forEach((button) => { button.onclick = () => exportProblemExcel(button.dataset.excelProblem); });
  }

  function problemFindings(key, _resolved = false) {
    return state.findings.filter((item) => item.problema_clave === key && item.estado !== 'DESCARTADO');
  }

  function showProblem(key, _resolved = false) {
    const findings = problemFindings(key, false);
    if (!findings.length) return;
    const label = findings[0].problema_etiqueta;
    $('#golevg-problem-title').textContent = `Agencias con ${label.toLowerCase()}`;
    $('#golevg-problem-subtitle').textContent = `${state.selectedCampaign.codigo} · Grupo ${state.selectedCampaign.grupo_codigo} · ${findings.length} agencia(s)`;
    $('#golevg-problem-content').innerHTML = findings.map((finding) => {
      const photos = evidenceForFinding(finding);
      return `<article class="golevg-agency-result"><div class="golevg-agency-result-head"><span>AGENCIA ${esc(agencyDisplay(finding.agencia_numero))} · G-${esc(finding.grupo_codigo)}</span><span>Hallazgo</span></div><div class="golevg-agency-result-body"><p><b>${esc(finding.elemento_etiqueta)}</b> · ${esc(finding.condicion_reportada || '')}</p><p>${esc(finding.descripcion || 'Sin descripción.')}</p>${photos.length ? `<div class="golevg-photo-grid">${photos.map((photo) => `<a class="golevg-photo" href="${esc(photo.r2_url)}" target="_blank" rel="noopener"><img src="${esc(photo.r2_url)}" alt="${esc(photo.etiqueta)}"><div>${esc(photo.etiqueta)}</div></a>`).join('')}</div>` : '<div class="golevg-help">No hay fotografía vinculada a este hallazgo.</div>'}</div></article>`;
    }).join('');
    $('#golevg-problem-modal').classList.add('open');
  }

  async function updateFindingState(_id, _status) {
    toast('La resolución de hallazgos no se gestiona desde Levantamientos en esta fase.', 'info');
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
        photos: evidenceForFinding(finding).map((photo) => ({ url: photo.r2_url, label: photo.etiqueta, name: photo.nombre_archivo }))
      };
    });
  }

  function prepareReport(key, existing = null) {
    const findings = problemFindings(key, false);
    const label = existing?.problema_etiqueta || findings[0]?.problema_etiqueta;
    if (!label) return toast('No hay agencias con este hallazgo para generar el reporte.', 'error');
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
    const campaignId = state.selectedCampaign?.id;
    if (!campaignId) return toast('No hay un levantamiento abierto en pantalla.', 'error');
    const payload = {
      campana_id: campaignId,
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
    toast('Reporte generado correctamente.', 'success');
    await openCampaign(campaignId, { tab: 'REPORTS', scroll: false, returnTab: state.detailReturnTab });
  }

  function renderCampaignReports(holder) {
    if (!state.campaignReports.length) { holder.innerHTML = '<div class="golevg-empty">Todavía no se han generado reportes para este levantamiento.</div>'; return; }
    holder.innerHTML = `<div class="golevg-card-head"><div><h3>Reportes generados</h3><small>El contenido de cada reporte queda congelado al guardarse.</small></div></div><div class="golevg-report-grid">${state.campaignReports.map(reportCard).join('')}</div>`;
    bindReportCards(holder);
  }

  function reportCard(report) {
    const campaign = report.ops_levantamiento_campanas || (state.selectedCampaign?.id === report.campana_id ? state.selectedCampaign : null) || {};
    const creator = report._creator_name || (report.creado_por ? 'Registrado por UUID' : 'No registrado');
    return `<article class="golevg-report"><span class="golevg-code">${esc(report.codigo || 'Reporte')}</span><h4>${esc(report.titulo)}</h4><div class="golevg-report-info"><div><span>Levantamiento</span><b>${esc(campaign.codigo || '-')}</b></div><div><span>Grupo</span><b>${esc(campaign.grupo_codigo || '-')}</b></div><div><span>Tipo de hallazgo</span><b>${esc(report.problema_etiqueta || '-')}</b></div><div><span>Contenido</span><b>${Number(report.agencias_count || 0)} agencias · ${Number(report.fotos_count || 0)} fotos</b></div><div><span>Generado</span><b>${formatDateTime(report.creado_en)}</b></div><div><span>Generado por</span><b>${esc(creator)}</b></div></div><div class="golevg-report-meta">Estado interno del reporte: ${esc(report.estado || '-')} · Formatos disponibles: PDF / Excel</div>${report.observacion ? `<p style="font-size:12px;color:#6d8394">${esc(report.observacion)}</p>` : ''}<div class="golevg-actions"><button class="golevg-btn primary small" data-print-report="${report.id}">PDF</button><button class="golevg-btn small" data-excel-report="${report.id}">Excel</button><button class="golevg-btn small" data-edit-report="${report.id}">Ver / Editar</button>${canManage() ? `<button class="golevg-btn danger small" data-delete-report="${report.id}">Eliminar</button>` : ''}</div></article>`;
  }

  function renderAllReports() {
    const holder = $('#golevg-all-reports');
    if ($('#golevg-report-count')) $('#golevg-report-count').textContent = `${state.reportTotal} reporte(s)`;
    if (!state.allReports.length) { holder.innerHTML = '<div class="golevg-empty">No hay reportes generados.</div>'; $('#golevg-report-pager').innerHTML = ''; return; }
    holder.innerHTML = state.allReports.map(reportCard).join('');
    bindReportCards(holder);
    renderPager('#golevg-report-pager', state.reportPage, state.reportTotal, state.reportPageSize, async (nextPage) => { state.reportPage = nextPage; await loadReports(); saveUiState(); });
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
    if (!global.confirm('¿Eliminar este reporte generado?')) return;
    const response = await client().from(TABLES.reports).delete().eq('id', id);
    if (response.error) return toast(response.error.message, 'error');
    toast('Reporte eliminado.', 'success');
    if (state.selectedCampaign) await openCampaign(state.selectedCampaign.id, { tab: 'REPORTS', scroll: false, returnTab: state.detailReturnTab });
    else await loadReports();
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
      return { Agencia: agencyDisplay(finding.agencia_numero), Grupo: finding.grupo_codigo, Hallazgo: finding.problema_etiqueta, Elemento: finding.elemento_etiqueta, Condición: finding.condicion_reportada, Descripción: finding.descripcion, Fecha: formatDate(expedition?.fecha_inspeccion), Técnico: expedition?.tecnico_nombre || '', Fotos: evidenceForFinding(finding).map((photo) => photo.r2_url).join(' | ') };
    });
    downloadExcel(rows, `${state.selectedCampaign.codigo}_${key}.xls`, `Grupo ${state.selectedCampaign.grupo_codigo} - ${findings[0].problema_etiqueta}`);
  }

  function exportReportExcel(report) {
    if (!report?.id) return;
    const rows = (report.snapshot || []).map((item) => ({ Agencia: agencyDisplay(item.agency_number), Grupo: item.group_code, Hallazgo: report.problema_etiqueta, Elemento: item.element, Condición: item.condition, Descripción: item.description, Fecha: formatDate(item.inspection_date), Técnico: item.technician || '', Fotos: (item.photos || []).map((photo) => photo.url).join(' | ') }));
    downloadExcel(rows, `${report.codigo || 'reporte'}.xls`, report.titulo);
  }

  function photoCards(photos) {
    if (!photos.length) return '<div class="golevg-empty">Sin fotografía asociada.</div>';
    return `<div class="golevg-photo-grid">${photos.map((photo) => `<a class="golevg-photo" href="${esc(photo.r2_url)}" target="_blank" rel="noopener"><img src="${esc(photo.r2_url)}" loading="lazy" alt="${esc(photo.etiqueta || 'Evidencia')}"><div>${esc(photo.etiqueta || 'Evidencia')}</div></a>`).join('')}</div>`;
  }

  async function showExpedient(id) {
    const item = state.expedients.find((row) => row.id === id);
    if (!item) return;
    const findings = state.findings.filter((row) => row.expediente_id === id && row.estado !== 'DESCARTADO');
    const photos = evidenceForExpedient(id);
    const usedPhotoIds = new Set();
    const findingSections = findings.map((finding) => {
      const linkedPhotos = evidenceForFinding(finding).filter((photo) => photo.expediente_id === id);
      linkedPhotos.forEach((photo) => usedPhotoIds.add(photo.id));
      return `<section class="golevg-card" style="margin-top:12px"><div class="golevg-card-head"><div><span class="golevg-code">${esc(finding.area_etiqueta || 'Hallazgo')}</span><h3>${esc(finding.problema_etiqueta)}</h3></div></div><p><b>Elemento:</b> ${esc(finding.elemento_etiqueta || '-')}</p><p><b>Condición:</b> ${esc(finding.condicion_reportada || '-')}</p><p><b>Descripción:</b> ${esc(finding.descripcion || 'Sin descripción.')}</p><div style="margin-top:10px"><b>Evidencias de este hallazgo</b>${photoCards(linkedPhotos)}</div></section>`;
    }).join('');
    const unlinked = photos.filter((photo) => !usedPhotoIds.has(photo.id));
    $('#golevg-problem-title').textContent = `AGENCIA ${agencyDisplay(item.agencia_numero)} · Grupo ${item.grupo_codigo}`;
    $('#golevg-problem-subtitle').textContent = `${formatDate(item.fecha_inspeccion)} · ${item.tecnico_nombre || 'Sin técnico registrado'} · ${findings.length} hallazgo(s)`;
    $('#golevg-problem-content').innerHTML = `<div class="golevg-card"><div class="golevg-card-head"><div><h3>Hallazgos y evidencias asociadas</h3><small>Cada fotografía aparece únicamente en el hallazgo que la originó.</small></div>${item.jotform_submission_id ? `<button class="golevg-btn small" id="golevg-rebuild-evidence">Sincronizar evidencias desde Jotform</button>` : ''}</div>${findings.length ? findingSections : '<div class="golevg-empty">Sin hallazgos detectados.</div>'}</div>${unlinked.length ? `<div class="golevg-card" style="margin-top:12px"><div class="golevg-card-head"><div><h3>Evidencias generales</h3><small>Fotografías R2 que no están asociadas a un hallazgo específico.</small></div></div>${photoCards(unlinked)}</div>` : ''}`;
    if ($('#golevg-rebuild-evidence')) $('#golevg-rebuild-evidence').onclick = () => retryR2(item.id);
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

  async function openLinkModal(intakeId) {
    const result = await client().from(TABLES.campaigns).select('id,codigo,grupo_codigo,nombre').eq('estado', 'ABIERTO').order('actualizado_en', { ascending: false }).limit(100);
    if (result.error) return toast(result.error.message, 'error');
    const openCampaigns = result.data || [];
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

  function setDeleteStatus(message, tone = 'info') {
    const holder = $('#golevg-delete-status');
    if (!holder) return;
    holder.style.display = message ? 'block' : 'none';
    holder.textContent = message || '';
    holder.style.borderColor = tone === 'error' ? '#f0b7b7' : tone === 'success' ? '#a8dfc5' : '#d7e8f1';
    holder.style.background = tone === 'error' ? '#fff3f3' : tone === 'success' ? '#effbf5' : '#f4f9fc';
    holder.style.color = tone === 'error' ? '#a12622' : tone === 'success' ? '#08613f' : '#5d788c';
  }

  function renderDeletePreview(preview) {
    const body = $('#golevg-delete-body');
    if (!body) return;
    body.innerHTML = `<div class="golevg-danger-box"><b>Esta acción no se puede deshacer.</b><br>Se eliminarán permanentemente el levantamiento y sus datos funcionales relacionados. Después el backend eliminará únicamente los objetos Cloudflare R2 pertenecientes a este levantamiento.</div>
      <div class="golevg-delete-summary"><div><span>Agencias</span><b>${Number(preview.agencias || 0)}</b></div><div><span>Hallazgos</span><b>${Number(preview.problemas || 0)}</b></div><div><span>Fotografías</span><b>${Number(preview.fotografias || 0)}</b></div><div><span>Reportes generados</span><b>${Number(preview.reportes || 0)}</b></div></div>
      <div class="golevg-field"><label>Escribe ${esc(preview.codigo)} para confirmar</label><input class="golevg-input" id="golevg-delete-code-input" autocomplete="off" spellcheck="false" placeholder="${esc(preview.codigo)}"></div>`;
    const input = $('#golevg-delete-code-input');
    const confirm = $('#golevg-delete-confirm');
    const sync = () => { if (confirm) confirm.disabled = text(input?.value) !== text(preview.codigo); };
    input?.addEventListener('input', sync);
    sync();
  }

  async function openDeleteModal(campaignId) {
    if (!requireDelete()) return;
    const item = state.campaigns.find((row) => row.id === campaignId) || state.summaryRecent.find((row) => row.id === campaignId) || state.globalSearchResults.find((row) => row.id === campaignId) || (state.selectedCampaign?.id === campaignId ? state.selectedCampaign : null);
    state.deleteContext = { campaignId, code: item?.codigo || '', cleanupId: null };
    $('#golevg-delete-modal')?.classList.add('open');
    $('#golevg-delete-subtitle').textContent = item?.codigo ? `${item.codigo} · Grupo ${item.grupo_codigo}` : 'Preparando eliminación segura';
    $('#golevg-delete-body').innerHTML = '<div class="golevg-empty">Consultando relaciones, reportes y evidencias…</div>';
    $('#golevg-delete-confirm').style.display = '';
    $('#golevg-delete-confirm').disabled = true;
    $('#golevg-delete-retry').style.display = 'none';
    $('#golevg-delete-cancel').textContent = 'Cancelar';
    setDeleteStatus('');
    try {
      const data = await deleteApi({ action: 'preview', campaignId });
      const preview = data.preview || {};
      state.deleteContext = { campaignId, code: preview.codigo, cleanupId: null, preview };
      $('#golevg-delete-subtitle').textContent = `${preview.codigo} · Grupo ${preview.grupo_codigo}`;
      renderDeletePreview(preview);
    } catch (error) {
      $('#golevg-delete-body').innerHTML = '<div class="golevg-empty">No se pudo preparar la eliminación.</div>';
      setDeleteStatus(error.message || 'No se pudo consultar el levantamiento.', 'error');
    }
  }

  async function confirmDeleteCampaign() {
    if (!requireDelete()) return;
    const context = state.deleteContext;
    const input = $('#golevg-delete-code-input');
    if (!context?.campaignId || !context?.code || text(input?.value) !== text(context.code)) return;
    const snapshot = captureUiState();
    const confirm = $('#golevg-delete-confirm');
    const cancel = $('#golevg-delete-cancel');
    if (confirm) { confirm.disabled = true; confirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando…'; }
    if (cancel) cancel.disabled = true;
    setDeleteStatus('Eliminando datos relacionados en Supabase y verificando Cloudflare R2…');
    try {
      const data = await deleteApi({ action: 'delete', campaignId: context.campaignId, confirmationCode: context.code });
      if (data.complete) {
        state.deleteContext = null;
        if (state.selectedCampaign?.id === context.campaignId) state.selectedCampaign = null;
        closeModal('golevg-delete-modal');
        $('#golevg-detail').style.display = 'none';
        toast(data.message || `${context.code} eliminado completamente.`, 'success');
        await loadMainTab(snapshot.mainTab || 'SUMMARY');
        switchMainTab(snapshot.mainTab || 'SUMMARY', { persist: false, load: false });
        restoreScroll(snapshot);
        saveUiState(snapshot.scrollY);
        return;
      }
      state.deleteContext.cleanupId = data.cleanupId;
      state.selectedCampaign = state.selectedCampaign?.id === context.campaignId ? null : state.selectedCampaign;
      $('#golevg-delete-body').innerHTML = `<div class="golevg-danger-box"><b>${esc(context.code)} ya fue eliminado de Supabase.</b><br>Cloudflare R2 todavía no quedó completamente limpio. No se mostrará como eliminación completa hasta finalizar esta etapa.</div>`;
      $('#golevg-delete-confirm').style.display = 'none';
      $('#golevg-delete-retry').style.display = '';
      $('#golevg-delete-cancel').textContent = 'Cerrar';
      setDeleteStatus(data.error || data.message || 'Limpieza R2 pendiente.', 'error');
      await loadMainTab(snapshot.mainTab || 'SUMMARY');
      await loadPendingCleanups();
    } catch (error) {
      setDeleteStatus(error.message || 'No se pudo eliminar el levantamiento.', 'error');
    } finally {
      if (confirm) { confirm.innerHTML = 'Eliminar definitivamente'; if (confirm.style.display !== 'none') confirm.disabled = text($('#golevg-delete-code-input')?.value) !== text(context?.code); }
      if (cancel) cancel.disabled = false;
    }
  }

  async function retryCleanup(cleanupId, code = '') {
    if (!requireDelete()) return;
    const id = text(cleanupId || state.deleteContext?.cleanupId);
    if (!id) return toast('No se encontró la limpieza R2 pendiente.', 'error');
    const retry = $('#golevg-delete-retry');
    const original = retry?.innerHTML || 'Reintentar limpieza R2';
    if (retry) { retry.disabled = true; retry.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reintentando…'; }
    setDeleteStatus('Reintentando limpieza exclusiva del prefijo R2 del levantamiento…');
    try {
      const data = await deleteApi({ action: 'retry', cleanupId: id });
      if (!data.complete) {
        setDeleteStatus(data.error || data.message || 'La limpieza R2 continúa pendiente.', 'error');
        await loadPendingCleanups();
        return;
      }
      toast(data.message || `Limpieza R2 de ${code || 'levantamiento'} completada.`, 'success');
      if ($('#golevg-delete-modal')?.classList.contains('open') && state.deleteContext?.cleanupId === id) closeModal('golevg-delete-modal');
      state.deleteContext = null;
      await loadPendingCleanups();
    } catch (error) {
      setDeleteStatus(error.message || 'No se pudo reintentar la limpieza R2.', 'error');
      toast(error.message || 'No se pudo reintentar la limpieza R2.', 'error');
    } finally {
      if (retry) { retry.disabled = false; retry.innerHTML = original; }
    }
  }


  async function switchMainTab(tab, options = {}) {
    const normalized = normalizedMainTab(tab);
    state.mainTab = normalized;
    if (state.selectedCampaign && options.keepDetail !== true) state.selectedCampaign = null;
    if ($('#golevg-detail')) { $('#golevg-detail').style.display = 'none'; $('#golevg-detail').innerHTML = ''; }
    $$('.golevg-tab[data-main]', $('#golevg-main-tabs')).forEach((button) => button.classList.toggle('active', button.dataset.main === normalized));
    $$('[data-main-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.mainPanel === normalized));
    if (options.load !== false) {
      try { await loadMainTab(normalized); } catch (error) { toast(error.message || 'No se pudo cargar la pantalla.', 'error'); }
    }
    if (options.persist !== false) saveUiState();
  }

  function closeModal(id) {
    $(`#${id}`)?.classList.remove('open');
    if (id === 'golevg-jotform-modal') state.sourceContext = null;
    if (id === 'golevg-delete-modal') state.deleteContext = null;
  }

  function scheduleRealtimeRefresh() {
    clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = setTimeout(() => {
      if (isModuleVisible()) refreshPreservingUiState();
    }, 180);
  }

  function subscribeRealtime() {
    if (state.realtime || !client()?.channel) return;
    try {
      state.realtime = client().channel('ops-levantamientos-grupo-v80828')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.campaigns }, scheduleRealtimeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.agencies }, scheduleRealtimeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.findings }, scheduleRealtimeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.evidence }, scheduleRealtimeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.reports }, scheduleRealtimeRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.intakes }, scheduleRealtimeRefresh)
        .subscribe();
    } catch (_error) {}
  }

  function bind() {
    if (state.initialized) return;
    state.initialized = true;
    $('#golevg-refresh').onclick = refreshPreservingUiState;
    $('#golevg-new').onclick = openCampaignModal;
    $('#golevg-copy-form').onclick = copyGeneralJotformLink;
    $('#golevg-save-campaign').onclick = createCampaign;
    $('#golevg-open-jotform').onclick = launchJotform;
    $('#golevg-save-report').onclick = saveReport;
    $('#golevg-link-save').onclick = linkIntake;
    $('#golevg-delete-confirm').onclick = confirmDeleteCampaign;
    $('#golevg-delete-retry').onclick = () => retryCleanup(state.deleteContext?.cleanupId, state.deleteContext?.code);
    $('#golevg-summary-open-all').onclick = () => switchMainTab('OPEN');
    $('#golevg-global-search-btn').onclick = searchGlobal;
    $('#golevg-global-search').addEventListener('keydown', (event) => { if (event.key === 'Enter') searchGlobal(); });

    const delayedOpen = debounce(() => { state.openPage = 0; loadCampaignList('ABIERTO').catch((error) => toast(error.message, 'error')); });
    const delayedClosed = debounce(() => { state.closedPage = 0; loadCampaignList('CERRADO').catch((error) => toast(error.message, 'error')); });
    $('#golevg-open-search').oninput = delayedOpen;
    $('#golevg-closed-search').oninput = delayedClosed;
    for (const selector of ['#golevg-open-group','#golevg-open-date','#golevg-open-sort']) $(selector).onchange = () => { state.openPage = 0; loadCampaignList('ABIERTO').catch((error) => toast(error.message, 'error')); };
    for (const selector of ['#golevg-closed-group','#golevg-closed-date','#golevg-closed-sort']) $(selector).onchange = () => { state.closedPage = 0; loadCampaignList('CERRADO').catch((error) => toast(error.message, 'error')); };
    $('#golevg-open-clear').onclick = () => { $('#golevg-open-search').value=''; $('#golevg-open-group').value=''; $('#golevg-open-date').value=''; $('#golevg-open-sort').value='ULTIMA_ACTIVIDAD'; state.openPage=0; loadCampaignList('ABIERTO'); };
    $('#golevg-closed-clear').onclick = () => { $('#golevg-closed-search').value=''; $('#golevg-closed-group').value=''; $('#golevg-closed-date').value=''; $('#golevg-closed-sort').value='RECIENTES'; state.closedPage=0; loadCampaignList('CERRADO'); };

    $$('[data-main]', $('#golevg-main-tabs')).forEach((button) => { button.onclick = () => switchMainTab(button.dataset.main); });
    $$('[data-close]', $('#vista-ops-levantamientos')).forEach((button) => { button.onclick = () => closeModal(button.dataset.close); });
    $$('.golevg-modal', $('#vista-ops-levantamientos')).forEach((modal) => { modal.onclick = (event) => { if (event.target === modal) closeModal(modal.id); }; });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (isModuleVisible()) saveUiState(); return; }
      if (isModuleVisible()) setTimeout(refreshPreservingUiState, 120);
    });
    global.addEventListener('pagehide', () => { if (isModuleVisible()) saveUiState(); });
    global.addEventListener('scroll', () => {
      if (!isModuleVisible()) return;
      clearTimeout(state.scrollSaveTimer);
      state.scrollSaveTimer = setTimeout(() => saveUiState(), 120);
    }, { passive: true });
    try { runtime()?.events?.on?.('auth:signed-out', clearUiState); } catch (_error) {}
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
      body.innerHTML = result.data.map((item) => `<tr><td><b>${esc(item.ops_levantamiento_campanas?.codigo || '-')}</b></td><td>${formatDate(item.fecha_inspeccion)}</td><td>${esc(item.tecnico_nombre || '-')}</td><td>${esc(item.estado.replace(/_/g, ' '))}</td><td>${Number(item.hallazgos_activos || 0) + Number(item.hallazgos_resueltos || 0)}</td><td><button class="btn-secondary" onclick="GOLevantamientosGrupos.openCampaign('${item.campana_id}')">Abrir</button></td></tr>`).join('');
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
        fillGroupOptions();
        const saved = readUiState();
        applyStoredFilters(saved || {});
        state.mainTab = normalizedMainTab(saved?.mainTab || state.mainTab || 'SUMMARY');
        await loadMainTab(state.mainTab);
        switchMainTab(state.mainTab, { load: false, persist: false });
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
