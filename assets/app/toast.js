import { el } from './dom.js';
let overlay = null;
export function showLoader(message = 'Procesando…'){
  hideLoader(); overlay = el('div',{class:'loading-overlay',role:'status','aria-live':'assertive'},el('div',{class:'spinner','aria-hidden':'true'}),el('p',{text:message})); document.getElementById('app-portals').append(overlay);
}
export function hideLoader(){ overlay?.remove(); overlay = null; }
