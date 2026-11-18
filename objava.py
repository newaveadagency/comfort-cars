#!/usr/bin/env python3
"""Objava Comfort Cars stranice: generira oglase i skuplja javne datoteke u _site/.

Pokreće se automatski u GitHub Actions nakon svake promjene na grani main
(.github/workflows/objava.yml). Lokalno za provjeru:  python3 objava.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

import build  # noqa: E402
import objava_cms  # noqa: E402

build.PREVIEW = os.environ.get("PREVIEW", "1") == "1"
print(f"build: {build.build_all()} stranica oglasa")

objava_cms.collect(ROOT, [
    "index.html", "ponuda.html", "vozilo.html", "admin.html", "admin-fin.js", "404.html",
    "style.css", "cards.js", "vozila.js", "vozila-lista.js", "sitemap.xml", "robots.txt",
    "vozilo", "uploads", "fonts", "uredi.html", "cms",
], demo_pages=("index.html", "ponuda.html"),
   demo_buttons=(("admin.html", "Dashboard (demo)"), ("uredi.html?demo", "Uredi stranicu (demo)")))
