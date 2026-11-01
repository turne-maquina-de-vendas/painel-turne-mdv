// Toda terça às 9h de Brasília o Pesquisador busca as pautas da semana sozinho. Agendamento só roda em produção.
import { lerEstado } from '../../lib/estado.js';
import { disparar } from '../../lib/disparar.js';

export default async () => {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const { salvo } = await lerEstado();
  if (!salvo?.estado) return; // sem ninguém ter entrado ainda, não há perfil para pesquisar
  await disparar(process.env.URL, { acao: 'semana' });
};

export const config = { schedule: '0 12 * * 2' };
