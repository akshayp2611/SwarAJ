/* =========================================================
   SwarAJ Music Player
   Complete frontend replacement

   Works with current server API:

   GET  /api/songs
   GET  /api/categories
   GET  /api/youtube

   GET  /api/admin/songs

   POST /api/admin/songs
       source_type=youtube
       OR
       source_type=mp3

   DELETE /api/admin/songs/:id

   Admin header:
       x-admin-token
========================================================= */


/* =========================================================
   STATE
========================================================= */

const state = {

  songs: [],

  current: null,

  currentIndex: -1,

  queue: [],

  queueIndex: -1,

  shuffle: false,

  repeat: 0,
  /*
    0 = off
    1 = repeat one
    2 = repeat all
  */

  favorites:
    JSON.parse(
      localStorage.getItem("swaraj-favorites") || "[]"
    ),

  youtubePlayer: null,

  youtubeReady: false,

  youtubeLoading: null,

  mode: "music",

  adminToken:
    localStorage.getItem(
      "swaraj-admin-token"
    ) || "",

  volume:
    Number(
      localStorage.getItem(
        "swaraj-volume"
      )
    ) || 0.8
};


/* =========================================================
   DOM
========================================================= */

const $ = selector =>
  document.querySelector(selector);

const audio =
  $("#audio");


const E = {

  sidebar: $("#sidebar"),

  menu: $("#menu"),

  search: $("#search"),

  clear: $("#clear"),

  refresh: $("#refresh"),

  playAll: $("#playAll"),

  shuffleAll: $("#shuffleAll"),

  count: $("#count"),

  ytCount: $("#ytCount"),

  mp3Count: $("#mp3Count"),

  catCount: $("#catCount"),

  categories: $("#categories"),

  sideCategories:
    $("#sideCategories"),

  homeSongs:
    $("#homeSongs"),

  musicSongs:
    $("#musicSongs"),

  youtubeSongs:
    $("#youtubeSongs"),

  videoSongs:
    $("#videoSongs"),

  librarySongs:
    $("#librarySongs"),

  favoriteSongs:
    $("#favoriteSongs"),

  results:
    $("#results"),

  searchResults:
    $("#searchResults"),

  resultTitle:
    $("#resultTitle"),

  /* player */

  playerShell:
    $("#playerShell"),

  cover:
    $("#cover"),

  title:
    $("#title"),

  artist:
    $("#artist"),

  miniSource:
    $("#miniSource"),

  like:
    $("#like"),

  prev:
    $("#prev"),

  play:
    $("#play"),

  next:
    $("#next"),

  expand:
    $("#expand"),

  fullPlayer:
    $("#fullPlayer"),

  fullCover:
    $("#fullCover"),

  fullTitle:
    $("#fullTitle"),

  fullArtist:
    $("#fullArtist"),

  musicMode:
    $("#musicMode"),

  videoMode:
    $("#videoMode"),

  sourceBadge:
    $("#sourceBadge"),

  videoWrap:
    $("#ytPlayerWrap"),

  ytPlayer:
    $("#ytPlayer"),

  fullPrev:
    $("#fullPrev"),

  fullPlay:
    $("#fullPlay"),

  fullNext:
    $("#fullNext"),

  shuffle:
    $("#shuffle"),

  repeat:
    $("#repeat"),

  seek:
    $("#seek"),

  cur:
    $("#cur"),

  dur:
    $("#dur"),

  volume:
    $("#volume"),

  queue:
    $("#queue"),

  clearQueue:
    $("#clearQueue"),

  toast:
    $("#toast"),

  /* admin */

  adminToken:
    $("#adminToken"),

  saveToken:
    $("#saveToken"),

  adminStatus:
    $("#adminStatus"),

  ytForm:
    $("#ytForm"),

  mp3Form:
    $("#mp3Form"),

  adminSongs:
    $("#adminSongs"),

  adminRefresh:
    $("#adminRefresh")
};


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function toast(message) {

  if (!E.toast) return;

  E.toast.textContent =
    message || "Done";

  E.toast.classList.add("show");

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(() => {

      E.toast.classList.remove(
        "show"
      );

    }, 3000);
}


function formatTime(seconds) {

  seconds =
    Number(seconds) || 0;

  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes =
    Math.floor(seconds / 60);

  const secs =
    Math.floor(seconds % 60);

  return `${minutes}:${String(
    secs
  ).padStart(2, "0")}`;
}


function isYouTube(song) {

  return (
    song?.source_type === "youtube" ||
    Boolean(
      song?.youtube_id ||
      song?.youtube_video_id
    )
  );
}


function getYouTubeId(song) {

  return (
    song?.youtube_id ||
    song?.youtube_video_id ||
    extractYouTubeId(
      song?.youtube_url
    ) ||
    null
  );
}


function extractYouTubeId(value) {

  if (!value) return null;

  const text =
    String(value).trim();

  /*
   * Direct 11 character ID
   */

  if (
    /^[A-Za-z0-9_-]{11}$/.test(
      text
    )
  ) {
    return text;
  }

  try {

    const url =
      new URL(text);

    const host =
      url.hostname.toLowerCase();

    /*
     * youtu.be
     */

    if (
      host === "youtu.be"
    ) {

      return (
        url.pathname
          .split("/")
          .filter(Boolean)[0] ||
        null
      );
    }

    /*
     * youtube.com
     */

    if (
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    ) {

      const v =
        url.searchParams.get("v");

      if (v) return v;

      const parts =
        url.pathname
          .split("/")
          .filter(Boolean);

      const index =
        parts.findIndex(
          part =>
            [
              "embed",
              "shorts",
              "live"
            ].includes(part)
        );

      if (index >= 0) {

        return (
          parts[index + 1] ||
          null
        );
      }
    }

  } catch (_) {

    return null;
  }

  return null;
}


function imageFor(song) {

  return (
    song?.cover_url ||
    `/api/cover/${encodeURIComponent(
      song?.category ||
      "All Songs"
    )}`
  );
}


function isFavorite(song) {

  if (!song) return false;

  const id =
    String(song.id);

  return state.favorites
    .map(String)
    .includes(id);
}


function saveFavorites() {

  localStorage.setItem(
    "swaraj-favorites",
    JSON.stringify(
      state.favorites
    )
  );
}


