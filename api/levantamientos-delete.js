import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser } from './_auth.js';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tnymrjxdhzdmpcbilftj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

function text(value) { return String(value == null ? '' : value).trim(); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)); }

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel para confirmar la limpieza R2.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function createR2Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('Cloudflare R2 no está configurado completamente en Vercel.');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });
}

function assertSafePrefix(prefix) {
  const clean = text(prefix).replace(/^\/+/, '');
  if (!/^levantamientos\/grupo-[a-z0-9-]+\/lev-g[a-z0-9-]+\/$/.test(clean)) {
    throw new Error(`Prefijo R2 de levantamiento inválido o inseguro: ${clean || '(vacío)'}`);
  }
  return clean;
}

function explicitKeys(job) {
  const raw = Array.isArray(job?.r2_keys) ? job.r2_keys : [];
  return [...new Set(raw.map(text).filter(Boolean))];
}

async function listPrefixKeys(r2, prefix) {
  const keys = [];
  let token;
  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: token
    }));
    for (const item of page.Contents || []) {
      if (item?.Key && !String(item.Key).endsWith('/')) keys.push(String(item.Key));
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function cleanupR2(job) {
  const prefix = assertSafePrefix(job?.r2_prefix);
  const stored = explicitKeys(job);
  const outside = stored.filter((key) => !key.startsWith(prefix));
  if (outside.length) {
    const error = new Error(`Se detectaron ${outside.length} r2_key fuera del prefijo exclusivo ${prefix}. No se borró ningún objeto fuera del levantamiento.`);
    error.code = 'R2_KEY_OUTSIDE_PREFIX';
    error.details = outside.slice(0, 10);
    throw error;
  }

  const r2 = createR2Client();
  const discovered = await listPrefixKeys(r2, prefix);
  const keys = [...new Set([...discovered, ...stored])].filter((key) => key.startsWith(prefix));
  let deleted = 0;

  for (let index = 0; index < keys.length; index += 1000) {
    const batch = keys.slice(index, index + 1000);
    if (!batch.length) continue;
    const result = await r2.send(new DeleteObjectsCommand({
      Bucket: R2_BUCKET,
      Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false }
    }));
    const errors = result.Errors || [];
    deleted += (result.Deleted || []).length;
    if (errors.length) {
      const error = new Error(`Cloudflare R2 rechazó ${errors.length} objeto(s) durante la limpieza.`);
      error.code = 'R2_PARTIAL_DELETE';
      error.deletedCount = deleted;
      error.details = errors.slice(0, 10);
      throw error;
    }
  }

  const remaining = await listPrefixKeys(r2, prefix);
  if (remaining.length) {
    const error = new Error(`La verificación R2 encontró ${remaining.length} objeto(s) todavía bajo ${prefix}.`);
    error.code = 'R2_REMAINS';
    error.deletedCount = deleted;
    error.details = remaining.slice(0, 10);
    throw error;
  }

  return { prefix, discovered: discovered.length, deleted, remaining: 0 };
}

async function markR2(cleanupId, status, errorMessage, deletedCount) {
  const service = createServiceClient();
  const result = await service.rpc('ops_levantamiento_eliminacion_marcar_r2_v1', {
    p_eliminacion_id: cleanupId,
    p_estado: status,
    p_error: errorMessage || null,
    p_objetos_eliminados: Number(deletedCount || 0)
  });
  if (result.error) throw new Error(`No se pudo actualizar el estado de limpieza R2: ${result.error.message}`);
  return result.data;
}

async function handlePreview(client, body) {
  const campaignId = text(body.campaignId || body.campanaId || body.id);
  if (!isUuid(campaignId)) throw new Error('campanaId inválido.');
  const result = await client.rpc('ops_levantamiento_eliminar_preflight_v1', { p_campana_id: campaignId });
  if (result.error) {
    const error = new Error(result.error.message || 'No se pudo preparar la eliminación.');
    error.status = result.error.code === '42501' ? 403 : 400;
    throw error;
  }
  return result.data;
}

