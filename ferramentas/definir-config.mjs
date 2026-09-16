/* Grava (ou mostra) uma configuração na tabela `config` do banco.

       node ferramentas/definir-config.mjs                       lista
       node ferramentas/definir-config.mjs PAGESPEED_API_KEY xyz grava
       node ferramentas/definir-config.mjs PAGESPEED_API_KEY --do-env  copia do .env.local

   Fica no banco de propósito: o único segredo que a hospedagem precisa
   conhecer é a DATABASE_URL.
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = fs.existsSync(path.join(RAIZ, ".env.local"))
  ? fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8") : "";
const leEnv = (k) => (env.match(new RegExp("^" + k + '\\s*=\\s*"?([^"\\n]+)"?', "m")) || [])[1];

const url = process.env.DATABASE_URL || leEnv("DATABASE_URL");
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
const sql = neon(url);

const [chave, valorArg] = process.argv.slice(2);

if (!chave) {
  const r = await sql`select chave, length(valor) as tam, atualizado from config order by chave`;
  if (!r.length) console.log("nenhuma configuração gravada");
  for (const x of r) {
    console.log(`  ${x.chave} · ${x.tam} caracteres · ${x.atualizado.toISOString().slice(0, 19)}`);
  }
  process.exit(0);
}

const valor = valorArg === "--do-env" ? leEnv(chave) : valorArg;
if (!valor) { console.error(`sem valor para ${chave}`); process.exit(1); }

await sql`insert into config (chave, valor) values (${chave}, ${valor})
          on conflict (chave) do update set valor = excluded.valor, atualizado = now()`;
console.log(`${chave} gravada (${valor.length} caracteres)`);
