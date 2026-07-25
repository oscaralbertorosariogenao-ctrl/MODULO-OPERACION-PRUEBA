import { el } from './dom.js';
export function evidenceUploader(files = [], { prefix = 'evidence' } = {}){
  return el('div',{class:'stack'},
    el('div',{class:'file-picker-grid'},
      picker(`${prefix}-camera`,'Tomar foto','📷','image/*','environment'),picker(`${prefix}-gallery`,'Galería','▧','image/*,video/*','')
    ),
    files.length ? el('div',{class:'media-grid'},files.map(item => mediaPreview(item,prefix))) : el('p',{class:'draft-note',text:'Las fotografías no se guardan en localStorage. Mantén la app abierta hasta completar la subida.'})
  );
}
function picker(id,label,icon,accept,capture){
  const input = el('input',{class:'sr-only',id,type:'file',accept,multiple:'',capture:capture || null,'data-file-input':id});
  return el('label',{class:'file-picker',htmlFor:id},input,el('span',{'aria-hidden':'true',text:icon}),el('span',{text:label}));
}
function mediaPreview(item,prefix){
  const type = item.file?.type || '';
  return el('div',{class:'media-item'},type.startsWith('video/') ? el('video',{src:item.previewUrl,controls:'',preload:'metadata'}) : el('img',{src:item.previewUrl,alt:item.file?.name || 'Evidencia seleccionada'}),el('button',{class:'media-remove',type:'button','data-action':'remove-evidence-file','data-file-id':item.id,'data-prefix':prefix,'aria-label':`Eliminar ${item.file?.name || 'archivo'}`},'×'));
}
