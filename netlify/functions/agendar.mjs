/* Dispara a medição a cada 3 dias.
 *
 * Esta função tem 30 segundos de limite, o que não dá para medir as páginas.
 * Por isso ela só chama a background function, que tem 15 minutos.
 *
 * E chama em 4 fatias: cada página é medida 3 vezes em mobile e desktop
 * (a nota do PageSpeed oscila muito, então vale a melhor das três), e a lista
 * inteira numa invocação só não caberia no limite. */

const PARTES = [1, 2, 3, 4];

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_URL;
  const alvo = `${base}/.netlify/functions/medir-background`;

  await Promise.all(PARTES.map((parte) =>
    fetch(alvo, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parte })
    })
  ));
  return new Response(`medição disparada em ${PARTES.length} partes`, { status: 200 });
};

/* 05:00 UTC = 02:00 em Brasília, dias 1, 4, 7... de cada mês */
export const config = { schedule: "0 5 */3 * *" };
