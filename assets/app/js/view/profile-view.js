import { el, initials } from '../components/dom.js';
import { APP_BUILD, APP_VERSION } from '../config.js';
export function profileView(state){
  const profile = state.profile || {}; const name = profile.nombre_completo || profile.nombre || state.user?.email || 'Usuario'; const permissions = [...(state.permissions || [])];
  return el('div',{class:'page profile-page'},
    el('section',{class:'card profile-hero'},el('div',{class:'profile-avatar',text:initials(name)}),el('h1',{text:name}),el('p',{class:'muted',text:profile.roles?.nombre || profile.puestos?.nombre || 'Operaciones'}),el('span',{class:`badge ${profile.activo === false ? 'badge-danger' : 'badge-complete'}`,text:profile.activo === false ? 'Inactivo' : 'Perfil activo'})),
    section('Datos personales',el('dl',{class:'info-list'},info('Correo',profile.correo || profile.email || state.user?.email || 'No registrado'),info('Usuario',profile.usuario_login || 'No registrado'),info('Teléfono',profile.telefono_whatsapp || profile.telefono || 'No registrado'),info('Departamento',profile.departamento || 'No registrado'),info('Grupo',profile.grupo_asignado || 'Sin asignar'))),
    section('Aplicación',el('dl',{class:'info-list'},info('Conexión',state.connectivity.online ? 'En línea' : 'Sin conexión'),info('Última sincronización',formatDate(state.connectivity.lastSync)),info('Versión',APP_VERSION),info('Build',APP_BUILD))),
    section('Permisos resumidos',permissions.length ? el('div',{class:'permission-list'},permissions.slice(0,30).map(code => el('span',{class:'permission-pill',text:code}))) : el('p',{class:'muted',text:'No se cargaron permisos visibles.'})),
    state.ui.installPrompt ? el('button',{class:'btn btn-outline btn-block',type:'button','data-action':'install-pwa'},'Instalar aplicación') : null,
    el('button',{class:'btn btn-danger btn-block',type:'button','data-action':'request-logout'},'Cerrar sesión')
  );
}
function section(title,body){ return el('section',{class:'card section'},el('div',{class:'section-heading'},el('h2',{text:title})),body); }
function info(label,value){ return el('div',{class:'info-row'},el('dt',{text:label}),el('dd',{text:value})); }
function formatDate(value){ if(!value) return 'No registrada'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'No registrada' : new Intl.DateTimeFormat('es-DO',{dateStyle:'medium',timeStyle:'short'}).format(date); }
