/* Põe o prefixo do produto nas chaves que ainda não têm.

   O painel passou a atender dois produtos (mdv e rgv) e toda chave gravada
   leva o prefixo — mdv:r01__ad01. Os registros criados antes disso não têm,
   e sem a migração as aprovações e anotações sumiriam da tela.

       node ferramentas/prefixar-produto.mjs         mostra o que faria
       node ferramentas/prefixar-produto.mjs --aplicar
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const PREFIXO = "mdv:";                 // tudo que existe hoje é da Turnê
const aplicar = process.argv.includes("--aplicar");

const sts = await sql`select arte_key, status from status_artes where arte_key not like '%:%'`;
const nts = await sql`select id, arte_key, texto from anotacoes where arte_key not like '%:%'`;

console.log(`decisões sem prefixo: ${sts.length}`);
for (const x of sts) console.log(`  ${x.arte_key} → ${PREFIXO}${x.arte_key}  (${x.status})`);
console.log(`anotações sem prefixo: ${nts.length}`);
for (const x of nts) console.log(`  ${x.arte_key} → ${PREFIXO}${x.arte_key}  ${JSON.stringify(x.texto)}`);

if (!aplicar) { console.log("\n(nada mudou — rode com --aplicar)"); process.exit(0); }

await sql`update status_artes set arte_key = ${PREFIXO} || arte_key where arte_key not like '%:%'`;
await sql`update anotacoes  set arte_key = ${PREFIXO} || arte_key where arte_key not like '%:%'`;
console.log(`\nprefixadas: ${sts.length} decisões, ${nts.length} anotações`);
