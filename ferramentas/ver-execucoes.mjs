import { neon } from "@neondatabase/serverless";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL ||
  fs.readFileSync(path.join(RAIZ,".env.local"),"utf8").match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)[1];
const sql = neon(url);
for (const r of await sql`select parte, dados, quando from execucoes order by quando desc`) {
  console.log(` ${r.parte.padEnd(10)} ${r.quando.toISOString().slice(0,19)}  ${JSON.stringify(r.dados)}`);
}
