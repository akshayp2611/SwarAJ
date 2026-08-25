/* ============================================================
   SwarAJ Music Frontend
   MP3 + YouTube + Uploaded Video
   Audio / Video mode
   Play All / Next / Previous / Shuffle / Repeat
   ============================================================ */

"use strict";


/* ============================================================
   CONFIG
   ============================================================ */

const API = {
  songs: "/api/songs",
  health: "/api/health"
};


/* ============================================================
   STATE
   ============================================================ */

const state = {

  songs: [],

  filteredSongs: [],

  queue: [],

  queueIndex: -1,

  currentSong: null,

  isPlaying: false,

  shuffle: false,

  repeat: false,

  mode: localStorage.getItem("swarajMode") || "audio",

  youtubeReady: false,

  youtubePlayer: null,

  videoElement: null,

  search: "",

  liked: JSON.parse(
    localStorage.getItem("swarajLiked") || "[]"
  ),

  adminKey:
    sessionStorage.getItem("swarajAdminKey") || null

};


/* ============================================================
   DOM
   ============================================================ */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));


const audio = $("#audioPlayer");


/* ============================================================
   INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", init);


async function init() {

  setupNavigation();

  setupSearch();

  setupPlayerControls();

  setupModeControls();

  setupQuickActions();

  setupAdmin();

  setupMobileMenu();

  await checkServer();

  await loadSongs();

  loadYouTubeAPI();

  updateModeUI();

  renderLiked();

}


/* ============================================================
   SERVER
   ============================================================ */

async function checkServer() {

  const status = $("#serverStatusText");

  try {

    const response =
      await fetch(API.health, {
        cache: "no-store"
      });

    if (response.ok) {

      status.textContent = "Server online";

    } else {

      status.textContent = "Server warning";

    }

  } catch (error) {

    status.textContent = "Server unavailable";

  }

}


/* ============================================================
   LOAD SONGS
   ============================================================ */

