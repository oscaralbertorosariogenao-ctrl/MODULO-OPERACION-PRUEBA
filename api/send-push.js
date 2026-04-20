import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  try {
    const {
      username,
      role,
      title,
      body,
      url,
      tag,
      operationId,
      type
    } = req.body || {};

    let query = supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true);

    if (username) {
      query = query.eq("username", String(username).trim().toLowerCase());
    }

    if (role) {
      query = query.eq("role", String(role).trim().toLowerCase());
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        message: "No hay suscripciones activas"
      });
    }

    const payload = JSON.stringify({
      title: title || "LOTEKA Operaciones",
      body: body || "Nueva notificacion",
      url: url || "/app-reportes.html",
      tag: tag || "loteka-general",
      operationId: operationId || null,
      type: type || "general",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg"
    });

    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        sent++;
      } catch (err) {
        console.error("Error enviando push:", err.message);
      }
    }

    return res.status(200).json({
      ok: true,
      sent
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Error interno"
    });
  }
}
