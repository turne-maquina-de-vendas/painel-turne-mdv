# Painel Campina Grande — Turnê Máquina de Vendas

Duas seções:

- **Criativos** — as artes de feed por remessa, com aprovação
  (aprovar / ajustar / reprovar) e anotações compartilhadas.
- **Páginas** — as páginas no ar, com as notas do PageSpeed mobile e
  desktop de cada uma.

No ar em https://adsmaquinadevendas.netlify.app

## Rotina: mexeram na planilha

    python3 ferramentas/atualizar-paginas.py
    python3 ferramentas/gerar-index.py
    netlify deploy --prod

## Rotina: mexi no painel

Edite **`ferramentas/painel.fonte.html`** — nunca o `index.html`, que é
gerado e seria sobrescrito.

    python3 ferramentas/gerar-index.py
    netlify deploy --prod

## Como as peças se encaixam

    planilha MDV - Outubro 2026
        │
        │  ferramentas/atualizar-paginas.py
        ├──────────────────────────────────┐
        ▼                                  ▼
    ferramentas/painel.fonte.html    netlify/functions/lista-paginas.mjs
        │                                  │  (o que a medição percorre)
        │  ferramentas/gerar-index.py      │
        ▼                                  │
    index.html  ◄──────── /api/estado ◄────┘

`painel.fonte.html` é a fonte única. Ela roda como artifact no claude.ai
(usando `window.claude`) e o gerador a converte na versão do Netlify, que
usa a função `/api/estado` e uma fila local de envio.

## Funções

| Arquivo | O que faz |
|---|---|
| `estado.mjs` | `/api/estado` — lê e grava status, anotações e medições |
| `medir-background.mjs` | mede as 31 páginas no PageSpeed (limite 15 min) |
| `agendar.mjs` | dispara a medição a cada 3 dias, 05:00 UTC |
| `lista-paginas.mjs` | gerado — as URLs a medir |

## Armazenamento

Cada anotação é um blob próprio (`nota/<id>`), cada decisão é
`status/<arteKey>`, cada medição é `psi/<id>`. Guardar tudo num documento
único fazia o último a salvar apagar o que o outro tinha acabado de
escrever. As leituras usam consistência forte — sem isso o Netlify
devolvia uma versão antiga logo após gravar, e a anotação "sumia" no F5.

O blob `indice` é o resultado montado, refeito a cada gravação para as
leituras serem rápidas.

No navegador, o que a pessoa escreve entra numa fila em `localStorage`
antes de ir para a rede e só sai de lá quando o servidor confirma. Se a
conexão cair ou a página for atualizada no meio, a fila é reenviada
sozinha.

## Medição automática do PageSpeed

**Precisa da chave**, senão o Google devolve 429 (a cota anônima é
compartilhada e vive estourada):

1. console.cloud.google.com → ative a **PageSpeed Insights API** →
   Credenciais → Criar chave de API
2. `netlify env:set PAGESPEED_API_KEY SUA_CHAVE`
3. `netlify deploy --prod`

Medir agora, sem esperar os 3 dias:

    curl -X POST https://adsmaquinadevendas.netlify.app/.netlify/functions/medir-background

A coluna **Medição** no painel diz de onde veio cada nota:

- `há 2d · no ar` — o Google tem visitas reais dessa URL (dado de campo)
- `há 2d · teste` — só o teste em laboratório; a página ainda não tem
  visitas suficientes
- `há 2d · local` — Lighthouse rodado na máquina, não o PageSpeed. Mede a
  mesma coisa, mas em outro hardware: a nota pode variar alguns pontos
- `planilha` — ainda não foi medida; vale o número digitado na planilha

### Medir na mão, sem a chave

`ferramentas/medir-local.sh` roda o Lighthouse na máquina e manda o
resultado para o painel (marcado como `local`). Serve para desempatar
enquanto a chave não existe:

    python3 ferramentas/listar-urls.py V3     # gera a lista
    ./ferramentas/medir-local.sh              # mede e envia

Leva cerca de 40 segundos por página, em mobile e desktop, sequencial —
rodar em paralelo disputa CPU e distorce a nota.

O Clarity não entra aqui: a API dele não devolve nota de página, só
métricas de comportamento (sessões, rolagem, rage clicks).

## Deploy

Tem que ser por CLI ou git — arrastar a pasta no Netlify Drop publica o
site mas não as funções, e aí cada pessoa vê só as próprias anotações.

    netlify deploy --prod
