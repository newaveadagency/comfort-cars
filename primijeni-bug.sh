#!/bin/bash
# Pregled i primjena popravka koji je napravio Claude Code za prijavu iz dashboarda.
#   ./primijeni-bug.sh                 – popis grana s popravcima
#   ./primijeni-bug.sh <id>            – prikaži izmjene
#   ./primijeni-bug.sh <id> --primijeni   – spoji u main i objavi stranicu
set -euo pipefail
cd "$(dirname "$0")"
if [ $# -eq 0 ]; then git branch --list 'bug/*'; exit 0; fi
B="bug/$1"
git rev-parse --verify -q "$B" >/dev/null || { echo "Nema grane $B"; exit 1; }
if [ "${2:-}" != "--primijeni" ]; then
  git log -1 --format='%B' "$B"; echo; git diff --stat main..."$B"; echo; git diff main..."$B"
  echo; echo "Za primjenu i objavu:  ./primijeni-bug.sh $1 --primijeni"; exit 0
fi
git merge --no-edit "$B"
python3 build.py >/dev/null
./objavi.sh
git push -q || true
git branch -d "$B"
echo "✓ Popravak $1 primijenjen i objavljen."
