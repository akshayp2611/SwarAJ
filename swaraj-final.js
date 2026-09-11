(() => {
  "use strict";

  const THEMES = [
    [
      "liquid-glass",
      "Liquid Glass",
      "#8b5cf6",
      "#06b6d4"
    ],
    [
      "deep-3d",
      "Deep 3D",
      "#475569",
      "#cbd5e1"
    ],
    [
      "neon-3d",
      "Neon 3D",
      "#00f5ff",
      "#ff00d4"
    ],
    [
      "aurora-liquid",
      "Aurora Liquid",
      "#22c55e",
      "#8b5cf6"
    ],
    [
      "galaxy-6d",
      "Galaxy 6D",
      "#7c3aed",
      "#38bdf8"
    ],
    [
      "premium-gold",
      "Premium Gold",
      "#f59e0b",
      "#fde68a"
    ],
    [
      "ocean-liquid",
      "Ocean Liquid",
      "#06b6d4",
      "#2563eb"
    ],
    [
      "purple-crystal",
      "Purple Crystal",
      "#a855f7",
      "#e879f9"
    ],
    [
      "red-pulse",
      "Red Pulse",
      "#ef4444",
      "#fb7185"
    ],
    [
      "minimal-dark",
      "Minimal Dark",
      "#64748b",
      "#94a3b8"
    ]
  ];


  const $ =
    id =>
      document.getElementById(id);


  function escapeHtml(value) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      char =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[char]
    );

  }


  function toast(message) {

    const element =
      $("sjToast");

    if (!element) {
      return;
    }

    element.textContent =
      message;

    element.classList.add(
      "show"
    );

    clearTimeout(
      window.__sjThemeToast
    );

    window.__sjThemeToast =
      setTimeout(
        () => {
          element.classList.remove(
            "show"
          );
        },
        1800
      );

  }


  /* =====================================================
     THEMES
  ===================================================== */

  function buildThemes() {

    const grid =
      $("sjThemeGrid");

    if (!grid) {
      return;
    }


    grid.innerHTML =
      THEMES.map(
        theme =>
          `
          <button
            class="sj-theme-card"
            data-theme="${theme[0]}"
            type="button"
            style="
              --theme-a:${theme[2]};
              --theme-b:${theme[3]};
            "
          >

            <span
              class="sj-theme-preview"
            ></span>

            <b>
              ${escapeHtml(
                theme[1]
              )}
            </b>

            <small>
              3D · Liquid
            </small>

          </button>
          `
      ).join("");


    grid
      .querySelectorAll(
        "[data-theme]"
      )
      .forEach(
        button => {

          button.onclick =
            event => {

              event.preventDefault();

              event.stopPropagation();

              applyTheme(
                button.dataset
                  .theme
              );

            };

        }
      );

  }


  function applyTheme(
    theme
  ) {

    const valid =
      THEMES.some(
        item =>
          item[0] === theme
      );


    if (!valid) {
      theme =
        "liquid-glass";
    }


    document.body.dataset
      .sjTheme =
      theme;


    localStorage.setItem(
      "swaraj-theme",
      theme
    );


    document
      .querySelectorAll(
        ".sj-theme-card"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "active",
            button.dataset
              .theme === theme
          );

        }
      );


    const selected =
      THEMES.find(
        item =>
          item[0] === theme
      );


    if (selected) {

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

  }


  function setupThemes() {

    buildThemes();


    const saved =
      localStorage.getItem(
        "swaraj-theme"
      ) ||
      "liquid-glass";


    applyTheme(
      saved
    );


    $("sjThemeToggle")
      ?.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();

          $("sjThemePanel")
            ?.classList.toggle(
              "open"
            );

        }
      );


    $("sjThemeClose")
      ?.addEventListener(
        "click",
        event => {

          event.preventDefault();

          $("sjThemePanel")
            ?.classList.remove(
              "open"
            );

        }
      );


    document.addEventListener(
      "click",
      event => {

        const panel =
          $("sjThemePanel");

        const button =
          $("sjThemeToggle");


        if (
          panel &&
          panel.classList.contains(
            "open"
          ) &&
          !panel.contains(
            event.target
          ) &&
          !button?.contains(
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


  /* =====================================================
     REMOVE ADMIN FROM MAIN PAGE
  ===================================================== */

  function hideAdmin() {

    document
      .querySelectorAll(
        "#adminMenu," +
        "[data-admin]," +
        ".admin-menu," +
        ".admin-link," +
        ".admin-button," +
        ".admin-icon"
      )
      .forEach(
        element =>
          element.remove()
      );

  }


  /* =====================================================
     VIDEO
  ===================================================== */

  function setupVideo() {

    $("sjVideoClose")
      ?.addEventListener(
        "click",
        () => {

          $("sjCommonVideo")
            ?.classList.remove(
              "open"
            );

          $("youtubeFrame")
            ?.classList.add(
              "hidden-video"
            );

        }
      );

  }


  function init() {

    hideAdmin();

    setupThemes();

    setupVideo();

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