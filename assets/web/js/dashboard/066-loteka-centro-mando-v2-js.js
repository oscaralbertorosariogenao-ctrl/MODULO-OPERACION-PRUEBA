
(function(){
  'use strict';
  const OPS_TABLE='reportes_operaciones';
  function clean(v){return String(v??'').trim();}
  function lower(v){return clean(v).toLowerCase();}
  function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=String(value);}
  function parseDate(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
  function isToday(v){const d=parseDate(v);if(!d)return false;const n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();}
  function getCreatedAt(op){return op?.fecha_creacion||op?.createdAt||op?.created_at||op?.fecha_reporte||op?.date||'';}
  function getCompletedAt(op){return op?.fecha_completado||op?.completedAt||op?.completed_at||op?.closedAt||op?.closed_at||'';}
  function getAssignedAt(op){return op?.fecha_asignacion||op?.assignedAt||op?.assigned_at||'';}
  function getStartedAt(op){return op?.fecha_inicio||op?.startedAt||op?.started_at||'';}
  function getStatus(op){return clean(op?.estado||op?.status||'Pendiente');}
  function getType(op){return clean(op?.tipo||op?.type||op?.categoria_visible||op?.category||'Operación');}
  function getCode(op){return clean(op?.codigo||op?.code||op?.id||op?.$id||'');}
  function getAgency(op){return clean(op?.agencia_label||op?.agencyLabel||op?.agencia||op?.agency||op?.agencia_numero||'Sin agencia');}
  function getResponsible(op){return clean(op?.tecnico||op?.technician||op?.responsable||op?.owner||op?.suplidor||op?.supplier||op?.encargado||'Sin asignar');}
  function getIssueName(op){return clean(op?.problema_reportado||op?.averia||op?.issue||op?.titulo||op?.title||op?.descripcion||op?.description||'Avería registrada');}
  function getWorkName(op){return clean(op?.trabajo_a_realizar||op?.trabajo||op?.work||op?.titulo||op?.title||op?.descripcion||op?.description||'Trabajo registrado');}
  function isCompleted(op){return lower(getStatus(op)).includes('completado');}
  function isPending(op){return lower(getStatus(op))==='pendiente';}
  function isAssigned(op){return lower(getStatus(op))==='asignada';}
  function isInProcess(op){return lower(getStatus(op))==='en proceso'||lower(getStatus(op)).includes('proceso');}
  function isIssue(op){return lower(getType(op)).includes('aver');}
  function isWork(op){return lower(getType(op)).includes('trabaj');}
  function fmtDate(v){const d=parseDate(v);if(!d)return 'Sin fecha';return d.toLocaleDateString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric'});}
  function fmtTime(v){const d=parseDate(v);if(!d)return 'Sin inicio';return d.toLocaleTimeString('es-DO',{hour:'2-digit',minute:'2-digit'});}
  function fmtElapsedFrom(v){const d=parseDate(v);if(!d)return 'Sin inicio';const diff=Math.max(0,Date.now()-d.getTime());const mins=Math.floor(diff/60000);if(mins<60)return `${mins} min`;const h=Math.floor(mins/60);const m=mins%60;if(h<24)return `${h}h ${m}m`;const days=Math.floor(h/24);const rh=h%24;return `${days}d ${rh}h`;}

  function esc(v){try{if(typeof escapeHtml==='function')return escapeHtml(v);}catch(e){}return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
  function js(v){return String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,' ');}
  function normalizeRemote(row){return {
    id:row.id||row.$id||row.codigo||row.code,
    code:row.codigo||row.code||row.id,
    tipo:row.tipo||row.type||row.categoria_visible,
    titulo:row.titulo||row.title,
    descripcion:row.descripcion||row.description,
    estado:row.estado||row.status||'Pendiente',
    agencia:row.agencia_label||row.agencia||row.agency,
    tecnico:row.tecnico||row.technician,
    responsable:row.responsable||row.owner||row.suplidor||row.supplier||row.encargado,
    problema_reportado:row.problema_reportado||row.averia||row.issue,
    trabajo_a_realizar:row.trabajo_a_realizar||row.trabajo||row.work,
    createdAt:row.fecha_creacion||row.createdAt||row.created_at||row.fecha_reporte,
    assignedAt:row.fecha_asignacion||row.assignedAt||row.assigned_at,
    startedAt:row.fecha_inicio||row.startedAt||row.started_at,
    completedAt:row.fecha_completado||row.completedAt||row.completed_at
  };}
  function localOperations(){
  /*
    OPERACIONES / CAPA A2 - Paso 4:
    Centro de mando ya no usa operations_records como fallback.
    Solo usa memoria segura alimentada por Supabase/loadOperations().
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
 async function remoteOperations(){
  try{
    const sb = window.lotekaSupabase || window.supabaseClient || null;
    if(!sb || typeof sb.from !== 'function') return null;

    /*
      CAPA 1 / PASO 6A:
      No pedimos columnas específicas aquí para evitar 400 Bad Request
      si reportes_operaciones no tiene alguno de los campos legacy.
      normalizeRemote() ya sabe leer diferentes nombres si existen.
    */
    const loader = async function(){
      const response = await sb
        .from(OPS_TABLE)
        .select('*')
        .limit(2000);
      if(response && response.error) throw response.error;
      return response;
    };
    const runtime = window.GOApp;
    const res = runtime && runtime.data && typeof runtime.data.fetch === 'function'
      ? await runtime.data.fetch('dashboard:reportes-operaciones', loader, { ttl: 60000 })
      : await loader();

    if(res && !res.error && Array.isArray(res.data)){
      return res.data
        .map(normalizeRemote)
        .sort(function(a,b){
          const da = new Date(a.fecha_creacion || a.createdAt || a.created_at || 0).getTime() || 0;
          const db = new Date(b.fecha_creacion || b.createdAt || b.created_at || 0).getTime() || 0;
          return db - da;
        });
    }

    if(res && res.error){
      console.warn('[Centro de mando] reportes_operaciones no cargó:', res.error.message || res.error);
    }

  }catch(e){
    console.warn('[Centro de mando] No se pudo leer Supabase:', e && e.message ? e.message : e);
  }

  return null;
}
  function calculate(list){const ops=Array.isArray(list)?list:[];return {createdToday:ops.filter(op=>isToday(getCreatedAt(op))).length,pending:ops.filter(isPending).length,assigned:ops.filter(isAssigned).length,completedToday:ops.filter(op=>isCompleted(op)&&(isToday(getCompletedAt(op))||(!getCompletedAt(op)&&isToday(getCreatedAt(op))))).length};}
  function rowAction(op){const id=getCode(op);return id?`<button class="home-row-action" onclick="lotekaCommandOpenOperation('${js(id)}')"><i class="fas fa-eye"></i> Ver</button>`:'<span class="home-state-pill neutral">Sin código</span>';}
  const commandTableState={averiasPage:1,trabajosPage:1,pageSize:7,lastList:[]};
  function clampPage(page,totalPages){page=Number(page)||1;return Math.max(1,Math.min(page,Math.max(1,totalPages||1)));}
  function renderCommandPager(type,total,page){
    const isAv=type==='averias';
    const pager=document.getElementById(isAv?'homeAveriasProcesoPager':'homeTrabajosEjecucionPager');
    if(!pager)return;
    const totalPages=Math.ceil((total||0)/commandTableState.pageSize);
    if(totalPages<=1){pager.innerHTML=total?`<span class="home-command-pager-info">Mostrando ${total} registro${total===1?'':'s'}.</span>`:'';return;}
    page=clampPage(page,totalPages);
    const start=(page-1)*commandTableState.pageSize+1;
    const end=Math.min(total,page*commandTableState.pageSize);
    const pages=[];
    for(let i=1;i<=totalPages;i++){
      if(i===1||i===totalPages||Math.abs(i-page)<=1){pages.push(i);}
      else if(pages[pages.length-1]!=='...'){pages.push('...');}
    }
    const prev=`<button type="button" class="home-command-page-btn" ${page<=1?'disabled':''} onclick="lotekaCommandTablePage('${type}',${page-1})" aria-label="Página anterior"><i class="fas fa-chevron-left"></i></button>`;
    const next=`<button type="button" class="home-command-page-btn" ${page>=totalPages?'disabled':''} onclick="lotekaCommandTablePage('${type}',${page+1})" aria-label="Página siguiente"><i class="fas fa-chevron-right"></i></button>`;
    const nums=pages.map(p=>p==='...'?'<span class="home-command-page-ellipsis">...</span>':`<button type="button" class="home-command-page-btn ${p===page?'active':''}" onclick="lotekaCommandTablePage('${type}',${p})">${p}</button>`).join('');
    pager.innerHTML=`<span class="home-command-pager-info">${start}-${end} de ${total}</span><div class="home-command-pages">${prev}${nums}${next}</div>`;
  }
  window.lotekaCommandTablePage=function(type,page){
    if(type==='averias')commandTableState.averiasPage=page;
    if(type==='trabajos')commandTableState.trabajosPage=page;
    renderCommandTables(commandTableState.lastList||[]);
  };
  function renderCommandTables(list){
    const ops=Array.isArray(list)?list:[];
    commandTableState.lastList=ops;
    const allAverias=ops.filter(op=>isIssue(op)&&isInProcess(op)).sort((a,b)=>(parseDate(getStartedAt(b))?.getTime()||0)-(parseDate(getStartedAt(a))?.getTime()||0));
    const allTrabajos=ops.filter(op=>isWork(op)&&(isAssigned(op)||isInProcess(op))).sort((a,b)=>(parseDate(getAssignedAt(b))?.getTime()||0)-(parseDate(getAssignedAt(a))?.getTime()||0));
    const avPages=Math.ceil(allAverias.length/commandTableState.pageSize);
    const trPages=Math.ceil(allTrabajos.length/commandTableState.pageSize);
    commandTableState.averiasPage=clampPage(commandTableState.averiasPage,avPages);
    commandTableState.trabajosPage=clampPage(commandTableState.trabajosPage,trPages);
    const avStart=(commandTableState.averiasPage-1)*commandTableState.pageSize;
    const trStart=(commandTableState.trabajosPage-1)*commandTableState.pageSize;
    const averias=allAverias.slice(avStart,avStart+commandTableState.pageSize);
    const trabajos=allTrabajos.slice(trStart,trStart+commandTableState.pageSize);
    const avBody=document.getElementById('homeAveriasProceso');
    if(avBody){avBody.innerHTML=averias.length?averias.map(op=>`<tr><td><strong>${esc(getAgency(op))}</strong></td><td title="${esc(getIssueName(op))}">${esc(getIssueName(op))}</td><td title="${esc(getResponsible(op))}">${esc(getResponsible(op))}</td><td>${esc(fmtTime(getStartedAt(op)))}</td><td><span class="home-command-status">${esc(fmtElapsedFrom(getStartedAt(op)))}</span></td><td>${rowAction(op)}</td></tr>`).join(''):'<tr><td colspan="6">No hay averías en proceso.</td></tr>';}
    renderCommandPager('averias',allAverias.length,commandTableState.averiasPage);
    const trBody=document.getElementById('homeTrabajosEjecucion');
    if(trBody){trBody.innerHTML=trabajos.length?trabajos.map(op=>`<tr><td><strong>${esc(getAgency(op))}</strong></td><td title="${esc(getWorkName(op))}">${esc(getWorkName(op))}</td><td title="${esc(getResponsible(op))}">${esc(getResponsible(op))}</td><td><span class="home-command-status">${esc(getStatus(op))}</span></td><td>${esc(fmtDate(getAssignedAt(op)||getCreatedAt(op)))}</td><td>${rowAction(op)}</td></tr>`).join(''):'<tr><td colspan="6">No hay trabajos asignados o en proceso.</td></tr>';}
    renderCommandPager('trabajos',allTrabajos.length,commandTableState.trabajosPage);
  }
  function paint(metrics,source,list){setText('cmdTodayCreated',metrics.createdToday||0);setText('cmdTodayPending',metrics.pending||0);setText('cmdTodayAssigned',metrics.assigned||0);setText('cmdTodayCompleted',metrics.completedToday||0);const src=document.getElementById('cmdSummarySource');if(src)src.textContent=source==='supabase'?'Datos reales · Supabase':'Datos locales';renderCommandTables(list||[]);}
  let running=false;
  window.lotekaRefreshCommandCenterSummary=async function(){if(running)return;running=true;try{const remote=await remoteOperations();if(remote&&remote.length){paint(calculate(remote),'supabase',remote);return;}const local=localOperations();paint(calculate(local),'local',local);}catch(e){console.warn('[Centro de mando] Error actualizando resumen:',e);const local=localOperations();paint(calculate(local),'local',local);}finally{running=false;}};
  window.lotekaOpenNewOperationFromCommand=function(){try{if(typeof window.openCreateModal==='function'){window.openCreateModal();return;}if(typeof openCreateModal==='function'){openCreateModal();return;}}catch(e){}try{if(typeof window.abrirVistaOperaciones==='function'){window.abrirVistaOperaciones('operations','ops-operaciones',document.getElementById('navOperations'));}else if(typeof window.showView==='function'){window.showView('operations');}else if(typeof showView==='function'){showView('operations');}setTimeout(function(){try{if(typeof window.openCreateModal==='function')window.openCreateModal();else if(typeof openCreateModal==='function')openCreateModal();else document.getElementById('openCreateModalBtn')?.click();}catch(e){document.getElementById('openCreateModalBtn')?.click();}},140);}catch(e){try{document.getElementById('openCreateModalBtn')?.click();}catch(_e){}}};
  window.lotekaCommandOpenOperation=function(id){try{if(typeof window.abrirVistaOperaciones==='function')window.abrirVistaOperaciones('operations','ops-operaciones',document.getElementById('navOperations'));else if(typeof window.showView==='function')window.showView('operations');else if(typeof showView==='function')showView('operations');setTimeout(function(){try{if(typeof window.showDetail==='function')window.showDetail(id);else if(typeof showDetail==='function')showDetail(id);}catch(e){console.warn('[Centro de mando] No se pudo abrir detalle:',e);}},180);}catch(e){console.warn('[Centro de mando] No se pudo abrir operación:',e);}};
  window.lotekaCommandOpenOpsFilter=function(kind){try{if(typeof window.abrirVistaOperaciones==='function'){window.abrirVistaOperaciones('operations','ops-operaciones',document.getElementById('navOperations'));}else if(typeof window.showView==='function'){window.showView('operations');}else if(typeof showView==='function'){showView('operations');}setTimeout(function(){const status=document.getElementById('filterStatus');const from=document.getElementById('filterDateFrom');const to=document.getElementById('filterDateTo');const today=new Date().toISOString().slice(0,10);if(status){if(kind==='pendiente')status.value='Pendiente';else if(kind==='asignada')status.value='Asignada';else if(kind==='completado-hoy')status.value='Completado';else status.value='';}if(from&&to){if(kind==='today'||kind==='completado-hoy'){from.value=today;to.value=today;}else{from.value='';to.value='';}}try{if(typeof window.renderOperations==='function')window.renderOperations();else if(typeof renderOperations==='function')renderOperations();}catch(e){}},160);}catch(e){console.warn('[Centro de mando] No se pudo abrir filtro:',e);}};
  function boot(){
    window.lotekaRefreshCommandCenterSummary();
    if(window.__lotekaCommandCenterSummaryTimer) return;
    window.__lotekaCommandCenterSummaryTimer=setInterval(function(){
      if(document.hidden) return;
      window.lotekaRefreshCommandCenterSummary();
    },120000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
