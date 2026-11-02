// Cron da Vercel: toda terça às 9h de Brasília o Pesquisador busca as pautas da semana.
import { lerEstado } from '../rupturaagency-api/lib/estado.js';
import { disparar } from '../rupturaagency-api/lib/disparar.js';
import { json } from '../rupturaagency-api/lib/sessao.js';

export default {
  async fetch(request) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) return json({ erro: 'Não autorizado.' }, 401);
    if (!process.env.ANTHROPIC_API_KEY) return json({ erro: 'Falta ANTHROPIC_API_KEY.' }, 503);
    const { salvo } = await lerEstado();
    if (!salvo?.estado) return json({ ok: true, pulou: 'ninguém entrou ainda' });
    const r = await disparar(new URL(request.url).origin, { acao: 'semana' });
    return json({ ok: r.ok }, r.ok ? 200 : 502);
  }
};
