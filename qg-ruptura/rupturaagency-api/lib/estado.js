// Estado do QG no Netlify Blobs. Toda gravação usa etag: se outro salvou no meio, relê e tenta de novo.
import { getStore } from '@netlify/blobs';
import { lojaSupabase } from './supabase.js';

const CHAVE = 'estado';
// Com SUPABASE_URL (Vercel) usa o Supabase; sem ela (Netlify) segue no Netlify Blobs.
export const loja = () => process.env.SUPABASE_URL ? lojaSupabase() : getStore({ name: 'ruptura', consistency: 'strong' });

export async function lerEstado() {
  const r = await loja().getWithMetadata(CHAVE, { type: 'json' });
  return r ? { salvo: r.data, etag: r.etag } : { salvo: null, etag: null };
}

// fn(estado atual ou null) devolve o novo estado, ou null para não gravar. Último a salvar vence, sem perder o que os agentes escreveram.
export async function atualizarEstado(fn) {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { salvo, etag } = await lerEstado();
    const novo = fn(salvo?.estado ?? null, salvo?.atualizadoEm ?? 0);
    if (!novo) return salvo;
    const atualizadoEm = Math.max(Date.now(), (salvo?.atualizadoEm || 0) + 1);
    novo.atualizadoEm = atualizadoEm;
    const dados = { estado: novo, atualizadoEm };
    const r = await loja().setJSON(CHAVE, dados, etag ? { onlyIfMatch: etag } : salvo ? {} : { onlyIfNew: true });
    if (r.modified) return dados;
    await new Promise(ok => setTimeout(ok, 150 + Math.random() * 350));
  }
  throw new Error('Não consegui gravar o estado: muita gente salvando ao mesmo tempo.');
}

// Campos que os agentes escrevem no card. Se o agente escreveu depois do que o navegador viu, o do agente fica.
const DO_AGENTE = ['pedido', 'pesquisa', 'pesquisado', 'diagnostico', 'ganchos', 'escolhido', 'roteiro', 'legenda', 'design', 'mockup', 'planoGravacao', 'briefEdicao', 'etapa', 'agente', 'agenteEm'];

export function mesclar(atual, novo, base) {
  if (!atual) return { estado: novo, mesclou: false };
  let mesclou = false;
  const mapa = new Map((atual.cards || []).map(c => [c.id, c]));
  const ids = new Set(novo.cards.map(c => c.id));
  const cards = novo.cards.map(c => {
    const a = mapa.get(c.id);
    if (!a || (a.agenteEm || 0) <= (c.agenteEm || 0)) return c;
    mesclou = true;
    const m = { ...c };
    for (const k of DO_AGENTE) { if (a[k] === undefined) delete m[k]; else m[k] = a[k]; }
    return m;
  });
  // Pauta criada por agente que este navegador ainda não viu. Sem isso, ela sumiria; a que o usuário apagou tem agenteEm <= base.
  const criadas = (atual.cards || []).filter(c => !ids.has(c.id) && (c.agenteEm || 0) > Number(base || 0));
  if (criadas.length) mesclou = true;
  const r = { ...novo, cards: criadas.concat(cards) };
  // Relatórios e status gerais só os agentes escrevem.
  for (const k of ['relatorios', 'agentes']) {
    if (atual[k] === undefined) delete r[k]; else r[k] = atual[k];
    if (JSON.stringify(atual[k]) !== JSON.stringify(novo[k])) mesclou = true;
  }
  return { estado: r, mesclou };
}
