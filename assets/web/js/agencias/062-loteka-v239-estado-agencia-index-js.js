
(function(){
  'use strict';
  if(window.__lotekaV239EstadoAgenciaIndex) return;
  window.__lotekaV239EstadoAgenciaIndex = true;
  var ESTADOS = ['Toldo no enciende','Toldo en mal estado','Bombillo quemado','Pintura deteriorada','Cerámica rota','Filtración','Puerta dañada','Letrero en mal estado','Problema eléctrico','Baño en mal estado','Otro'];
  var TRABAJOS = ['Construcción de toldo','Reparación de toldo','Cambio de lona','Instalación eléctrica de toldo','Cambio de bombillo','Pintura de agencia','Reparación de cerámica','Corrección de filtración','Reparación de puerta','Reparación de letrero','Reparación eléctrica','Reparación de baño','Evaluación de suplidor','Otro trabajo'];
  function txt(v){return String(v == null ? '' : v).trim();}
  function esc(v){try{ if(typeof escapeHtml === 'function') return escapeHtml(txt(v)); }catch(e){} return txt(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function low(v){return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function getOps(){try{return (typeof loadOperations === 'function' ? loadOperations() : []) || [];}catch(e){return [];}}
  function saveOps(ops){try{ if(typeof saveOperations === 'function') saveOperations(ops); }catch(e){} }
  function findOp(id){return getOps().find(function(o){return String(o && o.id)===String(id) || String(o && o.code)===String(id) || String(o && o.codigo)===String(id);});}
  function getProblem(op){return txt(op && (op.problema_reportado || op.problemaReportado || op.estado_agencia_reportado || op.estadoAgenciaReportado || op.title || op.titulo));}
  function getTrabajo(op){return txt(op && (op.trabajo_a_realizar || op.trabajoARealizar));}
  function isEstadoAgencia(op){
    if(!op) return false;
    if(low(op.categoria_visible || op.categoriaVisible) === 'estado de agencia') return true;
    if(txt(op.estado_agencia_reportado || op.estadoAgenciaReportado || op.problema_reportado || op.problemaReportado)) return true;
    var title = low(op.title || op.titulo);
    return ESTADOS.some(function(x){return low(x)===title;});
  }
  function getReporter(op){return txt(op.reportado_por_nombre || op.creado_por_nombre || op.usuario_creador_nombre || op.created_by || op.encargado || 'No registrado');}
  function getOrigin(op){return txt(op.origen_reporte || op.origenReporte || op.source || 'Sistema');}
  function getRole(op){return txt(op.reportado_por_rol || op.reportadoPorRol || 'No especificado');}
  function optionsHtml(selected){return '<option value="">Seleccionar trabajo a realizar...</option>'+TRABAJOS.map(function(x){return '<option value="'+esc(x)+'" '+(txt(selected)===x?'selected':'')+'>'+esc(x)+'</option>';}).join('');}
  function injectDetailEstadoPanel(id){
    var op = findOp(id); if(!isEstadoAgencia(op)) return;
    var content = document.getElementById('detailContent'); if(!content || content.querySelector('#goEstadoAgenciaDetailPanel')) return;
    var problem = getProblem(op) || 'No especificado';
    var work = getTrabajo(op);
    var html = '<div class="go-detail-panel go-estado-panel" id="goEstadoAgenciaDetailPanel" style="grid-column:1/-1">'+
      '<h4><i class="fas fa-store"></i> Estado de agencia reportado</h4>'+
      '<div class="go-estado-grid">'+
        '<div class="go-estado-box"><span>Problema reportado</span><b>'+esc(problem)+'</b></div>'+
        '<div class="go-estado-box"><span>Trabajo a realizar</span><b>'+esc(work || 'Pendiente de definir al asignar')+'</b></div>'+
        '<div class="go-estado-box"><span>Reportado por</span><b>'+esc(getReporter(op))+'</b></div>'+
        '<div class="go-estado-box"><span>Origen</span><b>'+esc(getOrigin(op))+'</b></div>'+
        '<div class="go-estado-box"><span>Rol reportante</span><b>'+esc(getRole(op))+'</b></div>'+
        '<div class="go-estado-box"><span>Categoría visible</span><b>Estado de agencia</b></div>'+
      '</div>'+
      (work ? '<div class="go-estado-ok"><i class="fas fa-circle-check"></i> Trabajo definido por Operaciones: <b>'+esc(work)+'</b>.</div>' : '<div class="go-estado-alert"><i class="fas fa-triangle-exclamation"></i> Esta operación fue reportada como Estado de agencia. Al asignarla, Operaciones debe definir el trabajo real a realizar.</div>')+
      '</div>';
    var body = content.querySelector('.go-detail-body');
    if(body){
      var whatsapp = body.querySelector('#goWhatsappOperationPanel');
      if(whatsapp) whatsapp.insertAdjacentHTML('afterend', html); else body.insertAdjacentHTML('afterbegin', html);
    } else content.insertAdjacentHTML('afterbegin', html);
  }
  function ensureEditField(){
    if(document.getElementById('goEstadoTrabajoWrap')) return document.getElementById('goEstadoTrabajoWrap');
    var ref = document.getElementById('editOperationTypeOptionsBtn');
    var holder = ref ? ref.closest('.field') : null;
    var div = document.createElement('div');
    div.id = 'goEstadoTrabajoWrap';
    div.className = 'go-estado-work-field hidden';
    div.innerHTML = '<label for="goEstadoTrabajoSelect"><i class="fas fa-briefcase"></i> Trabajo a realizar</label><select id="goEstadoTrabajoSelect"></select><small>Obligatorio cuando una operación de Estado de agencia sea asignada. El problema reportado se conserva separado del trabajo que Operaciones decide ejecutar.</small>';
    if(holder) holder.insertAdjacentElement('afterend', div); else (document.querySelector('#editModalBackdrop .modal-body')||document.body).appendChild(div);
    return div;
  }
  function getEditClassificationField(){
    var ref = document.getElementById('editOperationTypeOptionsBtn');
    return ref ? ref.closest('.field') : null;
  }
  function applyEditField(id){
    var wrap = ensureEditField();
    var select = document.getElementById('goEstadoTrabajoSelect');
    var op = findOp(id || (document.getElementById('editOperationId')||{}).value);
    var active = isEstadoAgencia(op);
    var classificationField = getEditClassificationField();
    if(!wrap || !select) return;
    select.innerHTML = optionsHtml(getTrabajo(op));
    wrap.classList.toggle('hidden', !active);
    if(classificationField){
      classificationField.classList.toggle('hidden', active);
      classificationField.setAttribute('data-hidden-for-estado-agencia', active ? '1' : '0');
    }
  }
  function notifyTrabajoAssigned(op, work){
    try{
      if(!work || typeof window.lotekaCrearNotificacion !== 'function') return;
      var code = txt(op.code || op.codigo || op.id || 'Operación');
      var agency = txt(op.agency_number || op.agencia || op.agency || 'N/D');
      window.lotekaCrearNotificacion({
        modulo:'OPERACIONES',
        tipo:'ESTADO_AGENCIA',
        titulo:'Trabajo definido para Estado de agencia',
        mensaje:code+' · Agencia '+agency+' · '+work,
        importancia:'alta',
        referencia_tipo:'operacion',
        referencia_codigo:code,
        operacion_id:op.id || null
      }, true);
    }catch(e){console.warn('[Estado agencia] notificación no creada:', e && e.message ? e.message : e);}
  }
  function persistTrabajoAfterSave(id, beforeWork){
    var select = document.getElementById('goEstadoTrabajoSelect');
    var work = txt(select && select.value);
    if(!work) return;
    var ops = getOps(); var idx = ops.findIndex(function(o){return String(o && o.id)===String(id);});
    if(idx < 0 || !isEstadoAgencia(ops[idx])) return;
    var changed = txt(ops[idx].trabajo_a_realizar || ops[idx].trabajoARealizar) !== work;
    ops[idx].categoria_visible = ops[idx].categoriaVisible = 'Estado de agencia';
    ops[idx].problema_reportado = ops[idx].problemaReportado = getProblem(ops[idx]);
    ops[idx].estado_agencia_reportado = ops[idx].estadoAgenciaReportado = ops[idx].estado_agencia_reportado || ops[idx].estadoAgenciaReportado || ops[idx].problema_reportado;
    ops[idx].trabajo_a_realizar = ops[idx].trabajoARealizar = work;
    ops[idx].asignacion_trabajo_fecha = ops[idx].asignacionTrabajoFecha = ops[idx].asignacion_trabajo_fecha || new Date().toISOString();
    ops[idx].asignacion_trabajo_usuario = ops[idx].asignacionTrabajoUsuario = (typeof getCurrentUserEmail === 'function' ? getCurrentUserEmail() : 'Operaciones');
    saveOps(ops);
    if(changed){ notifyTrabajoAssigned(ops[idx], work); }
    try{ if(typeof syncOperationToBackendCero === 'function') syncOperationToBackendCero(ops[idx]); }catch(e){}
    try{ if(typeof renderOperations === 'function') renderOperations(); }catch(e){}
    try{ if(typeof renderHistory === 'function') renderHistory(); }catch(e){}
    try{ if(typeof renderReports === 'function') renderReports(); }catch(e){}
  }
  function install(){
    if(typeof window.showDetail === 'function' && !window.showDetail.__estadoAgenciaV239){
      var prevDetail = window.showDetail;
      window.showDetail = function(id){ var r = prevDetail.apply(this, arguments); setTimeout(function(){injectDetailEstadoPanel(id);}, 220); return r; };
      window.showDetail.__estadoAgenciaV239 = true;
    }
    if(typeof window.openEditModal === 'function' && !window.openEditModal.__estadoAgenciaV239){
      var prevEdit = window.openEditModal;
      window.openEditModal = function(id){ var r = prevEdit.apply(this, arguments); setTimeout(function(){applyEditField(id);}, 120); return r; };
      window.openEditModal.__estadoAgenciaV239 = true;
    }
    if(typeof window.saveEditedOperation === 'function' && !window.saveEditedOperation.__estadoAgenciaV239){
      var prevSave = window.saveEditedOperation;
      window.saveEditedOperation = async function(){
        var id = (document.getElementById('editOperationId')||{}).value;
        var op = findOp(id);
        var beforeWork = getTrabajo(op);
        var isEstado = isEstadoAgencia(op);
        var newStatus = txt((document.getElementById('editOperationStatus')||{}).value);
        var newTech = txt((document.getElementById('editOperationTechnician')||{}).value);
        var work = txt((document.getElementById('goEstadoTrabajoSelect')||{}).value);
        if(isEstado && (newStatus === 'Asignada' || newStatus === 'En proceso' || newTech) && !work){
          alert('Debes seleccionar el Trabajo a realizar para asignar esta operación de Estado de agencia.');
          return;
        }
        var out = await prevSave.apply(this, arguments);
        setTimeout(function(){persistTrabajoAfterSave(id, beforeWork);}, 120);
        return out;
      };
      window.saveEditedOperation.__estadoAgenciaV239 = true;
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  setTimeout(install, 600); setTimeout(install, 1400);
})();
