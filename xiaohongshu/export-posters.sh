#!/usr/bin/env bash
# 用 Chrome 无头模式从 promo-images.html 导出 PNG
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HTML="file://${ROOT}/promo-images.html"

declare -a POSTERS=(
  "poster-1:01-cover.png"
  "poster-2:02-stats.png"
  "poster-3:03-how-to-play.png"
  "poster-4:04-identities.png"
  "poster-6:05-why-it-matters.png"
  "poster-5:06-share-cta.png"
)

mkdir -p "${ROOT}/exports"

for entry in "${POSTERS[@]}"; do
  id="${entry%%:*}"
  file="${entry##*:}"
  echo "Exporting ${file} …"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size=1080,1440 \
    --screenshot="${ROOT}/exports/${file}" \
    "${HTML}?export=${id}"
done

echo "Done. Files in ${ROOT}/exports/"
