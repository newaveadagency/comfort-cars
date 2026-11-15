#!/usr/bin/env python3
"""Generira statičke stranice oglasa i SEO datoteke iz vozila.js.

Stvara:
  vozilo/<slug>/index.html  – stranica svakog oglasa (sadržaj u HTML-u, meta, Open Graph, JSON-LD)
  vozila-lista.js           – lagani popis vozila za naslovnicu i ponudu
  sitemap.xml, robots.txt

Pokreće se automatski iz server.py (pri pokretanju i nakon svakog spremanja),
a može i ručno:  python3 build.py
"""
import html
import json
import os
import re
import shutil
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.abspath(__file__))
BASE_URL = os.environ.get("BASE_URL", "https://comfortcars.hr").rstrip("/")
OUT_DIR = os.path.join(ROOT, "vozilo")
# PREVIEW=1 → stranica se ne indeksira (probna objava, npr. GitHub Pages)
PREVIEW = os.environ.get("PREVIEW") == "1"
REL = "../../"  # stranice oglasa su na vozilo/<slug>/

DEALER = {
    "@type": "AutoDealer",
    "@id": BASE_URL + "/#dealer",
    "name": "Comfort Cars",
    "legalName": "SEA MOOD d.o.o.",
    "url": BASE_URL + "/",
    "logo": "https://comfort-cars.b-cdn.net/wp-content/uploads/2026/06/logo.svg",
    "telephone": "+385911100031",
    "email": "info@comfortcars.eu",
    "address": {"@type": "PostalAddress", "streetAddress": "Put Krtina", "postalCode": "21212",
                "addressLocality": "Kaštel Sućurac", "addressCountry": "HR"},
    "openingHoursSpecification": [
        {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
         "opens": "09:00", "closes": "18:00"},
        {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday", "opens": "09:00", "closes": "14:00"},
    ],
    "sameAs": ["https://www.instagram.com/comfortcarscroatia/", "https://www.facebook.com/comfortcarsSplit"],
}
AVAIL = {"": "InStock", "akcija": "InStock", "dolazak": "PreOrder", "rezervacija": "LimitedAvailability",
         "prodano": "SoldOut"}
LBL = {"rezervacija": "Rezervacija", "dolazak": "U dolasku", "prodano": "Prodano", "akcija": "Akcija"}
LIGHT_KEYS = ["slug", "title", "brand", "name", "variant", "price", "sifra", "km", "motor", "godina", "snaga",
              "mjenjac", "vlasnik", "status", "karoserija"]


def e(s):
    return html.escape(str(s or ""), quote=True)


def num(s):
    d = re.sub(r"\D", "", str(s or ""))
    return int(d) if d else 0


def fmt(n):
    return f"{n:,}".replace(",", ".")


def clean_title(t):
    return re.sub(r"^(REZERVIRANO|U DOLASKU)\s*‼️\s*", "", t or "", flags=re.I).strip()


def abs_img(u):
    if not u:
        return ""
    return u if u.startswith("http") else BASE_URL + "/" + u.lstrip("/")


def load():
    with open(os.path.join(ROOT, "vozila.js"), encoding="utf-8") as f:
        s = f.read()
    return json.loads(re.search(r"window\.VOZILA_LIST\s*=\s*(\[.*?\]);\s*\n", s, re.S).group(1))


def page_url(slug):
    return f"{BASE_URL}/vozilo/{slug}/"


def jsonld(c, title, price, sold):
    imgs = [abs_img(i.get("full") or i.get("mid")) for i in c.get("images", [])[:10]]
    car = {
        "@type": "Car",
        "@id": page_url(c["slug"]) + "#vozilo",
        "name": title,
        "brand": {"@type": "Brand", "name": c.get("brand", "")},
        "model": (c.get("name", "")[len(c.get("brand", "")):]).strip(),
        "vehicleModelDate": c.get("godina", ""),
        "mileageFromOdometer": {"@type": "QuantitativeValue", "value": num(c.get("km")), "unitCode": "KMT"},
        "fuelType": c.get("motor", ""),
        "vehicleTransmission": c.get("mjenjac", ""),
        "bodyType": c.get("karoserija", ""),
        "sku": c.get("sifra", ""),
        "image": imgs,
        "url": page_url(c["slug"]),
        "description": " ".join(c.get("opis", [])[:3])[:600] or title,
    }
    if num(c.get("snaga")):
        car["vehicleEngine"] = {"@type": "EngineSpecification",
                                "enginePower": {"@type": "QuantitativeValue", "value": num(c.get("snaga")), "unitCode": "KWT"}}
    offer = {"@type": "Offer", "priceCurrency": "EUR", "availability": "https://schema.org/" + AVAIL.get(c.get("status", ""), "InStock"),
             "url": page_url(c["slug"]), "seller": {"@id": DEALER["@id"]}, "itemCondition": "https://schema.org/UsedCondition"}
    if price and not sold:
        offer["price"] = price
    car["offers"] = offer
    crumbs = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Naslovnica", "item": BASE_URL + "/"},
        {"@type": "ListItem", "position": 2, "name": "Ponuda vozila", "item": BASE_URL + "/ponuda.html"},
        {"@type": "ListItem", "position": 3, "name": title, "item": page_url(c["slug"])}]}
    return json.dumps({"@context": "https://schema.org", "@graph": [car, crumbs, DEALER]}, ensure_ascii=False).replace("</", "<\\/")


