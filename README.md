# Painel Campina Grande — Turnê Máquina de Vendas

Repositório: `turne-maquina-de-vendas/painel-turne-mdv`

Duas seções:

- **Criativos** — as artes de feed por remessa, com aprovação
  (aprovar / ajustar / reprovar) e anotações compartilhadas.
- **Páginas** — as páginas no ar, com as notas do PageSpeed mobile e
  desktop de cada uma.

No ar em https://painelturnemdv.vercel.app

## Rotina: mexeram na planilha

    python3 ferramentas/atualizar-paginas.py
    python3 ferramentas/gerar-index.py
    git push

## Rotina: mexi no painel

Edite **`ferramentas/painel.fonte.html`** — nunca o `index.html`, que é
gerado e seria sobrescrito.

    python3 ferramentas/gerar-index.py
    git push

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

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. **O `.env.local` não vai
para o git** — o `.gitignore` bloqueia. As mesmas variáveis precisam existir
na Vercel, em Settings → Environment Variables:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres do Neon (use a string com pooler) |
| `PAGESPEED_API_KEY` | Medição automática; sem ela o Google devolve 429 |

Primeira vez, para criar as tabelas:

    node ferramentas/criar-tabelas.mjs

## Funções (Vercel)

| Arquivo | O que faz |
|---|---|
| `api/estado.js` | `/api/estado` — lê e grava status, anotações e medições |
| `api/medir.js` | mede as páginas no PageSpeed; `?parte=1..4` |
| `api/lista-paginas.js` | gerado — as URLs a medir |

O `vercel.json` agenda as 4 fatias da medição a cada 3 dias, espaçadas de
10 minutos.

## Armazenamento

Postgres no Neon. Cada anotação é uma linha em `anotacoes`, cada decisão uma
linha em `status_artes`, cada medição uma linha em `medicoes`. Guardar tudo
num documento único fazia o último a salvar apagar o que o outro tinha
acabado de escrever.

No navegador, o que a pessoa escreve entra numa fila em `localStorage` antes
de ir para a rede e só sai de lá quando o servidor confirma. Se a conexão
cair ou a página for atualizada no meio, a fila é reenviada sozinha.

## Medição automática do PageSpeed

**Precisa da chave**, senão o Google devolve 429 (a cota anônima é
compartilhada e vive estourada):

1. console.cloud.google.com → ative a **PageSpeed Insights API** →
   Credenciais → Criar chave de API
2. Coloque em `.env.local` e em Settings → Environment Variables na Vercel
3. Faça um novo deploy

Medir agora, sem esperar os 3 dias:

    curl https://painelturnemdv.vercel.app/api/medir?parte=1

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

O projeto é conectado a este repositório na Vercel: **`git push` na `main`
publica sozinho**, funções incluídas.

    git push
