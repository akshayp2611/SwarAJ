const state = {
  songs: [],
  filteredSongs: [],
  categories: [],
  currentSong: null,
  currentIndex: -1,
  audio: new Audio(),
  adminKey: localStorage.getItem(
    "swaraj_admin_key"
  ) || "",
  youtubePlayer: null,
  youtubeReady: false
};

/* =========================================================
   DOM
========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupNavigation();
    setupSearch();
    setupAudio();
    setupAdmin();
    setupYouTubeAPI();

    loadSongs();
    loadCategories();
  }
);

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
  $$(".nav-btn").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        $$(".nav-btn").forEach((item) =>
          item.classList.remove("active")
        );

        button.classList.add("active");

        const target =
          button.dataset.target;

        if (target) {
          showSection(target);
        }
      }
    );
  });

  $("#openAdmin")?.addEventListener(
    "click",
    () => {
      showSection("admin");
    }
  );
}

function showSection(id) {
  $$(".page-section").forEach(
    (section) => {
      section.classList.remove("active");
    }
  );

  const section = document.getElementById(
    id
  );

  if (section) {
    section.classList.add("active");
  }
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  const input = $("#searchInput");

  if (!input) {
    return;
  }

  let timer;

  input.addEventListener(
    "input",
    () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        const query =
          input.value.trim();

        if (!query) {
          renderSongs(state.songs);
          return;
        }

        searchSongs(query);
      }, 250);
    }
  );
}

async function searchSongs(query) {
  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(
        query
      )}`
    );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Search failed"
      );
    }

    renderSongs(data.songs || []);
  } catch (error) {
    console.error(error);

    showToast(
      "Search failed",
      "error"
    );
  }
}

/* =========================================================
   LOAD SONGS
========================================================= */

async function loadSongs() {
  const container =
    $("#songList");

  if (container) {
    container.innerHTML =
      `<div class="loading">Loading songs...</div>`;
  }

  try {
    const response = await fetch(
      "/api/songs"
    );

    const data =
      await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          "Unable to load songs"
      );
    }

    state.songs =
      data.songs || [];

    state.filteredSongs =
      [...state.songs];

    updateSongCount();

    renderSongs(
      state.songs
    );

    renderFeatured(
      state.songs
    );
  } catch (error) {
    console.error(error);

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Unable to load songs</h3>
          <p>${escapeHtml(
            error.message
          )}</p>
          <button onclick="loadSongs()">
            Retry
          </button>
        </div>
      `;
    }
  }
}

/* =========================================================
   CATEGORIES
========================================================= */

async function loadCategories() {
  try {
    const response =
      await fetch(
        "/api/categories"
      );

    const data =
      await response.json();

    if (!data.success) {
      return;
    }

    state.categories =
      data.categories || [];

    renderCategories(
      state.categories
    );
  } catch (error) {
    console.error(
      "Category error:",
      error
    );
  }
}

function renderCategories(categories) {
  const container =
    $("#categoryList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!categories.length) {
    container.innerHTML = `
      <div class="empty-state">
        No categories yet.
      </div>
    `;

    return;
  }

  categories.forEach(
    (category) => {
      const button =
        document.createElement(
          "button"
        );

      button.className =
        "category-card";

      button.innerHTML = `
        <span class="category-icon">
          ♪
        </span>

        <span>
          <strong>${escapeHtml(
            category.name
          )}</strong>

          <small>
            ${category.count} songs
          </small>
        </span>
      `;

      button.addEventListener(
        "click",
        () => {
          loadCategory(
            category.name
          );
        }
      );

      container.appendChild(
        button
      );
    }
  );
}

async function loadCategory(category) {
  try {
    const response =
      await fetch(
        `/api/categories/${encodeURIComponent(
          category
        )}`
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
          "Unable to load category"
      );
    }

    renderSongs(
      data.songs || []
    );

    showSection("songs");
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

/* =========================================================
   RENDER SONGS
========================================================= */

function renderSongs(songs) {
  const container =
    $("#songList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!songs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">♪</div>
        <h3>No songs found</h3>
        <p>Add songs from the Admin panel.</p>
      </div>
    `;

    return;
  }

  songs.forEach(
    (song, index) => {
      container.appendChild(
        createSongCard(
          song,
          index,
          songs
        )
      );
    }
  );
}

