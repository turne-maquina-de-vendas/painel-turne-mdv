// Roda a esteira em segundo plano (até 15 min). Só aceita chamada das nossas Functions.
import { conferirInterno, json } from '../../lib/sessao.js';
import { disparar } from '../../lib/disparar.js';
import { rodarCard, rodarSemana, rodarRelatorio, ehRelatorio } from '../../lib/agentes.js';

export default async (request) => {
  if (!conferirInterno(request)) return json({ erro: 'Não autorizado.' }, 401);
  const { acao, cardId, so } = await request.json();
  if (cardId) await rodarCard(cardId, so);
  else if (acao === 'semana') {
    const ids = await rodarSemana();
    const origem = new URL(request.url).origin;
    await Promise.all(ids.map(id => disparar(origem, { cardId: id })));
  }
  else if (ehRelatorio(acao)) await rodarRelatorio(acao);
};