function toggleFavorite(song) {

  if (!song) return;

  const id =
    String(song.id);

  const index =
    state.favorites
      .map(String)
      .indexOf(id);

  if (index === -1) {

    state.favorites.push(id);

    toast(
      "Added to Liked Songs"
    );

  } else {

    state.favorites.splice(
      index,
      1
    );

    toast(
      "Removed from Liked Songs"
    );
  }

  saveFavorites();

  updatePlayerInfo(
    state.current
  );

  renderAll();
}


async function api(
  url,
  options = {}
) {

  const response =
    await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options
    });

  const text =
    await response.text();

  let data = {};

  try {

    data =
      text
        ? JSON.parse(text)
        : {};

  } catch (_) {

    data = {
      error: text
    };
  }

  if (
    !response.ok ||
    data.success === false
  ) {

    throw new Error(
      data.error ||
      data.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}


/* =========================================================
   LOAD DATABASE
========================================================= */

async function loadSongs() {

  try {

    const [
      songsData,
      categoriesData
    ] = await Promise.all([

      api("/api/songs"),

      api("/api/categories")

    ]);

    state.songs =
      Array.isArray(
        songsData.songs
      )
        ? songsData.songs
        : [];

    const categories =
      Array.isArray(
        categoriesData.categories
      )
        ? categoriesData.categories
        : [];

    updateStats();

    renderCategories(
      categories
    );

    renderSideCategories(
      categories
    );

    renderAll();

    /*
     * Keep current queue in sync
     * with latest database.
     */

    if (
      state.queue.length
    ) {

      const ids =
        new Set(
          state.songs.map(
            song =>
              String(song.id)
          )
        );

      state.queue =
        state.queue.filter(
          song =>
            ids.has(
              String(song.id)
            )
        );

      if (
        state.queueIndex >=
        state.queue.length
      ) {

        state.queueIndex =
          state.queue.length - 1;
      }

      renderQueue();
    }

  } catch (error) {

    console.error(
      "LOAD ERROR:",
      error
    );

    toast(
      error.message ||
      "Unable to load songs"
    );

    [
      "homeSongs",
      "musicSongs",
      "youtubeSongs",
      "videoSongs",
      "librarySongs",
      "favoriteSongs"
    ].forEach(id => {

      const el =
        document.getElementById(id);

      if (!el) return;

      el.innerHTML = `
        <div class="glass-card"
             style="padding:20px;border-radius:18px">
          Unable to load songs.
          <br>
          <small>
            ${escapeHTML(
              error.message
            )}
          </small>
        </div>
      `;

    });
  }
}


function updateStats() {

  const youtubeCount =
    state.songs.filter(
      isYouTube
    ).length;

  const mp3Count =
    state.songs.filter(
      song =>
        !isYouTube(song)
    ).length;

  if (E.count)
    E.count.textContent =
      state.songs.length;

  if (E.ytCount)
    E.ytCount.textContent =
      youtubeCount;

  if (E.mp3Count)
    E.mp3Count.textContent =
      mp3Count;

  /*
   * Categories from current songs
   */

  const categories =
    new Set(
      state.songs
        .map(
          song =>
            song.category ||
            "Other"
        )
    );

  if (E.catCount)
    E.catCount.textContent =
      categories.size;
}


/* =========================================================
   CATEGORIES
========================================================= */

function categorySymbol(
  category
) {

  const value =
    String(category || "")
      .toLowerCase();

  if (
    value.includes("love")
  )
    return "♥";

  if (
    value.includes("bhakti") ||
    value.includes("ganpati")
  )
    return "ॐ";

  if (
    value.includes("marathi")
  )
    return "म";

  if (
    value.includes("energy") ||
    value.includes("energetic")
  )
    return "⚡";

  if (
    value.includes("emotional")
  )
    return "◒";

  return "♫";
}


function renderCategories(
  categories
) {

  if (!E.categories)
    return;

  if (!categories.length) {

    E.categories.innerHTML = `
      <div class="glass-card"
           style="padding:20px;border-radius:18px">
        No categories yet.
      </div>
    `;

    return;
  }

  E.categories.innerHTML =
    categories
      .map(category => {

        const name =
          category.name ||
          "Other";

        return `
          <article
            class="category"
            data-category="${escapeHTML(
              name
            )}"
          >

            <div class="symbol">
              ${categorySymbol(name)}
            </div>

            <h3>
              ${escapeHTML(name)}
            </h3>

            <p>
              ${Number(
                category.count || 0
              )} songs
              ·
              ${Number(
                category.youtube || 0
              )} YouTube
            </p>

          </article>
        `;

      })
      .join("");

  E.categories
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          filterCategory(
            card.dataset.category
          );

        }
      );

    });
}


function renderSideCategories(
  categories
) {

  if (!E.sideCategories)
    return;

  E.sideCategories.innerHTML =
    categories
      .map(category => {

        return `
          <button
            type="button"
            data-category="${escapeHTML(
              category.name
            )}"
          >
            ${escapeHTML(
              category.name
            )}
            <small>
              ${Number(
                category.count || 0
              )}
            </small>
          </button>
        `;

      })
      .join("");

  E.sideCategories
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          filterCategory(
            button.dataset.category
          );

          closeMobileMenu();

        }
      );

    });
}


function filterCategory(
  category
) {

  showView("music");

  const songs =
    state.songs.filter(
      song =>
        String(
          song.category || ""
        ).toLowerCase() ===
        String(category)
          .toLowerCase()
    );

  renderSongGrid(
    E.musicSongs,
    songs
  );

  toast(
    `${category}: ${songs.length} songs`
  );
}


/* =========================================================
   SONG CARDS
========================================================= */

