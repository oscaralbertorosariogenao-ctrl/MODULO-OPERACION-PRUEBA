import crypto from 'crypto';
import path from 'path';
import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { waitUntil } from '@vercel/functions';

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_REMOTE_FILES = 24;
const MAX_REMOTE_FILE_BYTES = 20 * 1024 * 1024;
const REMOTE_TIMEOUT_MS = 9000;
const URL_RE = /^https?:\/\//i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif|bmp|heic|heif)(?:\?|#|$)/i;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function safeText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(safeText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    if ('first' in value || 'last' in value) return [value.first, value.last].map(safeText).filter(Boolean).join(' ');
    if ('value' in value) return safeText(value.value);
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value).trim();
}

function normalize(value) {
  return safeText(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^q\d+[_-]?/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeLoose(value) {
  return normalize(value).replace(/_/g, ' ');
}

function normalizeAgency(value) {
  const raw = safeText(value);
  if (!raw) return '';
  const explicit = raw.match(/(?:agencia|ag)\s*[:#-]?\s*(\d{1,5})/i);
  const tokens = explicit ? [explicit[1]] : (raw.match(/\d{1,5}/g) || []);
  let digits = tokens.find((token) => token.length <= 4) || tokens[0] || '';
  digits = digits.replace(/^0+(?=\d)/, '');
  return digits ? (digits.length < 4 ? digits.padStart(4, '0') : digits) : '';
}

function normalizeGroup(value) {
  return safeText(value).replace(/^\s*(?:grupo|g)\s*[-:]?\s*/i, '').replace(/^0+/, '') || '';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeText(value));
}

function parseDate(value) {
  const raw = safeText(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latin = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (latin) {
    let year = Number(latin[3]);
    if (year < 100) year += 2000;
    return `${year}-${String(latin[2]).padStart(2, '0')}-${String(latin[1]).padStart(2, '0')}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function timingSafeMatch(received, expected) {
  const left = Buffer.from(safeText(received));
  const right = Buffer.from(safeText(expected));
  return Boolean(left.length && left.length === right.length && crypto.timingSafeEqual(left, right));
}

function makeServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function makeR2Client() {
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL']
    .filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Faltan variables de R2: ${missing.join(', ')}`);
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

async function requireUser(req, client) {
  const header = safeText(req.headers.authorization);
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const result = await client.auth.getUser(token);
  return result?.data?.user || null;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload demasiado grande.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      maxFields: 3000,
      maxFieldsSize: MAX_BODY_BYTES,
      maxFileSize: MAX_BODY_BYTES,
      maxTotalFileSize: MAX_BODY_BYTES,
      allowEmptyFiles: true
    });
    form.parse(req, (error, fields) => {
      if (error) return reject(Object.assign(new Error(error.message || 'No se pudo leer multipart.'), { statusCode: error.httpCode || 400 }));
      const output = {};
      for (const [key, value] of Object.entries(fields || {})) output[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
      resolve(output);
    });
  });
}

async function parseBody(req) {
  const contentType = safeText(req.headers['content-type']).toLowerCase();
  if (contentType.includes('multipart/form-data')) return parseMultipart(req);
  const buffer = await readRawBody(req);
  const raw = buffer.toString('utf8');
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  const params = new URLSearchParams(raw);
  const output = {};
  for (const [key, value] of params.entries()) {
    if (Object.prototype.hasOwnProperty.call(output, key)) output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
    else output[key] = value;
  }
  if (Object.keys(output).length) return output;
  try { return JSON.parse(raw || '{}'); } catch { return { raw }; }
}

function unwrapPayload(envelope) {
  let rawRequest = envelope?.rawRequest ?? envelope?.raw_request;
  if (Array.isArray(rawRequest)) rawRequest = rawRequest[0];
  if (typeof rawRequest === 'string') {
    try { return { ...envelope, ...JSON.parse(rawRequest), _webhookEnvelope: envelope }; }
    catch { return { ...envelope, rawRequest, _webhookEnvelope: envelope }; }
  }
  if (rawRequest && typeof rawRequest === 'object') return { ...envelope, ...rawRequest, _webhookEnvelope: envelope };
  return envelope && typeof envelope === 'object' ? envelope : {};
}

async function fetchJotformSubmission(submissionId) {
  const apiKey = safeText(process.env.JOTFORM_API_KEY);
  const id = safeText(submissionId);
  if (!apiKey || !id) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.jotform.com/submission/${encodeURIComponent(id)}`, {
      headers: { APIKEY: apiKey, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Jotform API respondió ${response.status}.`);
    const body = await response.json();
    return body?.response || null;
  } finally {
    clearTimeout(timer);
  }
}

function mergeJotformSubmission(payload, submission) {
  if (!submission || typeof submission !== 'object') return payload;
  return {
    ...payload,
    formID: submission.form_id || submission.formID || payload.formID || payload.formId,
    submissionID: submission.id || submission.submission_id || payload.submissionID || payload.submissionId,
    created_at: submission.created_at || payload.created_at,
    updated_at: submission.updated_at || payload.updated_at,
    answers: submission.answers || payload.answers || {}
  };
}

function firstEntryMatching(entries, pattern) {
  const match = entries.find((entry) => pattern.test(`${entry.key} ${entry.label}`) && safeText(entry.value));
  return match ? match.value : '';
}

