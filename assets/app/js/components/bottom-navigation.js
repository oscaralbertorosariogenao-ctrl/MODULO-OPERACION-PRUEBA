import { el } from './dom.js';
import { can } from '../permissions.js';

const ITEMS = [
  {path:'/home',label:'Inicio',icon:'⌂',action:'go-home',permission:'home.view'},
  {path:'/operations',label:'Operaciones',icon:'▤',action:'go-operations',permission:'operations.view'},
  {path:'/scanner',label:'Escanear',icon:'⌗',action:'go-scanner',permission:'scanner.lookup',scan:true},
  {path:'/agencies',label:'Agencias',icon:'⌖',action:'go-agencies',permission:'agencies.view'},
  {path:'/profile',label:'Perfil',icon:'●',action:'go-profile',permission:'profile.view'}
];

export function bottomNavigation(state){
  const currentPath = state.route.path;
  const visibleItems = ITEMS.filter(item => can(item.permission,state));
  return el('nav',{class:'bottom-nav','aria-label':'Navegación principal',style:`grid-template-columns:repeat(${Math.max(visibleItems.length,1)},1fr)`},visibleItems.map(item => {
    const active = currentPath === item.path || (item.path === '/operations' && currentPath.startsWith('/operation')) || (item.path === '/agencies' && currentPath.startsWith('/agency'));
    return el('button',{class:`nav-item${active ? ' is-active' : ''}${item.scan ? ' is-scan' : ''}`,type:'button','data-action':item.action,'aria-current':active ? 'page' : null},
      el('span',{class:'nav-icon','aria-hidden':'true',text:item.icon}),el('span',{text:item.label}));
  }));
}
