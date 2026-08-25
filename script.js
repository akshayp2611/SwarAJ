"use strict";

/* =========================================================
   SWARAJ MUSIC PLAYER
   MP3 + UPLOADED VIDEO + YOUTUBE
   ========================================================= */

const $ = id => document.getElementById(id);

const state = {

  songs: [],
  playlist: [],

  currentIndex: -1,

  mode: "audio",

  isPlaying: false,

  favorites:
    JSON.parse(
      localStorage.getItem("swaraj_favorites") || "[]"
    ),

  adminKey:
    sessionStorage.getItem("swaraj_admin_key") || "",

  ytPlayer: null,

  ytReady: false,

  ytPromise: null,

  currentType: null
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  bindNavigation();

  bindPlayerControls();

  bindAdmin();

  bindSearch();

  bindModeButtons();

  bindVideoControls();

  loadSongs();

  updateAdminUI();

});


/* =========================================================
   API
   ========================================================= */

async function api(url, options = {}) {

  const headers = {
    ...(options.headers || {})
  };

  if (state.adminKey) {
    headers["x-admin-key"] = state.adminKey;
  }

  const response =
    await fetch(url, {
      ...options,
      headers
    });

  const text =
    await response.text();

  let data;

  try {
    data =
      text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {

    const message =
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}


/* =========================================================
   LOAD SONGS
   ========================================================= */

async function loadSongs() {

  setServerStatus("Loading...", false);

  try {

    const data =
      await api("/api/songs");

    state.songs =
      Array.isArray(data)
        ? data
        : Array.isArray(data.songs)
          ? data.songs
          : [];

    state.songs =
      state.songs.map(normalizeSong);

    setServerStatus("Online", true);

    renderHome();

    renderSongs();

    renderCategories();

    renderFavorites();

  } catch (error) {

    console.error(error);

    setServerStatus("Offline", false);

    showToast(
      "Unable to load songs",
      "error"
    );

    renderEmpty(
      $("songsList"),
      "Unable to load songs"
    );
  }
}


/* =========================================================
   NORMALIZE SONG
   ========================================================= */

function normalizeSong(song, index) {

  const type =
    String(
      song.source_type ||
      song.type ||
      song.media_type ||
      ""
    ).toLowerCase();

  const youtubeId =
    song.youtube_video_id ||
    song.youtubeId ||
    song.youtube_id ||
    extractYoutubeId(
      song.youtube_url ||
      song.url ||
      song.video_url ||
      ""
    );

  const isYoutube =
    type === "youtube" ||
    !!youtubeId;

  const isVideo =
    type === "video" ||
    type === "uploaded_video" ||
    String(song.mime_type || "").startsWith("video/") ||
    String(song.file_type || "").startsWith("video/");

  let mediaType =
    isYoutube
      ? "youtube"
      : isVideo
        ? "video"
        : "audio";

  let audioUrl =
    song.audio_url ||
    song.stream_url ||
    song.file_url ||
    song.url ||
    "";

  let videoUrl =
    song.video_url ||
    song.file_url ||
    song.url ||
    "";

  if (
    song.id &&
    !audioUrl &&
    mediaType === "audio"
  ) {
    audioUrl =
      `/api/songs/${encodeURIComponent(song.id)}/audio`;
  }

  if (
    song.id &&
    !videoUrl &&
    mediaType === "video"
  ) {
    videoUrl =
      `/api/songs/${encodeURIComponent(song.id)}/video`;
  }

  const title =
    song.title ||
    song.name ||
    song.filename ||
    "Unknown Song";

  const artist =
    song.artist ||
    song.artist_name ||
    "SwarAJ";

  const category =
    song.category ||
    song.genre ||
    "All Songs";

  const cover =
    song.cover_url ||
    song.cover ||
    song.image_url ||
    song.thumbnail ||
    (
      isYoutube && youtubeId
        ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
        : ""
    );

  return {
    ...song,

    _index: index,

    id:
      song.id ??
      `song-${index}`,

    title,

    artist,

    category,

    cover,

    youtubeId,

    mediaType,

    audioUrl,

    videoUrl,

    youtube:
      mediaType === "youtube",

    video:
      mediaType === "video"
  };
}


/* =========================================================
   YOUTUBE
   ========================================================= */

function ensureYouTubeAPI() {

  if (
    window.YT &&
    window.YT.Player
  ) {

    state.ytReady = true;

    return Promise.resolve();
  }

  if (state.ytPromise) {
    return state.ytPromise;
  }

  state.ytPromise =
    new Promise(resolve => {

      if (
        window.YT &&
        window.YT.Player
      ) {
        state.ytReady = true;
        resolve();
        return;
      }

      const old =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady =
        () => {

          if (typeof old === "function") {
            old();
          }

          state.ytReady = true;

          resolve();
        };

      const existing =
        document.querySelector(
          'script[src*="youtube.com/iframe_api"]'
        );

      if (!existing) {

        const script =
          document.createElement("script");

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        document.head.appendChild(script);
      }
    });

  return state.ytPromise;
}


async function playYouTube(song) {

  const videoId =
    song.youtubeId;

  if (!videoId) {

    showToast(
      "Invalid YouTube video",
      "error"
    );

    return;
  }

  await ensureYouTubeAPI();

  stopMP3();

  stopUploadedVideo();

  const container =
    $("youtubeContainer");

  if (!container) return;

  container.innerHTML =
    `<div id="ytPlayer"></div>`;

  state.currentType =
    "youtube";

  if (state.mode === "video") {

    openVideoOverlay(song);

    container.style.display =
      "block";

  } else {

    closeVideoOverlay();

    /*
      Keep the iframe effectively invisible
      while YouTube continues playing.
    */

    container.style.display =
      "block";

    container.style.position =
      "fixed";

    container.style.width =
      "1px";

    container.style.height =
      "1px";

    container.style.left =
      "-10px";

    container.style.top =
      "-10px";

    container.style.opacity =
      "0";

    container.style.pointerEvents =
      "none";
  }

  state.ytPlayer =
    new YT.Player(
      "ytPlayer",
      {

        width:
          state.mode === "video"
            ? "100%"
            : "1",

        height:
          state.mode === "video"
            ? "100%"
            : "1",

        videoId,

        playerVars: {

          autoplay: 1,

          controls:
            state.mode === "video"
              ? 1
              : 0,

          playsinline: 1,

          rel: 0,

          modestbranding: 1,

          iv_load_policy: 3,

          enablejsapi: 1
        },

        events: {

          onReady(event) {

            try {
              event.target.playVideo();
            } catch (_) {}

            state.isPlaying = true;

            updatePlayerUI(song);
          },

          onStateChange(event) {

            if (
              event.data ===
              YT.PlayerState.PLAYING
            ) {

              state.isPlaying = true;

              updatePlayerUI(song);
            }

            else if (
              event.data ===
              YT.PlayerState.PAUSED
            ) {

              state.isPlaying = false;

              updatePlayButton();
            }

            else if (
              event.data ===
              YT.PlayerState.ENDED
            ) {

              state.isPlaying = false;

              playNext();
            }
          },

          onError(event) {

            console.error(
              "YouTube error:",
              event.data
            );

            showToast(
              "YouTube video cannot be played",
              "error"
            );
          }
        }
      }
    );
}


/* =========================================================
   PLAY MP3
   ========================================================= */

async function playMP3(song) {

  const audio =
    $("audioPlayer");

  if (!song.audioUrl) {

    showToast(
      "MP3 URL not available",
      "error"
    );

    return;
  }

  stopYouTube();

  stopUploadedVideo();

  closeVideoOverlay();

  state.currentType =
    "audio";

  audio.src =
    song.audioUrl;

  audio.load();

  try {

    await audio.play();

    state.isPlaying = true;

    updatePlayerUI(song);

  } catch (error) {

    console.error(
      "MP3 playback error:",
      error
    );

    state.isPlaying = false;

    updatePlayButton();

    showToast(
      "Tap Play again to start the MP3",
      "info"
    );
  }
}


/* =========================================================
   PLAY UPLOADED VIDEO
   ========================================================= */

async function playUploadedVideo(song) {

  const video =
    $("uploadedVideo");

  if (!song.videoUrl) {

    showToast(
      "Video URL not available",
      "error"
    );

    return;
  }

  stopYouTube();

  stopMP3();

  state.currentType =
    "video";

  openVideoOverlay(song);

  $("youtubeContainer").style.display =
    "none";

  video.style.display =
    "block";

  video.src =
    song.videoUrl;

  video.load();

  try {

    await video.play();

    state.isPlaying = true;

    updatePlayerUI(song);

  } catch (error) {

    console.error(error);

    showToast(
      "Tap the video to start playback",
      "info"
    );
  }
}


/* =========================================================
   START SONG
   ========================================================= */

async function startSong(index) {

  if (
    index < 0 ||
    index >= state.playlist.length
  ) {
    return;
  }

  state.currentIndex =
    index;

  const song =
    state.playlist[index];

  if (!song) return;

  updatePlayerUI(song);

  if (song.youtube) {

    await playYouTube(song);

  } else if (song.video) {

    await playUploadedVideo(song);

  } else {

    await playMP3(song);
  }
}


/* =========================================================
   PLAY ALL
   ========================================================= */

function playAll() {

  if (!state.songs.length) {

    showToast(
      "No songs available",
      "error"
    );

    return;
  }

  state.playlist =
    [...state.songs];

  state.currentIndex = 0;

  startSong(0);

  showToast(
    `Playing all ${state.playlist.length} songs`,
    "success"
  );
}


/* =========================================================
   NEXT
   ========================================================= */

function playNext() {

  if (!state.playlist.length) {

    state.playlist =
      [...state.songs];
  }

  if (!state.playlist.length) return;

  let next =
    state.currentIndex + 1;

  if (
    next >=
    state.playlist.length
  ) {
    next = 0;
  }

  startSong(next);
}


/* =========================================================
   PREVIOUS
   ========================================================= */

function playPrevious() {

  if (!state.playlist.length) {

    state.playlist =
      [...state.songs];
  }

  if (!state.playlist.length) return;

  let previous =
    state.currentIndex - 1;

  if (previous < 0) {

    previous =
      state.playlist.length - 1;
  }

  startSong(previous);
}


/* =========================================================
   STOP
   ========================================================= */

function stopAll() {

  stopMP3();

  stopYouTube();

  stopUploadedVideo();

  state.isPlaying =
    false;

  updatePlayButton();

  showToast(
    "Playback stopped",
    "info"
  );
}


function stopMP3() {

  const audio =
    $("audioPlayer");

  if (!audio) return;

  audio.pause();

  audio.currentTime = 0;
}


function stopYouTube() {

  if (
    state.ytPlayer &&
    typeof state.ytPlayer.stopVideo ===
      "function"
  ) {

    try {
      state.ytPlayer.stopVideo();
    } catch (_) {}
  }

  state.ytPlayer = null;
}


function stopUploadedVideo() {

  const video =
    $("uploadedVideo");

  if (!video) return;

  video.pause();

  video.removeAttribute("src");

  video.load();

  video.style.display =
    "none";
}


/* =========================================================
   PLAY / PAUSE
   ========================================================= */

async function togglePlay() {

  if (state.currentIndex < 0) {

    playAll();

    return;
  }

  const song =
    state.playlist[
      state.currentIndex
    ];

  if (!song) {

    playAll();

    return;
  }

  if (song.youtube) {

    if (!state.ytPlayer) {

      await startSong(
        state.currentIndex
      );

      return;
    }

    const playerState =
      state.ytPlayer.getPlayerState();

    if (
      playerState ===
      YT.PlayerState.PLAYING
    ) {

      state.ytPlayer.pauseVideo();

    } else {

      state.ytPlayer.playVideo();
    }

    return;
  }

  if (song.video) {

    const video =
      $("uploadedVideo");

    if (
      video.paused
    ) {

      try {
        await video.play();
      } catch (_) {}

    } else {

      video.pause();
    }

    return;
  }

  const audio =
    $("audioPlayer");

  if (audio.paused) {

    try {
      await audio.play();
    } catch (_) {}

  } else {

    audio.pause();
  }
}


/* =========================================================
   AUDIO EVENTS
   ========================================================= */

$("audioPlayer").addEventListener(
  "play",
  () => {

    state.isPlaying = true;

    updatePlayButton();
  }
);

$("audioPlayer").addEventListener(
  "pause",
  () => {

    state.isPlaying = false;

    updatePlayButton();
  }
);

$("audioPlayer").addEventListener(
  "ended",
  () => {

    state.isPlaying = false;

    playNext();
  }
);

$("audioPlayer").addEventListener(
  "timeupdate",
  updateProgress
);


$("uploadedVideo").addEventListener(
  "play",
  () => {

    state.isPlaying = true;

    updatePlayButton();
  }
);

$("uploadedVideo").addEventListener(
  "pause",
  () => {

    state.isPlaying = false;

    updatePlayButton();
  }
);

$("uploadedVideo").addEventListener(
  "ended",
  () => {

    state.isPlaying = false;

    playNext();
  }
);

$("uploadedVideo").addEventListener(
  "timeupdate",
  updateProgress
);


/* =========================================================
   PLAYER UI
   ========================================================= */

function updatePlayerUI(song) {

  $("miniTitle").textContent =
    song.title;

  $("miniArtist").textContent =
    `${song.artist} • ${typeLabel(song)}`;

  const cover =
    $("miniCover");

  if (song.cover) {

    cover.innerHTML =
      `<img src="${escapeAttr(song.cover)}"
            alt="">`;

  } else {

    cover.innerHTML =
      "♪";
  }

  $("miniPlayer")
    .classList.add("show");

  updatePlayButton();

  updateProgress();
}


function updatePlayButton() {

  $("miniPlay").textContent =
    state.isPlaying
      ? "❚❚"
      : "▶";
}


function updateProgress() {

  let percent = 0;

  if (
    state.currentType ===
    "audio"
  ) {

    const audio =
      $("audioPlayer");

    if (
      audio.duration &&
      isFinite(audio.duration)
    ) {

      percent =
        (audio.currentTime /
          audio.duration) * 100;
    }
  }

  else if (
    state.currentType ===
    "video"
  ) {

    const video =
      $("uploadedVideo");

    if (
      video.duration &&
      isFinite(video.duration)
    ) {

      percent =
        (video.currentTime /
          video.duration) * 100;
    }
  }

  else if (
    state.currentType ===
    "youtube" &&
    state.ytPlayer
  ) {

    try {

      const duration =
        state.ytPlayer
          .getDuration();

      const current =
        state.ytPlayer
          .getCurrentTime();

      if (duration) {

        percent =
          (current / duration) * 100;
      }

    } catch (_) {}
  }

  $("miniProgress").style.width =
    `${Math.max(0,Math.min(100,percent))}%`;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function bindNavigation() {

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

          $("sidebar")
            .classList.remove("open");
        }
      );
    });

  document
    .querySelectorAll("[data-page]")
    .forEach(button => {

      if (
        button.classList.contains(
          "nav-item"
        )
      ) return;

      button.addEventListener(
        "click",
        () => {
          showPage(
            button.dataset.page
          );
        }
      );
    });

  $("desktopMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        $("sidebar")
          .classList.toggle("open");
      }
    );

  $("mobileMenuBtn")
    ?.addEventListener(
      "click",
      () => {
        $("sidebar")
          .classList.toggle("open");
      }
    );
}


