import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://tnymrjxdhzdmpcbilftj.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueW1yanhkaHpkbXBjYmlsZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjEwOTksImV4cCI6MjA5MzgzNzA5OX0.YXG9juChbJUUdsdy01Qkoh9X0-MijewD5aQbKnG9Itk";

function readBearerToken(req) {
  const raw = String(req.headers.authorization || "").trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function requireAuthenticatedUser(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: "Sesión requerida." };
  }

  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, message: "Sesión inválida o vencida." };
  }

  return { ok: true, user: data.user, token, client };
}
