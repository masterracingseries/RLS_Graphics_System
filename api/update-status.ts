import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";
import { verifyToken } from "./auth.js";
import * as fs from "fs";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  return JSON.parse(fs.readFileSync("./google-credentials.json", "utf-8"));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });

  const { valid, role } = verifyToken(token);
  if (!valid || role !== "admin") return res.status(401).json({ error: "No autorizado" });

  const { rowIndex, estado, caption } = req.body;
  if (!rowIndex || !estado) return res.status(400).json({ error: "Faltan datos" });

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getCredentials(),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const updates: any[] = [
      { range: `Hoja 1!M${rowIndex}`, values: [[estado]] },
    ];

    if (caption !== undefined) {
      updates.push({ range: `Hoja 1!L${rowIndex}`, values: [[caption]] });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
