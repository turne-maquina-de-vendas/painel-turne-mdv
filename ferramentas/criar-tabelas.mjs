/* Cria (ou confere) as tabelas do painel no Postgres.
   Idempotente: pode rodar quantas vezes quiser.

       node ferramentas/criar-tabelas.mjs
*/
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

const v = await sql`select version()`;
console.log("conectado:", v[0].version.split(",")[0]);

await sql`create table if not exists anotacoes (
  id        uuid primary key default gen_random_uuid(),
  arte_key  text not null,
  remessa   text,
  texto     text not null,
  criado_em timestamptz not null default now()
)`;
await sql`create index if not exists anotacoes_arte on anotacoes (arte_key)`;
await sql`create index if not exists anotacoes_criado on anotacoes (criado_em)`;

await sql`create table if not exists status_artes (
  arte_key text primary key,
  status   text not null,
  remessa  text,
  em       timestamptz not null default now()
)`;

await sql`create table if not exists medicoes (
  id        text primary key,
  url       text,
  cidade    text,
  versao    text,
  origem    text,
  mobile    jsonb,
  desktop   jsonb,
  medido_em timestamptz
)`;

await sql`create table if not exists execucoes (
  parte  text primary key,
  dados  jsonb not null,
  quando timestamptz not null default now()
)`;

const t = await sql`select table_name from information_schema.tables
                    where table_schema='public' order by table_name`;
console.log("tabelas:", t.map((r) => r.table_name).join(", "));
