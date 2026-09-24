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

Edite **`ferramentas/painel.fonte.html`** — é a fonte única. Nunca o
`index.html`, que é gerado e seria sobrescrito, e nunca uma cópia fora do
projeto: uma cópia de trabalho paralela já apagou o bloco de páginas que o
gerador tinha acabado de escrever.

    python3 ferramentas/gerar-index.py
    git push

Se mexeu na planilha também, rode `atualizar-paginas.py` **antes** do
`gerar-index.py` — ele escreve dentro da fonte.

## Como as peças se encaixam

    planilha MDV - Outubro 2026
        │
        │  ferramentas/atualizar-paginas.py
        ├──────────────────────────────────┐
        ▼                                  ▼
    ferramentas/painel.fonte.html    api/lista-paginas.js
        │                                  │  (o que a medição percorre)
        │  ferramentas/gerar-index.py      │
        ▼                                  │
    index.html  ◄──────── /api/estado ◄────┘

`painel.fonte.html` é a fonte única. Ela roda como artifact no claude.ai
(usando `window.claude`) e o gerador a converte na versão da Vercel, que
usa a função `/api/estado` e uma fila local de envio.

## Configuração

A hospedagem só precisa conhecer **uma** variável:

| Variável | Onde |
|---|---|
| `DATABASE_URL` | Vercel → Settings → Environment Variables (a integração do Neon já cria) |

Todo o resto mora na tabela `config` do próprio banco. A chave do PageSpeed
está lá — trocar é um comando, sem mexer em painel de hospedagem nem refazer
deploy:

    node ferramentas/definir-config.mjs                        # lista
    node ferramentas/definir-config.mjs PAGESPEED_API_KEY xyz  # grava

Para desenvolver na máquina, copie `.env.example` para `.env.local` e
preencha a `DATABASE_URL`. **O `.env.local` não vai para o git.**

Primeira vez, para criar as tabelas:

    node ferramentas/criar-tabelas.mjs

Para ver o que está guardado:

    node ferramentas/ver-banco.mjs

## Funções (Vercel)

| Arquivo | O que faz |
|---|---|
| `api/estado.js` | `/api/estado` — lê e grava status, anotações e medições |
| `api/medir.js` | mede as páginas no PageSpeed; `?parte=1..4` |
| `api/lista-paginas.js` | gerado — as URLs a medir |

A chave do PageSpeed vem da tabela `config`; a variável de ambiente serve
como alternativa se a tabela não existir.

O `vercel.json` agenda as 7 fatias da medição a cada 12 horas (05h e 17h
UTC), espaçadas de 8 minutos.

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

Medir agora, sem esperar o próximo ciclo:

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

## Central de Conteúdo

Segunda ferramenta do painel, em `/conteudo`. Trabalha sobre a pasta mãe do
Drive do Grupo R1: acha o vídeo, decupa por minutagem, toca a fila de edição
e guarda o procedimento.

| Aba | Pra quem | O que faz |
|---|---|---|
| **Central** | todo mundo | As 9 pastas de tema, montadas pelo sistema (pasta do Drive > tag > nome/observação). A `00. Fluxo Diário` lista o que ainda não tem trecho marcado. |
| **Decupagem** | minerador | Acha o vídeo no acervo (17.787), assiste embutido, marca início/fim, headline, editoria, produto, redes e status. |
| **Painel** | editor | Todos os trechos numa tabela. Status e link do editado editáveis na própria linha. |
| **Minutagem RGV** | todo mundo | Busca nas transcrições dos eventos. |
| **POP** | todo mundo | O procedimento: mapa da pasta, papéis, as 5 etapas com regra de saída, ritmo e métricas. |

### Arquivos

```
conteudo/index.html      o app inteiro — HTML, CSS e JS num arquivo só
conteudo/acervo.json     17.787 vídeos do Drive: id, título, pasta, data, tamanho
conteudo/minutagem.html  o buscador de transcrições (12,5 MB, carrega só quando a aba abre)
api/conteudo.js          a API, no Postgres
ferramentas/importar-conteudo.mjs  traz os dados que ficaram no Netlify Blobs
ferramentas/varrer-drive.py        regera o acervo varrendo a árvore do Drive
```

As tabelas (`conteudo_videos`, `conteudo_cortes`) saem do
`ferramentas/criar-tabelas.mjs` junto com as do painel.

### A API

```
GET  /api/conteudo                      -> { cortes: [...], videos: [...] }
POST /api/conteudo {op:"set", col, doc} -> { ok: true }   // doc.id obrigatório
POST /api/conteudo {op:"del", col, id}  -> { ok: true }   // vídeo apagado leva os trechos
```

`col` é `"cortes"` ou `"videos"`. Uma linha por trecho — dois mineradores
marcando ao mesmo tempo não se sobrescrevem.

**status**: (vazio) · `DECUPADO` · `EM EDIÇÃO` · `EDITADO` · `POSTADO`
**nota**: `VIRAL` · `BOM` · `MÉDIO` · `FRACO`
**produto**: `RGV` · `CLUBE R1` · `DONO COM DONO` · `DE FRENTE COM RICARDO` · `DIA A DIA` · `FAMILIA` · `PALESTRAS` · `PODCASTS`
**rede**: várias por trecho, separadas por vírgula

### Subir pela primeira vez

**Só o deploy.** Na primeira chamada a `/api/conteudo` as tabelas nascem sozinhas
e os dados que estão no Netlify entram junto — um marcador em `config`
(`conteudo_importado`) garante que a importação não se repita. Não precisa rodar
script nenhum.

Se a importação automática falhar (Netlify fora do ar, por exemplo), a API abre
vazia e o caminho manual continua valendo:

```bash
node ferramentas/importar-conteudo.mjs
```

Depois do primeiro deploy, confira `GET /api/conteudo` e um `POST` de ida e volta.
O `api/conteudo.js` **não foi testado contra o banco** — esse passo não é formalidade.

Enquanto isso não roda, a versão no ar continua sendo
<https://central-de-conteudo-r1.netlify.app> (mesma tela, dados no Netlify Blobs).

### Manutenção

**O acervo é uma foto.** `conteudo/acervo.json` foi tirado do Drive em
23/09/2026. Vídeo novo não aparece sozinho:

```bash
python3 ferramentas/varrer-drive.py     # gera tree.json com a árvore inteira
```

Depois regere o `acervo.json` (id, título, pasta, data) e **suba o número da
versão** no `fetch("acervo.json?v=N")` dentro de `conteudo/index.html` — o
header é `max-age=3600` e sem isso o navegador serve o arquivo velho por uma
hora. A varredura usa `drive.google.com/embeddedfolderview`, que dispensa
credencial porque a pasta mãe está compartilhada por link.

**Mapa de produto incompleto.** `MAPA_PRODUTO` no `conteudo/index.html` deduz o
produto pela pasta do Drive. Onze pastas ainda não têm produto definido — entre
elas `[FD] CNE` (3.113 vídeos), `[FD] RGV PROCESSOS` (908) e `[FD] EXECUTIVOS`
(519). Nenhuma pasta aponta pra `FAMILIA`.

**Minutagem RGV** é cópia estática de minutagem.netlify.app; não se atualiza
sozinha.

### O que a varredura do Drive mostrou

Das 17.787 peças de vídeo, **17.760 estão paradas na `00. FLUXO DIÁRIO`**. As
nove pastas de tema somam 27. A entrada não é entrada: é o acervo inteiro
esperando mineração.
