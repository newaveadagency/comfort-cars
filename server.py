#!/usr/bin/env python3
"""Lokalni server za Comfort Cars stranicu i dashboard za oglase.

Pokretanje (iz mape comfort_cars):
    python3 server.py
Zatim otvori:
    http://localhost:8000/            – stranica
    http://localhost:8000/admin.html  – dashboard za oglase

Server sluša samo na 127.0.0.1 (dostupan je samo s ovog računala).

Upiti s oglasa spremaju se u data/upiti.json i vide u dashboardu.
Slanje upita e-mailom (neobavezno) – postavi varijable prije pokretanja:
    SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... UPIT_EMAIL=info@comfortcars.eu python3 server.py
"""
import json
import os
import re
import shutil
import smtplib
import threading
import time
import uuid
from email.message import EmailMessage
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "vozila.js")
UPLOADS = os.path.join(ROOT, "uploads")
BACKUPS = os.path.join(ROOT, "backup")
HOST, PORT = "127.0.0.1", int(os.environ.get("PORT", "8000"))
MAX_UPLOAD = 15 * 1024 * 1024
ALLOWED = {"image/webp": ".webp", "image/jpeg": ".jpg", "image/png": ".png"}
DATA_DIR = os.path.join(ROOT, "data")
UPITI = os.path.join(DATA_DIR, "upiti.json")
FIN = os.path.join(DATA_DIR, "financije.json")      # nabavne/prodajne cijene – PRIVATNO, nikad se ne objavljuje
KAL = os.path.join(DATA_DIR, "kalendar.json")       # vlastiti događaji u kalendaru


def read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path, obj):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
BLOCKED = ("/data/", "/backup/", "/server.py", "/build.py", "/bug_agent.py", "/primijeni-bug.sh", "/objavi.sh", "/.")
_lock = threading.Lock()
_hits = {}

import sys  # noqa: E402
sys.path.insert(0, ROOT)
import build  # noqa: E402  (generira stranice oglasa)
import bug_agent  # noqa: E402  (automatski popravci prijava)


def rebuild():
    try:
        n = build.build_all()
        print(f"  build: {n} stranica oglasa")
    except Exception as ex:  # build ne smije srušiti spremanje
        print("  build greška:", ex)


def read_upiti():
    if not os.path.exists(UPITI):
        return []
    with open(UPITI, encoding="utf-8") as f:
        return json.load(f)


def write_upiti(lst):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = UPITI + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lst, f, ensure_ascii=False, indent=1)
    os.replace(tmp, UPITI)


def send_mail(u):
    host, to = os.environ.get("SMTP_HOST"), os.environ.get("UPIT_EMAIL")
    if not host or not to:
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = f"Novi upit: {u['vrsta']} – {u['vozilo']} (šifra {u['sifra']})"
        msg["From"] = os.environ.get("SMTP_USER") or to
        msg["To"] = to
        if u.get("email"):
            msg["Reply-To"] = u["email"]
        msg.set_content(
            f"Vrsta: {u['vrsta']}\nVozilo: {u['vozilo']} (šifra {u['sifra']})\nIme: {u['ime']}\nTelefon: {u['telefon']}\n"
            f"E-mail: {u.get('email') or '-'}\nTermin: {u.get('termin') or '-'}\n\n{u.get('poruka') or ''}\n"
        )
        with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587")), timeout=15) as smtp:
            smtp.starttls()
            if os.environ.get("SMTP_USER"):
                smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
            smtp.send_message(msg)
    except Exception as ex:
        print("  e-mail nije poslan:", ex)


def clip(v, n):
    return str(v or "").strip()[:n]


def read_list():
    with open(DATA, encoding="utf-8") as f:
        s = f.read()
    m = re.search(r"window\.VOZILA_LIST\s*=\s*(\[.*?\]);\s*\n", s, re.S)
    return json.loads(m.group(1)) if m else []