async function loadSongs() {

  const containers = [
    "#homeSongs",
    "#allSongs",
    "#youtubeSongs",
    "#videoSongs",
    "#categories"
  ];

  try {

    const response =
      await fetch(
        API.songs + "?t=" + Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Songs API returned ${response.status}`
      );
    }

    const data = await response.json();

    let songs = [];

    if (Array.isArray(data)) {

      songs = data;

    } else if (Array.isArray(data.songs)) {

      songs = data.songs;

    } else if (Array.isArray(data.data)) {

      songs = data.data;

    }

    state.songs =
      songs.map(normalizeSong)
        .filter(Boolean);

    state.filteredSongs =
      [...state.songs];

    renderEverything();

    toast(
      `${state.songs.length} songs loaded`,
      "success"
    );

  } catch (error) {

    console.error(
      "Failed to load songs:",
      error
    );

    containers.forEach(selector => {

      const el = $(selector);

      if (el) {

        el.innerHTML = `
          <div class="empty-state">
            <div>⚠</div>
            <strong>Unable to load songs</strong>
            <small>
              ${escapeHTML(error.message)}
            </small>
          </div>
        `;

      }

    });

    toast(
      "Unable to load songs",
      "error"
    );

  }

}


/* ============================================================
   NORMALIZE DATABASE SONG
   ============================================================ */

function normalizeSong(raw, index = 0) {

  if (!raw || typeof raw !== "object") {
    return null;
  }


  const title =
    raw.title ||
    raw.name ||
    raw.song_name ||
    raw.songName ||
    `Song ${index + 1}`;


  const artist =
    raw.artist ||
    raw.singer ||
    raw.author ||
    raw.artist_name ||
    "Unknown Artist";


  const category =
    raw.category ||
    raw.genre ||
    raw.folder ||
    "All";


  let type =
    String(
      raw.type ||
      raw.source ||
      raw.mediaType ||
      raw.media_type ||
      ""
    )
    .toLowerCase();


  const youtubeId =
    extractYouTubeId(
      raw.youtubeId ||
      raw.youtube_id ||
      raw.youtubeID ||
      raw.youtubeUrl ||
      raw.youtube_url ||
      raw.videoUrl ||
      raw.video_url ||
      (type === "youtube" ? raw.url : "")
    );


  let url =
    raw.url ||
    raw.audioUrl ||
    raw.audio_url ||
    raw.fileUrl ||
    raw.file_url ||
    raw.path ||
    raw.file ||
    raw.src ||
    "";


  let videoUrl =
    raw.videoUrl ||
    raw.video_url ||
    raw.video ||
    "";


  const mime =
    String(
      raw.mimeType ||
      raw.mime_type ||
      raw.mimetype ||
      ""
    ).toLowerCase();


  const extension =
    getExtension(
      url || videoUrl
    );


  /*
   * Detect YouTube automatically.
   */

  if (
    youtubeId ||
    type.includes("youtube") ||
    type === "yt"
  ) {

    type = "youtube";

  }


  /*
   * Detect video.
   */

  else if (
    type.includes("video") ||
    mime.startsWith("video/") ||
    [
      "mp4",
      "webm",
      "mkv",
      "mov",
      "m4v",
      "avi"
    ].includes(extension)
  ) {

    type = "video";

  }


  /*
   * Everything else is MP3/audio.
   */

  else {

    type = "audio";

  }


  /*
   * Build relative media URL.
   */

  if (
    url &&
    !youtubeId &&
    !/^https?:\/\//i.test(url) &&
    !url.startsWith("/")
  ) {

    url = "/" + url;

  }


  if (
    videoUrl &&
    !/^https?:\/\//i.test(videoUrl) &&
    !videoUrl.startsWith("/")
  ) {

    videoUrl = "/" + videoUrl;

  }


  const image =
    raw.cover ||
    raw.coverUrl ||
    raw.cover_url ||
    raw.thumbnail ||
    raw.thumbnailUrl ||
    raw.image ||
    raw.imageUrl ||
    "";


  return {

    id:
      raw.id ??
      raw.songId ??
      raw.song_id ??
      `${type}-${index}-${title}`,

    title: String(title),

    artist: String(artist),

    category: String(category),

    type,

    url,

    videoUrl,

    youtubeId,

    youtubeUrl:
      youtubeId
        ? `https://www.youtube.com/watch?v=${youtubeId}`
        : "",

    image,

    duration:
      raw.duration ||
      raw.duration_seconds ||
      0,

    raw

  };

}


/* ============================================================
   YOUTUBE ID
   ============================================================ */

function extractYouTubeId(value) {

  if (!value) {
    return "";
  }

  const text = String(value).trim();

  /*
   * Already an ID
   */

  if (
    /^[a-zA-Z0-9_-]{11}$/.test(text)
  ) {

    return text;

  }


  const patterns = [

    /youtu\.be\/([a-zA-Z0-9_-]{11})/i,

    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i,

    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,

    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,

    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i

  ];


  for (const pattern of patterns) {

    const match =
      text.match(pattern);

    if (match) {
      return match[1];
    }

  }


  try {

    const url =
      new URL(text);

    const v =
      url.searchParams.get("v");

    if (
      v &&
      /^[a-zA-Z0-9_-]{11}$/.test(v)
    ) {

      return v;

    }

  } catch (_) {}


  return "";

}


/* ============================================================
   EXTENSION
   ============================================================ */

function getExtension(value) {

  if (!value) {
    return "";
  }

  const clean =
    String(value)
      .split("?")[0]
      .split("#")[0];

  const parts =
    clean.split(".");

  return (
    parts.length > 1
      ? parts.pop().toLowerCase()
      : ""
  );

}


/* ============================================================
   RENDER EVERYTHING
   ============================================================ */

function renderEverything() {

  renderHome();

  renderAllSongs();

  renderYouTube();

  renderVideos();

  renderCategories();

  renderLiked();

}


/* ============================================================
   HOME
   ============================================================ */

function renderHome() {

  const container =
    $("#homeSongs");

  if (!container) return;


  const songs =
    [...state.songs]
      .reverse()
      .slice(0, 12);


  if (!songs.length) {

    container.innerHTML =
      emptyHTML(
        "No songs",
        "Your database does not contain any songs yet."
      );

    return;

  }


  container.innerHTML =
    songs
      .map(songCardHTML)
      .join("");

  bindSongCards(container);

}


/* ============================================================
   ALL
   ============================================================ */

function renderAllSongs() {

  const container =
    $("#allSongs");

  if (!container) return;


  const songs =
    state.filteredSongs;


  $("#allCount").textContent =
    `${songs.length} song${songs.length === 1 ? "" : "s"}`;


  if (!songs.length) {

    container.innerHTML =
      emptyHTML(
        "No songs found",
        "Try another search."
      );

    return;

  }


  container.innerHTML =
    songs
      .map((song, index) =>
        songRowHTML(
          song,
          index
        )
      )
      .join("");


  bindSongRows(container);

}


/* ============================================================
   YOUTUBE
   ============================================================ */

function renderYouTube() {

  const container =
    $("#youtubeSongs");

  if (!container) return;


  const songs =
    state.songs
      .filter(song =>
        song.type === "youtube"
      );


  $("#youtubeCount").textContent =
    `${songs.length} YouTube song${songs.length === 1 ? "" : "s"}`;


  if (!songs.length) {

    container.innerHTML =
      emptyHTML(
        "No YouTube songs",
        "Add a YouTube song from the Admin panel."
      );

    return;

  }


  container.innerHTML =
    songs
      .map(songCardHTML)
      .join("");

  bindSongCards(container);

}


/* ============================================================
   VIDEOS
   ============================================================ */

function renderVideos() {

  const container =
    $("#videoSongs");

  if (!container) return;


  const videos =
    state.songs
      .filter(song =>
        song.type === "video" ||
        song.type === "youtube"
      );


  $("#videoCount").textContent =
    `${videos.length} video${videos.length === 1 ? "" : "s"}`;


  if (!videos.length) {

    container.innerHTML =
      emptyHTML(
        "No videos",
        "No YouTube or uploaded videos found."
      );

    return;

  }


  container.innerHTML =
    videos
      .map(videoItemHTML)
      .join("");


  $$(".video-item", container)
    .forEach((item, index) => {

      item.addEventListener(
        "click",
        () => {

          playSong(
            videos[index],
            videos
          );

        }
      );

    });

}


/* ============================================================
   CATEGORIES
   ============================================================ */

function renderCategories() {

  const container =
    $("#categories");

  if (!container) return;


  const map =
    new Map();


  state.songs.forEach(song => {

    const category =
      song.category || "All";

    map.set(
      category,
      (map.get(category) || 0) + 1
    );

  });


  if (!map.size) {

    container.innerHTML =
      emptyHTML(
        "No categories",
        "Add songs to create categories."
      );

    return;

  }


  const entries =
    [...map.entries()]
      .sort((a,b) =>
        a[0].localeCompare(b[0])
      );


  container.innerHTML =
    entries
      .map(
        ([name, count]) => `
          <button
            class="category-card"
            data-category="${escapeAttribute(name)}"
          >
            <span class="category-card-icon">◈</span>

            <strong>
              ${escapeHTML(name)}
            </strong>

            <small>
              ${count} song${count === 1 ? "" : "s"}
            </small>
          </button>
        `
      )
      .join("");


  $$(".category-card", container)
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          const category =
            card.dataset.category;

          state.filteredSongs =
            state.songs.filter(
              song =>
                song.category === category
            );

          switchTab("all");

          renderAllSongs();

        }
      );

    });

}


/* ============================================================
   SONG CARD
   ============================================================ */

function songCardHTML(song) {

  const liked =
    isLiked(song);


  return `
    <article
      class="song-card"
      data-song-id="${escapeAttribute(song.id)}"
    >

      <div class="song-cover">

        ${coverHTML(song)}

        <button
          class="song-play"
          data-action="play"
          title="Play"
        >
          ▶
        </button>

      </div>

      <div class="song-card-title">
        ${escapeHTML(song.title)}
      </div>

      <div class="song-card-artist">
        ${escapeHTML(song.artist)}
      </div>

      <div class="song-card-meta">

        <span class="media-badge">
          ${mediaLabel(song)}
        </span>

        <button
          class="like-card-btn ${liked ? "liked" : ""}"
          data-action="like"
          title="Like"
        >
          ${liked ? "♥" : "♡"}
        </button>

      </div>

    </article>
  `;

}


/* ============================================================
   SONG ROW
   ============================================================ */

function songRowHTML(song, index) {

  const liked =
    isLiked(song);


  return `
    <div
      class="song-row"
      data-song-id="${escapeAttribute(song.id)}"
    >

      <div class="song-number">
        ${index + 1}
      </div>

      <div class="row-cover">
        ${coverHTML(song)}
      </div>

      <div class="song-row-info">

        <div class="song-row-title">
          ${escapeHTML(song.title)}
        </div>

        <div class="song-row-artist">
          ${escapeHTML(song.artist)}
        </div>

      </div>

      <div class="song-row-category">
        ${escapeHTML(song.category)}
      </div>

      <div class="song-row-type">
        ${mediaLabel(song)}
      </div>

      <button
        class="row-play"
        data-action="play"
      >
        ▶
      </button>

    </div>
  `;

}


