import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false
  }
};

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL
} = process.env;

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseMultipart(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 35 * 1024 * 1024
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bufferFromDataUrl(value) {
  if (!value || typeof value !== "string") return null;

  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  return {
    buffer: Buffer.from(match[2], "base64"),
    contentType: match[1] || "image/jpeg",
    ext: contentTypeToExt(match[1])
  };
}

function contentTypeToExt(contentType = "") {
  const ct = String(contentType).toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("heic")) return ".heic";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  return ".jpg";
}

function makeSafeKey({ folder = "general", ext = ".jpg" }) {
  const safeFolder = String(folder || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = String(ext || ".jpg").replace(/[^a-z0-9.]/gi, "") || ".jpg";
  return `operaciones/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`;
}

async function uploadToR2({ buffer, contentType, key }) {
  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream"
    })
  );

  const baseUrl = String(R2_PUBLIC_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}/${key}`;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 405, {
      ok: false,
      message: "Method Not Allowed. El API R2 existe y solo acepta POST con foto."
    });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      message: "Method Not Allowed"
    });
  }

  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET) missing.push("R2_BUCKET");
  if (!R2_PUBLIC_BASE_URL) missing.push("R2_PUBLIC_BASE_URL");

  if (missing.length) {
    return sendJson(res, 500, {
      ok: false,
      message: "Faltan variables R2 en Vercel",
      missing
    });
  }

  try {
    const contentTypeHeader = String(req.headers["content-type"] || "").toLowerCase();

    let buffer = null;
    let fileContentType = "image/jpeg";
    let ext = ".jpg";
    let folder = "general";

    if (contentTypeHeader.includes("multipart/form-data")) {
      const { fields, files } = await parseMultipart(req);

      const uploadedFile =
        firstValue(files.file) ||
        firstValue(files.foto) ||
        firstValue(files.evidencia) ||
        firstValue(files.imagen) ||
        firstValue(files.image) ||
        firstValue(files.photo) ||
        firstValue(files.archivo) ||
        firstValue(Object.values(files)[0]);

      folder =
        firstValue(fields.reporte_id) ||
        firstValue(fields.operacion_id) ||
        firstValue(fields.codigo) ||
        firstValue(fields.id) ||
        "general";

      if (!uploadedFile) {
        return sendJson(res, 400, {
          ok: false,
          message: "No se recibió archivo multipart.",
          recibidos: {
            fields: Object.keys(fields || {}),
            files: Object.keys(files || {})
          }
        });
      }

      const originalName = uploadedFile.originalFilename || uploadedFile.newFilename || "evidencia.jpg";
      ext = path.extname(originalName).toLowerCase() || contentTypeToExt(uploadedFile.mimetype);
      fileContentType = uploadedFile.mimetype || "application/octet-stream";
      buffer = fs.readFileSync(uploadedFile.filepath);
    } else {
      const raw = await readRawBody(req);
      const rawText = raw.toString("utf8");

      let json = null;
      try {
        json = JSON.parse(rawText || "{}");
      } catch {
        json = null;
      }

      if (json) {
        folder = json.reporte_id || json.operacion_id || json.codigo || json.id || "general";

        const possibleImage =
          json.file ||
          json.foto ||
          json.evidencia ||
          json.imagen ||
          json.image ||
          json.photo ||
          json.base64 ||
          json.dataUrl ||
          json.url;

        const parsedDataUrl = bufferFromDataUrl(possibleImage);

        if (parsedDataUrl) {
          buffer = parsedDataUrl.buffer;
          fileContentType = parsedDataUrl.contentType;
          ext = parsedDataUrl.ext;
        } else if (typeof possibleImage === "string" && possibleImage.length > 100) {
          const cleaned = possibleImage.includes(",") ? possibleImage.split(",").pop() : possibleImage;
          buffer = Buffer.from(cleaned, "base64");
          fileContentType = json.contentType || json.mimeType || "image/jpeg";
          ext = json.ext || contentTypeToExt(fileContentType);
        }
      } else if (raw.length > 0) {
        buffer = raw;
        fileContentType = req.headers["content-type"] || "application/octet-stream";
        ext = contentTypeToExt(fileContentType);
      }
    }

    if (!buffer || !buffer.length) {
      return sendJson(res, 400, {
        ok: false,
        message: "No se pudo detectar imagen en el request.",
        contentType: contentTypeHeader
      });
    }

    const key = makeSafeKey({ folder, ext });
    const publicUrl = await uploadToR2({
      buffer,
      contentType: fileContentType,
      key
    });

    return sendJson(res, 200, {
      ok: true,
      url: publicUrl,
      publicUrl,
      r2_url: publicUrl,
      key,
      bucket: R2_BUCKET
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: "Error subiendo archivo a R2",
      error: error.message || String(error)
    });
  }
}
