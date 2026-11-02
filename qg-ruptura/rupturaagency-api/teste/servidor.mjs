// Teste local sem custo: Blobs local + API do Claude simulada + as Functions de verdade. Uso: node teste/servidor.mjs
import http from 'node:http';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';

const PORTA = Number(process.env.PORT || 8765);
const VERCEL = !!process.env.TESTE_VERCEL;
if (VERCEL) await iniciarSupabaseSimulado();
else await iniciarBlobsLocal();

async function iniciarBlobsLocal() {
const blobs = new BlobsServer({ directory: mkdtempSync(join(tmpdir(), 'blobs-')), token: 'teste' });
const { port: portaBlobs } = await blobs.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: `http://localhost:${portaBlobs}`, uncachedEdgeURL: `http://localhost:${portaBlobs}`, primaryRegion: 'us-east-1', apiURL: `http://localhost:${portaBlobs}`, siteID: 'teste', token: 'teste' })).toString('base64');

// O servidor local de Blobs não devolve ETag na leitura (o Netlify devolve). Sem isto a gravação condicional não seria testada.
globalThis.__x = 0;
const fetchOriginal = globalThis.fetch;
let filaDeGravacao = Promise.resolve();
globalThis.fetch = async (url, op = {}) => {
  if (!String(url).startsWith(`http://localhost:${portaBlobs}`)) return fetchOriginal(url, op);
  if (op.method && op.method.toUpperCase() !== 'GET') { // o servidor local confere o If-Match e grava em passos separados; o Netlify faz os dois de uma vez
    const vez = filaDeGravacao.then(() => fetchOriginal(url, op)).then(async r => { await new Promise(ok => setTimeout(ok, 3)); return r; });
    filaDeGravacao = vez.catch(() => {});
    return vez;
  }
  const caminho = blobs.getLocalPaths(new URL(url)).dataPath;
  for (;;) { // etag precisa ser do mesmo conteúdo lido: se alguém gravou no meio, lê de novo
    const antes = await BlobsServer.generateETag(caminho);
    const r = await fetchOriginal(url, op);
    if (!r.ok) return r;
    const corpo = Buffer.from(await r.arrayBuffer());
    if (antes !== await BlobsServer.generateETag(caminho)) continue;
    const h = new Headers(r.headers); h.set('etag', antes);
    return new Response(corpo, { status: r.status, headers: h });
  }
};
}

// Supabase simulado: o pedaço do PostgREST e do Storage que o projeto usa.
async function iniciarSupabaseSimulado() {
  const kv = new Map(), arquivos = new Map();
  const sb = http.createServer((req, res) => {
    const b = []; req.on('data', d => b.push(d)); req.on('end', () => {
      const u = new URL(req.url, 'http://x'), corpo = Buffer.concat(b), sai = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.headers.apikey !== 'teste-service') return sai(401, {});
      if (u.pathname.startsWith('/storage/v1/object/mockups/')) {
        if (req.method === 'POST') { arquivos.set(u.pathname, [corpo, req.headers['content-type']]); return sai(200, {}); }
        const a = arquivos.get(u.pathname); if (!a) return sai(400, {});
        res.writeHead(200, { 'content-type': a[1] }); return res.end(a[0]);
      }
      const ch = (u.searchParams.get('chave') || '').replace(/^eq\./, ''), ver = (u.searchParams.get('versao') || '').replace(/^eq\./, '');
      if (req.method === 'GET') return sai(200, kv.has(ch) ? [kv.get(ch)] : []);
      const d = JSON.parse(corpo);
      if (req.method === 'PATCH') { const l = kv.get(ch); if (!l || String(l.versao) !== ver) return sai(200, []); const n = { chave: ch, ...d }; kv.set(ch, n); return sai(200, [n]); }
      if (kv.has(d.chave) && /ignore/.test(req.headers.prefer)) return sai(201, []);
      kv.set(d.chave, d); sai(201, [d]);
    });
  });
  await new Promise(r => sb.listen(0, r));
  process.env.SUPABASE_URL = `http://localhost:${sb.address().port}/`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'teste-service';
  process.env.VERCEL = '1';
  process.env.CRON_SECRET = 'cron-teste';
}

