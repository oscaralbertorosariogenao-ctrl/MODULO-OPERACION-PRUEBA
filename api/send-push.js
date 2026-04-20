import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const rawBody =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const username = String(rawBody.username || "").trim().toLowerCase();

    const debug = {
      method: req.method,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasVapidPublic: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
      hasVapidSubject: !!process.env.VAPID_SUBJECT,
      username
    };

    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        step: "function-alive",
        debug
      });
    }

    if (!username) {
      return res.status(400).json({
        ok: false,
        error: "Falta username",
        debug
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true)
      .eq("username", username);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase-query",
        error: error.message,
        debug
      });
    }

    if (!subs || subs.length === 0) {
      return res.status(200).json({
        ok: true,
        step: "no-subscriptions",
        debug: {
          ...debug,
          subscriptionsFound: 0
        }
      });
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const firstSub = subs[0];

    const payload = JSON.stringify({
      title: rawBody.title || "PRUEBA LOTEKA",
      body: rawBody.body || "Prueba de notificación",
      url: rawBody.url || "/app-reportes.html",
      tag: "loteka-test",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg"
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: firstSub.endpoint,
          keys: {
            p256dh: firstSub.p256dh,
            auth: firstSub.auth
          }
        },
        payload
      );

      return res.status(200).json({
        ok: true,
        step: "push-sent",
        debug: {
          ...debug,
          subscriptionsFound: subs.length
        }
      });
    } catch (pushError) {
      return res.status(500).json({
        ok: false,
        step: "push-send",
        error: pushError.message || "Error enviando push",
        statusCode: pushError.statusCode || null,
        body: pushError.body || null,
        debug: {
          ...debug,
          subscriptionsFound: subs.length
        }
      });
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "handler-crash",
      error: err.message || "Error interno"
    });
  }
}