/* ============================================================
   COVER
   ============================================================ */

function coverHTML(song) {

  let image =
    song.image;


  if (
    !image &&
    song.youtubeId
  ) {

    image =
      `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`;

  }


  if (image) {

    return `
      <img
        src="${escapeAttribute(image)}"
        alt=""
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
      />

      <div
        class="cover-fallback"
        style="display:none"
      >
        ▶
      </div>
    `;

  }


  return `
    <div class="cover-fallback">
      ${song.type === "video" ? "🎬" : song.type === "youtube" ? "▶" : "♫"}
    </div>
  `;

}


/* ============================================================
   VIDEO ITEM
   ============================================================ */

function videoItemHTML(song) {

  let image =
    song.image;


  if (
    !image &&
    song.youtubeId
  ) {

    image =
      `https://i.ytimg.com/vi/${song.youtubeId}/mqdefault.jpg`;

  }


  return `
    <div
      class="video-item"
      data-song-id="${escapeAttribute(song.id)}"
    >

      <div class="video-thumb">

        ${
          image
            ? `
              <img
                src="${escapeAttribute(image)}"
                alt=""
                loading="lazy"
              />
            `
            : `
              <div class="cover-fallback">
                ${song.type === "youtube" ? "▶" : "🎬"}
              </div>
            `
        }

      </div>

      <div class="video-item-info">

        <strong>
          ${escapeHTML(song.title)}
        </strong>

        <small>
          ${escapeHTML(song.artist)}
        </small>

      </div>

    </div>
  `;

}


/* ============================================================
   BIND SONG CARDS
   ============================================================ */

function bindSongCards(container) {

  $$(".song-card", container)
    .forEach(card => {

      const id =
        card.dataset.songId;

      const song =
        state.songs.find(
          s => String(s.id) === String(id)
        );

      if (!song) return;


      card.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              '[data-action="like"]'
            )
          ) {

            toggleLike(song);

            return;

          }


          playSong(
            song,
            state.songs
          );

        }
      );

    });

}


/* ============================================================
   BIND ROWS
   ============================================================ */

function bindSongRows(container) {

  $$(".song-row", container)
    .forEach(row => {

      const id =
        row.dataset.songId;

      const song =
        state.songs.find(
          s => String(s.id) === String(id)
        );

      if (!song) return;


      row.addEventListener(
        "click",
        () => {

          playSong(
            song,
            state.filteredSongs
          );

        }
      );

    });

}


/* ============================================================
   PLAY SONG
   ============================================================ */

async function playSong(
  song,
  playlist = state.songs
) {

  if (!song) return;


  state.currentSong =
    song;


  state.queue =
    Array.isArray(playlist) &&
    playlist.length
      ? [...playlist]
      : [...state.songs];


  state.queueIndex =
    state.queue.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );


  if (state.queueIndex < 0) {
    state.queueIndex = 0;
  }


  updatePlayerUI();

  updateActiveRows();


  /*
   * VIDEO MODE
   */

  if (
    state.mode === "video"
  ) {

    if (
      song.type === "youtube" ||
      song.type === "video"
    ) {

      await playVideo(song);

      return;

    }

  }


  /*
   * AUDIO MODE
   *
   * YouTube:
   * hidden YouTube engine
   *
   * MP3:
   * normal audio element
   *
   * Uploaded video:
   * video can be played as audio
   */

  await playAudio(song);

}


/* ============================================================
   PLAY AUDIO
   ============================================================ */

async function playAudio(song) {

  stopVideoElement();

  hideVideoFrame();


  /*
   * YOUTUBE AUDIO
   */

  if (
    song.type === "youtube" &&
    song.youtubeId
  ) {

    if (!state.youtubeReady) {

      toast(
        "Preparing YouTube audio...",
        "info"
      );

      await waitForYouTube();

    }


    if (
      !state.youtubePlayer
    ) {

      toast(
        "YouTube player is not ready",
        "error"
      );

      return;

    }


    try {

      state.youtubePlayer.loadVideoById(
        song.youtubeId
      );

      state.youtubePlayer.playVideo();

      state.isPlaying = true;

      updatePlayButtons();

    } catch (error) {

      console.error(
        "YouTube audio error:",
        error
      );

      toast(
        "Unable to play YouTube song",
        "error"
      );

    }

    return;

  }


  /*
   * MP3 / UPLOADED MEDIA
   */

  const source =
    song.url ||
    song.videoUrl;


  if (!source) {

    toast(
      "No playable media URL found",
      "error"
    );

    return;

  }


  try {

    audio.pause();

    audio.src =
      addCacheBuster(source);

    audio.currentTime = 0;

    audio.volume =
      Number(
        $("#volumeBar")?.value || .85
      );

    await audio.play();

    state.isPlaying = true;

    updatePlayButtons();

  } catch (error) {

    console.error(
      "Audio playback error:",
      error
    );

    toast(
      "Unable to play this file",
      "error"
    );

  }

}


/* ============================================================
   PLAY VIDEO
   ============================================================ */

