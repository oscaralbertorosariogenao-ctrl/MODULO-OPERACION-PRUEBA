import { AppError, ERROR_TYPES } from '../errors.js';

const ZXING_URL = 'https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js';
const REQUESTED_FORMATS = ['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','data_matrix'];

let stream = null;
let animationFrame = null;
let detector = null;
let zxingReader = null;
let zxingControls = null;
let zxingPromise = null;
let active = false;
let scanGeneration = 0;
let detecting = false;

export function cameraSupported(){ return Boolean(navigator.mediaDevices?.getUserMedia); }
export function barcodeSupported(){ return 'BarcodeDetector' in globalThis || Boolean(globalThis.ZXingBrowser); }
export function scannerActive(){ return active; }

function configureVideo(video){
  if(!(video instanceof HTMLVideoElement)) throw new AppError('No se encontró la vista de cámara.',{type:ERROR_TYPES.camera});
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('autoplay','');
  video.setAttribute('muted','');
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  video.disablePictureInPicture = true;
}

function waitForVideo(video,timeout=8000){
  if(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve,reject) => {
    let settled = false;
    const finish = fn => { if(settled) return; settled = true; clearTimeout(timer); video.removeEventListener('loadedmetadata',onReady); video.removeEventListener('playing',onReady); fn(); };
    const onReady = () => { if(video.videoWidth > 0 || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish(resolve); };
    const timer = setTimeout(() => finish(() => reject(new Error('La cámara no entregó imagen a tiempo.'))),timeout);
    video.addEventListener('loadedmetadata',onReady);
    video.addEventListener('playing',onReady);
  });
}

async function openCamera(video){
  const constraints = {
    audio:false,
    video:{
      facingMode:{ideal:'environment'},
      width:{ideal:1280},
      height:{ideal:720},
      frameRate:{ideal:24,max:30}
    }
  };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();
  await waitForVideo(video);
  const track = stream.getVideoTracks?.()[0];
  return {label:track?.label || 'Cámara trasera'};
}

async function createNativeDetector(){
  if(!('BarcodeDetector' in globalThis)) return null;
  try{
    let formats = REQUESTED_FORMATS;
    if(typeof BarcodeDetector.getSupportedFormats === 'function'){
      const supported = await BarcodeDetector.getSupportedFormats();
      formats = REQUESTED_FORMATS.filter(format => supported.includes(format));
    }
    return formats.length ? new BarcodeDetector({formats}) : new BarcodeDetector();
  }catch(error){
    console.warn('[Grupo Ortiz] BarcodeDetector no pudo inicializarse.',error);
    return null;
  }
}

function loadZxing(){
  if(globalThis.ZXingBrowser) return Promise.resolve(globalThis.ZXingBrowser);
  if(zxingPromise) return zxingPromise;
  zxingPromise = new Promise((resolve,reject) => {
    const existing = document.querySelector('script[data-zxing-browser]');
    const script = existing || document.createElement('script');
    const cleanup = () => { script.removeEventListener('load',onLoad); script.removeEventListener('error',onError); };
    const onLoad = () => { cleanup(); globalThis.ZXingBrowser ? resolve(globalThis.ZXingBrowser) : reject(new Error('ZXing no quedó disponible.')); };
    const onError = () => { cleanup(); zxingPromise = null; reject(new Error('No se pudo cargar el lector alternativo.')); };
    script.addEventListener('load',onLoad,{once:true});
    script.addEventListener('error',onError,{once:true});
    if(!existing){
      script.src = ZXING_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.zxingBrowser = 'true';
      document.head.append(script);
    }
  });
  return zxingPromise;
}

function valueFromZxing(result){
  return String(result?.getText?.() || result?.text || '').trim();
}

function isExpectedZxingMiss(error){
  const name = String(error?.name || error?.constructor?.name || '');
  return ['NotFoundException','ChecksumException','FormatException'].includes(name);
}

async function startNativeLoop(video,onCode,onError,generation){
  detector = await createNativeDetector();
  if(!detector) return false;
  const scan = async () => {
    if(!active || generation !== scanGeneration) return;
    if(!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA){
      detecting = true;
      try{
        const codes = await detector.detect(video);
        const value = String(codes?.[0]?.rawValue || '').trim();
        if(value){ await stopScanner(); onCode(value); return; }
      }catch(error){ onError?.(error); }
      finally{ detecting = false; }
    }
    animationFrame = requestAnimationFrame(scan);
  };
  animationFrame = requestAnimationFrame(scan);
  return true;
}

async function startZxingLoop(video,onCode,onError,generation){
  const ZXingBrowser = await loadZxing();
  if(!active || generation !== scanGeneration) return false;
  zxingReader = new ZXingBrowser.BrowserMultiFormatReader();
  zxingControls = await zxingReader.decodeFromStream(stream,video,async (result,error) => {
    if(!active || generation !== scanGeneration) return;
    const value = valueFromZxing(result);
    if(value){ await stopScanner(); onCode(value); return; }
    if(error && !isExpectedZxingMiss(error)) onError?.(error);
  });
  return true;
}

export async function startScanner(video,onCode,onError){
  if(!cameraSupported()) throw new AppError('Este dispositivo no permite abrir la cámara. Usa la búsqueda manual.',{type:ERROR_TYPES.camera});
  await stopScanner();
  active = true;
  const generation = ++scanGeneration;
  configureVideo(video);
  try{
    const camera = await openCamera(video);
    if(await startNativeLoop(video,onCode,onError,generation)) return {camera:true,detector:true,engine:'native',cameraLabel:camera.label};
    try{
      if(await startZxingLoop(video,onCode,onError,generation)) return {camera:true,detector:true,engine:'zxing',cameraLabel:camera.label};
    }catch(detectorError){
      console.warn('[Grupo Ortiz] Lector alternativo no disponible.',detectorError);
      onError?.(detectorError);
    }
    return {camera:true,detector:false,engine:'preview',cameraLabel:camera.label};
  }catch(error){
    await stopScanner();
    const message = error?.name === 'NotAllowedError'
      ? 'Permiso de cámara rechazado. Actívalo en la configuración del navegador.'
      : error?.name === 'NotFoundError'
        ? 'No se encontró una cámara disponible.'
        : 'No se pudo abrir la cámara. Revisa el permiso o usa la entrada manual.';
    throw new AppError(message,{type:ERROR_TYPES.camera,cause:error});
  }
}

export async function stopScanner(){
  active = false;
  scanGeneration += 1;
  detecting = false;
  if(animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  try{ zxingControls?.stop?.(); }catch{}
  try{ zxingReader?.reset?.(); }catch{}
  zxingControls = null;
  zxingReader = null;
  stream?.getTracks?.().forEach(track => track.stop());
  stream = null;
  detector = null;
}
