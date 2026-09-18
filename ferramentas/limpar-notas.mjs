/* Zera as notas para que a próxima medição escreva números reais.

   Usar quando a regra de pontuação muda e os valores guardados deixam de
   significar o que o painel diz que significam — foi o caso do recorde
   histórico, que tinha empurrado tudo para o teto.

       node ferramentas/limpar-notas.mjs --aplicar
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const r = await sql`select id, cidade, versao, mobile, desktop from medicoes order by versao, cidade`;
let inflados = 0;
for (const x of r) {
  const u = (v) => (v || {}).ultima;
  if (Number.isFinite(u(x.mobile)) || Number.isFinite(u(x.desktop))) inflados++;
}
console.log(`${r.length} medições · ${inflados} com nota acima da medição real`);

if (!process.argv.includes("--aplicar")) { console.log("(nada mudou — rode com --aplicar)"); process.exit(0); }

await sql`update medicoes set mobile = null, desktop = null, medido_em = null`;
await sql`delete from execucoes`;
console.log("notas zeradas — a próxima rodada grava as reais");
