// Responde na hora e segue trabalhando em segundo plano. Só aceita chamada das nossas Functions.
import { waitUntil } from '@vercel/functions';
import { executar } from '../rupturaagency-api/netlify/functions/agente-background.js';
import { conferirInterno, json } from '../rupturaagency-api/lib/sessao.js';

export default {
  async fetch(request) {
    if (!conferirInterno(request)) return json({ erro: 'Não autorizado.' }, 401);
    waitUntil(executar(await request.json(), new URL(request.url).origin).catch(e => console.error('Agente', e)));
    return json({ ok: true }, 202);
  }
};
