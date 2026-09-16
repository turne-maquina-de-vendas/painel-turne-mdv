/* Traz o que estava guardado no Netlify Blobs para o Postgres.
   Idempotente nas decisões e medições; anotações são inseridas só se
   ainda não existir uma igual (mesma arte, mesmo texto, mesmo instante).

       node ferramentas/migrar-do-netlify.mjs [arquivo.json]
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const arquivo = process.argv[2] || "/tmp/dados-netlify.json";
const d = JSON.parse(fs.readFileSync(arquivo, "utf8"));

let n = 0;
for (const [chave, v] of Object.entries(d.artes || {})) {
  await sql`insert into status_artes (arte_key, status, remessa, em)
            values (${chave}, ${v.status || "pendente"}, ${v.remessa || null},
                    ${v.em || new Date().toISOString()})
            on conflict (arte_key) do update
            set status = excluded.status, remessa = excluded.remessa, em = excluded.em`;
  n++;
}
console.log("decisões:", n);

let a = 0, pulei = 0;
for (const nota of d.anotacoes || []) {
  const ja = await sql`select 1 from anotacoes
                       where arte_key = ${nota.arteKey} and texto = ${nota.texto}
                         and criado_em = ${nota.criadoEm} limit 1`;
  if (ja.length) { pulei++; continue; }
  await sql`insert into anotacoes (arte_key, remessa, texto, criado_em)
            values (${nota.arteKey}, ${nota.remessa || null}, ${nota.texto}, ${nota.criadoEm})`;
  a++;
}
console.log("anotações:", a, pulei ? `(${pulei} já existiam)` : "");

let m = 0;
for (const x of Object.values(d.medicoes || {})) {
  await sql`insert into medicoes (id, url, cidade, versao, origem, mobile, desktop, medido_em)
            values (${x.id}, ${x.url || null}, ${x.cidade || null}, ${x.versao || null},
                    ${x.origem || "psi"}, ${JSON.stringify(x.mobile || {})},
                    ${JSON.stringify(x.desktop || {})}, ${x.medidoEm || null})
            on conflict (id) do update
            set url = excluded.url, cidade = excluded.cidade, versao = excluded.versao,
                origem = excluded.origem, mobile = excluded.mobile,
                desktop = excluded.desktop, medido_em = excluded.medido_em`;
  m++;
}
console.log("medições:", m);

if (d.execucao) {
  await sql`insert into execucoes (parte, dados) values ('migrado', ${JSON.stringify(d.execucao)})
            on conflict (parte) do update set dados = excluded.dados, quando = now()`;
  console.log("execução: 1");
}
