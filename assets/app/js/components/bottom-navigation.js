import { el } from './dom.js';
const ITEMS = [
  {path:'/home',label:'Inicio',icon:'⌂',action:'go-home'},
  {path:'/operations',label:'Operaciones',icon:'▤',action:'go-operations'},
  {path:'/scanner',label:'Escanear',icon:'⌗',action:'go-scanner',scan:true},
  {path:'/agencies',label:'Agencias',icon:'⌖',action:'go-agencies'},
  {path:'/profile',label:'Perfil',icon:'●',action:'go-profile'}
];
export function bottomNavigation(currentPath){
  return el('nav',{class:'bottom-nav','aria-label':'Navegación principal'},ITEMS.map(item => {
    const active = currentPath === item.path || (item.path === '/operations' && currentPath.startsWith('/operation')) || (item.path === '/agencies' && currentPath.startsWith('/agency'));
    return el('button',{class:`nav-item${active ? ' is-active' : ''}${item.scan ? ' is-scan' : ''}`,type:'button','data-action':item.action,'aria-current':active ? 'page' : null},
      el('span',{class:'nav-icon','aria-hidden':'true',text:item.icon}),el('span',{text:item.label}));
  }));
}
