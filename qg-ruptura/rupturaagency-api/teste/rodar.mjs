// Fluxo de ponta a ponta contra o servidor local.
const U = 'http://localhost:' + (process.env.PORT || 8765);
const espera = ms => new Promise(r => setTimeout(r, ms));
const r = await fetch(U + '/api/login', { method: 'POST', body: JSON.stringify({ senha: 'teste-local' }) });
const cookie = r.headers.get('set-cookie').split(';')[0];
const api = (p, o = {}) => fetch(U + p, { ...o, headers: { cookie } });
const put = (estado, base) => api('/api/estado', { method: 'PUT', body: JSON.stringify({ estado, base }) }).then(x => x.json());
const ler = () => api('/api/estado').then(x => x.json());
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FALHOU', m); if (!c) process.exitCode = 1; };
const ate = async (f, t = 15000) => { const i = Date.now(); while (Date.now() - i < t) { const e = await ler(); if (f(e.estado)) return e; await espera(300); } return ler(); };

const p1 = await put({ arroba: 'lucasfigueiredoart', cards: [{ id: 'r1', titulo: 'Reel', formato: 'Reel', etapa: 'pauta', pesquisa: 'nota do Lucas com link', criado: 1 }, { id: 'c1', titulo: 'Carrossel', formato: 'Carrossel', etapa: 'gancho', criado: 1 }, { id: 'apagada', titulo: 'x', formato: 'Reel', etapa: 'gravar', criado: 1 }] }, 0);
let base = p1.atualizadoEm;
ok((await api('/api/agente', { method: 'POST', body: JSON.stringify({ cardId: 'r1' }) })).status === 202, 'dispara a esteira do reel');
ok((await api('/api/agente', { method: 'POST', body: JSON.stringify({ cardId: 'r1' }) })).status === 409, 'não roda em dobro');
await api('/api/agente', { method: 'POST', body: JSON.stringify({ cardId: 'c1' }) });

// navegador com estado velho salva enquanto os agentes trabalham, e apaga um card
await espera(800);
const m = await put({ arroba: 'lucasfigueiredoart', nicho: 'branding', cards: [{ id: 'r1', titulo: 'Reel', formato: 'Reel', etapa: 'pauta', pesquisa: 'nota do Lucas com link', criado: 1 }, { id: 'c1', titulo: 'Carrossel', formato: 'Carrossel', etapa: 'gancho', criado: 1 }] }, base);
ok(!!m.estado, 'PUT velho devolve o estado mesclado');

let e = await ate(s => s.cards.every(c => !c.agente) && s.cards.find(c => c.id === 'r1').etapa === 'gravar' && s.cards.find(c => c.id === 'c1').etapa === 'design');
const r1 = e.estado.cards.find(c => c.id === 'r1'), c1 = e.estado.cards.find(c => c.id === 'c1');
ok(r1.etapa === 'gravar', 'reel parou no Estúdio');
ok(r1.pedido === 'nota do Lucas com link' && r1.pesquisa.includes('PESQUISA SIMULADA') && r1.pesquisa.includes('nota do Lucas'), 'pesquisa mantém o pedido');
ok(r1.ganchos.length === 2 && r1.escolhido === 1 && r1.diagnostico, 'ganchos com favorito');
ok(r1.roteiro === 'ROTEIRO SIMULADO', 'roteiro escrito');
console.log('c1', JSON.stringify({etapa:c1.etapa, roteiro:c1.roteiro, agente:c1.agente}));
ok(c1.etapa === 'design' && c1.roteiro === 'ROTEIRO SIMULADO' && c1.design?.pecas?.length === 1, 'carrossel vai para o Designer');
ok(r1.planoGravacao === 'PLANO SIMULADO', 'Estúdio deixa o plano de gravação');
ok(!e.estado.cards.some(c => c.id === 'apagada'), 'card apagado não volta');
ok(e.estado.nicho === 'branding', 'edição do navegador mantida');

