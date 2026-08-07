import { uploadEvidenceFile, uploadEvidenceFileDetailed } from '../api/evidence-api.js';

function fileExtension(file){
  const name=String(file?.name || '').toLowerCase();
  const match=name.match(/(\.[a-z0-9]{2,6})$/i);
  return match?.[1] || '';
}

function shouldSkipCompression(file){
  const type=String(file?.type || '').toLowerCase();
  const ext=fileExtension(file);
  return !type.startsWith('image/')
    || /gif|svg|heic|heif|avif/i.test(type)
    || /\.(gif|svg|heic|heif|avif)$/i.test(ext);
}

export async function compressImage(file, { maxDimension = 1800, quality = .82 } = {}){
  if(!file || shouldSkipCompression(file)) return file;
  if(typeof createImageBitmap !== 'function') return file;
  let bitmap=null;
  try{
    bitmap=await createImageBitmap(file);
    const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale));
    const height=Math.max(1,Math.round(bitmap.height*scale));
    if(scale === 1 && file.size < 2.5*1024*1024) return file;
    const canvas=document.createElement('canvas');
    canvas.width=width; canvas.height=height;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context) return file;
    context.drawImage(bitmap,0,0,width,height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo comprimir la imagen.')),'image/jpeg',quality));
    return new File([blob],`${String(file.name || 'evidencia').replace(/\.[^.]+$/,'')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  }catch(error){
    console.warn('[Evidencias] El navegador no pudo comprimir la imagen; se enviará el archivo original.',error);
    return file;
  }finally{
    try{ bitmap?.close?.(); }catch{}
  }
}

export function fileIdentity(file){ return [file?.name,file?.size,file?.lastModified,file?.type].join('|'); }
export function mergeFiles(current,incoming){
  const map=new Map(); [...(current || []),...(incoming || [])].forEach(file=>{if(file)map.set(fileIdentity(file),file);}); return [...map.values()];
}
export function revokePreviews(files){ for(const item of files || []){ if(item.previewUrl) URL.revokeObjectURL(item.previewUrl); } }
export function prepareFiles(files){ return [...(files || [])].map(file=>({file,previewUrl:URL.createObjectURL(file),id:fileIdentity(file)})); }

async function uploadWithOriginalFallback(file,operationReference,options){
  const compressed=await compressImage(file);
  try{
    return await uploadEvidenceFileDetailed(compressed,operationReference,options);
  }catch(error){
    const changed=compressed !== file || compressed.size !== file.size || compressed.type !== file.type;
    if(!changed) throw error;
    console.warn('[Evidencias] Reintentando con el archivo original.',error);
    return uploadEvidenceFileDetailed(file,operationReference,{...options,source:`${options?.source || 'app-movil'}-original-retry`});
  }
}

export async function uploadEvidenceBatch(files,operationCode,description,onProgress){
  const selected=[...(files || [])]; const urls=[];
  for(let index=0; index<selected.length; index += 1){
    const result=await uploadWithOriginalFallback(selected[index],operationCode,{
      description,
      stage:'SEGUIMIENTO',
      source:'app-movil-v808.21',
      onProgress:value=>onProgress?.(Math.round(((index+value/100)/selected.length)*100))
    });
    urls.push(result.url);
  }
  return urls;
}

export async function uploadEvidenceBatchDetailed(files,operationReference,{
  description='',stage='SEGUIMIENTO',incidentId='',source='app-movil-v808.21',onProgress=null
}={}){
  const selected=[...(files || [])]; const results=[];
  for(let index=0; index<selected.length; index += 1){
    const result=await uploadWithOriginalFallback(selected[index],operationReference,{
      description,stage,incidentId,source,
      onProgress:value=>onProgress?.(Math.round(((index+value/100)/selected.length)*100))
    });
    results.push(result);
  }
  return results;
}
