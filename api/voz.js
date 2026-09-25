/**
 * Vercel — /api/voz
 *
 * Voz do RICA (IA do Grupo R1) pela ElevenLabs, sem expor a chave no navegador.
 *
 *   POST /api/voz { texto }  -> audio/mpeg
 *
 * A chave fica só aqui no servidor. Precisa da env ELEVENLABS_API_KEY.
 * ELEVENLABS_VOICE_ID é opcional (padrão: a voz do Ricardinho interno).
 *
 * Só atende chamadas vindas da lp.grupor1.com, para ninguém de fora gastar
 * os créditos da conta. Texto limitado a 1.000 caracteres por pedido.
 */

const ORIGENS = ["https://lp.grupor1.com"];
const VOZ_PADRAO = "uN7bwBTrJ4H2a9hhd4LC";
const MAX_CHARS = 1000;

export default async function handler(req, res) {
  const origem = req.headers.origin || "";
  const permitida = ORIGENS.includes(origem);

  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  if (permitida) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") return res.status(permitida ? 204 : 403).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });
  if (!permitida) return res.status(403).json({ erro: "origem não autorizada" });

  const chave = String(process.env.ELEVENLABS_API_KEY || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!chave) return res.status(500).json({ erro: "ELEVENLABS_API_KEY não configurada na Vercel" });

  let corpo = req.body;
  if (typeof corpo === "string") {
    try { corpo = JSON.parse(corpo); } catch { corpo = {}; }
  }
  const texto = String((corpo && corpo.texto) || "").trim().slice(0, MAX_CHARS);
  if (!texto) return res.status(400).json({ erro: "texto vazio" });

  const voz = process.env.ELEVENLABS_VOICE_ID || VOZ_PADRAO;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
      method: "POST",
      headers: { "xi-api-key": chave, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: texto,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const detalhe = await r.text();
      return res.status(r.status).json({ erro: "ElevenLabs recusou", detalhe: detalhe.slice(0, 300) });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    return res.status(200).send(audio);
  } catch (e) {
    return res.status(500).json({ erro: String(e) });
  }
}
