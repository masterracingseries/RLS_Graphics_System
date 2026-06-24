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
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });

  const { valid, role } = verifyToken(token);
  if (!valid || role !== "admin") return res.status(401).json({ error: "No autorizado" });

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: getCredentials(),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Hoja 1!A:N",
    });

    const rows = response.data.values || [];
    const data = rows.slice(1).map((row, index) => ({
      rowIndex: index + 2,
      fecha: row[0] || "",
      realName: row[1] || "",
      nickname: row[2] || "",
      instagram: row[3] || "",
      league: row[4] || "",
      division: row[5] || "",
      teamName: row[6] || "",
      circuitName: row[7] || "",
      qualifying: row[8] || "",
      race: row[9] || "",
      imageUrl: row[10] || "",
      caption: row[11] || "",
      estado: row[12] || "",
      template: row[13] || "",
    }));

    const status = req.query.status as string;
    const filtered = status ? data.filter((r) => r.estado === status) : data;

    res.json({ submissions: filtered.reverse() }); // más recientes primero
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
