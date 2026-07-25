import { el } from './dom.js';
import { statusBadge } from './status-badge.js';
import { normalizeOperation, operationElapsed, isOverdue } from '../services/operations-service.js';
export function operationCard(row){
  const op = normalizeOperation(row); const agency = op.agencyLabel || (op.agencyNumber ? `Agencia ${op.agencyNumber}` : 'Agencia no indicada');
  return el('article',{class:'card operation-card is-clickable',tabindex:'0',role:'button','data-action':'open-operation','data-operation-id':op.id || op.code,'aria-label':`Abrir ${op.code}, ${op.title}`},
    el('div',{class:'operation-card-head'},
      el('div',{},el('span',{class:'operation-code',text:op.code || 'SIN CÓDIGO'}),el('h3',{class:'operation-title',text:op.title})),
      statusBadge(op.status)
    ),
    el('p',{class:'operation-desc',text:op.description || 'Sin descripción registrada.'}),
    el('div',{class:'operation-meta'},
      meta('⌂',agency),meta('G',op.group || 'Sin grupo'),meta('♟',op.technician || 'Sin asignar'),meta('◷',operationElapsed(op))
    ),
    el('div',{class:'operation-footer'},
      el('span',{class:isOverdue(op) ? 'badge badge-danger' : 'badge badge-neutral',text:isOverdue(op) ? 'Atrasada' : op.type}),
      el('span',{class:'muted',text:formatDate(op.createdAt)})
    )
  );
}
function meta(icon,text){ return el('span',{},el('b',{'aria-hidden':'true',text:icon}),el('span',{class:'truncate',text})); }
function formatDate(value){ if(!value) return 'Sin fecha'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-DO',{dateStyle:'short',timeStyle:'short'}).format(date); }