function flattenPayload(payload) {
  const list = [];
  let sequence = 0;
  const add = (key, value, label = '', questionId = null, type = '') => {
    const normalized = normalize(key || label);
    if (!normalized) return;
    list.push({
      key: normalized,
      originalKey: safeText(key),
      label: safeText(label || key),
      value,
      questionId: questionId == null ? null : Number(questionId),
      type: safeText(type),
      order: questionId == null || Number.isNaN(Number(questionId)) ? 100000 + sequence++ : Number(questionId)
    });
  };

  for (const [key, value] of Object.entries(payload || {})) {
    if (['_webhookEnvelope', 'answers', 'temp_upload'].includes(key)) continue;
    add(key, value, key);
  }

  if (payload?.answers && typeof payload.answers === 'object') {
    for (const [questionId, answer] of Object.entries(payload.answers)) {
      if (!answer || typeof answer !== 'object') continue;
      add(answer.name || answer.text || answer.label || `question_${questionId}`,
        answer.answer ?? answer.prettyFormat ?? answer.value ?? '',
        answer.text || answer.label || answer.name || `Pregunta ${questionId}`,
        questionId,
        answer.type || '');
    }
  }
  return list.sort((a, b) => a.order - b.order);
}

function firstValue(entries, aliases) {
  const wanted = aliases.map(normalize);
  for (const alias of wanted) {
    const exact = entries.find((entry) => entry.key === alias && safeText(entry.value));
    if (exact) return exact.value;
  }
  for (const alias of wanted) {
    const partial = entries.find((entry) => (entry.key.includes(alias) || normalize(entry.label).includes(alias)) && safeText(entry.value));
    if (partial) return partial.value;
  }
  return '';
}

function collectUrls(value, output = []) {
  if (value == null) return output;
  if (Array.isArray(value)) { value.forEach((item) => collectUrls(item, output)); return output; }
  if (typeof value === 'object') {
    for (const candidate of [value.url, value.link, value.href, value.publicUrl, value.public_url, value.value]) if (candidate) collectUrls(candidate, output);
    return output;
  }
  const raw = safeText(value);
  if (!raw) return output;
  if (/^[\[{]/.test(raw)) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed !== raw) return collectUrls(parsed, output);
    } catch {}
  }
  raw.split(/[\n,|;]+/).map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).forEach((item) => {
    if (URL_RE.test(item) && (IMAGE_RE.test(item) || /jotform|upload|attachment|file/i.test(item))) output.push(item);
  });
  return output;
}

function isPhotoEntry(entry) {
  return /foto|imagen|evidencia|archivo|upload/i.test(`${entry.key} ${entry.label} ${entry.type}`) || collectUrls(entry.value, []).length > 0;
}

function nearestDescription(entries, conditionEntry, nextConditionOrder) {
  const candidates = entries.filter((entry) => entry.order > conditionEntry.order && entry.order < nextConditionOrder && /describe|descripcion|detalle|problema|observacion/i.test(`${entry.key} ${entry.label}`) && !isPhotoEntry(entry));
  return candidates.length ? safeText(candidates[0].value) : '';
}

function nearestPhotoEntries(entries, conditionEntry, nextConditionOrder) {
  return entries.filter((entry) => entry.order > conditionEntry.order && entry.order < nextConditionOrder && isPhotoEntry(entry));
}

function asStringList(value) {
  if (Array.isArray(value)) return value.map(normalizeLoose).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(normalizeLoose).filter(Boolean);
    } catch {}
    return [normalizeLoose(value)].filter(Boolean);
  }
  return [];
}

function entryMatchesMapping(entry, mapping) {
  const key = normalizeLoose(entry.key);
  const label = normalizeLoose(entry.label);
  const fieldPattern = normalizeLoose(mapping.campo_patron);
  const labelPattern = normalizeLoose(mapping.etiqueta_patron);
  return Boolean(
    (fieldPattern && (key === fieldPattern || key.includes(fieldPattern) || fieldPattern.includes(key))) ||
    (labelPattern && (label === labelPattern || label.includes(labelPattern) || labelPattern.includes(label)))
  );
}

function classifyFinding(value, mapping) {
  const normalizedValue = normalizeLoose(value);
  if (!normalizedValue) return null;
  if (mapping.no_tiene_es_problema && /\bno tiene\b|\bsin\b/.test(normalizedValue)) return 'CORRECTIVO';
  const corrective = asStringList(mapping.valores_correctivos);
  if (corrective.some((candidate) => candidate && (normalizedValue === candidate || normalizedValue.includes(candidate)))) return 'CORRECTIVO';
  const preventive = asStringList(mapping.valores_preventivos);
  if (preventive.some((candidate) => candidate && (normalizedValue === candidate || normalizedValue.includes(candidate)))) return 'PREVENTIVO';
  return null;
}

async function resolveCampaign(client, idOrCode) {
  const raw = safeText(idOrCode);
  if (!raw) return null;
  const query = client.from('ops_levantamiento_campanas').select('*');
  const response = /^[0-9a-f-]{36}$/i.test(raw) ? await query.eq('id', raw).maybeSingle() : await query.eq('codigo', raw).maybeSingle();
  if (response.error) throw response.error;
  return response.data || null;
}

