/**
 * Central de Conteúdo R1 — sincroniza o acervo do Drive
 *
 * Cole isto em script.google.com, numa conta que enxergue as duas pastas.
 * Roda como você: não precisa de chave de API, projeto no Google Cloud nem
 * conta de serviço — e alcança o Drive compartilhado, que é restrito e que
 * uma chave de API não leria.
 *
 * COMO LIGAR
 *   1. script.google.com → Novo projeto → cole este arquivo
 *   2. troque SEGREDO pelo mesmo valor que estiver em SINCRONIA_TOKEN na Vercel
 *   3. rode sincronizarTudo() uma vez (autoriza o acesso ao Drive na 1ª vez)
 *   4. rode instalarGatilho() uma vez — passa a rodar de hora em hora
 *
 * O gatilho de hora em hora só olha o que mudou desde a última execução:
 * são poucas chamadas e termina em segundos. A varredura completa é a
 * exceção, e sabe retomar de onde parou se o Apps Script cortar em 6 min.
 */

var ENDPOINT = 'https://central-conteudo-r1.vercel.app/api/acervo';
var SEGREDO  = 'troque-por-um-segredo-longo';

var RAIZES = [
  { id: '1msQi2GzhNegZ3zoUp-nZoHUoVNDTf9ni', nome: 'pasta mãe' },
  { id: '0AG9trcmEgnm7Uk9PVA',               nome: 'EVENTOS E LIVES' }
];

var VIDEO = /\.(mp4|mov|m4v|avi|mkv|webm|mpg|mpeg|wmv)$/i;
var LIMITE_MS = 4.5 * 60 * 1000;   // corta antes do teto de 6 min do Apps Script
var LOTE = 400;

/* ---------------------------------------------------------------- */

function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === 'sincronizarNovidades') ScriptApp.deleteTrigger(g);
  });
  ScriptApp.newTrigger('sincronizarNovidades').timeBased().everyHours(1).create();
  Logger.log('gatilho de hora em hora instalado');
}

/** O que roda sozinho: só o que mudou desde a última vez. */
function sincronizarNovidades() {
  var props = PropertiesService.getScriptProperties();
  var desde = props.getProperty('ultimaSync') ||
              new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  var agora = new Date().toISOString();

  var busca = 'modifiedDate > "' + desde + '" and trashed = false';
  var it = DriveApp.searchFiles(busca);
  var raizes = {};
  RAIZES.forEach(function (r) { raizes[r.id] = true; });

  var itens = [], vistos = 0;
  while (it.hasNext()) {
    var f = it.next();
    vistos++;
    if (!VIDEO.test(f.getName())) continue;
    var caminho = caminhoDe(f, raizes);
    if (caminho === null) continue;            // fora das nossas pastas
    itens.push(peca(f, caminho));
  }

  if (itens.length) enviar({ modo: 'upsert', itens: itens });
  props.setProperty('ultimaSync', agora);
  Logger.log('mudaram ' + vistos + ' arquivos; ' + itens.length + ' vídeos enviados');
}

/** Varredura completa. Retoma sozinha se estourar o tempo. */
function sincronizarTudo() {
  var props = PropertiesService.getScriptProperties();
  var fila = JSON.parse(props.getProperty('fila') || 'null');
  if (!fila) {
    fila = RAIZES.map(function (r) { return { id: r.id, caminho: '' }; });
    props.deleteProperty('parcial');
  }

  var inicio = Date.now(), itens = [], pastas = 0;

  while (fila.length && Date.now() - inicio < LIMITE_MS) {
    var atual = fila.shift();
    pastas++;
    var pasta;
    try { pasta = DriveApp.getFolderById(atual.id); } catch (e) { continue; }

    var subs = pasta.getFolders();
    while (subs.hasNext()) {
      var sf = subs.next();
      fila.push({ id: sf.getId(), caminho: junta(atual.caminho, sf.getName()) });
    }

    var arqs = pasta.getFiles();
    while (arqs.hasNext()) {
      var f = arqs.next();
      if (!VIDEO.test(f.getName())) continue;
      itens.push(peca(f, atual.caminho || pasta.getName()));
      if (itens.length >= LOTE) { enviar({ modo: 'upsert', itens: itens }); itens = []; }
    }
  }

  if (itens.length) enviar({ modo: 'upsert', itens: itens });

  if (fila.length) {
    props.setProperty('fila', JSON.stringify(fila));
    ScriptApp.newTrigger('sincronizarTudo').timeBased().after(30 * 1000).create();
    Logger.log('parei em ' + pastas + ' pastas; faltam ' + fila.length + ' — continuo em 30s');
  } else {
    props.deleteProperty('fila');
    props.setProperty('ultimaSync', new Date().toISOString());
    limparGatilhosDe('sincronizarTudo');
    Logger.log('varredura completa terminada');
  }
}

/* ---------------------------------------------------------------- */

function peca(f, caminho) {
  var nome = f.getName().replace(VIDEO, '');
  var d = f.getLastUpdated();
  return {
    i: f.getId(),
    t: nome,
    p: caminho,
    dt: Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd'),
    m: Math.round(f.getSize() / (1024 * 1024))
  };
}

/** Sobe pelos pais até achar uma das raízes. null = está fora delas. */
function caminhoDe(f, raizes) {
  var partes = [], no = f, voltas = 0;
  while (voltas++ < 12) {
    var pais = no.getParents();
    if (!pais.hasNext()) return null;
    var pai = pais.next();
    if (raizes[pai.getId()]) return partes.reverse().join(' / ');
    partes.push(pai.getName());
    no = pai;
  }
  return null;
}

function junta(a, b) { return a ? a + ' / ' + b : b; }

function limparGatilhosDe(nome) {
  ScriptApp.getProjectTriggers().forEach(function (g) {
    if (g.getHandlerFunction() === nome) ScriptApp.deleteTrigger(g);
  });
}

function enviar(corpo) {
  var r = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sincronia': SEGREDO },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true
  });
  if (r.getResponseCode() >= 300) {
    throw new Error('endpoint respondeu ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  }
  Logger.log(r.getContentText());
}
