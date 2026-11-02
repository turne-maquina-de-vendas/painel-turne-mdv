// Copia pautas e números do QG para o Supabase. Rode uma vez, antes de começar a usar.
// SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node rupturaagency-api/importar_dados.mjs dados.json
import { readFileSync } from 'node:fs';
import { lojaSupabase } from './lib/supabase.js';

const { estado, metricas } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!estado?.estado?.cards) throw new Error('Arquivo sem pautas.');
await lojaSupabase().setJSON('estado', estado);
if (metricas) await lojaSupabase().setJSON('metricas', metricas);
console.log(`Importado: ${estado.estado.cards.length} pautas${metricas ? ' e os números do perfil' : ''}.`);
