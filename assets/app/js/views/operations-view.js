import { el } from '../components/dom.js';
import { searchInput } from '../components/search-input.js';
import { operationCard } from '../components/operation-card.js';
import { emptyState } from '../components/empty-state.js';
import { skeletonCards } from '../components/skeleton.js';
import { can } from '../permissions.js';
const STATUS_CHIPS = ['Todos','Pendiente','Asignada','En proceso','Completado'];
export function operationsView(state){
  const slice = state.operations; const filters = slice.filters || {};
  return el('div',{class:'page operations-page'},
    el('div',{class:'page-header'},el('div',{},el('h1',{class:'page-title',text:'Operaciones'}),el('p',{class:'page-subtitle',text:'Consulta, asigna y da seguimiento desde el móvil.'})),can('operations.create',state) ? el('button',{class:'btn btn-primary btn-sm',type:'button','data-action':'go-create-operation'},'＋ Crear') : null),
    el('section',{class:'filter-bar'},
      el('div',{class:'input-row'},searchInput({value:filters.search || '',placeholder:'Código, agencia o descripción',action:'operations-search',label:'Buscar operaciones'}),el('button',{class:'btn btn-secondary',type:'button','data-action':'open-operation-filters','aria-label':'Abrir filtros'},'Filtros')),
      el('div',{class:'chip-row','aria-label':'Filtro por estado'},STATUS_CHIPS.map(status => el('button',{class:`chip${(filters.status || 'Todos') === status ? ' is-active' : ''}`,type:'button','data-action':'filter-operation-status','data-status':status,text:status}))),
      el('div',{class:'filter-summary'},el('span',{text:`${slice.total || 0} operación(es)`}),activeFilters(filters) ? el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'clear-operation-filters'},'Limpiar filtros') : null)
    ),
    slice.loading && !slice.items.length ? skeletonCards(5) : slice.items.length ? el('section',{class:'list','aria-label':'Listado de operaciones'},slice.items.map(operationCard)) : emptyState({icon:'⌕',title:'No encontramos operaciones',message:'Ajusta la búsqueda o los filtros.',action:'clear-operation-filters',actionLabel:'Mostrar todas'}),
    slice.hasMore ? el('div',{class:'load-more'},el('button',{class:'btn btn-outline',type:'button','data-action':'load-more-operations',disabled:slice.loading ? '' : null},slice.loading ? 'Cargando…' : 'Cargar más')) : null
  );
}
function activeFilters(filters){ return Object.entries(filters).some(([key,value]) => key !== 'status' ? Boolean(value) : value && value !== 'Todos'); }
