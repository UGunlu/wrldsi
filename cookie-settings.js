(() => {
  const storageKey = "wrldsi-cookie-preferences";
  const fontHref = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap";
  const dialog = document.createElement("dialog");
  dialog.className = "cookie-dialog";
  dialog.setAttribute("aria-labelledby", "cookie-title");
  dialog.innerHTML = `
    <h2 id="cookie-title" data-copy="title"></h2>
    <p data-copy="intro"></p>
    <label class="cookie-option">
      <span><strong data-copy="fontTitle"></strong><small data-copy="fontDescription"></small></span>
      <input type="checkbox" id="external-fonts">
    </label>
    <p class="cookie-status" id="cookie-status" role="status" aria-live="polite"></p>
    <div class="cookie-dialog-actions">
      <button type="button" data-action="necessary"></button>
      <button type="button" data-action="save"></button>
      <button type="button" class="cookie-primary" data-action="all"></button>
    </div>`;

  const banner = document.createElement("aside");
  banner.className = "cookie-banner";
  banner.hidden = true;
  banner.setAttribute("aria-label", "Çerez ve harici hizmet tercihleri");
  banner.innerHTML = `
    <div class="cookie-banner-copy">
      <p data-copy="banner"></p>
      <p class="cookie-banner-status" id="cookie-banner-status" role="status" aria-live="polite"></p>
    </div>
    <div class="cookie-actions">
      <button type="button" data-action="settings"></button>
      <button type="button" data-action="necessary"></button>
      <button type="button" class="cookie-primary" data-action="all"></button>
    </div>`;

  document.body.append(dialog, banner);

  const copy = {
    tr: {
      title: "Çerez ve hizmet tercihleri",
      intro: "Bu sitede analitik veya reklam çerezi kullanılmıyor. İsteğe bağlı Google Fonts hizmeti yalnızca izin verirsen yüklenir. Seçimin bu tarayıcıda saklanır.",
      fontTitle: "Harici yazı tipi hizmeti (Google Fonts)",
      fontDescription: "İzin verirsen yazı tipleri Google sunucularından yüklenir; bağlantı sırasında teknik bilgiler Google'a iletilebilir.",
      banner: "Gizliliğin önemli. Google Fonts varsayılan olarak kapalıdır; tercihini şimdi belirleyebilirsin.",
      settings: "Ayarlar",
      necessary: "Yalnızca gerekli",
      save: "Seçimi kaydet",
      all: "Tümüne izin ver",
      saved: "Tercihin kaydedildi.",
      failed: "Tercih kaydedilemedi. Tarayıcı depolama ayarlarını kontrol edip yeniden dene.",
      fontLoadFailed: "Harici yazı tipi yüklenemedi; sistem yazı tipleri kullanılacak."
    },
    en: {
      title: "Cookie and service preferences",
      intro: "This site does not use analytics or advertising cookies. Optional Google Fonts load only if you allow them. Your choice is stored in this browser.",
      fontTitle: "External font service (Google Fonts)",
      fontDescription: "If allowed, fonts load from Google servers; technical connection data may be sent to Google.",
      banner: "Your privacy matters. Google Fonts are off by default; you can choose whether to enable them.",
      settings: "Settings",
      necessary: "Necessary only",
      save: "Save choices",
      all: "Allow all",
      saved: "Your preference has been saved.",
      failed: "Could not save your preference. Check your browser storage settings and try again.",
      fontLoadFailed: "The external font could not be loaded; system fonts will be used."
    }
  };

  const input = dialog.querySelector("#external-fonts");
  const status = dialog.querySelector("#cookie-status");
  const bannerStatus = banner.querySelector("#cookie-banner-status");
  let preferences = null;

  function currentCopy() {
    return copy[document.documentElement.lang === "en" ? "en" : "tr"];
  }

  function renderCopy() {
    const strings = currentCopy();
    document.querySelectorAll("[data-copy]").forEach((element) => {
      element.textContent = strings[element.dataset.copy];
    });
    dialog.querySelector('[data-action="necessary"]').textContent = strings.necessary;
    dialog.querySelector('[data-action="save"]').textContent = strings.save;
    dialog.querySelector('[data-action="all"]').textContent = strings.all;
    banner.querySelector('[data-action="settings"]').textContent = strings.settings;
    banner.querySelector('[data-action="necessary"]').textContent = strings.necessary;
    banner.querySelector('[data-action="all"]').textContent = strings.all;
  }

  function setExternalFonts(enabled) {
    const existing = document.querySelector("#optional-google-fonts");
    if (enabled && !existing) {
      const stylesheet = document.createElement("link");
      stylesheet.id = "optional-google-fonts";
      stylesheet.rel = "stylesheet";
      stylesheet.href = fontHref;
      stylesheet.addEventListener("error", () => {
        status.textContent = currentCopy().fontLoadFailed;
        if (!dialog.open) {
          banner.hidden = false;
          bannerStatus.textContent = currentCopy().fontLoadFailed;
        }
      }, { once: true });
      document.head.append(stylesheet);
    } else if (!enabled && existing) {
      existing.remove();
    }
  }

  function save(enabled) {
    const nextPreferences = { externalFonts: enabled };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextPreferences));
    } catch (error) {
      console.error("Unable to save cookie preferences.", error);
      status.textContent = currentCopy().failed;
      bannerStatus.textContent = currentCopy().failed;
      return;
    }
    preferences = nextPreferences;
    setExternalFonts(enabled);
    bannerStatus.textContent = "";
    banner.hidden = true;
    if (dialog.open) dialog.close();
  }

  function openSettings() {
    input.checked = Boolean(preferences && preferences.externalFonts);
    status.textContent = "";
    dialog.showModal();
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.externalFonts !== "boolean") {
        throw new TypeError("Invalid cookie preference format.");
      }
      preferences = parsed;
      setExternalFonts(parsed.externalFonts);
    }
  } catch (error) {
    console.error("Unable to read cookie preferences.", error);
    status.textContent = currentCopy().failed;
    bannerStatus.textContent = currentCopy().failed;
  }

  renderCopy();
  if (!preferences) banner.hidden = false;

  document.querySelectorAll(".cookie-settings-trigger").forEach((button) => {
    button.addEventListener("click", openSettings);
  });
  document.addEventListener("wrldsi:languagechange", renderCopy);
  banner.querySelector('[data-action="settings"]').addEventListener("click", openSettings);
  dialog.querySelector('[data-action="necessary"]').addEventListener("click", () => save(false));
  banner.querySelector('[data-action="necessary"]').addEventListener("click", () => save(false));
  dialog.querySelector('[data-action="save"]').addEventListener("click", () => save(input.checked));
  dialog.querySelector('[data-action="all"]').addEventListener("click", () => save(true));
  banner.querySelector('[data-action="all"]').addEventListener("click", () => save(true));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.querySelectorAll("#year, .current-year").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
})();
