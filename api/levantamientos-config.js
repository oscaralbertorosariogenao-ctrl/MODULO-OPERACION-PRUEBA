function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export default function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
  const baseUrl = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const webhookPath = '/api/jotform-levantamientos';
  return sendJson(res, 200, {
    ok: true,
    version: '807.03',
    formId: process.env.JOTFORM_LEVANTAMIENTOS_FORM_ID || '',
    formUrl: process.env.JOTFORM_LEVANTAMIENTOS_FORM_URL || '',
    webhookPath,
    webhookUrl: baseUrl ? `https://${baseUrl}${webhookPath}` : webhookPath,
    automaticRouting: true,
    configured: Boolean(process.env.JOTFORM_LEVANTAMIENTOS_FORM_URL && process.env.JOTFORM_WEBHOOK_SECRET),
    r2Configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_BASE_URL)
  });
}
