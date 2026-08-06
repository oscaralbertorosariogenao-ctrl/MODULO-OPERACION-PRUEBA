import { el } from '../components/dom.js';
import { operationCard } from '../components/operation-card.js';
import { emptyState } from '../components/empty-state.js';
import { can, isGroupManager } from '../permissions.js';

export function homeView(state){
  const profile = state.profile || {};
  const groupManager = isGroupManager(profile);
  const stats = state.operations.stats || emptyStats();
  const recent = state.operations.items.slice(0,6);
  const quickActions = [
    quickIf(state,'operations.create','＋','Reportar problema','go-create-operation'),
    quickIf(state,'operations.view','⌕','Buscar operación','go-operations-search'),
    quickIf(state,'operations.assign','♟','Asignar','go-unassigned-operations'),
    quickIf(state,'agencies.view','⌂','Buscar agencia','go-agencies-search'),
    quickIf(state,'scanner.lookup','⌗','Escanear serial','go-scanner'),
    quickIf(state,'agencies.map','⌖','Abrir mapa','go-map'),
    quickIf(state,'groupInventory.view','▣','Mi inventario','go-group-inventory')
  ];
  const metrics = groupManager
    ? [metric(stats.reported ?? stats.pending,'Reportados'),metric(stats.inProgress,'En proceso'),metric(stats.completedToday,'Completadas hoy'),metric(stats.incidents,'En incidencia')]
    : [
        metric(stats.reported ?? stats.pending,'Reportados'),metric(stats.unassigned,'Sin asignar'),metric(stats.inProgress,'En proceso'),metric(stats.completedToday,'Completadas hoy'),
        metric(stats.assigned,'Asignados'),metric(stats.incidents,'En incidencia'),metric(stats.pendingEvidence,'Evidencia pendiente'),metric(stats.activeTechnicians,'Técnicos activos')
      ];
  const alertTitle = groupManager ? 'Avisos de mi grupo' : 'Alertas operativas';

  return el('div',{class:'page home-page'},
    el('section',{class:'hero-card'},
      el('h1',{text:`Hola, ${firstName(profile.nombre_completo || profile.nombre || 'Administrador')}`}),
      el('p',{text:groupManager ? 'Este es el estado operativo de tus grupos asignados.' : 'Este es el estado operativo de hoy.'}),
      el('div',{class:'hero-meta'},
        heroPill('📅',formatDate(new Date())),
        heroPill(state.connectivity.online ? '●' : '○',state.connectivity.online ? 'En línea' : 'Sin conexión'),
        heroPill('↻',syncText(state.connectivity.lastSync))
      )
    ),
    el('section',{class:'grid grid-2 grid-md-4','aria-label':'Indicadores operativos'},metrics),
    quickActions.some(Boolean) ? sectionHeading('Acciones rápidas') : null,
    quickActions.some(Boolean) ? el('section',{class:'quick-actions'},quickActions) : null,
    can('notifications.view',state) ? sectionHeading(alertTitle,el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'go-notifications'},'Ver todas')) : null,
    can('notifications.view',state) ? alertSummary(state.notifications.items) : null,
    can('operations.view',state) ? sectionHeading('Últimas operaciones',el('button',{class:'btn btn-ghost btn-sm',type:'button','data-action':'go-operations'},'Ver listado')) : null,
    can('operations.view',state) ? (recent.length ? el('div',{class:'list'},recent.map(operationCard)) : emptyState({icon:'▤',title:'Sin operaciones recientes',message:'Las nuevas operaciones aparecerán aquí.'})) : null
  );
}

function emptyStats(){ return {pending:0,unassigned:0,inProgress:0,completedToday:0,assigned:0,incidents:0,remoteToday:0,pendingEvidence:0,activeTechnicians:0}; }
function firstName(value){ return String(value).trim().split(/\s+/)[0]; }
function formatDate(date){ return new Intl.DateTimeFormat('es-DO',{weekday:'long',day:'numeric',month:'long'}).format(date); }
function syncText(value){ if(!value) return 'Sincronizando'; const date = new Date(value); return `Sync ${new Intl.DateTimeFormat('es-DO',{hour:'numeric',minute:'2-digit'}).format(date)}`; }
function heroPill(icon,text){ return el('span',{class:'hero-pill'},el('span',{'aria-hidden':'true',text:icon}),el('span',{text})); }
function metric(value,label){ return el('article',{class:'metric'},el('strong',{text:String(value || 0)}),el('span',{text:label})); }
function quick(icon,label,action){ return el('button',{class:'quick-action',type:'button','data-action':action},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label})); }
function quickIf(state,permission,icon,label,action){ return can(permission,state) ? quick(icon,label,action) : null; }
function sectionHeading(title,action = null){ return el('div',{class:'section-heading'},el('h2',{text:title}),action); }
function alertSummary(items){
  const alerts = (items || []).slice(0,3);
  if(!alerts.length) return el('div',{class:'card'},el('p',{class:'muted',text:'No hay avisos operativos activos.'}));
  return el('div',{class:'card list'},alerts.map(item => el('button',{class:'list-item',type:'button','data-action':'open-alert','data-alert-id':item.id},el('span',{'aria-hidden':'true',text:item.type === 'danger' ? '⚠' : item.type === 'success' ? '✓' : 'i'}),el('span',{class:'list-main'},el('strong',{text:item.title || item.titulo}),el('p',{text:item.message || item.mensaje || ''})))));
}
