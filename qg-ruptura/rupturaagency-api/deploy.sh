#!/bin/sh
# Gera o site a partir do agencia-3d/index.html e publica com as Functions (pautas no Netlify Blobs).
# Uso: sh rupturaagency-api/deploy.sh            → prévia em https://nuvem--rupturaagency.netlify.app
#      sh rupturaagency-api/deploy.sh --prod     → produção
cd "$(dirname "$0")/.." || exit 1
mkdir -p rupturaagency-site
python3 rupturaagency-api/gerar_skills.py || exit 1
python3 agencia-3d/wrap_site.py agencia-3d/index.html rupturaagency-site/index.html || exit 1
if [ "$1" = "--prod" ]; then ALVO="--prod"; else ALVO="--alias nuvem"; fi
netlify deploy $ALVO --dir rupturaagency-site --functions rupturaagency-api/netlify/functions --site b305953e-a9ff-43c0-9279-852d268b6c34
