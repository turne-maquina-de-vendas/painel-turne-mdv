import { neon } from "@neondatabase/serverless";
import { PAGINAS } from "./lista-paginas.js";

/* Mede as páginas no PageSpeed Insights e grava no Postgres.
 *
 * TRÊS MEDIÇÕES POR FORMATO, E A MAIOR NOTA PREVALECE — inclusive sobre as
 * rodadas anteriores. A nota de laboratório do PSI oscila muito: a mesma
 * página deu 92, 83, 66 e 41 em execuções do mesmo dia. Guardar a maior evita
 * que um número ruim por acaso vire a verdade do painel.
 *
 * O preço disso é que uma página que piorou de verdade não apareceria. Por
 * isso o registro também guarda `ultima` (a melhor desta rodada) e as
 * amostras: o painel mostra a maior, mas deixa ver a medição atual ao lado.
 *
 * CADA AMOSTRA É GRAVADA ASSIM QUE SAI, e a função para de começar trabalho
 * novo antes do limite de execução — assim um estouro nunca joga fora o que
 * já foi medido.
 *
 * A chave do PageSpeed vem da tabela `config` do próprio banco (com a
 * variável de ambiente como alternativa). Assim o único segredo que a
 * hospedagem precisa conhecer é a DATABASE_URL, e trocar a chave é um
 * UPDATE — sem mexer em painel de hospedagem nem refazer deploy.
 * Sem chave o Google devolve 429 na primeira chamada.
 */

export const config = { maxDuration: 300 };

const sql = neon(process.env.DATABASE_URL);

const REPETICOES = 3;
const TEMPO_LIMITE = 100000;   // por chamada ao PSI
const FOLGA = 25000;           // para de começar coisa nova faltando isso

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chaveDoPageSpeed() {
  try {
    const [r] = await sql`select valor from config where chave = 'PAGESPEED_API_KEY'`;
    if (r && r.valor) return r.valor;
  } catch { /* tabela ausente: cai no ambiente */ }
  return process.env.PAGESPEED_API_KEY || null;
}

async function medirUma(url, estrategia, chave) {
  const alvo = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  alvo.searchParams.set("url", url);
  alvo.searchParams.set("strategy", estrategia);
  alvo.searchParams.set("category", "performance");
  alvo.searchParams.set("key", chave);

  const corta = new AbortController();
  const relogio = setTimeout(() => corta.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(alvo, { signal: corta.signal });
    const texto = await r.text();
    let d;
    try { d = JSON.parse(texto); }
    catch { return { erro: `${r.status}: resposta não-JSON do Google` }; }
    if (d.error) return { erro: `${d.error.code}: ${String(d.error.message).slice(0, 140)}` };

    const bruto = d?.lighthouseResult?.categories?.performance?.score;
    const campo = d?.loadingExperience?.metrics ? d.loadingExperience.overall_category : null;
    return {
      nota: bruto == null ? null : Math.round(bruto * 100),
      campo,
      temCampo: Boolean(campo)
    };
  } catch (e) {
    return { erro: e.name === "AbortError" ? "tempo esgotado" : String(e.message).slice(0, 140) };
  } finally {
    clearTimeout(relogio);
  }
}

async function gravar(reg) {
  await sql`insert into medicoes (id, url, cidade, versao, origem, mobile, desktop, medido_em)
            values (${reg.id}, ${reg.url}, ${reg.cidade}, ${reg.versao}, 'psi',
                    ${JSON.stringify(reg.mobile || {})}, ${JSON.stringify(reg.desktop || {})},
                    ${reg.medidoEm})
            on conflict (id) do update
            set mobile = excluded.mobile, desktop = excluded.desktop,
                medido_em = excluded.medido_em, origem = excluded.origem`;
}

