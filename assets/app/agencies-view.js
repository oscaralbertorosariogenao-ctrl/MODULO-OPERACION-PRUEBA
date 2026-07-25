import { uploadEvidenceFile } from '../api/evidence-api.js';
export async function compressImage(file, { maxDimension = 1800, quality = .82 } = {}){
  if(!file?.type?.startsWith('image/') || /gif|svg/i.test(file.type)) return file;
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha:false }); context.drawImage(bitmap, 0, 0, width, height); bitmap.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo comprimir la imagen.')), 'image/jpeg', quality));
  return new File([blob], `${String(file.name || 'evidencia').replace(/\.[^.]+$/,'')}.jpg`, { type:'image/jpeg', lastModified:Date.now() });
}
export function fileIdentity(file){ return [file?.name,file?.size,file?.lastModified,file?.type].join('|'); }
export function mergeFiles(current, incoming){
  const map = new Map(); [...(current || []), ...(incoming || [])].forEach(file => { if(file) map.set(fileIdentity(file), file); }); return [...map.values()];
}
export function revokePreviews(files){ for(const item of files || []){ if(item.previewUrl) URL.revokeObjectURL(item.previewUrl); } }
export function prepareFiles(files){ return [...(files || [])].map(file => ({ file, previewUrl:URL.createObjectURL(file), id:fileIdentity(file) })); }
export async function uploadEvidenceBatch(files, operationCode, description, onProgress){
  const selected = [...(files || [])]; const urls = [];
  for(let index = 0; index < selected.length; index += 1){
    const compressed = await compressImage(selected[index]);
    const url = await uploadEvidenceFile(compressed, operationCode, { description, onProgress:value => onProgress?.(Math.round(((index + value / 100) / selected.length) * 100)) });
    urls.push(url);
  }
  return urls;
}
