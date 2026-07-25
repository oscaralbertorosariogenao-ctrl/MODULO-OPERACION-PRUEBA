import { el, option } from './dom.js';
import { openBottomSheet } from './bottom-sheet.js';
import { OPERATION_STATUSES, OPERATION_TYPES } from '../config.js';
export function openOperationFilters(filters = {}, technicians = [], groups = []){
  const form = el('form',{'data-form':'operation-filters',class:'stack'},
    field('Estado',el('select',{class:'select',name:'status'},option('Todos','Todos',!filters.status || filters.status === 'Todos'),OPERATION_STATUSES.map(value => option(value,value,filters.status === value)))),
    field('Tipo',el('select',{class:'select',name:'type'},option('Todos','Todos',!filters.type || filters.type === 'Todos'),OPERATION_TYPES.map(value => option(value,value,filters.type === value)))),
    field('Técnico',el('input',{class:'input',name:'technician',value:filters.technician || '',list:'filter-tech-options',placeholder:'Nombre o usuario'})),
    el('datalist',{id:'filter-tech-options'},technicians.map(item => { const name=item.nombre_completo || item.nombre || item.usuario_login; return option(name,name); })),
    field('Grupo',el('select',{class:'select',name:'group'},option('','Todos los grupos',!filters.group),groups.map(group => { const name=group.nombre || group.codigo; return option(name,group.nombre || `Grupo ${group.codigo}`,filters.group === name); }))),
    el('div',{class:'grid grid-2'},field('Desde',el('input',{class:'input',type:'date',name:'dateFrom',value:filters.dateFrom || ''})),field('Hasta',el('input',{class:'input',type:'date',name:'dateTo',value:filters.dateTo || ''}))),
    el('div',{class:'grid grid-2'},el('button',{class:'btn btn-secondary',type:'button','data-action':'clear-operation-filters'},'Limpiar'),el('button',{class:'btn btn-primary',type:'submit'},'Aplicar'))
  );
  return openBottomSheet({id:'operation-filter-sheet',title:'Filtrar operaciones',body:form});
}
function field(label,control){ return el('label',{class:'field'},el('span',{text:label}),control); }
