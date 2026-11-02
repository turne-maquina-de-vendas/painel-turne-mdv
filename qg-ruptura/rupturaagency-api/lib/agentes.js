// A esteira autônoma: cada etapa roda um agente, grava no card e passa para o próximo. Para onde depende de gente (gravar, editar).
import { perguntar, mensagemDeErro } from './claude.js';
import { disparar } from './disparar.js';
import { atualizarEstado, lerEstado, loja } from './estado.js';
import { FLUXO, usarEstado, promptDe, lerPesquisa, contexto, arroba } from './site.js';

const LIMITE_DIA = Number(process.env.RUPTURA_LIMITE_DIA || 80);
const FORMATO_PESQUISA = '\n\nUse "## " somente no início de cada assunto, sem nenhum outro título com #, e não escreva nada depois do último assunto.';

// Em vídeo, o Designer só entra quando a pauta pede mockup.
const passaPeloDesign = c => c.formato === 'Carrossel' || !!c.mockup;
const proxima = c => {
  const f = (FLUXO[c.formato] || FLUXO.Reel).filter(e => e !== 'design' || passaPeloDesign(c));
  return f[f.indexOf(c.etapa) + 1] || c.etapa;
};

// Trava de custo: se algo sair do controle (ou a senha vazar), para no limite do dia.
async function contarUso() {
  const chave = 'uso/' + new Date().toISOString().slice(0, 10);
  const n = Number(await loja().get(chave) || 0);
  if (n >= LIMITE_DIA) throw new Error(`Limite de ${LIMITE_DIA} chamadas por dia atingido. Volta amanhã.`);
  await loja().set(chave, String(n + 1));
}

async function chamar(prompt, opcoes) { await contarUso(); return perguntar(prompt, opcoes); }

async function mudarCard(id, fn) {
  let achou = false;
  await atualizarEstado(estado => {
    const c = estado?.cards?.find(x => x.id === id);
    if (!c) return null;
    achou = true;
    fn(c);
    c.agenteEm = Date.now();
    return estado;
  });
  return achou;
}

async function lerCard(id) {
  const { salvo } = await lerEstado();
  const estado = salvo?.estado;
  usarEstado(estado || { cards: [] });
  return estado?.cards?.find(x => x.id === id) || null;
}

const avisar = (id, quem, faz) => mudarCard(id, c => { c.agente = { status: 'rodando', quem, faz, em: Date.now() }; });

async function pesquisar(c) {
  await avisar(c.id, 'pesquisador', 'Pesquisando o assunto');
  const fresco = await lerCard(c.id);
  const texto = await chamar(promptDe('pesquisador', fresco), { web: true, agente: 'pesquisador' });
  await mudarCard(c.id, x => {
    x.pedido = x.pedido ?? (x.pesquisa || x.nota || '');
    x.pesquisa = (x.pedido ? `Pedido: ${x.pedido}\n\n` : '') + texto;
    x.pesquisado = true;
    if (x.etapa === 'pauta') x.etapa = proxima(x);
  });
}

async function criarGanchos(c) {
  await avisar(c.id, 'roteirista', 'Escrevendo os ganchos');
  const fresco = await lerCard(c.id);
  const r = await chamar(promptDe('roteirista', fresco), { ganchos: true });
  if (!r.ganchos?.length) throw new Error('O Roteirista não trouxe ganchos. Tente de novo.');
  await mudarCard(c.id, x => {
    x.diagnostico = r.diagnostico;
    x.ganchos = r.ganchos;
    x.escolhido = r.favorito >= 0 && r.favorito < r.ganchos.length ? r.favorito : 0;
    x.mockup = !!r.precisaMockup || !!x.mockup;
    x.roteiro = '';
  });
}

async function escreverRoteiro(c) {
  await avisar(c.id, 'roteirista', 'Escrevendo o roteiro');
  const fresco = await lerCard(c.id);
  const texto = await chamar(promptDe('roteirista', fresco, 'roteiro'));
  await mudarCard(c.id, x => { x.roteiro = texto; if (x.etapa === 'gancho') x.etapa = proxima(x); });
}

async function escreverLegenda(c) {
  await avisar(c.id, 'social', 'Escrevendo a legenda');
  const fresco = await lerCard(c.id);
  const texto = await chamar(promptDe('social', fresco), { agente: 'social' });
  await mudarCard(c.id, x => { x.legenda = texto; });
}

