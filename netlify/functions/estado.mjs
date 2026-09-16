import { getStore } from "@netlify/blobs";

/* Armazenamento do painel.
 *
 * Cada anotação é um blob próprio ("nota/<id>") e cada decisão é um blob
 * próprio ("status/<arteKey>"). Assim duas pessoas gravando ao mesmo tempo
 * nunca sobrescrevem uma à outra — o problema de guardar tudo num documento
 * só, onde o último a salvar apagava o que o outro acabara de escrever.
 *
 * Ler todos os blobs a cada consulta seria lento, então o resultado montado
 * fica no blob "indice", refeito a partir da fonte real depois de cada
 * gravação. Se um índice sair incompleto, a gravação seguinte o conserta.
 *
 * Leituras usam consistência forte: sem isso o Netlify pode devolver uma
 * versão antiga logo após a gravação, e a anotação recém-escrita "some"
 * quando a pessoa atualiza a página.
 */

const NOME = "painel-campina-grande";
const FORTE = { consistency: "strong" };
const TETO_NOTAS = 2000;

const semCache = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const loja = () => getStore({ name: NOME, consistency: "strong" });

function limpar(v, max) {
  return String(v == null ? "" : v).slice(0, max);
}

function responder(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: semCache });
}

/** Monta o estado lendo os blobs individuais — a fonte de verdade. */
async function montar(s) {
  const { blobs } = await s.list();
  const chavesNota = blobs.filter((b) => b.key.startsWith("nota/")).map((b) => b.key);
  const chavesSt = blobs.filter((b) => b.key.startsWith("status/")).map((b) => b.key);
  const chavesPsi = blobs.filter((b) => b.key.startsWith("psi/")).map((b) => b.key);
  const chavesRun = blobs.filter((b) => b.key.startsWith("psi-run/")).map((b) => b.key);

  const [notas, sts, psis, execucao] = await Promise.all([
    Promise.all(chavesNota.map((k) => s.get(k, { type: "json", ...FORTE }))),
    Promise.all(
      chavesSt.map(async (k) => [k.slice("status/".length), await s.get(k, { type: "json", ...FORTE })])
    ),
    Promise.all(chavesPsi.map((k) => s.get(k, { type: "json", ...FORTE }))),
    Promise.all(chavesRun.map((k) => s.get(k, { type: "json", ...FORTE })))
  ]);

  const artes = {};
  for (const [chave, valor] of sts) if (valor) artes[chave] = valor;

  const anotacoes = notas
    .filter(Boolean)
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))
    .slice(-TETO_NOTAS);

  const medicoes = {};
  for (const m of psis) if (m && m.id) medicoes[m.id] = m;

  /* A medição roda em duas metades; o painel mostra uma linha só. */
  const partes = execucao.filter(Boolean);
  const resumo = partes.length
    ? {
        quando: partes.map((p) => p.quando).sort().pop(),
        erro: partes.find((p) => p.erro)?.erro || null,
        ok: partes.every((p) => p.ok),
        medidas: partes.reduce((t, p) => t + (p.medidas || 0), 0),
        comErro: partes.reduce((t, p) => t + (p.comErro || 0), 0),
        parciais: partes.reduce((t, p) => t + (p.parciais || 0), 0),
        segundos: Math.max(...partes.map((p) => p.segundos || 0))
      }
    : null;

  return { artes, anotacoes, medicoes, execucao: resumo };
}

/** Traz o formato antigo (um documento só) para os blobs individuais. */
async function migrar(s) {
  const velho = await s.get("estado", { type: "json", ...FORTE });
  if (!velho) return false;

  const gravacoes = [];
  for (const [chave, valor] of Object.entries(velho.artes || {})) {
    gravacoes.push(s.setJSON("status/" + chave, valor));
  }
  for (const n of velho.anotacoes || []) {
    const id = n.id || crypto.randomUUID();
    gravacoes.push(s.setJSON("nota/" + id, { ...n, id }));
  }
  await Promise.all(gravacoes);
  await s.delete("estado");
  return true;
}

async function refazerIndice(s) {
  const estado = await montar(s);
  await s.setJSON("indice", estado);
  return estado;
}

export default async (req) => {
  const s = loja();

  if (req.method === "GET") {
    if (await migrar(s)) return responder(await refazerIndice(s));
    const indice = await s.get("indice", { type: "json", ...FORTE });
    return responder(indice || (await refazerIndice(s)));
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return responder({ erro: "corpo inválido" }, 400);
    }

    await migrar(s);

    if (body.tipo === "status" && body.key) {
      await s.setJSON("status/" + limpar(body.key, 80), {
        status: limpar(body.status, 20) || "pendente",
        em: limpar(body.em, 40),
        remessa: limpar(body.remessa, 20)
      });
    } else if (body.tipo === "nota" && body.arteKey && body.texto) {
      const id = crypto.randomUUID();
      await s.setJSON("nota/" + id, {
        id,
        arteKey: limpar(body.arteKey, 80),
        remessa: limpar(body.remessa, 20),
        texto: limpar(body.texto, 1200),
        criadoEm: limpar(body.criadoEm, 40) || new Date().toISOString()
      });
    } else if (body.tipo === "medicao" && body.id) {
      /* medição vinda de fora (Lighthouse rodado na mão). Guarda no mesmo
         formato da automática, mas com origem marcada — a nota do Lighthouse
         local não é idêntica à do PageSpeed, que roda em hardware padrão. */
      await s.setJSON("psi/" + limpar(body.id, 120), {
        id: limpar(body.id, 120),
        url: limpar(body.url, 300),
        cidade: limpar(body.cidade, 120),
        versao: limpar(body.versao, 40),
        origem: limpar(body.origem, 20) || "local",
        mobile: body.mobile || {},
        desktop: body.desktop || {},
        medidoEm: limpar(body.medidoEm, 40) || new Date().toISOString()
      });
    } else if (body.tipo === "apagarNota" && body.id) {
      await s.delete("nota/" + limpar(body.id, 80));
    } else {
      return responder({ erro: "ação desconhecida" }, 400);
    }

    return responder(await refazerIndice(s));
  }

  return responder({ erro: "método não permitido" }, 405);
};

export const config = { path: "/api/estado" };
