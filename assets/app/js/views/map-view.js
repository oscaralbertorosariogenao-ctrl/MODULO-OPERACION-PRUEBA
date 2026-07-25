import { el, option } from '../components/dom.js';
export function mapView(state){
  const groups = state.agencies.groups || [];
  return el('div',{class:'page map-page'},
    el('div',{class:'page-header'},el('div',{},el('h1',{class:'page-title',text:'Mapa de agencias'}),el('p',{class:'page-subtitle',text:'Marcadores agrupados y navegación externa.'})),el('button',{class:'btn btn-outline btn-sm',type:'button','data-action':'center-user-location'},'Mi ubicación')),
    el('label',{class:'field'},el('span',{text:'Filtrar por grupo'}),el('select',{class:'select','data-change-action':'map-group-filter'},option('','Todos los grupos',true),groups.map(group => option(group.id,group.nombre || `Grupo ${group.codigo}`)))),
    el('div',{id:'agency-map',class:'map-shell',role:'application','aria-label':'Mapa interactivo de agencias'}),
    el('p',{class:'map-note',text:'El mapa carga solo agencias con coordenadas válidas y utiliza agrupación para evitar más de mil marcadores individuales.'})
  );
}
