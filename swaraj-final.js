(() => {

  "use strict";


  /* =====================================================
     THEMES
  ===================================================== */

  const THEMES = [

    {
      id: "liquid",
      name: "Liquid Glass",
      a: "#8b5cf6",
      b: "#06b6d4"
    },

    {
      id: "deep-3d",
      name: "Deep 3D",
      a: "#475569",
      b: "#cbd5e1"
    },

    {
      id: "neon-3d",
      name: "Neon 3D",
      a: "#00f5ff",
      b: "#ff00d4"
    },

    {
      id: "aurora-liquid",
      name: "Aurora Liquid",
      a: "#22c55e",
      b: "#8b5cf6"
    },

    {
      id: "galaxy-6d",
      name: "Galaxy 6D",
      a: "#7c3aed",
      b: "#38bdf8"
    },

    {
      id: "premium-gold",
      name: "Premium Gold",
      a: "#f59e0b",
      b: "#fde68a"
    },

    {
      id: "ocean-liquid",
      name: "Ocean Liquid",
      a: "#06b6d4",
      b: "#2563eb"
    },

    {
      id: "purple-crystal",
      name: "Purple Crystal",
      a: "#a855f7",
      b: "#e879f9"
    },

    {
      id: "red-pulse",
      name: "Red Pulse",
      a: "#ef4444",
      b: "#fb7185"
    },

    {
      id: "minimal-dark",
      name: "Minimal Dark",
      a: "#64748b",
      b: "#94a3b8"
    }

  ];


  const $ =
    id =>
      document.getElementById(id);


  /* =====================================================
     CREATE THEME BUTTONS
  ===================================================== */

  function buildThemes() {

    const grid =
      $("themeGrid");


    if (!grid) {
      return;
    }


    grid.innerHTML =
      THEMES
        .map(
          theme => `

            <button
              type="button"
              class="theme-choice"
              data-theme="${theme.id}"
              style="
                --theme-a:${theme.a};
                --theme-b:${theme.b};
              "
            >

              <span class="theme-preview"></span>

              <strong>
                ${theme.name}
              </strong>

              <small>
                3D • Liquid • SwarAJ
              </small>

            </button>

          `
        )
        .join("");


    grid
      .querySelectorAll(
        ".theme-choice"
      )
      .forEach(
        button => {

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

        }
      );

  }


  /* =====================================================
     APPLY THEME
  ===================================================== */

  function applyTheme(theme) {

    const exists =
      THEMES.some(
        item =>
          item.id === theme
      );


    if (!exists) {
      theme = "liquid";
    }


    const selected =
      THEMES.find(
        item =>
          item.id === theme
      );


    /*
     * MAIN THEME ATTRIBUTE
     */

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


    /*
     * CSS variables
     */

    if (selected) {

      document.documentElement
        .style
        .setProperty(
          "--accent",
          selected.a
        );


      document.documentElement
        .style
        .setProperty(
          "--accent2",
          selected.b
        );


      document.documentElement
        .style
        .setProperty(
          "--sj-theme-a",
          selected.a
        );


      document.documentElement
        .style
        .setProperty(
          "--sj-theme-b",
          selected.b
        );

    }


    /*
     * SAVE
     */

    localStorage.setItem(
      "swaraj-theme",
      theme
    );


    /*
     * ACTIVE BUTTON
     */

    document
      .querySelectorAll(
        ".theme-choice"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "active",
            button.dataset.theme ===
            theme
          );

        }
      );

  }


  /* =====================================================
     THEME PANEL
  ===================================================== */

  function setupThemePanel() {

    const toggle =
      $("themeToggle");


    const panel =
      $("themePanel");


    const close =
      $("themeClose");


    if (
      !toggle ||
      !panel
    ) {
      return;
    }


    toggle.addEventListener(
      "click",
      event => {

        event.preventDefault();

        event.stopPropagation();


        const open =
          panel.classList.toggle(
            "open"
          );


        panel.setAttribute(
          "aria-hidden",
          String(!open)
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


        panel.setAttribute(
          "aria-hidden",
          "true"
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
          !panel.classList.contains(
            "open"
          )
        ) {
          return;
        }


        if (
          panel.contains(
            event.target
          )
        ) {
          return;
        }


        if (
          toggle.contains(
            event.target
          )
        ) {
          return;
        }


        panel.classList.remove(
          "open"
        );


        panel.setAttribute(
          "aria-hidden",
          "true"
        );

      }
    );

  }


  /* =====================================================
     MOBILE MENU
  ===================================================== */

  function setupMobileMenu() {

    const button =
      $("mobileMenu");


    const sidebar =
      $("sidebar");


    if (
      !button ||
      !sidebar
    ) {
      return;
    }


    button.addEventListener(
      "click",
      event => {

        event.preventDefault();

        event.stopPropagation();


        sidebar.classList.toggle(
          "open"
        );

      }
    );


    document.addEventListener(
      "click",
      event => {

        if (
          !sidebar.classList.contains(
            "open"
          )
        ) {
          return;
        }


        if (
          sidebar.contains(
            event.target
          )
        ) {
          return;
        }


        if (
          button.contains(
            event.target
          )
        ) {
          return;
        }


        sidebar.classList.remove(
          "open"
        );

      }
    );

  }


  /* =====================================================
     VIDEO MODAL

     DO NOT DESTROY youtubeFrame.
  ===================================================== */

  function setupVideoModal() {

    const modal =
      $("videoModal");


    if (!modal) {
      return;
    }


    $("videoClose")
      ?.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();


          if (
            window.SwarAJPlayer
          ) {

            window.SwarAJPlayer.closeVideo();

          }

        }
      );


    modal.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          modal
        ) {

          if (
            window.SwarAJPlayer
          ) {

            window.SwarAJPlayer.closeVideo();

          }

        }

      }
    );


    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          if (
            window.SwarAJPlayer
          ) {

            window.SwarAJPlayer.closeVideo();

          }

        }

      }
    );

  }


  /* =====================================================
     INIT
  ===================================================== */

  function init() {

    buildThemes();


    const saved =
      localStorage.getItem(
        "swaraj-theme"
      ) ||
      "liquid";


    applyTheme(
      saved
    );


    setupThemePanel();

    setupMobileMenu();

    setupVideoModal();


    console.log(
      "SwarAJ theme system ready"
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  }
  else {

    init();

  }

})();