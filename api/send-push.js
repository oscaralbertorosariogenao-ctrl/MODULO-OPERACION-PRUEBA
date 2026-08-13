import { requireAuthenticatedUser } from './_auth.js';
import { MAX_PUSH_REQUEST_BYTES, validatePushRequestBody } from './_push-contract.js';

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const rateBuckets = new Map();

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function errorResponse(res, status, code, message) {
  return sendJson(res, status, { ok: false, error: { code, message } });
}

function parseBody(req) {
  if (req.body == null || req.body === '') return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  throw new Error('INVALID_JSON_BODY');
}

function requestSize(req, body) {
  const declared = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(declared) && declared > 0) return declared;
  return Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
}

function rateLimit(userId) {
  const now = Date.now();
  const key = String(userId || 'unknown');
  const current = rateBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: RATE_LIMIT - current.count };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      service: 'send-push',
      delivery: 'disabled-until-subscription-resolver-is-verified'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return errorResponse(res, 405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return errorResponse(res, auth.status || 401, 'AUTH_REQUIRED', auth.message || 'Sesión requerida.');

  let body;
  try {
    body = parseBody(req);
  } catch (_error) {
    return errorResponse(res, 400, 'INVALID_JSON', 'El cuerpo JSON no es válido.');
  }

  if (requestSize(req, body) > MAX_PUSH_REQUEST_BYTES) {
    return errorResponse(res, 413, 'PAYLOAD_TOO_LARGE', `El request no puede exceder ${MAX_PUSH_REQUEST_BYTES} bytes.`);
  }

  const validated = validatePushRequestBody(body);
  if (!validated.ok) return errorResponse(res, 400, validated.code, validated.message);

  const limit = rateLimit(auth.user?.id);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    return errorResponse(res, 429, 'RATE_LIMITED', 'Demasiados intentos de notificación. Intenta nuevamente más tarde.');
  }

  // Fail closed: el código y el esquema suministrados no demuestran todavía
  // dónde se guardan las PushSubscription ni cómo validar su pertenencia al
  // destinatario. No aceptamos subscriptions arbitrarias desde el navegador.
  console.warn('[send-push] Entrega suspendida: falta resolver el almacén verificado de subscriptions.', {
    actor: auth.user?.id || null,
    target: validated.value.username
  });
  return errorResponse(
    res,
    503,
    'PUSH_SUBSCRIPTION_RESOLVER_NOT_CONFIGURED',
    'La entrega Push está deshabilitada hasta configurar el resolver verificado de subscriptions por usuario.'
  );
}
