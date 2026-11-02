import { tokenInterno } from './sessao.js';

const CAMINHO = process.env.VERCEL ? '/api/agente-background' : '/.netlify/functions/agente-background';

export const disparar = (origem, corpo) => fetch(origem + CAMINHO, {
  method: 'POST',
  headers: { 'x-interno': tokenInterno() },
  body: JSON.stringify(corpo)
});
