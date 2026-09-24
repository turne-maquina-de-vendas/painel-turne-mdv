/* Traz a Central de Conteúdo do Netlify Blobs para o Postgres.
   Roda quantas vezes quiser: regrava por id.

       node ferramentas/importar-conteudo.mjs
       node ferramentas/importar-conteudo.mjs backup.json
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORIGEM = "https://central-de-conteudo-r1.netlify.app/api/banco";

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const arq = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(arq)) {
    console.error("Falta DATABASE_URL: crie .env.local a partir de .env.example");
    process.exit(1);
  }
  const m = fs.readFileSync(arq, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  if (!m) { console.error("DATABASE_URL não encontrada em .env.local"); process.exit(1); }
  return m[1];
}

const sql = neon(url());
const corta = (v, max) => String(v == null ? "" : v).slice(0, max);
const inteiro = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

const arquivo = process.argv[2];
const dados = arquivo
  ? JSON.parse(fs.readFileSync(arquivo, "utf8"))
  : await (await fetch(ORIGEM)).json();

for (const v of dados.videos || []) {
  if (!v.id) continue;
  await sql`
    insert into conteudo_videos (id, link, nome, tema, duracao, obs)
    values (${corta(v.id,40)}, ${corta(v.link,500)}, ${corta(v.nome,300)},
            ${corta(v.tema,80)}, ${corta(v.dur,12)}, ${corta(v.obs,1000)})
    on conflict (id) do update set
      link = excluded.link, nome = excluded.nome, tema = excluded.tema,
      duracao = excluded.duracao, obs = excluded.obs`;
}

for (const c of dados.cortes || []) {
  if (!c.id) continue;
  await sql`
    insert into conteudo_cortes (
      id, bruto_id, bruto_nome, bruto_link, tc_in, tc_out, duracao,
      headline, minutado_por, editoria, produto, obs, responsavel, rede,
      status, link_editado, nota, desempenho, data_post
    ) values (
      ${corta(c.id,40)}, ${corta(c.brutoId,80)}, ${corta(c.brutoNome,300)},
      ${corta(c.brutoLink,500)}, ${corta(c.tcIn,12)}, ${corta(c.tcOut,12)},
      ${inteiro(c.dur)}, ${corta(c.headline,1000)}, ${corta(c.minutadoPor,80)},
      ${corta(c.editoria,80)}, ${corta(c.produto,60)}, ${corta(c.obs,1000)},
      ${corta(c.responsavel,80)}, ${corta(c.rede,120)}, ${corta(c.status,20)},
      ${corta(c.linkEditado,500)}, ${corta(c.nota,20)}, ${corta(c.desempenho,200)},
      ${corta(c.dataPost,12)}
    )
    on conflict (id) do update set
      headline = excluded.headline, status = excluded.status,
      link_editado = excluded.link_editado, atualizado_em = now()`;
}

console.log(`importado: ${(dados.videos||[]).length} vídeos, ${(dados.cortes||[]).length} trechos`);
