import { el, initials } from '../components/dom.js';
import { searchInput } from '../components/search-input.js';
import { emptyState } from '../components/empty-state.js';
export function techniciansView(state){
  const search = state.technicians.search || ''; const technicians = (state.technicians.items || []).filter(item => !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));
  return el('div',{class:'page technicians-page'},
    el('div',{class:'page-header'},el('div',{},el('h1',{class:'page-title',text:'Técnicos'}),el('p',{class:'page-subtitle',text:'Carga operativa y última actividad registrada.'}))),
    searchInput({value:search,placeholder:'Buscar técnico',action:'technicians-search',label:'Buscar técnicos'}),
    technicians.length ? el('section',{class:'list'},technicians.map(techCard)) : emptyState({icon:'♟',title:'Sin técnicos',message:'No se encontraron técnicos activos.'})
  );
}
function techCard(tech){
  const name = tech.nombre_completo || tech.nombre || tech.usuario_login || 'Técnico'; const count = Number(tech.activeOperations || 0); const phone = tech.telefono_whatsapp || tech.telefono || '';
  return el('article',{class:'card tech-card'},el('div',{class:'avatar',text:initials(name)}),el('div',{},el('h3',{text:name}),el('p',{text:tech.puestos?.nombre || tech.roles?.nombre || tech.departamento || 'Técnico'}),el('p',{text:tech.lastActivity ? `Última actividad: ${formatDate(tech.lastActivity)}` : 'Sin actividad reciente confirmada'})),el('div',{class:'workload'},el('strong',{text:String(count)}),el('span',{text:'activas'}),phone ? el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'contact-technician','data-phone':phone,'data-name':name},'Contactar') : null));
}
function formatDate(value){ const date = new Date(value); return Number.isNaN(date.getTime()) ? 'No registrada' : new Intl.DateTimeFormat('es-DO',{dateStyle:'short',timeStyle:'short'}).format(date); }
