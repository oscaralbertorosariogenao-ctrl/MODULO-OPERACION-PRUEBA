import { el } from './dom.js';
import { initials } from './dom.js';
export function appDrawer(state){
  if(!state.ui?.drawerOpen) return null;
  const profile = state.profile || {};
  return el('div',{class:'drawer-backdrop','data-action':'close-drawer','aria-hidden':'false'},
    el('aside',{class:'drawer',role:'dialog','aria-modal':'true','aria-label':'Menú de la aplicación','data-drawer-panel':'true'},
      el('div',{class:'profile-hero'},
        el('div',{class:'profile-avatar',text:initials(profile.nombre_completo || profile.nombre)}),
        el('h2',{text:profile.nombre_completo || profile.nombre || 'Usuario'}),
        el('p',{class:'muted',text:profile.roles?.nombre || profile.puestos?.nombre || 'Operaciones'})
      ),
      el('div',{class:'list'},
        drawerButton('⌂','Inicio','go-home'),drawerButton('▤','Operaciones','go-operations'),drawerButton('＋','Crear operación','go-create-operation'),
        drawerButton('⌖','Mapa de agencias','go-map'),drawerButton('♟','Técnicos','go-technicians'),drawerButton('◉','Alertas','go-notifications'),
        drawerButton('●','Mi perfil','go-profile'),el('div',{class:'divider'}),drawerButton('↻','Actualizar datos','refresh-view'),drawerButton('⇥','Cerrar sesión','request-logout','text-danger')
      )
    )
  );
}
function drawerButton(icon,label,action,extra=''){
  return el('button',{class:`btn btn-ghost btn-block ${extra}`,type:'button','data-action':action},el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label}));
}