def write_list(items):
    os.makedirs(BACKUPS, exist_ok=True)
    if os.path.exists(DATA):
        shutil.copy2(DATA, os.path.join(BACKUPS, f"vozila-{datetime.now():%Y%m%d-%H%M%S}.js"))
        # zadrži zadnjih 30 kopija
        old = sorted(os.listdir(BACKUPS))[:-30]
        for name in old:
            os.remove(os.path.join(BACKUPS, name))
    body = (
        f"/* Podaci za Comfort Cars – {len(items)} vozila (uređeno {datetime.now():%d.%m.%Y. %H:%M}) */\n"
        f"window.VOZILA_LIST = {json.dumps(items, ensure_ascii=False)};\n"
        "window.VOZILA = Object.fromEntries(window.VOZILA_LIST.map(v => [v.slug, v]));\n"
    )
    tmp = DATA + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(body)
    os.replace(tmp, DATA)


def valid_item(v):
    return isinstance(v, dict) and isinstance(v.get("slug"), str) and re.fullmatch(r"[A-Za-z0-9%._-]{1,200}", v["slug"])


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        if self.path.split("?")[0].endswith((".js", ".html", ".css")) or self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _same_origin(self):
        origin = self.headers.get("Origin")
        return origin in (None, f"http://{HOST}:{PORT}", f"http://localhost:{PORT}")

    def do_GET(self):
        path = self.path.split("?")[0]
        if any(path.startswith(b) for b in BLOCKED):
            return self.send_error(404)
        if path == "/api/vozila":
            return self._json(200, read_list())
        if path == "/api/upiti":
            return self._json(200, read_upiti())
        if path == "/api/bugovi":
            return self._json(200, {"agent": bug_agent.enabled(), "lista": read_json(bug_agent.BUGS, [])})
        if path == "/api/fin":
            return self._json(200, read_json(FIN, {}))
        if path == "/api/kalendar":
            return self._json(200, read_json(KAL, []))
        return super().do_GET()

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.exists(page):
            with open(page, "rb") as f:
                body = f.read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        return super().send_error(code, message, explain)

    def do_POST(self):
        if not self._same_origin():
            return self._json(403, {"error": "Zabranjeno"})
        length = int(self.headers.get("Content-Length") or 0)
        path = self.path.split("?")[0]

        if path == "/api/vozila":
            if length > 20 * 1024 * 1024:
                return self._json(413, {"error": "Prevelik zahtjev"})
            try:
                items = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan JSON"})
            if not isinstance(items, list) or not all(valid_item(v) for v in items):
                return self._json(400, {"error": "Neispravni podaci"})
            slugs = [v["slug"] for v in items]
            if len(slugs) != len(set(slugs)):
                return self._json(400, {"error": "Dvostruki slug"})
            write_list(items)
            rebuild()
            return self._json(200, {"ok": True, "count": len(items)})

        if path == "/api/upit":
            ip = self.client_address[0]
            now = time.time()
            _hits[ip] = [t for t in _hits.get(ip, []) if now - t < 600] + [now]
            if len(_hits[ip]) > 5:
                return self._json(429, {"error": "Previše upita, pokušajte kasnije"})
            if length > 20000:
                return self._json(413, {"error": "Prevelik zahtjev"})
            try:
                d = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan zahtjev"})
            if d.get("web"):  # zamka za botove
                return self._json(200, {"ok": True})
            u = {"id": uuid.uuid4().hex[:10], "vrijeme": datetime.now().isoformat(timespec="minutes"), "status": "novo",
                 "vrsta": clip(d.get("vrsta"), 30) or "Upit", "ime": clip(d.get("ime"), 80), "telefon": clip(d.get("telefon"), 30),
                 "email": clip(d.get("email"), 120), "termin": clip(d.get("termin"), 30), "poruka": clip(d.get("poruka"), 2000),
                 "sifra": clip(d.get("sifra"), 10), "slug": clip(d.get("slug"), 200), "vozilo": clip(d.get("vozilo"), 120),
                 "cijena": d.get("cijena") if isinstance(d.get("cijena"), (int, float)) else None}
            if not u["ime"] or len(re.sub(r"\D", "", u["telefon"])) < 6 or not d.get("privola"):
                return self._json(400, {"error": "Ime, telefon i privola su obavezni"})
            with _lock:
                lst = read_upiti()
                lst.insert(0, u)
                write_upiti(lst)
            threading.Thread(target=send_mail, args=(u,), daemon=True).start()
            return self._json(200, {"ok": True})

        if path == "/api/bug":
            if length > 20000:
                return self._json(413, {"error": "Prevelik zahtjev"})
            try:
                d = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan zahtjev"})
            opis = clip(d.get("opis"), 4000)
            if len(opis) < 5:
                return self._json(400, {"error": "Opišite problem"})
            slika = clip(d.get("slika"), 200)
            if slika and not re.fullmatch(r"uploads/[\w/.-]+", slika):
                slika = ""
            b = {"id": datetime.now().strftime("%m%d-%H%M") + "-" + uuid.uuid4().hex[:4], "vrijeme": datetime.now().isoformat(timespec="minutes"),
                 "status": "novo" if bug_agent.enabled() else "zaprimljeno", "opis": opis, "stranica": clip(d.get("stranica"), 40),
                 "url": clip(d.get("url"), 300), "hitnost": clip(d.get("hitnost"), 20), "slika": slika, "agent": ""}
            with bug_agent.lock:
                lst = read_json(bug_agent.BUGS, [])
                lst.insert(0, b)
                write_json(bug_agent.BUGS, lst)
            bug_agent.wake()
            return self._json(200, {"ok": True, "id": b["id"], "agent": bug_agent.enabled()})

        if path == "/api/bugovi":
            try:
                d = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan zahtjev"})
            with bug_agent.lock:
                lst = read_json(bug_agent.BUGS, [])
                if d.get("akcija") == "obrisi":
                    lst = [b for b in lst if b["id"] != d.get("id") or b.get("status") == "u obradi"]
                elif d.get("akcija") == "ponovi":
                    for b in lst:
                        if b["id"] == d.get("id") and b.get("status") in ("greška", "bez izmjena", "zaprimljeno", "riješeno"):
                            b["status"] = "novo"; b["agent"] = ""
                write_json(bug_agent.BUGS, lst)
            bug_agent.wake()
            return self._json(200, {"ok": True})

        if path in ("/api/fin", "/api/kalendar"):
            if length > 5 * 1024 * 1024:
                return self._json(413, {"error": "Prevelik zahtjev"})
            try:
                d = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan JSON"})
            if path == "/api/fin" and not isinstance(d, dict):
                return self._json(400, {"error": "Očekivan objekt"})
            if path == "/api/kalendar" and not isinstance(d, list):
                return self._json(400, {"error": "Očekivan popis"})
            with _lock:
                write_json(FIN if path == "/api/fin" else KAL, d)
            return self._json(200, {"ok": True})

        if path == "/api/upiti":
            try:
                d = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                return self._json(400, {"error": "Neispravan zahtjev"})
            with _lock:
                lst = read_upiti()
                if d.get("akcija") == "obrisi":
                    lst = [u for u in lst if u["id"] != d.get("id")]
                else:
                    for u in lst:
                        if u["id"] == d.get("id") and d.get("status") in ("novo", "u obradi", "zatvoreno"):
                            u["status"] = d["status"]
                write_upiti(lst)
            return self._json(200, {"ok": True})

        if path == "/api/upload":
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip()
            if ctype not in ALLOWED:
                return self._json(415, {"error": "Dozvoljeni su samo WEBP, JPG i PNG"})
            if not 0 < length <= MAX_UPLOAD:
                return self._json(413, {"error": "Slika je prevelika (max 15 MB)"})
            sub = datetime.now().strftime("%Y/%m")
            folder = os.path.join(UPLOADS, sub)
            os.makedirs(folder, exist_ok=True)
            name = f"{int(time.time())}-{uuid.uuid4().hex[:8]}{ALLOWED[ctype]}"
            with open(os.path.join(folder, name), "wb") as f:
                f.write(self.rfile.read(length))
            return self._json(200, {"url": f"uploads/{sub}/{name}"})

        return self._json(404, {"error": "Nepoznata ruta"})


if __name__ == "__main__":
    os.chdir(ROOT)
    rebuild()
    print("  bug agent:", "UKLJUČEN (Claude Code obrađuje prijave)" if bug_agent.start() else "isključen (pokreni s BUG_AGENT=1)")
    print(f"Comfort Cars: http://localhost:{PORT}/   ·   Dashboard: http://localhost:{PORT}/admin.html")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
