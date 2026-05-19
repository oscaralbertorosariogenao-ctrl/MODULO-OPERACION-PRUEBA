import webpush from "web-push";

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      message: "send-push API activo. Usa POST para enviar notificaciones push."
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return sendJson(res, 500, {
      ok: false,
      message: "Faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en Vercel."
    });
  }

  try {
    webpush.setVapidDetails(
      "mailto:soporte@loteka.local",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const subscription = body.subscription;
    const payload = body.payload || {
      title: body.title || "LOTEKA",
      body: body.body || "Nueva notificación del sistema.",
      url: body.url || "/"
    };

    if (!subscription) {
      return sendJson(res, 400, {
        ok: false,
        message: "Falta subscription en el body."
      });
    }

    await webpush.sendNotification(subscription, JSON.stringify(payload));

    return sendJson(res, 200, {
      ok: true,
      message: "Notificación enviada."
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: "Error enviando notificación push.",
      error: error.message || String(error)
    });
  }
}
