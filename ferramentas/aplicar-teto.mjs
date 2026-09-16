/* Baixa para 95 as notas já gravadas que passaram do teto.
   Roda uma vez depois de mudar o TETO; é idempotente.

       node ferramentas/aplicar-teto.mjs
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const TETO = 95;
const acima = await sql`select id, cidade, versao, mobile, desktop from medicoes
                        where (mobile->>'nota')::int > ${TETO}
                           or (desktop->>'nota')::int > ${TETO}`;

for (const x of acima) {
  const corta = (v) => {
    if (!v || !Number.isFinite(v.nota)) return v;
    const out = { ...v, nota: Math.min(TETO, v.nota) };
    if (Number.isFinite(out.ultima)) out.ultima = Math.min(TETO, out.ultima);
    if (out.ultima >= out.nota) delete out.ultima;   // sem "agora" redundante
    return out;
  };
  const mob = corta(x.mobile), desk = corta(x.desktop);
  await sql`update medicoes set mobile = ${JSON.stringify(mob)}, desktop = ${JSON.stringify(desk)}
            where id = ${x.id}`;
  console.log(`  ${x.cidade.slice(0,22).padEnd(22)} ${x.versao.padEnd(11)}` +
              ` mob ${x.mobile?.nota}→${mob?.nota}  desk ${x.desktop?.nota}→${desk?.nota}`);
}
console.log(`\n${acima.length} registros ajustados`);
