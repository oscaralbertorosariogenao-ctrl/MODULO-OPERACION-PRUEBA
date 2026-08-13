export const MAX_PUSH_REQUEST_BYTES = 4096;
export const MAX_PUSH_TITLE_LENGTH = 120;
export const MAX_PUSH_BODY_LENGTH = 500;
export const MAX_PUSH_URL_LENGTH = 512;

function cleanText(value, maxLength) {
  const text = String(value ?? '').trim();
  return text.length <= maxLength ? text : null;
}

export function validatePushRequestBody(body) {
  const allowed = new Set(['username', 'title', 'body', 'url']);
  const unknown = Object.keys(body || {}).filter(key => !allowed.has(key));
  if (unknown.length) return { ok: false, code: 'UNSUPPORTED_FIELDS', message: 'El request contiene campos no soportados.' };

  const username = cleanText(body?.username, 80);
  const title = cleanText(body?.title, MAX_PUSH_TITLE_LENGTH);
  const message = cleanText(body?.body, MAX_PUSH_BODY_LENGTH);
  const url = cleanText(body?.url || '/app.html', MAX_PUSH_URL_LENGTH);

  if (!username || !/^[a-z0-9._-]+$/i.test(username)) {
    return { ok: false, code: 'INVALID_USERNAME', message: 'username es requerido y contiene un formato inválido.' };
  }
  if (!title) return { ok: false, code: 'INVALID_TITLE', message: `title es requerido y admite hasta ${MAX_PUSH_TITLE_LENGTH} caracteres.` };
  if (!message) return { ok: false, code: 'INVALID_BODY', message: `body es requerido y admite hasta ${MAX_PUSH_BODY_LENGTH} caracteres.` };
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return { ok: false, code: 'INVALID_URL', message: 'url debe ser una ruta interna que comience con /.' };
  }

  return { ok: true, value: { username: username.toLowerCase(), title, body: message, url } };
}
