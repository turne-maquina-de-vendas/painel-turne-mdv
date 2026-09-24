import { neon } from "@neondatabase/serverless";

/* Central de Conteúdo: acervo decupado e fila de edição.
 *
 * GET  /api/conteudo   devolve { cortes, videos }
 * POST /api/conteudo   grava ou apaga um registro
 *        { op:"set", col:"cortes"|"videos", doc }   doc.id obrigatório
 *        { op:"del", col:"cortes"|"videos", id }
 *
 * Cada trecho é uma linha própria — dois mineradores marcando ao mesmo
 * tempo nunca se sobrescrevem. Era esse o problema de guardar tudo num
 * documento só, que é como isto rodava no Netlify Blobs antes.
 */

const sql = neon(process.env.DATABASE_URL);

const corta = (v, max) => String(v == null ? "" : v).slice(0, max);
const inteiro = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

function responder(res, corpo, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify(corpo));
}

async function montar() {
  const [cortes, videos] = await Promise.all([
    sql`select * from conteudo_cortes order by criado_em asc limit 5000`,
    sql`select * from conteudo_videos order by criado_em desc limit 2000`
  ]);

  return {
    cortes: cortes.map((r) => ({
      id: r.id,
      brutoId: r.bruto_id,
      brutoNome: r.bruto_nome || "",
      brutoLink: r.bruto_link || "",
      tcIn: r.tc_in || "",
      tcOut: r.tc_out || "",
      dur: r.duracao || 0,
      headline: r.headline || "",
      minutadoPor: r.minutado_por || "",
      editoria: r.editoria || "",
      produto: r.produto || "",
      obs: r.obs || "",
      responsavel: r.responsavel || "",
      rede: r.rede || "",
      status: r.status || "",
      linkEditado: r.link_editado || "",
      nota: r.nota || "",
      desempenho: r.desempenho || "",
      dataPost: r.data_post || "",
      criadoEm: r.criado_em
    })),
    videos: videos.map((r) => ({
      id: r.id,
      link: r.link,
      nome: r.nome,
      tema: r.tema || "",
      dur: r.duracao || "",
      obs: r.obs || "",
      criadoEm: r.criado_em
    }))
  };
}

async function gravarCorte(d) {
  await sql`
    insert into conteudo_cortes (
      id, bruto_id, bruto_nome, bruto_link, tc_in, tc_out, duracao,
      headline, minutado_por, editoria, produto, obs, responsavel, rede,
      status, link_editado, nota, desempenho, data_post
    ) values (
      ${corta(d.id, 40)}, ${corta(d.brutoId, 80)}, ${corta(d.brutoNome, 300)},
      ${corta(d.brutoLink, 500)}, ${corta(d.tcIn, 12)}, ${corta(d.tcOut, 12)},
      ${inteiro(d.dur)}, ${corta(d.headline, 1000)}, ${corta(d.minutadoPor, 80)},
      ${corta(d.editoria, 80)}, ${corta(d.produto, 60)}, ${corta(d.obs, 1000)},
      ${corta(d.responsavel, 80)}, ${corta(d.rede, 120)}, ${corta(d.status, 20)},
      ${corta(d.linkEditado, 500)}, ${corta(d.nota, 20)}, ${corta(d.desempenho, 200)},
      ${corta(d.dataPost, 12)}
    )
    on conflict (id) do update set
      bruto_id = excluded.bruto_id, bruto_nome = excluded.bruto_nome,
      bruto_link = excluded.bruto_link, tc_in = excluded.tc_in,
      tc_out = excluded.tc_out, duracao = excluded.duracao,
      headline = excluded.headline, minutado_por = excluded.minutado_por,
      editoria = excluded.editoria, produto = excluded.produto,
      obs = excluded.obs, responsavel = excluded.responsavel,
      rede = excluded.rede, status = excluded.status,
      link_editado = excluded.link_editado, nota = excluded.nota,
      desempenho = excluded.desempenho, data_post = excluded.data_post,
      atualizado_em = now()`;
}

async function gravarVideo(d) {
  await sql`
    insert into conteudo_videos (id, link, nome, tema, duracao, obs)
    values (${corta(d.id, 40)}, ${corta(d.link, 500)}, ${corta(d.nome, 300)},
            ${corta(d.tema, 80)}, ${corta(d.dur, 12)}, ${corta(d.obs, 1000)})
    on conflict (id) do update set
      link = excluded.link, nome = excluded.nome, tema = excluded.tema,
      duracao = excluded.duracao, obs = excluded.obs`;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return responder(res, await montar());

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const videos = body.col === "videos";

      if (body.op === "del") {
        if (!body.id) return responder(res, { erro: "sem id" }, 400);
        if (videos) {
          /* apagar o vídeo leva os trechos dele junto */
          await sql`delete from conteudo_cortes where bruto_id = ${body.id}`;
          await sql`delete from conteudo_videos where id = ${body.id}`;
        } else {
          await sql`delete from conteudo_cortes where id = ${body.id}`;
        }
        return responder(res, { ok: true });
      }

      if (body.op === "set") {
        const doc = body.doc || {};
        if (!doc.id) return responder(res, { erro: "sem id" }, 400);
        if (videos) await gravarVideo(doc);
        else await gravarCorte(doc);
        return responder(res, { ok: true });
      }

      return responder(res, { erro: "op inválida" }, 400);
    }

    return responder(res, { erro: "método não suportado" }, 405);
  } catch (e) {
    console.error("[conteudo]", e);
    return responder(res, { erro: "falha no banco" }, 500);
  }
}
