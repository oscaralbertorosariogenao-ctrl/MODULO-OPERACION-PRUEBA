import { el } from './dom.js';
export function appHeader(state){
  const unread = (state.notifications?.items || []).filter(item => item.leida === false).length;
  return el('header',{class:'app-header'},
    el('div',{class:'brand'},
      el('img',{src:'./assets/app/img/grupo-ortiz-go-icon.png',alt:'Grupo Ortiz'}),
      el('div',{class:'brand-copy'},el('strong',{text:'Grupo Ortiz'}),el('span',{text:'Operaciones móviles'}))
    ),
    el('div',{class:'header-actions'},
      el('button',{class:'icon-btn',type:'button','data-action':'refresh-view','aria-label':'Actualizar vista',title:'Actualizar'},'↻'),
      el('button',{class:'icon-btn',type:'button','data-action':'go-notifications','aria-label':`Notificaciones${unread ? `, ${unread} sin leer` : ''}`,title:'Notificaciones'}, unread ? `●${unread}` : '◉'),
      el('button',{class:'icon-btn',type:'button','data-action':'toggle-drawer','aria-label':'Abrir menú',title:'Menú'},'☰')
    )
  );
}