async function playVideo(song) {

  stopAudio();

  showVideoFrame();


  const wrap =
    $("#videoFrameWrap");

  const title =
    $("#videoTitle");


  if (title) {
    title.textContent =
      song.title;
  }


  /*
   * YOUTUBE VIDEO
   */

  if (
    song.type === "youtube" &&
    song.youtubeId
  ) {

    stopVideoElement();


    wrap.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(song.youtubeId)}?autoplay=1&rel=0&modestbranding=1"
        title="${escapeAttribute(song.title)}"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen
      ></iframe>
    `;


    state.isPlaying = true;

    updatePlayButtons();

    return;

  }


  /*
   * UPLOADED VIDEO
   */

  const source =
    song.videoUrl ||
    song.url;


  if (!source) {

    toast(
      "Video URL not found",
      "error"
    );

    return;

  }


  wrap.innerHTML = `
    <video
      id="swarajVideo"
      controls
      playsinline
      preload="auto"
    ></video>
  `;


  const video =
    $("#swarajVideo");


  state.videoElement =
    video;


  video.src =
    addCacheBuster(source);


  video.volume =
    Number(
      $("#volumeBar")?.value || .85
    );


  try {

    await video.play();

    state.isPlaying = true;

    updatePlayButtons();

  } catch (error) {

    console.error(
      "Video playback error:",
      error
    );

    toast(
      "Tap the video play button to start",
      "info"
    );

  }


  video.addEventListener(
    "play",
    () => {

      state.isPlaying = true;

      updatePlayButtons();

    }
  );


  video.addEventListener(
    "pause",
    () => {

      state.isPlaying = false;

      updatePlayButtons();

    }
  );


  video.addEventListener(
    "ended",
    handleMediaEnded
  );

}


/* ============================================================
   STOP AUDIO
   ============================================================ */

function stopAudio() {

  try {

    audio.pause();

  } catch (_) {}


  /*
   * Stop hidden YouTube player.
   */

  if (
    state.youtubePlayer
  ) {

    try {

      state.youtubePlayer.stopVideo();

    } catch (_) {}

  }

}


/* ============================================================
   STOP VIDEO ELEMENT
   ============================================================ */

function stopVideoElement() {

  if (
    state.videoElement
  ) {

    try {

      state.videoElement.pause();

      state.videoElement.removeAttribute(
        "src"
      );

      state.videoElement.load();

    } catch (_) {}

  }

  state.videoElement =
    null;

}


/* ============================================================
   HIDE VIDEO
   ============================================================ */

function hideVideoFrame() {

  const wrap =
    $("#videoFrameWrap");

  if (!wrap) return;


  wrap.innerHTML = `
    <div
      class="video-placeholder"
      id="videoPlaceholder"
    >
      <div class="video-placeholder-icon">
        ▶
      </div>

      <strong>
        Video mode is off
      </strong>

      <small>
        Switch to Video mode to see video.
      </small>
    </div>
  `;

}


/* ============================================================
   SHOW VIDEO
   ============================================================ */

function showVideoFrame() {

  const wrap =
    $("#videoFrameWrap");

  if (!wrap) return;

  wrap.style.display =
    "block";

}


/* ============================================================
   PLAY ALL
   ============================================================ */

function playAll(
  playlist = state.songs
) {

  const songs =
    playlist.filter(
      Boolean
    );


  if (!songs.length) {

    toast(
      "No songs available",
      "error"
    );

    return;

  }


  state.shuffle = false;

  state.queue =
    [...songs];

  state.queueIndex = 0;

  playSong(
    state.queue[0],
    state.queue
  );

}


/* ============================================================
   SHUFFLE ALL
   ============================================================ */

function shuffleAll() {

  if (!state.songs.length) {

    toast(
      "No songs available",
      "error"
    );

    return;

  }


  const shuffled =
    [...state.songs];


  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      shuffled[i],
      shuffled[j]
    ] =
    [
      shuffled[j],
      shuffled[i]
    ];

  }


  state.shuffle = true;

  state.queue =
    shuffled;

  state.queueIndex = 0;

  playSong(
    shuffled[0],
    shuffled
  );

}


/* ============================================================
   NEXT
   ============================================================ */

function nextSong() {

  if (!state.queue.length) {

    state.queue =
      [...state.songs];

  }


  /*
   * Shuffle
   */

  if (state.shuffle) {

    if (
      state.queue.length === 1
    ) {

      state.queueIndex = 0;

    } else {

      let next;

      do {

        next =
          Math.floor(
            Math.random() *
            state.queue.length
          );

      } while (
        next === state.queueIndex
      );

      state.queueIndex =
        next;

    }

  }


  /*
   * Normal queue
   */

  else {

    state.queueIndex++;

    if (
      state.queueIndex >=
      state.queue.length
    ) {

      if (state.repeat) {

        state.queueIndex = 0;

      } else {

        state.queueIndex = 0;

        state.isPlaying = false;

        updatePlayButtons();

        toast(
          "Playlist finished",
          "info"
        );

        return;

      }

    }

  }


  playSong(
    state.queue[state.queueIndex],
    state.queue
  );

}


/* ============================================================
   PREVIOUS
   ============================================================ */

function previousSong() {

  if (!state.queue.length) {

    state.queue =
      [...state.songs];

  }


  /*
   * Restart current song
   * when > 3 seconds.
   */

  if (
    getCurrentTime() > 3
  ) {

    restartCurrent();

    return;

  }


  state.queueIndex--;

  if (
    state.queueIndex < 0
  ) {

    state.queueIndex =
      state.queue.length - 1;

  }


  playSong(
    state.queue[state.queueIndex],
    state.queue
  );

}


/* ============================================================
   RESTART
   ============================================================ */

function restartCurrent() {

  if (
    state.currentSong?.type ===
    "youtube"
  ) {

    if (
      state.youtubePlayer
    ) {

      state.youtubePlayer.seekTo(
        0,
        true
      );

    }

    return;

  }


  if (
    state.videoElement
  ) {

    state.videoElement.currentTime =
      0;

    return;

  }


  audio.currentTime =
    0;

}


/* ============================================================
   PLAY / PAUSE
   ============================================================ */

async function togglePlayPause() {

  if (!state.currentSong) {

    playAll();

    return;

  }


  if (
    state.currentSong.type ===
    "youtube" &&
    state.mode === "audio"
  ) {

    if (
      !state.youtubePlayer
    ) {

      playSong(
        state.currentSong,
        state.queue
      );

      return;

    }


    const playerState =
      state.youtubePlayer.getPlayerState();


    /*
     * 1 = playing
     * 2 = paused
     */

    if (playerState === 1) {

      state.youtubePlayer.pauseVideo();

      state.isPlaying = false;

    } else {

      state.youtubePlayer.playVideo();

      state.isPlaying = true;

    }


    updatePlayButtons();

    return;

  }


  if (
    state.videoElement
  ) {

    if (
      state.videoElement.paused
    ) {

      await state.videoElement.play();

    } else {

      state.videoElement.pause();

    }

    return;

  }


  if (
    audio.paused
  ) {

    try {

      await audio.play();

      state.isPlaying = true;

    } catch (error) {

      console.error(error);

    }

  } else {

    audio.pause();

    state.isPlaying = false;

  }


  updatePlayButtons();

}


/* ============================================================
   MEDIA ENDED
   ============================================================ */

function handleMediaEnded() {

  if (state.repeat) {

    restartCurrent();

    return;

  }


  nextSong();

}


/* ============================================================
   AUDIO EVENTS
   ============================================================ */

audio.addEventListener(
  "play",
  () => {

    state.isPlaying = true;

    updatePlayButtons();

  }
);


audio.addEventListener(
  "pause",
  () => {

    state.isPlaying = false;

    updatePlayButtons();

  }
);


audio.addEventListener(
  "ended",
  handleMediaEnded
);


audio.addEventListener(
  "loadedmetadata",
  () => {

    updateDuration(
      audio.duration
    );

  }
);


audio.addEventListener(
  "timeupdate",
  () => {

    if (
      !audio.duration
    ) return;


    updateProgress(
      audio.currentTime,
      audio.duration
    );

  }
);


/* ============================================================
   PLAYER UI
   ============================================================ */

function updatePlayerUI() {

  const song =
    state.currentSong;


  if (!song) return;


  const title =
    song.title;

  const artist =
    song.artist;


  $("#playerTitle").textContent =
    title;

  $("#playerArtist").textContent =
    artist;

  $("#mobileTitle").textContent =
    title;

  $("#mobileArtist").textContent =
    artist;


  const art =
    $("#playerArt");


  if (art) {

    if (song.image) {

      art.innerHTML = `
        <img
          src="${escapeAttribute(song.image)}"
          alt=""
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        />
      `;

    } else if (song.youtubeId) {

      art.innerHTML = `
        <img
          src="https://i.ytimg.com/vi/${song.youtubeId}/default.jpg"
          alt=""
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
          "
        />
      `;

    } else {

      art.innerHTML =
        "<span>स्व</span>";

    }

  }


  $("#playerLike").textContent =
    isLiked(song)
      ? "♥"
      : "♡";


  $("#playerLike").classList.toggle(
    "liked",
    isLiked(song)
  );

}


/* ============================================================
   PLAY BUTTONS
   ============================================================ */

function updatePlayButtons() {

  const symbol =
    state.isPlaying
      ? "❚❚"
      : "▶";


  const main =
    $("#playPauseBtn");

  const mobile =
    $("#mobilePlay");


  if (main) {
    main.textContent =
      symbol;
  }

  if (mobile) {
    mobile.textContent =
      symbol;
  }

}


/* ============================================================
   ACTIVE ROW
   ============================================================ */

function updateActiveRows() {

  $$(".song-row")
    .forEach(row => {

      row.classList.toggle(
        "playing",
        String(
          row.dataset.songId
        ) ===
        String(
          state.currentSong?.id
        )
      );

    });

}


/* ============================================================
   PROGRESS
   ============================================================ */

function updateProgress(
  current,
  duration
) {

  const percent =
    duration
      ? (current / duration) * 100
      : 0;


  const progress =
    $("#progressBar");

  if (progress) {

    progress.value =
      percent || 0;

  }


  $("#currentTime").textContent =
    formatTime(current);

  $("#duration").textContent =
    formatTime(duration);

}


/* ============================================================
   DURATION
   ============================================================ */

function updateDuration(
  duration
) {

  $("#duration").textContent =
    formatTime(duration);

}


/* ============================================================
   CURRENT TIME
   ============================================================ */

function getCurrentTime() {

  if (
    state.videoElement
  ) {

    return (
      state.videoElement.currentTime ||
      0
    );

  }


  if (
    state.currentSong?.type ===
    "youtube" &&
    state.youtubePlayer
  ) {

    try {

      return (
        state.youtubePlayer.getCurrentTime() ||
        0
      );

    } catch (_) {}

  }


  return (
    audio.currentTime ||
    0
  );

}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {

  $$(".nav-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          switchTab(
            button.dataset.tab
          );

          closeMobileMenu();

        }
      );

    });


  $$("[data-tab-target]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          switchTab(
            button.dataset.tabTarget
          );

        }
      );

    });

}


function switchTab(tab) {

  $$(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tab === tab
      );

    });


  $$(".tab-section")
    .forEach(section => {

      section.classList.toggle(
        "active",
        section.id ===
        `tab-${tab}`
      );

    });

}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

  const input =
    $("#searchInput");


  input.addEventListener(
    "input",
    () => {

      state.search =
        input.value
          .trim()
          .toLowerCase();


      $("#clearSearch")
        .classList.toggle(
          "hidden",
          !state.search
        );


      if (!state.search) {

        state.filteredSongs =
          [...state.songs];

      } else {

        state.filteredSongs =
          state.songs.filter(
            song =>
              [
                song.title,
                song.artist,
                song.category,
                song.type
              ]
              .join(" ")
              .toLowerCase()
              .includes(
                state.search
              )
          );

      }


      switchTab("all");

      renderAllSongs();

    }
  );


  $("#clearSearch")
    .addEventListener(
      "click",
      () => {

        input.value = "";

        input.dispatchEvent(
          new Event("input")
        );

      }
    );

}


/* ============================================================
   PLAYER CONTROLS
   ============================================================ */

function setupPlayerControls() {

  $("#playPauseBtn")
    .addEventListener(
      "click",
      togglePlayPause
    );


  $("#nextBtn")
    .addEventListener(
      "click",
      nextSong
    );


  $("#previousBtn")
    .addEventListener(
      "click",
      previousSong
    );


  $("#shuffleBtn")
    .addEventListener(
      "click",
      () => {

        state.shuffle =
          !state.shuffle;

        $("#shuffleBtn")
          .classList.toggle(
            "active",
            state.shuffle
          );

        toast(
          state.shuffle
            ? "Shuffle enabled"
            : "Shuffle disabled",
          "info"
        );

      }
    );


  $("#repeatBtn")
    .addEventListener(
      "click",
      () => {

        state.repeat =
          !state.repeat;

        $("#repeatBtn")
          .classList.toggle(
            "active",
            state.repeat
          );

        toast(
          state.repeat
            ? "Repeat enabled"
            : "Repeat disabled",
          "info"
        );

      }
    );


  $("#progressBar")
    .addEventListener(
      "input",
      event => {

        const percent =
          Number(
            event.target.value
          );


        const duration =
          getDuration();


        if (!duration) return;


        const time =
          duration *
          (percent / 100);


        seekTo(time);

      }
    );


  $("#volumeBar")
    .addEventListener(
      "input",
      event => {

        const volume =
          Number(
            event.target.value
          );


        audio.volume =
          volume;


        if (
          state.videoElement
        ) {

          state.videoElement.volume =
            volume;

        }


        if (
          state.youtubePlayer
        ) {

          try {

            state.youtubePlayer.setVolume(
              volume * 100
            );

          } catch (_) {}

        }


        localStorage.setItem(
          "swarajVolume",
          String(volume)
        );

      }
    );


  const savedVolume =
    localStorage.getItem(
      "swarajVolume"
    );


  if (savedVolume !== null) {

    const volume =
      Number(savedVolume);


    $("#volumeBar").value =
      volume;

    audio.volume =
      volume;

  }


  $("#playerLike")
    .addEventListener(
      "click",
      () => {

        if (
          state.currentSong
        ) {

          toggleLike(
            state.currentSong
          );

        }

      }
    );


  $("#mobilePlay")
    .addEventListener(
      "click",
      togglePlayPause
    );


  $("#mobileNext")
    .addEventListener(
      "click",
      nextSong
    );


  $("#mobilePrevious")
    .addEventListener(
      "click",
      previousSong
    );

}


/* ============================================================
   DURATION
   ============================================================ */

function getDuration() {

  if (
    state.videoElement &&
    Number.isFinite(
      state.videoElement.duration
    )
  ) {

    return state.videoElement.duration;

  }


  if (
    state.currentSong?.type ===
    "youtube" &&
    state.youtubePlayer
  ) {

    try {

      return (
        state.youtubePlayer.getDuration() ||
        0
      );

    } catch (_) {}

  }


  return (
    audio.duration || 0
  );

}


/* ============================================================
   SEEK
   ============================================================ */

function seekTo(time) {

  if (
    state.videoElement
  ) {

    state.videoElement.currentTime =
      time;

    return;

  }


  if (
    state.currentSong?.type ===
    "youtube" &&
    state.youtubePlayer
  ) {

    try {

      state.youtubePlayer.seekTo(
        time,
        true
      );

    } catch (_) {}

    return;

  }


  audio.currentTime =
    time;

}


/* ============================================================
   MODE
   ============================================================ */

function setupModeControls() {

  $("#audioModeBtn")
    .addEventListener(
      "click",
      () => {

        setMode("audio");

      }
    );


  $("#videoModeBtn")
    .addEventListener(
      "click",
      () => {

        setMode("video");

      }
    );

}


function setMode(mode) {

  state.mode =
    mode;

  localStorage.setItem(
    "swarajMode",
    mode
  );


  updateModeUI();


  if (
    state.currentSong
  ) {

    playSong(
      state.currentSong,
      state.queue.length
        ? state.queue
        : state.songs
    );

  }

}


function updateModeUI() {

  $("#audioModeBtn")
    .classList.toggle(
      "active",
      state.mode === "audio"
    );


  $("#videoModeBtn")
    .classList.toggle(
      "active",
      state.mode === "video"
    );


  if (
    state.mode === "audio"
  ) {

    hideVideoFrame();

  }

}


/* ============================================================
   QUICK ACTIONS
   ============================================================ */

function setupQuickActions() {

  $("#heroPlayAll")
    .addEventListener(
      "click",
      () => playAll()
    );


  $("#quickPlayAll")
    .addEventListener(
      "click",
      () => playAll()
    );


  $("#allPlay")
    .addEventListener(
      "click",
      () => playAll(
        state.filteredSongs
      )
    );


  $("#youtubePlayAll")
    .addEventListener(
      "click",
      () => {

        playAll(
          state.songs.filter(
            song =>
              song.type === "youtube"
          )
        );

      }
    );


  $("#videoPlayAll")
    .addEventListener(
      "click",
      () => {

        setMode("video");

        playAll(
          state.songs.filter(
            song =>
              song.type === "video" ||
              song.type === "youtube"
          )
        );

      }
    );


  $("#heroShuffle")
    .addEventListener(
      "click",
      shuffleAll
    );


  $("#quickShuffle")
    .addEventListener(
      "click",
      shuffleAll
    );


  $("#allShuffle")
    .addEventListener(
      "click",
      () => {

        const list =
          state.filteredSongs.length
            ? state.filteredSongs
            : state.songs;


        const shuffled =
          shuffleArray(list);


        state.shuffle = true;

        state.queue =
          shuffled;

        state.queueIndex = 0;

        playSong(
          shuffled[0],
          shuffled
        );

      }
    );


  $("#quickYoutube")
    .addEventListener(
      "click",
      () => {

        switchTab("youtube");

      }
    );


  $("#quickVideos")
    .addEventListener(
      "click",
      () => {

        switchTab("videos");

      }
    );


  $("#adminShortcut")
    .addEventListener(
      "click",
      () => {

        switchTab("admin");

      }
    );

}


/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {

  $("#menuBtn")
    .addEventListener(
      "click",
      () => {

        $("#sidebar")
          .classList.add("open");

      }
    );


  $("#mobileCloseBtn")
    .addEventListener(
      "click",
      closeMobileMenu
    );

}


function closeMobileMenu() {

  $("#sidebar")
    .classList.remove("open");

}


/* ============================================================
   YOUTUBE API
   ============================================================ */

function loadYouTubeAPI() {

  if (
    document.getElementById(
      "youtube-api-script"
    )
  ) {

    return;

  }


  const script =
    document.createElement("script");

  script.id =
    "youtube-api-script";

  script.src =
    "https://www.youtube.com/iframe_api";

  script.async = true;

  document.head.appendChild(
    script
  );

}


/*
 * YouTube calls this globally.
 */

window.onYouTubeIframeAPIReady =
  function () {

    try {

      state.youtubePlayer =
        new YT.Player(
          "youtubePlayer",
          {

            width: "1",

            height: "1",

            videoId: "",

            playerVars: {

              autoplay: 0,

              controls: 0,

              rel: 0,

              modestbranding: 1,

              playsinline: 1

            },

            events: {

              onReady:
                onYouTubeReady,

              onStateChange:
                onYouTubeStateChange,

              onError:
                onYouTubeError

            }

          }
        );

    } catch (error) {

      console.error(
        "YouTube initialization failed:",
        error
      );

    }

  };


function onYouTubeReady(event) {

  state.youtubeReady =
    true;


  const savedVolume =
    Number(
      $("#volumeBar")?.value || .85
    );


  try {

    event.target.setVolume(
      savedVolume * 100
    );

  } catch (_) {}

}


function onYouTubeStateChange(event) {

  /*
   * YT.PlayerState.ENDED = 0
   * PLAYING = 1
   * PAUSED = 2
   */

  if (
    event.data === 1
  ) {

    state.isPlaying = true;

    updatePlayButtons();

    startYouTubeProgress();

  }


  if (
    event.data === 2
  ) {

    state.isPlaying = false;

    updatePlayButtons();

  }


  if (
    event.data === 0
  ) {

    state.isPlaying = false;

    updatePlayButtons();

    handleMediaEnded();

  }

}


function onYouTubeError(event) {

  console.error(
    "YouTube error:",
    event.data
  );


  toast(
    "This YouTube video cannot be played.",
    "error"
  );


  /*
   * Automatically try next song.
   */

  setTimeout(
    () => nextSong(),
    800
  );

}


/* ============================================================
   YOUTUBE PROGRESS
   ============================================================ */

let youtubeProgressTimer =
  null;


function startYouTubeProgress() {

  clearInterval(
    youtubeProgressTimer
  );


  youtubeProgressTimer =
    setInterval(
      () => {

        if (
          !state.youtubePlayer ||
          !state.currentSong ||
          state.currentSong.type !== "youtube"
        ) {

          return;

        }


        try {

          const current =
            state.youtubePlayer.getCurrentTime();

          const duration =
            state.youtubePlayer.getDuration();


          updateProgress(
            current,
            duration
          );

        } catch (_) {}

      },
      500
    );

}


/* ============================================================
   WAIT FOR YOUTUBE
   ============================================================ */

function waitForYouTube(
  timeout = 10000
) {

  return new Promise(
    resolve => {

      const started =
        Date.now();


      const timer =
        setInterval(
          () => {

            if (
              state.youtubeReady &&
              state.youtubePlayer
            ) {

              clearInterval(timer);

              resolve(true);

              return;

            }


            if (
              Date.now() - started >
              timeout
            ) {

              clearInterval(timer);

              resolve(false);

            }

          },
          100
        );

    }
  );

}


/* ============================================================
   ADMIN
   ============================================================ */

function setupAdmin() {

  const form =
    $("#adminLoginForm");


  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const key =
        $("#adminKeyInput")
          .value
          .trim();


      if (!key) {

        showAdminMessage(
          "Enter admin key.",
          "error"
        );

        return;

      }


      /*
       * We verify using a lightweight
       * admin request if available.
       *
       * If your server uses another
       * admin endpoint, update only
       * verifyAdminKey().
       */

      const valid =
        await verifyAdminKey(key);


      if (!valid) {

        showAdminMessage(
          "Invalid admin key.",
          "error"
        );

        return;

      }


      state.adminKey =
        key;


      sessionStorage.setItem(
        "swarajAdminKey",
        key
      );


      showAdminPanel();

    }
  );


  $("#adminLogout")
    .addEventListener(
      "click",
      logoutAdmin
    );


  setupYouTubeForm();

  setupUploadForm();


  if (
    state.adminKey
  ) {

    verifyAdminKey(
      state.adminKey
    )
    .then(valid => {

      if (valid) {

        showAdminPanel();

      } else {

        logoutAdmin();

      }

    });

  }

}


/* ============================================================
   VERIFY ADMIN
   ============================================================ */

async function verifyAdminKey(key) {

  /*
   * Try common endpoints.
   */

  const endpoints = [

    "/api/admin/verify",

    "/api/admin",

    "/api/admin/status"

  ];


  for (
    const endpoint of endpoints
  ) {

    try {

      const response =
        await fetch(
          endpoint,
          {
            method: "GET",
            headers: {
              "x-admin-key": key,
              "Authorization":
                `Bearer ${key}`
            }
          }
        );


      /*
       * 404 means this endpoint
       * does not exist in current server.
       * Try next endpoint.
       */

      if (
        response.status === 404
      ) {

        continue;

      }


      if (
        response.ok
      ) {

        return true;

      }

      /*
       * Existing endpoint but
       * unauthorized.
       */

      if (
        response.status === 401 ||
        response.status === 403
      ) {

        return false;

      }

    } catch (_) {

      continue;

    }

  }


  /*
   * If server doesn't expose
   * verification endpoint, allow
   * the key to be stored.
   *
   * Actual admin operations will
   * still be authenticated by server.
   */

  return true;

}


/* ============================================================
   SHOW ADMIN
   ============================================================ */

function showAdminPanel() {

  $("#adminLoginCard")
    .classList.add("hidden");


  $("#adminPanel")
    .classList.remove("hidden");


  $("#adminLoginMessage")
    .textContent = "";

}


/* ============================================================
   LOGOUT
   ============================================================ */

function logoutAdmin() {

  state.adminKey =
    null;


  sessionStorage.removeItem(
    "swarajAdminKey"
  );


  $("#adminPanel")
    .classList.add("hidden");


  $("#adminLoginCard")
    .classList.remove("hidden");


  $("#adminKeyInput")
    .value = "";

}


/* ============================================================
   ADMIN MESSAGE
   ============================================================ */

function showAdminMessage(
  message,
  type = ""
) {

  const element =
    $("#adminLoginMessage");


  element.textContent =
    message;


  element.className =
    "form-message " +
    type;

}


/* ============================================================
   YOUTUBE ADMIN FORM
   ============================================================ */

function setupYouTubeForm() {

  $("#youtubeForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const payload = {

          title:
            $("#ytTitle").value.trim(),

          artist:
            $("#ytArtist").value.trim(),

          category:
            $("#ytCategory").value.trim() ||
            "YouTube",

          url:
            $("#ytUrl").value.trim(),

          type:
            "youtube"

        };


        if (
          !payload.title ||
          !payload.url
        ) {

          showFormMessage(
            "#youtubeAdminMessage",
            "Title and YouTube URL are required.",
            "error"
          );

          return;

        }


        const endpoint =
          "/api/admin/youtube";


        try {

          const response =
            await fetch(
              endpoint,
              {
                method: "POST",

                headers: {

                  "Content-Type":
                    "application/json",

                  "x-admin-key":
                    state.adminKey || "",

                  "Authorization":
                    `Bearer ${state.adminKey || ""}`

                },

                body:
                  JSON.stringify(payload)

              }
            );


          const data =
            await parseJSON(response);


          if (!response.ok) {

            throw new Error(
              data?.error ||
              data?.message ||
              `Request failed (${response.status})`
            );

          }


          showFormMessage(
            "#youtubeAdminMessage",
            "YouTube song added successfully.",
            "success"
          );


          $("#youtubeForm")
            .reset();


          $("#ytCategory").value =
            "YouTube";


          await loadSongs();


        } catch (error) {

          console.error(error);


          showFormMessage(
            "#youtubeAdminMessage",
            error.message,
            "error"
          );

        }

      }
    );

}


/* ============================================================
   UPLOAD FORM
   ============================================================ */

function setupUploadForm() {

  $("#uploadForm")
    .addEventListener(
      "submit",
      event => {

        event.preventDefault();

        uploadMedia();

      }
    );

}


/* ============================================================
   UPLOAD MEDIA
   ============================================================ */

function uploadMedia() {

  const file =
    $("#mediaFile")
      .files[0];


  if (!file) {

    showFormMessage(
      "#uploadMessage",
      "Select a file first.",
      "error"
    );

    return;

  }


  const formData =
    new FormData();


  const title =
    $("#uploadTitle")
      .value
      .trim();


  const artist =
    $("#uploadArtist")
      .value
      .trim();


  const category =
    $("#uploadCategory")
      .value
      .trim() ||
    "Uploaded";


  formData.append(
    "title",
    title ||
    file.name
  );


  formData.append(
    "artist",
    artist ||
    "Unknown Artist"
  );


  formData.append(
    "category",
    category
  );


  formData.append(
    "file",
    file
  );


  const xhr =
    new XMLHttpRequest();


  const progress =
    $("#uploadProgress");


  const fill =
    $("#progressFill");


  const text =
    $("#progressText");


  progress.classList.remove(
    "hidden"
  );


  fill.style.width =
    "0%";


  xhr.upload.onprogress =
    event => {

      if (!event.lengthComputable) {
        return;
      }


      const percent =
        Math.round(
          (event.loaded /
            event.total) *
          100
        );


      fill.style.width =
        percent + "%";


      text.textContent =
        `Uploading ${percent}%`;

    };


  xhr.onload =
    async () => {

      progress.classList.add(
        "hidden"
      );


      let data = {};

      try {

        data =
          JSON.parse(
            xhr.responseText
          );

      } catch (_) {}


      if (
        xhr.status >= 200 &&
        xhr.status < 300
      ) {

        showFormMessage(
          "#uploadMessage",
          "Media uploaded successfully.",
          "success"
        );


        $("#uploadForm")
          .reset();


        await loadSongs();

      } else {

        showFormMessage(
          "#uploadMessage",
          data.error ||
          data.message ||
          "Upload failed.",
          "error"
        );

      }

    };


  xhr.onerror =
    () => {

      progress.classList.add(
        "hidden"
      );


      showFormMessage(
        "#uploadMessage",
        "Upload failed. Check server connection.",
        "error"
      );

    };


  xhr.open(
    "POST",
    "/api/admin/upload"
  );


  if (state.adminKey) {

    xhr.setRequestHeader(
      "x-admin-key",
      state.adminKey
    );


    xhr.setRequestHeader(
      "Authorization",
      `Bearer ${state.adminKey}`
    );

  }


  xhr.send(
    formData
  );

}


/* ============================================================
   LIKED SONGS
   ============================================================ */

function isLiked(song) {

  return state.liked.some(
    id =>
      String(id) ===
      String(song.id)
  );

}


function toggleLike(song) {

  const id =
    String(song.id);


  if (
    isLiked(song)
  ) {

    state.liked =
      state.liked.filter(
        likedId =>
          String(likedId) !==
          id
      );

  } else {

    state.liked.push(id);

  }


  localStorage.setItem(
    "swarajLiked",
    JSON.stringify(
      state.liked
    )
  );


  updatePlayerUI();

  renderEverything();

}


/* ============================================================
   RENDER LIKED
   ============================================================ */

function renderLiked() {

  const container =
    $("#likedSongs");

  if (!container) return;


  const songs =
    state.songs.filter(
      song =>
        isLiked(song)
    );


  if (!songs.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div>♡</div>
        <strong>No liked songs</strong>
        <small>
          Tap the heart on a song to add it here.
        </small>
      </div>
    `;

    return;

  }


  container.innerHTML =
    songs
      .map(
        (song, index) =>
          songRowHTML(
            song,
            index
          )
      )
      .join("");


  bindSongRows(container);

}


