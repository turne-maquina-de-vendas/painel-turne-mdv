# -*- coding: utf-8 -*-
"""Le os JSON do Lighthouse em .medicoes/ e manda para o painel."""
import io, json, os, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAB = os.path.join(RAIZ, ".medicoes")
LISTA = os.path.join(RAIZ, "ferramentas", "urls-para-medir.txt")
API = os.environ.get("API", "https://painelturnemdv.vercel.app/api/estado")


def nota(caminho):
    try:
        d = json.load(io.open(caminho, encoding="utf-8"))
        s = d["categories"]["performance"]["score"]
        lcp = d["audits"]["largest-contentful-paint"].get("displayValue")
        return {"nota": round(s * 100), "lcp": lcp, "temCampo": False}
    except Exception:
        return None


enviados = falhas = 0
for linha in io.open(LISTA, encoding="utf-8"):
    partes = linha.rstrip("\n").split("\t")
    if len(partes) < 4:
        continue
    pid, url, cidade, versao = partes[:4]
    m = nota(os.path.join(TRAB, f"{pid}__mobile.json"))
    d = nota(os.path.join(TRAB, f"{pid}__desktop.json"))
    if not (m or d):
        falhas += 1
        print(f"  {cidade}: sem resultado")
        continue

    corpo = json.dumps({
        "tipo": "medicao", "id": pid, "url": url, "cidade": cidade,
        "versao": versao, "origem": "local",
        "mobile": m or {}, "desktop": d or {},
    }).encode("utf-8")
    req = urllib.request.Request(API, data=corpo,
                                 headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read()
        enviados += 1
        print(f"  {cidade}: mobile {m and m['nota']} · desktop {d and d['nota']}")
    except Exception as e:
        falhas += 1
        print(f"  {cidade}: erro ao enviar — {e}")

print(f"\n{enviados} enviadas, {falhas} falhas")
