// GET  /api/agente → 200 { chave: boolean } (se os agentes estão ligados)
// POST /api/agente body { cardId, so? } ou { acao } → 202 { ok: true } | 409 já rodando | 503 sem chave
import { atualizarEstado } from '../../lib/estado.js';
import { disparar } from '../../lib/disparar.js';
import { lerSessao, json, naoAutorizado } from '../../lib/sessao.js';

const TRAVA = 16 * 60 * 1000; // a Function em segundo plano morre em 15 min
const ACOES = ['semana', 'analise', 'plano', 'olivetto', 'cobranca'];
const SO = ['ganchos', 'roteiro', 'legenda', 'design', 'plano', 'edicao'];
const QUEM_DO_PASSO = { ganchos: 'roteirista', roteiro: 'roteirista', legenda: 'social', design: 'designer', plano: 'estudio', edicao: 'editor' };
const QUEM_DA_ETAPA = { pauta: 'pesquisador', gancho: 'roteirista', design: 'designer', gravar: 'estudio', edicao: 'editor', postar: 'social' };

const ocupado = a => a?.status === 'rodando' && Date.now() - a.em < TRAVA;

export default async (request) => {
  if (!lerSessao(request)) return naoAutorizado();
  const chave = !!process.env.ANTHROPIC_API_KEY;
  if (request.method === 'GET') return json({ chave });
  if (request.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);
  if (!chave) return json({ erro: 'Falta a chave da API do Claude no servidor.' }, 503);

  let corpo = {};
  try { corpo = await request.json(); } catch {}
  const { cardId, so, acao } = corpo;
  if (cardId ? (so && !SO.includes(so)) : !ACOES.includes(acao)) return json({ erro: 'Pedido inválido.' }, 400);

  let resultado = 404;
  await atualizarEstado(estado => {
    if (!estado) return null;
    if (cardId) {
      const c = estado.cards.find(x => x.id === cardId);
      if (!c) { resultado = 404; return null; }
      if (ocupado(c.agente)) { resultado = 409; return null; }
      c.agente = { status: 'rodando', quem: QUEM_DO_PASSO[so] || QUEM_DA_ETAPA[c.etapa] || 'roteirista', faz: 'Na fila', em: Date.now() };
      c.agenteEm = Date.now();
    } else {
      if (ocupado(estado.agentes?.[acao])) { resultado = 409; return null; }
      estado.agentes = { ...(estado.agentes || {}), [acao]: { status: 'rodando', quem: acao === 'semana' ? 'pesquisador' : acao === 'cobranca' ? 'assistente' : 'social', faz: 'Na fila', em: Date.now() } };
    }
    resultado = 202;
    return estado;
  });
  if (resultado === 404) return json({ erro: 'Pauta não encontrada.' }, 404);
  if (resultado === 409) return json({ erro: 'Este agente já está trabalhando nisso.' }, 409);

  const r = await disparar(new URL(request.url).origin, cardId ? { cardId, so } : { acao });
  if (!r.ok) return json({ erro: 'Não consegui acordar o agente. Tente de novo.' }, 502);
  return json({ ok: true }, 202);
};

export const config = { path: '/api/agente' };
