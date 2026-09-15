import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Dominios que este proxy puede descargar.
 *
 * Sin esta lista el endpoint acepta cualquier URL, y cualquiera puede usar
 * el deploy como proxy abierto (ancho de banda ajeno, enmascarar pedidos).
 *
 * Si agregas un origen nuevo de imágenes, súmalo acá.
 */
const ALLOWED_HOSTS = new Set([
  "raw.githubusercontent.com", // logos, autos y fondos (ver GITHUB_BASE en src/App.tsx)
  "images.unsplash.com",       // fondo de respaldo cuando falla el del circuito
  "storage.googleapis.com",    // gráficas ya generadas
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send("URL is required");

  // Comparamos contra el hostname ya parseado, nunca con includes() sobre el
  // string: "https://malicioso.com/?x=raw.githubusercontent.com" pasaría.
  let target: URL;
  try {
    target = new URL(imageUrl);
  } catch {
    return res.status(400).send("URL inválida");
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return res.status(400).send("Protocolo no permitido");
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    console.warn(`[proxy-image] Dominio bloqueado: ${target.hostname}`);
    return res.status(403).send("Dominio no permitido");
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) return res.status(response.status).send("Failed to fetch image");

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Error proxying image");
  }
}
