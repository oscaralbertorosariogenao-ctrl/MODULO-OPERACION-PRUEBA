import { el } from './dom.js';
export function emptyState({ icon = '○', title = 'Sin resultados', message = 'No hay información para mostrar.', action = '', actionLabel = '' } = {}){
  return el('div',{class:'empty-state'},el('div',{class:'empty-icon','aria-hidden':'true',text:icon}),el('h3',{text:title}),el('p',{text:message}),action && actionLabel ? el('button',{class:'btn btn-primary',type:'button','data-action':action,text:actionLabel}) : null);
}