function createSongCard(
  song
) {

  const youtube =
    isYouTube(song);

  const videoId =
    getYouTubeId(song);

  return `
    <article
      class="song-card ${
        youtube
          ? "youtube-card"
          : ""
      }"
    >

      <div class="song-art">

        <img
          src="${escapeHTML(
            imageFor(song)
          )}"
          alt=""
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='/images/ganpati.jpg';
          "
        >

        <span class="song-source">
          ${
            youtube
              ? "▶ YOUTUBE"
              : "♫ MP3"
          }
        </span>

      </div>

      <div class="song-body">

        <h3>
          ${escapeHTML(
            song.title ||
            "Untitled"
          )}
        </h3>

        <p>
          ${escapeHTML(
            song.artist ||
            "SwarAJ"
          )}
          ·
          ${escapeHTML(
            song.category ||
            "Other"
          )}
        </p>

        <div class="song-actions">

          <button
            type="button"
            class="play-song"
            data-play="${escapeHTML(
              song.id
            )}"
          >
            ▶ Play
          </button>

          ${
            youtube && videoId
              ? `
                <button
                  type="button"
                  class="video-action"
                  data-video="${escapeHTML(
                    song.id
                  )}"
                  title="Watch video"
                >
                  🎬
                </button>
              `
              : ""
          }

          <button
            type="button"
            data-like="${escapeHTML(
              song.id
            )}"
            title="Like"
          >
            ${
              isFavorite(song)
                ? "♥"
                : "♡"
            }
          </button>

        </div>

      </div>

    </article>
  `;
}


function renderSongGrid(
  element,
  songs
) {

  if (!element)
    return;

  if (!songs.length) {

    element.innerHTML = `
      <div
        class="glass-card"
        style="
          padding:20px;
          border-radius:18px;
        "
      >
        No songs found.
      </div>
    `;

    return;
  }

  element.innerHTML =
    songs
      .map(createSongCard)
      .join("");

  /*
   * Play
   */

  element
    .querySelectorAll(
      "[data-play]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          playById(
            button.dataset.play
          );

        }
      );

    });


  /*
   * Like
   */

  element
    .querySelectorAll(
      "[data-like]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const song =
            findSong(
              button.dataset.like
            );

          if (song)
            toggleFavorite(song);

        }
      );

    });


  /*
   * Video
   */

  element
    .querySelectorAll(
      "[data-video]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const song =
            findSong(
              button.dataset.video
            );

          if (!song)
            return;

          playById(
            song.id
          );

          setMode("video");

        }
      );

    });
}


function renderVideoGrid() {

  if (!E.videoSongs)
    return;

  /*
   * Current backend stores YouTube
   * songs as source_type=youtube.
   */

  const videos =
    state.songs.filter(
      song =>
        isYouTube(song)
    );

  if (!videos.length) {

    E.videoSongs.innerHTML = `
      <div
        class="glass-card"
        style="
          padding:20px;
          border-radius:18px;
        "
      >
        No video songs available.
      </div>
    `;

    return;
  }

  E.videoSongs.innerHTML =
    videos.map(song => {

      const id =
        getYouTubeId(song);

      const thumbnail =
        id
          ? `https://i.ytimg.com/vi/${encodeURIComponent(
              id
            )}/hqdefault.jpg`
          : imageFor(song);

      return `
        <article class="video-card">

          <div class="video-thumbnail">

            <img
              src="${escapeHTML(
                thumbnail
              )}"
              alt=""
              loading="lazy"
              onerror="
                this.onerror=null;
                this.src='/images/ganpati.jpg';
              "
            >

            <button
              class="video-play"
              type="button"
              data-video-play="${escapeHTML(
                song.id
              )}"
            >
              ▶
            </button>

          </div>

          <div class="video-info">

            <h3>
              ${escapeHTML(
                song.title ||
                "Untitled"
              )}
            </h3>

            <p>
              ${escapeHTML(
                song.artist ||
                "SwarAJ"
              )}
            </p>

          </div>

        </article>
      `;

    }).join("");

  E.videoSongs
    .querySelectorAll(
      "[data-video-play]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const song =
            findSong(
              button.dataset.videoPlay
            );

          if (!song)
            return;

          playById(song.id);

          setMode("video");

        }
      );

    });
}


/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderSongGrid(
    E.homeSongs,
    state.songs.slice(0, 24)
  );

  /*
   * IMPORTANT:
   * Audio tab includes BOTH:
   *
   * MP3
   * YouTube audio
   *
   * YouTube video remains hidden
   * while Audio mode is selected.
   */

  renderSongGrid(
    E.musicSongs,
    state.songs
  );

  renderSongGrid(
    E.youtubeSongs,
    state.songs.filter(
      isYouTube
    )
  );

  renderVideoGrid();

  renderSongGrid(
    E.librarySongs,
    state.songs
  );

  renderSongGrid(
    E.favoriteSongs,
    state.songs.filter(
      isFavorite
    )
  );

  renderQueue();
}


/* =========================================================
   SEARCH
========================================================= */

function searchSongs(
  query
) {

  const q =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!q) {

    E.searchResults.hidden =
      true;

    return;
  }

  const results =
    state.songs.filter(
      song =>
        [
          song.title,
          song.artist,
          song.album,
          song.category,
          song.language
        ]
          .some(
            value =>
              String(
                value || ""
              )
              .toLowerCase()
              .includes(q)
          )
    );

  E.searchResults.hidden =
    false;

  E.resultTitle.textContent =
    `${results.length} result${
      results.length === 1
        ? ""
        : "s"
    } for "${query}"`;

  renderSongGrid(
    E.results,
    results
  );
}


/* =========================================================
   VIEWS
========================================================= */

function showView(
  view
) {

  document
    .querySelectorAll(".view")
    .forEach(section => {

      section.hidden =
        true;

    });

  const target =
    document.getElementById(
      `${view}View`
    );

  if (target)
    target.hidden = false;

  document
    .querySelectorAll(".nav")
    .forEach(nav => {

      nav.classList.toggle(
        "active",
        nav.dataset.view === view
      );

    });

  state.view =
    view;

  if (view === "admin") {

    loadAdminSongs();

  }

  if (view === "video") {

    renderVideoGrid();

  }

  closeMobileMenu();
}


/* =========================================================
   FIND SONG
========================================================= */

function findSong(id) {

  return state.songs.find(
    song =>
      String(song.id) ===
      String(id)
  );
}


/* =========================================================
   PLAY ALL
========================================================= */

function playAll() {

  if (!state.songs.length) {

    toast(
      "No songs available"
    );

    return;
  }

  /*
   * Entire database becomes queue.
   */

  state.queue =
    [...state.songs];

  state.queueIndex =
    0;

  state.current =
    state.queue[0];

  state.currentIndex =
    state.songs.findIndex(
      song =>
        String(song.id) ===
        String(
          state.current.id
        )
    );

  playCurrent();

  renderQueue();

  toast(
    `Playing all ${state.queue.length} songs`
  );
}


