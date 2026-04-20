import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        step: "alive"
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
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

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, username, endpoint, is_active")
      .eq("is_active", true)
      .eq("username", username);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase-error",
        error: error.message
      });
    }

    return res.status(200).json({
      ok: true,
      step: "supabase-ok",
      found: data?.length || 0,
      rows: data || []
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "crash",
      error: err.message || "error interno"
    });
  }
}