async function hydrateAgencyGroup(client, agency) {
  if (!agency) return null;
  const nested = Array.isArray(agency.grupos) ? agency.grupos[0] : agency.grupos;
  if (nested?.codigo) return { ...agency, grupos: nested };
  if (!agency.grupo_id) return agency;
  const groupResponse = await client.from('grupos').select('id,codigo,nombre').eq('id', agency.grupo_id).maybeSingle();
  if (!groupResponse.error && groupResponse.data) return { ...agency, grupos: groupResponse.data };
  return agency;
}

async function resolveAgency(client, id, number, groupHint = '') {
  const selectWithGroup = '*, grupos(id,codigo,nombre)';
  if (/^[0-9a-f-]{36}$/i.test(safeText(id))) {
    let response = await client.from('agencias').select(selectWithGroup).eq('id', safeText(id)).maybeSingle();
    if (response.error) response = await client.from('agencias').select('*').eq('id', safeText(id)).maybeSingle();
    if (!response.error && response.data) return hydrateAgencyGroup(client, response.data);
  }
  const normalized = normalizeAgency(number);
  if (!normalized) return null;
  const queryValues = [...new Set([Number(normalized), normalized])];
  const candidates = [];
  for (const queryValue of queryValues) {
    let response = await client.from('agencias').select(selectWithGroup).eq('numero', queryValue).limit(20);
    if (response.error) response = await client.from('agencias').select('*').eq('numero', queryValue).limit(20);
    if (!response.error && Array.isArray(response.data)) candidates.push(...response.data);
    if (candidates.length) break;
  }
  const unique = [...new Map(candidates.map((item) => [item.id || `${item.numero}-${item.grupo_id || ''}`, item])).values()];
  const hydrated = [];
  for (const item of unique) hydrated.push(await hydrateAgencyGroup(client, item));
  const wantedGroup = normalizeGroup(groupHint);
  if (wantedGroup) {
    const exact = hydrated.find((item) => getAgencyGroup(item, '') === wantedGroup);
    if (exact) return exact;
  }
  return hydrated.length === 1 ? hydrated[0] : (hydrated[0] || null);
}

function getAgencyNumber(agency, input) {
  return normalizeAgency(agency?.numero ?? agency?.codigo ?? input);
}

function getAgencyGroup(agency, input) {
  const nested = Array.isArray(agency?.grupos) ? agency.grupos[0] : agency?.grupos;
  return normalizeGroup(nested?.codigo ?? agency?.grupo_codigo ?? agency?.codigo_grupo ?? input);
}

async function findOpenAutomaticCampaign(client, groupCode) {
  const response = await client.from('ops_levantamiento_campanas')
    .select('*')
    .eq('origen', 'MANUAL')
    .eq('grupo_codigo', normalizeGroup(groupCode))
    .in('estado', ['ABIERTO', 'EN_REVISION'])
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (response.error) throw response.error;
  return response.data || null;
}

async function resolveOrCreateAutomaticCampaign(client, context) {
  const groupCode = normalizeGroup(context.groupCode);
  if (!groupCode) throw new Error('No se pudo determinar el grupo oficial de la agencia.');
  const existing = await findOpenAutomaticCampaign(client, groupCode);
  if (existing) return { campaign: existing, created: false };

  const payload = {
    grupo_id: context.groupId || null,
    grupo_codigo: groupCode,
    nombre: 'Levantamiento general de agencias',
    descripcion: 'Creado automáticamente al recibir el primer formulario general de Jotform para este grupo.',
    responsable_nombre: context.technician || null,
    origen: 'MANUAL',
    origen_id: null,
    estado: 'ABIERTO',
    fecha_inicio: context.inspectionDate || new Date().toISOString().slice(0, 10),
    jotform_form_id: context.formId || null,
    jotform_form_url: process.env.JOTFORM_LEVANTAMIENTOS_FORM_URL || null,
    metadata: {
      creado_automaticamente: true,
      fuente: 'JOTFORM_GENERAL',
      primera_submission_id: context.submissionId || null
    }
  };
  const inserted = await client.from('ops_levantamiento_campanas').insert(payload).select('*').single();
  if (!inserted.error) return { campaign: inserted.data, created: true };

  // Dos formularios pueden llegar al mismo tiempo. El índice único decide cuál crea
  // la campaña y el segundo vuelve a consultar la campaña ya creada.
  if (inserted.error.code === '23505') {
    const concurrent = await findOpenAutomaticCampaign(client, groupCode);
    if (concurrent) return { campaign: concurrent, created: false };
  }
  throw inserted.error;
}

function getSubmissionMeta(payload, entries) {
  return {
    formId: safeText(payload.formID || payload.formId || payload.form_id || firstValue(entries, ['form_id', 'formid'])),
    submissionId: safeText(payload.submissionID || payload.submissionId || payload.submission_id || firstValue(entries, ['submission_id', 'submissionid']))
  };
}

async function loadMappings(client, formId) {
  const values = ['*'];
  if (formId) values.push(formId);
  const response = await client.from('ops_levantamiento_mapeo_campos').select('*').eq('activo', true).in('form_id', values).order('orden');
  if (response.error) throw response.error;
  return response.data || [];
}

function makeResponseRows(entries, mappings, expedienteId) {
  const rows = [];
  for (const entry of entries) {
    if (!safeText(entry.value) || isPhotoEntry(entry)) continue;
    const mapping = mappings.find((item) => entryMatchesMapping(entry, item));
    rows.push({
      expediente_id: expedienteId,
      seccion: mapping?.seccion || 'General',
      campo_clave: entry.key,
      etiqueta: entry.label || entry.originalKey || entry.key,
      elemento_clave: mapping?.elemento_clave || null,
      valor: entry.value,
      estado_normalizado: mapping ? safeText(entry.value) : null,
      orden: entry.order,
      metadata: { question_id: entry.questionId, jotform_type: entry.type, original_key: entry.originalKey }
    });
  }
  return rows;
}