function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(element => {
      element.classList.add("hidden");
    });

  const target =
    $(`page-${page}`);

  if (target) {
    target.classList.remove(
      "hidden"
    );
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });
}


/* =========================================================
   RENDER HOME
   ========================================================= */

function renderHome() {

  const quick =
    $("quickSongs");

  quick.innerHTML = "";

  state.songs
    .slice(0,8)
    .forEach((song,index) => {

      quick.appendChild(
        createSongCard(
          song,
          index
        )
      );
    });

  renderCategoryCards(
    $("homeCategories")
  );
}


/* =========================================================
   SONG CARDS
   ========================================================= */

function createSongCard(song,index) {

  const card =
    document.createElement("article");

  card.className =
    "song-card";

  card.innerHTML = `

    <div class="song-cover">

      ${
        song.cover

          ? `<img
              src="${escapeAttr(song.cover)}"
              alt=""
              loading="lazy"
            >`

          : `<div class="song-placeholder">
              ${song.youtube ? "▶" : "♪"}
            </div>`
      }

      <button
        class="song-play"
        title="Play"
      >
        ▶
      </button>

    </div>

    <div class="song-info">

      <strong>
        ${escapeHtml(song.title)}
      </strong>

      <span>
        ${escapeHtml(song.artist)}
      </span>

    </div>
  `;

  card.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(
          ".song-play"
        )
      ) {
        return;
      }

      state.playlist =
        [...state.songs];

      startSong(
        state.playlist.findIndex(
          item =>
            String(item.id) ===
            String(song.id)
        )
      );
    }
  );

  card
    .querySelector(".song-play")
    .addEventListener(
      "click",
      event => {

        event.stopPropagation();

        state.playlist =
          [...state.songs];

        const songIndex =
          state.playlist.findIndex(
            item =>
              String(item.id) ===
              String(song.id)
          );

        startSong(songIndex);
      }
    );

  return card;
}


