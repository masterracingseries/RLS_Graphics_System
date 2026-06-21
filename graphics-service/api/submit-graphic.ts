import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const GCS_BUCKET = process.env.GCS_BUCKET || "rls-graphics-uploads";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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

async function generateCaption(pilotData: any): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  try {
    const prompt = `Eres el community manager de RLS (Racing Latam Sport), un equipo de F1 simracing.
Generá un caption para Instagram sobre el resultado de carrera de un piloto.
Datos: Piloto: ${pilotData.nickname} (${pilotData.realName}), Equipo: ${pilotData.teamName},
Circuito: ${pilotData.circuitName}, Clasificación: ${pilotData.qualifying}, Carrera: ${pilotData.race}.
Instagram del piloto: ${pilotData.instagram ? "@" + pilotData.instagram.replace("@", "") : "no disponible"}.
Escribí en español, máximo 150 palabras, incluí emojis y hashtags relevantes de simracing y F1.
Hacelo dinámico y emocionante, acorde al resultado (si fue bueno celebrá, si fue malo motivá).`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) return "";
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch {
    return "";
  }
}

async function appendToSheet(rowData: string[]) {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Hoja 1!A:M",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowData] },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageBase64, pilotData } = req.body;

    if (!imageBase64 || !pilotData) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    const fecha = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
    const fileName = `RLS_${pilotData.nickname}_${Date.now()}.jpg`;

    const [imageUrl, caption] = await Promise.all([
      uploadToGCS(imageBase64, fileName),
      generateCaption(pilotData),
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
    ]);

    res.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("Error en submit-graphic:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}