function makeFindingDrafts(entries, mappings, base) {
  const conditions = [];
  for (const entry of entries) {
    if (!safeText(entry.value) || isPhotoEntry(entry)) continue;
    const mapping = mappings.find((item) => entryMatchesMapping(entry, item));
    if (!mapping) continue;
    const findingType = classifyFinding(entry.value, mapping);
    if (findingType) conditions.push({ entry, mapping, findingType });
  }

  const grouped = new Map();
  conditions.forEach((condition, index) => {
    const nextOrder = conditions[index + 1]?.entry?.order ?? Number.POSITIVE_INFINITY;
    const description = nearestDescription(entries, condition.entry, nextOrder);
    const photos = nearestPhotoEntries(entries, condition.entry, nextOrder);
    const key = condition.mapping.problema_clave;
    const existing = grouped.get(key) || {
      ...base,
      area_clave: condition.mapping.area_clave,
      area_etiqueta: condition.mapping.area_etiqueta,
      elemento_clave: condition.mapping.elemento_clave,
      elemento_etiqueta: condition.mapping.elemento_etiqueta,
      problema_clave: key,
      problema_etiqueta: condition.mapping.problema_etiqueta,
      condicion_reportada: [],
      descripcion: [],
      prioridad: condition.mapping.prioridad_default || 'MEDIA',
      tipo: condition.findingType,
      estado: 'PENDIENTE',
      metadata: { elementos: [], campos: [] },
      photoEntries: []
    };
    existing.condicion_reportada.push(safeText(condition.entry.value));
    if (description) existing.descripcion.push(description);
    if (!existing.metadata.elementos.includes(condition.mapping.elemento_etiqueta)) existing.metadata.elementos.push(condition.mapping.elemento_etiqueta);
    existing.metadata.campos.push(condition.entry.originalKey || condition.entry.key);
    existing.photoEntries.push(...photos);
    if (existing.tipo !== 'CORRECTIVO' && condition.findingType === 'CORRECTIVO') existing.tipo = 'CORRECTIVO';
    grouped.set(key, existing);
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    elemento_clave: item.metadata.elementos.length > 1 ? item.problema_clave : item.elemento_clave,
    elemento_etiqueta: item.metadata.elementos.join(' / ') || item.elemento_etiqueta,
    condicion_reportada: [...new Set(item.condicion_reportada)].join(' / '),
    descripcion: [...new Set(item.descripcion)].join(' | ') || `Se reportó ${item.problema_etiqueta.toLowerCase()}.`
  }));
}

function fileNameFromUrl(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'evidencia.jpg'); }
  catch { return 'evidencia.jpg'; }
}

function extensionFrom(contentType, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext && ext.length <= 8) return ext;
  const type = safeText(contentType).toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  if (type.includes('heic')) return '.heic';
  return '.jpg';
}

function safePathPart(value, fallback = 'general') {
  const result = normalize(value).replace(/_+/g, '-').slice(0, 100);
  return result || fallback;
}

async function fetchRemoteFile(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    let response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok && process.env.JOTFORM_API_KEY) {
      const parsed = new URL(url);
      parsed.searchParams.set('apiKey', process.env.JOTFORM_API_KEY);
      response = await fetch(parsed.toString(), { signal: controller.signal, redirect: 'follow' });
    }
    if (!response.ok) throw new Error(`No se pudo descargar (${response.status}).`);
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > MAX_REMOTE_FILE_BYTES) throw new Error('La fotografía excede el límite de 20 MB.');
    if (!response.body) throw new Error('La fotografía llegó sin contenido.');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REMOTE_FILE_BYTES) {
        await reader.cancel();
        throw new Error('La fotografía excede el límite de 20 MB.');
      }
      chunks.push(Buffer.from(value));
    }
    return { buffer: Buffer.concat(chunks), contentType: response.headers.get('content-type') || 'image/jpeg' };
  } finally { clearTimeout(timer); }
}

async function copyUrlToR2(r2, context) {
  const { url, campaign, agencyNumber, problemKey, submissionId } = context;
  const originalName = fileNameFromUrl(url);
  const remote = await fetchRemoteFile(url);
  const ext = extensionFrom(remote.contentType, originalName);
  const hash = crypto.createHash('sha1').update(`${submissionId}:${url}`).digest('hex').slice(0, 18);
  const key = [
    'levantamientos',
    `grupo-${safePathPart(campaign.grupo_codigo)}`,
    safePathPart(campaign.codigo),
    `agencia-${safePathPart(agencyNumber)}`,
    safePathPart(problemKey || 'general'),
    `${hash}${ext}`
  ].join('/');
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: remote.buffer,
    ContentType: remote.contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }));
  const base = safeText(process.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, '');
  return { r2Key: key, r2Url: `${base}/${key}`, contentType: remote.contentType, originalName };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await worker(items[index], index); }
      catch (error) { results[index] = { error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, run));
  return results;
}