/* =========================================================
   PLAY BY ID
========================================================= */

function playById(id) {

  const song =
    findSong(id);

  if (!song)
    return;

  state.current =
    song;

  state.currentIndex =
    state.songs.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  /*
   * If queue doesn't exist,
   * create entire database queue.
   */

  if (!state.queue.length) {

    state.queue =
      [...state.songs];

  }

  /*
   * If queue exists but song
   * isn't inside it, append it.
   */

  let queueIndex =
    state.queue.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  if (queueIndex === -1) {

    state.queue.push(song);

    queueIndex =
      state.queue.length - 1;
  }

  state.queueIndex =
    queueIndex;

  playCurrent();

  renderQueue();
}


/* =========================================================
   PLAY CURRENT
========================================================= */

function playCurrent() {

  const song =
    state.current;

  if (!song)
    return;

  updatePlayerInfo(
    song
  );

  if (isYouTube(song)) {

    playYouTube(
      song
    );

  } else {

    playMP3(
      song
    );
  }

  renderQueue();
}


/* =========================================================
   PLAYER INFO
========================================================= */

function updatePlayerInfo(
  song
) {

  if (!song)
    return;

  const title =
    song.title ||
    "Untitled";

  const artist =
    song.artist ||
    "SwarAJ";

  const cover =
    imageFor(song);

  const source =
    isYouTube(song)
      ? "YOUTUBE"
      : "MP3";

  E.title.textContent =
    title;

  E.artist.textContent =
    artist;

  E.miniSource.textContent =
    source;

  E.fullTitle.textContent =
    title;

  E.fullArtist.textContent =
    artist;

  E.sourceBadge.textContent =
    source;

  E.cover.src =
    cover;

  E.fullCover.src =
    cover;

  E.like.textContent =
    isFavorite(song)
      ? "♥"
      : "♡";

  document.title =
    `${title} — स्वरAJ`;
}


/* =========================================================
   AUDIO PLAYER
========================================================= */

function playMP3(
  song
) {

  stopYouTube();

  const url =
    song.audio_url ||
    song.url;

  if (!url) {

    toast(
      "No MP3 URL available for this song."
    );

    return;
  }

  audio.pause();

  audio.removeAttribute(
    "src"
  );

  audio.load();

  audio.src =
    url;

  audio.volume =
    state.volume;

  /*
   * User click already initiated
   * playback, so browser autoplay
   * restrictions normally allow this.
   */

  const playPromise =
    audio.play();

  if (
    playPromise &&
    typeof playPromise.catch ===
      "function"
  ) {

    playPromise.catch(
      error => {

        console.error(
          "MP3 PLAY ERROR:",
          error
        );

        toast(
          "MP3 could not start. Tap Play again."
        );

        setPlaying(
          false
        );

      }
    );

  }

  setMode("music");

  E.videoMode.hidden =
    true;

  setPlaying(
    true
  );
}


/* =========================================================
   YOUTUBE API
========================================================= */

function ensureYouTubeAPI() {

  if (
    window.YT &&
    window.YT.Player
  ) {

    state.youtubeReady =
      true;

    return Promise.resolve();
  }

  if (
    state.youtubeLoading
  ) {

    return state.youtubeLoading;
  }

  state.youtubeLoading =
    new Promise(resolve => {

      const oldCallback =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady =
        () => {

          state.youtubeReady =
            true;

          if (
            typeof oldCallback ===
            "function"
          ) {

            try {
              oldCallback();
            } catch (_) {}

          }

          resolve();

        };

      const existing =
        document.getElementById(
          "youtube-iframe-api"
        );

      if (existing)
        return;

      const script =
        document.createElement(
          "script"
        );

      script.id =
        "youtube-iframe-api";

      script.src =
        "https://www.youtube.com/iframe_api";

      script.async =
        true;

      document.head.appendChild(
        script
      );

    });

  return state.youtubeLoading;
}


/* =========================================================
   PLAY YOUTUBE
========================================================= */

async function playYouTube(
  song
) {

  const videoId =
    getYouTubeId(song);

  if (!videoId) {

    toast(
      "Invalid YouTube video ID."
    );

    return;
  }

  /*
   * Stop HTML audio.
   */

  audio.pause();

  audio.removeAttribute(
    "src"
  );

  audio.load();

  E.videoMode.hidden =
    false;

  /*
   * Audio mode is default.
   */

  setMode(
    state.mode === "video"
      ? "video"
      : "music"
  );

  updatePlayerInfo(
    song
  );

  try {

    await ensureYouTubeAPI();

    createOrLoadYouTubePlayer(
      videoId
    );

  } catch (error) {

    console.error(
      "YOUTUBE API ERROR:",
      error
    );

    toast(
      "Unable to load YouTube player."
    );

    setPlaying(
      false
    );
  }
}


/* =========================================================
   CREATE YOUTUBE PLAYER
========================================================= */

function createOrLoadYouTubePlayer(
  videoId
) {

  if (
    !window.YT ||
    !window.YT.Player
  ) {

    toast(
      "YouTube player is still loading..."
    );

    return;
  }


  /*
   * Already created.
   */

  if (
    state.youtubePlayer &&
    typeof
      state.youtubePlayer.loadVideoById ===
      "function"
  ) {

    state.youtubePlayer.loadVideoById(
      videoId
    );

    /*
     * Apply current volume.
     */

    if (
      state.youtubePlayer.setVolume
    ) {

      state.youtubePlayer.setVolume(
        Math.round(
          state.volume * 100
        )
      );

    }

    setPlaying(
      true
    );

    return;
  }


  /*
   * Create player.
   */

  E.ytPlayer.innerHTML =
    "";

  state.youtubePlayer =
    new YT.Player(
      E.ytPlayer,
      {

        width: "100%",

        height: "100%",

        videoId,

        playerVars: {

          autoplay: 1,

          controls: 1,

          rel: 0,

          playsinline: 1,

          modestbranding: 1,

          enablejsapi: 1

        },

        events: {

          onReady:
            event => {

              event.target.setVolume(
                Math.round(
                  state.volume *
                  100
                )
              );

              event.target.playVideo();

              setPlaying(
                true
              );

            },

          onStateChange:
            event => {

              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {

                setPlaying(
                  true
                );

              }

              else if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {

                setPlaying(
                  false
                );

              }

              else if (
                event.data ===
                YT.PlayerState.ENDED
              ) {

                nextSong();

              }

            },

          onError:
            event => {

              console.error(
                "YouTube error:",
                event.data
              );

              setPlaying(
                false
              );

              toast(
                `YouTube playback error (${event.data}).`
              );

            }

        }

      }
    );
}


