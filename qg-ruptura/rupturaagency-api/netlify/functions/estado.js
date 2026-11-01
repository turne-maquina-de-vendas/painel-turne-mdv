// Estado do QG (arroba, nicho, cards) guardado no Netlify Blobs.
// GET /api/estado                        → 200 { estado: {...} | null, atualizadoEm: number }
// PUT /api/estado  body { estado, base } → 200 { ok: true, atualizadoEm, estado? } (estado volta só se algo dos agentes foi mantido)
import { lerEstado, atualizarEstado, mesclar } from '../../lib/estado.js';
import { lerSessao, json, naoAutorizado } from '../../lib/sessao.js';

const LIMITE = 4 * 1024 * 1024;

export default async (request) => {
  if (!lerSessao(request)) return naoAutorizado();

  if (request.method === 'GET') {
    const { salvo } = await lerEstado();
    return json({ estado: salvo?.estado ?? null, atualizadoEm: salvo?.atualizadoEm ?? 0 });
  }
  if (request.method === 'PUT') {
    const texto = await request.text();
    if (texto.length > LIMITE) return json({ erro: 'Estado grande demais.' }, 413);
    let corpo = {};
    try { corpo = JSON.parse(texto); } catch {}
    if (!corpo.estado || !Array.isArray(corpo.estado.cards)) return json({ erro: 'Dados inválidos.' }, 400);
    let mesclou = false;
    const dados = await atualizarEstado(atual => {
      const m = mesclar(atual, corpo.estado, corpo.base);
      mesclou = m.mesclou;
      return m.estado;
    });
    return json({ ok: true, atualizadoEm: dados.atualizadoEm, ...(mesclou ? { estado: dados.estado } : {}) });
  }
  return json({ erro: 'Método não permitido.' }, 405);
};

export const config = { path: '/api/estado' };