/* =========================================================
   SONG LIST
   ========================================================= */

function renderSongs(list = state.songs) {

  $("songCount").textContent =
    `${list.length} songs`;

  const container =
    $("songsList");

  container.innerHTML = "";

  if (!list.length) {

    renderEmpty(
      container,
      "No songs found"
    );

    return;
  }

  list.forEach(
    (song,index) => {

      container.appendChild(
        createListSong(
          song,
          index,
          list
        )
      );
    }
  );
}


function createListSong(
  song,
  index,
  list
) {

  const row =
    document.createElement("div");

  row.className =
    "list-song";

  row.innerHTML = `

    <div class="list-number">
      ${index + 1}
    </div>

    <div class="list-cover">

      ${
        song.cover

          ? `<img
              src="${escapeAttr(song.cover)}"
              alt=""
              loading="lazy"
            >`

          : `<div
              class="song-placeholder"
            >
              ${song.youtube ? "▶" : "♪"}
            </div>`
      }

    </div>

    <div class="list-details">

      <strong>
        ${escapeHtml(song.title)}
      </strong>

      <span>
        ${escapeHtml(song.artist)}
        •
        ${escapeHtml(song.category)}
      </span>

    </div>

    <div class="list-type">
      ${typeLabel(song)}
    </div>

    <button
      class="list-play"
      title="Play"
    >
      ▶
    </button>
  `;

  row
    .querySelector(".list-play")
    .addEventListener(
      "click",
      event => {

        event.stopPropagation();

        state.playlist =
          [...list];

        startSong(index);
      }
    );

  row.addEventListener(
    "click",
    () => {

      state.playlist =
        [...list];

      startSong(index);
    }
  );

  return row;
}