await api('/api/agente', { method: 'POST', body: JSON.stringify({ acao: 'semana' }) });
e = await ate(s => s.cards.length >= 4 && s.cards.every(c => !c.agente) && !s.agentes?.semana);
const a = e.estado.cards.filter(c => c.id.startsWith('a'));
console.log('a', JSON.stringify(a.map(c=>({t:c.titulo,f:c.formato,e:c.etapa,r:c.roteiro,ag:c.agente}))));
ok(a.length === 2 && a.every(c => c.roteiro && ['gravar', 'design'].includes(c.etapa)), 'pesquisa da semana criou pautas e levou até o roteiro');
ok(a.find(c => c.titulo === 'Assunto simulado A')?.formato === 'Carrossel', 'formato lido da pesquisa');

// pauta criada pelo agente sobrevive a navegador que ainda não a viu; apagada depois de vista não volta
const luxo = await put({ ...e.estado, cards: [{ id: 'lx', titulo: 'E se o Bombril fosse marca de luxo?', formato: 'Reel', etapa: 'gancho', pesquisado: true, criado: 1 }, ...e.estado.cards] }, e.atualizadoEm);
await api('/api/agente', { method: 'POST', body: JSON.stringify({ cardId: 'lx' }) });
e = await ate(s => { const c = s.cards.find(x => x.id === 'lx'); return c && !c.agente && c.etapa === 'design'; });
let lx = e.estado.cards.find(c => c.id === 'lx');
ok(lx.etapa === 'design' && lx.mockup && lx.design?.pecas?.length === 1, 'pauta de luxo vai para o Designer');
const up = await api('/api/mockup?card=lx&peca=0', { method: 'POST', body: Buffer.from([255, 216, 255, 217]) });
const uj = await up.json();
const g = await api(uj.url);
ok(up.ok && g.ok && (await g.arrayBuffer()).byteLength === 4, 'mockup enviado e lido');
ok((await fetch(U + uj.url)).status === 401, 'mockup pede login');
e = await ler(); lx = e.estado.cards.find(c => c.id === 'lx');
ok(lx.design.pecas[0].img === uj.url, 'imagem presa à peça');
const velho = { arroba: 'lucasfigueiredoart', cards: [] };
const k = await put(velho, base);
ok(k.estado?.cards?.some(c => c.id.startsWith('a')), 'pauta do agente não some em PUT velho');
const k2 = await put({ ...k.estado, cards: k.estado.cards.filter(c => !c.id.startsWith('a')) }, k.atualizadoEm);
ok(!k2.estado, 'apagar depois de ver funciona');

await api('/api/agente', { method: 'POST', body: JSON.stringify({ acao: 'analise' }) });
e = await ate(s => s.relatorios?.analise);
ok(e.estado.relatorios?.analise?.texto === 'RELATÓRIO SIMULADO', 'relatório do Social');
ok((await fetch(U + '/api/agente', { method: 'POST', body: '{}' })).status === 401, 'sem login não dispara');
const ps = await fetch(U + '/_pedidos').then(x => x.json());
console.log(ps.length, 'chamadas', JSON.stringify(ps.slice(0, 3)));
ok(ps.every(p => p.model === 'claude-opus-5-5' && p.fallbacks === 'default' && p.esforco === 'high'), 'modelo, fallback e esforço');
ok(ps.filter(p => p.web).every(p => /Aprofunde|Pesquisa da semana/.test(p.inicio)) && ps.some(p => p.web), 'só a pesquisa usa web');
if (process.env.TESTE_VERCEL) {
  ok((await fetch(U + '/api/semanal')).status === 401, 'cron sem segredo é recusado');
  ok((await fetch(U + '/api/semanal', { headers: { authorization: 'Bearer cron-teste' } })).status === 200, 'cron dispara a pesquisa');
  ok((await fetch(U + '/api/agente-background', { method: 'POST', body: '{"acao":"semana"}' })).status === 401, 'agente em segundo plano pede token');
}
process.exit(process.exitCode || 0);
