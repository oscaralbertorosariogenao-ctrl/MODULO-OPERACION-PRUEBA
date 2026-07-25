import { el } from './dom.js';
let stack = null; let counter = 0;
function getStack(){
  if(stack?.isConnected) return stack;
  stack = el('div',{class:'toast-stack','aria-live':'polite','aria-atomic':'false'}); document.getElementById('app-portals').append(stack); return stack;
}
export function showToast(title, message = '', tone = 'info', duration = 5200){
  const id = `toast-${++counter}`;
  const node = el('div',{class:'toast',id,role:tone === 'danger' ? 'alert' : 'status','data-tone':tone},
    el('span',{'aria-hidden':'true',text:tone === 'success' ? '✓' : tone === 'warning' ? '!' : tone === 'danger' ? '×' : 'i'}),
    el('div',{},el('strong',{text:title}),message ? el('p',{text:message}) : null),
    el('button',{class:'toast-close',type:'button','data-action':'dismiss-toast','data-toast-id':id,'aria-label':'Cerrar notificación'},'×')
  );
  getStack().append(node); if(duration > 0) setTimeout(() => node.remove(), duration); return node;
}
export function dismissToast(id){ document.getElementById(id)?.remove(); }