/* =========================================================
   STOP YOUTUBE
========================================================= */

function stopYouTube() {

  if (
    state.youtubePlayer &&
    typeof
      state.youtubePlayer.stopVideo ===
      "function"
  ) {

    try {

      state.youtubePlayer.stopVideo();

    } catch (_) {}

  }
}


/* =========================================================
   PLAY / PAUSE
========================================================= */

function togglePlay() {

  if (!state.current) {

    if (
      state.songs.length
    ) {

      playAll();

    }

    return;
  }


  /*
   * YouTube
   */

  if (
    isYouTube(
      state.current
    )
  ) {

    if (
      !state.youtubePlayer
    ) {

      playYouTube(
        state.current
      );

      return;
    }

    const playerState =
      state.youtubePlayer
        .getPlayerState();

    if (
      playerState ===
      YT.PlayerState.PLAYING
    ) {

      state.youtubePlayer.pauseVideo();

      setPlaying(
        false
      );

    } else {

      state.youtubePlayer.playVideo();

      setPlaying(
        true
      );
    }

    return;
  }


  /*
   * MP3
   */

  if (
    audio.paused
  ) {

    audio.play()
      .then(() => {

        setPlaying(
          true
        );

      })
      .catch(() => {

        toast(
          "Tap Play again to start audio."
        );

      });

  } else {

    audio.pause();

  }
}


/* =========================================================
   NEXT
========================================================= */

function nextSong() {

  if (!state.queue.length) {

    /*
     * Fallback:
     * entire database
     */

    state.queue =
      [...state.songs];

    state.queueIndex =
      state.currentIndex;
  }


  /*
   * Repeat one
   */

  if (
    state.repeat === 1 &&
    state.current
  ) {

    if (
      isYouTube(
        state.current
      )
    ) {

      if (
        state.youtubePlayer
      ) {

        state.youtubePlayer.seekTo(
          0,
          true
        );

        state.youtubePlayer.playVideo();

      }

    } else {

      audio.currentTime =
        0;

      audio.play();

    }

    return;
  }


  let nextIndex;


  /*
   * Shuffle
   */

  if (
    state.shuffle &&
    state.queue.length > 1
  ) {

    do {

      nextIndex =
        Math.floor(
          Math.random() *
          state.queue.length
        );

    } while (
      nextIndex ===
      state.queueIndex
    );

  }

  /*
   * Normal order
   */

  else {

    nextIndex =
      state.queueIndex + 1;
  }


  /*
   * End of queue
   */

  if (
    nextIndex >=
    state.queue.length
  ) {

    if (
      state.repeat === 2
    ) {

      nextIndex =
        0;

    } else {

      setPlaying(
        false
      );

      toast(
        "Playlist finished"
      );

      return;
    }
  }


  state.queueIndex =
    nextIndex;

  state.current =
    state.queue[
      nextIndex
    ];

  state.currentIndex =
    state.songs.findIndex(
      song =>
        String(song.id) ===
        String(
          state.current.id
        )
    );

  playCurrent();

  renderQueue();
}


/* =========================================================
   PREVIOUS
========================================================= */

function previousSong() {

  if (!state.current)
    return;


  /*
   * If playing for >3 seconds,
   * restart current song.
   */

  if (
    isYouTube(
      state.current
    ) &&
    state.youtubePlayer
  ) {

    const time =
      state.youtubePlayer
        .getCurrentTime();

    if (
      time > 3
    ) {

      state.youtubePlayer.seekTo(
        0,
        true
      );

      return;
    }

  }

  if (
    !isYouTube(
      state.current
    ) &&
    audio.currentTime > 3
  ) {

    audio.currentTime =
      0;

    return;
  }


  if (!state.queue.length)
    return;


  let previousIndex =
    state.queueIndex - 1;


  if (
    previousIndex < 0
  ) {

    previousIndex =
      state.queue.length - 1;
  }


  state.queueIndex =
    previousIndex;

  state.current =
    state.queue[
      previousIndex
    ];

  state.currentIndex =
    state.songs.findIndex(
      song =>
        String(song.id) ===
        String(
          state.current.id
        )
    );

  playCurrent();

  renderQueue();
}


/* =========================================================
   PLAY BUTTON
========================================================= */

function setPlaying(
  playing
) {

  const symbol =
    playing
      ? "Ⅱ"
      : "▶";

  if (E.play)
    E.play.textContent =
      symbol;

  if (E.fullPlay)
    E.fullPlay.textContent =
      symbol;
}


/* =========================================================
   MODE
========================================================= */

function setMode(
  mode
) {

  state.mode =
    mode;


  E.musicMode.classList.toggle(
    "active",
    mode === "music"
  );

  E.videoMode.classList.toggle(
    "active",
    mode === "video"
  );


  /*
   * Video available only
   * for YouTube songs.
   */

  const videoAvailable =
    state.current &&
    isYouTube(
      state.current
    );


  if (
    mode === "video" &&
    videoAvailable
  ) {

    E.fullPlayer.classList.add(
      "open"
    );

    E.videoWrap.classList.remove(
      "hidden"
    );

    E.videoWrap.classList.remove(
      "audio-engine"
    );

  }

  else {

    /*
     * Audio mode:
     * keep YouTube engine alive,
     * but don't display video.
     */

    E.videoWrap.classList.add(
      "hidden"
    );

    if (
      videoAvailable
    ) {

      E.videoWrap.classList.add(
        "audio-engine"
      );

    } else {

      E.videoWrap.classList.remove(
        "audio-engine"
      );

    }

  }
}


/* =========================================================
   QUEUE
========================================================= */

