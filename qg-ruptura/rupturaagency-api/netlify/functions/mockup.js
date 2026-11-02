// Imagens que o Designer gera no Magnific.
// POST /api/mockup?card=ID&peca=N  corpo: JPEG, PNG ou WebP cru → 200 { url }
// GET  /api/mockup?k=mockups/...   → a imagem
import { loja, atualizarEstado } from '../../lib/estado.js';
import { lerSessao, json, naoAutorizado } from '../../lib/sessao.js';

const LIMITE = 4 * 1024 * 1024; // a Vercel recusa corpo acima de 4,5 MB
const TIPOS = { 255: ['image/jpeg', 'jpg'], 137: ['image/png', 'png'], 82: ['image/webp', 'webp'] };

export default async (request) => {
  if (!lerSessao(request)) return naoAutorizado();
  const u = new URL(request.url);

  if (request.method === 'GET') {
    const k = u.searchParams.get('k') || '';
    if (!/^mockups\/[\w.-]+$/.test(k)) return json({ erro: 'Não encontrado.' }, 404);
    const r = await loja().getWithMetadata(k, { type: 'arrayBuffer' });
    if (!r) return json({ erro: 'Não encontrado.' }, 404);
    return new Response(r.data, { headers: { 'Content-Type': r.metadata?.tipo || 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
  }
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const card = u.searchParams.get('card') || '', peca = Number(u.searchParams.get('peca'));
  if (!/^[\w-]+$/.test(card) || !Number.isInteger(peca) || peca < 0) return json({ erro: 'Pedido inválido.' }, 400);
  const dados = await request.arrayBuffer();
  if (dados.byteLength > LIMITE) return json({ erro: 'A imagem passa de 4 MB.' }, 413);
  const tipo = TIPOS[new Uint8Array(dados)[0]];
  if (!tipo) return json({ erro: 'Envie JPG, PNG ou WebP.' }, 415);

  const chave = `mockups/${card}-${peca}-${Date.now().toString(36)}.${tipo[1]}`;
  await loja().set(chave, dados, { metadata: { tipo: tipo[0] } });
  const url = '/api/mockup?k=' + encodeURIComponent(chave).replace('%2F', '/');
  let achou = false;
  await atualizarEstado(estado => {
    const p = estado?.cards?.find(c => c.id === card)?.design?.pecas?.[peca];
    if (!p) return null;
    p.img = url; achou = true;
    estado.cards.find(c => c.id === card).agenteEm = Date.now();
    return estado;
  });
  if (!achou) return json({ erro: 'Peça não encontrada.' }, 404);
  return json({ ok: true, url });
};

export const config = { path: '/api/mockup' };
