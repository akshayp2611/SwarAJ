"use strict";

/* =====================================================
   SWARAJ MUSIC
   MP3 + YOUTUBE
   ONE PLAYLIST
   AUDIO FIRST / VIDEO ON WATCH
   ===================================================== */

const state = {
  songs: [],
  playlist: [],
  currentIndex: -1,
  liked: JSON.parse(localStorage.getItem("swaraj-liked") || "[]"),
  adminUnlocked: false,
  youtubePlaying: false,
  videoVisible: false
};

const audio = document.getElementById("audioPlayer");

const els = {
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("menuOverlay"),
  mobileMenu: document.getElementById("mobileMenu"),
  closeMenu: document.getElementById("closeMenu"),

  searchInput: document.getElementById("searchInput"),

  songsList: document.getElementById("songsList"),
  categories: document.getElementById("categories"),

  searchResults: document.getElementById("searchResults"),
  librarySongs: document.getElementById("librarySongs"),
  likedSongs: document.getElementById("likedSongs"),
  playlistSongs: document.getElementById("playlistSongs"),

  playerCover: document.getElementById("playerCover"),
  playerTitle: document.getElementById("playerTitle"),
  playerArtist: document.getElementById("playerArtist"),

  playBtn: document.getElementById("playBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),

  progressBar: document.getElementById("progressBar"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),

  watchVideoBtn: document.getElementById("watchVideoBtn"),
  videoContainer: document.getElementById("videoContainer"),
  youtubeFrame: document.getElementById("youtubeFrame"),
  videoTitle: document.getElementById("videoTitle"),
  hideVideoBtn: document.getElementById("hideVideoBtn"),

  muteBtn: document.getElementById("muteBtn"),

  adminKey: document.getElementById("adminKey"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminLock: document.getElementById("adminLock"),
  adminPanel: document.getElementById("adminPanel"),
  adminMessage: document.getElementById("adminMessage"),

  uploadTitle: document.getElementById("uploadTitle"),
  uploadArtist: document.getElementById("uploadArtist"),
  uploadCategory: document.getElementById("uploadCategory"),
  uploadMp3Url: document.getElementById("uploadMp3Url"),
  uploadYoutubeUrl: document.getElementById("uploadYoutubeUrl"),
  uploadCover: document.getElementById("uploadCover"),
  uploadBtn: document.getElementById("uploadBtn"),
  uploadMessage: document.getElementById("uploadMessage")
};


/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatTime(seconds) {

  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}


function youtubeId(url) {

  if (!url) return null;

  try {

    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.substring(1).split("/")[0];
    }

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {

      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v");
      }

      const parts = parsed.pathname.split("/");

      const index = parts.indexOf("embed");

      if (index !== -1 && parts[index + 1]) {
        return parts[index + 1];
      }

      const shorts = parts.indexOf("shorts");

      if (shorts !== -1 && parts[shorts + 1]) {
        return parts[shorts + 1];
      }
    }

  } catch (error) {}

  return null;
}


function normalizeSong(song) {

  const youtubeUrl =
    song.youtubeUrl ||
    song.youtube_url ||
    song.youtube ||
    song.videoUrl ||
    "";

  const mp3Url =
    song.url ||
    song.mp3Url ||
    song.mp3_url ||
    song.audioUrl ||
    song.audio_url ||
    "";

  return {
    id:
      song.id ||
      `${song.title || "song"}-${Math.random()}`,

    title:
      song.title ||
      song.name ||
      "Unknown Song",

    artist:
      song.artist ||
      song.artist_name ||
      "SwarAJ",

    category:
      song.category ||
      "All Songs",

    cover:
      song.cover ||
      song.coverUrl ||
      song.image ||
      "/images/ganpati.jpg",

    url: mp3Url,

    youtubeUrl,

    youtubeId:
      youtubeId(youtubeUrl),

    type:
      youtubeUrl
        ? "youtube"
        : "mp3"
  };
}


/* =====================================================
   LOAD SONGS
===================================================== */

