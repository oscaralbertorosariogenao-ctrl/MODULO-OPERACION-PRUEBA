import { el, option } from './dom.js';
import { openModal } from './modal.js';
import { evidenceUploader } from './evidence-uploader.js';
export function assignmentDialog(operation, technicians, { reassign = false } = {}){
  const formName = reassign ? 'reassign-operation' : 'assign-operation';
  const form = el('form',{class:'stack','data-form':formName},
    el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),
    field('Técnico',el('select',{class:'select',name:'technician',required:''},option('','Selecciona un técnico',true),technicians.map(tech => { const name = tech.nombre_completo || tech.nombre || tech.usuario_login; return option(name,name,false); }))),
    field('Comentario',el('textarea',{class:'textarea',name:'comment',placeholder:'Contexto de la asignación o reasignación.',maxlength:'1000'})),
    el('button',{class:'btn btn-primary btn-block',type:'submit'},reassign ? 'Confirmar reasignación' : 'Confirmar asignación')
  );
  return openModal({id:'assignment-dialog',title:reassign ? 'Reasignar operación' : 'Asignar operación',body:form});
}
export function commentDialog(operation){
  return openModal({id:'comment-dialog',title:'Agregar comentario',body:el('form',{class:'stack','data-form':'add-comment'},el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),field('Comentario',el('textarea',{class:'textarea',name:'comment',maxlength:'2000',placeholder:'Escribe el avance o seguimiento.'})),el('button',{class:'btn btn-primary btn-block',type:'submit'},'Guardar comentario'))});
}
export function diagnosisDialog(operation){
  return openModal({id:'diagnosis-dialog',title:'Registrar diagnóstico',body:el('form',{class:'stack','data-form':'add-diagnosis'},el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),field('Diagnóstico',el('textarea',{class:'textarea',name:'diagnosis',required:'',maxlength:'3000',placeholder:'Describe el diagnóstico técnico confirmado.'})),el('button',{class:'btn btn-primary btn-block',type:'submit'},'Guardar diagnóstico'))});
}
export function evidenceDialog(operation, files){
  return openModal({id:'evidence-dialog',title:'Agregar evidencia',body:el('form',{class:'stack','data-form':'add-evidence'},el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),field('Descripción',el('textarea',{class:'textarea',name:'description',maxlength:'1000',placeholder:'Qué muestra esta evidencia.'})),evidenceUploader(files,{prefix:'detail'}),el('div',{class:'progress hidden','data-evidence-progress':'true'},el('span',{style:'width:0%'})),el('button',{class:'btn btn-primary btn-block',type:'submit'},'Subir y relacionar evidencia'))});
}
export function finishDialog(operation){
  return openModal({id:'finish-dialog',title:'Finalizar operación',body:el('form',{class:'stack','data-form':'finish-operation'},el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),el('p',{text:'La operación debe estar en proceso y tener evidencia confirmada.'}),field('Comentario final (opcional)',el('textarea',{class:'textarea',name:'comment',maxlength:'2000',placeholder:'Resume la solución aplicada.'})),el('button',{class:'btn btn-success btn-block',type:'submit'},'Confirmar finalización'))});
}
export function whatsappActionsDialog(operation){
  const phone = operation.managerPhone || '';
  return openModal({id:'whatsapp-actions',title:'Contacto por WhatsApp',body:el('div',{class:'stack'},el('p',{text:phone ? `Contacto registrado: ${phone}` : 'No hay teléfono registrado.'}),waButton('Confirmar si continúa la avería','consulta',operation,phone),waButton('Solicitar foto y video','evidencia',operation,phone),waButton('Enviar pasos rápidos','pasos',operation,phone))});
}
export function whatsappCloseDialog(operation){
  return openModal({id:'whatsapp-close-dialog',title:'Resolver por soporte remoto',body:el('form',{class:'stack','data-form':'close-whatsapp'},
    el('input',{type:'hidden',name:'reference',value:operation.id || operation.code}),
    field('Motivo',el('select',{class:'select',name:'reason',required:''},option('','Selecciona el motivo',true),option('Resuelto remotamente','Resuelto remotamente'),option('Orientación al encargado','Orientación al encargado'),option('Reinicio o reconexión','Reinicio o reconexión'),option('Otro soporte remoto','Otro soporte remoto'))),
    field('Encargado',el('input',{class:'input',name:'manager',value:operation.manager || '',required:''})),
    field('Teléfono',el('input',{class:'input',name:'phone',value:operation.managerPhone || '',inputmode:'tel',required:''})),
    field('Comentario (opcional)',el('textarea',{class:'textarea',name:'comment',maxlength:'2000',placeholder:'Explica claramente cómo se resolvió.'})),
    el('p',{class:'draft-note',text:'Este cierre se registrará en el historial específico de la operación y no exigirá evidencia física.'}),
    el('button',{class:'btn btn-success btn-block',type:'submit'},'Confirmar resolución remota')
  )});
}
export function agencyFiltersDialog(groups, filters = {}){
  return openModal({id:'agency-filter-dialog',title:'Filtrar agencias',body:el('form',{class:'stack','data-form':'agency-filters'},field('Grupo',el('select',{class:'select',name:'groupId'},option('','Todos los grupos',!filters.groupId),groups.map(group => option(group.id,group.nombre || `Grupo ${group.codigo}`,String(filters.groupId) === String(group.id))))),field('Estado',el('select',{class:'select',name:'status'},option('Todos','Todos',!filters.status || filters.status === 'Todos'),option('Activa','Activa',filters.status === 'Activa'),option('Inactiva','Inactiva',filters.status === 'Inactiva'))),el('button',{class:'btn btn-primary btn-block',type:'submit'},'Aplicar filtros'))});
}
function field(label,control){ return el('label',{class:'field'},el('span',{text:label}),control); }
function waButton(label,type,operation,phone){ return el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'send-whatsapp-template','data-template':type,'data-phone':phone,'data-operation-id':operation.id || operation.code,text:label}); }
