#!/bin/bash
# Objava lokalnih izmjena (npr. oglasi uređeni preko server.py ili izmjene koda).
# Šalje promjene na GitHub (grana main) → GitHub Actions automatski gradi i objavljuje stranicu (~1 min).
# Izmjene napravljene u uređivaču (uredi.html) objavljuju se same, ovo za njih nije potrebno.
#
# Pokretanje iz mape "web stranice/comfort cars":   ./objavi.sh "opis izmjene"
# Probna/javna objava se bira na GitHubu: Settings → Variables → PREVIEW (1 = probna, 0 = javna)
set -euo pipefail
cd "$(dirname "$0")"
MSG="${1:-Izmjene $(date '+%d.%m.%Y. %H:%M')}"

echo "→ Preuzimam izmjene iz uređivača…"
git pull --rebase --autostash -q origin main

git add -A
if git diff --cached --quiet; then
  echo "Nema lokalnih izmjena."
else
  git commit -q -m "$MSG"
fi

echo "→ Šaljem na GitHub…"
git push -q origin main
echo "✓ Poslano. Stranica se objavljuje za otprilike minutu (Actions → Objava)."
