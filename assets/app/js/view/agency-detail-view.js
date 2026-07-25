import { el } from '../components/dom.js';
import { operationCard } from '../components/operation-card.js';
import { externalMapUrl, phoneUrl, whatsappUrl, validCoordinates } from '../services/location-service.js';
export function agencyDetailView(state){
  const agency = state.agencies.selected || {}; const relatedOps = agency.relatedOperations || []; const equipment = agency.equipment || [];
  const group = agency.grupos?.nombre || agency.grupo || (agency.grupo_id ? `Grupo ${agency.grupo_id}` : 'Sin grupo');
  const manager = agency.encargado || agency.grupos?.encargado || 'No registrado'; const phone = agency.telefono || agency.grupos?.telefono || '';
  return el('div',{class:'page agency-detail-page'},
    el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'go-back'},'← Volver'),
    el('section',{class:'agency-hero'},el('span',{class:'agency-number',text:agency.numero || '—'}),el('h1',{text:agency.nombre || `Agencia ${agency.numero || ''}`}),el('p',{class:'muted',text:group}),el('span',{class:'badge badge-complete',text:agency.estado_operativo || agency.estado || 'Activa'})),
    el('section',{class:'contact-actions'},contact('☎','Llamar',phoneUrl(phone)),contact('◉','WhatsApp',whatsappUrl(phone,`Hola, contacto desde Operaciones Grupo Ortiz sobre la agencia ${agency.numero || ''}.`)),contact('⌖','Ruta',externalMapUrl(agency))),
    section('Información',el('dl',{class:'info-list'},info('Dirección',agency.direccion || 'No registrada'),info('Sector',agency.sector || 'No registrado'),info('Municipio',agency.municipio || 'No registrado'),info('Provincia',agency.provincia || 'No registrada'),info('Grupo',group),info('Encargado',manager),info('Teléfono',phone || 'No registrado'),info('Coordenadas',validCoordinates(agency) ? `${agency.latitud}, ${agency.longitud}` : 'No válidas o no registradas'))),
    el('button',{class:'btn btn-primary btn-block',type:'button','data-action':'create-operation-from-agency','data-agency-id':agency.id || agency.numero},'＋ Crear operación para esta agencia'),
    section(`Operaciones activas (${relatedOps.length})`,relatedOps.length ? el('div',{class:'list'},relatedOps.map(operationCard)) : el('p',{class:'muted',text:'No hay operaciones activas vinculadas.'})),
    section(`Ficha técnica móvil (${equipment.length})`,equipment.length ? el('div',{class:'list'},equipment.map(item => el('div',{class:'list-item'},el('span',{'aria-hidden':'true',text:'▣'}),el('div',{class:'list-main'},el('strong',{text:item.productos?.nombre || item.producto_nombre || item.serial || 'Equipo'}),el('p',{text:`Serial: ${item.serial || 'No aplica'} · Estado: ${item.estado || 'No registrado'}`}))))) : el('p',{class:'muted',text:'No hay equipos activos visibles para esta agencia.'}))
  );
}
function section(title,body){ return el('section',{class:'card section'},el('div',{class:'section-heading'},el('h2',{text:title})),body); }
function info(label,value){ return el('div',{class:'info-row'},el('dt',{text:label}),el('dd',{text:value})); }
function contact(icon,label,href){ return href ? el('a',{class:'contact-action',href,target:'_blank',rel:'noopener noreferrer'},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label})) : el('button',{class:'contact-action',type:'button',disabled:'',title:'Dato no disponible'},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label})); }