function evidenceDrafts(entries, findings, base) {
  const byUrl = new Map();
  const findingByPhotoOrder = [];
  for (const finding of findings) {
    for (const entry of finding.photoEntries || []) findingByPhotoOrder.push({ order: entry.order, problemKey: finding.problema_clave });
  }

  for (const entry of entries) {
    const urls = collectUrls(entry.value, []);
    for (const url of urls) {
      if (byUrl.has(url)) continue;
      let problemKey = null;
      const direct = findings.find((finding) => normalizeLoose(`${entry.key} ${entry.label}`).includes(normalizeLoose(finding.elemento_etiqueta)) || normalizeLoose(`${entry.key} ${entry.label}`).includes(normalizeLoose(finding.problema_etiqueta)));
      if (direct) problemKey = direct.problema_clave;
      if (!problemKey) problemKey = findingByPhotoOrder.find((item) => item.order === entry.order)?.problemKey || null;
      byUrl.set(url, {
        ...base,
        problemKey,
        campo_clave: entry.key,
        etiqueta: entry.label || 'Evidencia',
        url_origen: url,
        nombre_archivo: fileNameFromUrl(url),
        orden: entry.order,
        metadata: { question_id: entry.questionId, original_key: entry.originalKey }
      });
    }
  }
  return Array.from(byUrl.values()).slice(0, MAX_REMOTE_FILES);
}

async function upsertIntake(client, values) {
  const response = await client.from('ops_jotform_levantamientos_ingresos').upsert(values, { onConflict: 'submission_id' }).select('*').single();
  if (response.error) throw response.error;
  return response.data;
}