async function loadSongs() {

  try {

    const response =
      await fetch("/api/songs", {
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    const list =
      Array.isArray(data)
        ? data
        : (
          data.songs ||
          data.data ||
          []
        );

    state.songs =
      list.map(normalizeSong);

    state.playlist =
      [...state.songs];

    renderAll();

  } catch (error) {

    console.error(
      "Song loading error:",
      error
    );

    els.songsList.innerHTML =
      `<div class="loading">
        Unable to load songs
      </div>`;

  }
}


/* =====================================================
   RENDER
===================================================== */

function renderAll() {

  renderSongs(
    state.songs,
    els.songsList
  );

  renderCategories();

  renderPlaylist();

  renderLiked();

  renderLibrary();
}


function renderSongs(list, container) {

  if (!container) return;

  if (!list.length) {

    container.innerHTML =
      `<div class="loading">
        No songs found
      </div>`;

    return;
  }

  container.innerHTML =
    list.map((song, index) => {

      const realIndex =
        state.playlist.findIndex(
          item => item.id === song.id
        );

      return `
        <div class="song-item">

          <img
            class="song-cover"
            src="${escapeHTML(song.cover)}"
            onerror="this.style.display='none'"
            alt="">

          <div class="song-info">

            <strong>
              ${escapeHTML(song.title)}
            </strong>

            <small>
              ${escapeHTML(song.artist)}
              ${song.type === "youtube"
                ? " • YouTube"
                : " • MP3"}
            </small>

          </div>

          <button
            class="song-play"
            data-index="${realIndex >= 0 ? realIndex : index}">
            ▶
          </button>

        </div>
      `;

    }).join("");

  container
    .querySelectorAll(".song-play")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(button.dataset.index);

          playSong(index);

        }
      );

    });
}


function renderCategories() {

  if (!els.categories) return;

  const categories = [
    ...new Set(
      state.songs
        .map(song => song.category)
        .filter(Boolean)
    )
  ];

  els.categories.innerHTML =
    categories.map(category => `
      <button
        class="category-card"
        data-category="${escapeHTML(category)}">

        <strong>
          ${escapeHTML(category)}
        </strong>

      </button>
    `).join("");

  els.categories
    .querySelectorAll(".category-card")
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          const category =
            card.dataset.category;

          const filtered =
            state.songs.filter(
              song =>
                song.category === category
            );

          renderSongs(
            filtered,
            els.songsList
          );

        }
      );

    });
}


function renderPlaylist() {

  renderSongs(
    state.playlist,
    els.playlistSongs
  );
}


function renderLiked() {

  const liked =
    state.songs.filter(song =>
      state.liked.includes(
        String(song.id)
      )
    );

  renderSongs(
    liked,
    els.likedSongs
  );
}


function renderLibrary() {

  renderSongs(
    state.songs,
    els.librarySongs
  );
}


/* =====================================================
   PLAY SONG
===================================================== */

function playSong(index) {

  if (
    index < 0 ||
    index >= state.playlist.length
  ) {
    return;
  }

  const song =
    state.playlist[index];

  state.currentIndex = index;

  updatePlayer(song);

  hideVideo();

  /*
   * MP3
   */

  if (
    song.type === "mp3" &&
    song.url
  ) {

    state.youtubePlaying = false;

    audio.pause();

    audio.src = song.url;

    audio.load();

    audio.play()
      .then(() => {
        updatePlayButton(true);
      })
      .catch(error => {

        console.error(
          "MP3 playback error:",
          error
        );

        updatePlayButton(false);

      });

    return;
  }


  /*
   * YOUTUBE
   *
   * IMPORTANT:
   * Video is NOT visible initially.
   *
   * YouTube is placed into the
   * hidden player iframe.
   */

  if (
    song.type === "youtube" &&
    song.youtubeId
  ) {

    state.youtubePlaying = true;

    els.watchVideoBtn
      .classList.remove("hidden");

    /*
     * Load YouTube iframe while hidden.
     */

    const id =
      song.youtubeId;

    els.youtubeFrame.src =
      `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&enablejsapi=1&playsinline=1&rel=0`;

    /*
     * Keep video invisible.
     */

    els.videoContainer
      .classList.add("hidden");

    /*
     * YouTube iframe is still playing.
     */

    updatePlayButton(true);

  }
}


/* =====================================================
   PLAYER
===================================================== */