/* =========================================================
   CATEGORIES
   ========================================================= */

function renderCategories() {

  renderCategoryCards(
    $("categoriesGrid")
  );

  renderCategoryCards(
    $("homeCategories")
  );
}


function renderCategoryCards(container) {

  if (!container) return;

  container.innerHTML = "";

  const map =
    new Map();

  state.songs.forEach(song => {

    const category =
      song.category ||
      "All Songs";

    if (!map.has(category)) {
      map.set(category,0);
    }

    map.set(
      category,
      map.get(category) + 1
    );
  });

  if (!map.size) {

    renderEmpty(
      container,
      "No categories found"
    );

    return;
  }

  map.forEach(
    (count,category) => {

      const card =
        document.createElement("div");

      card.className =
        "category-card";

      card.innerHTML = `

        <div class="category-icon">
          🎵
        </div>

        <h3>
          ${escapeHtml(category)}
        </h3>

        <p>
          ${count} song${count === 1 ? "" : "s"}
        </p>
      `;

      card.addEventListener(
        "click",
        () => {

          const filtered =
            state.songs.filter(
              song =>
                song.category ===
                category
            );

          renderSongs(filtered);

          showPage("songs");
        }
      );

      container.appendChild(card);
    }
  );
}


/* =========================================================
   FAVORITES
   ========================================================= */

