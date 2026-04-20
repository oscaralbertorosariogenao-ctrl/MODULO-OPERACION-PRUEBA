import { createClient } from "@supabase/supabase-js";

export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "IMPORT OK",
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}
