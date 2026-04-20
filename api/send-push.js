import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo no permitido" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const username = String(body.username || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({
        ok: false,
        step: "missing-username"
      });
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, username, endpoint, p256dh, auth, is_active")
      .eq("is_active", true)
      .eq("username", username);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase-error",
        error: error.message
      });
    }

    if (!subs || subs.length === 0) {
      return res.status(200).json({
        ok: true,
        step: "no-subscriptions",
        sent: 0
      });
    }

    const payload = JSON.stringify({
      title: body.title || "LOTEKA",
      body: body.body || "Nueva notificación",
      url: body.url || "/app-reportes.html",
      tag: body.tag || "loteka-test",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg"
    });

    let sent = 0;
    const errors = [];

    for (const sub of subs) {
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
        errors.push({
          id: sub.id,
          message: err.message || "Push error",
          statusCode: err.statusCode || null
        });
      }
    }

    return res.status(200).json({
      ok: true,
      step: "push-attempted",
      found: subs.length,
      sent,
      errors
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "crash",
      error: err.message || "error interno"
    });
  }
}