function renderQueue() {

  if (!E.queue)
    return;

  if (!state.queue.length) {

    E.queue.innerHTML = `
      <div style="
        padding:15px;
        color:#77778d;
        font-size:11px;
      ">
        Queue is empty.
      </div>
    `;

    return;
  }


  E.queue.innerHTML =
    state.queue
      .map(
        (song,index) => {

          const active =
            String(
              state.current?.id
            ) ===
            String(song.id);

          return `
            <div
              class="
                queue-row
                ${
                  active
                    ? "active"
                    : ""
                }
              "
              data-queue-index="${index}"
            >

              <img
                src="${escapeHTML(
                  imageFor(song)
                )}"
                alt=""
                onerror="
                  this.onerror=null;
                  this.src='/images/ganpati.jpg';
                "
              >

              <div class="queue-row-info">

                <strong>
                  ${escapeHTML(
                    song.title ||
                    "Untitled"
                  )}
                </strong>

                <small>
                  ${
                    isYouTube(song)
                      ? "YouTube"
                      : "MP3"
                  }
                  ·
                  ${escapeHTML(
                    song.artist ||
                    "SwarAJ"
                  )}
                </small>

              </div>

            </div>
          `;

        }
      )
      .join("");


  E.queue
    .querySelectorAll(
      "[data-queue-index]"
    )
    .forEach(row => {

      row.addEventListener(
        "click",
        () => {

          const index =
            Number(
              row.dataset.queueIndex
            );

          if (
            !Number.isInteger(
              index
            )
          )
            return;

          state.queueIndex =
            index;

          state.current =
            state.queue[index];

          state.currentIndex =
            state.songs.findIndex(
              song =>
                String(song.id) ===
                String(
                  state.current.id
                )
            );

          playCurrent();

          renderQueue();

        }
      );

    });
}


/* =========================================================
   SEEK / PROGRESS
========================================================= */

function updateProgress() {

  if (!state.current)
    return;


  if (
    isYouTube(
      state.current
    ) &&
    state.youtubePlayer
  ) {

    try {

      const current =
        state.youtubePlayer
          .getCurrentTime();

      const duration =
        state.youtubePlayer
          .getDuration();

      E.cur.textContent =
        formatTime(
          current
        );

      E.dur.textContent =
        formatTime(
          duration
        );

      E.seek.value =
        duration
          ? (
              current /
              duration
            ) * 100
          : 0;

    } catch (_) {}

    return;
  }


  const current =
    audio.currentTime || 0;

  const duration =
    audio.duration || 0;

  E.cur.textContent =
    formatTime(
      current
    );

  E.dur.textContent =
    formatTime(
      duration
    );

  E.seek.value =
    duration
      ? (
          current /
          duration
        ) * 100
      : 0;
}


/* =========================================================
   MEDIA SESSION
   Helps MP3/background controls on supported browsers.
========================================================= */

function updateMediaSession(
  song
) {

  if (
    !("mediaSession" in navigator) ||
    !song
  )
    return;

  try {

    navigator.mediaSession.metadata =
      new MediaMetadata({

        title:
          song.title ||
          "SwarAJ",

        artist:
          song.artist ||
          "SwarAJ",

        album:
          song.album ||
          "SwarAJ",

        artwork: [

          {
            src:
              imageFor(song),

            sizes:
              "512x512",

            type:
              "image/jpeg"
          }

        ]

      });

  } catch (_) {}
}


if (
  "mediaSession" in navigator
) {

  navigator.mediaSession.setActionHandler(
    "play",
    () => togglePlay()
  );

  navigator.mediaSession.setActionHandler(
    "pause",
    () => togglePlay()
  );

  navigator.mediaSession.setActionHandler(
    "previoustrack",
    () => previousSong()
  );

  navigator.mediaSession.setActionHandler(
    "nexttrack",
    () => nextSong()
  );
}


/* =========================================================
   ADMIN
========================================================= */

async function loadAdminSongs() {

  if (!state.adminToken) {

    E.adminStatus.textContent =
      "Enter ADMIN_TOKEN";

    E.adminStatus.style.color =
      "#ff7b98";

    E.adminSongs.innerHTML = `
      <div style="
        padding:15px;
        color:#77778d;
        font-size:11px;
      ">
        Connect your admin token to manage songs.
      </div>
    `;

    return;
  }


  try {

    E.adminStatus.textContent =
      "Connecting...";

    const data =
      await api(
        "/api/admin/songs",
        {
          headers: {
            "x-admin-token":
              state.adminToken
          }
        }
      );


    E.adminStatus.textContent =
      `Connected · ${data.count || 0} songs`;

    E.adminStatus.style.color =
      "#38e5d0";


    const songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];


    if (!songs.length) {

      E.adminSongs.innerHTML = `
        <div style="
          padding:15px;
          color:#77778d;
        ">
          No songs in database.
        </div>
      `;

      return;
    }


    E.adminSongs.innerHTML =
      songs
        .map(
          song => {

            return `
              <div class="admin-row">

                <div class="admin-row-info">

                  <strong>
                    ${escapeHTML(
                      song.title ||
                      "Untitled"
                    )}
                  </strong>

                  <small>
                    ${
                      isYouTube(song)
                        ? "YouTube"
                        : "MP3"
                    }
                    ·
                    ${escapeHTML(
                      song.artist ||
                      "SwarAJ"
                    )}
                  </small>

                </div>

                <button
                  type="button"
                  class="delete-song"
                  data-delete="${escapeHTML(
                    song.id
                  )}"
                >
                  Delete
                </button>

              </div>
            `;

          }
        )
        .join("");


    E.adminSongs
      .querySelectorAll(
        "[data-delete]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            deleteAdminSong(
              button.dataset.delete
            );

          }
        );

      });

  } catch (error) {

    E.adminStatus.textContent =
      error.message ||
      "Admin authentication failed";

    E.adminStatus.style.color =
      "#ff7b98";

  }
}


/* =========================================================
   DELETE ADMIN SONG
========================================================= */

