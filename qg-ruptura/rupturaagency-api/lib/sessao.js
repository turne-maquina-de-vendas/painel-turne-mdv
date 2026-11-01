// Sessão por cookie assinado (HMAC-SHA256), só com senha (sem usuário). Mesmo padrão do graziemails.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'ruptura_sessao';
const DURACAO = 60 * 60 * 24 * 60; // 60 dias

function segredo() {
  const s = process.env.SESSAO_SEGREDO;
  if (!s || s.length < 32) throw new Error('Defina SESSAO_SEGREDO (mínimo 32 caracteres) nas variáveis de ambiente.');
  return s;
}

const b64 = s => Buffer.from(s).toString('base64url');
const assinar = dados => createHmac('sha256', segredo()).update(dados).digest('base64url');

function iguais(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && timingSafeEqual(A, B);
}

export const conferirSenha = senha => !!process.env.RUPTURA_SENHA && iguais(process.env.RUPTURA_SENHA, String(senha || ''));

export function criarCookie() {
  const dados = b64(JSON.stringify({ u: 'qg', exp: Math.floor(Date.now() / 1000) + DURACAO }));
  return `${COOKIE}=${dados}.${assinar(dados)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DURACAO}`;
}

export const cookieSair = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function lerSessao(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return false;
  const [dados, assinatura] = m[1].split('.');
  if (!dados || !assinatura || !iguais(assinar(dados), assinatura)) return false;
  try { return JSON.parse(Buffer.from(dados, 'base64url').toString()).exp > Date.now() / 1000; } catch { return false; }
}

export const json = (corpo, status = 200, headers = {}) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });

export const naoAutorizado = () => json({ ok: false, logado: false, erro: 'Sessão expirada. Entre de novo.' }, 401);

// Chamadas entre as nossas Functions (a esteira em segundo plano não recebe cookie).
export const tokenInterno = () => assinar('agente-interno');
export const conferirInterno = request => iguais(request.headers.get('x-interno') || '', tokenInterno());
