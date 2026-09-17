# -*- coding: utf-8 -*-
"""Converte ferramentas/painel.fonte.html (versao que roda como artifact no
claude.ai, usando window.claude) no index.html do Netlify, que usa a funcao
/api/estado e a fila local de envio.

    python3 ferramentas/gerar-index.py
"""
import io, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, "ferramentas", "painel.fonte.html")
OUT = RAIZ

s = io.open(SRC, encoding="utf-8").read()

# 1) a flag do db sai
s = s.replace("""  var db       = null;
  var lbArte = null, lbIdx = 0;""",
"""  var lbArte = null, lbIdx = 0;""")

# 2) gravacao passa pela API
s = s.replace("""  function gravarStatus(key, reg){
    if(db){
      db.doc("artes/" + key).set(reg).catch(function(err){ falhou("decisão", err); salvarLocal(); });
    }else{
      salvarLocal();
    }
  }

  function gravarNota(nota){
    if(db){
      db.collection("anotacoes").add(nota).catch(function(err){
        falhou("anotação", err);
        notas.push(Object.assign({id:"local-"+Date.now()}, nota));
        salvarLocal(); renderAll();
      });
    }else{
      notas.push(Object.assign({id:"local-"+Date.now()}, nota));
      salvarLocal(); renderAll();
    }
  }""",
"""  function gravarStatus(key, reg){
    enfileirar({tipo:"status", key:key, status:reg.status, em:reg.em, remessa:reg.remessa});
  }

  function gravarNota(nota){
    enfileirar({tipo:"nota", arteKey:nota.arteKey, remessa:nota.remessa,
                texto:nota.texto, criadoEm:nota.criadoEm});
  }""")

# 3) falhou() era so do db
i = s.index("  function falhou(oque, err){")
j = s.index("  // ---------- gravação ----------")
s = s[:i] + s[j:]

# 4) sincronismo + boot no lugar do bloco window.claude
velho = s[s.index("  // ---------- boot ----------"):s.index("})();")]
novo = """  // ---------- sincronismo com o servidor ----------
  /* Estado compartilhado mora numa função Netlify (Netlify Blobs).
     Busca a cada 4s, e logo depois de cada gravação.

     Nada que a pessoa escreve depende da rede dar certo na hora: a anotação
     entra numa fila guardada no próprio navegador, aparece na tela marcada
     como "enviando…", e só sai da fila quando o servidor confirma. Se a
     conexão cair, ou a pessoa atualizar a página no meio, a fila continua
     lá e é reenviada sozinha. */
  var API = "/api/estado";
  var ultimaSig = "";
  var notasServidor = [];
  var fila = [];          // anotações e decisões ainda não confirmadas
  var enviando = false;

  function carregarFila(){
    try{ fila = JSON.parse(lsGet("mv_cg_fila") || "[]") || []; }catch(e){ fila = []; }
  }
  function salvarFila(){ lsSet("mv_cg_fila", JSON.stringify(fila)); }

  /* junta o que veio do servidor com o que ainda está na fila */
  function recompor(){
    notas = notasServidor.concat(
      fila.filter(function(f){ return f.tipo === "nota"; }).map(function(f){
        return {id:f.id, arteKey:f.arteKey, remessa:f.remessa,
                texto:f.texto, criadoEm:f.criadoEm, pendente:true};
      })
    ).sort(function(a,b){ return String(a.criadoEm).localeCompare(String(b.criadoEm)); });

    fila.filter(function(f){ return f.tipo === "status"; }).forEach(function(f){
      status[f.key] = {status:f.status, em:f.em, remessa:f.remessa};
    });

    salvarLocal();
    renderAll();
  }

  function aplicar(estado){
    if(!estado || typeof estado !== "object") return;
    var sig = JSON.stringify(estado) + "|" + fila.length;
    if(sig === ultimaSig) return;        // nada mudou: não repinta
    ultimaSig = sig;
    status = estado.artes || {};
    notasServidor = estado.anotacoes || [];
    medicoes = estado.medicoes || {};      // notas do PageSpeed medidas sozinhas
    execucao = estado.execucao || null;
    recompor();
  }

  function buscar(){
    return fetch(API, {cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(e){ marcarLive(true, fila.length ? "enviando pendentes" : null); aplicar(e); esvaziar(); })
      .catch(function(){ marcarLive(false, "sem conexão — nada foi perdido"); });
  }

  function mandar(payload){
    return fetch(API, {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    })
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(e){ marcarLive(true); aplicar(e); return true; })
      .catch(function(){ marcarLive(false, "sem conexão — nada foi perdido"); return false; });
  }

  /* envia a fila em ordem, um de cada vez; o que falhar fica para a próxima */
  function esvaziar(){
    if(enviando || !fila.length) return;
    enviando = true;
    var item = fila[0];
    var carga = item.tipo === "nota"
      ? {tipo:"nota", arteKey:item.arteKey, remessa:item.remessa, texto:item.texto, criadoEm:item.criadoEm}
      : {tipo:"status", key:item.key, status:item.status, em:item.em, remessa:item.remessa};

    mandar(carga).then(function(ok){
      enviando = false;
      if(!ok) return;                 // tenta de novo na próxima busca
      fila.shift(); salvarFila(); recompor();
      esvaziar();
    });
  }

  function enfileirar(item){
    item.id = "f-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
    fila.push(item); salvarFila(); recompor(); esvaziar();
  }

  // ---------- boot ----------
  carregarLocal();
  carregarFila();
  recompor();
  marcarLive(false, "conectando");
  buscar();

  setInterval(function(){ if(!document.hidden) buscar(); }, 4000);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) buscar(); });
  window.addEventListener("online", buscar);

"""
s = s.replace(velho, novo)

assert "window.claude" not in s and "enfileirar({tipo:" in s and "esvaziar" in s, "transformacao incompleta"

# 5) documento HTML completo (a versao artifact nao tem head)
titulo = "<title>Remessa Campina Grande</title>"
corpo = s.split(titulo, 1)[1]
cabeca, resto = corpo.split("</style>", 1)
# Arquivos de verdade em vez de data URI: vários navegadores ignoram SVG
# embutido no href e caem no /favicon.ico.
favicon = (
    '<link rel="icon" href="/favicon.ico" sizes="any">\n'
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">')

doc = ("""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Painel de aprovacao das artes de feed - Turne Maquina de Vendas, Campina Grande.">
<meta name="color-scheme" content="dark">
""" + favicon + "\n" + titulo + cabeca + "</style>\n</head>\n<body>\n"
+ resto.strip() + "\n</body>\n</html>\n")

io.open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(doc)
print("index.html regenerado em", OUT)

# Rede de segurança: os geradores escrevem blocos com nomes que o painel
# referencia. Já quebrou uma vez — atualizar-paginas.py voltou a emitir
# `var FUNIS` e o clique no produto morria com ReferenceError.
import re as _re
_esperados = ["REMESSAS_MDV", "FUNIS_MDV", "FUNIS_RGV", "VIDEOS_RGV", "PRODUTOS"]
_faltando = [n for n in _esperados
             if not _re.search(r"\bvar\s+" + n + r"\b", doc) and (n + " = {") not in doc]
if _faltando:
    raise SystemExit("ERRO: o index ficou sem " + ", ".join(_faltando))
print("nomes conferidos:", ", ".join(_esperados))
