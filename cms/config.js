/* Postavke uređivača za Comfort Cars */
window.CMS_CONFIG = {
  siteName: "Comfort Cars",
  owner: "newaveadagency",
  repo: "comfort-cars",
  branch: "main",
  siteUrl: "https://newaveadagency.github.io/comfort-cars/",
  uploadDir: "uploads",
  phone: "+385911100031",
  email: "info@comfortcars.eu",
  buttonClass: "btn btn-brand",
  activeClass: "on",
  sectionTemplate: '<div class="wrap" style="padding:72px 0"><h2>Novi naslov sekcije</h2><p>Kliknite ovdje i upišite tekst.</p></div>',
  pages: [
    { file: "index.html", name: "Naslovnica" },
    { file: "ponuda.html", name: "Ponuda vozila" },
    { file: "vozilo.html", name: "Stranica oglasa (predložak)", template: "Ovo je predložak za sve oglase. Ovdje uređujete zaglavlje, podnožje i dijelove zajedničke svim oglasima. Podaci o vozilu uređuju se u kartici „Vozila”." },
    { file: "404.html", name: "Stranica nije pronađena (404)" }
  ],
  /* dijelovi koje popunjava JavaScript – u uređivaču se prikazuju kao blok */
  dynamic: {
    "#grid": "Vozila iz ponude (automatski)",
    "#deals": "Vozila na akciji (automatski)",
    "#feat": "Istaknuto vozilo (automatski)",
    "#brands": "Marke vozila (automatski)",
    "#bodies": "Vrste karoserije (automatski)",
    "#chips": "Aktivni filteri (automatski)",
    "main#app": "Sadržaj oglasa: fotografije, podaci, cijena i upit (iz kartice Vozila)",
    "#similar": "Slična vozila (automatski)",
    "#recent": "Nedavno pregledana vozila (automatski)"
  },
  locked: ["#count", "#rata", "#rUc", "#rFin", "#rN", "#sifraMsg", "#yr"],
  vehicles: { url: "admin.html" },
  v: 1
};
