import { getState, updateSlice } from '../store.js';

let registration = null;
let reloadingForUpdate = false;

function isIosDevice(){
  const ua = navigator.userAgent || '';
  const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/i.test(ua) || touchMac;
}

function isStandalone(){
  return globalThis.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
}

function publishEnvironment(onChange){
  updateSlice('ui',{
    pwaSupported:'serviceWorker' in navigator,
    pwaStandalone:isStandalone(),
    pwaIos:isIosDevice(),
    pwaInstalled:isStandalone()
  },'pwa-environment');
  onChange?.();
}

function markUpdateAvailable(onChange,onUpdateAvailable){
  updateSlice('ui',{pwaUpdateAvailable:true},'pwa-update-available');
  onChange?.();
  onUpdateAvailable?.();
}

function watchRegistration(reg,onChange,onUpdateAvailable){
  if(reg.waiting) markUpdateAvailable(onChange,onUpdateAvailable);
  const onUpdateFound = () => {
    const worker = reg.installing;
    if(!worker) return;
    const onStateChange = () => {
      if(worker.state === 'installed' && navigator.serviceWorker.controller){
        markUpdateAvailable(onChange,onUpdateAvailable);
      }
    };
    worker.addEventListener('statechange',onStateChange);
  };
  reg.addEventListener('updatefound',onUpdateFound);
  return () => reg.removeEventListener('updatefound',onUpdateFound);
}

export async function setupPwa({onChange,onUpdateAvailable}={}){
  const cleanups = [];
  publishEnvironment(onChange);

  const onBeforeInstall = event => {
    event.preventDefault();
    updateSlice('ui',{installPrompt:event},'install-prompt');
    onChange?.();
  };
  const onInstalled = () => {
    updateSlice('ui',{installPrompt:null,pwaInstalled:true,pwaStandalone:true},'app-installed');
    onChange?.();
  };
  const onDisplayMode = () => publishEnvironment(onChange);
  const displayQuery = globalThis.matchMedia?.('(display-mode: standalone)');

  globalThis.addEventListener('beforeinstallprompt',onBeforeInstall);
  globalThis.addEventListener('appinstalled',onInstalled);
  displayQuery?.addEventListener?.('change',onDisplayMode);
  cleanups.push(() => globalThis.removeEventListener('beforeinstallprompt',onBeforeInstall));
  cleanups.push(() => globalThis.removeEventListener('appinstalled',onInstalled));
  cleanups.push(() => displayQuery?.removeEventListener?.('change',onDisplayMode));

  if('serviceWorker' in navigator){
    try{
      registration = await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'});
      cleanups.push(watchRegistration(registration,onChange,onUpdateAvailable));
      registration.update().catch(() => null);

      const onControllerChange = () => {
        if(reloadingForUpdate) return;
        reloadingForUpdate = true;
        location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
      cleanups.push(() => navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange));
    }catch(error){
      console.warn('[Grupo Ortiz] Service worker no disponible.',error);
    }
  }

  return () => cleanups.forEach(cleanup => { try{ cleanup?.(); }catch{} });
}

export async function installPwa(){
  const state = getState();
  if(state.ui.pwaStandalone || isStandalone()) return { outcome:'installed' };

  const prompt = state.ui.installPrompt;
  if(prompt){
    await prompt.prompt();
    const choice = await prompt.userChoice;
    updateSlice('ui',{installPrompt:null,pwaInstalled:choice.outcome === 'accepted'},'install-finished');
    return choice;
  }

  if(state.ui.pwaIos || isIosDevice()) return { outcome:'ios-help' };
  return { outcome:'unavailable' };
}

export async function activatePwaUpdate(){
  const reg = registration || await navigator.serviceWorker?.getRegistration?.('/');
  if(!reg?.waiting) return false;
  reloadingForUpdate = false;
  reg.waiting.postMessage({type:'LOTEKA_ACTIVATE_NEW_VERSION'});
  return true;
}
