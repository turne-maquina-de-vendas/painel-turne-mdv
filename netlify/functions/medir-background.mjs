import { getStore } from "@netlify/blobs";
import { PAGINAS } from "./lista-paginas.mjs";

/* Mede as páginas no PageSpeed Insights e guarda o resultado.
 *
 * Roda como background function (limite de 15 min) porque cada medição do
 * PSI leva de 10 a 30 segundos.
 *
 * TRÊS MEDIÇÕES POR FORMATO, VALE A MELHOR. A nota de laboratório do PSI
 * oscila muito: a mesma página deu 83, 66 e 43 em execuções seguidas no
 * mesmo dia. Uma medição só não diz nada.
 *
 * CADA AMOSTRA É GRAVADA ASSIM QUE SAI. A versão anterior só gravava depois
 * das três fecharem — bastava a terceira estourar o tempo para as duas
 * primeiras irem junto para o lixo, e a página nunca era registrada.
 *
 * E a função para de começar trabalho novo antes do limite de 15 min, para
 * sempre sair por conta própria em vez de ser morta no meio de uma gravação.
 *
 * Precisa da variável de ambiente PAGESPEED_API_KEY. Sem chave o Google
 * devolve 429 já na primeira chamada (a cota anônima é compartilhada).
 */

const NOME = "painel-campina-grande";
const FORTE = { consistency: "strong" };

const SIMULTANEAS = 1;       // 1 página por fatia; são 4 fatias em paralelo
const REPETICOES = 3;        // amostras por formato
const TEMPO_LIMITE = 100000; // por chamada ao PSI
const PRAZO = 11 * 60 * 1000; // para de começar coisa nova aos 11 min

const loja = () => getStore({ name: NOME, consistency: "strong" });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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
    try {
      d = JSON.parse(texto);
    } catch {
      return { erro: `${r.status}: resposta não-JSON do Google` };
    }
    if (d.error) return { erro: `${d.error.code}: ${String(d.error.message).slice(0, 140)}` };

    const bruto = d?.lighthouseResult?.categories?.performance?.score;
    const campo = d?.loadingExperience?.metrics ? d.loadingExperience.overall_category : null;
    return {
      nota: bruto == null ? null : Math.round(bruto * 100),
      campo,                       // FAST | AVERAGE | SLOW — visitantes reais
      temCampo: Boolean(campo)
    };
  } catch (e) {
    return { erro: e.name === "AbortError" ? "tempo esgotado" : String(e.message).slice(0, 140) };
  } finally {
    clearTimeout(relogio);
  }
}

async function medirPagina(p, chave, s, expira) {
  const anterior = (await s.get("psi/" + p.id, { type: "json", ...FORTE })) || {};
  const registro = {
    id: p.id, url: p.url, cidade: p.cidade, versao: p.versao,
    mobile: anterior.mobile || null,
    desktop: anterior.desktop || null,
    medidoEm: anterior.medidoEm || null
  };
  const rodada = { mobile: null, desktop: null };

  async function amostra(estrategia) {
    if (Date.now() > expira) return;
    const r = await medirUma(p.url, estrategia, chave);

    if (r.nota == null) {
      // só registra o erro se não existir nota nenhuma para esse formato
      if (!rodada[estrategia] && !(registro[estrategia] || {}).nota) {
        registro[estrategia] = r;
      }
      return;
    }

    const atual = rodada[estrategia];
    const amostras = ((atual && atual.amostras) || []).concat(r.nota);
    const melhor = !atual || r.nota > atual.nota ? r : atual;
    rodada[estrategia] = { ...melhor, amostras };
    registro[estrategia] = rodada[estrategia];
    registro.medidoEm = new Date().toISOString();

    await s.setJSON("psi/" + p.id, registro);  // grava a cada amostra
    await s.delete("indice");                  // o painel já mostra
  }

  for (let i = 0; i < REPETICOES; i++) {
    if (Date.now() > expira) break;
    await Promise.all([amostra("mobile"), amostra("desktop")]);
    if (i < REPETICOES - 1) await espera(1500);
  }
  return registro;
}

async function emLotes(itens, tamanho, tarefa, expira) {
  const saida = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    if (Date.now() > expira) break;
    saida.push(...await Promise.all(itens.slice(i, i + tamanho).map(tarefa)));
  }
  return saida;
}

export default async (req) => {
  const s = loja();
  const chave = process.env.PAGESPEED_API_KEY;
  const inicio = Date.now();
  const expira = inicio + PRAZO;

  let parte = 0;
  try {
    const corpo = await req.json();
    parte = Number(corpo && corpo.parte) || 0;
  } catch { /* sem corpo: mede tudo */ }

  const PARTES = 4;
  const fatia = Math.ceil(PAGINAS.length / PARTES);
  const minhas = parte >= 1 && parte <= PARTES
    ? PAGINAS.slice((parte - 1) * fatia, parte * fatia)
    : PAGINAS;
  const chaveRun = "psi-run/" + (parte || "tudo");

  if (!chave) {
    await s.setJSON(chaveRun, {
      quando: new Date().toISOString(),
      ok: false,
      erro: "Falta a variável PAGESPEED_API_KEY nas configurações do site."
    });
    await s.delete("indice");
    return new Response("sem chave", { status: 200 });
  }

  const resultados = await emLotes(minhas, SIMULTANEAS, (p) => medirPagina(p, chave, s, expira), expira);

  const semNota = resultados.filter(
    (r) => (r.mobile || {}).nota == null && (r.desktop || {}).nota == null
  ).length;
  const completas = resultados.filter(
    (r) => ((r.mobile || {}).amostras || []).length === REPETICOES &&
           ((r.desktop || {}).amostras || []).length === REPETICOES
  ).length;

  await s.setJSON(chaveRun, {
    quando: new Date().toISOString(),
    ok: semNota === 0,
    medidas: resultados.length,
    naFatia: minhas.length,
    completas,
    comErro: semNota,
    prazoEstourado: Date.now() > expira,
    segundos: Math.round((Date.now() - inicio) / 1000)
  });
  await s.delete("indice");

  return new Response("ok", { status: 200 });
};
