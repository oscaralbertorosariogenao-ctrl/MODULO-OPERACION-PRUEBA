export default async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
    ok: true,
    message: "API LOTEKA activo en Vercel",
    time: new Date().toISOString()
  }));
}
