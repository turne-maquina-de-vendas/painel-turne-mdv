// Mesmo contrato do Netlify Blobs usado no projeto, em cima do Supabase: tabela ruptura_kv para dados e bucket mockups para imagens.
const base = () => process.env.SUPABASE_URL.replace(/\/$/, '');
const chaveApi = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
// As chaves novas (sb_secret_...) vão só no apikey; as antigas, em formato JWT, também no Authorization.
const cab = (extra = {}) => ({ apikey: chaveApi(), ...(chaveApi().startsWith('eyJ') ? { Authorization: `Bearer ${chaveApi()}` } : {}), ...extra });
const tabela = () => `${base()}/rest/v1/ruptura_kv`;
const eq = v => encodeURIComponent(`eq.${v}`);
const ehImagem = k => k.startsWith('mockups/');
const objeto = k => `${base()}/storage/v1/object/mockups/${k.slice('mockups/'.length)}`;

async function checar(r) {
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}.`);
  return r;
}

async function lerLinha(k) {
  const r = await checar(await fetch(`${tabela()}?chave=${eq(k)}&select=valor,versao`, { headers: cab() }));
  return (await r.json())[0] || null;
}

async function gravar(k, valor, { onlyIfMatch, onlyIfNew } = {}) {
  const versao = Date.now();
  const corpo = JSON.stringify({ chave: k, valor, versao });
  let r;
  if (onlyIfMatch) {
    r = await fetch(`${tabela()}?chave=${eq(k)}&versao=${eq(onlyIfMatch)}`, { method: 'PATCH', headers: cab({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ valor, versao }) });
  } else {
    r = await fetch(`${tabela()}?on_conflict=chave`, { method: 'POST', headers: cab({ 'Content-Type': 'application/json', Prefer: `resolution=${onlyIfNew ? 'ignore' : 'merge'}-duplicates,return=representation` }), body: corpo });
  }
  await checar(r);
  return { modified: (await r.json()).length > 0, etag: String(versao) };
}

export const lojaSupabase = () => ({
  async get(k, { type } = {}) {
    const l = await lerLinha(k);
    if (!l) return null;
    return type === 'json' ? l.valor : String(l.valor);
  },
  async getWithMetadata(k, { type } = {}) {
    if (ehImagem(k)) {
      const r = await fetch(objeto(k), { headers: cab() });
      if (r.status === 400 || r.status === 404) return null;
      await checar(r);
      return { data: await r.arrayBuffer(), etag: null, metadata: { tipo: r.headers.get('content-type') } };
    }
    const l = await lerLinha(k);
    return l ? { data: type === 'json' ? l.valor : String(l.valor), etag: String(l.versao), metadata: {} } : null;
  },
  setJSON: (k, valor, opcoes) => gravar(k, valor, opcoes),
  async set(k, valor, { metadata } = {}) {
    if (!ehImagem(k)) return gravar(k, valor);
    await checar(await fetch(objeto(k), { method: 'POST', headers: cab({ 'Content-Type': metadata?.tipo || 'application/octet-stream', 'x-upsert': 'true' }), body: valor }));
    return { modified: true };
  }
});
