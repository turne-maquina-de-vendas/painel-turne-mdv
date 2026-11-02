// Gerado por gerar_skills.py a partir de agencia-3d/index.html. Não editar à mão.
let S = { cards: [] };
export const usarEstado = s => { S = s; };
const ganchoEscolhido = c => c.ganchos && c.escolhido!=null ? c.ganchos[c.escolhido] : null;
export const FLUXO = {
  Reel:['pauta','gancho','design','gravar','edicao','postar','noar'],
  Carrossel:['pauta','gancho','design','postar','noar'],
  Stories:['pauta','gancho','design','gravar','postar','noar']
};
const RAIOX_URL = 'https://analiseperfillucas.netlify.app';
const DNA = {
  posicionamento:'Branding descomplicado: eu dou marca a qualquer coisa.',
  bio:'Lucas Figueiredo · Branding descomplicado\nEu dou marca a qualquer coisa: personagens, arquétipos e criatividade\nRaio-X do seu Instagram em segundos · Studio de marcas 👇',
  bordoes:['A IA faz o logo. A marca é outra história.','Toda marca conta uma história. Qual é a sua?','Me diz quem é, que eu te dou uma marca.'],
  produtos:[
    {nome:'Raio-X do seu Instagram ou do seu negócio', tipo:'low ticket perpétuo, faz o caixa', desc:'Para profissional liberal e empresa. Diagnóstico em segundos do perfil e da marca, com o que trava a venda: o que funciona, público que engaja, séries, melhor horário, arquétipo da marca e linha editorial. O painel analiseperfillucas.netlify.app é a demonstração. Tráfego pago nos posts "Raio-X" que performarem, order bump de plano de 30 dias e upsell com consultoria.'},
    {nome:'Identidade visual no studio', tipo:'high ticket', desc:'Identidade visual para consultório, escritório, clínica e loja, com poucas vagas por mês. Chega pela palavra-chave MARCA, por cases e pela análise de rebrand.'}
  ],
  series:[
    {id:'personagem', nome:'Se tivesse Instagram', editoria:'Personagens', funil:'Topo · alcance', meta:25, cor:'#7f6cf2', skill:'/carrossel-viral (V1) · /reels-viral (F3)', cta:'"Qual o próximo personagem?" para alcance; no fim: "Quer a sua marca assim? Comente MARCA." (ímã para o studio)', ref:'o campeão do perfil (5,1× os outros temas)'},
    {id:'arquetipo', nome:'Arquétipo de quem?', editoria:'Branding descomplicado', funil:'Meio · autoridade e salvamento', meta:20, cor:'#e8a23a', skill:'/carrossel-viral (A3, V3) · /reels-viral (F7, F10)', cta:'"Comente ARQUÉTIPO que eu te digo o da sua marca" (ímã que leva ao Raio-X)', ref:'arquétipo, cor, tipografia e posicionamento explicados com personagem ou marca que todo mundo conhece'},
    {id:'contramao', nome:'Contramão', editoria:'Identidade visual e criatividade', funil:'Topo · alcance e envio', meta:15, cor:'#d8417f', skill:'/washington-olivetto (contramão) · /reels-viral (F4, F9) · /carrossel-viral (V2)', cta:'envio para alcance; no fim: "Comente MARCA para ver a sua do jeito certo" (ímã para o studio)', ref:'@designfromhuman "Hermès se fosse marca de pobre" (362 mil views) e a refação do logo polêmico'},
    {id:'criativa', nome:'Mente criativa', editoria:'Criatividade', funil:'Meio · identificação e envio', meta:10, cor:'#9a6cf2', skill:'/reels-viral (F7 "esse cara + protocolo") · /washington-olivetto', cta:'"Comente MÉTODO que eu te mando o passo a passo" (ímã de nutrição)', ref:'@henriarmelin, método da Julia Cameron (1 mi de views); criativos e designers famosos e o método deles'},
    {id:'raiox', nome:'Raio-X', editoria:'Raio-X de perfis', funil:'Meio · ponte para o Raio-X', meta:20, cor:'#2f9ee8', skill:'/reels-viral (F5 breakdown, F10) · /carrossel-viral (A2, A3)', cta:'"Comente RAIO-X que eu te mando o link" (ímã de venda do low ticket)', ref:'o Raio-X do perfil de uma marca, personagem ou seguidor: arquétipo, identidade visual, o que funciona e o que falta'},
    {id:'fundo', nome:'Feito com o método', editoria:'Prova e oferta', funil:'Fundo · caixa e studio', meta:10, cor:'#1fae7a', skill:'/washington-olivetto (oferta e bordão) · /carrossel-viral (A2)', cta:'alterna por semana: "Comente RAIO-X" ou "Aplicações abertas" (studio)', ref:'antes e depois de quem usou o Raio-X numa semana, case do studio na outra'}
  ],
  referencias:[
    ['@fernandomiranda777 (1,1 mi)','curiosidade de negócio com marcas do dia a dia; capa com foto real e título em tarja caixa alta ("O que aconteceu com…").'],
    ['@henriarmelin','"esse cara + protocolo": o método da Julia Cameron fez 1 mi de views. Criativo famoso + método prático.'],
    ['@designfromhuman','"Hermès se fosse marca de pobre", 362 mil views: exercício de branding pela contramão, leve e divertido.'],
    ['@stevenxzuber','talking head cinematográfico de 13 a 16 s, luz quente, frase forte em amarelo condensado, palavra-chave no comentário.']
  ],
  regras:[
    'Uma peça, dois posts: todo post de personagem ou arquétipo gera um par "Raio-X" (o perfil daquela marca ou pessoa analisado), que mostra o produto funcionando e chama para o Raio-X.',
    'Público que compra: profissionais liberais (médico, dentista, advogado, arquiteto, psicólogo) e empresas (clínica, escritório, loja). Foco em venda: todo post é ímã de lead e termina numa palavra-chave (RAIO-X, ARQUÉTIPO, MARCA, MÉTODO) que a automação do direct responde.',
    'Porta pop, destino ofício: entra por algo que o Brasil já conhece e termina em identidade visual, branding ou criatividade.',
    'A IA entra a serviço da identidade visual (moodboard, paleta, variações, mockups), nunca como "você não precisa de designer". A IA acerta o desenho; a marca é estratégia.',
    'Toda legenda termina com pergunta de 1 palavra ou palavra-chave para o direct.',
    'Branding descomplicado: um conceito por post (arquétipo, cor, tipografia, posicionamento), explicado com um personagem ou uma marca que todo mundo conhece, sem jargão.',
    'Uma contramão por semana: "e se [marca] fosse…" ou a refação do logo polêmico, mostrando em vez de só opinar.',
    'Visual de diretor de arte: capa com rosto ou foto real, título curto em caixa alta, um destaque de cor; talking head com luz quente e enquadramento de cinema.',
    'Série que volta igual cai: toda volta traz um elemento novo.',
    'O fundo do funil alterna por semana: case do studio numa, prova do Raio-X na outra. Nunca as duas chamadas no mesmo post.',
    'No mínimo 4 posts por semana; os virais vieram dos meses de 20 a 30 posts. Melhor janela: sexta, das 15h às 17h.'
  ],
  numeros:[
    ['Seguidores','51.429'],['Posts desde nov/2022','199'],['Personagem × outros temas','5,1×'],
    ['Views medianas de rebrand','11.371'],['Pergunta na legenda','1,6×'],['Público de 25 a 44 anos','71%'],
    ['Pulo nos 3 s (reels recentes)','48%'],['Saldo de seguidores em 30 dias','−374'],['Dias sem postar (31/10)','63']
  ]
};
const SERIE = Object.fromEntries(DNA.series.map(x=>[x.id,x]));
const serieDe = c => c && SERIE[c.serie];
function contexto(c){
  const sr = serieDe(c);
  return `\n\n--- DNA do perfil ${arroba()} (fonte: Raio-X ${RAIOX_URL}) ---
Posicionamento: "${DNA.posicionamento}" Designer e estrategista de marcas que descomplica branding com personagens, arquétipos e criatividade.
Produtos: ${DNA.produtos.map(x=>`${x.nome} (${x.tipo}): ${x.desc}`).join(' | ')}
Séries e proporção dos posts: ${DNA.series.map(x=>`${x.nome} (${x.editoria}, ${x.funil}, ${x.meta}%)`).join('; ')}.${sr?`\nEste post é da série "${sr.nome}" (${sr.editoria}, ${sr.funil}). Referência da série: ${sr.ref}. CTA da série: ${sr.cta}.`:''}
Referências de formato: ${DNA.referencias.map(([a,b])=>`${a}: ${b}`).join(' ')}
Regras: ${DNA.regras.join(' ')}
Números: ${DNA.numeros.map(([a,b])=>`${a}: ${b}`).join('; ')}. Público: 47% homens, 39% mulheres, 95% no Brasil (SP, RJ, Goiânia, BH).
Bordões do perfil: ${DNA.bordoes.join(' / ')}`;
}

