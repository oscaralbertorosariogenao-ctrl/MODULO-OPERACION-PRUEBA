import { el } from './dom.js';
import { openModal } from './modal.js';
export function confirmDialog({ title = 'Confirmar acción', message, confirmLabel = 'Confirmar', confirmAction, tone = 'danger' }){
  return openModal({ id:'confirm-dialog', title, body:el('p',{text:message}), footer:[el('button',{class:'btn btn-secondary',type:'button','data-action':'close-modal'},'Cancelar'),el('button',{class:`btn btn-${tone}`,type:'button','data-action':confirmAction},confirmLabel)] });
}
