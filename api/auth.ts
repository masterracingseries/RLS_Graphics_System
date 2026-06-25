import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

const PILOT_PASSWORD = process.env.PILOT_PASSWORD || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const AUTH_SECRET = process.env.AUTH_SECRET || "rls-fallback-secret";

export function generateToken(role: string): string {
  const payload = `${role}:${Date.now()}`;
  const sig = createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): { valid: boolean; role?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    const sig = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const [role, timestamp] = payload.split(":");

    const expectedSig = createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
    if (sig !== expectedSig) return { valid: false };

    const age = Date.now() - parseInt(timestamp);
    if (age > 7 * 24 * 60 * 60 * 1000) return { valid: false }; // 7 días

    return { valid: true, role };
  } catch {
    return { valid: false };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, role } = req.body;

  if (role === "pilot" && password === PILOT_PASSWORD) {
    return res.json({ token: generateToken("pilot"), role: "pilot" });
  }
  if (role === "admin" && password === ADMIN_PASSWORD) {
    return res.json({ token: generateToken("admin"), role: "admin" });
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
}
