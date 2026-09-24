import { neon } from "@neondatabase/serverless";

/* Sincroniza o acervo com o Drive, sozinho.
 *
 * GET /api/sincronizar-drive         passo incremental (é o que o cron chama)
 * GET /api/sincronizar-drive?tudo=1  recomeça uma varredura completa
 *
 * Por que em passos: a árvore tem ~1.000 pastas e uma função serverless não
 * tem fôlego para isso numa tacada. Cada execução trabalha ~45s, guarda a
 * fila no banco e para; a próxima continua de onde parou.
 *
 * O incremental só desce em pasta cuja modifiedTime é mais nova que a última
 * sincronização — na prática visita um punhado de pastas e acaba em segundos.
 *
 * Precisa de GOOGLE_API_KEY. A chave lê a pasta mãe porque ela é pública;
 * o Drive compartilhado de eventos é restrito e chave de API não alcança —
 * esse continua sendo território do Apps Script.
 */

const RAIZ = "1msQi2GzhNegZ3zoUp-nZoHUoVNDTf9ni";
const VIDEO = /\.(mp4|mov|m4v|avi|mkv|webm|mpg|mpeg|wmv)$/i;
const ORCAMENTO_MS = 45000;
const DRIVE = "https://www.googleapis.com/drive/v3/files";

let _sql = null;
function conectar() {
  if (_sql) return _sql;
  const env = process.env;
  const vale = (k) => typeof env[k] === "string" && /^postgres(ql)?:\/\//.test(env[k].trim());
  const semPooler = /(UNPOOLED|NON_POOLING|NO_SSL|PRISMA|JDBC)/i;
  const todas = Object.keys(env).filter((k) => /(DATABASE_URL|POSTGRES_URL)/.test(k) && vale(k));
  const k = todas.filter((x) => !semPooler.test(x))[0] || todas[0];
  if (!k) { const e = new Error("sem variável de conexão"); e.semBanco = true; throw e; }
  _sql = neon(env[k].trim());
  return _sql;
}

function responder(res, corpo, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.send(JSON.stringify(corpo));
}

async function listar(pastaId, chave) {
  const itens = [];
  let token = null;
  do {
    const u = new URL(DRIVE);
    u.searchParams.set("q", `'${pastaId}' in parents and trashed=false`);
    u.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime)");
    u.searchParams.set("pageSize", "1000");
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("includeItemsFromAllDrives", "true");
    u.searchParams.set("key", chave);
    if (token) u.searchParams.set("pageToken", token);
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Drive ${r.status} na pasta ${pastaId}`);
    const d = await r.json();
    itens.push(...(d.files || []));
    token = d.nextPageToken || null;
  } while (token);
  return itens;
}

const corta = (v, max) => String(v == null ? "" : v).slice(0, max);

async function gravar(sql, lote) {
  if (!lote.length) return;
  await sql`
    insert into conteudo_acervo (id, titulo, pasta, data_drive, mb, duracao)
    select * from unnest(
      ${lote.map((x) => corta(x.i, 80))}::text[],
      ${lote.map((x) => corta(x.t, 400))}::text[],
      ${lote.map((x) => corta(x.p, 600))}::text[],
      ${lote.map((x) => x.dt || null)}::date[],
      ${lote.map((x) => (Number.isFinite(x.m) ? x.m : null))}::int[],
      ${lote.map(() => "")}::text[]
    )
    on conflict (id) do update set
      titulo = excluded.titulo, pasta = excluded.pasta,
      data_drive = excluded.data_drive, mb = excluded.mb, visto_em = now()`;
}

async function estado(sql, chave) {
  const [r] = await sql`select valor from conteudo_sync where chave = ${chave}`;
  return r ? r.valor : null;
}
async function guardar(sql, chave, valor) {
  await sql`insert into conteudo_sync (chave, valor, em) values (${chave}, ${valor}, now())
            on conflict (chave) do update set valor = excluded.valor, em = now()`;
}

export default async function handler(req, res) {
  const inicio = Date.now();
  try {
    const chave = process.env.GOOGLE_API_KEY;
    if (!chave) return responder(res, { erro: "GOOGLE_API_KEY não configurada" }, 503);

    const sql = conectar();
    await sql`create table if not exists conteudo_sync (
      chave text primary key, valor jsonb not null, em timestamptz not null default now())`;
    await sql`create table if not exists conteudo_acervo (
      id text primary key, titulo text not null, pasta text, data_drive date,
      mb integer, duracao text, visto_em timestamptz not null default now())`;

    const tudo = "tudo" in (req.query || {});
    let fila = (await estado(sql, "fila")) || null;
    const ultima = (await estado(sql, "ultima")) || null;

    if (tudo || !Array.isArray(fila) || !fila.length) {
      fila = [{ id: RAIZ, caminho: "", podar: !tudo && !!ultima }];
    }

    let pastas = 0, videos = 0, lote = [];
    const marcoNovo = new Date().toISOString();

    while (fila.length && Date.now() - inicio < ORCAMENTO_MS) {
      const atual = fila.shift();
      pastas++;
      let filhos;
      try { filhos = await listar(atual.id, chave); }
      catch (e) { console.warn("[sync]", e.message); continue; }

      for (const f of filhos) {
        const pasta = f.mimeType === "application/vnd.google-apps.folder";
        const caminho = atual.caminho ? `${atual.caminho} / ${f.name}` : f.name;
        if (pasta) {
          /* no incremental, só desce onde algo mexeu */
          if (atual.podar && ultima && f.modifiedTime && f.modifiedTime <= ultima) continue;
          fila.push({ id: f.id, caminho, podar: atual.podar });
        } else if (VIDEO.test(f.name)) {
          videos++;
          lote.push({
            i: f.id,
            t: f.name.replace(VIDEO, ""),
            p: atual.caminho,
            dt: (f.modifiedTime || "").slice(0, 10) || null,
            m: f.size ? Math.round(Number(f.size) / (1024 * 1024)) : null
          });
          if (lote.length >= 300) { await gravar(sql, lote); lote = []; }
        }
      }
    }
    await gravar(sql, lote);

    const terminou = !fila.length;
    await guardar(sql, "fila", terminou ? [] : fila);
    if (terminou) await guardar(sql, "ultima", marcoNovo);

    const [{ n }] = await sql`select count(*)::int as n from conteudo_acervo`;
    return responder(res, {
      ok: true, terminou, pastasVistas: pastas, videosGravados: videos,
      pastasNaFila: fila.length, totalNoAcervo: n,
      segundos: Math.round((Date.now() - inicio) / 100) / 10
    });
  } catch (e) {
    console.error("[sincronizar-drive]", e);
    return responder(res, { erro: String((e && e.message) || e).slice(0, 300) }, 500);
  }
}
