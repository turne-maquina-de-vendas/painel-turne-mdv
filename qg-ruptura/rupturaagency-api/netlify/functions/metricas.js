// Números do perfil para o painel da parede. Quem atualiza é a rotina diária que lê o Windsor.ai.
// GET /api/metricas                                → 200 { metricas: {...} | null }
// PUT /api/metricas body { perfil, dias, seg, posts } → 200 { ok: true, em }
import { loja } from '../../lib/estado.js';
import { lerSessao, json, naoAutorizado } from '../../lib/sessao.js';

const CHAVE = 'metricas';
const LIMITE = 512 * 1024;

export default async (request) => {
  if (!lerSessao(request)) return naoAutorizado();
  if (request.method === 'GET') return json({ metricas: await loja().get(CHAVE, { type: 'json' }) });
  if (request.method !== 'PUT') return json({ erro: 'Método não permitido.' }, 405);

  const texto = await request.text();
  if (texto.length > LIMITE) return json({ erro: 'Dados grandes demais.' }, 413);
  let c = {};
  try { c = JSON.parse(texto); } catch {}
  const seguidores = Number(c.perfil?.followers_count);
  if (!Number.isFinite(seguidores) || seguidores <= 0 || !Array.isArray(c.dias) || !Array.isArray(c.seg) || !Array.isArray(c.posts)) return json({ erro: 'Dados inválidos.' }, 400);

  const antes = await loja().get(CHAVE, { type: 'json' });
  const em = Date.now();
  // Foto diária dos seguidores: o Windsor só guarda 30 dias, então o histórico fica aqui.
  const historico = { ...(antes?.historico || {}), [new Date(em - 3 * 3600e3).toISOString().slice(0, 10)]: seguidores };
  const metricas = { perfil: c.perfil, dias: c.dias, seg: c.seg, posts: c.posts, em, historico };
  await loja().setJSON(CHAVE, metricas);
  return json({ ok: true, em });
};

export const config = { path: '/api/metricas' };
