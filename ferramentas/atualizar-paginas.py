# -*- coding: utf-8 -*-
"""Le a planilha "MDV - Outubro 2026" e alimenta as duas pontas:
   - o bloco FUNIS de ferramentas/painel.fonte.html (o que a pessoa ve)
   - api/lista-paginas.js (o que a medicao automatica percorre)

Rode sempre que mexerem na planilha, e depois gerar-index.py:

    python3 ferramentas/atualizar-paginas.py
    python3 ferramentas/gerar-index.py
    netlify deploy --prod
"""
import csv, io, json, os, re, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, "ferramentas", "painel.fonte.html")
FUNCOES = os.path.join(RAIZ, "api")

SHEET = "1IisavtxiR2zbolDmhcivWmMXx3zVuVGNB6TO-S8DN3g"
GID = "1626754994"
ROTULO = {"ROTA 45 V3 - PADRÃO": "V3 · Padrão", "ROTA 45 - V4": "V4", "ROTA 45 - V5": "V5"}

# Funis que saem do painel por completo. A V3 e o padrao antigo, substituido
# pela V4 e V5 — deixar as 11 paginas na tela so poluia a comparacao.
OCULTAR = ("V3",)


def ident(url):
    """id estavel por pagina, derivado do caminho da URL"""
    caminho = re.sub(r"^https?://[^/]+/", "", url.strip()).strip("/")
    return re.sub(r"[^A-Za-z0-9_-]", "_", caminho)[:120]


def ler():
    u = f"https://docs.google.com/spreadsheets/d/{SHEET}/export?format=csv&gid={GID}"
    with urllib.request.urlopen(u, timeout=60) as r:
        linhas = list(csv.reader(io.StringIO(r.read().decode("utf-8"))))

    funil, grupos, ordem = "", {}, []
    for r in linhas[1:]:
        if not any(c.strip() for c in r):
            continue
        if r[0].strip():
            funil = " ".join(r[0].split())
        cidade, url = " ".join(r[2].split()), r[3].strip()
        if not (cidade and url):
            continue
        if funil not in grupos:
            grupos[funil] = []
            ordem.append(funil)

        def nota(v):
            v = v.strip()
            return int(v) if re.fullmatch(r"\d+", v) else None

        grupos[funil].append({
            "id": ident(url), "cidade": cidade, "data": r[1].strip(), "url": url,
            "status": r[4].strip(), "mobile": nota(r[5]), "desktop": nota(r[6]),
        })
    todos = [{"funil": f, "versao": ROTULO.get(f, f), "paginas": grupos[f]} for f in ordem]
    return [g for g in todos if not g["versao"].startswith(OCULTAR)]


def bloco_js(dados):
    L = ["  var FUNIS = ["]
    for g in dados:
        L.append('    {nome:"Rota 45", versao:%s, paginas:[' % json.dumps(g["versao"], ensure_ascii=False))
        for p in g["paginas"]:
            L.append('      {id:%s, cidade:%s, data:%s, status:%s, mobile:%s, desktop:%s, url:%s},' % (
                json.dumps(p["id"]), json.dumps(p["cidade"], ensure_ascii=False),
                json.dumps(p["data"]), json.dumps(p["status"], ensure_ascii=False),
                p["mobile"] if p["mobile"] is not None else "null",
                p["desktop"] if p["desktop"] is not None else "null",
                json.dumps(p["url"], ensure_ascii=False)))
        L[-1] = L[-1][:-1]
        L.append("    ]},")
    L[-1] = L[-1][:-1]
    L.append("  ];")
    return "\n".join(L)


dados = ler()

s = io.open(FONTE, encoding="utf-8").read()
ini, fim = "  /* FUNIS:inicio */\n", "  /* FUNIS:fim */"
assert ini in s and fim in s, "marcadores FUNIS nao encontrados em painel.fonte.html"
antes, resto = s.split(ini, 1)
_, depois = resto.split(fim, 1)
io.open(FONTE, "w", encoding="utf-8").write(antes + ini + bloco_js(dados) + "\n" + fim + depois)

lista = [{"id": p["id"], "url": p["url"], "cidade": p["cidade"], "versao": g["versao"]}
         for g in dados for p in g["paginas"]]
io.open(os.path.join(FUNCOES, "lista-paginas.js"), "w", encoding="utf-8").write(
    "// Gerado por ferramentas/atualizar-paginas.py a partir da planilha MDV - Outubro 2026.\n"
    "// Nao edite a mao: rode o script de novo.\n"
    "export const PAGINAS = " + json.dumps(lista, ensure_ascii=False, indent=2) + ";\n")

print(f"{sum(len(g['paginas']) for g in dados)} paginas · {len(dados)} funis")
for g in dados:
    print(f"  {g['versao']}: {len(g['paginas'])}")
print(f"ocultos do painel: {', '.join(OCULTAR)}")
print("\nagora rode: python3 ferramentas/gerar-index.py")