async function deleteAdminSong(
  id
) {

  if (!state.adminToken)
    return;

  if (
    !window.confirm(
      "Delete this song?"
    )
  )
    return;


  try {

    await api(
      `/api/admin/songs/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",

        headers: {
          "x-admin-token":
            state.adminToken
        }
      }
    );


    toast(
      "Song deleted"
    );


    if (
      state.current &&
      String(
        state.current.id
      ) === String(id)
    ) {

      audio.pause();

      stopYouTube();

      state.current =
        null;

      state.currentIndex =
        -1;

      setPlaying(
        false
      );
    }


    state.queue =
      state.queue.filter(
        song =>
          String(song.id) !==
          String(id)
      );


    await loadSongs();

    await loadAdminSongs();

  } catch (error) {

    toast(
      error.message ||
      "Unable to delete song"
    );
  }
}


/* =========================================================
   YOUTUBE ADMIN
========================================================= */

async function submitYouTube(
  event
) {

  event.preventDefault();


  if (!state.adminToken) {

    toast(
      "Connect admin first"
    );

    showView(
      "admin"
    );

    return;
  }


  const form =
    event.currentTarget;

  const formData =
    new FormData(form);

  /*
   * This is the important fix:
   *
   * POST /api/admin/songs
   * source_type=youtube
   */

  formData.set(
    "source_type",
    "youtube"
  );


  const button =
    form.querySelector(
      "button[type=submit]"
    );

  if (button)
    button.disabled =
      true;


  try {

    const data =
      await api(
        "/api/admin/songs",
        {

          method: "POST",

          headers: {
            "x-admin-token":
              state.adminToken
          },

          body:
            formData

        }
      );


    toast(
      `Added ${
        data.song?.title ||
        "YouTube song"
      }`
    );


    form.reset();


    const artist =
      form.querySelector(
        '[name="artist"]'
      );

    const album =
      form.querySelector(
        '[name="album"]'
      );

    const category =
      form.querySelector(
        '[name="category"]'
      );

    const language =
      form.querySelector(
        '[name="language"]'
      );


    if (artist)
      artist.value =
        "SwarAJ";

    if (album)
      album.value =
        "Singles";

    if (category)
      category.value =
        "Marathi";

    if (language)
      language.value =
        "Marathi";


    await loadSongs();

    await loadAdminSongs();

  } catch (error) {

    console.error(
      "YOUTUBE UPLOAD ERROR:",
      error
    );

    toast(
      error.message ||
      "Unable to add YouTube song"
    );

  } finally {

    if (button)
      button.disabled =
        false;
  }
}


/* =========================================================
   MP3 ADMIN
========================================================= */

async function submitMP3(
  event
) {

  event.preventDefault();


  if (!state.adminToken) {

    toast(
      "Connect admin first"
    );

    showView(
      "admin"
    );

    return;
  }


  const form =
    event.currentTarget;

  const fileInput =
    form.querySelector(
      '[name="audio"]'
    );


  if (
    !fileInput ||
    !fileInput.files.length
  ) {

    toast(
      "Select an audio file."
    );

    return;
  }


  const formData =
    new FormData(form);


  /*
   * Current server expects:
   *
   * source_type=mp3
   * audio=<file>
   * cover=<file>
   */

  formData.set(
    "source_type",
    "mp3"
  );


  const button =
    form.querySelector(
      "button[type=submit]"
    );

  if (button)
    button.disabled =
      true;


  try {

    /*
     * Use the actual endpoint
     * implemented by your current server.
     */

    const data =
      await api(
        "/api/admin/songs",
        {

          method: "POST",

          headers: {
            "x-admin-token":
              state.adminToken
          },

          body:
            formData

        }
      );


    toast(
      `Uploaded ${
        data.song?.title ||
        "MP3"
      }`
    );


    form.reset();


    const artist =
      form.querySelector(
        '[name="artist"]'
      );

    const album =
      form.querySelector(
        '[name="album"]'
      );

    const category =
      form.querySelector(
        '[name="category"]'
      );

    const language =
      form.querySelector(
        '[name="language"]'
      );


    if (artist)
      artist.value =
        "SwarAJ";

    if (album)
      album.value =
        "Singles";

    if (category)
      category.value =
        "Marathi";

    if (language)
      language.value =
        "Marathi";


    await loadSongs();

    await loadAdminSongs();

  } catch (error) {

    console.error(
      "MP3 UPLOAD ERROR:",
      error
    );

    toast(
      error.message ||
      "Unable to upload MP3"
    );

  } finally {

    if (button)
      button.disabled =
        false;
  }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */


/*
 * Mobile menu
 */

if (E.menu) {

  E.menu.addEventListener(
    "click",
    () => {

      E.sidebar.classList.toggle(
        "open"
      );

    }
  );

}


function closeMobileMenu() {

  if (
    E.sidebar &&
    window.innerWidth <= 1000
  ) {

    E.sidebar.classList.remove(
      "open"
    );

  }
}


/*
 * Navigation
 */

document
  .querySelectorAll(
    ".nav"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showView(
          button.dataset.view
        );

      }
    );

  });


/*
 * Search
 */

if (E.search) {

  E.search.addEventListener(
    "input",
    event => {

      const value =
        event.target.value;

      E.clear.hidden =
        !value;

      searchSongs(
        value
      );

    }
  );

}


/*
 * Clear search
 */

if (E.clear) {

  E.clear.addEventListener(
    "click",
    () => {

      E.search.value =
        "";

      E.clear.hidden =
        true;

      E.searchResults.hidden =
        true;

      E.search.focus();

    }
  );

}


/*
 * Refresh
 */

if (E.refresh) {

  E.refresh.addEventListener(
    "click",
    async () => {

      await loadSongs();

      toast(
        "Library refreshed"
      );

    }
  );

}


/*
 * Play All
 */

if (E.playAll) {

  E.playAll.addEventListener(
    "click",
    playAll
  );

}


/*
 * Shuffle All
 */

if (E.shuffleAll) {

  E.shuffleAll.addEventListener(
    "click",
    () => {

      if (!state.songs.length) {

        toast(
          "No songs available"
        );

        return;
      }

      state.queue =
        [...state.songs];

      state.queueIndex =
        Math.floor(
          Math.random() *
          state.queue.length
        );

      state.shuffle =
        true;

      state.current =
        state.queue[
          state.queueIndex
        ];

      state.currentIndex =
        state.songs.findIndex(
          song =>
            String(song.id) ===
            String(
              state.current.id
            )
        );

      playCurrent();

      renderQueue();

      toast(
        "Shuffle playlist started"
      );

    }
  );

}


/*
 * Mini player
 */

E.play?.addEventListener(
  "click",
  togglePlay
);

E.prev?.addEventListener(
  "click",
  previousSong
);

E.next?.addEventListener(
  "click",
  nextSong
);

E.like?.addEventListener(
  "click",
  () => {

    if (state.current)
      toggleFavorite(
        state.current
      );

  }
);


/*
 * Expand
 */

E.expand?.addEventListener(
  "click",
  () => {

    E.fullPlayer.classList.toggle(
      "open"
    );

    if (
      state.current &&
      isYouTube(
        state.current
      ) &&
      state.mode === "video"
    ) {

      setMode(
        "video"
      );

    }

  }
);


/*
 * Full controls
 */

E.fullPlay?.addEventListener(
  "click",
  togglePlay
);

E.fullPrev?.addEventListener(
  "click",
  previousSong
);

E.fullNext?.addEventListener(
  "click",
  nextSong
);


/*
 * Music / Audio mode
 */

E.musicMode?.addEventListener(
  "click",
  () => {

    if (!state.current)
      return;

    setMode(
      "music"
    );

  }
);


/*
 * Video mode
 */

E.videoMode?.addEventListener(
  "click",
  () => {

    if (
      !state.current ||
      !isYouTube(
        state.current
      )
    ) {

      toast(
        "Video is available for YouTube songs."
      );

      return;
    }

    setMode(
      "video"
    );

  }
);


/*
 * Shuffle
 */

E.shuffle?.addEventListener(
  "click",
  () => {

    state.shuffle =
      !state.shuffle;

    toast(
      state.shuffle
        ? "Shuffle ON"
        : "Shuffle OFF"
    );

  }
);


/*
 * Repeat
 */

E.repeat?.addEventListener(
  "click",
  () => {

    state.repeat =
      (state.repeat + 1) % 3;

    const labels = [
      "Repeat OFF",
      "Repeat ONE",
      "Repeat ALL"
    ];

    toast(
      labels[
        state.repeat
      ]
    );

  }
);


/*
 * Clear queue
 */

E.clearQueue?.addEventListener(
  "click",
  () => {

    state.queue = [];

    state.queueIndex =
      -1;

    renderQueue();

    toast(
      "Queue cleared"
    );

  }
);


/*
 * Volume
 */

if (E.volume) {

  E.volume.value =
    state.volume;

  E.volume.addEventListener(
    "input",
    event => {

      state.volume =
        Number(
          event.target.value
        );

      localStorage.setItem(
        "swaraj-volume",
        String(
          state.volume
        )
      );

      audio.volume =
        state.volume;

      if (
        state.youtubePlayer &&
        state.youtubePlayer.setVolume
      ) {

        state.youtubePlayer.setVolume(
          Math.round(
            state.volume * 100
          )
        );

      }

    }
  );

}

audio.volume =
  state.volume;


/*
 * Audio time
 */

audio.addEventListener(
  "timeupdate",
  updateProgress
);

audio.addEventListener(
  "loadedmetadata",
  updateProgress
);


/*
 * Audio playing
 */

audio.addEventListener(
  "play",
  () => {

    setPlaying(
      true
    );

  }
);


/*
 * Audio pause
 */

audio.addEventListener(
  "pause",
  () => {

    /*
     * Don't overwrite YouTube state.
     */

    if (
      !state.current ||
      !isYouTube(
        state.current
      )
    ) {

      setPlaying(
        false
      );

    }

  }
);


/*
 * MP3 ended
 */

audio.addEventListener(
  "ended",
  () => {

    nextSong();

  }
);


/*
 * MP3 errors
 */

audio.addEventListener(
  "error",
  () => {

    if (
      state.current &&
      !isYouTube(
        state.current
      )
    ) {

      console.error(
        "Audio error:",
        audio.error
      );

      toast(
        "Unable to play this MP3."
      );

      setPlaying(
        false
      );

    }

  }
);


/*
 * Seek
 */

E.seek?.addEventListener(
  "input",
  event => {

    if (!state.current)
      return;


    const percent =
      Number(
        event.target.value
      ) / 100;


    /*
     * YouTube
     */

    if (
      isYouTube(
        state.current
      ) &&
      state.youtubePlayer
    ) {

      const duration =
        state.youtubePlayer
          .getDuration();

      if (duration) {

        state.youtubePlayer.seekTo(
          duration *
          percent,
          true
        );

      }

      return;
    }


    /*
     * MP3
     */

    if (
      audio.duration
    ) {

      audio.currentTime =
        audio.duration *
        percent;

    }

  }
);


/*
 * Admin login
 */

E.saveToken?.addEventListener(
  "click",
  async () => {

    const token =
      E.adminToken.value.trim();

    if (!token) {

      toast(
        "Enter ADMIN_TOKEN"
      );

      return;
    }

    state.adminToken =
      token;

    localStorage.setItem(
      "swaraj-admin-token",
      token
    );

    await loadAdminSongs();

  }
);


/*
 * Admin forms
 */

E.ytForm?.addEventListener(
  "submit",
  submitYouTube
);

E.mp3Form?.addEventListener(
  "submit",
  submitMP3
);


/*
 * Admin refresh
 */

E.adminRefresh?.addEventListener(
  "click",
  loadAdminSongs
);


/*
 * Restore admin token
 */

if (E.adminToken) {

  E.adminToken.value =
    state.adminToken;

}


/* =========================================================
   PERIODIC PLAYER PROGRESS
========================================================= */

setInterval(
  updateProgress,
  500
);


/* =========================================================
   MEDIA SESSION UPDATE
========================================================= */

const originalUpdatePlayerInfo =
  updatePlayerInfo;


/*
 * Keep Media Session metadata
 */

function refreshMediaSession() {

  if (
    state.current
  ) {

    updateMediaSession(
      state.current
    );

  }

}


/* =========================================================
   INITIAL LOAD
========================================================= */

(async function init() {

  try {

    await loadSongs();

    if (
      state.adminToken
    ) {

      /*
       * Don't show an error popup
       * immediately if token has
       * expired.
       */

      await loadAdminSongs();

    }

  } catch (error) {

    console.error(
      "INIT ERROR:",
      error
    );

  }

})();


/* =========================================================
   UPDATE MEDIA SESSION WHEN SONG CHANGES
========================================================= */

const playerInfoObserver =
  setInterval(
    () => {

      if (
        state.current
      ) {

        updateMediaSession(
          state.current
        );

      }

    },
    2000
  );