def static_body(c, title, price, sold):
    """Sadržaj vidljiv tražilicama (JavaScript ga zamijeni bogatijim prikazom)."""
    imgs = c.get("images", [])
    first = imgs[0]["mid"] if imgs else ""
    specs = [("Kilometraža", fmt(num(c.get("km"))) + " km" if c.get("km") else ""), ("Godina proizvodnje", c.get("godina")),
             ("Snaga motora", c.get("snaga")), ("Motor", c.get("motor")), ("Vrsta mjenjača", c.get("mjenjac")),
             ("Vlasnik", c.get("vlasnik")), ("Karoserija", c.get("karoserija")), ("Šifra", c.get("sifra"))]
    out = [f'<div class="wrap seo-static" style="padding:40px var(--gut,16px)">',
           f'<nav><a href="{REL}index.html">Naslovnica</a> / <a href="{REL}ponuda.html">Ponuda vozila</a> / {e(title)}</nav>',
           f'<h1>{e(c.get("name"))} {e(c.get("variant"))}</h1><p>{e(title)}</p>',
           f'<p><strong>Cijena: {"Prodano" if sold or not price else fmt(int(price)) + " €"}</strong>'
           + (f' · {e(LBL.get(c.get("status"), ""))}' if c.get("status") else "") + "</p>"]
    if first:
        out.append(f'<img src="{e(first)}" alt="{e(title)}" width="1024" height="768" style="max-width:100%;height:auto">')
    out.append("<ul>" + "".join(f"<li>{k}: {e(v)}</li>" for k, v in specs if v) + "</ul>")
    if c.get("jamstvo"):
        out.append(f"<p>{e(c['jamstvo'])}</p>")
    if c.get("oprema"):
        out.append("<h2>Oprema</h2><ul>" + "".join(f"<li>{e(o)}</li>" for o in c["oprema"]) + "</ul>")
    if c.get("opis"):
        out.append("<h2>Opis vozila</h2>" + "".join(f"<p>{e(p)}</p>" for p in c["opis"]))
    out.append('<p>Telefon: <a href="tel:+385916197606">091 619 7606</a>, <a href="tel:+385989541584">098 954 1584</a>, '
               '<a href="tel:+385911100031">091 110 0031</a></p></div>')
    return "\n".join(out)


def build_pages(items, template):
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR)
    # putanje u predlošku postaju apsolutne (stranica je na /vozilo/<slug>/)
    tpl = re.sub(r'(href|src)="(style\.css|cards\.js|index\.html[^"]*|ponuda\.html[^"]*)"', r'\1="' + REL + r'\2"', template)
    for c in items:
        title = clean_title(c.get("title"))
        price = int(c["price"]) if str(c.get("price") or "").isdigit() else None
        sold = c.get("status") == "prodano" or not price
        km = fmt(num(c.get("km"))) + " km" if c.get("km") else ""
        head_title = f'{c.get("name","")} {c.get("variant","")} {c.get("godina","")}'.strip()
        head_title += f', {km} – {"Prodano" if sold else fmt(price) + " €"} | Comfort Cars Split'
        desc = f'{title}. {c.get("godina","")}., {km}, {c.get("motor","")}, {c.get("snaga","")}, {c.get("mjenjac","")}. ' \
               f'{"Prodano." if sold else "Cijena " + fmt(price) + " €."} {c.get("jamstvo") or ""} Comfort Cars, Kaštel Sućurac / Split.'
        img = abs_img(c["images"][0].get("full") or c["images"][0].get("mid")) if c.get("images") else ""
        meta = "\n".join([
            f'<title>{e(head_title)}</title>',
            '<meta name="robots" content="noindex">' if PREVIEW else '',
            f'<meta name="description" content="{e(desc[:300])}">',
            f'<link rel="canonical" href="{e(page_url(c["slug"]))}">',
            '<meta property="og:type" content="product">',
            '<meta property="og:site_name" content="Comfort Cars">',
            '<meta property="og:locale" content="hr_HR">',
            f'<meta property="og:title" content="{e(head_title)}">',
            f'<meta property="og:description" content="{e(desc[:200])}">',
            f'<meta property="og:url" content="{e(page_url(c["slug"]))}">',
            f'<meta property="og:image" content="{e(img)}">' if img else "",
            '<meta name="twitter:card" content="summary_large_image">',
            f'<link rel="preload" as="image" href="{e(c["images"][0]["mid"])}" fetchpriority="high">' if c.get("images") else "",
            f'<script type="application/ld+json">{jsonld(c, title, price, sold)}</script>',
        ])
        page = re.sub(r"<title>.*?</title>\s*<meta name=\"description\"[^>]*>", lambda m: meta, tpl, count=1, flags=re.S)
        data = json.dumps(c, ensure_ascii=False).replace("</", "<\\/")
        page = page.replace('<script src="vozila.js"></script>',
                            f'<script>window.CC_ROOT="{REL}";window.CC_SLUG={json.dumps(c["slug"])};window.CC_CAR={data};</script>\n'
                            f'<script src="{REL}vozila-lista.js"></script>')
        page = page.replace('<main id="app"></main>', f'<main id="app">\n{static_body(c, title, price, sold)}\n</main>')
        folder = os.path.join(OUT_DIR, unquote(c["slug"]))
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "index.html"), "w", encoding="utf-8") as f:
            f.write(page)


