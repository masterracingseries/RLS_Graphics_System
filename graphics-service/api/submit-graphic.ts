import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import { verifyToken } from "./auth.js";
import { generateCaption } from "./gemini.js";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const GCS_BUCKET = process.env.GCS_BUCKET || "rls-graphics-uploads";

// Sube imagen a GCS + posible fallback de Gemini; le damos aire (Hobby permite hasta 60s).
export const maxDuration = 30;

function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  return JSON.parse(fs.readFileSync("./google-credentials.json", "utf-8"));
}

async function uploadToGCS(imageBase64: string, fileName: string): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const storage = new Storage({ credentials: getCredentials() });
  const bucket = storage.bucket(GCS_BUCKET);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    contentType: "image/jpeg",
    metadata: { cacheControl: "public, max-age=2592000" },
  });

  return `https://storage.googleapis.com/${GCS_BUCKET}/${fileName}`;
}

async function appendToSheet(rowData: string[]) {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Hoja 1!A:N",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });
  const { valid, role } = verifyToken(token);
  if (!valid || (role !== "pilot" && role !== "admin")) return res.status(401).json({ error: "No autorizado" });

  try {
    const { imageBase64, pilotData, caption: providedCaption } = req.body;

    if (!imageBase64 || !pilotData) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    const fecha = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
    const fileName = `RLS_${pilotData.nickname}_${Date.now()}.jpg`;

    const [imageUrl, caption] = await Promise.all([
      uploadToGCS(imageBase64, fileName),
      providedCaption ? Promise.resolve(providedCaption as string) : generateCaption(pilotData),
    ]);

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
      caption,
      "PENDIENTE",
      pilotData.template || "protagonista",
    ]);

    res.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("Error en submit-graphic:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}
