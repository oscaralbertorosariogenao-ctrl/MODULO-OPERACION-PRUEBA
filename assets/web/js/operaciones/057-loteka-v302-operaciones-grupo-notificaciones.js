
(function(){
  'use strict';

  const SUPABASE_URL_V302 = 'https://tnymrjxdhzdmpcbilftj.supabase.co';
  const SUPABASE_ANON_KEY_V302 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWIiOiJhbm9uIiwiaWF0IjoxNzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.invalid';
  // Nota: no usamos la constante anterior para crear cliente salvo que no exista window.lotekaSupabase.
  // El index ya trae su cliente Supabase real. Este bloque solo mejora búsqueda de agencia/grupo y refresco.

  function clean(v){ return String(v == null ? '' : v).trim(); }
  function agencyDigits(v){
    const raw = clean(v);
    if(!raw) return '';
    const m = raw.match(/(\d{1,5})/);
    if(!m) return '';
    const n = Number(m[1]);
    return Number.isFinite(n) ? String(n) : String(m[1]).replace(/^0+/,'') || '0';
  }
  function groupTextFromAgency(a){
    if(!a) return '';
    const raw = clean(a.grupo || a.grupo_nombre || a.nombre_grupo || a.grupoId || a.grupo_id || a.group || a.group_name || a.zona || a.region || '');
    if(!raw) return '';
    if(/^grupo\s+/i.test(raw)) return raw.replace(/^grupo\s+/i,'').trim();
    return raw;
  }
  function allAgencies(){
    const sources = [];
    try{ if(Array.isArray(window.agencias)) sources.push(window.agencias); }catch(e){}
    try{ if(Array.isArray(agencias)) sources.push(agencias); }catch(e){}
    try{ const saved = JSON.parse(localStorage.getItem('agencias') || '[]'); if(Array.isArray(saved)) sources.push(saved); }catch(e){}
    try{ const saved2 = JSON.parse(localStorage.getItem('loteka_agencias') || '[]'); if(Array.isArray(saved2)) sources.push(saved2); }catch(e){}
    return sources.flat().filter(Boolean);
  }
  function agencyNumberCandidates(a){
    return [a.numero, a.codigo, a.agencia, a.numero_agencia, a.num_agencia, a.id_agencia, a.id, a.nombre]
      .map(agencyDigits).filter(Boolean);
  }

  const originalFindAgencyRecord = window.findAgencyRecord;
  window.findAgencyRecord = function findAgencyRecordV302(value){
    const wanted = agencyDigits(value);
    if(!wanted) return null;
    const list = allAgencies();
    const found = list.find(function(a){ return agencyNumberCandidates(a).includes(wanted); });
    if(found) return found;
    try{ return typeof originalFindAgencyRecord === 'function' ? originalFindAgencyRecord(value) : null; }catch(e){ return null; }
  };

  const originalNormalizeAgencyLabel = window.normalizeAgencyLabel;
  window.normalizeAgencyLabel = function normalizeAgencyLabelV302(value){
    const n = agencyDigits(value);
    return n ? 'Agencia ' + n.padStart(4,'0') : (typeof originalNormalizeAgencyLabel === 'function' ? originalNormalizeAgencyLabel(value) : clean(value));
  };

  const originalEnrichOperation = window.enrichOperationWithAgencyContext;
  window.enrichOperationWithAgencyContext = function enrichOperationWithAgencyContextV302(op){
    op = op || {};
    const source = op.agency_number || op.agencia || op.agency || op.agency_label || op.agencia_label || '';
    const agency = window.findAgencyRecord(source);
    let enriched = (typeof originalEnrichOperation === 'function') ? originalEnrichOperation(op) : Object.assign({}, op);
    if(agency){
      const num = agencyDigits(source) || agencyDigits(agency.numero || agency.codigo || agency.agencia || agency.numero_agencia);
      const label = clean(agency.nombre || agency.agencia_label || agency.label || '') || (num ? 'Agencia ' + num.padStart(4,'0') : clean(source));
      const grupo = groupTextFromAgency(agency) || clean(enriched.grupo || op.grupo || '');
      enriched = Object.assign({}, enriched, {
        agency_number: num || clean(enriched.agency_number || op.agency_number || ''),
        agency_label: label,
        agency: label,
        agencia: num || clean(enriched.agencia || op.agencia || ''),
        grupo: grupo,
        nombre_encargado: clean(enriched.nombre_encargado || op.nombre_encargado || agency.encargado || agency.responsable || ''),
        created_by: clean(enriched.created_by || op.created_by || op.nombre_encargado || agency.encargado || agency.responsable || ''),
        agency_direccion: clean(agency.direccion || agency.referencia || enriched.agency_direccion || ''),
        agency_latitude: agency.latitud || agency.lat || agency.latitude || enriched.agency_latitude || null,
        agency_longitude: agency.longitud || agency.lng || agency.lon || agency.longitude || enriched.agency_longitude || null
      });
    }
    if(!clean(enriched.grupo) && agency) enriched.grupo = groupTextFromAgency(agency);
    return enriched;
  };

  async function getSb(){
    try{ if(window.lotekaSupabase) return window.lotekaSupabase; }catch(e){}
    try{ if(window.supabase && window.supabase.createClient){
      // Usa las credenciales reales del bloque principal si existen; no expone secrets.
      if(!window.__lotekaOpsV302Client){
        window.__lotekaOpsV302Client = window.supabase.createClient('https://tnymrjxdhzdmpcbilftj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueW1yanhkaHpkbXBjYmlsZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.YXG9juChbJUUdsdy01Qkoh9X0-MijewD5aQbKnG9Itk');
      }
      return window.__lotekaOpsV302Client;
    }}catch(e){}
    return null;
  }

  async function repairMissingOperationGroups(){
    const sb = await getSb();
    if(!sb) return;
    try{
      const local = typeof loadOperations === 'function' ? loadOperations() : [];
      let changed = false;
      const repaired = (Array.isArray(local)?local:[]).map(function(op){
        const next = window.enrichOperationWithAgencyContext(op);
        if(clean(next.grupo) !== clean(op.grupo)){ changed = true; }
        return next;
      });
      if(changed && typeof saveOperations === 'function'){
        saveOperations(repaired);
        ['renderOperations','renderDashboard','renderHistory','renderReports'].forEach(function(fn){ try{ if(typeof window[fn] === 'function') window[fn](); }catch(e){} });
      }
      for(const op of repaired){
        if(clean(op.id) && clean(op.grupo)){
          // Actualiza solamente si la fila quedó sin grupo o con valor viejo vacío.
          try{ await sb.from('reportes_operaciones').update({ grupo: clean(op.grupo), agencia_label: clean(op.agency_label || op.agency || '') }).eq('id', op.id).or('grupo.is.null,grupo.eq.'); }catch(e){}
        }
      }
    }catch(err){ console.warn('[LOTEKA v302] No se pudo reparar grupo de operaciones:', err && err.message ? err.message : err); }
  }

  const originalSyncFrom = window.syncOperationsFromBackendCero;
  if(typeof originalSyncFrom === 'function'){
    window.syncOperationsFromBackendCero = async function syncOperationsFromBackendCeroV302(opts){
      const r = await originalSyncFrom.apply(this, arguments);
      setTimeout(repairMissingOperationGroups, 250);
      return r;
    };
  }

  const originalSyncOne = window.syncOperationToBackendCero;
  if(typeof originalSyncOne === 'function'){
    window.syncOperationToBackendCero = async function syncOperationToBackendCeroV302(op){
      const enriched = window.enrichOperationWithAgencyContext(op || {});
      Object.assign(op || {}, enriched);
      const r = await originalSyncOne.call(this, enriched);
      setTimeout(repairMissingOperationGroups, 350);
      return r;
    };
  }

  // Mejora apertura de notificaciones de operaciones: busca por código si no hay UUID.
  const originalOpenNotification = window.openNotification;
  if(typeof originalOpenNotification === 'function'){
    window.openNotification = async function openNotificationV302(n){
      try{
        const ref = clean(n && (n.referencia_tipo || n.ref_tipo)).toLowerCase();
        const code = clean(n && (n.referencia_codigo || n.codigo));
        if(ref === 'operaciones' && code){
          if(typeof cambiarVista === 'function') cambiarVista('operaciones');
          setTimeout(function(){
            try{
              const ops = typeof loadOperations === 'function' ? loadOperations() : [];
              const op = ops.find(function(x){ return clean(x.code || x.codigo) === code || clean(x.id) === code; });
              if(op && typeof showDetail === 'function') showDetail(op.id);
            }catch(e){}
          }, 450);
          return;
        }
      }catch(e){}
      return originalOpenNotification.apply(this, arguments);
    };
  }

  function boot(){
    setTimeout(repairMissingOperationGroups, 900);
    setTimeout(repairMissingOperationGroups, 2500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
