/* Registra uma medição feita à mão, aplicando a mesma regra do painel:
   a maior nota prevalece, venha de onde vier. A medição informada fica
   como `ultima`, para o painel mostrar "agora N" quando ela for menor.

       node ferramentas/anotar-medicao.mjs <trecho-da-url> <mobile> <desktop>
       node ferramentas/anotar-medicao.mjs campinagrande-v4 78 79

   Com --forcar, o valor informado passa a ser o único: descarta o recorde
   anterior. Serve para quando a nota alta foi um acaso e não representa a
   página — a regra da maior nota deixa de valer para aquela entrada, até a
   próxima rodada automática.

       node ferramentas/anotar-medicao.mjs ribeiraopreto-v5 89 --forcar
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const TETO = 95;   // nota 100 no laboratório é ilusória; ver api/medir.js
const limitar = (n) => (Number.isFinite(n) ? Math.min(TETO, n) : n);

const args = process.argv.slice(2);
const forcar = args.includes("--forcar");
const [trecho, mobStr, deskStr] = args.filter((a) => a !== "--forcar");
if (!trecho) { console.error("informe um trecho da URL, ex: campinagrande-v4"); process.exit(1); }
const novo = { mobile: Number(mobStr), desktop: Number(deskStr) };

const achadas = await sql`select id, cidade, versao, mobile, desktop from medicoes
                          where url like ${"%" + trecho + "%"}`;
if (achadas.length !== 1) {
  console.error(`esperava 1 página, achei ${achadas.length}`);
  achadas.forEach((a) => console.error("  " + a.id));
  process.exit(1);
}
const p = achadas[0];

function juntar(antes, agora) {
  if (!Number.isFinite(agora)) return antes;           // não informado: não mexe
  const { ultima, ...resto } = antes || {};
  return { ...resto, nota: limitar(agora), amostras: [agora] };
}

const mob = juntar(p.mobile, novo.mobile);
const desk = juntar(p.desktop, novo.desktop);

await sql`update medicoes set mobile = ${JSON.stringify(mob)}, desktop = ${JSON.stringify(desk)},
                              medido_em = now(), origem = 'psi'
          where id = ${p.id}`;

console.log(`${p.cidade} ${p.versao}`);
console.log(`  mobile : ${(p.mobile || {}).nota ?? "—"} + ${novo.mobile} → ${mob.nota}` +
            (mob.ultima < mob.nota ? `  (agora ${mob.ultima})` : ""));
console.log(`  desktop: ${(p.desktop || {}).nota ?? "—"} + ${novo.desktop} → ${desk.nota}` +
            (desk.ultima < desk.nota ? `  (agora ${desk.ultima})` : ""));
