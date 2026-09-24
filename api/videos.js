/* Acervo de vídeos vindo do Drive.

   O painel nasceu com as listas de vídeo cravadas no index.html, geradas na
   mão por ferramentas/listar-videos.py. Toda vez que alguém subia um vídeo
   novo, alguém tinha que rodar o script e publicar de novo.

   Aqui a leitura passa a ser do próprio Drive, pela API oficial, e o
   resultado fica guardado no banco. O cron varre de tempos em tempos; o
   painel lê o que está guardado. Se a varredura falhar, o painel continua
   com a última boa — e, na pior das hipóteses, com a lista cravada no HTML.

   GET /api/videos            devolve o que está guardado
   GET /api/videos?varrer=1   varre o Drive e guarda (é o que o cron chama)
*/
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export const config = { maxDuration: 300 };

/* Cada produto aponta para a pasta raiz dos vídeos dele e diz qual versão
   entra no painel. A estrutura varia — uns têm leva/cidade, outros só
   tipo —, mas em todos a pasta do AD é a folha e o nome do grupo é a pasta
   logo acima dela. É isso que a varredura procura. */
const PASTAS = {
  mdv: { id: "1wqRYVAbgTSmgEBbXvtclsB1qHjL9vazw", versao: "FEED" },
  rgv: { id: "1mhwJd0IgSt0hESPFP-cOIbVBdGZgElGy", versao: "STORYS" },
  mqv: { id: "1WaZEzFDHWqEbmpd5KsJxuF6-jL40gYt6", versao: "FEED" },
  met: { id: "1QfctN83oT0rtk7MAm4hKUafE0YxG2_c_", versao: "FEED" },
  b10x: { id: "1vKkMAcVznyJ2iNRycxLK-j-qewAgdRFb", versao: "FEED" },
};

const PROFUNDIDADE = 4;        // raiz → leva → cidade → AD já é o pior caso
const TEMPO_LIMITE = 240000;   // abaixo do maxDuration, para responder sempre

function responder(res, corpo, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(corpo));
}

async function chaveDoDrive() {
  try {
    const [r] = await sql`select valor from config where chave = 'GOOGLE_API_KEY'`;
    if (r && r.valor) return r.valor;
  } catch { /* tabela ausente: cai no ambiente */ }
  return process.env.GOOGLE_API_KEY || null;
}

async function listar(pai, chave) {
  const u = new URL("https://www.googleapis.com/drive/v3/files");
  u.searchParams.set("q", `'${pai}' in parents and trashed = false`);
  u.searchParams.set("fields", "files(id,name,mimeType)");
  u.searchParams.set("pageSize", "200");
  u.searchParams.set("orderBy", "name");
  /* as pastas moram num drive compartilhado: sem isso a resposta vem vazia,
     com status 200, sem erro nenhum — foi o que confundiu na primeira vez */
  u.searchParams.set("supportsAllDrives", "true");
  u.searchParams.set("includeItemsFromAllDrives", "true");
  u.searchParams.set("key", chave);

  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  const d = await r.json();
  return d.files || [];
}

async function nomeDe(id, chave) {
  const u = new URL("https://www.googleapis.com/drive/v3/files/" + id);
  u.searchParams.set("fields", "name");
  u.searchParams.set("supportsAllDrives", "true");
  u.searchParams.set("key", chave);
  const r = await fetch(u, { cache: "no-store" });
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return (await r.json()).name || "";
}

const ePasta = (f) => f.mimeType === "application/vnd.google-apps.folder";
const eVideo = (f) => (f.mimeType || "").startsWith("video/");