function updatePlayer(song) {

  els.playerTitle.textContent =
    song.title;

  els.playerArtist.textContent =
    song.artist;

  if (song.cover) {

    els.playerCover.innerHTML =
      `<img
        src="${escapeHTML(song.cover)}"
        alt=""
        onerror="this.remove()">`;

  } else {

    els.playerCover.innerHTML =
      "<span>♫</span>";

  }

  if (song.type === "youtube") {

    els.watchVideoBtn
      .classList.remove("hidden");

  } else {

    els.watchVideoBtn
      .classList.add("hidden");

  }
}


function updatePlayButton(playing) {

  els.playBtn.textContent =
    playing ? "❚❚" : "▶";
}


/* =====================================================
   PLAY / PAUSE
===================================================== */

els.playBtn.addEventListener(
  "click",
  () => {

    if (state.currentIndex < 0) {

      if (state.playlist.length) {
        playSong(0);
      }

      return;
    }

    const song =
      state.playlist[state.currentIndex];

    if (song.type === "mp3") {

      if (audio.paused) {

        audio.play()
          .then(() =>
            updatePlayButton(true)
          );

      } else {

        audio.pause();

        updatePlayButton(false);

      }

    } else {

      /*
       * Reload current YouTube song
       * when Play is clicked.
       */

      playSong(state.currentIndex);

    }

  }
);


/* =====================================================
   NEXT
===================================================== */

els.nextBtn.addEventListener(
  "click",
  () => {

    if (!state.playlist.length) {
      return;
    }

    let next =
      state.currentIndex + 1;

    if (
      next >= state.playlist.length
    ) {
      next = 0;
    }

    playSong(next);

  }
);


/* =====================================================
   PREVIOUS
===================================================== */

els.prevBtn.addEventListener(
  "click",
  () => {

    if (!state.playlist.length) {
      return;
    }

    let previous =
      state.currentIndex - 1;

    if (previous < 0) {
      previous =
        state.playlist.length - 1;
    }

    playSong(previous);

  }
);


/* =====================================================
   MP3 EVENTS
===================================================== */

audio.addEventListener(
  "play",
  () => {
    updatePlayButton(true);
  }
);

audio.addEventListener(
  "pause",
  () => {
    updatePlayButton(false);
  }
);

audio.addEventListener(
  "loadedmetadata",
  () => {

    els.duration.textContent =
      formatTime(audio.duration);

  }
);

audio.addEventListener(
  "timeupdate",
  () => {

    if (!audio.duration) {
      return;
    }

    const percentage =
      audio.currentTime /
      audio.duration *
      100;

    els.progressBar.value =
      percentage;

    els.currentTime.textContent =
      formatTime(audio.currentTime);

  }
);

audio.addEventListener(
  "ended",
  () => {

    if (state.playlist.length) {

      let next =
        state.currentIndex + 1;

      if (
        next >= state.playlist.length
      ) {
        next = 0;
      }

      playSong(next);

    }

  }
);


/* =====================================================
   PROGRESS
===================================================== */

els.progressBar.addEventListener(
  "input",
  () => {

    if (!audio.duration) {
      return;
    }

    audio.currentTime =
      Number(els.progressBar.value) /
      100 *
      audio.duration;

  }
);


/* =====================================================
   YOUTUBE VIDEO
===================================================== */

els.watchVideoBtn.addEventListener(
  "click",
  () => {

    const song =
      state.playlist[state.currentIndex];

    if (
      !song ||
      !song.youtubeId
    ) {
      return;
    }

    els.videoTitle.textContent =
      song.title;

    els.videoContainer
      .classList.remove("hidden");

    state.videoVisible = true;

  }
);


els.hideVideoBtn.addEventListener(
  "click",
  () => {

    hideVideo();

  }
);


function hideVideo() {

  els.videoContainer
    .classList.add("hidden");

  state.videoVisible = false;

  /*
   * IMPORTANT:
   * Do not stop YouTube.
   *
   * This allows the YouTube song
   * to continue as audio.
   */

}


/* =====================================================
   SEARCH
===================================================== */

els.searchInput.addEventListener(
  "input",
  () => {

    const query =
      els.searchInput.value
        .trim()
        .toLowerCase();

    if (!query) {

      renderSongs(
        state.songs,
        els.searchResults
      );

      return;
    }

    const results =
      state.songs.filter(song =>
        `${song.title} ${song.artist} ${song.category}`
          .toLowerCase()
          .includes(query)
      );

    renderSongs(
      results,
      els.searchResults
    );

  }
);


