import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import { requireAuthenticatedUser } from "./_auth.js";

export const config = { api: { bodyParser: false } };

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL } = process.env;
const OPERATION_CODE_RE = /^OP-\d+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
function firstValue(value) { return Array.isArray(value) ? value[0] : value; }
function clean(value) { return String(firstValue(value) ?? "").trim(); }
function parseMultipart(req) {
  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 35 * 1024 * 1024 });
  return new Promise((resolve, reject) => form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files })));
}
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function contentTypeToExt(contentType = "") {
  const ct = String(contentType).toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("heic")) return ".heic";
  if (ct.includes("mp4")) return ".mp4";
  if (ct.includes("webm")) return ".webm";
  if (ct.includes("quicktime")) return ".mov";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  return ".bin";
}
function bufferFromDataUrl(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] || "image/jpeg", ext: contentTypeToExt(match[1]) };
}
function safeSegment(value, fallback = "general") {
  const normalized = String(value || fallback).trim().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}
function makeSafeKey({ folder, stage, ext, filename }) {
  const safeFolder = safeSegment(folder);
  const safeStage = stage ? safeSegment(stage).toUpperCase() : '';
  const suppliedExt = path.extname(String(filename || "")).toLowerCase();
  const safeExt = String(suppliedExt || ext || ".bin").replace(/[^a-z0-9.]/gi, "") || ".bin";
  const base = safeStage ? `operaciones/${safeFolder}/${safeStage}` : `operaciones/${safeFolder}`;
  return `${base}/${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
}
function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
  });
}
function publicUrlFor(key) { return `${String(R2_PUBLIC_BASE_URL).replace(/\/+$/, "")}/${key}`; }
async function resolveOperation(client, reference) {
  const ref = clean(reference);
  if (!ref) return null;
  let response;
  if (UUID_RE.test(ref)) response = await client.from("reportes_operaciones").select("id,codigo,estado").eq("id", ref).maybeSingle();
  else response = await client.from("reportes_operaciones").select("id,codigo,estado").eq("codigo", ref).maybeSingle();
  if (response.error) throw new Error(`No se pudo validar la operación: ${response.error.message}`);
  return response.data || null;
}
async function registerOperationEvidence(auth, operation, metadata) {
  const { data, error } = await auth.client.rpc("rpc_operacion_registrar_evidencia_v2", {
    p_operacion: String(operation.id || operation.codigo),
    p_etapa: metadata.stage,
    p_bucket: R2_BUCKET,
    p_object_key: metadata.key,
    p_url_r2: metadata.url,
    p_nombre_archivo: metadata.originalName,
    p_mime_type: metadata.contentType,
    p_tamano_bytes: metadata.bytes,
    p_comentario: metadata.description || null,
    p_incidencia_id: UUID_RE.test(metadata.incidentId) ? metadata.incidentId : null,
    p_metadata: { origen: metadata.source || "r2-upload", codigo: operation.codigo || null, reconciliado: false },
    p_storage_provider: "CLOUDFLARE_R2"
  });
  if (error) throw new Error(`Supabase no registró operacion_evidencias: ${error.message}`);
  const evidence = Array.isArray(data) ? data[0] : data;
  if (!evidence) throw new Error("Supabase no devolvió confirmación de operacion_evidencias.");
  return evidence;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method Not Allowed. El API R2 solo acepta POST." });

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { ok: false, message: auth.message });

  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET) missing.push("R2_BUCKET");
  if (!R2_PUBLIC_BASE_URL) missing.push("R2_PUBLIC_BASE_URL");
  if (missing.length) return sendJson(res, 500, { ok: false, message: "Faltan variables R2 en Vercel", missing });

  let key = "";
  let r2 = null;
  try {
    const header = String(req.headers["content-type"] || "").toLowerCase();
    let buffer = null;
    let fileContentType = "image/jpeg";
    let ext = ".jpg";
    let originalName = "evidencia.jpg";
    let operationReference = "";
    let requestedFolder = "";
    let stage = "";
    let source = "";
    let description = "";
    let incidentId = "";

    if (header.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);
      const uploadedFile = firstValue(files.file) || firstValue(files.foto) || firstValue(files.evidencia) || firstValue(files.imagen) || firstValue(files.image) || firstValue(files.photo) || firstValue(files.archivo) || firstValue(Object.values(files)[0]);
      if (!uploadedFile) return sendJson(res, 400, { ok: false, message: "No se recibió archivo multipart.", recibidos: { fields: Object.keys(fields || {}), files: Object.keys(files || {}) } });
      operationReference = clean(fields.operacion_id) || clean(fields.reporte_id) || clean(fields.codigo) || clean(fields.id);
      requestedFolder = clean(fields.folder) || operationReference;
      stage = clean(fields.etapa).toUpperCase();
      source = clean(fields.origen);
      description = clean(fields.descripcion) || clean(fields.comentario);
      incidentId = clean(fields.incidencia_id);
      originalName = uploadedFile.originalFilename || uploadedFile.newFilename || originalName;
      ext = path.extname(originalName).toLowerCase() || contentTypeToExt(uploadedFile.mimetype);
      fileContentType = uploadedFile.mimetype || "application/octet-stream";
      buffer = fs.readFileSync(uploadedFile.filepath);
    } else {
      const raw = await readRawBody(req);
      let json = null;
      try { json = JSON.parse(raw.toString("utf8") || "{}"); } catch { json = null; }
      if (json) {
        operationReference = clean(json.operacion_id) || clean(json.reporte_id) || clean(json.codigo) || clean(json.id);
        requestedFolder = clean(json.folder) || operationReference;
        stage = clean(json.etapa).toUpperCase();
        source = clean(json.origen);
        description = clean(json.descripcion) || clean(json.comentario);
        incidentId = clean(json.incidencia_id);
        originalName = clean(json.filename) || originalName;
        const possibleImage = json.file || json.foto || json.evidencia || json.imagen || json.image || json.photo || json.base64 || json.dataUrl || json.url;
        const parsed = bufferFromDataUrl(possibleImage);
        if (parsed) { buffer = parsed.buffer; fileContentType = parsed.contentType; ext = parsed.ext; }
        else if (typeof possibleImage === "string" && possibleImage.length > 100) {
          buffer = Buffer.from(possibleImage.includes(",") ? possibleImage.split(",").pop() : possibleImage, "base64");
          fileContentType = json.contentType || json.mimeType || "image/jpeg";
          ext = path.extname(originalName) || json.ext || contentTypeToExt(fileContentType);
        }
      } else if (raw.length) {
        buffer = raw;
        fileContentType = req.headers["content-type"] || "application/octet-stream";
        ext = contentTypeToExt(fileContentType);
      }
    }

    if (!buffer?.length) return sendJson(res, 400, { ok: false, message: "No se pudo detectar archivo en el request.", contentType: header });
    if (buffer.length > 35 * 1024 * 1024) return sendJson(res, 413, { ok: false, message: "El archivo supera el límite de 35 MB." });

    const allowedTypes = new Set(["image/jpeg","image/jpg","image/png","image/webp","image/gif","image/heic","video/mp4","video/webm","video/quicktime"]);
    const normalizedType = String(fileContentType || "").toLowerCase().split(";")[0].trim();
    if (!allowedTypes.has(normalizedType)) return sendJson(res, 415, { ok: false, message: "Tipo de archivo no permitido." });

    // Solo los códigos/UUID de Operaciones exigen la relación canónica operacion_evidencias.
    // Otros consumidores del mismo endpoint (p.ej. Control técnico) siguen guardando su URL en su propia tabla.
    const operationIntent = Boolean(operationReference && (OPERATION_CODE_RE.test(operationReference) || UUID_RE.test(operationReference)));
    let operation = null;
    if (operationIntent) {
      operation = await resolveOperation(auth.client, operationReference);
      if (!operation) return sendJson(res, 404, { ok: false, message: `La operación ${operationReference} no existe o no es visible para el usuario autenticado.` });
    }

    const canonicalFolder = operation ? (operation.codigo || operation.id) : (requestedFolder || operationReference || "general");
    const finalStage = operation ? (stage || "REPORTE") : '';
    key = makeSafeKey({ folder: canonicalFolder, stage: finalStage, ext, filename: originalName });
    r2 = createR2Client();
    await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: fileContentType || "application/octet-stream" }));
    const publicUrl = publicUrlFor(key);

    let evidence = null;
    if (operation) {
      try {
        evidence = await registerOperationEvidence(auth, operation, {
          stage: finalStage, key, url: publicUrl, originalName, contentType: normalizedType,
          bytes: buffer.length, description, incidentId, source
        });
      } catch (metadataError) {
        let rolledBack = false;
        let rollbackError = "";
        try { await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })); rolledBack = true; }
        catch (error) { rollbackError = error?.message || String(error); }
        return sendJson(res, 500, {
          ok: false,
          phase: "metadata",
          message: metadataError.message,
          rolledBack,
          orphaned: !rolledBack,
          object_key: !rolledBack ? key : undefined,
          rollback_error: rollbackError || undefined
        });
      }
    }

    return sendJson(res, 200, { ok: true, url: publicUrl, publicUrl, r2_url: publicUrl, key, bucket: R2_BUCKET, evidencia: evidence });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: "Error procesando archivo R2", error: error?.message || String(error), object_key: key || undefined });
  }
}
