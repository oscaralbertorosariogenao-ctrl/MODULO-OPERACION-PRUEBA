import { updateSlice } from '../store.js';
export async function registerPwa(){
  if(!('serviceWorker' in navigator)) return null;
  try{ return await navigator.serviceWorker.register('/service-worker.js'); }
  catch(error){ console.warn('[Grupo Ortiz] Service worker no disponible en este entorno.', error); return null; }
}
export function captureInstallPrompt(){
  const handler = event => { event.preventDefault(); updateSlice('ui',{installPrompt:event},'install-prompt'); };
  globalThis.addEventListener('beforeinstallprompt',handler); return () => globalThis.removeEventListener('beforeinstallprompt',handler);
}
export async function installPwa(){
  const prompt = (await import('../store.js')).getState().ui.installPrompt;
  if(!prompt) return 'unavailable'; await prompt.prompt(); const choice = await prompt.userChoice; updateSlice('ui',{installPrompt:null},'install-finished'); return choice.outcome;
}
