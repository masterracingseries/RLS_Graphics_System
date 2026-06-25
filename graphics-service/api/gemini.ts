const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export interface CaptionPilotData {
  nickname?: string;
  realName?: string;
  teamName?: string;
  league?: string;
  division?: string;
  circuitName?: string;
  qualifying?: string;
  race?: string;
  instagram?: string;
}

export function buildCaptionPrompt(p: CaptionPilotData): string {
  const ig = p.instagram ? "@" + p.instagram.replace("@", "") : "no disponible";
  return `Eres el community manager de RLS (Racing Latam Sport), un equipo de F1 simracing.
Generá un caption para Instagram sobre el resultado de carrera de un piloto.

DATOS DEL PILOTO (usalos EXACTAMENTE como están, no inventes ni dejes campos sin completar):
- Nombre real: ${p.realName || "—"}
- Nick / Id: ${p.nickname || "—"}
- Escudería: ${p.teamName || "—"}
- Liga / Torneo: ${p.league || "—"}
- División: ${p.division || "—"}
- Circuito: ${p.circuitName || "—"}
- Clasificación: ${p.qualifying || "—"}
- Resultado de carrera: ${p.race || "—"}
- Instagram del piloto: ${ig}

REGLAS IMPORTANTES:
- Escribí en español, máximo 150 palabras.
- Usá los datos reales de arriba. NUNCA escribas placeholders, corchetes ni texto como "[Nombre Piloto]". Si algún dato es "—", simplemente omitilo, no lo menciones.
- Mencioná al piloto, la escudería, la liga, el circuito y el resultado.
- Incluí emojis y hashtags relevantes de simracing y F1.
- Hacelo dinámico y emocionante, acorde al resultado (si fue bueno celebrá, si fue malo motivá).
- Devolvé SOLO el caption, sin títulos ni explicaciones.`;
}

async function callGemini(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      console.error(`[Gemini] HTTP ${response.status}:`, await response.text());
      return "";
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) console.error("[Gemini] Respuesta vacía:", JSON.stringify(data));
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateCaption(pilotData: CaptionPilotData): Promise<string> {
  if (!GEMINI_API_KEY) return "";
  const prompt = buildCaptionPrompt(pilotData);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini(prompt);
      if (text) return text;
      if (attempt < 2) {
        console.warn(`[Gemini] Intento ${attempt} sin resultado, reintentando...`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`[Gemini] Error en intento ${attempt}:`, err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.error("[Gemini] Falló después de 2 intentos.");
  return "";
}
