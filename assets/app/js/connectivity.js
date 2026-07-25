import { updateSlice } from './store.js';
let cleanup = null;
export function startConnectivity(){
  if(cleanup) return cleanup;
  const set = online => updateSlice('connectivity', { online, status:online ? 'online' : 'offline' }, 'connectivity');
  const online = () => set(true); const offline = () => set(false);
  globalThis.addEventListener('online', online); globalThis.addEventListener('offline', offline);
  set(navigator.onLine);
  cleanup = () => { globalThis.removeEventListener('online', online); globalThis.removeEventListener('offline', offline); cleanup = null; };
  return cleanup;
}
export function markSync(){ updateSlice('connectivity', { lastSync:new Date().toISOString(), status:navigator.onLine ? 'online' : 'offline' }, 'sync'); }
export function setReconnecting(){ updateSlice('connectivity', { status:'reconnecting' }, 'reconnecting'); }