async function handleDelete(client, body) {
  const campaignId = text(body.campaignId || body.campanaId || body.id);
  const confirmationCode = text(body.confirmationCode || body.codigoConfirmacion || body.codigo);
  if (!isUuid(campaignId)) throw new Error('campanaId inválido.');
  if (!confirmationCode) throw new Error('Debes escribir el código del levantamiento para confirmar.');

  const deleted = await client.rpc('ops_levantamiento_eliminar_v1', {
    p_campana_id: campaignId,
    p_codigo_confirmacion: confirmationCode
  });
  if (deleted.error) {
    const error = new Error(deleted.error.message || 'Supabase no pudo eliminar el levantamiento.');
    error.status = deleted.error.code === '42501' ? 403 : 400;
    throw error;
  }

  const job = deleted.data || {};
  const cleanupId = text(job.eliminacion_id);
  try {
    const r2 = await cleanupR2(job);
    const marked = await markR2(cleanupId, 'COMPLETADO', null, r2.deleted);
    return {
      status: 200,
      payload: {
        ok: true,
        complete: true,
        databaseDeleted: true,
        r2Complete: true,
        message: `${job.codigo} fue eliminado completamente de Supabase y Cloudflare R2.`,
        deletion: job,
        r2,
        cleanup: marked
      }
    };
  } catch (error) {
    const deletedCount = Number(error?.deletedCount || 0);
    let markError = null;
    try { await markR2(cleanupId, 'ERROR', error.message, deletedCount); }
    catch (markFailure) { markError = markFailure.message; }
    return {
      status: 207,
      payload: {
        ok: true,
        complete: false,
        databaseDeleted: true,
        r2Complete: false,
        message: `${job.codigo} fue eliminado de Supabase, pero la limpieza de Cloudflare R2 quedó pendiente.`,
        error: error.message,
        errorCode: error.code || 'R2_CLEANUP_FAILED',
        details: error.details || null,
        cleanupId,
        deletedCount,
        markError,
        deletion: job
      }
    };
  }
}

async function getCleanupJob(client, cleanupId) {
  if (!isUuid(cleanupId)) throw new Error('cleanupId inválido.');
  const result = await client
    .from('ops_levantamiento_eliminaciones')
    .select('*')
    .eq('id', cleanupId)
    .single();
  if (result.error) {
    const error = new Error(result.error.message || 'No se encontró la limpieza pendiente.');
    error.status = result.error.code === '42501' ? 403 : 404;
    throw error;
  }
  return result.data;
}

async function handleRetry(client, body) {
  const cleanupId = text(body.cleanupId || body.eliminacionId || body.id);
  const job = await getCleanupJob(client, cleanupId);
  try {
    const r2 = await cleanupR2(job);
    const marked = await markR2(cleanupId, 'COMPLETADO', null, r2.deleted);
    return {
      status: 200,
      payload: {
        ok: true,
        complete: true,
        databaseDeleted: true,
        r2Complete: true,
        message: `Limpieza R2 de ${job.codigo} completada.`,
        r2,
        cleanup: marked
      }
    };
  } catch (error) {
    const deletedCount = Number(error?.deletedCount || 0);
    let markError = null;
    try { await markR2(cleanupId, 'ERROR', error.message, deletedCount); }
    catch (markFailure) { markError = markFailure.message; }
    return {
      status: 207,
      payload: {
        ok: true,
        complete: false,
        databaseDeleted: true,
        r2Complete: false,
        message: `La limpieza R2 de ${job.codigo} sigue pendiente.`,
        error: error.message,
        errorCode: error.code || 'R2_CLEANUP_FAILED',
        details: error.details || null,
        cleanupId,
        deletedCount,
        markError
      }
    };
  }
}

async function handlePending(client) {
  const result = await client
    .from('ops_levantamiento_eliminaciones')
    .select('id,codigo,grupo_codigo,r2_estado,r2_objetos_eliminados,r2_error,eliminado_por_nombre,eliminado_en')
    .in('r2_estado', ['PENDIENTE', 'ERROR'])
    .order('eliminado_en', { ascending: false })
    .limit(50);
  if (result.error) {
    const error = new Error(result.error.message || 'No se pudieron consultar las limpiezas pendientes.');
    error.status = result.error.code === '42501' ? 403 : 400;
    throw error;
  }
  return result.data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method Not Allowed. Usa POST.' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { ok: false, message: auth.message });

  try {
    const body = await readBody(req);
    const action = text(body.action || 'preview').toLowerCase();

    if (action === 'preview') {
      const preview = await handlePreview(auth.client, body);
      return sendJson(res, 200, { ok: true, preview });
    }
    if (action === 'delete') {
      const result = await handleDelete(auth.client, body);
      return sendJson(res, result.status, result.payload);
    }
    if (action === 'retry') {
      const result = await handleRetry(auth.client, body);
      return sendJson(res, result.status, result.payload);
    }
    if (action === 'pending') {
      const pending = await handlePending(auth.client);
      return sendJson(res, 200, { ok: true, pending });
    }

    return sendJson(res, 400, { ok: false, message: 'Acción no soportada.' });
  } catch (error) {
    console.error('[levantamientos-delete]', error);
    return sendJson(res, Number(error?.status || 500), {
      ok: false,
      message: error?.message || 'No se pudo procesar la eliminación del levantamiento.'
    });
  }
}