function renderFavorites() {

  const container =
    $("favoritesList");

  if (!container) return;

  const favorites =
    state.songs.filter(song =>
      state.favorites.includes(
        String(song.id)
      )
    );

  container.innerHTML = "";

  if (!favorites.length) {

    renderEmpty(
      container,
      "No favorite songs yet"
    );

    return;
  }

  favorites.forEach(
    (song,index) => {

      container.appendChild(
        createListSong(
          song,
          index,
          favorites
        )
      );
    }
  );
}


/* =========================================================
   SEARCH
   ========================================================= */

function bindSearch() {

  $("searchInput")
    .addEventListener(
      "input",
      event => {

        const query =
          event.target.value
            .trim()
            .toLowerCase();

        if (!query) {

          renderSongs();

          return;
        }

        const filtered =
          state.songs.filter(song =>
            [
              song.title,
              song.artist,
              song.category
            ]
              .join(" ")
              .toLowerCase()
              .includes(query)
          );

        showPage("songs");

        renderSongs(filtered);
      }
    );
}


/* =========================================================
   MODES
   ========================================================= */

function bindModeButtons() {

  $("audioModeBtn")
    .addEventListener(
      "click",
      () => setMode("audio")
    );

  $("videoModeBtn")
    .addEventListener(
      "click",
      () => setMode("video")
    );
}


