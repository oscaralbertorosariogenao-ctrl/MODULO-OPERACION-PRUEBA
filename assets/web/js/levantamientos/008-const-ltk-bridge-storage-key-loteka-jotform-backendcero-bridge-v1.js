
const LTK_BRIDGE_STORAGE_KEY = 'loteka_jotform_backendCero_bridge_v1';
const LTK_DEFAULT_BACKEND_CERO_URL = '';
const LTK_DEFAULT_FUNCTION_URL = '';
const LTK_DEFAULT_BACKEND_CERO_ANON_KEY = '';
let ltkBridgeConfig = { backendCeroUrl: LTK_DEFAULT_BACKEND_CERO_URL, anonKey: LTK_DEFAULT_BACKEND_CERO_ANON_KEY, functionUrl: LTK_DEFAULT_FUNCTION_URL };

function ltkLoadBridgeConfig(){
  try {
    const saved = JSON.parse(localStorage.getItem(LTK_BRIDGE_STORAGE_KEY) || '{}');
    ltkBridgeConfig = {
      backendCeroUrl: saved.backendCeroUrl || LTK_DEFAULT_BACKEND_CERO_URL,
      anonKey: saved.anonKey || LTK_DEFAULT_BACKEND_CERO_ANON_KEY,
      functionUrl: saved.functionUrl || LTK_DEFAULT_FUNCTION_URL
    };
  } catch(e){
    ltkBridgeConfig = { backendCeroUrl: LTK_DEFAULT_BACKEND_CERO_URL, anonKey: LTK_DEFAULT_BACKEND_CERO_ANON_KEY, functionUrl: LTK_DEFAULT_FUNCTION_URL };
  }
}
function ltkPersistBridgeConfig(){ localStorage.setItem(LTK_BRIDGE_STORAGE_KEY, JSON.stringify(ltkBridgeConfig)); }
function ltkSetSyncStatus(message){ const el=document.getElementById('ltkSyncStatus'); if(el) el.textContent = message; }
function ltkUpdateBridgeBadges(){
  const back=document.getElementById('ltkBadgeBackend');
  const front=document.getElementById('ltkBadgeFrontend');
  if(back){
    back.className='ltk-sync-badge good';
    back.innerHTML = '<i class="fas fa-plug"></i> Webhook Jotform listo';
  }
  if(front){
    const ok = !!(ltkBridgeConfig.backendCeroUrl && ltkBridgeConfig.anonKey);
    front.className = `ltk-sync-badge ${ok ? 'good' : 'warn'}`;
    front.innerHTML = `<i class="fas fa-database"></i> Lectura local: ${ok ? 'configurada' : 'pendiente'}`;
  }
}
function ltkOpenBridgeModal(){
  document.getElementById('ltkBackendCeroUrl').value = ltkBridgeConfig.backendCeroUrl || '';
  document.getElementById('ltkBackendCeroAnonKey').value = ltkBridgeConfig.anonKey || '';
  document.getElementById('ltkFunctionUrl').value = ltkBridgeConfig.functionUrl || '';
  document.getElementById('ltkBridgeModal').style.display = 'flex';
}
function ltkCloseBridgeModal(){ const el=document.getElementById('ltkBridgeModal'); if(el) el.style.display='none'; }
function ltkLoadBridgeDefaults(){
  document.getElementById('ltkBackendCeroUrl').value = LTK_DEFAULT_BACKEND_CERO_URL;
  document.getElementById('ltkBackendCeroAnonKey').value = LTK_DEFAULT_BACKEND_CERO_ANON_KEY;
  document.getElementById('ltkFunctionUrl').value = LTK_DEFAULT_FUNCTION_URL;
}
function ltkSaveBridgeConfig(){
  ltkBridgeConfig.backendCeroUrl = (document.getElementById('ltkBackendCeroUrl').value || '').trim().replace(/\/$/, '');
  ltkBridgeConfig.anonKey = (document.getElementById('ltkBackendCeroAnonKey').value || '').trim();
  ltkBridgeConfig.functionUrl = (document.getElementById('ltkFunctionUrl').value || '').trim();
  ltkPersistBridgeConfig();
  ltkUpdateBridgeBadges();
  ltkSetSyncStatus(ltkBridgeConfig.anonKey ? 'Configuración guardada. Ya puedes sincronizar agencias y levantamientos reales desde BackendCero.' : 'Configuración guardada sin anon key. El sistema seguirá en modo local hasta que completes la lectura desde BackendCero.');
  ltkCloseBridgeModal();
}
function ltkNormalizeGroupName(value){
  const raw = String(value || '').trim();
  if(!raw) return '';
  return /^grupo\s+/i.test(raw) ? raw : `Grupo ${raw}`;
}
function ltkFindAgencyIndexByCode(code){
  return agencias.findIndex(a => String(a?.numero || '').replace(/\D+/g,'') === String(code || '').replace(/\D+/g,''));
}
function ltkEnsureAgencyFromBackendCero(row){
  const code = String(row?.codigo_agencia || '').replace(/\D+/g,'');
  if(!code) return null;
  const num = Number(code);
  let index = ltkFindAgencyIndexByCode(code);
  if(index === -1){
    const nuevo = createAgencyRecord(num, ltkNormalizeGroupName(row?.grupo || ''), row?.tecnico_ultimo || 'pendiente');
    agencias.unshift(nuevo);
    index = 0;
  }
  const agencia = agencias[index];
  agencia.numero = num;
  agencia.nombre = `Agencia ${String(code).padStart(4,'0')}`;
  agencia.grupo = ltkNormalizeGroupName(row?.grupo || agencia.grupo || '');
  agencia.encargado = row?.tecnico_ultimo || agencia.encargado || 'pendiente';
  agencia.detalle = agencia.detalle || {};
  agencia.detalle.general = agencia.detalle.general || {};
  agencia.detalle.parametros = agencia.detalle.parametros || {};
  agencia.detalle.general.observacion = row?.observacion_agencia || agencia.detalle.general.observacion || '';
  agencia.detalle.parametros.ultimaVisita = row?.fecha_ultima_visita || agencia.detalle.parametros.ultimaVisita || '';
  return agencia;
}
function ltkGetDetailValue(detailsByLev, levId, item){
  const rows = detailsByLev[String(levId)] || [];
  const hit = rows.find(r => String(r.item || '').trim().toLowerCase() === String(item).trim().toLowerCase());
  return hit ? String(hit.valor || '') : '';
}
function ltkBuildLevRecord(row, detailsByLev, position){
  const structure = LEV_STRUCTURE_FIELDS.map(label => ({ item: label, state: ltkGetDetailValue(detailsByLev, row.id, label) || 'Buen Estado' }));
  const electrical = LEV_ELECTRICAL_FIELDS.map(label => ({ item: label, state: ltkGetDetailValue(detailsByLev, row.id, label) || 'Buen Estado' }));
  const equipment = [
    { name:'Inversor', available: ltkGetDetailValue(detailsByLev, row.id, 'Inversor') || 'No aplica', description:'', state: 'Buen Estado', photoLabel:'Foto de inversor', photoUrl:'' },
    { name:'Baterías', available: ltkGetDetailValue(detailsByLev, row.id, 'Baterias') || ltkGetDetailValue(detailsByLev, row.id, 'Baterías') || 'No aplica', description:'', state: 'Buen Estado', photoLabel:'Foto de baterías', photoUrl:'' },
    { name:'Caja registradora / Gaveta', available:'Sí tiene', description:'', state: ltkGetDetailValue(detailsByLev, row.id, 'Caja registradora / Gaveta') || 'Buen Estado', photoLabel:'', photoUrl:'' },
    { name:'Abanico', available:'Sí tiene', description:'', state: ltkGetDetailValue(detailsByLev, row.id, 'Abanico') || 'Buen Estado', photoLabel:'', photoUrl:'' },
    { name:'Taburete', available:'Sí tiene', description:'', state: ltkGetDetailValue(detailsByLev, row.id, 'Taburete') || 'Buen Estado', photoLabel:'', photoUrl:'' }
  ];
  const findingsCount = Number(row?.findings_count ?? 0) || levEstimateFindings(structure, electrical, equipment);
  const overallStatus = row?.overall_status || levEstimateOverall(structure, electrical, equipment);
  const executiveSummary = row?.resumen || `Levantamiento recibido desde Jotform para agencia ${row?.codigo_agencia || '-'}.`;
  return levNormalizeItem({
    id: `sb-${row.id}`,
    code: row?.codigo || levCode(position + 1),
    category: row?.categoria || 'Levantamiento técnico',
    type: row?.categoria || 'Levantamiento técnico',
    agency: String(row?.codigo_agencia || ''),
    group: ltkNormalizeGroupName(row?.grupo || ''),
    technician: row?.tecnico || row?.responsable || '',
    responsible: row?.tecnico || row?.responsable || '',
    visitDate: row?.fecha_levantamiento || row?.created_at || levToday(),
    submittedAt: row?.created_at || levNow(),
    workflowStatus: row?.workflow_status || row?.estado || 'Pendiente de revisión',
    overallStatus,
    findingsCount,
    evidenceCount: Number(row?.evidence_count ?? 0) || 0,
    executiveSummary,
    agencyObservation: row?.observacion_agencia || '',
    findings: executiveSummary,
    recommendations: row?.recomendaciones || '',
    nextAction: row?.proxima_accion || '',
    structure,
    electrical,
    equipment,
    gallery: [],
    diagnostics: {
      structure: /mal|cr[ií]tic/i.test(overallStatus) ? 'Regular' : 'Bueno',
      electrical: electrical.some(r => /mal|cr[ií]tic/i.test(String(r.state||''))) ? 'Regular' : 'Bueno',
      equipment: equipment.some(r => /mal|cr[ií]tic/i.test(String(r.state||''))) ? 'Regular' : 'Bueno',
      incidents: findingsCount,
      recommendation: findingsCount ? 'Seguimiento preventivo' : 'Sin novedad'
    },
    actions: [],
    createdAt: row?.created_at || levNow(),
    updatedAt: row?.updated_at || row?.created_at || levNow()
  }, position);
}
async function ltkFetchTable(table, query='select=*'){
  const base = (ltkBridgeConfig.backendCeroUrl || '').replace(/\/$/, '');
  const key = ltkBridgeConfig.anonKey || '';
  if(!base || !key) throw new Error('Falta configurar URL base o anon key de BackendCero.');
  const url = `${base}/rest/v1/${table}?${query}`;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if(!response.ok) throw new Error(`No se pudo leer ${table}: ${response.status}`);
  return await response.json();
}
async function ltkSyncAllFromBackendCero(){
    return false;
  try {
    ltkSetSyncStatus('Sincronizando agencias y levantamientos desde BackendCero...');
    ltkUpdateBridgeBadges();
    const [sbAgencias, sbLevs, sbDetails] = await Promise.all([
      ltkFetchTable('agencias', 'select=*&order=id.asc'),
      ltkFetchTable('levantamientos', 'select=*&order=id.asc'),
      ltkFetchTable('levantamientos_detalle', 'select=*&order=id.asc')
    ]);
    (sbAgencias || []).forEach(row => ltkEnsureAgencyFromBackendCero(row));
    const detailsByLev = {};
    (sbDetails || []).forEach(row => {
      const key = String(row.levantamiento_id);
      if(!detailsByLev[key]) detailsByLev[key] = [];
      detailsByLev[key].push(row);
    });
    const localMap = new Map((levRecords || []).map(item => [String(item.id), item]));
    (sbLevs || []).forEach((row, idx) => {
      const record = ltkBuildLevRecord(row, detailsByLev, idx);
      localMap.set(String(record.id), record);
    });
    levRecords = Array.from(localMap.values()).map(levNormalizeItem).sort((a,b) => new Date(b.submittedAt||0) - new Date(a.submittedAt||0));
    levSave();
    levPopulateCategoryFilter();
    levPopulateGroupFilter();
    levFillDatalists();
    levRender();
    if(typeof renderAgencias === 'function') renderAgencias();
    if(typeof renderDetalleAgenciaInventario === 'function'){
      try { renderDetalleAgenciaInventario(); } catch(e){}
    }
    try {
      const modal = document.getElementById('modalDetalleAgencia');
      if (modal && modal.style.display === 'flex' && Number.isInteger(agenciaDetalleActualIndex) && agencias[agenciaDetalleActualIndex]) {
        cargarFormularioDetalleAgencia(agencias[agenciaDetalleActualIndex]);
      }
    } catch(e) { console.error('Error refrescando detalle de agencia tras sync', e); }
    ltkUpdateBridgeBadges();
    ltkSetSyncStatus(`Sincronización completada. Agencias leídas: ${(sbAgencias||[]).length}. Levantamientos leídos: ${(sbLevs||[]).length}.`);
  } catch(error){
    console.error('LTK Sync error:', error);
    ltkSetSyncStatus(`Modo seguro: no se pudo sincronizar BackendCero (${error.message || error}). El sistema sigue funcionando local y el mapa usa agencias/BackendCero.`);
  }
}
let ltkAutoSyncBusy = false;
let ltkOverlayTimer = null;
function ltkShowAutoSyncOverlay(text='Cargando'){
  const overlay = document.getElementById('ltkAutoSyncOverlay');
  const label = document.getElementById('ltkAutoSyncLabel');
  if(label) label.textContent = text;
  if(overlay) overlay.classList.add('show');
}
function ltkHideAutoSyncOverlay(){
  const overlay = document.getElementById('ltkAutoSyncOverlay');
  if(overlay) overlay.classList.remove('show');
}
async function ltkAutoSync(forceOverlay=false, label='Cargando'){
  if(ltkAutoSyncBusy) return;
  ltkAutoSyncBusy = true;
  const started = Date.now();
  if(forceOverlay) ltkShowAutoSyncOverlay(label);
  try {
    await ltkSyncAllFromBackendCero();
  } finally {
    ltkAutoSyncBusy = false;
    if(forceOverlay){
      clearTimeout(ltkOverlayTimer);
      const elapsed = Date.now() - started;
      ltkOverlayTimer = setTimeout(ltkHideAutoSyncOverlay, Math.max(500 - elapsed, 120));
    }
  }
}
function ltkBindAutomaticRefresh(){
  window.addEventListener('focus', () => ltkAutoSync(true, 'Actualizando'));
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') ltkAutoSync(true, 'Actualizando');
  });
}
function ltkInitBridge(){
  ltkLoadBridgeConfig();
  ltkPersistBridgeConfig();
  ltkUpdateBridgeBadges();
  ltkSetSyncStatus('Modo seguro activado: no se abrirá el sincronizador BackendCero automáticamente. Agencias y mapa se cargarán desde la base local/BackendCero.');
  setTimeout(() => { try { if(typeof ltkHideAutoSyncOverlay === 'function') ltkHideAutoSyncOverlay(); } catch(e){} }, 120);
}
window.addEventListener('DOMContentLoaded', ltkInitBridge);
