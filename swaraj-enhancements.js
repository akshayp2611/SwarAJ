/* =========================================================
   SWARAJ ENHANCEMENTS
   Works alongside existing script.js.
   Existing API and playback logic are NOT replaced.
========================================================= */

(() => {
  "use strict";

  const THEMES = [
    { id:"liquid", name:"Liquid", a:"#8b5cf6", b:"#06b6d4" },
    { id:"ocean", name:"Ocean", a:"#00c6ff", b:"#0072ff" },
    { id:"sunset", name:"Sunset", a:"#ff7b00", b:"#ff006e" },
    { id:"emerald", name:"Emerald", a:"#00e676", b:"#00bfa5" },
    { id:"royal", name:"Royal", a:"#a855f7", b:"#ec4899" },
    { id:"gold", name:"Gold", a:"#ffd166", b:"#f59e0b" }
  ];

  const $ = id => document.getElementById(id);

  const ICONS = {
    home:`<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
    search:`<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
    library:`<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
    liked:`<svg viewBox="0 0 24 24"><path d="M20.8 8.7c0 5.4-8.8 11-8.8 11S3.2 14.1 3.2 8.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z"/></svg>`,
    playlist:`<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M4 12h11"/><path d="M4 18h8"/><circle cx="18" cy="16" r="3"/></svg>`,
    admin:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a7.8 7.8 0 0 0 .1-6l2-1.1-2-3.4-2.1 1.1a8 8 0 0 0-5.2-3V1H8.8v2.4a8 8 0 0 0-5.2 3L1.5 5.3l-2 3.4 2 1.1a7.8 7.8 0 0 0 .1 6l-2 1.1 2 3.4 2.1-1.1a8 8 0 0 0 5.2 3V23h3.9v-2.4a8 8 0 0 0 5.2-3l2.1 1.1 2-3.4-2-1.1Z"/></svg>`
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  /* =======================================================
     THEMES
  ======================================================= */

  function applyTheme(theme) {
    if (!THEMES.some(t => t.id === theme)) theme = "liquid";

    document.body.dataset.sjTheme = theme;

    localStorage.setItem("swaraj-theme", theme);

    document.querySelectorAll(".sj-theme-button").forEach(button => {
      button.classList.toggle("active", button.dataset.theme === theme);
    });
  }

  function createThemePanel() {
    if ($("sjThemePanel")) return;

    const panel = document.createElement("div");
    panel.id = "sjThemePanel";
    panel.className = "sj-theme-panel";

    panel.innerHTML = `
      <h3 class="sj-theme-title">Choose Your Theme</h3>
      <div class="sj-theme-grid">
        ${THEMES.map(theme => `
          <button
            type="button"
            class="sj-theme-button"
            data-theme="${theme.id}"
            title="${theme.name}"
            style="--theme-a:${theme.a};--theme-b:${theme.b};"
          ></button>
        `).join("")}
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelectorAll(".sj-theme-button").forEach(button => {
      button.addEventListener("click", () => {
        applyTheme(button.dataset.theme);
      });
    });
  }

  function createThemeButton() {
    if ($("sjThemeToggle")) return;

    const button = document.createElement("button");

    button.id = "sjThemeToggle";
    button.type = "button";
    button.className = "sj-3d-btn";
    button.title = "Choose Theme";
    button.setAttribute("aria-label","Choose Theme");
    button.textContent = "◈ Theme";

    document.querySelector(".topbar")?.appendChild(button);

    button.addEventListener("click", () => {
      $("sjThemePanel")?.classList.toggle("open");
    });
  }

  /* =======================================================
     PROFESSIONAL ICONS
  ======================================================= */

  function improveNavigation() {
    document.querySelectorAll(".menu-item").forEach(item => {
      const page = item.dataset.page;
      if (!ICONS[page]) return;

      const span = item.querySelector("span");
      if (!span) return;

      span.classList.add("sj-nav-icon");
      span.innerHTML = ICONS[page];
    });
  }

  /* =======================================================
     SEPARATE ADMIN
  ======================================================= */

  function setupSeparateAdmin() {
    const admin = $("adminMenu");
    if (!admin) return;

    admin.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.href = "/admin.html";
    }, true);
  }

  /* =======================================================
     CATEGORY-WISE DISPLAY
  ======================================================= */

  async function loadCategories() {
    const container = $("sjCategoryContainer");
    if (!container) return;

    try {
      const response = await fetch("/api/songs", { cache:"no-store" });
      if (!response.ok) return;

      const data = await response.json();

      const songs =
        Array.isArray(data) ? data :
        Array.isArray(data.songs) ? data.songs :
        Array.isArray(data.data) ? data.data : [];

      if (!songs.length) {
        container.innerHTML = "";
        return;
      }

      renderCategories(songs);
    } catch (error) {
      console.error("SwarAJ category display:", error);
    }
  }

  function renderCategories(songs) {
    const container = $("sjCategoryContainer");
    if (!container) return;

    const groups = new Map();

    songs.forEach(song => {
      const category = String(song.category || "Music").trim() || "Music";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(song);
    });

    container.innerHTML = "";

    for (const [category, categorySongs] of groups) {
      const section = document.createElement("section");
      section.className = "sj-category-block";

      section.innerHTML = `
        <div class="sj-category-header">
          <h2 class="sj-category-title">${escapeHtml(category)}</h2>
          <span class="sj-category-count">${categorySongs.length} songs</span>
        </div>
        <div class="sj-category-scroll">
          ${categorySongs.map(song => `
            <article
              class="sj-song-card"
              data-sj-title="${escapeHtml(song.title || song.name || "")}"
              data-sj-id="${escapeHtml(song.id || "")}"
            >
              <div class="sj-card-row">
                <img
                  src="${escapeHtml(song.cover_url || song.cover || "/images/default-cover.jpg")}"
                  onerror="this.src='/images/default-cover.jpg'"
                  alt=""
                >
                <div class="sj-card-info">
                  <div class="sj-card-title">
                    ${escapeHtml(song.title || song.name || "Unknown Song")}
                  </div>
                  <div class="sj-card-artist">
                    ${escapeHtml(song.artist || "Unknown Artist")}
                  </div>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      `;

      container.appendChild(section);
    }

    container.querySelectorAll(".sj-song-card").forEach(card => {
      card.addEventListener("click", () => playExistingSong(card));
    });
  }

  function playExistingSong(card) {
    const wantedId = card.dataset.sjId;
    const wantedTitle = card.dataset.sjTitle;

    /* Prefer existing rendered song by title.
       This calls the original script.js click handler. */
    const rows = document.querySelectorAll(".song");

    for (const row of rows) {
      const title = row.querySelector(".song-name")?.textContent?.trim();

      if (title === wantedTitle) {
        row.click();
        return;
      }
    }

    /* Fallback: use existing data-play buttons and title. */
    const buttons = document.querySelectorAll("[data-play]");

    for (const button of buttons) {
      const row = button.closest(".song");
      const title = row?.querySelector(".song-name")?.textContent?.trim();

      if (title === wantedTitle) {
        button.click();
        return;
      }
    }

    console.warn("SwarAJ: category song not found in existing player", wantedId, wantedTitle);
  }

  /* =======================================================
     COMMON VIDEO SCREEN
     The existing youtubeFrame remains the only YouTube
     player. We only style it as the common screen.
  ======================================================= */

  function setupCommonVideoScreen() {
    const frame = $("youtubeFrame");
    if (!frame) return;

    let close = $("sjVideoClose");

    if (!close) {
      close = document.createElement("button");
      close.id = "sjVideoClose";
      close.type = "button";
      close.textContent = "×";
      close.title = "Close video";
      close.setAttribute("aria-label","Close video");

      close.style.cssText = `
        position:absolute;
        right:12px;
        top:10px;
        z-index:20;
        width:40px;
        height:40px;
        border-radius:50%;
        border:1px solid rgba(255,255,255,.2);
        background:rgba(0,0,0,.62);
        color:#fff;
        font-size:25px;
        cursor:pointer;
        backdrop-filter:blur(10px);
      `;

      frame.appendChild(close);
    }

    close.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      /*
       * Hide only the common screen.
       * Do not stop playback, preserving existing playback logic.
       */
      frame.classList.add("hidden-video");
    });
  }

  /* =======================================================
     MEDIA SESSION / LOCK SCREEN
  ======================================================= */

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;

    const audio = $("audioPlayer");
    const play = $("playBtn");
    const next = $("nextBtn");
    const prev = $("prevBtn");

    if (!audio) return;

    function updateMetadata() {
      const title =
        $("playerTitle")?.textContent?.trim() || "SwarAJ";

      const artist =
        $("playerArtist")?.textContent?.trim() || "Music";

      const cover =
        $("playerCover")?.src || "";

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album:"SwarAJ Music",
          artwork: cover ? [
            { src:cover, sizes:"512x512", type:"image/jpeg" }
          ] : []
        });
      } catch (_) {}
    }

    function clickButton(button) {
      if (button) button.click();
    }

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        /*
         * Use the existing Play button so both MP3 and YouTube
         * continue through the original player logic.
         */
        clickButton(play);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("pause", () => {
        clickButton(play);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        clickButton(next);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        clickButton(prev);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("seekbackward", details => {
        const amount = details.seekOffset || 10;
        audio.currentTime = Math.max(0, audio.currentTime - amount);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("seekforward", details => {
        const amount = details.seekOffset || 10;
        audio.currentTime = Math.min(
          audio.duration || Infinity,
          audio.currentTime + amount
        );
      });
    } catch (_) {}

    audio.addEventListener("play", () => {
      try {
        navigator.mediaSession.playbackState = "playing";
      } catch (_) {}
      updateMetadata();
    });

    audio.addEventListener("pause", () => {
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch (_) {}
      updateMetadata();
    });

    audio.addEventListener("loadedmetadata", updateMetadata);
    audio.addEventListener("loadeddata", updateMetadata);

    const title = $("playerTitle");
    const artist = $("playerArtist");
    const cover = $("playerCover");

    if (title || artist || cover) {
      const observer = new MutationObserver(updateMetadata);

      [title, artist, cover].forEach(element => {
        if (element) observer.observe(element, {
          childList:true,
          subtree:true,
          attributes:true
        });
      });
    }

    /*
     * Deliberately NO visibilitychange pause handler.
     * Switching apps/minimizing/screen locking therefore does
     * not intentionally pause the existing audio element.
     */
  }

  /* =======================================================
     EXISTING BUTTONS -> 3D LIQUID
  ======================================================= */

  function styleExistingControls() {
    document.querySelectorAll(
      ".primary-btn, .play-btn, .control-buttons button, .icon-btn"
    ).forEach(button => {
      button.classList.add("sj-player-button");
    });
  }

  /* =======================================================
     INIT
  ======================================================= */

  function init() {
    applyTheme(
      localStorage.getItem("swaraj-theme") || "liquid"
    );

    createThemePanel();
    createThemeButton();
    improveNavigation();
    setupSeparateAdmin();
    setupCommonVideoScreen();
    setupMediaSession();
    styleExistingControls();

    /*
     * Existing script.js remains responsible for loading/rendering
     * its normal song list. We only create category views from the API.
     */
    setTimeout(loadCategories, 1500);

    /*
     * Refresh category grouping after an admin adds a song or
     * the user presses the existing refresh button.
     */
    $("refreshBtn")?.addEventListener("click", () => {
      setTimeout(loadCategories, 700);
    });

    /*
     * Give the existing renderer time to update, then refresh
     * category cards without touching its logic.
     */
    setInterval(loadCategories, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }

  window.SwarAJEnhancements = {
    applyTheme,
    loadCategories
  };

})();