async function medirPagina(p, chave, expira) {
  const [ant] = await sql`select mobile, desktop, medido_em from medicoes where id = ${p.id}`;
  const registro = {
    id: p.id, url: p.url, cidade: p.cidade, versao: p.versao,
    mobile: (ant && ant.mobile) || null,
    desktop: (ant && ant.desktop) || null,
    medidoEm: (ant && ant.medido_em) || null
  };
  /* melhor nota já registrada, de qualquer rodada anterior */
  const recorde = {
    mobile: ((ant && ant.mobile) || {}).nota ?? null,
    desktop: ((ant && ant.desktop) || {}).nota ?? null
  };
  const rodada = { mobile: null, desktop: null };

  async function amostra(estrategia) {
    if (Date.now() > expira) return;
    const r = await medirUma(p.url, estrategia, chave);
    if (r.nota == null) {
      if (!rodada[estrategia] && !(registro[estrategia] || {}).nota) registro[estrategia] = r;
      return;
    }
    const atual = rodada[estrategia];
    const amostras = ((atual && atual.amostras) || []).concat(r.nota);
    const melhorDaRodada = !atual || r.nota > (atual.ultima ?? atual.nota) ? r : atual;
    const desta = melhorDaRodada.nota ?? r.nota;
    const topo = Math.max(desta, recorde[estrategia] ?? -1);

    rodada[estrategia] = {
      ...r,                 // campo/temCampo vêm sempre da medição mais recente
      nota: topo,           // a que o painel mostra
      ultima: desta,        // a melhor desta rodada, para dar para comparar
      amostras
    };
    registro[estrategia] = rodada[estrategia];
    registro.medidoEm = new Date().toISOString();
    await gravar(registro);
  }

  for (let i = 0; i < REPETICOES; i++) {
    if (Date.now() > expira) break;
    await Promise.all([amostra("mobile"), amostra("desktop")]);
    if (i < REPETICOES - 1) await espera(1200);
  }
  return registro;
}

export default async function handler(req, res) {
  const chave = await chaveDoPageSpeed();
  const inicio = Date.now();
  const expira = inicio + (config.maxDuration * 1000) - FOLGA;

  /* Sem fatias fixas: cada execução pega as páginas mais desatualizadas e
     mede até o tempo acabar. Uma medição leva ~90s (3 amostras em mobile e
     desktop), então cabem ~3 por execução — e as chamadas agendadas vão se
     revezando sozinhas até cobrir a lista, sem eu ter que acertar a conta. */
  const ordem = await sql`select id, medido_em from medicoes`;
  const quando = new Map(ordem.map((r) => [r.id, r.medido_em ? new Date(r.medido_em).getTime() : 0]));
  const minhas = [...PAGINAS].sort((a, b) => (quando.get(a.id) ?? 0) - (quando.get(b.id) ?? 0));
  const chaveRun = "psi-" + (Number(req.query?.parte) || "auto");

  if (!chave) {
    await sql`insert into execucoes (parte, dados) values (${chaveRun}, ${JSON.stringify({
      quando: new Date().toISOString(), ok: false,
      erro: "Falta a chave do PageSpeed: grave em config.PAGESPEED_API_KEY no banco."
    })}) on conflict (parte) do update set dados = excluded.dados, quando = now()`;
    res.status(200).send("sem chave");
    return;
  }

  const feitas = [];
  for (const p of minhas) {
    if (Date.now() > expira) break;
    feitas.push(await medirPagina(p, chave, expira));
  }

  const semNota = feitas.filter(
    (r) => (r.mobile || {}).nota == null && (r.desktop || {}).nota == null
  ).length;

  await sql`insert into execucoes (parte, dados) values (${chaveRun}, ${JSON.stringify({
    quando: new Date().toISOString(),
    ok: semNota === 0,
    medidas: feitas.length,
    naLista: minhas.length,
    maisAntiga: feitas.length ? feitas[0].cidade + " " + feitas[0].versao : null,
    comErro: semNota,
    segundos: Math.round((Date.now() - inicio) / 1000)
  })}) on conflict (parte) do update set dados = excluded.dados, quando = now()`;

  res.status(200).json({ medidas: feitas.length, de: minhas.length, comErro: semNota });
}
