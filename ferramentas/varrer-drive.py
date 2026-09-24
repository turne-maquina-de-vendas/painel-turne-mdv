import re,html,json,sys,time
from concurrent.futures import ThreadPoolExecutor
import urllib.request

MAE="1msQi2GzhNegZ3zoUp-nZoHUoVNDTf9ni"
ENTRY=re.compile(r'<div class="flip-entry" id="entry-([^"]+)"(.*?)(?=<div class="flip-entry" id="entry-|<div class="flip-footer|\Z)',re.S)
TIT=re.compile(r'flip-entry-title">(.*?)</div>',re.S)
MOD=re.compile(r'flip-entry-last-modified"><div>(.*?)</div>',re.S)
FOLD=re.compile(r'aria-label="Folder"')

def pega(fid,tent=3):
    u="https://drive.google.com/embeddedfolderview?id=%s#list"%fid
    for i in range(tent):
        try:
            r=urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"})
            return urllib.request.urlopen(r,timeout=40).read().decode("utf-8","replace")
        except Exception:
            time.sleep(1+i)
    return ""

def lista(fid):
    s=pega(fid); out=[]
    for eid,b in ENTRY.findall(s):
        t=TIT.search(b); m=MOD.search(b)
        out.append({"id":eid,
                    "nome":html.unescape(re.sub("<[^>]+>","",t.group(1))).strip() if t else "",
                    "data":html.unescape(re.sub("<[^>]+>","",m.group(1))).strip() if m else "",
                    "pasta":bool(FOLD.search(b))})
    return out

arquivos=[]; pastas=[]
fila=[(MAE,"")]
visto=set()
while fila:
    lote=fila[:24]; fila=fila[24:]
    with ThreadPoolExecutor(12) as ex:
        res=list(ex.map(lambda x:(x,lista(x[0])), lote))
    for (fid,caminho),itens in res:
        for it in itens:
            if it["id"] in visto: continue
            visto.add(it["id"])
            novo = (caminho+" / "+it["nome"]).strip(" /") if caminho else it["nome"]
            if it["pasta"]:
                pastas.append({"id":it["id"],"caminho":novo})
                fila.append((it["id"],novo))
            else:
                arquivos.append({"i":it["id"],"t":it["nome"],"p":caminho,"dt":it["data"]})
    print("pastas=%d arquivos=%d fila=%d"%(len(pastas),len(arquivos),len(fila)),flush=True)

json.dump({"pastas":pastas,"arquivos":arquivos},open("/tmp/crawl/tree.json","w"),ensure_ascii=False)
print("FIM pastas=%d arquivos=%d"%(len(pastas),len(arquivos)))