async function criarDesign(c) {
  await avisar(c.id, 'designer', c.formato === 'Carrossel' ? 'Desenhando os painéis' : 'Desenhando os mockups');
  const x = await lerCard(c.id);
  const g = x.ganchos && x.escolhido != null ? x.ganchos[x.escolhido] : null;
  const pedido = x.formato === 'Carrossel'
    ? `Faça a direção de arte do carrossel "${x.titulo}" de ${arroba()}, com a camada sênior de design do /carrossel-viral: 1080×1350, margens de 80 px nas laterais e 100 px em cima e embaixo, capa segura no corte 3:4 do grid, no máximo 2 famílias tipográficas, 60-30-10 na cor, um destaque por painel, avatar e numeração fixos. Capa: "${g ? g.texto : ''}". Preencha todos os painéis. Em pecas, liste só as imagens que precisam ser geradas.`
    : `A pauta "${x.titulo}" de ${arroba()} imagina um produto ou marca que não existe. Crie o conceito e de 3 a 5 mockups fotorrealistas de embalagem para o vídeo: peça principal, detalhe de material, a peça em uso ou unboxing, e a comparação com o original quando couber. Abre com: "${g ? g.texto : ''}". Em paineis, devolva lista vazia. A embalagem é exercício de design: inclua o selo "Produto fictício" nos avisos. Não use pessoas reais nem imagens de terceiros.`;
  const r = await chamar(`${pedido}\n\nRoteiro:\n${x.roteiro || '—'}\n\nPesquisa:\n${x.pesquisa || x.nota || '—'}${contexto(x)}`, { design: true, agente: 'designer' });
  await mudarCard(c.id, y => {
    // Imagem já gerada não se perde se o Designer refizer a peça de mesmo nome.
    const antes = new Map((y.design?.pecas || []).map(p => [p.nome, p.img]));
    r.pecas.forEach(p => { if (antes.get(p.nome)) p.img = antes.get(p.nome); });
    y.design = r;
  });
}

async function planejarGravacao(c) {
  await avisar(c.id, 'estudio', 'Montando o plano de gravação');
  const x = await lerCard(c.id);
  const texto = await chamar(`Monte o plano de gravação do ${x.formato} "${x.titulo}" de ${arroba()}, para gravar em até 30 minutos: o que preparar antes, enquadramento e luz, a ordem dos takes (agrupe por cenário, não pela ordem do vídeo), lista de b-roll e o que conferir antes de desligar. Curto e em tópicos.\n\nRoteiro:\n${x.roteiro || '—'}${contexto(x)}`, { agente: 'estudio' });
  await mudarCard(c.id, y => { y.planoGravacao = texto; });
}

async function planejarEdicao(c) {
  await avisar(c.id, 'editor', 'Montando o plano de edição');
  const x = await lerCard(c.id);
  const texto = await chamar(`${promptDe('editor', x)}\n\nAqui você não edita o vídeo: entregue o plano de edição pronto para executar, com a linha do tempo corte a corte, legenda, zooms, trilha e efeitos, e a checagem final. Curto e em tópicos.`, { agente: 'editor' });
  await mudarCard(c.id, y => { y.briefEdicao = texto; });
}

// so: refaz só um passo (ganchos, roteiro, legenda). Sem ele, anda até precisar de gente.
const PASSOS = [
  [c => c.etapa === 'pauta', 'pesquisador', pesquisar],
  [c => c.etapa === 'gancho' && !c.ganchos?.length, 'roteirista', criarGanchos],
  [c => c.etapa === 'gancho', 'roteirista', escreverRoteiro],
  [c => c.etapa === 'design' && !c.design, 'designer', criarDesign],
  [c => c.etapa === 'gravar' && !c.planoGravacao, 'estudio', planejarGravacao],
  [c => c.etapa === 'edicao' && !c.briefEdicao && c.formato !== 'Carrossel', 'editor', planejarEdicao],
  [c => c.etapa === 'postar' && !c.legenda, 'social', escreverLegenda]
];

// so: refaz só um passo. Sem ele, anda até precisar de gente.
// Na Vercel cada passo vira uma chamada nova, porque o tempo de cada Function é menor que a esteira inteira.
export async function rodarCard(id, so, origem) {
  let quem = 'pesquisador';
  try {
    if (so === 'ganchos') { quem = 'roteirista'; await criarGanchos({ id }); await escreverRoteiro({ id }); }
    else if (so === 'roteiro') { quem = 'roteirista'; await escreverRoteiro({ id }); }
    else if (so === 'legenda') { quem = 'social'; await escreverLegenda({ id }); }
    else if (so === 'design') { quem = 'designer'; await mudarCard(id, x => { x.mockup = true; }); await criarDesign({ id }); }
    else if (so === 'plano') { quem = 'estudio'; await planejarGravacao({ id }); }
    else if (so === 'edicao') { quem = 'editor'; await planejarEdicao({ id }); }
    else {
      for (let volta = 0; volta < PASSOS.length + 1; volta++) {
        const c = await lerCard(id);
        const passo = c && PASSOS.find(([precisa]) => precisa(c));
        if (!passo) break;
        quem = passo[1];
        await passo[2](c);
        if (process.env.VERCEL && origem) {
          const r = await disparar(origem, { cardId: id });
          if (!r.ok) throw new Error('Não consegui passar para o próximo agente. Tente de novo.');
          return;
        }
      }
    }
    await mudarCard(id, x => { delete x.agente; });
  } catch (e) {
    console.error('Esteira', id, e);
    await mudarCard(id, x => { x.agente = { status: 'erro', quem, msg: mensagemDeErro(e), em: Date.now() }; });
  }
}

