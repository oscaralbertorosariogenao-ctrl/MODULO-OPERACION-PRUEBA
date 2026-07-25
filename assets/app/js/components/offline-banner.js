import { el } from './dom.js';
export function offlineBanner(connectivity){
  if(connectivity?.status === 'online') return null;
  const text = connectivity?.status === 'reconnecting' ? 'Reconectando con Supabase…' : 'Sin conexión. Puedes consultar datos ya cargados y preparar borradores.';
  return el('div',{class:'offline-banner',role:'status'},el('span',{'aria-hidden':'true',text:connectivity?.status === 'reconnecting' ? '↻' : '⚠'}),el('span',{text}));
}
