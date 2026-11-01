# Gera rupturaagency-site/index.html a partir do index.html do artifact (que não tem doctype/head/body).
import pathlib, sys
src = pathlib.Path(sys.argv[1]).read_text()
i = src.index('<canvas id="cena"')
pagina = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
          '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
          + src[:i].rstrip('\n') + '\n</head>\n<body>\n' + src[i:].rstrip('\n') + '\n</body>\n</html>\n')
pathlib.Path(sys.argv[2]).write_text(pagina)
