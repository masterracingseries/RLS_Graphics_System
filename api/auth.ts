import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

const PILOT_PASSWORD = process.env.PILOT_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const AUTH_SECRET = process.env.AUTH_SECRET;

// Antes esto era `process.env.AUTH_SECRET || "rls-fallback-secret"`. Con el
// repositorio público ese valor por defecto sería conocido, y cualquiera
// podría firmar un token de admin válido. Preferimos que el endpoint falle
// a que quede abierto con un secreto que está a la vista.
if (!AUTH_SECRET) {
  throw new Error(
    "Falta la variable de entorno AUTH_SECRET: sin ella los tokens de sesión " +
    "no pueden firmarse de forma segura. Configúrala antes de desplegar (ver README)."
  );
}

export function generateToken(role: string): string {
  const payload = `${role}:${Date.now()}`;
  const sig = createHmac("sha256", AUTH_SECRET!).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): { valid: boolean; role?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const lastColon = decoded.lastIndexOf(":");
    const sig = decoded.slice(lastColon + 1);
    const payload = decoded.slice(0, lastColon);
    const [role, timestamp] = payload.split(":");

    const expectedSig = createHmac("sha256", AUTH_SECRET!).update(payload).digest("hex");
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

  // Si la contraseña de un rol no está configurada, ese rol queda deshabilitado.
  // Antes el valor por defecto era "", así que enviar password:"" alcanzaba
  // para obtener un token válido.
  if (role === "pilot") {
    if (!PILOT_PASSWORD) {
      console.error("[auth] Falta PILOT_PASSWORD: el login de pilotos está deshabilitado.");
      return res.status(503).json({ error: "Login de pilotos no configurado" });
    }
    if (password === PILOT_PASSWORD) {
      return res.json({ token: generateToken("pilot"), role: "pilot" });
    }
  }

  if (role === "admin") {
    if (!ADMIN_PASSWORD) {
      console.error("[auth] Falta ADMIN_PASSWORD: el login de admin está deshabilitado.");
      return res.status(503).json({ error: "Login de admin no configurado" });
    }
    if (password === ADMIN_PASSWORD) {
      return res.json({ token: generateToken("admin"), role: "admin" });
    }
  }

  return res.status(401).json({ error: "Contraseña incorrecta" });
}