const arroba = () => '@' + (S.arroba || 'seuperfil');
const nicho = () => S.nicho ? ` (nicho: ${S.nicho})` : '';
export function promptDe(mesa, c, tipo){
  const t = c ? `"${c.titulo}"` : '';
  const pesq = c ? (c.pesquisa || c.nota || '—') : '';
  const sr = serieDe(c);
  const olivetto = sr && ['fundo','contramao','criativa'].includes(sr.id);
  switch(mesa){
    case 'pesquisador': return c
      ? `Aprofunde a pesquisa do assunto ${t}${sr?` (série "${sr.nome}")`:''} para o Instagram ${arroba()}${nicho()}. Use /reels-viral e /carrossel-viral como régua. Busque no YouTube, TikTok, Reddit, fóruns e notícias dos últimos 7 dias e traga: o que as pessoas estão falando agora, os conteúdos que já deram resultado (com link e números), os ângulos saturados, o gap que ninguém cobriu, a porta pop e o destino ofício. Diga também qual post "Raio-X" (perfil analisado) faz par com este. Leia o assunto pela lente do Primal Branding (Patrick Hanlon; /reels-viral §4b): até 3 peças do código primal em jogo, em uma linha "Código primal: peça → o que aparece no caso → ângulo que abre", e o gap de crença. Só use peça que apareça de fato. Se precisar de mais método, pesquise resumos e resenhas do Primal Branding, com fonte. Nenhum fato sem fonte. O que já temos: ${pesq}${contexto(c)}`
      : `/reels-viral e /carrossel-viral — Pesquisa da semana para o Instagram ${arroba()}${nicho()}.
Vasculhe YouTube, TikTok, Reddit, fóruns e notícias dos últimos 3 a 7 dias atrás do que o Brasil está vendo com marca, cor, personagem ou criatividade no meio (personagem em alta, lançamento de logo, rebrand, campanha, criativo famoso, meme do dia), com prioridade para identidade visual, branding descomplicado, arquétipos, personagens e criatividade. Traga 6 assuntos distribuídos pela proporção das séries. Escreva uma seção por assunto, começando com "## " e o nome do assunto, contendo:
- Série: (um destes nomes exatos: ${DNA.series.map(x=>x.nome).join(', ')})
- Formato sugerido (Reel, Carrossel ou Stories) e motor/formato da skill (V1–V3, A1–A3 ou F1–F10)
- Por que está quente agora (fontes e links)
- O que já deu resultado (conteúdos que performaram, com números)
- O gap do mercado: o que ninguém falou ainda
- Par de Raio-X: o perfil de marca, personagem ou pessoa que vale analisar a partir deste
- Código primal: até 3 peças do Primal Branding (Patrick Hanlon; /reels-viral §4b) em jogo, no formato "peça → o que aparece no caso → ângulo que abre", só se aparecerem de fato
Se precisar de mais método, pesquise resumos e resenhas do Primal Branding, com fonte.
Salve como pesquisa-da-semana.md.${contexto(null)}`;
    case 'roteirista': {
      const g = ganchoEscolhido(c);
      if(tipo==='roteiro') return c.formato==='Carrossel'
        ? `/carrossel-viral — Etapas 6 a 8 para o carrossel ${t} de ${arroba()}, com a capa escolhida: "${g ? g.texto : ''}".
Construa os painéis pela fórmula Provocação → Curiosidade → Contexto → Tensão → Revelação → Aprendizado → Ação (painel 2 funcionando como segunda capa), mostre a tabela painel a painel e depois entregue o bloco limpo (CAPA, PAINEL 2…, LEGENDA).${olivetto?'\nUse /washington-olivetto para o bordão e a oferta do último painel (três caminhos, recomende um).':''}
Pesquisa do assunto: ${pesq}${contexto(c)}`
        : `/reels-viral — Etapa 5 para o ${c.formato} ${t} de ${arroba()}, abrindo com este gancho: "${g ? g.texto : ''}".
Roteiro cena a cena em tabela (Tempo · Fala · Texto na tela · Imagem/b-roll · Áudio), marcando o mecanismo narrativo de cada parte e a progressão Atenção → Interesse → Desejo → Ação. Linguagem falada, frases curtas, nada de "oi gente". Depois: legenda, CTA da série, capa (frame + até 5 palavras) e áudio sugerido.${olivetto?'\nUse /washington-olivetto para o bordão e a oferta do fechamento (três caminhos, recomende um).':''}
Pesquisa do assunto: ${pesq}${contexto(c)}`;
      return c.formato==='Carrossel'
        ? `/carrossel-viral — Etapas 1 a 5 para o assunto ${t} no Instagram ${arroba()}${nicho()}.
Material, briefing (público, objetivo, motor, porta pop e destino ofício, promessa), diagnóstico com nota viral 0–100, otimização e 5 capas.${olivetto?'\nUse também /washington-olivetto: o conceito nasce da contramão do mercado e o bordão passa no teste do bar.':''}
No fim, liste as 5 capas exatamente neste formato, uma por linha:
1. [motor] texto da capa — por que funciona
Pesquisa: ${pesq}${contexto(c)}`
        : `/reels-viral — Modo Criar, etapas 1 a 4, para o assunto ${t} no Instagram ${arroba()}${nicho()}. Formato: ${c.formato}.
Briefing (vida real → valor → viral, formato F1–F10 + formato de produção, curto visual ou longo narrado), diagnóstico com nota viral 0–100 e 5 ganchos.${olivetto?'\nUse também /washington-olivetto para o conceito e o bordão (contramão do mercado, teste do bar).':''}
No fim, liste os 5 ganchos exatamente neste formato, uma linha por gancho:
1. [formato] gancho falado ou texto fixo na tela — por que funciona
Pesquisa: ${pesq}${contexto(c)}`;
    }
    case 'estudio': return c.roteiro || `Gancho: ${(ganchoEscolhido(c)||{}).texto||''}`;
    case 'editor': {
      const g = ganchoEscolhido(c);
      return c.formato==='Carrossel'
        ? `/carrossel-viral — Monte o carrossel ${t} de ${arroba()} com a camada sênior de design: 1080×1350, margens de 80 px nas laterais e 100 px em cima e embaixo, capa segura no corte 3:4 do grid, no máximo 2 famílias tipográficas, 60-30-10 na cor, um destaque por painel, avatar e numeração fixos. Capa: "${g?g.texto:''}". Mostre a prévia antes de exportar.${c.roteiro?`\nPainéis: ${c.roteiro}`:''}${contexto(c)}`
        : `/reels-viral — Etapa 7 (produção) do ${c.formato} ${t} de ${arroba()}: Remotion 1080×1920 a 30 fps, legenda por whisper, visual do formato escolhido (§7 da skill), margem segura (topo 220 px, base 380 px), gancho "${g?g.texto:''}" nos 3 primeiros segundos e prova visual no 1º segundo. Áudio sem picote e trilha instrumental. Mostre a prévia antes do final. Bruto: [cole o link].${c.roteiro?`\nRoteiro: ${c.roteiro}`:''}${contexto(c)}`;
    }
    case 'social': return c && c.etapa==='postar'
      ? `Escreva a legenda do post ${t} (${c.formato}) para ${arroba()} pelas regras de legenda e CTA do ${c.formato==='Carrossel'?'/carrossel-viral (§5)':'/reels-viral (§8)'}: 1ª linha é o CTA ou a piada, pergunta respondível em 2 s ou palavra-chave para o direct, nada de parágrafo explicativo antes da pergunta. Inclua o plano da primeira hora (responder os 20 primeiros comentários, repost nos stories com enquete). Janela de postagem: sexta, das 15h às 17h, salvo se o assunto tiver prazo de 72 h.${contexto(c)}`
      : `/reels-viral — Modo Crescer o perfil para ${arroba()}. Compare o que está no ar com o Raio-X (${RAIOX_URL}).
No ar: ${S.cards.filter(x=>x.etapa==='noar').map(x=>`${x.titulo} [${(serieDe(x)||{}).nome||'sem série'}] = ${x.views||0} views`).join('; ')||'sem dados ainda'}.
Diga: o padrão dos que foram bem, o que parar de fazer, se a proporção das séries está certa e 3 pautas para repetir o que funcionou (com o par de Raio-X de cada uma).${contexto(null)}`;
    case 'estrategia':
      if(tipo==='olivetto') return `/washington-olivetto — Briefing completo para pular a Fase 1.
Produto: Raio-X do seu Instagram ou do seu negócio, em segundos. Diagnóstico do perfil (o que funciona, público que engaja, séries, melhor horário, arquétipo da marca e linha editorial), low ticket perpétuo vendido pelo Instagram ${arroba()}. Demonstração: ${RAIOX_URL}.
Público: profissionais liberais e empresas (médico, dentista, advogado, arquiteto, clínica, loja), 25 a 44 anos, que postam sem saber o que funciona e não vendem pelo Instagram.
Contramão do mercado: todo mundo vende "mais conteúdo"; aqui o designer mostra em segundos o que parar de fazer e qual é a marca por trás do perfil.
Entregue: três caminhos de campanha, o filme de 30 s e o anúncio de feed do recomendado, a oferta (com order bump de plano de 30 dias e garantia) e dez bordões ranqueados pelo teste do bar.${contexto(null)}`;
      return `/reels-viral (modo Crescer o perfil) e /carrossel-viral — Monte o plano das próximas 4 semanas para ${arroba()}: 4 posts por semana na proporção das séries, cada post com título, série, formato (F1–F10 ou motor V/A), gancho e o par de Raio-X. Alterne o fundo do funil por semana (case do studio numa, prova do Raio-X na outra) e marque as sextas, das 15h às 17h, para os posts mais fortes.${contexto(null)}`;
  }
  return '';
}
const limpa = s => s.replace(/[*_`]/g,'').trim();
export function lerPesquisa(txt){
  let itens = txt.split(/^#{2,3}\s+/m).slice(1).map(p=>{ const [t,...r] = p.split('\n'); return {titulo:limpa(t.replace(/^(assunto\s*)?\d+\s*[\.\):\-–]\s*/i,'')), pesquisa:r.join('\n').trim()}; });
  if(!itens.length) itens = txt.split('\n').filter(l=>/^\s*\d+[\.\)]\s+/.test(l)).map(l=>({titulo:limpa(l.replace(/^\s*\d+[\.\)]\s+/,'')), pesquisa:''}));
  const serieDoTexto = t => { const m = t.match(/s[ée]rie\s*:\s*(.+)/i); if(!m) return null; const v = m[1].toLowerCase(); const x = DNA.series.find(x=>v.includes(x.nome.toLowerCase())); return x ? x.id : null; };
  return itens.filter(i=>i.titulo).map(i=>({...i, serie: serieDoTexto(i.pesquisa), formato: /carross/i.test(i.pesquisa) ? 'Carrossel' : /stories/i.test(i.pesquisa) ? 'Stories' : 'Reel'}));
}
export { contexto, arroba };
