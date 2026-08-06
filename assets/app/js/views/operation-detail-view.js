import { el } from '../components/dom.js';
import { statusBadge } from '../components/status-badge.js';
import { normalizeOperation, operationElapsed, primaryAction } from '../services/operations-service.js';
import { emptyState } from '../components/empty-state.js';
export function operationDetailView(state, canAction){
  const op = normalizeOperation(state.operations.selected || {});
  if(!op.id && !op.code) return emptyState({icon:'!',title:'Operación no encontrada',message:'No fue posible cargar este registro.',action:'go-operations',actionLabel:'Volver'});
  const primary = primaryAction(op,canAction); const agency = op.agencyLabel || (op.agencyNumber ? `Agencia ${op.agencyNumber}` : 'Sin agencia');
  return el('div',{class:'page operation-detail-page'},
    el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'go-back'},'← Volver'),
    el('section',{class:'detail-hero'},el('div',{class:'detail-hero-top'},el('div',{},el('span',{class:'operation-code',text:op.code}),el('h1',{text:op.title}),el('p',{text:op.description || 'Sin descripción'})),statusBadge(op.status)),
      el('div',{class:'detail-grid'},detailStat('Tipo',op.type),detailStat('Agencia',agency),detailStat('Técnico',op.technician),detailStat('Transcurrido',operationElapsed(op)))),
    section('Información operativa',el('dl',{class:'info-list'},info('Código',op.code),info('Estado',op.status),info('Grupo',op.group || 'No registrado'),info('Encargado',op.manager || 'No registrado'),info('Contacto',op.managerPhone || 'No registrado'),info('Creada',formatDate(op.createdAt)),info('Asignada',formatDate(op.assignedAt)),info('Iniciada',formatDate(op.startedAt)),info('Finalizada',formatDate(op.completedAt)))),
    op.originOperationId ? section('Origen del reporte',el('p',{text:`Problema detectado durante la atención de ${op.originOperationId}.`})) : null,
    op.work || op.diagnosis ? section('Trabajo y diagnóstico',el('dl',{class:'info-list'},info('Trabajo',op.work || 'No definido'),info('Diagnóstico',op.diagnosis || 'No registrado'))) : null,
    section('Seguimiento',el('div',{class:'grid grid-2'},
      actionButton('💬','Comentario','open-comment',canAction('operations.comment')),actionButton('🩺','Diagnóstico','open-diagnosis',canAction('operations.diagnose')),
      actionButton('📷','Evidencia','open-evidence',canAction('operations.evidence')),actionButton('♟',/sin asignar/i.test(op.technician) ? 'Asignar' : 'Reasignar',/sin asignar/i.test(op.technician) ? 'open-assignment' : 'open-reassignment',canAction('operations.assign')),
      actionButton('⚠','Reportar problema encontrado','report-related-problem',canAction('operations.report') && Boolean(op.agencyNumber) && ['Asignado','En proceso','En incidencia'].includes(op.status)),actionButton('☎','WhatsApp','open-whatsapp-actions',Boolean(op.managerPhone)),actionButton('⌂','Abrir agencia','open-operation-agency',Boolean(op.agencyNumber))
    )),
    section('Evidencias',mediaSection([...op.reportedMedia,...op.evidenceMedia])),
    section('Equipos y seriales',equipmentSection(op)),
    section('Historial de esta operación',timeline(op.history)),
    canAction('operations.closeWhatsapp') && op.status !== 'Completado' ? el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'open-whatsapp-close'},'Cerrar por soporte WhatsApp') : null,
    primary ? el('div',{class:'primary-action-dock'},el('button',{class:`btn btn-${primary.tone} btn-block`,type:'button','data-action':primary.action,text:primary.label})) : null
  );
}
function section(title,body){ return el('section',{class:'card section'},el('div',{class:'section-heading'},el('h2',{text:title})),body); }
function detailStat(label,value){ return el('div',{class:'detail-stat'},el('span',{text:label}),el('strong',{text:value || '—'})); }
function info(label,value){ return el('div',{class:'info-row'},el('dt',{text:label}),el('dd',{text:value || '—'})); }
function actionButton(icon,label,action,visible){ return visible ? el('button',{class:'btn btn-secondary',type:'button','data-action':action},el('span',{'aria-hidden':'true',text:icon}),label) : null; }
function formatDate(value){ if(!value) return 'No registrada'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'No registrada' : new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short'}).format(date); }
function mediaSection(urls){
  if(!urls.length) return el('p',{class:'muted',text:'Sin evidencias registradas.'});
  return el('div',{class:'media-grid'},urls.map(url => el('a',{class:'media-item',href:url,target:'_blank',rel:'noopener noreferrer','aria-label':'Abrir evidencia'},/\.(mp4|mov|webm)(\?|$)/i.test(url) ? el('video',{src:url,controls:'',preload:'metadata'}) : el('img',{src:url,alt:'Evidencia de operación',loading:'lazy'}))));
}
function equipmentSection(op){
  const values = [...op.equipment.map(item => item.nombre || item.producto || String(item)),...op.serials.map(item => item.serial || String(item))];
  return values.length ? el('ul',{class:'list'},values.map(value => el('li',{class:'list-item'},el('span',{'aria-hidden':'true',text:'▣'}),el('span',{text:value})))) : el('p',{class:'muted',text:'No hay equipos o seriales relacionados en el registro.'});
}
function timeline(history){
  if(!history.length) return el('p',{class:'muted',text:'El historial específico aparecerá aquí.'});
  return el('div',{class:'timeline'},[...history].reverse().map(item => el('div',{class:'timeline-item'},el('span',{class:'timeline-dot','aria-hidden':'true'}),el('div',{class:'timeline-body'},el('strong',{text:item.accion || item.action || item.tipo || 'Actualización'}),el('p',{text:item.detalle || item.comentario || ''}),el('small',{class:'muted',text:`${item.nombre || item.usuario || 'Usuario'} · ${formatDate(item.fecha || item.created_at)}`})))));
}
