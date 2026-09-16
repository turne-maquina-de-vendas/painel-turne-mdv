import { neon } from "@neondatabase/serverless";

/* Estado compartilhado do painel, no Postgres (Neon).
 *
 * GET  /api/estado            devolve tudo que o painel precisa
 * POST /api/estado            grava uma decisão, anotação ou medição
 *
 * Cada anotação e cada decisão é uma linha própria: duas pessoas gravando
 * ao mesmo tempo nunca se sobrescrevem, que era o problema de guardar tudo
 * num documento só.
 */

const sql = neon(process.env.DATABASE_URL);

const corta = (v, max) => String(v == null ? "" : v).slice(0, max);

function responder(res, corpo, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify(corpo));
}

async function montar() {
  const [anotacoes, status, medicoes, execucoes] = await Promise.all([
    sql`select id, arte_key, remessa, texto, criado_em
          from anotacoes order by criado_em asc limit 2000`,
    sql`select arte_key, status, remessa, em from status_artes`,
    sql`select id, url, cidade, versao, origem, mobile, desktop, medido_em from medicoes`,
    sql`select parte, dados from execucoes`
  ]);

  const artes = {};
  for (const r of status) {
    artes[r.arte_key] = { status: r.status, remessa: r.remessa, em: r.em };
  }

  const meds = {};
  for (const r of medicoes) {
    meds[r.id] = {
      id: r.id, url: r.url, cidade: r.cidade, versao: r.versao,
      origem: r.origem, mobile: r.mobile, desktop: r.desktop, medidoEm: r.medido_em
    };
  }

  /* a medição roda em fatias; o painel mostra uma linha só */
  const partes = execucoes.map((r) => r.dados).filter(Boolean);
  const resumo = partes.length
    ? {
        quando: partes.map((p) => p.quando).filter(Boolean).sort().pop(),
        erro: (partes.find((p) => p.erro) || {}).erro || null,
        ok: partes.every((p) => p.ok),
        medidas: partes.reduce((t, p) => t + (p.medidas || 0), 0),
        comErro: partes.reduce((t, p) => t + (p.comErro || 0), 0),
        segundos: Math.max(...partes.map((p) => p.segundos || 0))
      }
    : null;

  return {
    anotacoes: anotacoes.map((r) => ({
      id: r.id, arteKey: r.arte_key, remessa: r.remessa,
      texto: r.texto, criadoEm: r.criado_em
    })),
    artes,
    medicoes: meds,
    execucao: resumo
  };
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return responder(res, { erro: "Falta a variável DATABASE_URL" }, 500);
  }

  try {
    if (req.method === "GET") return responder(res, await montar());

    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      if (b.tipo === "status" && b.key) {
        await sql`insert into status_artes (arte_key, status, remessa, em)
                  values (${corta(b.key, 120)}, ${corta(b.status, 20) || "pendente"},
                          ${corta(b.remessa, 20)}, ${b.em || new Date().toISOString()})
                  on conflict (arte_key) do update
                  set status = excluded.status, remessa = excluded.remessa, em = excluded.em`;

      } else if (b.tipo === "nota" && b.arteKey && b.texto) {
        await sql`insert into anotacoes (arte_key, remessa, texto, criado_em)
                  values (${corta(b.arteKey, 120)}, ${corta(b.remessa, 20)},
                          ${corta(b.texto, 1200)}, ${b.criadoEm || new Date().toISOString()})`;

      } else if (b.tipo === "apagarNota" && b.id) {
        await sql`delete from anotacoes where id = ${b.id}::uuid`;

      } else if (b.tipo === "medicao" && b.id) {
        await sql`insert into medicoes (id, url, cidade, versao, origem, mobile, desktop, medido_em)
                  values (${corta(b.id, 160)}, ${corta(b.url, 400)}, ${corta(b.cidade, 120)},
                          ${corta(b.versao, 40)}, ${corta(b.origem, 20) || "psi"},
                          ${JSON.stringify(b.mobile || {})}, ${JSON.stringify(b.desktop || {})},
                          ${b.medidoEm || new Date().toISOString()})
                  on conflict (id) do update
                  set url = excluded.url, cidade = excluded.cidade, versao = excluded.versao,
                      origem = excluded.origem, mobile = excluded.mobile,
                      desktop = excluded.desktop, medido_em = excluded.medido_em`;

      } else if (b.tipo === "apagarMedicao" && b.id) {
        await sql`delete from medicoes where id = ${corta(b.id, 160)}`;

      } else {
        return responder(res, { erro: "ação desconhecida" }, 400);
      }

      return responder(res, await montar());
    }

    return responder(res, { erro: "método não permitido" }, 405);
  } catch (e) {
    return responder(res, { erro: String(e.message).slice(0, 200) }, 500);
  }
}
