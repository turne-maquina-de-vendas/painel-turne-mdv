/* Apaga anotações e decisões de uma remessa — para quando as artes daquela
   remessa são substituídas e os registros antigos não podem grudar nas novas.

       node ferramentas/limpar-remessa.mjs r02          mostra o que apagaria
       node ferramentas/limpar-remessa.mjs r02 --apagar apaga
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const remessa = process.argv[2];
const apagar = process.argv.includes("--apagar");
if (!remessa) { console.error("informe a remessa, ex: r02"); process.exit(1); }
const prefixo = remessa + "\\_\\_%";

const notas = await sql`select id, arte_key, texto, criado_em from anotacoes
                        where arte_key like ${prefixo} order by criado_em`;
const sts = await sql`select arte_key, status from status_artes
                      where arte_key like ${prefixo} order by arte_key`;

console.log(`anotações (${notas.length}):`);
for (const n of notas) console.log(`  ${n.arte_key} → ${JSON.stringify(n.texto)}`);
console.log(`decisões (${sts.length}):`);
for (const s of sts) console.log(`  ${s.arte_key} → ${s.status}`);

if (!apagar) { console.log("\n(nada apagado — rode com --apagar)"); process.exit(0); }

await sql`delete from anotacoes where arte_key like ${prefixo}`;
await sql`delete from status_artes where arte_key like ${prefixo}`;
console.log(`\napagados: ${notas.length} anotações, ${sts.length} decisões`);
