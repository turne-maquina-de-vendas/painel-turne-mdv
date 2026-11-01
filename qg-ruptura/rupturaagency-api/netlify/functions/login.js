// GET    /api/login  → 200 { logado: true }  |  401 { logado: false }
// POST   /api/login  → body { senha } → 200 { ok: true } + cookie  |  401 { ok: false, erro }
// DELETE /api/login  → apaga o cookie
import { conferirSenha, criarCookie, cookieSair, lerSessao, json, naoAutorizado } from '../../lib/sessao.js';

export default async (request) => {
  if (request.method === 'GET') return lerSessao(request) ? json({ logado: true }) : naoAutorizado();
  if (request.method === 'POST') {
    let corpo = {};
    try { corpo = await request.json(); } catch {}
    if (!conferirSenha(corpo.senha)) {
      await new Promise(r => setTimeout(r, 600)); // freia tentativa e erro
      return json({ ok: false, erro: 'Senha incorreta.' }, 401);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': criarCookie() });
  }
  if (request.method === 'DELETE') return json({ ok: true }, 200, { 'Set-Cookie': cookieSair });
  return json({ erro: 'Método não permitido.' }, 405);
};

export const config = { path: '/api/login' };
