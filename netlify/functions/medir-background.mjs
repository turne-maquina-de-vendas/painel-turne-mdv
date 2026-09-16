import { getStore } from "@netlify/blobs";
import { PAGINAS } from "./lista-paginas.mjs";

/* Mede as páginas no PageSpeed Insights e guarda o resultado.
 *
 * Roda como background function (limite de 15 min) porque cada medição do
 * PSI leva de 10 a 30 segundos — as 31 páginas em duas versões não caberiam
 * nos 30s de uma função agendada comum.
 *
 * Para cada página guardamos as duas notas do Lighthouse (o teste em
 * laboratório) e, quando o Google tem visitas reais suficientes daquela URL,
 * também o veredito de campo (CrUX). É esse dado de campo que representa
 * "como está no ar de verdade"; sem ele resta só o teste.
 *
 * Precisa da variável de ambiente PAGESPEED_API_KEY. Sem chave o Google
 * devolve 429 já na primeira chamada (a cota anônima é compartilhada).
 */

const NOME = "painel-campina-grande";
const SIMULTANEAS = 1;      // 1 pagina por parte; sao 4 partes em paralelo
const REPETICOES = 3;       // a nota do PSI oscila muito entre execucoes
const TEMPO_LIMITE = 115000; // por chamada: paginas pesadas passavam de 70s
const PAUSA_LOTE = 1500;    // respiro entre lotes, pelo mesmo motivo
const TENTATIVAS = 2;       // 429 e timeout sao transitorios: vale reenviar

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const loja = () => getStore({ name: NOME, consistency: "strong" });

async function tentarUma(url, estrategia, chave) {
  const alvo = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  alvo.searchParams.set("url", url);
  alvo.searchParams.set("strategy", estrategia);
  alvo.searchParams.set("category", "performance");
  if (chave) alvo.searchParams.set("key", chave);

  const corta = new AbortController();
  const relogio = setTimeout(() => corta.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(alvo, { signal: corta.signal });
    const texto = await r.text();
    let d;
    try {
      d = JSON.parse(texto);
    } catch {
      // o Google responde HTML em erro de borda; trata como transitorio
      return { erro: `${r.status}: resposta nao-JSON do Google`, repetir: true };
    }
    if (d.error) {
      const codigo = d.error.code;
      return {
        erro: `${codigo}: ${String(d.error.message).slice(0, 140)}`,
        repetir: codigo === 429 || codigo >= 500
      };
    }

    const bruto = d?.lighthouseResult?.categories?.performance?.score;
    const campo = d?.loadingExperience?.metrics ? d.loadingExperience.overall_category : null;
    return {
      nota: bruto == null ? null : Math.round(bruto * 100),
      campo,                                   // FAST | AVERAGE | SLOW — dado de usuários reais
      temCampo: Boolean(campo)
    };
  } catch (e) {
    return {
      erro: e.name === "AbortError" ? "tempo esgotado" : String(e.message).slice(0, 140),
      repetir: true
    };
  } finally {
    clearTimeout(relogio);
  }
}

/* 429 e tempo esgotado sao passageiros: espera um pouco e tenta de novo */
async function medirUma(url, estrategia, chave) {
  let ultimo;
  for (let i = 0; i < TENTATIVAS; i++) {
    ultimo = await tentarUma(url, estrategia, chave);
    if (!ultimo.erro) return ultimo;
    if (!ultimo.repetir) return ultimo;
    await espera(4000 * (i + 1));
  }
  return ultimo;
}

/* Uma medicao que falhou nao apaga a ultima que deu certo: o painel
   continua mostrando o numero anterior, marcado com a data em que saiu. */
function manterMelhor(novo, antigo) {
  if (novo && novo.nota != null) return novo;
  if (antigo && antigo.nota != null) return { ...antigo, desatualizado: true };
  return novo;
}

/* A nota de laboratorio do PSI oscila bastante: a mesma pagina deu 83, 66 e 43
   em execucoes seguidas no mesmo dia. Medimos 3 vezes e ficamos com a melhor,
   guardando as amostras para dar para ver a dispersao. */
async function melhorDeTres(url, estrategia, chave) {
  const amostras = [];
  let melhor = null;
  let ultimoErro = null;

  for (let i = 0; i < REPETICOES; i++) {
    const r = await medirUma(url, estrategia, chave);
    if (r.nota != null) {
      amostras.push(r.nota);
      if (!melhor || r.nota > melhor.nota) melhor = r;
    } else {
      ultimoErro = r;
    }
    if (i < REPETICOES - 1) await espera(2000);
  }

  if (!melhor) return ultimoErro || { erro: "as 3 medições falharam" };
  return { ...melhor, amostras };
}

async function medirPagina(p, chave, s) {
  const anterior = (await s.get("psi/" + p.id, { type: "json", ...FORTE })) || {};
  const [mobile, desktop] = await Promise.all([
    melhorDeTres(p.url, "mobile", chave),
    melhorDeTres(p.url, "desktop", chave)
  ]);
  const mob = manterMelhor(mobile, anterior.mobile);
  const desk = manterMelhor(desktop, anterior.desktop);
  const registro = {
    id: p.id, url: p.url, cidade: p.cidade, versao: p.versao,
    mobile: mob, desktop: desk,
    medidoEm: (mobile.nota != null || desktop.nota != null)
      ? new Date().toISOString()
      : (anterior.medidoEm || new Date().toISOString())
  };
  await s.setJSON("psi/" + p.id, registro);
  await s.delete("indice");   // o painel ja mostra esta pagina, sem esperar o fim
  return registro;
}

/* percorre a lista com um número fixo de medições ao mesmo tempo */
async function emLotes(itens, tamanho, tarefa) {
  const saida = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...await Promise.all(itens.slice(i, i + tamanho).map(tarefa)));
    if (i + tamanho < itens.length) await espera(PAUSA_LOTE);
  }
  return saida;
}

export default async (req) => {
  const s = loja();
  const chave = process.env.PAGESPEED_API_KEY;
  const inicio = Date.now();

  /* A lista inteira levava ~14,5 min de um limite de 15. Agora o agendador
     dispara duas metades em paralelo, cada uma com folga. */
  let parte = 0;
  try {
    const corpo = await req.json();
    parte = Number(corpo && corpo.parte) || 0;
  } catch { /* sem corpo: mede tudo */ }

  /* Com 3 medições por página o trabalho triplicou: são 4 fatias em paralelo
     para cada invocação caber com folga nos 15 min. */
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
    await s.delete("indice");          // força o painel a remontar na próxima leitura
    return new Response("sem chave", { status: 200 });
  }

  const resultados = await emLotes(minhas, SIMULTANEAS, (p) => medirPagina(p, chave, s));
  const semNota = resultados.filter(
    (r) => (r.mobile || {}).nota == null && (r.desktop || {}).nota == null
  ).length;
  const parciais = resultados.filter(
    (r) => (r.mobile || {}).desatualizado || (r.desktop || {}).desatualizado
  ).length;

  await s.setJSON(chaveRun, {
    quando: new Date().toISOString(),
    ok: semNota === 0,
    medidas: resultados.length,
    comErro: semNota,
    parciais,
    segundos: Math.round((Date.now() - inicio) / 1000)
  });
  await s.delete("indice");            // força o painel a remontar na próxima leitura

  return new Response("ok", { status: 200 });
};
