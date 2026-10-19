const languageToggle = document.querySelector(".language-toggle");
const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");

function setLanguage(language) {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-tr][data-en]").forEach((element) => {
    element.textContent = element.dataset[language];
  });
  const isMenuExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  languageToggle.textContent = language === "tr" ? "EN" : "TR";
  languageToggle.setAttribute(
    "aria-label",
    language === "tr" ? "Switch to English" : "Türkçeye geç"
  );
  menuToggle.setAttribute(
    "aria-label",
    language === "tr"
      ? isMenuExpanded ? "Menüyü kapat" : "Menüyü aç"
      : isMenuExpanded ? "Close menu" : "Open menu"
  );
  mobileNav.setAttribute("aria-label", language === "tr" ? "Mobil navigasyon" : "Mobile navigation");
  document.querySelector(".desktop-nav").setAttribute("aria-label", language === "tr" ? "Ana navigasyon" : "Main navigation");
  document.querySelector(".hero-art").setAttribute(
    "aria-label",
    language === "tr"
      ? "Birbiriyle kesişen yörüngelerden oluşan soyut küre"
      : "An abstract globe formed by intersecting orbits"
  );
  document.querySelector(".site-header .wordmark").setAttribute(
    "aria-label",
    language === "tr" ? "WRLDSI, ana sayfa" : "WRLDSI, home"
  );
  document.title = language === "tr"
    ? "WRLDSI — Zekâ, yaşamın hizmetinde"
    : "WRLDSI — Intelligence, in service of life";
  document.querySelector('meta[name="description"]').content = language === "tr"
    ? "WRLDSI; süper zekâ, yapay zekâ güvenliği ve toplum üzerine küresel bir düşünme alanı. Güncel araştırmaları ve gelişmeleri kaynaklarıyla takip edin."
    : "WRLDSI is a global space for thinking about superintelligence, AI safety, and society—with current research and developments linked to their sources.";
  document.querySelector('meta[property="og:description"]').content = language === "tr"
    ? "Süper zekâ çağına dair ortak bir vizyon, ilkeler, açık sorular ve güncel araştırmalar."
    : "A shared vision, principles, open questions, and current research for the age of superintelligence.";
  document.dispatchEvent(new CustomEvent("wrldsi:languagechange", { detail: { language } }));
}

languageToggle.addEventListener("click", () => {
  setLanguage(document.documentElement.lang === "tr" ? "en" : "tr");
});

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  const language = document.documentElement.lang;
  menuToggle.setAttribute(
    "aria-label",
    language === "tr"
      ? isExpanded ? "Menüyü aç" : "Menüyü kapat"
      : isExpanded ? "Open menu" : "Close menu"
  );
  mobileNav.hidden = isExpanded;
});

mobileNav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    mobileNav.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", document.documentElement.lang === "tr" ? "Menüyü aç" : "Open menu");
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
