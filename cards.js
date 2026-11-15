/* Zajednički pomoćnici za kartice vozila i tražilicu (koriste index.html i ponuda.html) */
(function () {
  const ICO = n => "https://comfort-cars.b-cdn.net/slike/ico-" + n + ".svg";
  const LBL = { rezervacija: "Rezervacija", dolazak: "U dolasku", prodano: "Prodano", akcija: "Akcija" };
  const fmt = (n, d = 0) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = s => parseInt(String(s ?? "").replace(/\D/g, ""), 10) || 0;
  const arrow = '<svg class="i"><use href="#arrow"/></svg>';

  const all = () => (window.VOZILA_LIST || []).slice();
  /* preko servera: prave adrese vozilo/<slug>/ (relativno, radi i u podmapi, npr. GitHub Pages); kao datoteka: vozilo.html?v= */
  const url = c => location.protocol === "file:" ? "vozilo.html?v=" + encodeURIComponent(c.slug) : (window.CC_ROOT || "") + "vozilo/" + c.slug + "/";
  const isSold = c => c.status === "prodano" || !c.price;
  const RANK = { "": 0, akcija: 0, dolazak: 1, rezervacija: 2, prodano: 3 };
  /* dostupna vozila prvo (redoslijed unutar grupe ostaje kao na stranici) */
  const byAvailability = list => list.map((c, i) => [c, i]).sort((a, b) => (RANK[isSold(a[0]) ? "prodano" : a[0].status || ""] - RANK[isSold(b[0]) ? "prodano" : b[0].status || ""]) || a[1] - b[1]).map(x => x[0]);
  const available = () => byAvailability(all().filter(c => !isSold(c)));
  const cover = c => (c.images && c.images[0] ? c.images[0].mid : "");
  /* responzivna slika: 300/768/1024 px – preglednik bira najmanju dovoljnu */
  const img = (c, sizes, eager) => {
    const i = (c.images || [])[0] || {};
    const set = [i.s300 && i.s300 + " 300w", i.s768 && i.s768 + " 768w", i.mid && i.mid + " 1024w"].filter(Boolean);
    return `<img ${eager ? 'loading="eager"' : 'loading="lazy"'} decoding="async" src="${i.s768 || i.mid || ""}"${set.length > 1 ? ` srcset="${set.join(", ")}" sizes="${sizes}"` : ""} alt="${esc(c.name)} ${esc(c.variant)}" onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${i.mid || ""}'">`;
  };
  const CARD_SIZES = "(max-width:600px) 92vw, (max-width:1000px) 46vw, 380px";
  const model = c => c.name.slice(c.brand.length).trim() || c.name;

  function card(c, idx) {
    const sold = c.status === "prodano" || !c.price;
    const meta = [c.godina, c.km ? fmt(num(c.km)) + " km" : "", c.motor, c.snaga, c.mjenjac].filter(Boolean).map(esc).join(" · ");
    return `<article class="car${sold ? " sold" : ""}">
      <a class="cover" href="${url(c)}" aria-label="${esc(c.name)} ${esc(c.variant)} – Vidi vozilo"></a>
      <div class="ph">${img(c, CARD_SIZES, idx !== undefined && idx < 3)}
        ${(c.brojSlika || (c.images || []).length) ? `<span class="pc"><svg><use href="#cam"/></svg>${c.brojSlika || c.images.length}</span>` : ""}
        <div class="ov">${c.status ? `<span class="st ${c.status}">${LBL[c.status]}</span>` : ""}<h3>${esc(c.name)}</h3>${c.variant ? `<span>${esc(c.variant)}</span>` : ""}</div>
      </div>
      <div class="bd">
        <div class="meta">${meta}</div>
        ${sold ? `<div class="price na">Prodano</div>` : `<div class="price">${fmt(c.price)} €<i>${arrow}</i></div>`}
      </div>
    </article>`;
  }

  function dealCard(c) {
    return `<article class="dcar">
      <a class="cover" href="${url(c)}" aria-label="${esc(c.name)} ${esc(c.variant)} – Vidi vozilo"></a>
      <div class="ph">${img(c, "(max-width:1000px) 92vw, 300px")}</div>
      <div class="info"><span class="st akcija">Akcija</span><h3>${esc(c.name)}</h3><div class="var">${esc(c.variant)}</div>
        <ul><li>${esc(c.godina)}</li><li>${fmt(num(c.km))} km</li><li>${esc(c.motor)}</li><li>${esc(c.snaga)}</li><li>${esc(c.mjenjac)}</li></ul>
        <div class="price">${fmt(c.price)} €</div><div class="go">Vidi vozilo →</div></div>
    </article>`;
  }

  /* Tražilica – ista polja kao na comfortcars.hr */
  function setupForm(form, params) {
    const q = n => form.querySelector(`[name="${n}"]`);
    const add = (sel, arr, f = x => x) => sel && arr.forEach(v => sel.insertAdjacentHTML("beforeend", `<option value="${v}">${f(v)}</option>`));
    const eur = v => fmt(v) + " €";
    const cars = all();
    add(q("marka"), [...new Set(cars.map(c => c.brand))].sort((a, b) => a.localeCompare(b, "hr")));
    add(q("cijena_od"), [10000, 15000, 20000, 25000, 30000], eur);
    add(q("cijena_do"), Array.from({ length: 18 }, (_, i) => 15000 + i * 5000), eur);
    add(q("godina_od"), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    add(q("godina_do"), [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]);
    add(q("km_do"), [50000, 75000, 100000, 125000, 150000], v => "do " + fmt(v) + " km");
    add(q("karoserija"), [...new Set(cars.map(c => c.karoserija).filter(Boolean))].sort((a, b) => a.localeCompare(b, "hr")));
    const fillModels = () => {
      const b = q("marka") ? q("marka").value : "", m = q("model");
      if (!m) return;
      m.innerHTML = `<option value="">${m.closest('.qbar') ? (b ? 'Svi modeli' : 'Odaberite marku') : 'Model vozila'}</option>`;
      m.disabled = !b;
      if (b) add(m, [...new Set(cars.filter(c => c.brand === b).map(model))].sort((x, y) => x.localeCompare(y, "hr")));
    };
    if (q("marka")) q("marka").addEventListener("change", fillModels);
    if (params) {
      ["marka", "cijena_od", "cijena_do", "godina_od", "godina_do", "mjenjac", "vrsta_motora", "km_do", "karoserija", "sort"].forEach(n => { if (params.get(n) && q(n)) q(n).value = params.get(n); });
      fillModels();
      if (params.get("model")) q("model").value = params.get("model");
    }
  }

  function filter(params) {
    const g = n => params.get(n) || "";
    const showSold = g("prodano") === "1" || g("status") === "prodano";
    const list = all().filter(c => {
      const p = c.price ? +c.price : null, y = num(c.godina);
      if (!showSold && isSold(c)) return false;
      if (g("km_do") && num(c.km) > +g("km_do")) return false;
      if (g("karoserija") && c.karoserija !== g("karoserija")) return false;
      if (g("marka") && c.brand !== g("marka")) return false;
      if (g("model") && model(c) !== g("model")) return false;
      if (g("cijena_od") && (!p || p < +g("cijena_od"))) return false;
      if (g("cijena_do") && (!p || p > +g("cijena_do"))) return false;
      if (g("godina_od") && y < +g("godina_od")) return false;
      if (g("godina_do") && y > +g("godina_do")) return false;
      if (g("mjenjac") && c.mjenjac !== g("mjenjac")) return false;
      if (g("vrsta_motora") && c.motor !== g("vrsta_motora")) return false;
      if (g("status") && c.status !== g("status")) return false;
      return true;
    });
    const s = g("sort");
    const P = c => (c.price ? +c.price : null);
    if (s === "cijena_asc") return list.sort((a, b) => (P(a) ?? 1e9) - (P(b) ?? 1e9));
    if (s === "cijena_desc") return list.sort((a, b) => (P(b) ?? -1) - (P(a) ?? -1));
    if (s === "km") return list.sort((a, b) => num(a.km) - num(b.km));
    if (s === "godina") return list.sort((a, b) => num(b.godina) - num(a.godina));
    return byAvailability(list);
  }

  function bySifra(s) {
    s = String(s).trim();
    return all().find(c => String(c.sifra) === s);
  }

  window.CC = { all, available, isSold, card, dealCard, setupForm, filter, bySifra, url, fmt, esc, num, LBL };
})();
