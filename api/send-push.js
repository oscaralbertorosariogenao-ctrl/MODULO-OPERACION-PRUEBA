import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id")
      .limit(1);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "supabase-query",
        error: error.message
      });
    }

    return res.status(200).json({
      ok: true,
      step: "supabase-ok",
      rows: data?.length || 0
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      step: "handler-crash",
      error: err.message
    });
  }
}
