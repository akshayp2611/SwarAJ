(() => {
  "use strict";

  /* =========================================================
     SWARAJ THEMES
     ========================================================= */

  const THEMES = [
    ["liquid", "Liquid Glass", "#8b5cf6", "#06b6d4"],
    ["deep-3d", "Deep 3D", "#475569", "#cbd5e1"],
    ["neon-3d", "Neon 3D", "#00f5ff", "#ff00d4"],
    ["aurora-liquid", "Aurora Liquid", "#22c55e", "#8b5cf6"],
    ["galaxy-6d", "Galaxy 6D", "#7c3aed", "#38bdf8"],
    ["premium-gold", "Premium Gold", "#f59e0b", "#fde68a"],
    ["ocean-liquid", "Ocean Liquid", "#06b6d4", "#2563eb"],
    ["purple-crystal", "Purple Crystal", "#a855f7", "#e879f9"],
    ["red-pulse", "Red Pulse", "#ef4444", "#fb7185"],
    ["minimal-dark", "Minimal Dark", "#64748b", "#94a3b8"]
  ];

  const $ = (id) =>
    document.getElementById(id);

  /* =========================================================
     THEMES
     ========================================================= */

  function buildThemes() {
    const grid =
      $("themeGrid");

    if (!grid) return;

    grid.innerHTML =
      THEMES.map(theme => `
        <button
          class="theme-choice"
          type="button"
          data-theme="${theme[0]}"
          style="
            --theme-a:${theme[2]};
            --theme-b:${theme[3]};
          "
        >
          <span class="theme-preview"></span>

          <strong>
            ${theme[1]}
          </strong>

          <small>
            3D • Liquid • SwarAJ
          </small>
        </button>
      `).join("");

    grid
      .querySelectorAll(
        ".theme-choice"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();
            event.stopPropagation();

            applyTheme(
              button.dataset.theme
            );
          }
        );
      });
  }

  function applyTheme(theme) {

    const exists =
      THEMES.some(
        item =>
          item[0] === theme
      );

    if (!exists) {
      theme = "liquid";
    }

    const selected =
      THEMES.find(
        item =>
          item[0] === theme
      );

    document.documentElement
      .setAttribute(
        "data-swaraj-theme",
        theme
      );

    document.body
      .setAttribute(
        "data-swaraj-theme",
        theme
      );

    if (selected) {

      document.documentElement
        .style
        .setProperty(
          "--accent",
          selected[2]
        );

      document.documentElement
        .style
        .setProperty(
          "--accent2",
          selected[3]
        );

      document.documentElement
        .style
        .setProperty(
          "--sj-theme-a",
          selected[2]
        );

      document.documentElement
        .style
        .setProperty(
          "--sj-theme-b",
          selected[3]
        );
    }

    localStorage.setItem(
      "swaraj-theme",
      theme
    );

    document
      .querySelectorAll(
        ".theme-choice"
      )
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.theme ===
            theme
        );

      });
  }

  function setupThemePanel() {

    const toggle =
      $("themeToggle");

    const panel =
      $("themePanel");

    const close =
      $("themeClose");

    if (!toggle || !panel) {
      return;
    }

    toggle.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        panel.classList.toggle(
          "open"
        );
      }
    );

    close?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        panel.classList.remove(
          "open"
        );
      }
    );

    panel.addEventListener(
      "click",
      event => {
        event.stopPropagation();
      }
    );

    document.addEventListener(
      "click",
      event => {

        if (
          panel.classList.contains(
            "open"
          ) &&
          !panel.contains(
            event.target
          ) &&
          !toggle.contains(
            event.target
          )
        ) {
          panel.classList.remove(
            "open"
          );
        }
      }
    );
  }

  /* =========================================================
     MOBILE MENU
     ========================================================= */

  function setupMobileMenu() {

    const menu =
      $("mobileMenu");

    const sidebar =
      $("sidebar");

    if (!menu || !sidebar) {
      return;
    }

    menu.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        sidebar.classList.toggle(
          "open"
        );
      }
    );
  }

  /* =========================================================
     VIDEO MODAL
     ========================================================= */

  function setupVideoClose() {

    const modal =
      $("videoModal");

    const close =
      $("videoClose");

    if (!modal) return;

    function closeVideo() {

      /*
       * IMPORTANT:
       *
       * DO NOT use:
       *
       * youtubeFrame.innerHTML = "";
       *
       * That destroys the YouTube iframe.
       *
       * We only hide the modal.
       */

      modal.classList.add(
        "hidden"
      );

      modal.classList.remove(
        "open"
      );

      const frame =
        $("youtubeFrame");

      if (frame) {
        frame.style.pointerEvents =
          "none";
      }
    }

    close?.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        closeVideo();
      }
    );

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target === modal
        ) {
          closeVideo();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape"
        ) {
          closeVideo();
        }
      }
    );
  }

  /* =========================================================
     INIT
     ========================================================= */

  function init() {

    buildThemes();

    const savedTheme =
      localStorage.getItem(
        "swaraj-theme"
      ) ||
      "liquid";

    applyTheme(
      savedTheme
    );

    setupThemePanel();

    setupMobileMenu();

    setupVideoClose();

    console.log(
      "SwarAJ themes initialized"
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();
  }

})();