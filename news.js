const newsGrid = document.querySelector("#news-grid");
const newsStatus = document.querySelector("#news-status");
const newsMessages = {
  tr: {
    loading: "Güncel kaynaklar yükleniyor.",
    empty: "Henüz yayımlanmış içerik yok. Yeni akışlar editoryal incelemeden sonra burada görünecek.",
    error: "Haber akışı şu anda yüklenemedi. Lütfen daha sonra yeniden deneyin.",
    ready: "",
    noDate: "Tarih belirtilmemiş",
    sourceLanguage: "Kaynak dili",
    readSource: "Kaynağı oku",
  },
  en: {
    loading: "Loading current sources.",
    empty: "No updates have been published yet. New items will appear here after editorial review.",
    error: "The news feed could not be loaded. Please try again later.",
    ready: "",
    noDate: "Date unavailable",
    sourceLanguage: "Source language",
    readSource: "Read source",
  },
};

let newsItems = [];
let statusKey = "loading";

function currentLanguage() {
  return document.documentElement.lang === "en" ? "en" : "tr";
}

function formatPublishedDate(value, language) {
  if (!value) return newsMessages[language].noDate;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return newsMessages[language].noDate;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function renderNews() {
  const language = currentLanguage();
  newsStatus.textContent = newsMessages[language][statusKey];
  newsStatus.hidden = statusKey === "ready";
  newsGrid.replaceChildren();

  for (const item of newsItems) {
    const card = document.createElement("article");
    card.className = "news-card";

    const metadata = document.createElement("div");
    metadata.className = "news-card-meta";

    const sourceLanguage = document.createElement("span");
    sourceLanguage.textContent = `${newsMessages[language].sourceLanguage} · ${item.language.toUpperCase()}`;

    const date = document.createElement("time");
    if (item.publishedAt) date.dateTime = item.publishedAt;
    date.textContent = formatPublishedDate(item.publishedAt, language);
    metadata.append(sourceLanguage, date);

    const title = document.createElement("a");
    title.className = "news-card-title";
    title.href = item.url;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = item.title;
    title.setAttribute("aria-label", `${newsMessages[language].readSource}: ${item.title}`);

    card.append(metadata, title);

    const summary = item.summary || item.sourceSummary;
    if (summary) {
      const description = document.createElement("p");
      description.className = "news-card-summary";
      description.textContent = summary;
      card.append(description);
    }

    const source = document.createElement("span");
    source.className = "news-card-source";
    source.textContent = item.source;
    card.append(source);
    newsGrid.append(card);
  }
}

async function loadNews() {
  try {
    const response = await fetch("articles.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`News feed request failed with HTTP ${response.status}`);

    const data = await response.json();
    if (!data || !Array.isArray(data.articles)) {
      throw new TypeError("News feed has an invalid format");
    }

    newsItems = data.articles.map((item) => {
      if (
        !item ||
        typeof item.title !== "string" ||
        typeof item.source !== "string" ||
        typeof item.language !== "string" ||
        typeof item.url !== "string"
      ) {
        throw new TypeError("News feed contains an invalid article");
      }
      const url = new URL(item.url);
      if (url.protocol !== "https:") throw new TypeError("News article links must use HTTPS");
      return { ...item, url: url.href };
    });
    statusKey = newsItems.length ? "ready" : "empty";
  } catch (error) {
    console.error("Unable to load the WRLDSI news feed.", error);
    newsItems = [];
    statusKey = "error";
  }

  renderNews();
}

document.addEventListener("wrldsi:languagechange", renderNews);
loadNews();
