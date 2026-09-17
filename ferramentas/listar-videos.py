# -*- coding: utf-8 -*-
"""Varre a pasta do Drive dos criativos em vídeo e escreve o bloco VIDEOS
dentro de ferramentas/painel.fonte.html.

As pastas estão compartilhadas por link, então dá para listar sem login
usando o embeddedfolderview — a mesma coisa que o painel usa para exibir.

Estrutura no Drive:  TIPO / ADxx / [RGV][PER][VD][STORYS|FEED][...].mp4
O painel mostra só STORYS.

    python3 ferramentas/listar-videos.py
"""
import io, json, os, re, sys, unicodedata, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, "ferramentas", "painel.fonte.html")

PASTA_RAIZ = "1mhwJd0IgSt0hESPFP-cOIbVBdGZgElGy"
VERSAO = "STORYS"

TIPOS = [
    ("AUTORIDADE",        "12v3H2BqY1Rl5Zzce0fgGrxSEhe33nuVl"),
    ("DIFERENCIAL",       "1X1cM9jZsiWG_QBJ6ZerQ5SQ5FxM2XE_x"),
    ("GERAÇÃO DE VALOR",  "1ZpQE4TqXA5MdfIPTNR40-keW34Pw95Pt"),
    ("IDENTIFICAÇÃO",     "1n2YYlZKMKcwYAyvewuOewYLJSmgY4Ube"),
    ("POSICIONAMENTO",    "1lWS3TWYP5p_RQGnUcnV7Puq6Ylp94K_k"),
    ("PROVA SOCIAL",      "1FjRWeoIUdhzzMHrBFnmWwNoyjsWs4Pek"),
    ("QUEBRA DE OBJEÇÃO", "1leeXq1VcMOTa4x7_0_DflD160TvcvHps"),
]


def slug(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", t.lower())


def listar(fid):
    u = f"https://drive.google.com/embeddedfolderview?id={fid}#list"
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        t = r.read().decode("utf-8", "ignore")
    return re.findall(
        r'href="https://drive\.google\.com/(file/d/|drive/folders/)([\w-]{20,})[^"]*"[^>]*>.*?'
        r'<div class="flip-entry-title">([^<]+)', t, re.S)


grupos = []
for tipo, fid in TIPOS:
    videos = []
    for kind, aid, nome in listar(fid):
        if "folders" not in kind:
            continue
        ad = nome.strip()
        for k2, arq, nome2 in listar(aid):
            if "file" in k2 and f"[{VERSAO}]" in nome2:
                videos.append({"id": f"{slug(tipo)}__{ad.lower()}", "code": ad,
                               "drive": arq, "arquivo": nome2.strip()})
                break
    grupos.append({"tipo": tipo, "videos": videos})
    print(f"  {tipo:20} {len(videos)}", file=sys.stderr)

total = sum(len(g["videos"]) for g in grupos)
print(f"  {'TOTAL':20} {total}", file=sys.stderr)

L = ["  var VIDEOS = ["]
for g in grupos:
    L.append("    {tipo:%s, videos:[" % json.dumps(g["tipo"], ensure_ascii=False))
    for v in g["videos"]:
        L.append("      {id:%s, code:%s, drive:%s}," % (
            json.dumps(v["id"]), json.dumps(v["code"]), json.dumps(v["drive"])))
    if g["videos"]:
        L[-1] = L[-1][:-1]
    L.append("    ]},")
L[-1] = L[-1][:-1]
L.append("  ];")
bloco = "\n".join(L)

s = io.open(FONTE, encoding="utf-8").read()
ini, fim = "  /* VIDEOS:inicio */\n", "  /* VIDEOS:fim */"
assert ini in s and fim in s, "marcadores VIDEOS não encontrados em painel.fonte.html"
antes, resto = s.split(ini, 1)
_, depois = resto.split(fim, 1)
io.open(FONTE, "w", encoding="utf-8").write(antes + ini + bloco + "\n" + fim + depois)
print(f"\nbloco VIDEOS escrito em painel.fonte.html", file=sys.stderr)
