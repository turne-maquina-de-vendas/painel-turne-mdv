/* Mostra o que está guardado no banco.   node ferramentas/ver-banco.mjs */
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);

const [[a], [s], [m], cfg] = await Promise.all([
  sql`select count(*)::int n from anotacoes`,
  sql`select count(*)::int n from status_artes`,
  sql`select count(*)::int n from medicoes`,
  sql`select chave, length(valor) tam from config order by chave`
]);
console.log(`anotações ${a.n} · decisões ${s.n} · medições ${m.n}`);
console.log("config:", cfg.map((c) => `${c.chave}(${c.tam})`).join(", ") || "vazia");

console.log("\núltimas medições:");
const r = await sql`select cidade, versao, mobile->'nota' m, mobile->'amostras' ma,
                           desktop->'nota' d, desktop->'amostras' da
                    from medicoes order by medido_em desc nulls last limit 6`;
for (const x of r) {
  console.log(`  ${String(x.cidade).slice(0, 22).padEnd(22)} ${String(x.versao).padEnd(11)}` +
              ` mob ${String(x.m).padStart(3)} ${JSON.stringify(x.ma)}  desk ${String(x.d).padStart(3)} ${JSON.stringify(x.da)}`);
}

console.log("\nanotações:");
for (const n of await sql`select arte_key, texto, criado_em from anotacoes order by criado_em`) {
  console.log(`  ${n.arte_key.padEnd(12)} ${JSON.stringify(n.texto)}`);
}
