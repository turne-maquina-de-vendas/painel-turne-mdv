# -*- coding: utf-8 -*-
"""Gera ferramentas/urls-para-medir.txt com as paginas de um funil.

    python3 ferramentas/listar-urls.py V3     # so a V3
    python3 ferramentas/listar-urls.py        # todas
"""
import io, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTA = os.path.join(RAIZ, "api", "lista-paginas.js")
SAIDA = os.path.join(RAIZ, "ferramentas", "urls-para-medir.txt")

filtro = sys.argv[1].upper() if len(sys.argv) > 1 else None
bruto = io.open(LISTA, encoding="utf-8").read()
paginas = json.loads(bruto.split("=", 1)[1].rsplit(";", 1)[0])
if filtro:
    paginas = [p for p in paginas if p["versao"].upper().startswith(filtro)]

io.open(SAIDA, "w", encoding="utf-8").write(
    "".join(f"{p['id']}\t{p['url']}\t{p['cidade']}\t{p['versao']}\n" for p in paginas))
print(f"{len(paginas)} paginas em ferramentas/urls-para-medir.txt")