async function marcarGeral(acao, valor) {
  await atualizarEstado(estado => {
    if (!estado) return null;
    estado.agentes = { ...(estado.agentes || {}) };
    if (valor) estado.agentes[acao] = valor; else delete estado.agentes[acao];
    return estado;
  });
}

// Pesquisa da semana: cria as pautas e devolve os ids, cada uma segue a própria esteira.
export async function rodarSemana() {
  try {
    await marcarGeral('semana', { status: 'rodando', quem: 'pesquisador', faz: 'Pesquisando as pautas da semana', em: Date.now() });
    const { salvo } = await lerEstado();
    usarEstado(salvo?.estado || { cards: [] });
    const texto = await chamar(promptDe('pesquisador', null) + FORMATO_PESQUISA, { web: true, agente: 'pesquisador' });
    const itens = lerPesquisa(texto);
    if (!itens.length) throw new Error('A pesquisa não trouxe assuntos. Tente de novo.');
    const ids = [];
    const agora = Date.now();
    await atualizarEstado(estado => {
      if (!estado) return null;
      ids.length = 0;
      const titulos = new Set(estado.cards.map(c => c.titulo.toLowerCase()));
      const novas = itens.filter(i => !titulos.has(i.titulo.toLowerCase())).map((i, k) => {
        const id = 'a' + agora.toString(36) + k;
        ids.push(id);
        return { id, titulo: i.titulo, formato: i.formato, serie: i.serie, etapa: 'pauta', pesquisa: i.pesquisa, pesquisado: true, criado: agora, agenteEm: agora,
          agente: { status: 'rodando', quem: 'roteirista', faz: 'Na fila', em: agora } };
      });
      novas.forEach(c => { c.etapa = proxima(c); });
      estado.cards = novas.concat(estado.cards);
      return estado;
    });
    await marcarGeral('semana', null);
    return ids;
  } catch (e) {
    console.error('Semana', e);
    await marcarGeral('semana', { status: 'erro', quem: 'pesquisador', msg: mensagemDeErro(e), em: Date.now() });
    return [];
  }
}

const fila = () => (lerFila.estado?.cards || []).filter(c => c.etapa === 'gravar' && !c.exemplo).map(c => `- ${c.titulo} (${c.formato})`).join('\n') || 'Nada parado.';
const lerFila = { estado: null };
const RELATORIOS = {
  cobranca: { quem: 'assistente', faz: 'Escrevendo a cobrança de hoje', prompt: () => `Escreva a mensagem de WhatsApp de hoje cobrando o Lucas de gravar o que está parado, começando pelo mais rápido. Sem enrolação, até 6 linhas.\n\nFila de gravação:\n${fila()}`, web: false },
  analise: { quem: 'social', faz: 'Analisando o perfil', prompt: () => promptDe('social', null), web: false },
  plano: { quem: 'social', faz: 'Montando o plano de 4 semanas', prompt: () => promptDe('estrategia', null), web: false },
  olivetto: { quem: 'social', faz: 'Criando a campanha do Raio-X', prompt: () => promptDe('estrategia', null, 'olivetto'), web: false }
};
export const ehRelatorio = acao => !!RELATORIOS[acao];

export async function rodarRelatorio(acao) {
  const r = RELATORIOS[acao];
  try {
    await marcarGeral(acao, { status: 'rodando', quem: r.quem, faz: r.faz, em: Date.now() });
    const { salvo } = await lerEstado();
    usarEstado(salvo?.estado || { cards: [] });
    lerFila.estado = salvo?.estado;
    const texto = await chamar(r.prompt(), { web: r.web, agente: r.quem });
    await atualizarEstado(estado => {
      if (!estado) return null;
      estado.relatorios = { ...(estado.relatorios || {}), [acao]: { texto, em: Date.now() } };
      if (estado.agentes) delete estado.agentes[acao];
      return estado;
    });
  } catch (e) {
    console.error('Relatório', acao, e);
    await marcarGeral(acao, { status: 'erro', quem: r.quem, msg: mensagemDeErro(e), em: Date.now() });
  }
}
