import { el, qs } from './dom.js';
let activeModal = null; let previousFocus = null;
export function openModal({ id = 'app-modal', title, body, footer = null, size = '', closeLabel = 'Cerrar' }){
  closeModal(); previousFocus = document.activeElement;
  const modal = el('div',{class:'modal-backdrop',id,role:'presentation','data-modal-backdrop':'true'},
    el('section',{class:`modal ${size}`.trim(),role:'dialog','aria-modal':'true','aria-labelledby':`${id}-title`,'data-modal-panel':'true'},
      el('header',{class:'modal-header'},el('h2',{class:'modal-title',id:`${id}-title`,text:title || 'Detalle'}),el('button',{class:'icon-btn',type:'button','data-action':'close-modal','aria-label':closeLabel},'×')),
      el('div',{class:'modal-body'},body),
      footer ? el('footer',{class:'modal-footer'},footer) : null
    )
  );
  document.getElementById('app-portals').append(modal); activeModal = modal;
  requestAnimationFrame(() => firstFocusable(activeModal)?.focus()); return modal;
}
export function closeModal(){ if(!activeModal) return; activeModal.remove(); activeModal = null; previousFocus?.focus?.(); previousFocus = null; }
export function hasOpenModal(){ return Boolean(activeModal); }
export function trapModalFocus(event){
  if(!activeModal || event.key !== 'Tab') return;
  const focusable = focusables(activeModal); if(!focusable.length){ event.preventDefault(); return; }
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
  else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
}
function focusables(root){ return [...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(node => !node.hidden); }
function firstFocusable(root){ return focusables(root)[0] || qs('[data-modal-panel]',root); }
