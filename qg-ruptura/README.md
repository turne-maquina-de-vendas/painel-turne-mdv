# QG Ruptura

Escritório 3D da agência de conteúdo do Instagram @lucasfigueiredoart. Cada pauta passa por agentes ligados ao Claude: Pesquisador, Roteirista, Designer, Estúdio, Editor, Social e Assistente. No ar em https://rupturaagency.netlify.app.

## Estrutura
- `agencia-3d/index.html`: o site inteiro (cena three.js, cards, login). É a fonte dos prompts e do DNA do perfil.
- `rupturaagency-api/netlify/functions/`: API (login, estado, agentes, métricas, mockups) e a pesquisa agendada de terça.
- `rupturaagency-api/lib/`: esteira dos agentes, chamada ao Claude e gravação no Netlify Blobs.
- `rupturaagency-api/teste/`: teste local sem custo, com Claude simulado.

## O que não está aqui
- `lib/skills.js` e `lib/site.js` são gerados por `gerar_skills.py`. O `skills.js` precisa das skills em `~/.claude/skills`, que não estão neste repositório público.
- A senha do site não fica no repositório.

## Rodar
```bash
cd rupturaagency-api && npm install && python3 gerar_skills.py
node teste/servidor.mjs   # em outro terminal: node teste/rodar.mjs
```
O site local abre em http://localhost:8765 com a senha `teste-local`, que só vale nesse servidor de teste.

## Publicar
`sh rupturaagency-api/deploy.sh` sobe a prévia e `--prod` sobe a produção. É preciso ter acesso ao site no Netlify.

Variáveis no Netlify: `RUPTURA_SENHA` e `SESSAO_SEGREDO`. A chave do Claude vem do AI Gateway do Netlify.