function createSongCard(
  song,
  index,
  sourceSongs
) {
  const card =
    document.createElement("article");

  card.className =
    "song-card";

  const sourceLabel =
    song.source_type === "youtube"
      ? "YouTube"
      : song.source_type ===
          "mp3_url"
        ? "MP3 URL"
        : "Uploaded";

  card.innerHTML = `
    <div class="song-cover-wrap">
      <img
        class="song-cover"
        src="${escapeAttribute(
          song.cover_url ||
            "/images/ganpati.jpg"
        )}"
        alt=""
        loading="lazy"
        onerror="this.src='/images/ganpati.jpg'"
      />

      <button
        class="cover-play"
        type="button"
        aria-label="Play"
      >
        ▶
      </button>
    </div>

    <div class="song-info">
      <h3>${escapeHtml(
        song.title
      )}</h3>

      <p>
        ${escapeHtml(
          song.artist || "SwarAJ"
        )}
      </p>

      <div class="song-meta">
        <span>
          ${escapeHtml(
            song.category || "Other"
          )}
        </span>

        <span class="source-badge">
          ${sourceLabel}
        </span>
      </div>
    </div>

    <div class="song-actions">
      <button
        class="play-btn"
        type="button"
      >
        ▶
      </button>

      ${
        song.source_type ===
        "youtube"
          ? `
            <button
              class="video-btn"
              type="button"
              title="Watch video"
            >
              ▷
            </button>
          `
          : ""
      }
    </div>
  `;

  card
    .querySelector(".cover-play")
    .addEventListener(
      "click",
      () =>
        playSongFromList(
          song,
          sourceSongs
        )
    );

  card
    .querySelector(".play-btn")
    .addEventListener(
      "click",
      () =>
        playSongFromList(
          song,
          sourceSongs
        )
    );

  card
    .querySelector(".video-btn")
    ?.addEventListener(
      "click",
      () => {
        openYouTubeVideo(
          song
        );
      }
    );

  return card;
}

