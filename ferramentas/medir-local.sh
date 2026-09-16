#!/bin/bash
# Mede com Lighthouse local as paginas de ferramentas/urls-para-medir.txt
# e envia o resultado para o painel, marcado como origem "local".
#
# Sequencial de proposito: o throttling do Lighthouse e simulado, entao
# rodar em paralelo disputa CPU e distorce a nota.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LISTA="$RAIZ/ferramentas/urls-para-medir.txt"
TRAB="$RAIZ/.medicoes"
API="${API:-https://adsmaquinadevendas.netlify.app/api/estado}"
export CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

[ -s "$LISTA" ] || { echo "rode antes: python3 ferramentas/listar-urls.py"; exit 1; }
mkdir -p "$TRAB"

LH="$RAIZ/node_modules/.bin/lighthouse"
[ -x "$LH" ] || { echo "instalando lighthouse..."; (cd "$RAIZ" && npm install lighthouse --no-save --silent); }

while IFS=$'\t' read -r ID URL CIDADE VERSAO; do
  [ -z "${ID:-}" ] && continue
  for FF in mobile desktop; do
    ARQ="$TRAB/${ID}__${FF}.json"
    [ -s "$ARQ" ] && { echo "$ID $FF · ja medido"; continue; }
    if [ "$FF" = "mobile" ]; then EMU="--screenEmulation.mobile"; else EMU="--preset=desktop"; fi
    "$LH" "$URL" --only-categories=performance --form-factor="$FF" $EMU \
      --throttling-method=simulate --quiet \
      --chrome-flags="--headless=new --no-sandbox" \
      --output=json --output-path="$ARQ" >/dev/null 2>&1
    [ -s "$ARQ" ] && echo "$ID $FF · ok" || echo "$ID $FF · FALHOU"
  done
done < "$LISTA"

echo "--- enviando para o painel ---"
API="$API" python3 "$RAIZ/ferramentas/enviar-medicoes.py"