async function processSubmission(client, envelope, options = {}) {
  let payload = unwrapPayload(envelope);
  let entries = flattenPayload(payload);
  let meta = getSubmissionMeta(payload, entries);
  if (!meta.submissionId) throw Object.assign(new Error('Jotform no envió submissionID.'), { statusCode: 400 });

  let apiWarning = null;
  if ((!payload.answers || !Object.keys(payload.answers || {}).length) && process.env.JOTFORM_API_KEY) {
    try {
      const fullSubmission = await fetchJotformSubmission(meta.submissionId);
      if (fullSubmission) {
        payload = mergeJotformSubmission(payload, fullSubmission);
        entries = flattenPayload(payload);
        meta = getSubmissionMeta(payload, entries);
      }
    } catch (error) {
      apiWarning = `No se pudo ampliar la submission con Jotform API: ${safeText(error.message || error)}`;
    }
  }

  const allowedFormId = safeText(process.env.JOTFORM_LEVANTAMIENTOS_FORM_ID);
  if (allowedFormId && meta.formId && allowedFormId !== meta.formId) throw Object.assign(new Error('El formulario recibido no está autorizado.'), { statusCode: 403 });

  const campaignInput = options.forcedCampaignId || firstValue(entries, ['levantamiento_id', 'campana_id', 'levantamiento_codigo', 'codigo_levantamiento']);
  const agencyIdInput = safeText(firstValue(entries, ['agencia_id']));
  const receivedGroup = normalizeGroup(
    firstValue(entries, ['grupo_codigo', 'grupo', 'codigo_grupo']) ||
    firstEntryMatching(entries, /(?:^|\b)(?:grupo|group)(?:\b|$)/i)
  );
  const agencyNumberInput =
    firstValue(entries, ['agencia_numero', 'codigo_agencia', 'numero_agencia', 'agencia']) ||
    firstEntryMatching(entries, /(?:^|\b)(?:agencia|agency)(?:\b|$)/i);
  const agency = await resolveAgency(client, agencyIdInput, agencyNumberInput, receivedGroup);
  const agencyNumber = getAgencyNumber(agency, agencyNumberInput);
  const officialGroup = getAgencyGroup(agency, '');
  const technician = safeText(firstValue(entries, ['tecnico', 'responsable', 'nombre_tecnico', 'realizado_por']));
  const inspectionDate = parseDate(firstValue(entries, ['fecha_inspeccion', 'fecha_visita', 'fecha_levantamiento', 'fecha'])) || new Date().toISOString().slice(0, 10);
  const observation = safeText(firstValue(entries, ['comentario_observacion', 'comentario', 'observacion_general', 'observaciones_generales']));
  const source = safeText(firstValue(entries, ['origen'])).toUpperCase();
  const origin = ['MANTENIMIENTO_PREVENTIVO', 'CONTROL_TECNICO'].includes(source) ? source : 'JOTFORM';
  const originRecordId = safeText(firstValue(entries, ['origen_id', 'origen_registro_id', 'registro_origen_id'])) || null;

  let campaign = null;
  let routingMode = 'EXPLICITO';
  let routingWarning = apiWarning;
  let automaticCreated = false;

  if (safeText(campaignInput)) {
    campaign = await resolveCampaign(client, campaignInput);
  } else if (agency && agencyNumber && officialGroup) {
    const automatic = await resolveOrCreateAutomaticCampaign(client, {
      groupId: agency.grupo_id || (Array.isArray(agency.grupos) ? agency.grupos[0]?.id : agency.grupos?.id) || null,
      groupCode: officialGroup,
      technician,
      inspectionDate,
      formId: meta.formId,
      submissionId: meta.submissionId
    });
    campaign = automatic.campaign;
    automaticCreated = automatic.created;
    routingMode = automatic.created ? 'AUTOMATICO_CREADO' : 'AUTOMATICO_EXISTENTE';
    if (receivedGroup && receivedGroup !== officialGroup) {
      const mismatch = `Jotform indicó Grupo ${receivedGroup}; se utilizó el Grupo oficial ${officialGroup} de la agencia ${agencyNumber}.`;
      routingWarning = routingWarning ? `${routingWarning} | ${mismatch}` : mismatch;
    }
  }

  const intakeBase = {
    form_id: meta.formId || null,
    submission_id: meta.submissionId,
    campana_id: campaign?.id || null,
    levantamiento_codigo_recibido: safeText(campaignInput) || campaign?.codigo || null,
    payload: {
      envelope,
      payload,
      routing: {
        modo: routingMode,
        agencia_numero_detectada: agencyNumber || null,
        grupo_recibido: receivedGroup || null,
        grupo_oficial: officialGroup || null,
        advertencia: routingWarning,
        campana_creada_automaticamente: automaticCreated
      }
    },
    recibido_en: new Date().toISOString()
  };

  const savePending = async (reason) => {
    const intake = await upsertIntake(client, { ...intakeBase, estado: 'PENDIENTE_VINCULO', error: reason });
    return { pendingLink: true, intakeId: intake.id, submissionId: meta.submissionId, reason };
  };

  if (!agency || !agencyNumber) {
    return savePending('La agencia indicada en Jotform no existe o no pudo identificarse en el catálogo oficial.');
  }
  if (!officialGroup) {
    return savePending(`La agencia ${agencyNumber} existe, pero no tiene un grupo oficial asignado.`);
  }
  if (safeText(campaignInput) && !campaign) {
    return savePending('Se recibió un código de levantamiento explícito, pero no existe o no es válido.');
  }
  if (!campaign) {
    return savePending('No se pudo encontrar ni crear el levantamiento abierto para el grupo oficial de la agencia.');
  }
  if (!['ABIERTO', 'EN_REVISION'].includes(campaign.estado) && !options.allowClosed) {
    return savePending(`El levantamiento ${campaign.codigo} está ${campaign.estado}.`);
  }

  const campaignGroup = normalizeGroup(campaign.grupo_codigo);
  if (campaignGroup !== officialGroup) {
    return savePending(`La agencia ${agencyNumber} pertenece oficialmente al Grupo ${officialGroup}, pero el levantamiento ${campaign.codigo} corresponde al Grupo ${campaignGroup}.`);
  }

  const intake = await upsertIntake(client, { ...intakeBase, estado: 'PROCESANDO', error: routingWarning });
  try {
    const existingResponse = await client.from('ops_levantamiento_agencias').select('*').eq('campana_id', campaign.id).eq('agencia_numero', agencyNumber).maybeSingle();
    if (existingResponse.error) throw existingResponse.error;
    const expedientePayload = {
      campana_id: campaign.id,
      agencia_id: agency.id || (agencyIdInput || null),
      agencia_numero: agencyNumber,
      grupo_id: agency.grupo_id || campaign.grupo_id || null,
      grupo_codigo: campaignGroup,
      tecnico_nombre: technician || campaign.responsable_nombre || null,
      fecha_inspeccion: inspectionDate,
      fecha_recepcion: new Date().toISOString(),
      estado: 'RECIBIDO',
      resumen: `Levantamiento de la agencia ${agencyNumber} recibido desde Jotform.`,
      observacion_general: observation || null,
      jotform_form_id: meta.formId || null,
      jotform_submission_id: meta.submissionId,
      origen: origin,
      origen_registro_id: originRecordId,
      raw_payload: { envelope, payload, routing: intakeBase.payload.routing }
    };

    let expediente;
    if (existingResponse.data) {
      const saved = await client.from('ops_levantamiento_agencias').update(expedientePayload).eq('id', existingResponse.data.id).select('*').single();
      if (saved.error) throw saved.error;
      expediente = saved.data;
    } else {
      const saved = await client.from('ops_levantamiento_agencias').insert(expedientePayload).select('*').single();
      if (saved.error) throw saved.error;
      expediente = saved.data;
    }

    const mappings = await loadMappings(client, meta.formId);
    const responses = makeResponseRows(entries, mappings, expediente.id);
    const findingDraftList = makeFindingDrafts(entries, mappings, {
      campana_id: campaign.id,
      expediente_id: expediente.id,
      agencia_id: expediente.agencia_id,
      agencia_numero: agencyNumber,
      grupo_codigo: normalizeGroup(campaign.grupo_codigo)
    });

    const deleteResponses = await client.from('ops_levantamiento_respuestas').delete().eq('expediente_id', expediente.id);
    if (deleteResponses.error) throw deleteResponses.error;
    if (responses.length) {
      const inserted = await client.from('ops_levantamiento_respuestas').insert(responses);
      if (inserted.error) throw inserted.error;
    }

    const previousFindingsResponse = await client.from('ops_levantamiento_hallazgos').select('*').eq('expediente_id', expediente.id);
    if (previousFindingsResponse.error) throw previousFindingsResponse.error;
    const previousFindingList = previousFindingsResponse.data || [];
    const previousFindings = new Map(previousFindingList.map((item) => [item.problema_clave, item]));

    const findingRows = findingDraftList.map(({ photoEntries, ...row }) => {
      const previous = previousFindings.get(row.problema_clave);
      const linkedControlId = origin === 'CONTROL_TECNICO' && isUuid(originRecordId) ? originRecordId : null;
      const linkedMaintenanceId = origin === 'MANTENIMIENTO_PREVENTIVO' && isUuid(originRecordId) ? originRecordId : null;
      return {
        ...row,
        estado: previous?.estado || row.estado,
        resolucion: previous?.resolucion || null,
        resuelto_por: previous?.resuelto_por || null,
        resuelto_en: previous?.resuelto_en || null,
        control_tecnico_id: previous?.control_tecnico_id || linkedControlId,
        mantenimiento_plan_agencia_id: previous?.mantenimiento_plan_agencia_id || linkedMaintenanceId
      };
    });
    let savedFindings = [];
    if (findingRows.length) {
      const upserted = await client.from('ops_levantamiento_hallazgos')
        .upsert(findingRows, { onConflict: 'expediente_id,problema_clave' })
        .select('*');
      if (upserted.error) throw upserted.error;
      savedFindings = upserted.data || [];
    }

    const receivedProblemKeys = new Set(findingRows.map((item) => item.problema_clave));
    const obsoleteActiveIds = previousFindingList
      .filter((item) => !receivedProblemKeys.has(item.problema_clave) && ['PENDIENTE', 'EN_COORDINACION', 'EN_PROCESO'].includes(item.estado))
      .map((item) => item.id);
    if (obsoleteActiveIds.length) {
      const archived = await client.from('ops_levantamiento_hallazgos').update({
        estado: 'DESCARTADO',
        resolucion: 'El problema dejó de aparecer en la actualización más reciente del formulario.',
        resuelto_por: 'Actualización de Jotform'
      }).in('id', obsoleteActiveIds);
      if (archived.error) throw archived.error;
    }

    const currentFindingsResponse = await client.from('ops_levantamiento_hallazgos').select('id,problema_clave').eq('expediente_id', expediente.id);
    if (currentFindingsResponse.error) throw currentFindingsResponse.error;
    const findingIdByKey = new Map((currentFindingsResponse.data || []).map((item) => [item.problema_clave, item.id]));

    const deleteEvidence = await client.from('ops_levantamiento_evidencias').delete().eq('expediente_id', expediente.id).eq('origen', 'JOTFORM');
    if (deleteEvidence.error) throw deleteEvidence.error;

    const evidenceInput = evidenceDrafts(entries, findingDraftList, {
      campana_id: campaign.id,
      expediente_id: expediente.id,
      agencia_numero: agencyNumber,
      origen: 'JOTFORM'
    });
    const pendingEvidenceRows = evidenceInput.map((evidence) => ({
      campana_id: evidence.campana_id,
      expediente_id: evidence.expediente_id,
      hallazgo_id: evidence.problemKey ? findingIdByKey.get(evidence.problemKey) || null : null,
      agencia_numero: evidence.agencia_numero,
      campo_clave: evidence.campo_clave,
      etiqueta: evidence.etiqueta,
      url_origen: evidence.url_origen,
      nombre_archivo: evidence.nombre_archivo,
      origen: 'JOTFORM',
      estado_r2: 'PENDIENTE',
      orden: evidence.orden,
      metadata: { ...evidence.metadata, problema_clave: evidence.problemKey || null }
    }));
    if (pendingEvidenceRows.length) {
      const insertedEvidence = await client.from('ops_levantamiento_evidencias').insert(pendingEvidenceRows);
      if (insertedEvidence.error) throw insertedEvidence.error;
    }

    let evidenceMigration = { retried: pendingEvidenceRows.length, migrated: 0, errors: 0 };
    if (!options.deferEvidence && pendingEvidenceRows.length) evidenceMigration = await retryEvidence(client, expediente.id);

    await client.rpc('ops_levantamiento_recalcular_expediente', { p_expediente_id: expediente.id });
    await client.rpc('ops_levantamiento_recalcular_campana', { p_campana_id: campaign.id });

    await client.from('ops_jotform_levantamientos_ingresos').update({
      estado: 'PROCESADO',
      error: null,
      campana_id: campaign.id,
      expediente_id: expediente.id,
      procesado_en: new Date().toISOString()
    }).eq('id', intake.id);

    return {
      pendingLink: false,
      intakeId: intake.id,
      campaignId: campaign.id,
      campaignCode: campaign.codigo,
      expedienteId: expediente.id,
      submissionId: meta.submissionId,
      agencyNumber,
      responses: responses.length,
      findings: findingRows.length,
      evidence: pendingEvidenceRows.length,
      evidenceMigrated: evidenceMigration.migrated,
      evidenceErrors: evidenceMigration.errors,
      evidencePending: options.deferEvidence ? pendingEvidenceRows.length : 0
    };
  } catch (error) {
    await client.from('ops_jotform_levantamientos_ingresos').update({ estado: 'ERROR', error: safeText(error.message || error), procesado_en: new Date().toISOString() }).eq('id', intake.id);
    throw error;
  }
}