function setMode(mode) {

  state.mode =
    mode;

  $("audioModeBtn")
    .classList.toggle(
      "active",
      mode === "audio"
    );

  $("videoModeBtn")
    .classList.toggle(
      "active",
      mode === "video"
    );

  const song =
    state.playlist[
      state.currentIndex
    ];

  /*
    If a YouTube song is already playing,
    recreate the player in the requested mode.
  */

  if (
    song &&
    song.youtube &&
    state.isPlaying
  ) {

    startSong(
      state.currentIndex
    );

    return;
  }

  if (mode === "audio") {

    closeVideoOverlay();
  }
}


/* =========================================================
   VIDEO OVERLAY
   ========================================================= */

function openVideoOverlay(song) {

  $("videoOverlay")
    .classList.remove("hidden");

  $("videoTitle").textContent =
    song.title;

  $("videoEmpty")
    .style.display =
    "none";
}


function closeVideoOverlay() {

  $("videoOverlay")
    .classList.add("hidden");

  $("youtubeContainer")
    .style.display =
    "none";

  $("uploadedVideo")
    .style.display =
    "none";
}


function bindVideoControls() {

  $("closeVideo")
    .addEventListener(
      "click",
      closeVideoOverlay
    );

  $("videoOverlay")
    .addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("videoOverlay")
        ) {
          closeVideoOverlay();
        }
      }
    );
}


/* =========================================================
   PLAYER CONTROLS
   ========================================================= */

function bindPlayerControls() {

  $("miniPlay")
    .addEventListener(
      "click",
      togglePlay
    );

  $("miniPrev")
    .addEventListener(
      "click",
      playPrevious
    );

  $("miniNext")
    .addEventListener(
      "click",
      playNext
    );

  $("miniStop")
    .addEventListener(
      "click",
      stopAll
    );

  $("heroPlayAll")
    .addEventListener(
      "click",
      playAll
    );

  $("playAllBtn")
    .addEventListener(
      "click",
      playAll
    );

  $("heroSongs")
    .addEventListener(
      "click",
      () =>
        showPage("songs")
    );
}


/* =========================================================
   ADMIN
   ========================================================= */

function bindAdmin() {

  $("adminLoginBtn")
    .addEventListener(
      "click",
      adminLogin
    );

  $("adminKey")
    .addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter"
        ) {
          adminLogin();
        }
      }
    );

  $("uploadAudioBtn")
    .addEventListener(
      "click",
      () => {

        uploadFiles(
          $("audioUpload"),
          "/api/admin/upload"
        );
      }
    );

  $("uploadVideoBtn")
    .addEventListener(
      "click",
      () => {

        uploadFiles(
          $("videoUpload"),
          "/api/admin/upload"
        );
      }
    );

  $("addYoutubeBtn")
    .addEventListener(
      "click",
      addYoutube
    );
}


async function adminLogin() {

  const key =
    $("adminKey")
      .value
      .trim();

  if (!key) {

    $("adminError").textContent =
      "Enter admin key";

    return;
  }

  $("adminError").textContent =
    "Checking...";

  try {

    const response =
      await fetch(
        "/api/admin/verify",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-key":
              key
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "Invalid admin key"
      );
    }

    state.adminKey =
      key;

    sessionStorage.setItem(
      "swaraj_admin_key",
      key
    );

    $("adminError").textContent =
      "";

    updateAdminUI();

    showToast(
      "Admin login successful",
      "success"
    );

  } catch (error) {

    $("adminError").textContent =
      error.message ||
      "Invalid admin key";
  }
}


function updateAdminUI() {

  const loggedIn =
    !!state.adminKey;

  $("adminLogin")
    .classList.toggle(
      "hidden",
      loggedIn
    );

  $("adminPanel")
    .classList.toggle(
      "hidden",
      !loggedIn
    );
}