/* =====================================================
   MENU
===================================================== */

function openMenu() {

  els.sidebar.classList.add("open");

  els.overlay.classList.add("active");

}


function closeMenu() {

  els.sidebar.classList.remove("open");

  els.overlay.classList.remove("active");

}


els.mobileMenu.addEventListener(
  "click",
  openMenu
);


els.closeMenu.addEventListener(
  "click",
  closeMenu
);


els.overlay.addEventListener(
  "click",
  closeMenu
);


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active"
      );

    });

  const target =
    document.getElementById(
      `${page}Page`
    );

  if (target) {

    target.classList.add(
      "active"
    );

  }

  document
    .querySelectorAll(".menu-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });

  closeMenu();

}


window.showPage = showPage;


document
  .querySelectorAll(".menu-item")
  .forEach(item => {

    item.addEventListener(
      "click",
      () => {

        showPage(
          item.dataset.page
        );

      }
    );

  });


/* =====================================================
   ADMIN
===================================================== */

els.adminLoginBtn.addEventListener(
  "click",
  async () => {

    const key =
      els.adminKey.value.trim();

    if (!key) {

      els.adminMessage.textContent =
        "Enter admin key.";

      return;
    }

    try {

      const response =
        await fetch(
          "/api/admin/verify",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({ key })
          }
        );

      if (!response.ok) {

        throw new Error(
          "Invalid admin key"
        );

      }

      const result =
        await response.json();

      if (
        result.success ||
        result.valid ||
        result.ok
      ) {

        state.adminUnlocked = true;

        els.adminLock
          .classList.add("hidden");

        els.adminPanel
          .classList.remove("hidden");

        els.adminMessage.textContent =
          "";

      } else {

        throw new Error(
          "Invalid admin key"
        );

      }

    } catch (error) {

      /*
       * Keep the admin key protection.
       */

      els.adminMessage.textContent =
        "Invalid admin key.";

    }

  }
);


/* =====================================================
   ADMIN UPLOAD
===================================================== */

els.uploadBtn.addEventListener(
  "click",
  async () => {

    if (!state.adminUnlocked) {
      return;
    }

    const payload = {

      title:
        els.uploadTitle.value.trim(),

      artist:
        els.uploadArtist.value.trim(),

      category:
        els.uploadCategory.value.trim(),

      mp3Url:
        els.uploadMp3Url.value.trim(),

      youtubeUrl:
        els.uploadYoutubeUrl.value.trim(),

      cover:
        els.uploadCover.value.trim()

    };

    if (!payload.title) {

      els.uploadMessage.textContent =
        "Song title is required.";

      return;
    }

    if (
      !payload.mp3Url &&
      !payload.youtubeUrl
    ) {

      els.uploadMessage.textContent =
        "Add an MP3 URL or YouTube URL.";

      return;
    }

    try {

      const response =
        await fetch(
          "/api/admin/songs",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );

      const data =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          `Upload failed (${response.status})`
        );

      }

      els.uploadMessage.textContent =
        "Song added successfully.";

      els.uploadTitle.value = "";
      els.uploadArtist.value = "";
      els.uploadCategory.value = "";
      els.uploadMp3Url.value = "";
      els.uploadYoutubeUrl.value = "";
      els.uploadCover.value = "";

      await loadSongs();

    } catch (error) {

      console.error(error);

      els.uploadMessage.textContent =
        error.message ||
        "Unable to add song.";

    }

  }
);


/* =====================================================
   MUTE
===================================================== */

els.muteBtn.addEventListener(
  "click",
  () => {

    audio.muted =
      !audio.muted;

    els.muteBtn.textContent =
      audio.muted
        ? "🔇"
        : "🔊";

  }
);


/* =====================================================
   REFRESH
===================================================== */

document
  .getElementById("refreshBtn")
  .addEventListener(
    "click",
    loadSongs
  );


/* =====================================================
   SHOW ALL
===================================================== */

document
  .getElementById("showAllBtn")
  .addEventListener(
    "click",
    () => {

      renderSongs(
        state.songs,
        els.songsList
      );

    }
  );


/* =====================================================
   ESC
===================================================== */

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {

      closeMenu();

      hideVideo();

    }

  }
);


/* =====================================================
   INITIALIZE
===================================================== */

loadSongs();