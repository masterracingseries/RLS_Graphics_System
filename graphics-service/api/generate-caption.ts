import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "./auth.js";
import { generateCaption } from "./gemini.js";

// Vercel: damos margen para los 2 intentos a Gemini (el plan Hobby permite hasta 60s).
export const maxDuration = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No autorizado" });
  const { valid, role } = verifyToken(token);
  if (!valid || (role !== "pilot" && role !== "admin")) return res.status(401).json({ error: "No autorizado" });

  const { pilotData } = req.body;
  if (!pilotData) return res.status(400).json({ error: "Faltan datos" });

  const caption = await generateCaption(pilotData);
  return res.json({ caption });
}