/* =========================================================
   UPLOAD
   ========================================================= */

async function uploadFiles(
  input,
  endpoint
) {

  if (!state.adminKey) {

    showToast(
      "Login as admin first",
      "error"
    );

    return;
  }

  const files =
    input.files;

  if (!files.length) {

    showToast(
      "Select file(s) first",
      "error"
    );

    return;
  }

  const formData =
    new FormData();

  Array.from(files)
    .forEach(file => {

      formData.append(
        "files",
        file
      );
    });

  $("adminMessage").textContent =
    "Uploading...";

  try {

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "x-admin-key":
              state.adminKey
          },

          body: formData
        }
      );

    const text =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(text);
    } catch {
      data = {};
    }

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Upload failed"
      );
    }

    $("adminMessage").textContent =
      "Upload successful.";

    input.value = "";

    showToast(
      "Upload completed",
      "success"
    );

    await loadSongs();

  } catch (error) {

    console.error(error);

    $("adminMessage").textContent =
      error.message;

    showToast(
      error.message,
      "error"
    );
  }
}


/* =========================================================
   ADD YOUTUBE
   ========================================================= */

async function addYoutube() {

  if (!state.adminKey) {

    showToast(
      "Login as admin first",
      "error"
    );

    return;
  }

  const url =
    $("youtubeUrl")
      .value
      .trim();

  const title =
    $("youtubeTitle")
      .value
      .trim();

  const artist =
    $("youtubeArtist")
      .value
      .trim();

  const category =
    $("youtubeCategory")
      .value
      .trim();

  if (!url) {

    showToast(
      "Enter YouTube URL",
      "error"
    );

    return;
  }

  $("adminMessage").textContent =
    "Adding YouTube song...";

  try {

    const data =
      await api(
        "/api/admin/youtube",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              url,
              title,
              artist,
              category
            })
        }
      );

    $("adminMessage").textContent =
      "YouTube song added successfully.";

    $("youtubeUrl").value = "";
    $("youtubeTitle").value = "";
    $("youtubeArtist").value = "";
    $("youtubeCategory").value = "";

    showToast(
      "YouTube song added",
      "success"
    );

    await loadSongs();

  } catch (error) {

    console.error(error);

    $("adminMessage").textContent =
      error.message;

    showToast(
      error.message,
      "error"
    );
  }
}


/* =========================================================
   SERVER STATUS
   ========================================================= */

function setServerStatus(
  text,
  online
) {

  $("serverStatus").textContent =
    text;

  $("statusDot")
    .parentElement
    .classList.toggle(
      "online",
      online
    );
}


/* =========================================================
   HELPERS
   ========================================================= */

function extractYoutubeId(url) {

  if (!url) return "";

  const value =
    String(url).trim();

  const patterns = [

    /youtu\.be\/([^?&#/]+)/i,

    /youtube\.com\/watch\?[^#]*v=([^&#]+)/i,

    /youtube\.com\/shorts\/([^?&#/]+)/i,

    /youtube\.com\/embed\/([^?&#/]+)/i,

    /youtube\.com\/live\/([^?&#/]+)/i
  ];

  for (
    const pattern of patterns
  ) {

    const match =
      value.match(pattern);

    if (match) {
      return match[1];
    }
  }

  return "";
}


function typeLabel(song) {

  if (song.youtube) {
    return "YOUTUBE";
  }

  if (song.video) {
    return "VIDEO";
  }

  return "MP3";
}


function renderEmpty(
  container,
  message
) {

  container.innerHTML =
    `<div class="loading-card">
      ${escapeHtml(message)}
    </div>`;
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


function escapeAttr(value) {

  return escapeHtml(value);
}


/* =========================================================
   PERIODIC YOUTUBE PROGRESS
   ========================================================= */

setInterval(
  updateProgress,
  500
);


/* =========================================================
   KEEP PLAYER AVAILABLE AFTER MINIMIZING PAGE
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    /*
      Do NOT pause the player when the
      browser tab becomes hidden.

      Browser/OS policies ultimately decide
      whether background playback is allowed.
    */

    if (
      document.visibilityState ===
      "hidden"
    ) {
      return;
    }
  }
);