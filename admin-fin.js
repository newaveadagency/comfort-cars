/* Comfort Cars dashboard – financije, kalendar, analitika.
   Podaci su PRIVATNI: lokalno se spremaju u data/financije.json i data/kalendar.json (nikad u vozila.js).
   U demo načinu (objavljena stranica) koriste se izmišljene brojke, samo u pregledniku. */
let finData = {}, kalData = [];
const FIN_KEYS = ["nabavna", "prijevoz", "priprema", "registracija", "ostalo", "prodajna"];
const PLACANJE = ["Gotovina", "Leasing", "Kredit", "Kartica", "Zamjena + nadoplata"];
const EV = {   /* vrsta događaja → boja (validirana paleta) + naziv */
  probna: { c: "#2a78d6", l: "Probna vožnja" },
  prodaja: { c: "#eb6834", l: "Prodaja" },
  nabava: { c: "#1baf7a", l: "Nabava" },
  dolazak: { c: "#eda100", l: "Dolazak vozila" },
  vlastito: { c: "#e87ba4", l: "Događaj" },
};
const MJ = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"];
const MJK = ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"];

/* ---------- pomoćno ---------- */
const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const parseD = s => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const n0 = v => (v === "" || v == null || isNaN(+v)) ? 0 : +v;
const eur = (v, d = 0) => fmt(Math.round(v * (d ? 100 : 1)) / (d ? 100 : 1), d) + " €";
const fmtD = s => { const d = parseD(s); return d ? d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric", year: "numeric" }) : "—"; };
const carBy = slug => items.find(v => v.slug === slug);
const carName = v => v ? `${v.name} ${v.variant || ""}`.trim() : "Obrisano vozilo";

function finOf(slug) { return finData[slug] || {}; }
function calc(slug) {
  const f = finOf(slug), v = carBy(slug) || {};
  const tro = n0(f.prijevoz) + n0(f.priprema) + n0(f.registracija) + n0(f.ostalo);
  const ulaganje = n0(f.nabavna) + tro;
  const sold = v.status === "prodano" || !!f.datumProdaje;
  const prodajna = sold ? n0(f.prodajna) : n0(v.price);
  const zarada = prodajna && n0(f.nabavna) ? prodajna - ulaganje : null;
  const marza = zarada != null && prodajna ? zarada / prodajna * 100 : null;
  const dana = f.datumNabave ? daysBetween(f.datumNabave, sold && f.datumProdaje ? f.datumProdaje : today()) : null;
  return { f, v, tro, ulaganje, sold, prodajna, zarada, marza, dana, ima: !!n0(f.nabavna) };
}

async function finSave(msg) {
  if (demo) { demoStore(); toast((msg || "Spremljeno") + " (demo)"); return true; }
  if (!online) { toast("Server nije pokrenut – financije nisu spremljene.", true); return false; }
  try { const r = await fetch("/api/fin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finData) }); if (!r.ok) throw 0; toast(msg || "Spremljeno"); return true; }
  catch (e) { toast("Spremanje financija nije uspjelo", true); return false; }
}
async function kalSave(msg) {
  if (demo) { demoStore(); toast((msg || "Spremljeno") + " (demo)"); return true; }
  if (!online) { toast("Server nije pokrenut.", true); return false; }
  try { const r = await fetch("/api/kalendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kalData) }); if (!r.ok) throw 0; toast(msg || "Spremljeno"); return true; }
  catch (e) { toast("Spremanje nije uspjelo", true); return false; }
}

/* ---------- demo podaci (izmišljeni, ponovljivi) ---------- */
function demoFin() {
  let seed = 20261115; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const r = (a, b) => a + (b - a) * rnd(), r10 = (a, b) => Math.round(r(a, b) / 10) * 10;
  const t0 = new Date(); const ago = d => iso(new Date(t0.getTime() - d * 864e5));
  const out = {};
  const sold = items.filter(v => v.status === "prodano");
  sold.forEach((v, i) => {
    const p = v.price ? +v.price : r10(15000, 36000);
    const prodanoPrije = Math.round((i / Math.max(1, sold.length - 1)) * 260 + r(0, 12));
    const naZalihi = Math.round(r(9, 70));
    out[v.slug] = { nabavna: r10(p * .8, p * .87), prijevoz: r10(380, 950), priprema: r10(150, 850), registracija: r10(90, 420), ostalo: r10(0, 260),
      datumNabave: ago(prodanoPrije + naZalihi), datumProdaje: ago(prodanoPrije), prodajna: r10(p * .96, p), placanje: PLACANJE[Math.floor(r(0, 3.99))] };
  });
  items.filter(v => v.status !== "prodano").forEach(v => {
    const p = v.price ? +v.price : 20000;
    const f = { nabavna: r10(p * .8, p * .87), prijevoz: r10(380, 950), priprema: r10(150, 850), registracija: r10(90, 420), ostalo: r10(0, 200) };
    if (v.status === "dolazak") { f.datumNabave = ago(Math.round(r(1, 8))); f.dolazak = iso(new Date(t0.getTime() + Math.round(r(3, 24)) * 864e5)); }
    else f.datumNabave = ago(Math.round(r(4, 110)));
    out[v.slug] = f;
  });
  return out;
}
function demoKal() {
  const t0 = new Date(), at = (d, h) => { const x = new Date(t0.getTime() + d * 864e5); return iso(x) + (h ? "T" + h : ""); };
  const a = items.filter(v => v.price && v.status !== "prodano");
  return [
    { id: "dk1", datum: at(1, "10:00"), vrsta: "vlastito", naslov: "Tehnički pregled (primjer)", slug: a[3]?.slug || "" },
    { id: "dk2", datum: at(2, "15:30"), vrsta: "vlastito", naslov: "Preuzimanje vozila – kupac (primjer)", slug: a[5]?.slug || "" },
    { id: "dk3", datum: at(4, "09:00"), vrsta: "vlastito", naslov: "Fotografiranje novih vozila (primjer)", slug: "" },
    { id: "dk4", datum: at(-3, "11:00"), vrsta: "vlastito", naslov: "Sastanak s leasing kućom (primjer)", slug: "" },
    { id: "dk5", datum: at(9, "13:00"), vrsta: "vlastito", naslov: "Servis prije prodaje (primjer)", slug: a[7]?.slug || "" },
  ];
}

/* ---------- financijski blok u uređivaču oglasa ---------- */
let finDraft = null;
function finPanel(slug) {
  finDraft = { ...finOf(slug) };
  const f = finDraft, inp = (k, l, suf = "€") => `<div class="f"><label>${l}</label><div class="suf"><input type="number" min="0" step="10" data-fin="${k}" value="${f[k] ?? ""}"><span>${suf}</span></div></div>`;
  const dat = (k, l) => `<div class="f"><label>${l}</label><input type="date" data-fin="${k}" value="${f[k] || ""}"></div>`;
  return `<div class="panel finp"><h2>Financije <small class="lock">🔒 interno – ne prikazuje se na stranici</small></h2>
    <div class="fg">
      ${inp("nabavna", "Nabavna cijena")}${dat("datumNabave", "Datum nabave")}${dat("dolazak", "Očekivani dolazak")}
      ${inp("prijevoz", "Prijevoz / uvoz")}${inp("priprema", "Servis i priprema")}${inp("registracija", "Registracija i papiri")}
      ${inp("ostalo", "Ostali troškovi")}
      <div class="f w2"><label>Napomena</label><input data-fin="napomena" value="${esc(f.napomena || "")}" placeholder="npr. zamijenjene gume, dobavljač…"></div>
    </div>
    <div class="finsold"><h3>Prodaja</h3><div class="fg">
      ${inp("prodajna", "Ostvarena prodajna cijena")}${dat("datumProdaje", "Datum prodaje")}
      <div class="f"><label>Način plaćanja</label><select data-fin="placanje"><option value="">—</option>${PLACANJE.map(p => `<option ${p === f.placanje ? "selected" : ""}>${p}</option>`).join("")}</select></div>
    </div><div class="hint">Popuni kad je vozilo prodano. Status oglasa se tada može prebaciti na „Prodano”.</div></div>
    <div class="finsum" id="finSum"></div>
  </div>`;
}
function finPanelBind(getPrice, getStatus) {
  const box = document.querySelector(".finp"); if (!box) return;
  const sum = () => {
    const f = finDraft, tro = n0(f.prijevoz) + n0(f.priprema) + n0(f.registracija) + n0(f.ostalo), ul = n0(f.nabavna) + tro;
    const sold = getStatus() === "prodano" || !!f.datumProdaje, pc = sold ? n0(f.prodajna) : n0(getPrice());
    const z = pc && n0(f.nabavna) ? pc - ul : null, m = z != null && pc ? z / pc * 100 : null;
    const dana = f.datumNabave ? daysBetween(f.datumNabave, sold && f.datumProdaje ? f.datumProdaje : today()) : null;
    $("#finSum").innerHTML = `
      <div><small>Ukupno uloženo</small><b>${ul ? eur(ul) : "—"}</b></div>
      <div><small>${sold ? "Ostvarena" : "Očekivana"} zarada</small><b class="${z < 0 ? "neg" : ""}">${z != null ? eur(z) : "—"}</b></div>
      <div><small>Marža</small><b>${m != null ? fmt(m, 1) + " %" : "—"}</b></div>
      <div><small>${sold ? "Dana do prodaje" : "Dana na zalihi"}</small><b>${dana != null ? dana : "—"}</b></div>`;
  };
  box.addEventListener("input", e => { const k = e.target.dataset.fin; if (!k) return; finDraft[k] = e.target.type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; sum(); });
  box.addEventListener("change", e => { const k = e.target.dataset.fin; if (k) { finDraft[k] = e.target.value; sum(); } });
  document.addEventListener("input", e => { if (e.target.id === "fPrice") sum(); });
  sum();
}
async function finPanelCommit(slug) {
  if (!finDraft) return;
  const clean = {}; Object.entries(finDraft).forEach(([k, v]) => { if (v !== "" && v != null) clean[k] = v; });
  if (Object.keys(clean).length) finData[slug] = clean; else delete finData[slug];
  await finSave("Financije spremljene");
}

/* ---------- prozor kod prebacivanja u „Prodano” ---------- */
function soldModal(v) {
  return new Promise(res => {
    const f = finOf(v.slug);
    const m = document.createElement("div"); m.className = "modal open";
    m.innerHTML = `<div class="box" style="max-width:480px"><h3>Vozilo prodano 🎉</h3><p>${esc(carName(v))} · šifra ${esc(v.sifra)}</p>
      <div class="fg" style="grid-template-columns:1fr 1fr">
        <div class="f"><label>Ostvarena cijena</label><div class="suf"><input type="number" id="smP" value="${f.prodajna || v.price || ""}"><span>€</span></div></div>
        <div class="f"><label>Datum prodaje</label><input type="date" id="smD" value="${f.datumProdaje || today()}"></div>
        <div class="f"><label>Nabavna cijena</label><div class="suf"><input type="number" id="smN" value="${f.nabavna || ""}"><span>€</span></div></div>
        <div class="f"><label>Način plaćanja</label><select id="smPl"><option value="">—</option>${PLACANJE.map(p => `<option ${p === f.placanje ? "selected" : ""}>${p}</option>`).join("")}</select></div>
      </div>
      <div class="row" style="margin-top:20px"><button class="btn btn-ghost" id="smNo">Preskoči</button><button class="btn btn-brand" id="smYes">Spremi prodaju</button></div></div>`;
    document.body.appendChild(m);
    const close = ok => { m.remove(); res(ok); };
    m.querySelector("#smNo").onclick = () => close(false);
    m.querySelector("#smYes").onclick = async () => {
      const g = id => m.querySelector(id).value;
      finData[v.slug] = { ...f, prodajna: g("#smP") ? +g("#smP") : "", datumProdaje: g("#smD"), placanje: g("#smPl") };
      if (g("#smN")) finData[v.slug].nabavna = +g("#smN");
      await finSave("Prodaja zabilježena"); close(true);
    };
  });
}

/* ---------- KALENDAR ---------- */
let kalMonth = null, kalSel = null;
function allEvents() {
  const ev = [];
  Object.entries(finData).forEach(([slug, f]) => {
    const v = carBy(slug); if (!v) return;
    if (f.datumProdaje) ev.push({ datum: f.datumProdaje, vrsta: "prodaja", naslov: carName(v), sub: f.prodajna ? eur(f.prodajna) : "", slug, auto: 1 });
    if (f.datumNabave) ev.push({ datum: f.datumNabave, vrsta: "nabava", naslov: carName(v), sub: f.nabavna ? eur(f.nabavna) : "", slug, auto: 1 });
    if (f.dolazak && v.status !== "prodano") ev.push({ datum: f.dolazak, vrsta: "dolazak", naslov: carName(v), sub: "očekivani dolazak", slug, auto: 1 });
  });
  upiti.forEach(u => { if (u.termin && u.status !== "zatvoreno") ev.push({ datum: u.termin, vrsta: "probna", naslov: u.vozilo || "Probna vožnja", sub: u.ime + " · " + u.telefon, slug: u.slug, auto: 1 }); });
  kalData.forEach(k => ev.push({ ...k, sub: k.slug ? carName(carBy(k.slug)) : "" }));
  return ev.sort((a, b) => a.datum.localeCompare(b.datum));
}
function vKalendar() {
  if (!kalMonth) { const d = new Date(); kalMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
  if (!kalSel) kalSel = today();
  const ev = allEvents(), y = kalMonth.getFullYear(), m = kalMonth.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= dim; d++) cells.push(iso(new Date(y, m, d)));
  while (cells.length % 7) cells.push(null);
  const byDay = {}; ev.forEach(e => (byDay[e.datum.slice(0, 10)] ||= []).push(e));
  const t = today();
  const upcoming = ev.filter(e => e.datum.slice(0, 10) >= t).slice(0, 8);
  const chip = e => `<span class="kchip" style="--c:${EV[e.vrsta].c}"><i></i>${esc(e.datum.length > 10 ? e.datum.slice(11, 16) + " " : "")}${esc(e.naslov)}</span>`;
  $("#main").innerHTML = offlineNote() + topbar("Kalendar", "Nabave, dolasci, probne vožnje, prodaje i vlastiti događaji", `<button class="btn btn-brand" id="kAdd"><svg class="i"><use href="#plus"/></svg>Novi događaj</button>`) + `
  <div class="kal">
    <div class="panel">
      <div class="khead"><button class="ib" id="kPrev" aria-label="Prethodni mjesec">‹</button><h2>${MJ[m]} ${y}.</h2><button class="ib" id="kNext" aria-label="Sljedeći mjesec">›</button><button class="btn btn-ghost btn-sm" id="kToday">Danas</button>
        <div class="klegend">${Object.values(EV).map(x => `<span style="--c:${x.c}"><i></i>${x.l}</span>`).join("")}</div></div>
      <div class="kgrid"><div class="kdow">Pon</div><div class="kdow">Uto</div><div class="kdow">Sri</div><div class="kdow">Čet</div><div class="kdow">Pet</div><div class="kdow">Sub</div><div class="kdow">Ned</div>
        ${cells.map(d => d ? `<button class="kday${d === t ? " today" : ""}${d === kalSel ? " ksel" : ""}" data-d="${d}"><span class="kn">${+d.slice(8)}</span>${(byDay[d] || []).slice(0, 3).map(chip).join("")}${(byDay[d] || []).length > 3 ? `<span class="kmore">+${byDay[d].length - 3} još</span>` : ""}</button>` : `<div class="kday empty"></div>`).join("")}
      </div>
    </div>
    <div>
      <div class="panel"><h2>${fmtD(kalSel)} <small>${(byDay[kalSel] || []).length} događaja</small></h2><div class="klist">${dayList(byDay[kalSel] || [])}</div></div>
      <div class="panel" style="margin-top:16px"><h2>Nadolazeće</h2><div class="klist">${upcoming.length ? upcoming.map(e => evRow(e, true)).join("") : `<p class="muted">Nema nadolazećih događaja.</p>`}</div></div>
    </div>
  </div>`;
  $("#kPrev").onclick = () => { kalMonth = new Date(y, m - 1, 1); vKalendar(); };
  $("#kNext").onclick = () => { kalMonth = new Date(y, m + 1, 1); vKalendar(); };
  $("#kToday").onclick = () => { kalMonth = null; kalSel = today(); vKalendar(); };
  document.querySelectorAll(".kday[data-d]").forEach(b => b.onclick = () => { kalSel = b.dataset.d; vKalendar(); });
  $("#kAdd").onclick = () => evModal(kalSel);
  document.querySelectorAll("[data-delev]").forEach(b => b.onclick = async () => {
    if (!await confirmBox("Obrisati događaj?", "Događaj će biti uklonjen iz kalendara.")) return;
    kalData = kalData.filter(k => k.id !== b.dataset.delev); await kalSave("Događaj obrisan"); vKalendar();
  });
}
function evRow(e, withDate) {
  const link = e.slug && carBy(e.slug) ? `#uredi/${encodeURIComponent(e.slug)}` : e.vrsta === "probna" ? "#upiti" : "";
  return `<div class="kev" style="--c:${EV[e.vrsta].c}"><i></i><div><span class="kt">${EV[e.vrsta].l}${withDate ? " · " + fmtD(e.datum) : ""}${e.datum.length > 10 ? " · " + e.datum.slice(11, 16) : ""}</span>
    ${link ? `<a href="${link}"><b>${esc(e.naslov)}</b></a>` : `<b>${esc(e.naslov)}</b>`}${e.sub ? `<span>${esc(e.sub)}</span>` : ""}</div>
    ${!e.auto ? `<button class="ib del" data-delev="${esc(e.id)}" title="Obriši"><svg><use href="#trash"/></svg></button>` : ""}</div>`;
}
function dayList(l) { return l.length ? l.map(e => evRow(e, false)).join("") : `<p class="muted">Nema događaja. <a href="#" onclick="evModal(kalSel);return false">Dodaj događaj</a></p>`; }
function evModal(datum) {
  const m = document.createElement("div"); m.className = "modal open";
  const cars = items.filter(v => v.status !== "prodano");
  m.innerHTML = `<div class="box" style="max-width:480px"><h3>Novi događaj</h3>
    <div class="fg" style="grid-template-columns:1fr 1fr;margin-top:16px">
      <div class="f" style="grid-column:1/-1"><label>Naslov</label><input id="evN" placeholder="npr. Tehnički pregled, preuzimanje vozila…"></div>
      <div class="f"><label>Datum</label><input type="date" id="evD" value="${datum || today()}"></div>
      <div class="f"><label>Vrijeme</label><input type="time" id="evT"></div>
      <div class="f" style="grid-column:1/-1"><label>Vozilo (neobavezno)</label><select id="evS"><option value="">—</option>${cars.map(v => `<option value="${esc(v.slug)}">${esc(carName(v))} · ${esc(v.sifra)}</option>`).join("")}</select></div>
    </div>
    <div class="row" style="margin-top:20px"><button class="btn btn-ghost" id="evNo">Odustani</button><button class="btn btn-brand" id="evYes">Dodaj</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector("#evN").focus();
  m.querySelector("#evNo").onclick = () => m.remove();
  m.querySelector("#evYes").onclick = async () => {
    const n = m.querySelector("#evN").value.trim(), d = m.querySelector("#evD").value, t = m.querySelector("#evT").value;
    if (!n || !d) { toast("Upiši naslov i datum", true); return; }
    kalData.push({ id: "k" + Date.now().toString(36), datum: d + (t ? "T" + t : ""), vrsta: "vlastito", naslov: n, slug: m.querySelector("#evS").value });
    m.remove(); kalSel = d; kalMonth = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1);
    await kalSave("Događaj dodan"); vKalendar();
  };
}

/* ---------- ANALITIKA ---------- */
let anPeriod = "12m", anMetric = "zarada";
function periodStart(p) {
  const d = new Date();
  if (p === "mj") return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (p === "3m") return iso(new Date(d.getFullYear(), d.getMonth() - 2, 1));
  if (p === "god") return iso(new Date(d.getFullYear(), 0, 1));
  if (p === "12m") return iso(new Date(d.getFullYear(), d.getMonth() - 11, 1));
  return "0000-01-01";
}
function vAnalitika() {
  const od = periodStart(anPeriod), t = today();
  const all = items.map(v => ({ slug: v.slug, ...calc(v.slug) }));
  const sold = all.filter(x => x.sold && x.f.datumProdaje && x.f.datumProdaje >= od && x.f.datumProdaje <= t).sort((a, b) => b.f.datumProdaje.localeCompare(a.f.datumProdaje));
  const soldFull = sold.filter(x => x.ima && x.prodajna);
  const stock = all.filter(x => !x.sold);
  const sum = (l, k) => l.reduce((a, x) => a + (x[k] || 0), 0);
  const prihod = sum(sold, "prodajna"), zarada = sum(soldFull, "zarada");
  const marza = sum(soldFull, "prodajna") ? zarada / sum(soldFull, "prodajna") * 100 : null;
  const danaL = sold.filter(x => x.dana != null), avgDana = danaL.length ? danaL.reduce((a, x) => a + x.dana, 0) / danaL.length : null;
  const stockUl = sum(stock.filter(x => x.ima), "ulaganje"), stockPot = sum(stock.filter(x => x.ima && x.zarada != null), "zarada");
  const nedostaje = all.filter(x => (x.sold && (!x.ima || !x.f.datumProdaje)) || (!x.sold && !x.ima)).length;

  /* mjesečni niz (zadnjih 12 mj ili do početka razdoblja) */
  const months = []; { const d = new Date(); const n = anPeriod === "sve" ? 12 : anPeriod === "god" ? d.getMonth() + 1 : anPeriod === "3m" ? 3 : anPeriod === "mj" ? 1 : 12;
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push({ k: iso(x).slice(0, 7), l: MJK[x.getMonth()] + (x.getMonth() === 0 || i === n - 1 ? " " + String(x.getFullYear()).slice(2) : ""), prihod: 0, zarada: 0, broj: 0 }); } }
  all.filter(x => x.sold && x.f.datumProdaje).forEach(x => { const mo = months.find(m => m.k === x.f.datumProdaje.slice(0, 7)); if (mo) { mo.broj++; mo.prihod += x.prodajna || 0; if (x.ima && x.zarada != null) mo.zarada += x.zarada; } });

  /* po marki */
  const brands = {}; soldFull.forEach(x => { const b = x.v.brand || "Ostalo"; (brands[b] ||= { b, n: 0, z: 0, p: 0 }); brands[b].n++; brands[b].z += x.zarada; brands[b].p += x.prodajna; });
  const brandL = Object.values(brands).sort((a, b) => b.z - a.z);
  const stale = stock.filter(x => x.dana != null && x.v.status !== "dolazak").sort((a, b) => b.dana - a.dana).slice(0, 8);

  const P = [["mj", "Ovaj mjesec"], ["3m", "3 mjeseca"], ["god", "Ova godina"], ["12m", "12 mjeseci"], ["sve", "Sve"]];
  $("#main").innerHTML = offlineNote() + topbar("Analitika", "Prodaja, zarada i zaliha", `<button class="btn btn-ghost" id="anCsv">Izvoz u Excel (CSV)</button>`) + `
  ${demo ? `<div class="offline demo" style="margin-top:-6px">Brojke u demo načinu su <b>izmišljene</b> i služe samo za prikaz.</div>` : ""}
  ${!demo && nedostaje ? `<div class="offline" style="display:block;background:#fff7ed">Za ${nedostaje} vozila nedostaju nabavne cijene ili datum prodaje – analitika ih ne može uračunati. Unesi ih u <a href="#oglasi" style="font-weight:700;color:inherit">Oglasi → Uredi → Financije</a>.</div>` : ""}
  <div class="tools" style="margin-bottom:16px"><div class="fchips" id="anP">${P.map(([k, l]) => `<button data-k="${k}" class="${anPeriod === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
  <div class="stats">
    <div class="stat dark"><small>Prodano vozila</small><b>${sold.length}</b></div>
    <div class="stat"><small>Prihod</small><b style="font-size:24px">${eur(prihod)}</b></div>
    <div class="stat"><small>Zarada (bruto)</small><b style="font-size:24px;color:${zarada < 0 ? "#b91c1c" : "inherit"}">${eur(zarada)}</b></div>
    <div class="stat"><small>Prosječna marža</small><b>${marza != null ? fmt(marza, 1) + " %" : "—"}</b></div>
    <div class="stat"><small>Zarada po vozilu</small><b style="font-size:24px">${soldFull.length ? eur(zarada / soldFull.length) : "—"}</b></div>
    <div class="stat"><small>Prosječno dana do prodaje</small><b>${avgDana != null ? Math.round(avgDana) : "—"}</b></div>
  </div>
  <div class="two">
    <div class="panel"><h2><span id="anTitle"></span><div class="seg2" id="anM">${[["zarada", "Zarada"], ["prihod", "Prihod"], ["broj", "Broj prodanih"]].map(([k, l]) => `<button data-k="${k}" class="${anMetric === k ? "on" : ""}">${l}</button>`).join("")}</div></h2>
      <div class="chart" id="anChart"></div><details class="tview"><summary>Prikaži kao tablicu</summary><div id="anTable"></div></details></div>
    <div class="panel"><h2>Zaliha <small>${stock.length} vozila</small></h2>
      <div class="kpi2"><div><small>Uloženo u zalihu</small><b>${eur(stockUl)}</b></div><div><small>Očekivana zarada zalihe</small><b>${eur(stockPot)}</b></div></div>
      <h3 class="h3">Najduže na zalihi</h3>
      <div class="stale">${stale.length ? stale.map(x => `<a href="#uredi/${encodeURIComponent(x.slug)}"><img src="${cover(x.v)}" alt=""><div><b>${esc(carName(x.v))}</b><span>${x.f.datumNabave ? "od " + fmtD(x.f.datumNabave) : ""}</span></div><em class="${x.dana > 60 ? "warn" : ""}">${x.dana > 60 ? "⚠ " : ""}${x.dana} dana</em></a>`).join("") : `<p class="muted">Unesi datum nabave za vozila na zalihi.</p>`}</div>
    </div>
  </div>
  <div class="panel" style="margin-top:20px"><h2>Zarada po marki <small>u odabranom razdoblju</small></h2><div class="bbars" id="anBrand"></div></div>
  <div class="panel" style="margin-top:20px"><h2>Prodana vozila <small>${sold.length}</small></h2>
    <div class="tablewrap"><table class="fint"><thead><tr><th>Datum</th><th>Vozilo</th><th class="r">Nabavna</th><th class="r">Troškovi</th><th class="r">Prodajna</th><th class="r">Zarada</th><th class="r">Marža</th><th class="r">Dana</th><th>Plaćanje</th></tr></thead>
    <tbody>${sold.length ? sold.map(x => `<tr><td class="num">${fmtD(x.f.datumProdaje)}</td><td><a href="#uredi/${encodeURIComponent(x.slug)}"><b>${esc(carName(x.v))}</b></a><br><span class="muted">šifra ${esc(x.v.sifra)}</span></td>
      <td class="num r">${x.ima ? eur(x.f.nabavna) : `<span class="miss">unesi</span>`}</td><td class="num r">${x.tro ? eur(x.tro) : "—"}</td><td class="num r">${x.prodajna ? eur(x.prodajna) : `<span class="miss">unesi</span>`}</td>
      <td class="num r"><b class="${x.zarada < 0 ? "neg" : ""}">${x.zarada != null ? eur(x.zarada) : "—"}</b></td><td class="num r">${x.marza != null ? fmt(x.marza, 1) + " %" : "—"}</td><td class="num r">${x.dana ?? "—"}</td><td>${esc(x.f.placanje || "—")}</td></tr>`).join("") : `<tr><td colspan="9" class="empty">Nema prodanih vozila u ovom razdoblju.</td></tr>`}</tbody></table></div>
  </div>`;

  /* graf (jedna serija, bez dvostruke osi) */
  const T = { zarada: "Zarada po mjesecu", prihod: "Prihod po mjesecu", broj: "Prodana vozila po mjesecu" };
  $("#anTitle").textContent = T[anMetric];
  barChart($("#anChart"), months.map(m => ({ l: m.l, v: m[anMetric], tip: `${m.l}: ${anMetric === "broj" ? m.broj + " vozila" : eur(m[anMetric])} · ${m.broj} prodano` })), anMetric === "broj" ? v => String(v) : v => fmtK(v));
  $("#anTable").innerHTML = `<table><thead><tr><th>Mjesec</th><th class="r">Prodano</th><th class="r">Prihod</th><th class="r">Zarada</th></tr></thead><tbody>${months.map(m => `<tr><td>${m.l}</td><td class="num r">${m.broj}</td><td class="num r">${eur(m.prihod)}</td><td class="num r">${eur(m.zarada)}</td></tr>`).join("")}</tbody></table>`;
  const bmax = Math.max(1, ...brandL.map(b => Math.abs(b.z)));
  $("#anBrand").innerHTML = brandL.length ? brandL.map(b => `<div class="bb" title="${esc(b.b)}: ${eur(b.z)} zarade · ${b.n} prodano · marža ${fmt(b.z / b.p * 100, 1)} %"><span>${esc(b.b)}</span><div class="bt"><i style="width:${Math.max(1.5, Math.abs(b.z) / bmax * 100)}%;${b.z < 0 ? "background:#b91c1c" : ""}"></i></div><em>${eur(b.z)}</em><small>${b.n} · ${fmt(b.z / b.p * 100, 1)} %</small></div>`).join("") : `<p class="muted">Nema podataka.</p>`;

  $("#anP").onclick = e => { const b = e.target.closest("button"); if (b) { anPeriod = b.dataset.k; vAnalitika(); } };
  $("#anM").onclick = e => { const b = e.target.closest("button"); if (b) { anMetric = b.dataset.k; vAnalitika(); } };
  $("#anCsv").onclick = () => {
    const rows = [["Datum prodaje", "Vozilo", "Šifra", "Nabavna", "Troškovi", "Prodajna", "Zarada", "Marža %", "Dana", "Plaćanje"]].concat(
      sold.map(x => [x.f.datumProdaje, carName(x.v), x.v.sifra, x.f.nabavna || "", x.tro || "", x.prodajna || "", x.zarada != null ? Math.round(x.zarada) : "", x.marza != null ? x.marza.toFixed(1).replace(".", ",") : "", x.dana ?? "", x.f.placanje || ""]));
    const csv = "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `comfortcars-prodaja-${today()}.csv`; a.click();
  };
}
const fmtK = v => Math.abs(v) >= 1000 ? fmt(v / 1000, Math.abs(v) >= 10000 ? 0 : 1) + "k €" : fmt(v) + " €";

/* jednostavan stupčasti graf u SVG-u: tanki stupci, zaobljeni vrh, tooltip na hover */
function barChart(el, data, fmtTick) {
  const W = 640, H = 300, pl = 58, pr = 8, pt = 14, pb = 34, iw = W - pl - pr, ih = H - pt - pb;
  const max = Math.max(...data.map(d => d.v), 0), min = Math.min(...data.map(d => d.v), 0);
  const nice = x => { if (x <= 0) return 0; const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
  const top = nice(max) || 1, bot = min < 0 ? -nice(-min) : 0, span = top - bot;
  const y = v => pt + (top - v) / span * ih, step = iw / data.length, bw = Math.min(42, step * .56);
  const ticks = [0, .25, .5, .75, 1].map(f => bot + f * span);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(document.getElementById("anTitle")?.textContent || "Graf")}" preserveAspectRatio="none" style="width:100%;height:auto;overflow:visible">`;
  ticks.forEach(t => { s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="${t === 0 ? "#cfccc5" : "#ecebe7"}" stroke-width="1"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-size="13" fill="#73767c">${fmtTick(t)}</text>`; });
  data.forEach((d, i) => {
    const x = pl + step * i + (step - bw) / 2, y0 = y(0), y1 = y(d.v), h = Math.abs(y1 - y0), r = Math.min(4, h);
    const yy = d.v >= 0 ? y1 : y0;
    const path = d.v >= 0 ? `M${x},${y0}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${y0}Z` : `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 - r}V${y0}Z`;
    s += `<g class="bar" data-tip="${esc(d.tip)}"><rect x="${pl + step * i}" y="${pt}" width="${step}" height="${ih}" fill="transparent"/>${h > .5 ? `<path d="${path}" fill="${d.v < 0 ? "#b91c1c" : "#ff4713"}"/>` : ""}</g>`;
    s += `<text x="${pl + step * i + step / 2}" y="${H - 12}" text-anchor="middle" font-size="13" fill="#73767c">${esc(d.l)}</text>`;
  });
  el.innerHTML = s + `</svg><div class="ctip" hidden></div>`;
  const tip = el.querySelector(".ctip");
  el.querySelectorAll(".bar").forEach(g => {
    g.addEventListener("mousemove", e => { const r = el.getBoundingClientRect(); tip.hidden = false; tip.textContent = g.dataset.tip; tip.style.left = Math.min(r.width - 10, e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top - 12) + "px"; g.classList.add("hov"); });
    g.addEventListener("mouseleave", () => { tip.hidden = true; g.classList.remove("hov"); });
  });
}

window.FIN = { vKalendar, vAnalitika, finPanel, finPanelBind, finPanelCommit, soldModal, calc, demoFin, demoKal };
window.evModal = evModal;

/* ---------- PRIJAVA PROBLEMA ---------- */
let bugData = { agent: false, lista: [] };
const BST = {
  "novo": ["Zaprimljeno", "#2a78d6"], "zaprimljeno": ["Zaprimljeno", "#2a78d6"], "u obradi": ["Developeri su već u tome…", "#eda100"],
  "objavljeno": ["Popravljeno i objavljeno", "#16a34a"], "riješeno": ["Popravljeno – uskoro na stranici", "#16a34a"], "čeka odobrenje": ["Popravljeno – uskoro na stranici", "#16a34a"],
  "bez izmjena": ["Pregledano", "#73767c"], "greška": ["Developeri rješavaju ručno", "#eda100"],
};
async function bugLoad() {
  if (demo) { try { bugData = JSON.parse(sessionStorage.getItem("cc-bugs") || "null") || { agent: true, lista: [] }; } catch (e) { } return; }
  try { bugData = await (await fetch("/api/bugovi", { cache: "no-store" })).json(); } catch (e) { bugData = { agent: false, lista: [] }; }
}
let bugTimer = null;
async function vBugovi() {
  await bugLoad();
  const L = bugData.lista || [];
  const when = t => { try { return new Date(t).toLocaleString("hr-HR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return t; } };
  $("#main").innerHTML = offlineNote() + topbar("Prijava problema", "Opišite što ne radi ili ne izgleda dobro – popravak kreće automatski") + `
  ${demo ? `<div class="offline demo">Demo način: prijava se ovdje samo prikazuje. Na pravom dashboardu developeri odmah kreću s popravkom.</div>` :
      !bugData.agent ? `<div class="offline" style="display:block;background:#fff7ed">Prijave se spremaju i developeri će ih pregledati.</div>` : ""}
  <div class="bugw">
    <div class="panel"><h2>Nova prijava</h2>
      <form id="bugF" class="fg" style="grid-template-columns:1fr 1fr" novalidate>
        <div class="f"><label>Gdje je problem?</label><select name="stranica"><option>Naslovnica</option><option>Ponuda vozila</option><option>Stranica oglasa</option><option>Dashboard</option><option>Na mobitelu</option><option>Ostalo</option></select></div>
        <div class="f"><label>Hitnost</label><select name="hitnost"><option>Normalno</option><option>Hitno – ne radi</option><option>Sitnica</option></select></div>
        <div class="f" style="grid-column:1/-1"><label>Što ne radi? <em>*</em></label><textarea name="opis" rows="6" placeholder="npr. Na mobitelu se gumb „Pošalji upit” ne vidi do kraja. Ili: kod BMW-a serije 5 krivo piše kilometraža."></textarea><div class="hint">Što konkretnije – što ste kliknuli, što ste očekivali i što se dogodilo.</div></div>
        <div class="f" style="grid-column:1/-1"><label>Adresa stranice (neobavezno)</label><input name="url" placeholder="zalijepite link stranice na kojoj je problem"></div>
        <div class="f" style="grid-column:1/-1"><label>Snimka zaslona (neobavezno)</label><input type="file" id="bugImg" accept="image/png,image/jpeg,image/webp"></div>
        <div style="grid-column:1/-1"><button class="btn btn-brand" type="submit" id="bugSend">Pošalji prijavu</button></div>
      </form>
    </div>
    <div class="panel"><h2>Kako radi?</h2>
      <ol class="howb"><li><b>Pošaljete prijavu</b> s opisom problema.</li><li><b>Developeri odmah kreću</b> – pronađu uzrok i poprave ga.</li><li>Popravak se <b>objavljuje na stranici</b>, najčešće u nekoliko minuta.</li><li>Ovdje pratite <b>status i odgovor</b> što je promijenjeno.</li></ol>
    </div>
  </div>
  <div class="panel" style="margin-top:20px"><h2>Prijave <small>${L.length}</small></h2>
    <div class="upl">${L.length ? L.map(b => { const [lab, col] = BST[b.status] || [b.status, "#73767c"]; return `<div class="up bug" data-id="${esc(b.id)}">
      <div class="up-h"><span class="bst" style="--c:${col}"><i></i>${lab}</span><span class="up-type">${esc(b.stranica || "")}</span>${b.hitnost && b.hitnost !== "Normalno" ? `<span class="up-type">${esc(b.hitnost)}</span>` : ""}<span class="up-t">${when(b.vrijeme)}</span>
        
        ${b.status !== "u obradi" ? `<button class="ib del" data-act="del" title="Obriši"><svg><use href="#trash"/></svg></button>` : ""}</div>
      <p class="up-m" style="margin-top:12px">${esc(b.opis)}</p>
      ${b.url ? `<p class="muted" style="margin-top:6px">${esc(b.url)}</p>` : ""}${b.slika ? `<a href="${esc(b.slika)}" target="_blank"><img class="bimg" src="${esc(b.slika)}" alt="Snimka zaslona"></a>` : ""}
      ${b.agent ? `<div class="bagent"><b>Odgovor developera:</b> ${esc(b.agent)}</div>` : b.status === "u obradi" ? `<div class="bagent">Developeri su zaprimili prijavu i rade na popravku. Ova stranica se sama osvježava.</div>` : ""}
    </div>`; }).join("") : `<div class="empty">Još nema prijava.</div>`}</div>
  </div>`;
  let file = null; $("#bugImg").onchange = e => file = e.target.files[0] || null;
  $("#bugF").onsubmit = async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    if ((fd.opis || "").trim().length < 5) { toast("Opišite problem", true); return; }
    $("#bugSend").disabled = true; $("#bugSend").textContent = "Šaljem…";
    if (demo) {
      bugData.lista.unshift({ id: "demo" + Date.now(), vrijeme: new Date().toISOString(), stranica: fd.stranica, hitnost: fd.hitnost, opis: fd.opis, url: fd.url,
        status: "objavljeno", agent: "(Demo primjer odgovora) Pronašli smo uzrok i popravili ga – izmjena je već vidljiva na stranici." });
      try { sessionStorage.setItem("cc-bugs", JSON.stringify(bugData)); } catch (e) { }
      toast("Prijava poslana (demo)"); vBugovi(); return;
    }
    try {
      let slika = "";
      if (file) { const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": file.type }, body: file }); const j = await r.json(); if (r.ok) slika = j.url; }
      const r = await fetch("/api/bug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fd, slika }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      toast("Prijava poslana – developeri su obaviješteni"); vBugovi();
    } catch (err) { toast("Slanje nije uspjelo: " + (err.message || ""), true); $("#bugSend").disabled = false; $("#bugSend").textContent = "Pošalji prijavu"; }
  };
  document.querySelectorAll(".bug [data-act]").forEach(btn => btn.onclick = async () => {
    const id = btn.closest(".bug").dataset.id, act = btn.dataset.act;
    if (act === "del" && !await confirmBox("Obrisati prijavu?", "Prijava će biti uklonjena s popisa.")) return;
    if (demo) { bugData.lista = bugData.lista.filter(b => b.id !== id); try { sessionStorage.setItem("cc-bugs", JSON.stringify(bugData)); } catch (e) { } vBugovi(); return; }
    await fetch("/api/bugovi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, akcija: act === "del" ? "obrisi" : "ponovi" }) });
    vBugovi();
  });
  /* osvježavanje dok se prijava obrađuje */
  clearTimeout(bugTimer);
  if (!demo && L.some(b => ["novo", "u obradi"].includes(b.status))) bugTimer = setTimeout(() => { if (location.hash === "#problemi") vBugovi(); }, 8000);
}
window.FIN.vBugovi = vBugovi;
