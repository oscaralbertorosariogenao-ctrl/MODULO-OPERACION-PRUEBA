import { el, initials } from './dom.js';
import { can, isGroupManager } from '../permissions.js';

export function appDrawer(state){
  if(!state.ui?.drawerOpen) return null;
  const profile = state.profile || {};
  const groupManager = isGroupManager(profile);
  const buttons = [
    drawerButtonIf(state,'home.view','⌂','Inicio','go-home'),
    drawerButtonIf(state,'operations.view','▤','Operaciones','go-operations'),
    drawerButtonIf(state,'operations.create','＋','Crear operación','go-create-operation'),
    drawerButtonIf(state,'agencies.map','⌖','Mapa de agencias','go-map'),
    drawerButtonIf(state,'scanner.lookup','⌗','Escáner','go-scanner'),
    drawerButtonIf(state,'technicians.view','♟','Técnicos','go-technicians'),
    drawerButtonIf(state,'notifications.view','◉',groupManager ? 'Avisos de mi grupo' : 'Alertas','go-notifications'),
    drawerButtonIf(state,'profile.view','●','Mi perfil','go-profile'),
    el('div',{class:'divider'}),
    drawerButton('↻','Actualizar datos','refresh-view'),
    drawerButton('⇥','Cerrar sesión','request-logout','text-danger')
  ];
  return el('div',{class:'drawer-backdrop','data-action':'close-drawer','aria-hidden':'false'},
    el('aside',{class:'drawer',role:'dialog','aria-modal':'true','aria-label':'Menú de la aplicación','data-drawer-panel':'true'},
      el('div',{class:'profile-hero'},
        el('div',{class:'profile-avatar',text:initials(profile.nombre_completo || profile.nombre)}),
        el('h2',{text:profile.nombre_completo || profile.nombre || 'Usuario'}),
        el('p',{class:'muted',text:profile.roles?.nombre || profile.puestos?.nombre || 'Operaciones'})
      ),
      el('div',{class:'list'},buttons)
    )
  );
}
function drawerButtonIf(state,permission,icon,label,action,extra=''){ return can(permission,state) ? drawerButton(icon,label,action,extra) : null; }
function drawerButton(icon,label,action,extra=''){
  return el('button',{class:`btn btn-ghost btn-block ${extra}`,type:'button','data-action':action},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label}));
}