// API do Claude simulada: responde em SSE conforme o pedido e guarda o que recebeu.
const pedidos = [];
const claude = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', async () => {
    const q = JSON.parse(b); pedidos.push(q);
    await new Promise(r => setTimeout(r, Number(process.env.DEMORA || 1500)));
    const p = q.messages[0].content;
    const schema = q.output_config?.format?.schema; const ganchos = !!schema?.properties?.ganchos; const design = !!schema?.properties?.pecas;
    const texto = design ? JSON.stringify({ direcao: 'Direção simulada.', paineis: [], pecas: [{ nome: 'Peça 1', uso: 'Cena 1', proporcao: '4:5', prompt: 'A luxury package, studio light' }], avisos: 'Produto fictício.' }) : /plano de grava/.test(p) ? 'PLANO SIMULADO' : /plano de edi/.test(p) ? 'EDIÇÃO SIMULADA' : ganchos ? JSON.stringify({ diagnostico: 'Nota viral 82. Diagnóstico simulado.', favorito: 1, precisaMockup: /luxo/i.test(p), ganchos: [{ angulo: 'contraste', texto: 'Gancho simulado 1', motivo: 'motivo 1' }, { angulo: 'curiosidade', texto: 'Gancho simulado 2', motivo: 'motivo 2' }] })
      : /Pesquisa da semana/.test(p) ? '## Assunto simulado A\n- Série: Personagem\nCarrossel. Por que está quente.\n## Assunto simulado B\nReel. Outro motivo.'
      : /Etapa 5|Etapas 6/.test(p) ? 'ROTEIRO SIMULADO' : /legenda/i.test(p) && /primeira hora/.test(p) ? 'LEGENDA SIMULADA' : /Aprofunde/.test(p) ? 'PESQUISA SIMULADA' : 'RELATÓRIO SIMULADO';
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const ev = (t, d) => res.write(`event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`);
    ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: q.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: texto } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    ev('message_stop', {});
    res.end();
  });
});
await new Promise(r => claude.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://localhost:${claude.address().port}`;
process.env.ANTHROPIC_API_KEY = 'teste';
process.env.RUPTURA_SENHA = 'teste-local';
process.env.SESSAO_SEGREDO = 'segredo-local-so-para-teste-0123456789';

const web = m => r => m.default.fetch(r);
const rotas = VERCEL ? {
  '/api/login': web(await import('../../api/login.js')),
  '/api/estado': web(await import('../../api/estado.js')),
  '/api/agente': web(await import('../../api/agente.js')),
  '/api/metricas': web(await import('../../api/metricas.js')),
  '/api/mockup': web(await import('../../api/mockup.js')),
  '/api/semanal': web(await import('../../api/semanal.js')),
  '/api/agente-background': web(await import('../../api/agente-background.js'))
} : {
  '/api/login': (await import('../netlify/functions/login.js')).default,
  '/api/estado': (await import('../netlify/functions/estado.js')).default,
  '/api/agente': (await import('../netlify/functions/agente.js')).default,
  '/api/metricas': (await import('../netlify/functions/metricas.js')).default,
  '/api/mockup': (await import('../netlify/functions/mockup.js')).default,
  '/.netlify/functions/agente-background': (await import('../netlify/functions/agente-background.js')).default
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  if (url.pathname === '/_pedidos') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(pedidos.map(q => ({ model: q.model, web: !!q.tools, fallbacks: q.fallbacks, esforco: q.output_config?.effort, json: !!q.output_config?.format, inicio: String(q.messages[0].content).slice(0, 70) })))); }
  const f = rotas[url.pathname];
  if (!f) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(readFileSync(new URL('../../rupturaagency-site/index.html', import.meta.url))); }
  const b = []; for await (const d of req) b.push(d);
  const pedido = new Request(url, { method: req.method, headers: req.headers, ...(b.length ? { body: Buffer.concat(b) } : {}) });
  if (url.pathname.includes('background') && !VERCEL) { f(pedido).catch(console.error); res.statusCode = 202; return res.end(); }
  const r = await f(pedido);
  res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORTA, () => console.log('pronto em', PORTA));