async function retryEvidence(client, expedienteId) {
  const expedienteResponse = await client.from('ops_levantamiento_agencias').select('*, ops_levantamiento_campanas(*)').eq('id', expedienteId).single();
  if (expedienteResponse.error) throw expedienteResponse.error;
  const expediente = expedienteResponse.data;
  const campaign = expediente.ops_levantamiento_campanas;
  const pendingResponse = await client.from('ops_levantamiento_evidencias').select('*').eq('expediente_id', expedienteId).neq('estado_r2', 'MIGRADO');
  if (pendingResponse.error) throw pendingResponse.error;
  const pending = pendingResponse.data || [];
  if (!pending.length) return { retried: 0, migrated: 0, errors: 0 };
  const r2 = makeR2Client();
  const results = await mapWithConcurrency(pending, 3, async (item) => {
    try {
      const result = await copyUrlToR2(r2, {
        url: item.url_origen,
        campaign,
        agencyNumber: expediente.agencia_numero,
        problemKey: item.metadata?.problema_clave,
        submissionId: expediente.jotform_submission_id || expediente.id
      });
      const update = await client.from('ops_levantamiento_evidencias').update({ r2_url: result.r2Url, r2_key: result.r2Key, mime_type: result.contentType, estado_r2: 'MIGRADO', error_r2: null }).eq('id', item.id);
      if (update.error) throw update.error;
      return true;
    } catch (error) {
      await client.from('ops_levantamiento_evidencias').update({ estado_r2: 'ERROR', error_r2: safeText(error.message || error) }).eq('id', item.id);
      return false;
    }
  });
  await client.rpc('ops_levantamiento_recalcular_expediente', { p_expediente_id: expedienteId });
  return { retried: pending.length, migrated: results.filter(Boolean).length, errors: results.filter((value) => !value).length };
}

