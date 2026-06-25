import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const imageUrl = req.query.url as string;
  if (!imageUrl) return res.status(400).send("URL is required");

  try {
    const response = await fetch(imageUrl, {
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