/* ============================================================
   TOAST
   ============================================================ */

function toast(
  message,
  type = "info"
) {

  const container =
    $("#toastContainer");


  const item =
    document.createElement("div");


  item.className =
    "toast";


  item.textContent =
    message;


  if (
    type === "success"
  ) {

    item.style.borderColor =
      "rgba(53,229,155,.25)";

  }


  if (
    type === "error"
  ) {

    item.style.borderColor =
      "rgba(255,49,92,.3)";

  }


  container.appendChild(
    item
  );


  setTimeout(
    () => {

      item.remove();

    },
    2800
  );

}


/* ============================================================
   FORM MESSAGE
   ============================================================ */

function showFormMessage(
  selector,
  message,
  type = ""
) {

  const element =
    $(selector);


  if (!element) return;


  element.textContent =
    message;


  element.className =
    "form-message " +
    type;

}


/* ============================================================
   JSON
   ============================================================ */

async function parseJSON(
  response
) {

  try {

    return await response.json();

  } catch (_) {

    return {};

  }

}


/* ============================================================
   SHUFFLE ARRAY
   ============================================================ */

function shuffleArray(array) {

  const result =
    [...array];


  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      result[i],
      result[j]
    ] =
    [
      result[j],
      result[i]
    ];

  }


  return result;

}


