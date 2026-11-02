# QG Ruptura

Escritório 3D da agência de conteúdo do Instagram @lucasfigueiredoart. Cada pauta passa por agentes sêniores ligados ao Claude: Pesquisador, Roteirista, Designer, Estúdio, Editor, Social e Assistente. Roda na Vercel com Supabase; a versão original está no Netlify.

## Subir na Vercel

1. **Supabase:** no SQL Editor, rode `supabase/schema.sql`. Ele cria a tabela `ruptura_kv` (com RLS ligado) e o bucket privado `mockups`.
2. **Vercel:** importe este repositório como projeto novo e configure:
   - Root Directory: `qg-ruptura`
   - Framework Preset: Other
   - Production Branch, em Settings > Environments: `qg-ruptura`. O `main` deste repositório é outro projeto.
3. **Variáveis de ambiente**, em Production:

   | Variável | O que é |
   |---|---|
   | `ANTHROPIC_API_KEY` | Chave da API da Anthropic. Com busca na web liberada no Console, porque o Pesquisador usa. |
   | `SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase. Só no servidor, nunca no navegador. |
   | `RUPTURA_SENHA` | A senha da tela de login, à sua escolha |
   | `SESSAO_SEGREDO` | Texto aleatório com 32 caracteres ou mais |
   | `CRON_SECRET` | Texto aleatório. A Vercel o envia ao cron da pesquisa de terça. |

4. **Deploy em produção.** Use o domínio de produção: a Deployment Protection das prévias bloqueia as chamadas entre os agentes.
5. **Importar as pautas atuais**, uma vez, com o arquivo `dados.json` que o Lucas enviar. Esse arquivo não fica no repositório.
   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node rupturaagency-api/importar_dados.mjs dados.json
   ```

## Conferir depois do deploy
- Entrar com a senha e criar uma pauta. Em alguns minutos ela deve chegar ao Estúdio com ganchos, roteiro e plano de gravação.
- Clicar em "Buscar pautas agora" na mesa do Pesquisador.
- Se um agente parar, o erro aparece no card. Veja também os logs de `/api/agente-background`.

Cada passo da esteira roda em uma Function própria, com limite de 300 s (`vercel.json`). O Pesquisador usa busca na web e é o passo mais demorado.

## Estrutura
- `agencia-3d/index.html`: o site inteiro. `rupturaagency-site/index.html` é gerado a partir dele.
- `api/`: rotas da Vercel. Reutilizam `rupturaagency-api/netlify/functions/`.
- `rupturaagency-api/lib/`: esteira dos agentes, Claude e armazenamento. Com `SUPABASE_URL` usa Supabase; sem ela, Netlify Blobs.
- `rupturaagency-api/lib/skills.js` e `site.js`: skills e prompts dos agentes, gerados por `gerar_skills.py`.
- `rupturaagency-api/teste/`: teste local sem custo, com Claude e Supabase simulados.

## Testar localmente
```bash
npm install
TESTE_VERCEL=1 PORT=8766 node rupturaagency-api/teste/servidor.mjs
```
```bash
TESTE_VERCEL=1 PORT=8766 node rupturaagency-api/teste/rodar.mjs
```
O servidor de teste abre em http://localhost:8766, com a senha `teste-local`, que só vale nele.

## Depois de mudar o site ou os prompts
```bash
python3 rupturaagency-api/gerar_skills.py
python3 agencia-3d/wrap_site.py agencia-3d/index.html rupturaagency-site/index.html
```
Sem as skills na máquina, o `gerar_skills.py` mantém o `lib/skills.js` atual e atualiza só o `lib/site.js`.