async function recordWebhookFailure(client, envelope, error) {
  try {
    const payload = unwrapPayload(envelope || {});
    const entries = flattenPayload(payload);
    const meta = getSubmissionMeta(payload, entries);
    const fallback = crypto.createHash('sha256').update(JSON.stringify(envelope || {})).digest('hex').slice(0, 20);
    const submissionId = meta.submissionId || `ERROR-${Date.now()}-${fallback}`;
    await upsertIntake(client, {
      form_id: meta.formId || null,
      submission_id: submissionId,
      campana_id: null,
      expediente_id: null,
      levantamiento_codigo_recibido: safeText(firstValue(entries, ['levantamiento_id', 'levantamiento_codigo', 'codigo_levantamiento'])) || null,
      estado: 'ERROR',
      error: safeText(error?.message || error || 'Error desconocido al recibir webhook.'),
      payload: { envelope, payload, diagnostico: true },
      recibido_en: new Date().toISOString(),
      procesado_en: new Date().toISOString()
    });
  } catch (diagnosticError) {
    console.error('[Jotform Levantamientos v807.04 diagnóstico]', diagnosticError);
  }
}

export default async function handler(req, res) {
  const client = makeServerClient();
  const action = safeText(req.query?.action).toLowerCase();

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'jotform-levantamientos-automaticos-v807.04',
      webhookConfigured: Boolean(process.env.JOTFORM_WEBHOOK_SECRET),
      formConfigured: Boolean(process.env.JOTFORM_LEVANTAMIENTOS_FORM_URL),
      r2Configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL)
    });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });

  let receivedEnvelope = null;
  try {
    if (action === 'link' || action === 'retry') {
      const user = await requireUser(req, client);
      if (!user) return sendJson(res, 401, { ok: false, message: 'Sesión no autorizada.' });
      const body = await parseBody(req);
      if (action === 'retry') {
        const expedienteId = safeText(body.expedienteId || body.expediente_id);
        if (!expedienteId) return sendJson(res, 400, { ok: false, message: 'Falta expedienteId.' });
        return sendJson(res, 200, { ok: true, ...(await retryEvidence(client, expedienteId)) });
      }
      const intakeId = safeText(body.intakeId || body.intake_id);
      const campaignId = safeText(body.campaignId || body.campana_id);
      if (!intakeId || !campaignId) return sendJson(res, 400, { ok: false, message: 'Faltan intakeId o campaignId.' });
      const intakeResponse = await client.from('ops_jotform_levantamientos_ingresos').select('*').eq('id', intakeId).single();
      if (intakeResponse.error) throw intakeResponse.error;
      const envelope = intakeResponse.data.payload?.envelope || intakeResponse.data.payload || {};
      const result = await processSubmission(client, envelope, { forcedCampaignId: campaignId, allowClosed: false, deferEvidence: true });
      if (!result.pendingLink && result.evidencePending) waitUntil(retryEvidence(client, result.expedienteId).catch((error) => console.error('[Levantamientos R2 background]', error)));
      return sendJson(res, 200, { ok: true, ...result });
    }

    const expectedSecret = safeText(process.env.JOTFORM_WEBHOOK_SECRET);
    const receivedSecret = req.query?.token || req.headers['x-go-jotform-token'] || '';
    if (!expectedSecret || !timingSafeMatch(receivedSecret, expectedSecret)) return sendJson(res, 401, { ok: false, message: 'Webhook no autorizado.' });
    receivedEnvelope = await parseBody(req);
    const result = await processSubmission(client, receivedEnvelope, { deferEvidence: true });
    if (!result.pendingLink && result.evidencePending) waitUntil(retryEvidence(client, result.expedienteId).catch((error) => console.error('[Levantamientos R2 background]', error)));
    return sendJson(res, result.pendingLink ? 202 : 200, { ok: true, ...result });
  } catch (error) {
    console.error('[Jotform Levantamientos v807.04]', error);
    if (receivedEnvelope) await recordWebhookFailure(client, receivedEnvelope, error);
    return sendJson(res, error.statusCode || 500, { ok: false, message: error.message || 'No se pudo procesar la solicitud.' });
  }
}
