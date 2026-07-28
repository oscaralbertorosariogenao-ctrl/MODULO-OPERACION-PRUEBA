import { el } from '../components/dom.js';
import { emptyState } from '../components/empty-state.js';
import { isGroupManager } from '../permissions.js';

export function notificationsView(state){
  const items = state.notifications.items || [];
  const groupManager = isGroupManager(state.profile);
  const title = groupManager ? 'Avisos de mi grupo' : 'Alertas';
  const subtitle = groupManager
    ? 'Solo se muestran avisos operativos de tus grupos y notificaciones dirigidas a tu usuario.'
    : (state.notifications.real ? 'Notificaciones reales y alertas derivadas.' : 'Alertas derivadas de datos operativos reales.');
  return el('div',{class:'page notifications-page'},
    el('div',{class:'page-header'},
      el('div',{},el('h1',{class:'page-title',text:title}),el('p',{class:'page-subtitle',text:subtitle})),
      items.some(item => item.leida === false) ? el('button',{class:'btn btn-outline btn-sm',type:'button','data-action':'mark-all-notifications-read'},'Marcar leídas') : null
    ),
    items.length ? el('section',{class:'list'},items.map(notificationItem)) : emptyState({icon:'✓',title:'Todo al día',message:groupManager ? 'No hay avisos nuevos para tus grupos.' : 'No hay alertas operativas activas.'})
  );
}

function notificationItem(item){
  const unread = item.leida === false;
  const title = item.title || item.titulo || 'Aviso operativo';
  const message = item.message || item.mensaje || '';
  return el('button',{class:`notification-item${unread ? ' is-unread' : ''}`,type:'button','data-action':'open-notification','data-notification-id':item.id},
    el('span',{class:'notification-icon','aria-hidden':'true',text:item.type === 'danger' ? '⚠' : item.type === 'success' ? '✓' : item.type === 'warning' ? '!' : 'i'}),
    el('span',{},el('h3',{text:title}),el('p',{text:message}),el('time',{text:formatDate(item.creado_en || item.created_at || item.fecha)}))
  );
}
function formatDate(value){ if(!value) return 'Ahora'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short'}).format(date); }
