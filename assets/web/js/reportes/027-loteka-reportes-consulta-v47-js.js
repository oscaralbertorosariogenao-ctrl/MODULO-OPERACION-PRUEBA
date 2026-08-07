
(function(){
  function $(id){return document.getElementById(id)}
  function val(id){var el=$(id); return el ? el.value : ''}
  function esc(value){return String(value == null ? '' : value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function ensureModal(){
    var modal=$('lotekaReportConsultaModal');
    if(modal) return modal;
    document.body.insertAdjacentHTML('beforeend','<div class="loteka-report-modal" id="lotekaReportConsultaModal" onclick="lotekaCloseReportConsultaIfBackdrop(event)"><div class="loteka-report-dialog"><div class="loteka-report-head"><div><h3 id="lotekaReportConsultaTitle">Consulta de operaciones</h3><p id="lotekaReportConsultaSubtitle">Listado detallado del resumen seleccionado.</p></div><button class="loteka-report-close" type="button" onclick="lotekaCloseReportConsulta()"><i class="fas fa-xmark"></i></button></div><div class="loteka-report-body" id="lotekaReportConsultaBody"></div><div class="loteka-report-footer"><button class="loteka-report-light-btn" type="button" onclick="lotekaCloseReportConsulta()">Cerrar</button></div></div></div>');
    return $('lotekaReportConsultaModal');
  }
  window.lotekaCloseReportConsulta=function(){var modal=$('lotekaReportConsultaModal'); if(modal) modal.classList.remove('show')}
  window.lotekaCloseReportConsultaIfBackdrop=function(ev){if(ev && ev.target && ev.target.id==='lotekaReportConsultaModal') window.lotekaCloseReportConsulta()}
  function ensureHeader(tableBodyId, label){
    var body=$(tableBodyId); if(!body) return;
    var tr=body.closest('table')?.querySelector('thead tr'); if(!tr) return;
    var last=tr.lastElementChild;
    if(!last || last.dataset.lotekaConsulta !== '1'){
      tr.insertAdjacentHTML('beforeend','<th data-loteka-consulta="1">Consulta</th>');
    }else if(label){ last.textContent=label; }
  }
  function baseOpsFor(kind){
    if(typeof getOperationsByFilters !== 'function') return [];
    if(kind==='agency') return getOperationsByFilters({typeValue:val('agencyReportFilterType'),statusValue:val('agencyReportFilterStatus'),agencyValue:val('agencyReportFilterAgency'),fromValue:val('agencyReportFilterFrom'),toValue:val('agencyReportFilterTo')});
    if(kind==='owner') return getOperationsByFilters({typeValue:val('ownerReportFilterType'),statusValue:val('ownerReportFilterStatus'),ownerValue:val('ownerReportFilterOwner'),fromValue:val('ownerReportFilterFrom'),toValue:val('ownerReportFilterTo')});
    if(kind==='category') return getOperationsByFilters({typeValue:val('specificReportFilterType'),statusValue:val('specificReportFilterStatus'),specificTypeValue:val('specificReportFilterSpecificType'),fromValue:val('specificReportFilterFrom'),toValue:val('specificReportFilterTo')});
    return [];
  }
  function opsForGroup(kind,key){
    var decoded=decodeURIComponent(key || '');
    var ops=baseOpsFor(kind);
    if(kind==='agency') return ops.filter(function(op){return String(op.agency||'')===decoded});
    if(kind==='owner') return ops.filter(function(op){return String(op.technician || 'Sin asignar')===decoded});
    if(kind==='category') return ops.filter(function(op){var arr=Array.isArray(op.selectedTypes)&&op.selectedTypes.length?op.selectedTypes:['Sin tipo específico']; return arr.indexOf(decoded)>=0});
    return [];
  }
  function getMotive(op){
    var cats=Array.isArray(op.selectedTypes)&&op.selectedTypes.length?op.selectedTypes.join(', '):'';
    return cats || op.title || op.type || 'Sin motivo definido';
  }
  function getFinalNote(op){
    var hist=Array.isArray(op.history)?op.history:[];
    var finalEntry=[].concat(hist).reverse().find(function(h){return h && (h.action==='Finalización' || h.newStatus==='Completado') && h.detail});
    var lastUseful=[].concat(hist).reverse().find(function(h){return h && h.detail && ['Finalización','Estado','Evidencia','Inicio','Asignación'].indexOf(h.action)>=0});
    return op.observacionFinal || op.finalObservation || op.finalComment || (finalEntry&&finalEntry.detail) || (lastUseful&&lastUseful.detail) || op.observacion || op.description || 'Sin observación final registrada.';
  }
  function getCompletedCount(ops){return ops.filter(function(op){return op.status==='Completado'}).length}
  function getOpenCount(ops){return ops.filter(function(op){return op.status!=='Completado'}).length}
  function humanMinutes(fn, ops){
    if(typeof fn !== 'function' || typeof formatMinutesHuman !== 'function') return '-';
    var values=ops.map(fn).filter(function(v){return v!==null && v!==undefined && !isNaN(v)});
    var avg=values.length?values.reduce(function(a,b){return a+b},0)/values.length:0;
    return formatMinutesHuman(avg);
  }
  window.lotekaOpenReportConsulta=function(kind,key){
    var ops=opsForGroup(kind,key).sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0)});
    var name=decodeURIComponent(key || '');
    var typeLabel=kind==='agency'?'Agencia':kind==='owner'?'Responsable':'Tipo específico';
    ensureModal();
    $('lotekaReportConsultaTitle').textContent=typeLabel+': '+(name||'Sin definir');
    $('lotekaReportConsultaSubtitle').textContent='Operaciones vinculadas al resumen seleccionado, con motivo y observación final.';
    var body=$('lotekaReportConsultaBody');
    var kpis='<div class="loteka-report-kpis"><div class="loteka-report-kpi"><span>Total</span><b>'+ops.length+'</b></div><div class="loteka-report-kpi"><span>Completadas</span><b>'+getCompletedCount(ops)+'</b></div><div class="loteka-report-kpi"><span>Activas</span><b>'+getOpenCount(ops)+'</b></div><div class="loteka-report-kpi"><span>Resolución prom.</span><b>'+esc(humanMinutes(typeof getResolutionMinutes==='function'?getResolutionMinutes:null,ops))+'</b></div></div>';
    var list=ops.length?'<div class="loteka-report-list">'+ops.map(function(op){
      var code=esc(op.code||op.id||'-');
      var status=esc(op.status||'-');
      var isDone=op.status==='Completado';
      var location=typeof getOperationLocation==='function'?getOperationLocation(op):(op.agency||'-');
      var reporter=typeof getOperationReporter==='function'?getOperationReporter(op):'-';
      var assignee=typeof getAssigneeDisplayName==='function'?getAssigneeDisplayName(op.technician,op.type):(op.technician||'-');
      var res=typeof getResolutionTimeLabel==='function'?getResolutionTimeLabel(op):'-';
      return '<article class="loteka-report-card"><div class="loteka-report-card-top"><div><div class="loteka-report-code">'+code+'</div><div class="loteka-report-title">'+esc(op.title||'Sin título')+'</div></div><div class="loteka-report-tags"><span class="loteka-report-chip '+(isDone?'ok':'warn')+'">'+status+'</span><span class="loteka-report-chip">'+esc(op.type||'-')+'</span>'+'</div></div><div class="loteka-report-grid"><div class="loteka-report-field"><span>Motivo</span><b>'+esc(getMotive(op))+'</b></div><div class="loteka-report-field"><span>Agencia</span><b>'+esc(location||'-')+'</b></div><div class="loteka-report-field"><span>Responsable</span><b>'+esc(assignee||'-')+'</b></div><div class="loteka-report-field"><span>Resolución</span><b>'+esc(res)+'</b></div></div><div class="loteka-report-note"><strong>Observación final:</strong> '+esc(getFinalNote(op))+'</div><div class="loteka-report-actions"><button class="loteka-consulta-btn" type="button" onclick="showDetail(\''+esc(op.id||'')+'\')"><i class="fas fa-eye"></i> Ver operación</button></div></article>';
    }).join('')+'</div>':'<div class="loteka-report-empty">No hay operaciones asociadas a esta consulta.</div>';
    body.innerHTML=kpis+list;
    $('lotekaReportConsultaModal').classList.add('show');
  }
  function renderAgency(){
    if(typeof buildAgencyGroups!=='function' || typeof renderSimpleSummaryRows!=='function') return;
    ensureHeader('reportAgencyBody','Consulta');
    var operations=baseOpsFor('agency');
    var groups=buildAgencyGroups(operations);
    renderSimpleSummaryRows('reportAgencyBody', groups.map(function(row){
      return '<tr><td>'+esc(row.agency)+'</td><td>'+row.total+'</td><td>'+row.completed+'</td><td>'+row.stillOpen+'</td><td>'+esc(formatMinutesHuman(row.avgAssign))+'</td><td>'+esc(formatMinutesHuman(row.avgResolution))+'</td><td><button class="loteka-consulta-btn" type="button" onclick="lotekaOpenReportConsulta(\'agency\',\''+encodeURIComponent(row.agency)+'\')"><i class="fas fa-list-ul"></i> Consultar</button></td></tr>';
    }),'No hay agencias para este reporte.');
  }
  function renderOwner(){
    if(typeof buildOwnerGroups!=='function' || typeof renderSimpleSummaryRows!=='function') return;
    ensureHeader('reportOwnerBody','Consulta');
    var operations=baseOpsFor('owner');
    var groups=buildOwnerGroups(operations);
    renderSimpleSummaryRows('reportOwnerBody', groups.map(function(row){
      var display=typeof getAssigneeDisplayName==='function'?getAssigneeDisplayName(row.owner,'Avería'):row.owner;
      return '<tr><td>'+esc(display)+'</td><td>'+row.total+'</td><td>'+row.completed+'</td><td>'+row.inProgress+'</td><td>'+esc(formatMinutesHuman(row.avgAssign))+'</td><td>'+esc(formatMinutesHuman(row.avgResolution))+'</td><td><button class="loteka-consulta-btn" type="button" onclick="lotekaOpenReportConsulta(\'owner\',\''+encodeURIComponent(row.owner)+'\')"><i class="fas fa-list-ul"></i> Consultar</button></td></tr>';
    }),'No hay responsables para este reporte.');
  }
  function renderCategory(){
    if(typeof populateDedicatedSpecificTypeOptions==='function') populateDedicatedSpecificTypeOptions();
    if(typeof buildCategoryGroups!=='function' || typeof renderSimpleSummaryRows!=='function') return;
    ensureHeader('reportCategoryBody','Consulta');
    var operations=baseOpsFor('category');
    var groups=buildCategoryGroups(operations);
    renderSimpleSummaryRows('reportCategoryBody', groups.map(function(row){
      return '<tr><td>'+esc(row.category)+'</td><td>'+row.total+'</td><td>'+row.completed+'</td><td>'+row.stillOpen+'</td><td>'+esc(formatMinutesHuman(row.avgAssign))+'</td><td>'+esc(formatMinutesHuman(row.avgResolution))+'</td><td><button class="loteka-consulta-btn" type="button" onclick="lotekaOpenReportConsulta(\'category\',\''+encodeURIComponent(row.category)+'\')"><i class="fas fa-list-ul"></i> Consultar</button></td></tr>';
    }),'No hay tipos específicos para este reporte.');
  }
  window.renderAgencyReports=renderAgency;
  window.renderOwnerReports=renderOwner;
  window.renderSpecificReports=renderCategory;
  function attachRefreshers(){
    ['agencyReportFilterType','agencyReportFilterStatus','agencyReportFilterAgency','agencyReportFilterFrom','agencyReportFilterTo'].forEach(function(id){var el=$(id); if(el){el.addEventListener('input',function(){setTimeout(renderAgency,0)}); el.addEventListener('change',function(){setTimeout(renderAgency,0)});}});
    ['ownerReportFilterType','ownerReportFilterStatus','ownerReportFilterOwner','ownerReportFilterFrom','ownerReportFilterTo'].forEach(function(id){var el=$(id); if(el){el.addEventListener('input',function(){setTimeout(renderOwner,0)}); el.addEventListener('change',function(){setTimeout(renderOwner,0)});}});
    ['specificReportFilterType','specificReportFilterSpecificType','specificReportFilterStatus','specificReportFilterFrom','specificReportFilterTo'].forEach(function(id){var el=$(id); if(el){el.addEventListener('input',function(){setTimeout(renderCategory,0)}); el.addEventListener('change',function(){setTimeout(renderCategory,0)});}});
  }
  function init(){
    ensureModal();
    attachRefreshers();
    try{renderAgency()}catch(e){console.warn('renderAgency v47',e)}
    try{renderOwner()}catch(e){console.warn('renderOwner v47',e)}
    try{renderCategory()}catch(e){console.warn('renderCategory v47',e)}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
