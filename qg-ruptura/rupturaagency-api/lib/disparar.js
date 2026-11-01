import { tokenInterno } from './sessao.js';

export const disparar = (origem, corpo) => fetch(origem + '/.netlify/functions/agente-background', {
  method: 'POST',
  headers: { 'x-interno': tokenInterno() },
  body: JSON.stringify(corpo)
});
