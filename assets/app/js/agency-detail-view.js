import { AppError, ERROR_TYPES } from '../errors.js';
let stream = null; let animationFrame = null; let detector = null; let active = false;
export function cameraSupported(){ return Boolean(navigator.mediaDevices?.getUserMedia); }
export function barcodeSupported(){ return 'BarcodeDetector' in globalThis; }
export async function startScanner(video, onCode, onError){
  if(!cameraSupported()) throw new AppError('Este dispositivo no permite abrir la cámara. Usa la búsqueda manual.', { type:ERROR_TYPES.camera });
  await stopScanner(); active = true;
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false });
    video.srcObject = stream; video.setAttribute('playsinline',''); await video.play();
    if(!barcodeSupported()) return { camera:true, detector:false };
    detector = new BarcodeDetector({ formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e','data_matrix'] });
    const scan = async () => {
      if(!active) return;
      try{ const codes = await detector.detect(video); if(codes?.[0]?.rawValue){ onCode(String(codes[0].rawValue)); await stopScanner(); return; } }
      catch(error){ onError?.(error); }
      animationFrame = requestAnimationFrame(scan);
    };
    animationFrame = requestAnimationFrame(scan); return { camera:true, detector:true };
  }catch(error){ await stopScanner(); throw new AppError('No se pudo abrir la cámara. Revisa el permiso o usa la entrada manual.', { type:ERROR_TYPES.camera, cause:error }); }
}
export async function stopScanner(){
  active = false; if(animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
  stream?.getTracks?.().forEach(track => track.stop()); stream = null; detector = null;
}
