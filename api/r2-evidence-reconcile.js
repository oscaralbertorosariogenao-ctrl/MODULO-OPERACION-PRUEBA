import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { requireAuthenticatedUser } from "./_auth.js";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = process.env;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function sendJson(res,status,data){ res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data)); }
function clean(v){return String(v ?? '').trim();}
function contentTypeFromKey(key){ const k=String(key).toLowerCase();if(/\.png$/.test(k))return'image/png';if(/\.webp$/.test(k))return'image/webp';if(/\.gif$/.test(k))return'image/gif';if(/\.heic$/.test(k))return'image/heic';if(/\.mp4$/.test(k))return'video/mp4';if(/\.webm$/.test(k))return'video/webm';if(/\.mov$/.test(k))return'video/quicktime';return'image/jpeg'; }
function inferredStage(operation,requested,key,prefix){
  const explicit=clean(requested).toUpperCase();if(explicit)return explicit;
  const tail=String(key||'').slice(String(prefix||'').length);
  const segment=tail.split('/')[0].toUpperCase();
  if(['REPORTE','SEGUIMIENTO','FINAL','SOPORTE_REMOTO','INCIDENCIA'].includes(segment))return segment;
  const state=clean(operation?.estado).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(state.includes('soporte')||state.includes('remot'))return 'SOPORTE_REMOTO';
  if(state.includes('proceso')||state.includes('incid')||state.includes('complet')||state.includes('cerrad'))return 'SEGUIMIENTO';
  return 'REPORTE';
}
function fileName(key){return String(key||'').split('/').pop()||'evidencia';}
function publicUrl(key){return `${String(R2_PUBLIC_BASE_URL).replace(/\/+$/,'')}/${key}`;}
function r2Client(){return new S3Client({region:'auto',endpoint:`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:R2_ACCESS_KEY_ID,secretAccessKey:R2_SECRET_ACCESS_KEY}});}
async function readJson(req){return new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
async function resolveOperation(client,reference){let r;if(UUID_RE.test(reference))r=await client.from('reportes_operaciones').select('id,codigo,estado').eq('id',reference).maybeSingle();else r=await client.from('reportes_operaciones').select('id,codigo,estado').eq('codigo',reference).maybeSingle();if(r.error)throw r.error;return r.data||null;}
async function existingEvidence(client,reference){const r=await client.rpc('rpc_operacion_evidencias_v2',{p_operacion:reference});if(r.error)throw r.error;return Array.isArray(r.data)?r.data:[];}
async function register(client,operation,object,stage){const {data,error}=await client.rpc('rpc_operacion_registrar_evidencia_v2',{
  p_operacion:String(operation.id||operation.codigo),p_etapa:stage,p_bucket:R2_BUCKET,p_object_key:object.Key,p_url_r2:publicUrl(object.Key),p_nombre_archivo:fileName(object.Key),p_mime_type:contentTypeFromKey(object.Key),p_tamano_bytes:Number(object.Size||0),p_comentario:null,p_incidencia_id:null,p_metadata:{reconciliado:true,fuente:'r2-evidence-reconcile',reconciliado_en:new Date().toISOString(),codigo:operation.codigo||null},p_storage_provider:'CLOUDFLARE_R2'
});if(error)throw error;return Array.isArray(data)?data[0]:data;}

export default async function handler(req,res){
  if(req.method!=='POST')return sendJson(res,405,{ok:false,message:'Method Not Allowed'});
  const auth=await requireAuthenticatedUser(req);if(!auth.ok)return sendJson(res,auth.status,{ok:false,message:auth.message});
  if(!R2_ACCOUNT_ID||!R2_ACCESS_KEY_ID||!R2_SECRET_ACCESS_KEY||!R2_BUCKET||!R2_PUBLIC_BASE_URL)return sendJson(res,500,{ok:false,message:'Configuración R2 incompleta.'});
  try{
    const body=await readJson(req);const reference=clean(body.operacion||body.codigo||body.id);if(!reference)return sendJson(res,400,{ok:false,message:'Indica la operación a reconciliar.'});
    const operation=await resolveOperation(auth.client,reference);if(!operation)return sendJson(res,404,{ok:false,message:`No existe la operación ${reference}.`});
    const prefix=`operaciones/${operation.codigo||operation.id}/`;
    const r2=r2Client();let token;const objects=[];
    do{const page=await r2.send(new ListObjectsV2Command({Bucket:R2_BUCKET,Prefix:prefix,ContinuationToken:token}));objects.push(...(page.Contents||[]).filter(o=>o.Key&&!String(o.Key).endsWith('/')));token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
    const existing=await existingEvidence(auth.client,String(operation.id||operation.codigo));
    const keys=new Set(existing.map(row=>clean(row.object_key)).filter(Boolean));
    const urls=new Set(existing.map(row=>clean(row.url_r2)).filter(Boolean));
    let registered=0,skipped=0;const errors=[];
    for(const object of objects){if(keys.has(object.Key)||urls.has(publicUrl(object.Key))){skipped+=1;continue;}const stage=inferredStage(operation,body.etapa,object.Key,prefix);try{await register(auth.client,operation,object,stage);registered+=1;}catch(error){errors.push({key:object.Key,etapa:stage,error:error?.message||String(error)});}}
    const status=errors.length?207:200;return sendJson(res,status,{ok:!errors.length,operacion:operation.codigo||operation.id,prefix,found:objects.length,registered,skipped,errors});
  }catch(error){return sendJson(res,500,{ok:false,message:'No se pudo reconciliar evidencia R2.',error:error?.message||String(error)});}
}