/* ============================================================
   CACHE BUSTER
   ============================================================ */

function addCacheBuster(url) {

  if (!url) {
    return url;
  }


  /*
   * Don't modify data/blob URLs.
   */

  if (
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {

    return url;

  }


  /*
   * Avoid adding cache busting to
   * external YouTube URLs.
   */

  if (
    /youtube\.com|youtu\.be/i.test(url)
  ) {

    return url;

  }


  return (
    url +
    (
      url.includes("?")
        ? "&"
        : "?"
    ) +
    "_swaraj=" +
    Date.now()
  );

}


/* ============================================================
   MEDIA LABEL
   ============================================================ */

function mediaLabel(song) {

  if (
    song.type === "youtube"
  ) {

    return "YouTube";

  }

  if (
    song.type === "video"
  ) {

    return "Video";

  }

  return "MP3";

}


/* ============================================================
   EMPTY
   ============================================================ */

function emptyHTML(
  title,
  message
) {

  return `
    <div class="empty-state">

      <div>♫</div>

      <strong>
        ${escapeHTML(title)}
      </strong>

      <small>
        ${escapeHTML(message)}
      </small>

    </div>
  `;

}


/* ============================================================
   FORMAT TIME
   ============================================================ */

function formatTime(seconds) {

  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {

    return "0:00";

  }


  seconds =
    Math.floor(seconds);


  const minutes =
    Math.floor(
      seconds / 60
    );


  const remaining =
    seconds % 60;


  return (
    `${minutes}:${String(
      remaining
    ).padStart(2, "0")}`
  );

}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* ============================================================
   ESCAPE ATTRIBUTE
   ============================================================ */

function escapeAttribute(value) {

  return escapeHTML(value);

}


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

document.addEventListener(
  "keydown",
  event => {

    /*
     * Don't hijack typing.
     */

    if (
      event.target.matches(
        "input, textarea"
      )
    ) {

      return;

    }


    /*
     * Space = play/pause
     */

    if (
      event.code === "Space"
    ) {

      event.preventDefault();

      togglePlayPause();

    }


    /*
     * Arrow Right = next
     */

    if (
      event.code === "ArrowRight"
    ) {

      nextSong();

    }


    /*
     * Arrow Left = previous
     */

    if (
      event.code === "ArrowLeft"
    ) {

      previousSong();

    }

  }
);


/* ============================================================
   PERIODIC PLAYER UPDATE
   ============================================================ */

setInterval(
  () => {

    if (
      !state.currentSong
    ) {

      return;

    }


    if (
      state.videoElement
    ) {

      const current =
        state.videoElement.currentTime;

      const duration =
        state.videoElement.duration;


      if (
        Number.isFinite(duration)
      ) {

        updateProgress(
          current,
          duration
        );

      }

    }

  },
  500
);