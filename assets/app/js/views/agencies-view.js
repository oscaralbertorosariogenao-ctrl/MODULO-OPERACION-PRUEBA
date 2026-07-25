import { el } from '../components/dom.js';
import { searchInput } from '../components/search-input.js';
import { emptyState } from '../components/empty-state.js';
import { skeletonCards } from '../components/skeleton.js';
export function agenciesView(state){
  const slice = state.agencies; const filters = slice.filters || {};
  return el('div',{class:'page agencies-page'},
    el('div',{class:'page-header'},el('div',{},el('h1',{class:'page-title',text:'Agencias'}),el('p',{class:'page-subtitle',text:'Busca, contacta y consulta operaciones o equipos.'})),el('button',{class:'btn btn-outline btn-sm',type:'button','data-action':'go-map'},'⌖ Mapa')),
    el('div',{class:'input-row'},searchInput({value:filters.search || '',placeholder:'Número, nombre o dirección',action:'agencies-search',label:'Buscar agencias'}),el('button',{class:'btn btn-secondary',type:'button','data-action':'open-agency-filters'},'Filtros')),
    el('div',{class:'filter-summary'},el('span',{text:`${slice.total || 0} agencia(s)`}),filters.search || filters.groupId ? el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'clear-agency-filters'},'Limpiar') : null),
    slice.loading && !slice.items.length ? skeletonCards(5) : slice.items.length ? el('section',{class:'list'},slice.items.map(agencyCard)) : emptyState({icon:'⌂',title:'Sin agencias',message:'No encontramos agencias con esos criterios.',action:'clear-agency-filters',actionLabel:'Mostrar todas'}),
    slice.hasMore ? el('div',{class:'load-more'},el('button',{class:'btn btn-outline',type:'button','data-action':'load-more-agencies',disabled:slice.loading ? '' : null},slice.loading ? 'Cargando…' : 'Cargar más')) : null
  );
}
function agencyCard(agency){
  const group = agency.grupos?.nombre || agency.grupo || agency.grupo_nombre || (agency.grupo_id ? `Grupo ${agency.grupo_id}` : 'Sin grupo');
  return el('article',{class:'card agency-card is-clickable',tabindex:'0',role:'button','data-action':'open-agency','data-agency-id':agency.id || agency.numero,'aria-label':`Abrir agencia ${agency.numero || ''}`},
    el('div',{class:'agency-card-head'},el('span',{class:'agency-number',text:agency.numero || '—'}),el('span',{class:`badge ${agency.activo === false ? 'badge-danger' : 'badge-complete'}`,text:agency.estado_operativo || agency.estado || (agency.activo === false ? 'Inactiva' : 'Activa')})),
    el('div',{},el('h3',{text:agency.nombre || `Agencia ${agency.numero || ''}`}),el('p',{text:group}),el('p',{text:agency.direccion || [agency.sector,agency.municipio].filter(Boolean).join(', ') || 'Dirección no registrada'}))
  );
}
