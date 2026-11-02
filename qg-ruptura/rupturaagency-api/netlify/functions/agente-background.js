// Roda a esteira em segundo plano (até 15 min). Só aceita chamada das nossas Functions.
import { conferirInterno, json } from '../../lib/sessao.js';
import { disparar } from '../../lib/disparar.js';
import { rodarCard, rodarSemana, rodarRelatorio, ehRelatorio } from '../../lib/agentes.js';

// Compartilhado com a rota da Vercel.
export async function executar({ acao, cardId, so }, origem) {
  if (cardId) await rodarCard(cardId, so, origem);
  else if (acao === 'semana') {
    const ids = await rodarSemana();
    await Promise.all(ids.map(id => disparar(origem, { cardId: id })));
  }
  else if (ehRelatorio(acao)) await rodarRelatorio(acao);
}

export default async (request) => {
  if (!conferirInterno(request)) return json({ erro: 'Não autorizado.' }, 401);
  await executar(await request.json(), new URL(request.url).origin);
};