CACHE = os.path.join(ROOT, "data", "slike-velicine.json")


def _exists(url):
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        return urllib.request.urlopen(req, timeout=8).status == 200
    except Exception:
        return False


def responsive(urls):
    """Za WordPress slike (…-1024xH.webp) pronađi postojeće manje verzije (300 i 768 px). Rezultat se pamti."""
    try:
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)
    except Exception:
        cache = {}

    def find(u):
        m = re.search(r"-1024x(\d+)\.webp$", u or "")
        if not m:
            return u, {}
        h = int(m.group(1))
        out = {}
        for w in (300, 768):
            exact = h * w / 1024
            for cand in sorted({int(exact), int(exact) + 1, round(exact)}, key=lambda x: abs(x - exact)):
                url = u[: m.start()] + f"-{w}x{cand}.webp"
                if _exists(url):
                    out[str(w)] = url
                    break
        return u, out

    todo = [u for u in urls if u and u not in cache]
    if todo:
        with ThreadPoolExecutor(max_workers=12) as ex:
            for u, out in ex.map(find, todo):
                cache[u] = out
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False)
    return cache


def build_light(items):
    light = []
    sizes = responsive([c["images"][0]["mid"] for c in items if c.get("images")])
    for c in items:
        v = {k: c.get(k) for k in LIGHT_KEYS}
        v["images"] = [dict(i) for i in c.get("images", [])[:1]]
        if v["images"]:
            for w, url in sizes.get(v["images"][0]["mid"], {}).items():
                v["images"][0]["s" + w] = url
        v["brojSlika"] = len(c.get("images", []))
        light.append(v)
    with open(os.path.join(ROOT, "vozila-lista.js"), "w", encoding="utf-8") as f:
        f.write(f"/* Lagani popis vozila (generira build.py) */\nwindow.VOZILA_LIST = {json.dumps(light, ensure_ascii=False)};\n"
                "window.VOZILA = window.VOZILA || Object.fromEntries(window.VOZILA_LIST.map(v => [v.slug, v]));\n")


def build_seo(items):
    today = date.today().isoformat()
    urls = [(BASE_URL + "/", "daily"), (BASE_URL + "/ponuda.html", "daily")] + [(page_url(c["slug"]), "weekly") for c in items]
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"  <url><loc>{html.escape(u)}</loc><lastmod>{today}</lastmod><changefreq>{f}</changefreq></url>" for u, f in urls]
    xml.append("</urlset>")
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(xml) + "\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as f:
        if PREVIEW:
            f.write("User-agent: *\nDisallow: /\n")
            return
        f.write("User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nDisallow: /backup/\n"
                "Disallow: /upiti.json\nDisallow: /ponuda.html?*\n\n"
                f"Sitemap: {BASE_URL}/sitemap.xml\n")


def build_all():
    items = load()
    with open(os.path.join(ROOT, "vozilo.html"), encoding="utf-8") as f:
        template = f.read()
    build_light(items)
    build_pages(items, template)
    build_seo(items)
    return len(items)


if __name__ == "__main__":
    print(f"Generirano {build_all()} stranica oglasa u /vozilo/, vozila-lista.js, sitemap.xml, robots.txt")