function renderFeatured(songs) {
  const container =
    $("#featuredList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  songs
    .slice(0, 6)
    .forEach((song) => {
      const button =
        document.createElement(
          "button"
        );

      button.className =
        "featured-card";

      button.innerHTML = `
        <img
          src="${escapeAttribute(
            song.cover_url ||
              "/images/ganpati.jpg"
          )}"
          alt=""
          onerror="this.src='/images/ganpati.jpg'"
        />

        <div>
          <strong>
            ${escapeHtml(
              song.title
            )}
          </strong>

          <span>
            ${escapeHtml(
              song.artist
            )}
          </span>
        </div>
      `;

      button.addEventListener(
        "click",
        () =>
          playSong(
            song,
            songs
          )
      );

      container.appendChild(
        button
      );
    });
}

/* =========================================================
   PLAYBACK
========================================================= */

function setupAudio() {
  state.audio.preload =
    "metadata";

  state.audio.addEventListener(
    "timeupdate",
    updateProgress
  );

  state.audio.addEventListener(
    "loadedmetadata",
    updateDuration
  );

  state.audio.addEventListener(
    "ended",
    playNext
  );

  state.audio.addEventListener(
    "play",
    () => {
      updatePlayerUI(true);
    }
  );

  state.audio.addEventListener(
    "pause",
    () => {
      updatePlayerUI(false);
    }
  );

  $("#playPause")?.addEventListener(
    "click",
    togglePlayback
  );

  $("#previousBtn")?.addEventListener(
    "click",
    playPrevious
  );

  $("#nextBtn")?.addEventListener(
    "click",
    playNext
  );

  $("#progressBar")?.addEventListener(
    "input",
    (event) => {
      if (
        !Number.isFinite(
          state.audio.duration
        )
      ) {
        return;
      }

      state.audio.currentTime =
        (Number(event.target.value) /
          100) *
        state.audio.duration;
    }
  );

  $("#volumeBar")?.addEventListener(
    "input",
    (event) => {
      state.audio.volume =
        Number(event.target.value) /
        100;
    }
  );

  state.audio.volume = 1;
}

function playSongFromList(
  song,
  songs
) {
  playSong(song, songs);
}

function playSong(song, songs = state.songs) {
  state.currentSong =
    song;

  state.filteredSongs =
    songs || state.songs;

  state.currentIndex =
    state.filteredSongs.findIndex(
      (item) =>
        String(item.id) ===
        String(song.id)
    );

  updatePlayerInfo(song);

  if (
    song.source_type ===
    "youtube"
  ) {
    playYouTubeSong(song);
    return;
  }

  stopYouTube();

  if (!song.audio_url) {
    showToast(
      "No audio source available.",
      "error"
    );

    return;
  }

  state.audio.src =
    song.audio_url;

  state.audio.load();

  state.audio
    .play()
    .catch((error) => {
      console.error(
        "Audio play error:",
        error
      );

      showToast(
        "Unable to play this audio source.",
        "error"
      );
    });

  showNowPlaying(true);
}

function togglePlayback() {
  if (
    state.currentSong?.source_type ===
    "youtube"
  ) {
    toggleYouTube();
    return;
  }

  if (!state.audio.src) {
    if (state.songs.length) {
      playSong(state.songs[0]);
    }

    return;
  }

  if (state.audio.paused) {
    state.audio
      .play()
      .catch(console.error);
  } else {
    state.audio.pause();
  }
}

function playNext() {
  if (
    !state.filteredSongs.length
  ) {
    return;
  }

  let nextIndex =
    state.currentIndex + 1;

  if (
    nextIndex >=
    state.filteredSongs.length
  ) {
    nextIndex = 0;
  }

  playSong(
    state.filteredSongs[
      nextIndex
    ],
    state.filteredSongs
  );
}

function playPrevious() {
  if (
    !state.filteredSongs.length
  ) {
    return;
  }

  let previousIndex =
    state.currentIndex - 1;

  if (previousIndex < 0) {
    previousIndex =
      state.filteredSongs.length -
      1;
  }

  playSong(
    state.filteredSongs[
      previousIndex
    ],
    state.filteredSongs
  );
}

/* =========================================================
   YOUTUBE
========================================================= */

function setupYouTubeAPI() {
  if (
    document.getElementById(
      "youtube-api-script"
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      "script"
    );

  script.id =
    "youtube-api-script";

  script.src =
    "https://www.youtube.com/iframe_api";

  document.head.appendChild(
    script
  );

  window.onYouTubeIframeAPIReady =
    function () {
      state.youtubeReady = true;

      if (
        state.currentSong &&
        state.currentSong.source_type ===
          "youtube"
      ) {
        createYouTubePlayer(
          state.currentSong
        );
      }
    };
}

function playYouTubeSong(song) {
  state.audio.pause();

  showNowPlaying(true);

  if (!state.youtubeReady) {
    showToast(
      "YouTube player is loading...",
      "info"
    );

    return;
  }

  createYouTubePlayer(song);
}

function createYouTubePlayer(song) {
  if (!song.youtube_video_id) {
    showToast(
      "YouTube video ID is missing.",
      "error"
    );

    return;
  }

  const container =
    $("#youtubePlayer");

  if (!container) {
    return;
  }

  if (state.youtubePlayer) {
    try {
      state.youtubePlayer.destroy();
    } catch (_) {}
  }

  state.youtubePlayer =
    new YT.Player(
      "youtubePlayer",
      {
        videoId:
          song.youtube_video_id,

        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          playsinline: 1
        },

        events: {
          onReady: (event) => {
            event.target.playVideo();

            updatePlayerUI(true);
          },

          onStateChange: (
            event
          ) => {
            if (
              event.data ===
              YT.PlayerState.PLAYING
            ) {
              updatePlayerUI(
                true
              );
            }

            if (
              event.data ===
              YT.PlayerState.PAUSED
            ) {
              updatePlayerUI(
                false
              );
            }

            if (
              event.data ===
              YT.PlayerState.ENDED
            ) {
              playNext();
            }
          },

          onError: (event) => {
            console.error(
              "YouTube error:",
              event.data
            );

            showToast(
              "This YouTube video cannot be embedded.",
              "error"
            );
          }
        }
      }
    );
  }
}

function toggleYouTube() {
  if (!state.youtubePlayer) {
    return;
  }

  const playerState =
    state.youtubePlayer.getPlayerState();

  if (
    playerState ===
    YT.PlayerState.PLAYING
  ) {
    state.youtubePlayer.pauseVideo();
  } else {
    state.youtubePlayer.playVideo();
  }
}

function stopYouTube() {
  if (state.youtubePlayer) {
    try {
      state.youtubePlayer.stopVideo();
    } catch (_) {}
  }
}