function normal(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/* escolhe o arquivo da versão pedida; se ela não existe, não inventa outra */
function daVersao(arquivos, versao) {
  const v = normal(versao);
  const bate = arquivos.filter((f) => normal(f.name).includes(v));
  if (bate.length) return bate[0];
  /* STORYS e STORY aparecem escritos das duas formas nas pastas */
  if (v === "STORYS") {
    const alt = arquivos.filter((f) => normal(f.name).includes("STORY"));
    if (alt.length) return alt[0];
  }
  return null;
}

function idDe(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/* Desce a árvore. Uma pasta que só tem arquivos é um AD; o grupo dele é o
   nome da pasta que o contém. */
async function varrerPasta(id, nome, chave, versao, nivel, grupos, expira) {
  if (nivel > PROFUNDIDADE || Date.now() > expira) return;
  const itens = await listar(id, chave);
  const pastas = itens.filter(ePasta);

  if (!pastas.length) return;                    // folha sem subpastas: nada a fazer

  /* as subpastas são ADs se elas próprias não têm subpastas */
  const filhas = [];
  for (let i = 0; i < pastas.length; i += 8) {
    if (Date.now() > expira) return;
    const lote = pastas.slice(i, i + 8);
    const itens = await Promise.all(lote.map((p) => listar(p.id, chave)));
    lote.forEach((p, k) => filhas.push({ pasta: p, itens: itens[k] }));
  }
  const saoAds = filhas.every((f) => !f.itens.some(ePasta) && f.itens.some(eVideo));

  if (saoAds) {
    const videos = [];
    for (const f of filhas) {
      const arq = daVersao(f.itens.filter(eVideo), versao);
      if (!arq) continue;
      videos.push({
        id: `${idDe(nome)}__${idDe(f.pasta.name)}`,
        code: f.pasta.name.trim(),
        drive: arq.id,
      });
    }
    if (videos.length) grupos.push({ tipo: nome.trim(), videos });
    return;
  }

  for (const f of filhas) {
    await varrerPasta(f.pasta.id, f.pasta.name, chave, versao, nivel + 1, grupos, expira);
  }
}

async function varrer(chave, expira) {
  const saida = {};
  for (const [produto, cfg] of Object.entries(PASTAS)) {
    if (Date.now() > expira) { saida[produto] = { erro: "tempo esgotado" }; continue; }
    try {
      const grupos = [];
      /* a raiz precisa do nome de verdade: na MQV Online os ADs ficam direto
         nela, e o grupo passa a ser ela mesma */
      await varrerPasta(cfg.id, await nomeDe(cfg.id, chave), chave, cfg.versao, 0, grupos, expira);
      saida[produto] = { grupos: grupos.filter((g) => g.tipo) };
    } catch (e) {
      saida[produto] = { erro: String(e.message).slice(0, 140) };
    }
  }
  return saida;
}

export default async function handler(req, res) {
  const querVarrer = String(req.query?.varrer || "") === "1";

  if (!querVarrer) {
    try {
      const linhas = await sql`select produto, dados, quando from acervo_video`;
      const out = {};
      for (const l of linhas) out[l.produto] = { grupos: l.dados?.grupos || [], quando: l.quando };
      return responder(res, out);
    } catch {
      return responder(res, {});      // tabela ainda não existe: painel usa o HTML
    }
  }

  const chave = await chaveDoDrive();
  if (!chave) return responder(res, { erro: "sem GOOGLE_API_KEY" }, 500);

  const expira = Date.now() + TEMPO_LIMITE;
  const varrido = await varrer(chave, expira);

  await sql`create table if not exists acervo_video (
              produto text primary key,
              dados   jsonb not null,
              quando  timestamptz not null default now())`;

  const resumo = {};
  for (const [produto, r] of Object.entries(varrido)) {
    if (r.erro) { resumo[produto] = "erro: " + r.erro; continue; }
    const n = r.grupos.reduce((a, g) => a + g.videos.length, 0);
    /* varredura vazia não apaga o que já está guardado: pasta fora do ar ou
       permissão trocada não pode zerar o painel */
    if (!n) { resumo[produto] = "vazio — mantido o anterior"; continue; }
    await sql`insert into acervo_video (produto, dados, quando)
              values (${produto}, ${JSON.stringify({ grupos: r.grupos })}, now())
              on conflict (produto) do update
              set dados = excluded.dados, quando = now()`;
    resumo[produto] = `${r.grupos.length} grupos · ${n} vídeos`;
  }
  return responder(res, { quando: new Date().toISOString(), resumo });
}
