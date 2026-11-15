#!/bin/bash
# Objava stranice na GitHub Pages (grana gh-pages).
# Pokretanje iz mape comfort_cars:   ./objavi.sh
# Za pravu objavu (indeksiranje na Googleu):   PREVIEW=0 ./objavi.sh
set -euo pipefail
cd "$(dirname "$0")"

PREVIEW="${PREVIEW:-1}"
REMOTE="$(git remote get-url origin)"

echo "→ Generiram stranice (PREVIEW=$PREVIEW)…"
PREVIEW="$PREVIEW" python3 build.py

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# samo javne datoteke – bez dashboarda, servera, upita i sigurnosnih kopija
for f in index.html ponuda.html vozilo.html 404.html style.css cards.js vozila.js vozila-lista.js sitemap.xml robots.txt vozilo uploads; do
  [ -e "$f" ] && cp -R "$f" "$TMP/"
done
touch "$TMP/.nojekyll"

if [ "$PREVIEW" = "1" ]; then
  for f in index.html ponuda.html vozilo.html; do
    sed -i '' 's#<meta charset="utf-8">#<meta charset="utf-8">\n<meta name="robots" content="noindex">#' "$TMP/$f"
  done
fi

echo "→ Šaljem na GitHub (gh-pages)…"
(
  cd "$TMP"
  git init -q
  git checkout -q -b gh-pages
  git add -A
  git -c user.name="Comfort Cars" -c user.email="noreply@github.com" commit -q -m "Objava $(date '+%d.%m.%Y. %H:%M')"
  git push -q -f "$REMOTE" gh-pages
)

# lokalno vrati normalne stranice (bez noindex)
python3 build.py >/dev/null
echo "✓ Objavljeno. Promjene su vidljive za 1–2 minute."
