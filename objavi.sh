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
for f in index.html ponuda.html vozilo.html admin.html admin-fin.js 404.html style.css cards.js vozila.js vozila-lista.js sitemap.xml robots.txt vozilo uploads fonts; do
  [ -e "$f" ] && cp -R "$f" "$TMP/"
done
touch "$TMP/.nojekyll"

if [ "$PREVIEW" = "1" ]; then
  for f in index.html ponuda.html vozilo.html; do
    sed -i '' 's#<meta charset="utf-8">#<meta charset="utf-8">\n<meta name="robots" content="noindex">#' "$TMP/$f"
  done
  # gumb za demo admin panel (samo u probnoj objavi)
  BTN='<a href="admin.html" class="demo-admin" style="position:fixed;left:16px;bottom:16px;z-index:90;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;background:#121314;color:#fff;font:600 14px Onest,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.15)"><span style="width:8px;height:8px;border-radius:50%;background:#ff4713"></span>Admin panel (demo)</a>'
  for f in index.html ponuda.html; do
    python3 - "$TMP/$f" "$BTN" <<'PY'
import sys
p, btn = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(s.replace("</body>", btn + "\n</body>", 1))
PY
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
