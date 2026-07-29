
(function(){
  'use strict';
  const VERSION = 'v216';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const clean = (v) => String(v ?? '').replace(/\s+/g,' ').trim();
  const digits = (v) => String(v ?? '').replace(/\D+/g,'');
  const pad4 = (v) => digits(v).padStart(4,'0');

  function toast(title, msg, type){
    try{
      if(typeof window.notify === 'function') return window.notify(title, msg || '', type || 'info');
      if(typeof window.showToast === 'function') return window.showToast(title, msg || '', type || 'info');
    }catch(e){}
    console.log(`[${VERSION}] ${title}: ${msg || ''}`);
  }

  function getAgencyNumber(){
    const sources = [
      '#detalleAgenciaNombre', '#detalleAgenciaNumero', '#agencyFieldNumero',
      '#agencyFieldGO', '#agencyFieldCodigo', '#tituloModalAgencia'
    ];
    for(const sel of sources){
      const el = $(sel);
      const value = clean(el?.value || el?.textContent || '');
      const d = digits(value);
      if(d) return d.slice(-4).padStart(4,'0');
    }
    const chips = $$('#modalDetalleAgencia .agency-chip, #modalDetalleAgencia [class*="chip"], #modalDetalleAgencia button, #modalDetalleAgencia .value');
    for(const el of chips){
      const txt = clean(el.textContent || '');
      const m = txt.match(/(?:Agencia|GO|LTK)[^0-9]*(\d{1,5})/i);
      if(m) return m[1].slice(-4).padStart(4,'0');
    }
    return '';
  }

  function loadOps(){
  /*
    OPERACIONES / CAPA A2 - Paso 7:
    Este bloque ya no lee operations_records.
    Usa memoria segura alimentada por Supabase/loadOperations().
  */
  try{
    if(typeof window.loadOperations === 'function'){
      const list = window.loadOperations();
      if(Array.isArray(list)) return list;
    }
  }catch(e){}

  try{
    if(typeof loadOperations === 'function'){
      const list = loadOperations();
      if(Array.isArray(list)) return list;
    }
  }catch(e){}

  try{
    if(Array.isArray(window.operations)) return window.operations;
  }catch(e){}

  try{
    if(typeof operations !== 'undefined' && Array.isArray(operations)) return operations;
  }catch(e){}

  try{
    if(Array.isArray(window.__lotekaOperationsMemory)) return window.__lotekaOperationsMemory;
  }catch(e){}

  return [];
}



  function candidateAgencyValues(op){
    return [
      op?.agency, op?.agencia, op?.location, op?.ubicacion, op?.codigo_agencia,
      op?.agencyCode, op?.agency_code, op?.go, op?.numeroAgencia, op?.numero_agencia,
      op?.agencyNumber, op?.agency_number, op?.branch, op?.sucursal
    ].filter(v => v !== undefined && v !== null).map(clean);
  }

  function opMatchesAgency(op, agencyNumber){
    const target = pad4(agencyNumber);
    const targetNum = String(parseInt(target || '0', 10));
    if(!target) return false;
    return candidateAgencyValues(op).some(value => {
      const d = digits(value);
      if(!d) return false;
      const dLast = d.slice(-4).padStart(4,'0');
      const dInt = String(parseInt(d, 10));
      return d === target || dLast === target || dInt === targetNum || value.toLowerCase().includes(target.toLowerCase());
    });
  }

  function agencyOps(agencyNumber){
    return loadOps().filter(op => opMatchesAgency(op, agencyNumber));
  }

  function openOperationsList(){
    try{
      if(typeof window.abrirVistaOperaciones === 'function'){
        window.abrirVistaOperaciones('list','ops-listado', document.getElementById('navOperations') || document.getElementById('navList'));
        return;
      }
    }catch(e){}
    try{ document.getElementById('navOperations')?.click(); }catch(e){}
  }

  function openAgencyReport(){
    try{
      if(typeof window.abrirVistaOperaciones === 'function'){
        window.abrirVistaOperaciones('reportsAgency','ops-reportes-agencia', document.getElementById('navReportsAgency') || document.getElementById('navReports'));
        return;
      }
    }catch(e){}
    try{ document.getElementById('navReportsAgency')?.click(); }catch(e){}
  }

  function closeAgencyModal(){
    const modal = document.getElementById('modalDetalleAgencia');
    if(modal) modal.style.display = 'none';
  }

  function setInput(id, value){
    const el = document.getElementById(id);
    if(!el) return false;
    el.value = value;
    try{ el.dispatchEvent(new Event('input', {bubbles:true})); }catch(e){}
    try{ el.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){}
    return true;
  }

  function removeNotices(){
    $$('.go-v216-filter-notice,.go-v216-empty-ops').forEach(n => n.remove());
  }

  function putNotice(viewId, agencyNumber, count){
    removeNotices();
    const view = document.getElementById(viewId) || document.querySelector('.view:not(.hidden)') || document.body;
    const holder = view.querySelector('.panel, .report-box, .table-wrap, .topbar') || view;
    const notice = document.createElement('div');
    notice.className = 'go-v216-filter-notice';
    notice.innerHTML = `<i class="fas fa-filter"></i><div><strong>Agencia ${agencyNumber}</strong><span>${count > 0 ? `${count} operación(es) encontrada(s). Consulta filtrada usando los reportes existentes.` : 'SIN OPERACIONES'}</span></div>`;
    holder.parentNode ? holder.parentNode.insertBefore(notice, holder) : view.prepend(notice);
  }

  function showEmptyInOperations(agencyNumber){
    const view = document.getElementById('listView') || document.getElementById('vista-ops-listado') || document.body;
    const wrap = view.querySelector('.table-wrap') || view;
    if(!view.querySelector('.go-v216-empty-ops')){
      const empty = document.createElement('div');
      empty.className = 'go-v216-empty-ops';
      empty.textContent = `SIN OPERACIONES · Agencia ${agencyNumber}`;
      wrap.parentNode ? wrap.parentNode.insertBefore(empty, wrap) : view.prepend(empty);
    }
  }

  function showEmptyInReport(agencyNumber){
    const body = document.getElementById('reportAgencyBody');
    if(body) body.innerHTML = `<tr><td colspan="6"><div class="go-v216-empty-ops">SIN OPERACIONES · Agencia ${agencyNumber}</div></td></tr>`;
  }

  function filterOperationsForAgency(){
    const agencyNumber = getAgencyNumber();
    if(!agencyNumber) return toast('Agencia no detectada', 'No pude leer el número de agencia desde el expediente.', 'warning');
    const list = agencyOps(agencyNumber);
    closeAgencyModal();
    openOperationsList();
    setTimeout(() => {
      setInput('filterAgency', agencyNumber);
      setInput('operationSearch', agencyNumber);
      try{ if(typeof window.renderOperations === 'function') window.renderOperations(); }catch(e){}
      putNotice('listView', agencyNumber, list.length);
      if(!list.length){
        showEmptyInOperations(agencyNumber);
        toast('SIN OPERACIONES', `La agencia ${agencyNumber} no tiene operaciones registradas.`, 'warning');
      }else{
        toast('Consulta filtrada', `Agencia ${agencyNumber}: ${list.length} operación(es).`, 'success');
      }
    }, 180);
  }

  function filterReportForAgency(){
    const agencyNumber = getAgencyNumber();
    if(!agencyNumber) return toast('Agencia no detectada', 'No pude leer el número de agencia desde el expediente.', 'warning');
    const list = agencyOps(agencyNumber);
    closeAgencyModal();
    openAgencyReport();
    setTimeout(() => {
      setInput('agencyReportFilterAgency', agencyNumber);
      setInput('reportFilterAgency', agencyNumber);
      try{ if(typeof window.renderAgencyReports === 'function') window.renderAgencyReports(); }catch(e){}
      putNotice('reportsAgencyView', agencyNumber, list.length);
      if(!list.length){
        showEmptyInReport(agencyNumber);
        toast('SIN OPERACIONES', `La agencia ${agencyNumber} no tiene operaciones para reportar.`, 'warning');
      }else{
        toast('Reporte filtrado', `Reporte por agencia ${agencyNumber} listo con ${list.length} operación(es).`, 'success');
      }
    }, 220);
  }

  function changeAgencyTab(name){
    try{
      if(typeof window.cambiarSeccionAgencia === 'function'){
        const tab = $$('.agency-master-tab').find(b => clean(b.textContent).toLowerCase().includes(name === 'ficha' ? 'ficha' : 'levantamientos'));
        window.cambiarSeccionAgencia(name, tab);
      }
    }catch(e){}
  }

  document.addEventListener('click', function(ev){
    const btn = ev.target && ev.target.closest ? ev.target.closest('[data-v212-action]') : null;
    if(!btn) return;
    const action = btn.getAttribute('data-v212-action');
    if(!['operations','report','ficha','levantamientos'].includes(action)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    if(action === 'operations') return filterOperationsForAgency();
    if(action === 'report') return filterReportForAgency();
    if(action === 'ficha') return changeAgencyTab('ficha');
    if(action === 'levantamientos') return changeAgencyTab('levantamientos');
  }, true);

  console.log('LOTEKA v216: consultas de agencia filtradas listas, sin insertar código dentro de scripts existentes.');
})();
