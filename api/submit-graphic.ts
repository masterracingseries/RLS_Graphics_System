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

// Avisa por email que hay una gráfica nueva esperando aprobación.
// Usa Resend (https://resend.com) — necesita RESEND_API_KEY y NOTIFY_EMAIL
// como variables de entorno en Vercel. Si no están configuradas, no hace
// nada (no rompe el envío de la gráfica).
async function notifyNewSubmission(pilotData: any, imageUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !toEmail) return;

  try {
    const panelUrl = process.env.ADMIN_PANEL_URL || "";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "RLS Graphics <onboarding@resend.dev>",
        to: [toEmail],
        subject: `🏁 Nueva gráfica pendiente: ${pilotData.nickname || pilotData.realName}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 420px; margin: 0 auto;">
            <h2 style="margin-bottom: 4px;">Nueva gráfica para aprobar</h2>
            <p style="color: #666; margin-top: 0;">${pilotData.league} · ${pilotData.division}</p>
            <table style="width: 100%; font-size: 14px; margin: 16px 0;">
              <tr><td style="color:#888; padding: 2px 0;">Piloto</td><td><b>${pilotData.nickname}</b> (${pilotData.realName})</td></tr>
              <tr><td style="color:#888; padding: 2px 0;">Circuito</td><td>${pilotData.circuitName}</td></tr>
              ${pilotData.sprintQualifying || pilotData.sprintRace ? `
              <tr><td style="color:#888; padding: 2px 0;">Q Sprint</td><td>${pilotData.sprintQualifying || "—"}</td></tr>
              <tr><td style="color:#888; padding: 2px 0;">R Sprint</td><td>${pilotData.sprintRace || "—"}</td></tr>
              <tr><td style="color:#888; padding: 2px 0;">Q Carrera</td><td>${pilotData.qualifying}</td></tr>
              <tr><td style="color:#888; padding: 2px 0;">R Carrera</td><td>${pilotData.race}</td></tr>
              ` : `
              <tr><td style="color:#888; padding: 2px 0;">Quali</td><td>${pilotData.qualifying}</td></tr>
              <tr><td style="color:#888; padding: 2px 0;">Carrera</td><td>${pilotData.race}</td></tr>
              `}
            </table>
            <img src="${imageUrl}" alt="Gráfica" style="max-width: 100%; border-radius: 12px; display: block;" />
            ${panelUrl ? `<p style="margin-top: 20px;"><a href="${panelUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Ir al panel admin</a></p>` : ""}
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error("No se pudo enviar la notificación por email:", e);
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
    range: "Hoja 1!A:R",
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
    const { imageBase64, imageBase64Story, pilotData, caption: providedCaption } = req.body;

    if (!imageBase64 || !pilotData) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    const fecha = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
    const fileName = `RLS_${pilotData.nickname}_${Date.now()}.jpg`;
    const storyFileName = `RLS_${pilotData.nickname}_${Date.now()}_story.jpg`;

    const [imageUrl, imageUrlStory, caption] = await Promise.all([
      uploadToGCS(imageBase64, fileName),
      imageBase64Story ? uploadToGCS(imageBase64Story, storyFileName) : Promise.resolve(""),
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
      "", // columna O: publishType, se define recién al aprobar en el panel admin
      imageUrlStory, // columna P: versión 9:16 lista para publicar como Historia
      pilotData.sprintQualifying || "", // columna Q: clasificación del sprint (vacío si no hubo sprint)
      pilotData.sprintRace || "", // columna R: resultado del sprint (vacío si no hubo sprint)
    ]);

    // No bloquea la respuesta al piloto si el email falla o tarda.
    notifyNewSubmission(pilotData, imageUrl).catch(() => {});

    res.json({ success: true, imageUrl, imageUrlStory });
  } catch (error: any) {
    console.error("Error en submit-graphic:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}
