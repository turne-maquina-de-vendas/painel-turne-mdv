import { neon } from "@neondatabase/serverless";

/* Acervo de vídeos do Drive.
 *
 * GET  /api/acervo   devolve a lista inteira (id, título, pasta, data, tamanho)
 * POST /api/acervo   recebe o que mudou, vindo do Apps Script
 *      cabeçalho x-sincronia: <SINCRONIA_TOKEN>
 *      { modo:"upsert"|"substituir", itens:[{i,t,p,dt,m}], apagar:[id] }
 *
 * Por que Apps Script e não a API do Drive: a API exige projeto no Google
 * Cloud e credencial, e ainda assim não enxerga o Drive compartilhado de
 * eventos, que é restrito. O Apps Script roda como uma pessoa do time e
 * vê tudo que ela vê.
 */

let _sql = null;
function acharUrl() {
  const env = process.env;
  const vale = (k) => typeof env[k] === "string" && /^postgres(ql)?:\/\//.test(env[k].trim());
  for (const k of ["DATABASE_URL", "POSTGRES_URL"]) if (vale(k)) return env[k].trim();
  const semPooler = /(UNPOOLED|NON_POOLING|NO_SSL|PRISMA|JDBC)/i;
  const todas = Object.keys(env).filter((k) => /(DATABASE_URL|POSTGRES_URL)/.test(k) && vale(k));
  const k = todas.filter((x) => !semPooler.test(x))[0] || todas[0];
  return k ? env[k].trim() : null;
}
function conectar() {
  if (_sql) return _sql;
  const url = acharUrl();
  if (!url) { const e = new Error("nenhuma variável de conexão encontrada"); e.semBanco = true; throw e; }
  _sql = neon(url);
  return _sql;
}

let preparado = null;
function preparar() {
  if (!preparado) preparado = montar().catch((e) => { preparado = null; throw e; });
  return preparado;
}
async function montar() {
  const sql = conectar();
  await sql`create table if not exists conteudo_acervo (
    id            text primary key,
    titulo        text not null,
    pasta         text,
    data_drive    date,
    mb            integer,
    duracao       text,
    visto_em      timestamptz not null default now()
  )`;
  await sql`create index if not exists conteudo_acervo_pasta on conteudo_acervo (pasta)`;
  await sql`create index if not exists conteudo_acervo_data  on conteudo_acervo (data_drive desc)`;
}

function responder(res, corpo, status = 200, cache) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", cache || "no-store");
  res.send(JSON.stringify(corpo));
}

const corta = (v, max) => String(v == null ? "" : v).slice(0, max);
const inteiro = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : null);

export default async function handler(req, res) {
  try {
    await preparar();
    const sql = conectar();

    if (req.method === "GET") {
      const linhas = await sql`
        select id, titulo, pasta, data_drive, mb, duracao
          from conteudo_acervo order by data_drive desc nulls last, titulo asc`;
      /* cache na borda: a lista muda no máximo de hora em hora, e são
         milhares de linhas — não faz sentido ir ao banco a cada visita */
      return responder(res,
        linhas.map((r) => ({
          i: r.id, t: r.titulo, p: r.pasta || "",
          dt: r.data_drive ? new Date(r.data_drive).toISOString().slice(0, 10) : "",
          m: r.mb || "", d: r.duracao || ""
        })),
        200, "public, s-maxage=600, stale-while-revalidate=3600");
    }

    if (req.method === "POST") {
      const token = process.env.SINCRONIA_TOKEN;
      if (!token) return responder(res, { erro: "SINCRONIA_TOKEN não configurado no projeto" }, 503);
      if (req.headers["x-sincronia"] !== token) return responder(res, { erro: "token inválido" }, 401);

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const itens = Array.isArray(body.itens) ? body.itens : [];
      const apagar = Array.isArray(body.apagar) ? body.apagar : [];

      if (body.modo === "substituir" && itens.length) await sql`delete from conteudo_acervo`;

      let gravados = 0;
      /* em lotes: uma consulta por item derrubaria o tempo da função */
      for (let i = 0; i < itens.length; i += 200) {
        const lote = itens.slice(i, i + 200).filter((x) => x && x.i);
        if (!lote.length) continue;
        await sql`
          insert into conteudo_acervo (id, titulo, pasta, data_drive, mb, duracao)
          select * from unnest(
            ${lote.map((x) => corta(x.i, 80))}::text[],
            ${lote.map((x) => corta(x.t, 400))}::text[],
            ${lote.map((x) => corta(x.p, 600))}::text[],
            ${lote.map((x) => data(x.dt))}::date[],
            ${lote.map((x) => inteiro(x.m))}::int[],
            ${lote.map((x) => corta(x.d, 12))}::text[]
          )
          on conflict (id) do update set
            titulo = excluded.titulo, pasta = excluded.pasta,
            data_drive = excluded.data_drive, mb = excluded.mb,
            duracao = excluded.duracao, visto_em = now()`;
        gravados += lote.length;
      }

      if (apagar.length) await sql`delete from conteudo_acervo where id = any(${apagar}::text[])`;

      const [{ n }] = await sql`select count(*)::int as n from conteudo_acervo`;
      return responder(res, { ok: true, gravados, apagados: apagar.length, total: n });
    }

    return responder(res, { erro: "método não suportado" }, 405);
  } catch (e) {
    console.error("[acervo]", e);
    return responder(res, {
      erro: e.semBanco ? "sem banco configurado" : "falha no banco",
      detalhe: String((e && e.message) || e).slice(0, 300)
    }, 500);
  }
}