function openYouTubeVideo(song) {
  if (!song.youtube_url) {
    return;
  }

  const modal =
    $("#videoModal");

  const frame =
    $("#videoFrame");

  if (!modal || !frame) {
    window.open(
      song.youtube_url,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }

  frame.src =
    song.youtube_embed_url ||
    `https://www.youtube.com/embed/${song.youtube_video_id}`;

  modal.classList.add("open");
}

function closeVideoModal() {
  const modal =
    $("#videoModal");

  const frame =
    $("#videoFrame");

  modal?.classList.remove(
    "open"
  );

  if (frame) {
    frame.src = "";
  }
}

window.closeVideoModal =
  closeVideoModal;

/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayerInfo(song) {
  $("#playerTitle") &&
    ($("#playerTitle.textContent =
      song.title);

  $("#playerArtist") &&
    ($("#playerArtist.textContent =
      song.artist || "SwarAJ"));

  const image =
    $("#playerCover");

  if (image) {
    image.src =
      song.cover_url ||
      "/images/ganpati.jpg";
  }

  const source =
    $("#playerSource");

  if (source) {
    source.textContent =
      song.source_type ===
      "youtube"
        ? "YouTube"
        : song.source_type ===
            "mp3_url"
          ? "MP3 URL"
          : "SwarAJ Upload";
  }
}

function updatePlayerUI(isPlaying) {
  const button =
    $("#playPause");

  if (button) {
    button.textContent =
      isPlaying
        ? "Ⅱ"
        : "▶";
  }
}

function updateProgress() {
  const progress =
    $("#progressBar");

  const current =
    $("#currentTime");

  if (
    !progress ||
    !current
  ) {
    return;
  }

  if (
    !Number.isFinite(
      state.audio.duration
    )
  ) {
    return;
  }

  progress.value =
    (state.audio.currentTime /
      state.audio.duration) *
    100;

  current.textContent =
    formatTime(
      state.audio.currentTime
    );
}

function updateDuration() {
  const duration =
    $("#duration");

  if (duration) {
    duration.textContent =
      formatTime(
        state.audio.duration
      );
  }
}

function formatTime(seconds) {
  if (
    !Number.isFinite(seconds)
  ) {
    return "0:00";
  }

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    Math.floor(seconds % 60);

  return `${minutes}:${String(
    remaining
  ).padStart(2, "0")}`;
}

function showNowPlaying(show) {
  const player =
    $("#musicPlayer");

  if (player) {
    player.classList.toggle(
      "visible",
      show
    );
  }
}

function updateSongCount() {
  const element =
    $("#songCount");

  if (element) {
    element.textContent =
      `${state.songs.length} songs`;
  }
}

/* =========================================================
   ADMIN
========================================================= */

function setupAdmin() {
  $("#adminLoginBtn")
    ?.addEventListener(
      "click",
      adminLogin
    );

  $("#adminLogoutBtn")
    ?.addEventListener(
      "click",
      adminLogout
    );

  $("#uploadForm")
    ?.addEventListener(
      "submit",
      submitUpload
    );

  $("#mp3UrlForm")
    ?.addEventListener(
      "submit",
      submitMp3Url
    );

  $("#youtubeForm")
    ?.addEventListener(
      "submit",
      submitYouTube
    );

  $("#refreshAdminSongs")
    ?.addEventListener(
      "click",
      loadAdminSongs
    );

  if (state.adminKey) {
    setAdminLoggedIn(true);
  }
}

async function adminLogin() {
  const input =
    $("#adminKey");

  const key =
    input?.value.trim();

  if (!key) {
    showToast(
      "Enter admin key.",
      "error"
    );

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
              "application/json",

            "x-admin-key": key
          },

          body: JSON.stringify({
            adminKey: key
          })
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Invalid admin key"
      );
    }

    state.adminKey = key;

    localStorage.setItem(
      "swaraj_admin_key",
      key
    );

    setAdminLoggedIn(true);

    showToast(
      "Admin login successful.",
      "success"
    );

    loadAdminSongs();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

function adminLogout() {
  state.adminKey = "";

  localStorage.removeItem(
    "swaraj_admin_key"
  );

  setAdminLoggedIn(false);

  showToast(
    "Admin logged out.",
    "info"
  );
}

function setAdminLoggedIn(
  loggedIn
) {
  $("#adminLoginPanel")
    ?.classList.toggle(
      "hidden",
      loggedIn
    );

  $("#adminDashboard")
    ?.classList.toggle(
      "hidden",
      !loggedIn
    );
}

async function submitUpload(
  event
) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const formData =
    new FormData(form);

  try {
    const response =
      await fetch(
        "/api/admin/upload",
        {
          method: "POST",

          headers: {
            "x-admin-key":
              state.adminKey
          },

          body: formData
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Upload failed"
      );
    }

    form.reset();

    showToast(
      "MP3 uploaded successfully.",
      "success"
    );

    await refreshEverything();
    await loadAdminSongs();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function submitMp3Url(
  event
) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const payload =
    Object.fromEntries(
      new FormData(form)
    );

  payload.adminKey =
    state.adminKey;

  try {
    const response =
      await fetch(
        "/api/admin/mp3-url",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-key":
              state.adminKey
          },

          body: JSON.stringify(
            payload
          )
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Unable to add MP3 URL"
      );
    }

    form.reset();

    showToast(
      "MP3 URL added successfully.",
      "success"
    );

    await refreshEverything();
    await loadAdminSongs();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function submitYouTube(
  event
) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const payload =
    Object.fromEntries(
      new FormData(form)
    );

  payload.adminKey =
    state.adminKey;

  try {
    const response =
      await fetch(
        "/api/admin/youtube",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-key":
              state.adminKey
          },

          body: JSON.stringify(
            payload
          )
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Unable to add YouTube song"
      );
    }

    form.reset();

    showToast(
      "YouTube song added successfully.",
      "success"
    );

    await refreshEverything();
    await loadAdminSongs();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function loadAdminSongs() {
  const container =
    $("#adminSongList");

  if (!container) {
    return;
  }

  if (!state.adminKey) {
    return;
  }

  try {
    const response =
      await fetch(
        "/api/admin/songs",
        {
          headers: {
            "x-admin-key":
              state.adminKey
          }
        }
      );

    if (response.status === 401) {
      adminLogout();

      return;
    }

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
          "Unable to load admin songs"
      );
    }

    container.innerHTML = "";

    if (!data.songs.length) {
      container.innerHTML =
        `<div class="empty-state">No songs in database.</div>`;

      return;
    }

    data.songs.forEach(
      (song) => {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          "admin-song-row";

        row.innerHTML = `
          <div>
            <strong>
              ${escapeHtml(
                song.title
              )}
            </strong>

            <small>
              ${escapeHtml(
                song.artist
              )}
              ·
              ${escapeHtml(
                song.category
              )}
              ·
              ${escapeHtml(
                song.source_type
              )}
            </small>
          </div>

          <button
            class="danger-btn"
            type="button"
          >
            Delete
          </button>
        `;

        row
          .querySelector(
            ".danger-btn"
          )
          .addEventListener(
            "click",
            () =>
              deleteSong(
                song.id
              )
          );

        container.appendChild(
          row
        );
      }
    );
  } catch (error) {
    container.innerHTML = `
      <div class="error-box">
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}

async function deleteSong(id) {
  const confirmed =
    window.confirm(
      "Delete this song permanently?"
    );

  if (!confirmed) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/admin/songs/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",

          headers: {
            "x-admin-key":
              state.adminKey
          }
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Delete failed"
      );
    }

    showToast(
      "Song deleted.",
      "success"
    );

    if (
      state.currentSong &&
      String(
        state.currentSong.id
      ) === String(id)
    ) {
      state.audio.pause();

      state.currentSong =
        null;

      showNowPlaying(false);
    }

    await refreshEverything();
    await loadAdminSongs();
  } catch (error) {
    showToast(
      error.message,
      "error"
    );
  }
}

async function refreshEverything() {
  await Promise.all([
    loadSongs(),
    loadCategories()
  ]);
}

/* =========================================================
   TOAST
========================================================= */

function showToast(
  message,
  type = "info"
) {
  const container =
    $("#toastContainer");

  if (!container) {
    return;
  }

  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    `toast ${type}`;

  toast.textContent =
    message;

  container.appendChild(
    toast
  );

  setTimeout(() => {
    toast.classList.add(
      "hide"
    );

    setTimeout(
      () =>
        toast.remove(),
      300
    );
  }, 3000);
}

/* =========================================================
   SECURITY / HTML HELPERS
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(
  value
) {
  return escapeHtml(value);
}

/* =========================================================
   GLOBAL
========================================================= */

window.playSong =
  playSong;

window.loadSongs =
  loadSongs;

window.loadCategories =
  loadCategories;

window.loadAdminSongs =
  loadAdminSongs;

window.adminLogin =
  adminLogin;

window.adminLogout =
  adminLogout;