# Copia as skills do perfil para lib/skills.js, que vai junto na Function (o servidor do Netlify não enxerga ~/.claude/skills).
# Também copia os prompts e o DNA do site para lib/site.js, para o servidor usar os mesmos do index.html.
# Rode de novo sempre que as skills ou os prompts mudarem, e publique (o deploy.sh já roda).
import json, pathlib
base = pathlib.Path.home() / '.claude/skills'
arquivos = ['reels-viral/SKILL.md', 'reels-viral/references/dna-reels.md', 'reels-viral/references/crescimento-perfil.md', 'reels-viral/references/primal-branding.md',
            'carrossel-viral/SKILL.md', 'carrossel-viral/references/dna-lucasfigueiredoart.md',
            'washington-olivetto/SKILL.md', 'washington-olivetto/references/repertorio.md']
# Sem as skills nesta máquina, mantém o lib/skills.js atual e gera só o lib/site.js.
if all((base / a).exists() for a in arquivos) and (base / 'high-end-visual-design/SKILL.md').exists():
    partes = [f'<documento nome="{a}">\n{(base / a).read_text().strip()}\n</documento>' for a in arquivos]
    texto = '\n\n'.join(partes)
    design = (base / 'high-end-visual-design/SKILL.md').read_text().strip()
    pathlib.Path(__file__).with_name('lib').joinpath('skills.js').write_text('// Gerado por gerar_skills.py. Não editar à mão.\nexport const SKILLS = ' + json.dumps(texto, ensure_ascii=False) + ';\nexport const SKILL_DESIGN = ' + json.dumps(design, ensure_ascii=False) + ';\n')
    print(len(texto), 'caracteres')
else:
    print('Skills não encontradas: lib/skills.js mantido como está.')

# Prompts e DNA: uma fonte só, o agencia-3d/index.html.
html = pathlib.Path(__file__).parent.parent.joinpath('agencia-3d/index.html').read_text()
def trecho(de, ate):
    i = html.index(de); return html[i:html.index(ate, i)]
site = ('// Gerado por gerar_skills.py a partir de agencia-3d/index.html. Não editar à mão.\n'
        'let S = { cards: [] };\nexport const usarEstado = s => { S = s; };\n'
        'const ganchoEscolhido = c => c.ganchos && c.escolhido!=null ? c.ganchos[c.escolhido] : null;\n'
        + 'export ' + trecho('const FLUXO = {', 'const ORDEM =')
        + trecho("const RAIOX_URL =", 'const GANCHOS_EX =')
        + trecho('const arroba = () =>', 'function promptDe(')
        + 'export ' + trecho('function promptDe(', 'function msgZap(')
        + trecho('const limpa = s =>', 'function lerPesquisa(')
        + 'export ' + trecho('function lerPesquisa(', 'function lerGanchos(')
        + 'export { contexto, arroba };\n')
pathlib.Path(__file__).with_name('lib').joinpath('site.js').write_text(site)
