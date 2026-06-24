import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || "./google-credentials.json";
const GCS_BUCKET = process.env.GCS_BUCKET || "rls-graphics-uploads";

function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
}

function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

function getStorage() {
  return new Storage({ credentials: getCredentials() });
}

async function uploadToGCS(imageBase64: string, fileName: string): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const storage = getStorage();
  const bucket = storage.bucket(GCS_BUCKET);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    contentType: "image/jpeg",
    metadata: { cacheControl: "public, max-age=2592000" },
  });

  return `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
}

async function appendToSheet(rowData: string[]) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Hoja 1!A:N",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });
}

async function ensureSheetHeaders() {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Hoja 1!A1:N1",
  });

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "Hoja 1!A1:N1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          "Fecha", "Nombre Piloto", "ID Piloto", "Instagram",
          "Liga", "División", "Escudería", "Circuito",
          "Clasificación", "Carrera", "Imagen", "Caption", "Estado", "Template"
        ]],
      },
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "20mb" }));

  ensureSheetHeaders().catch(err =>
    console.error("Error inicializando Sheet headers:", err)
  );

  // ── SUBMIT GRAPHIC ──
  app.post("/api/submit-graphic", async (req, res) => {
    try {
      const { imageBase64, pilotData } = req.body;

      if (!imageBase64 || !pilotData) {
        return res.status(400).json({ error: "Faltan datos requeridos" });
      }

      const fecha = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
      const fileName = `RLS_${pilotData.nickname}_${Date.now()}.jpg`;

      console.log(`☁️  Subiendo gráfica de ${pilotData.realName} a GCS...`);
      const imageUrl = await uploadToGCS(imageBase64, fileName);
      console.log(`✅ Subida: ${imageUrl}`);

      await appendToSheet([
        fecha,
        pilotData.realName,
        pilotData.nickname,
        pilotData.instagram || "",
        pilotData.league,
        pilotData.division,
        pilotData.teamName,
        pilotData.circuitName,
        pilotData.qualifying,
        pilotData.race,
        imageUrl,
        "",
        "PENDIENTE",
        pilotData.template || "protagonista",
      ]);

      console.log(`📋 Sheet actualizada para ${pilotData.realName}`);
      res.json({ success: true, imageUrl });

    } catch (error: any) {
      console.error("Error en submit-graphic:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // ── PROXY DE IMÁGENES ──
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL is required");

    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        }
      });

      if (!response.ok) {
        const retry = await fetch(imageUrl);
        if (!retry.ok) return res.status(retry.status).send("Failed to fetch image");
        const ct = retry.headers.get("content-type");
        if (ct) res.setHeader("Content-Type", ct);
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.send(Buffer.from(await retry.arrayBuffer()));
      }

      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(Buffer.from(await response.arrayBuffer()));

    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Error proxying image");
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
