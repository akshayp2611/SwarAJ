(() => {
  "use strict";

  /* =========================================================
     SWARAJ MUSIC ENGINE
  ========================================================= */

  const state = {
    songs: [],
    playlist: [],
    currentIndex: -1,
    mode: "audio",
    isPlaying: false,
    adminKey: sessionStorage.getItem("swaraj_admin_key") || "",
    currentCategory: null
  };

  const $ = (id) => document.getElementById(id);

  const audio = $("audioPlayer");
  const video = $("uploadedVideo");

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

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";

    seconds = Math.max(0, Math.floor(seconds));

    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, "0");

    return `${mins}:${secs}`;
  }

  function showToast(message, type = "success") {
    const toast = $("toast");
    const text = $("toastText");
    const icon = $("toastIcon");

    text.textContent = message;

    icon.textContent =
      type === "error" ? "!" :
      type === "info" ? "i" :
      "✓";

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  function getSongTitle(song) {
    return (
      song.title ||
      song.name ||
      song.song_name ||
      song.songName ||
      "Unknown Song"
    );
  }

  function getSongArtist(song) {
    return (
      song.artist ||
      song.artist_name ||
      song.artistName ||
      "SwarAJ"
    );
  }

  function getSongCategory(song) {
    return (
      song.category ||
      song.genre ||
      song.folder ||
      "Other"
    );
  }

  function getCover(song) {
    return (
      song.cover ||
      song.cover_url ||
      song.coverUrl ||
      song.image ||
      song.image_url ||
      song.thumbnail ||
      ""
    );
  }

  function isYoutube(song) {
    const type = String(
      song.type ||
      song.source ||
      song.platform ||
      ""
    ).toLowerCase();

    const url = String(
      song.url ||
      song.audio_url ||
      song.video_url ||
      song.youtube_url ||
      song.youtubeUrl ||
      ""
    );

    return (
      type.includes("youtube") ||
      Boolean(
        song.youtube_id ||
        song.youtubeId ||
        /youtube\.com|youtu\.be/i.test(url)
      )
    );
  }

  function isVideoFile(song) {
    const type = String(
      song.type ||
      song.mime_type ||
      song.mimeType ||
      ""
    ).toLowerCase();

    const url = getMediaUrl(song);

    return (
      type.includes("video") ||
      /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url)
    );
  }

  function getMediaUrl(song) {
    return (
      song.url ||
      song.audio_url ||
      song.audioUrl ||
      song.video_url ||
      song.videoUrl ||
      song.file_url ||
      song.fileUrl ||
      song.path ||
      ""
    );
  }

  function getYoutubeId(song) {

    if (song.youtube_id) {
      return String(song.youtube_id);
    }

    if (song.youtubeId) {
      return String(song.youtubeId);
    }

    const url = String(
      song.youtube_url ||
      song.youtubeUrl ||
      song.url ||
      song.video_url ||
      ""
    );

    let match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
    );

    if (match) {
      return match[1];
    }

    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v");

        if (id) return id;
      }
    } catch (_) {}

    return "";
  }

  function normalizeSong(song, index) {

    if (!song || typeof song !== "object") {
      return null;
    }

    const normalized = {
      ...song,

      _index: index,

      title: getSongTitle(song),

      artist: getSongArtist(song),

      category: getSongCategory(song),

      cover: getCover(song),

      url: getMediaUrl(song),

      youtubeId: getYoutubeId(song),

      youtube: isYoutube(song),

      video: isVideoFile(song)
    };

    if (normalized.youtube) {
      normalized.type = "youtube";
    } else if (normalized.video) {
      normalized.type = "video";
    } else {
      normalized.type = "mp3";
    }

    return normalized;
  }

  /* =========================================================
     API
  ========================================================= */

  async function api(url, options = {}) {

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(state.adminKey
          ? { "x-admin-key": state.adminKey }
          : {})
      }
    });

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = {
        success: response.ok,
        message: text
      };
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Request failed (${response.status})`
      );
    }

    return data;
  }

  async function loadSongs() {

    try {

      setServerStatus("Loading...");

      const data = await api("/api/songs");

      let list = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.songs)) {
        list = data.songs;
      } else if (Array.isArray(data.data)) {
        list = data.data;
      } else if (Array.isArray(data.results)) {
        list = data.results;
      }

      state.songs = list
        .map(normalizeSong)
        .filter(Boolean);

      state.playlist = [...state.songs];

      renderEverything();

      setServerStatus(
        `${state.songs.length} song${state.songs.length === 1 ? "" : "s"}`
      );

      if (!state.songs.length) {
        showToast("No songs found in database", "info");
      }

    } catch (error) {

      console.error(error);

      setServerStatus("API Error");

      state.songs = [];
      state.playlist = [];

      renderEverything();

      showToast(
        "Unable to load songs: " + error.message,
        "error"
      );
    }
  }

  function setServerStatus(text) {
    if ($("serverStatus")) {
      $("serverStatus").textContent = text;
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function coverHTML(song, className = "song-image") {

    const cover = song.cover;

    if (cover) {
      return `
        <div class="${className}">
          <img
            src="${escapeHTML(cover)}"
            alt=""
            loading="lazy"
            onerror="this.style.display='none'"
          >
          <span class="song-type">
            ${song.youtube ? "YT" : song.video ? "VIDEO" : "MP3"}
          </span>
        </div>
      `;
    }

    return `
      <div class="${className}">
        <div class="song-image-placeholder">♫</div>
        <span class="song-type">
          ${song.youtube ? "YT" : song.video ? "VIDEO" : "MP3"}
        </span>
      </div>
    `;
  }

  function renderQuickSongs() {

    const container = $("quickSongs");

    if (!state.songs.length) {
      container.innerHTML =
        `<div class="loading-card">No songs available.</div>`;
      return;
    }

    container.innerHTML = state.songs
      .slice(0, 12)
      .map((song, index) => `
        <article
          class="song-card"
          data-song-index="${song._index}"
        >

          ${coverHTML(song)}

          <h3>${escapeHTML(song.title)}</h3>
          <p>${escapeHTML(song.artist)}</p>

        </article>
      `)
      .join("");
  }

  function renderAllSongs(list = state.songs) {

    const container = $("allSongs");

    $("allCount").textContent =
      `${list.length} song${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
      container.innerHTML =
        `<div class="empty-card">No matching songs.</div>`;
      return;
    }

    container.innerHTML = list
      .map((song, index) => `

        <article
          class="list-song"
          data-song-index="${song._index}"
        >

          <div class="list-number">
            ${index + 1}
          </div>

          <div class="list-cover">

            ${
              song.cover
                ? `<img src="${escapeHTML(song.cover)}" alt="">`
                : `<div class="list-cover-placeholder">♫</div>`
            }

          </div>

          <div class="list-details">

            <strong>
              ${escapeHTML(song.title)}
            </strong>

            <span>
              ${escapeHTML(song.artist)}
              •
              ${escapeHTML(song.category)}
            </span>

          </div>

          <div class="list-type">
            ${song.youtube ? "YOUTUBE" :
              song.video ? "VIDEO" :
              "MP3"}
          </div>

          <button
            class="list-play"
            data-play-index="${song._index}"
          >
            ▶
          </button>

        </article>

      `)
      .join("");
  }

  function renderCategories() {

    const container = $("categoriesGrid");

    const categories = {};

    state.songs.forEach(song => {

      const category = song.category || "Other";

      if (!categories[category]) {
        categories[category] = [];
      }

      categories[category].push(song);
    });

    const names = Object.keys(categories);

    if (!names.length) {
      container.innerHTML =
        `<div class="empty-card">No categories found.</div>`;
      return;
    }

    container.innerHTML = names
      .map(name => `

        <article
          class="category-card"
          data-category="${escapeHTML(name)}"
        >

          <div class="category-icon">♫</div>

          <h3>${escapeHTML(name)}</h3>

          <p>
            ${categories[name].length}
            song${categories[name].length === 1 ? "" : "s"}
          </p>

        </article>

      `)
      .join("");
  }

  function renderCategorySongs(category) {

    const list = state.songs.filter(
      song => song.category === category
    );

    const container = $("categorySongs");

    container.innerHTML = `

      <div class="section-header" style="margin-top:30px">

        <div>
          <span class="section-label">CATEGORY</span>
          <h2>${escapeHTML(category)}</h2>
        </div>

        <button class="primary-btn" id="categoryPlayAll">
          ▶ Play All
        </button>

      </div>

      <div class="song-list" id="categorySongList">

        ${list.map((song, index) => `

          <article
            class="list-song"
            data-song-index="${song._index}"
          >

            <div class="list-number">${index + 1}</div>

            <div class="list-cover">

              ${
                song.cover
                  ? `<img src="${escapeHTML(song.cover)}" alt="">`
                  : `<div class="list-cover-placeholder">♫</div>`
              }

            </div>

            <div class="list-details">

              <strong>${escapeHTML(song.title)}</strong>

              <span>${escapeHTML(song.artist)}</span>

            </div>

            <button
              class="list-play"
              data-play-index="${song._index}"
            >
              ▶
            </button>

          </article>

        `).join("")}

      </div>
    `;

    $("categoryPlayAll").onclick = () => {
      playPlaylist(list);
    };
  }

  function renderFavorites() {

    const favorites = JSON.parse(
      localStorage.getItem("swaraj_favorites") || "[]"
    );

    const songs = state.songs.filter(
      song => favorites.includes(getSongKey(song))
    );

    const container = $("favoriteSongs");

    if (!songs.length) {
      container.innerHTML =
        `<div class="empty-card">No favorite songs yet.</div>`;
      return;
    }

    renderListInto(container, songs);
  }

  function renderListInto(container, list) {

    container.innerHTML = list.map((song,index) => `

      <article
        class="list-song"
        data-song-index="${song._index}"
      >

        <div class="list-number">${index + 1}</div>

        <div class="list-cover">

          ${
            song.cover
              ? `<img src="${escapeHTML(song.cover)}" alt="">`
              : `<div class="list-cover-placeholder">♫</div>`
          }

        </div>

        <div class="list-details">

          <strong>${escapeHTML(song.title)}</strong>

          <span>
            ${escapeHTML(song.artist)}
          </span>

        </div>

        <div class="list-type">
          ${song.youtube ? "YT" :
            song.video ? "VIDEO" :
            "MP3"}
        </div>

        <button
          class="list-play"
          data-play-index="${song._index}"
        >
          ▶
        </button>

      </article>

    `).join("");
  }

  function renderEverything() {
    renderQuickSongs();
    renderAllSongs();
    renderCategories();
    renderFavorites();
  }

  /* =========================================================
     PLAYLIST
  ========================================================= */

  function playAll() {

    if (!state.songs.length) {
      showToast("No songs available", "error");
      return;
    }

    state.playlist = [...state.songs];

    state.currentIndex = 0;

    playCurrent();
  }

  function shuffleAll() {

    if (!state.songs.length) {
      showToast("No songs available", "error");
      return;
    }

    state.playlist = [...state.songs];

    for (let i = state.playlist.length - 1; i > 0; i--) {

      const j = Math.floor(Math.random() * (i + 1));

      [state.playlist[i], state.playlist[j]] =
        [state.playlist[j], state.playlist[i]];
    }

    state.currentIndex = 0;

    playCurrent();
  }

  function playPlaylist(list) {

    if (!list.length) {
      showToast("No songs in playlist", "error");
      return;
    }

    state.playlist = [...list];
    state.currentIndex = 0;

    playCurrent();
  }

  function playSong(song) {

    if (!song) return;

    state.playlist = state.songs.length
      ? [...state.songs]
      : [song];

    const index = state.playlist.findIndex(
      item => getSongKey(item) === getSongKey(song)
    );

    state.currentIndex = index >= 0 ? index : 0;

    if (index < 0) {
      state.playlist = [song];
    }

    playCurrent();
  }

  function getSongKey(song) {

    return String(
      song.id ||
      song.song_id ||
      song.songId ||
      song.url ||
      song.youtubeId ||
      `${song.title}-${song.artist}`
    );
  }

  /* =========================================================
     CORE PLAYER
  ========================================================= */

  async function playCurrent() {

    const song = state.playlist[state.currentIndex];

    if (!song) {
      stopPlayback();
      return;
    }

    updatePlayerUI(song);

    if (state.mode === "video") {

      if (song.youtube || song.video) {

        stopAudioOnly();

        if (song.youtube) {
          playYoutube(song);
        } else {
          playUploadedVideo(song);
        }

      } else {

        /*
          MP3 selected in Video mode:
          keep video mode but play the audio normally.
          The video frame remains empty because the file is audio.
        */

        stopVideoPlayers();

        await playAudioFile(song);
      }

      return;
    }

    /* AUDIO MODE */

    stopVideoPlayers();

    if (song.youtube) {

      playYoutubeAudio(song);

    } else {

      await playAudioFile(song);
    }
  }

  /* =========================================================
     AUDIO
  ========================================================= */

  async function playAudioFile(song) {

    const url = getMediaUrl(song);

    if (!url) {
      showToast("MP3 URL is missing", "error");
      autoNext();
      return;
    }

    try {

      audio.pause();

      audio.src = url;

      audio.currentTime = 0;

      await audio.play();

      state.isPlaying = true;

      updatePlayButtons();

      showToast(
        `Playing ${song.title}`,
        "success"
      );

    } catch (error) {

      console.error("Audio playback error:", error);

      state.isPlaying = false;

      updatePlayButtons();

      showToast(
        "MP3 could not be played",
        "error"
      );

    }
  }

  /* =========================================================
     YOUTUBE AUDIO
  ========================================================= */

  function playYoutubeAudio(song) {

    const id = song.youtubeId;

    if (!id) {
      showToast("YouTube video ID missing", "error");
      autoNext();
      return;
    }

    /*
      YouTube audio mode uses the YouTube iframe,
      but the iframe is visually hidden.

      It remains an actual YouTube player so playback
      can continue without showing the video in Audio mode.
    */

    const container = $("youtubeContainer");

    container.innerHTML = `
      <iframe
        id="youtubeAudioFrame"
        src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&controls=0&playsinline=1&rel=0"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;

    container.style.display = "block";
    container.style.position = "absolute";
    container.style.width = "1px";
    container.style.height = "1px";
    container.style.opacity = "0";
    container.style.pointerEvents = "none";

    $("videoEmpty").style.display = "none";

    state.isPlaying = true;

    updatePlayButtons();

    showToast(
      `Playing YouTube audio: ${song.title}`,
      "success"
    );
  }

  /* =========================================================
     YOUTUBE VIDEO
  ========================================================= */

  function playYoutube(song) {

    const id = song.youtubeId;

    if (!id) {
      showToast("YouTube ID missing", "error");
      autoNext();
      return;
    }

    const container = $("youtubeContainer");

    $("uploadedVideo").style.display = "none";

    $("videoEmpty").style.display = "none";

    container.style.display = "block";
    container.style.position = "absolute";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";

    container.innerHTML = `
      <iframe
        id="youtubeVideoFrame"
        src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&controls=1&playsinline=1&rel=0"
        title="${escapeHTML(song.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;

    state.isPlaying = true;

    updatePlayButtons();

    showToast(
      `Playing video: ${song.title}`,
      "success"
    );
  }

  /* =========================================================
     UPLOADED VIDEO
  ========================================================= */

  async function playUploadedVideo(song) {

    const url = getMediaUrl(song);

    if (!url) {
      showToast("Video URL is missing", "error");
      autoNext();
      return;
    }

    $("youtubeContainer").innerHTML = "";

    $("youtubeContainer").style.display = "none";

    $("videoEmpty").style.display = "none";

    video.style.display = "block";

    try {

      video.pause();

      video.src = url;

      video.currentTime = 0;

      await video.play();

      state.isPlaying = true;

      updatePlayButtons();

      showToast(
        `Playing video: ${song.title}`,
        "success"
      );

    } catch (error) {

      console.error(error);

      state.isPlaying = false;

      updatePlayButtons();

      showToast(
        "Uploaded video could not be played",
        "error"
      );
    }
  }

  /* =========================================================
     STOP / NEXT / PREVIOUS
  ========================================================= */

  function stopAudioOnly() {

    try {
      audio.pause();
    } catch (_) {}

    audio.removeAttribute("src");

    audio.load();
  }

  function stopVideoPlayers() {

    stopAudioOnly();

    try {
      video.pause();
    } catch (_) {}

    video.removeAttribute("src");

    video.load();

    video.style.display = "none";

    const yt = $("youtubeContainer");

    if (yt) {
      yt.innerHTML = "";
      yt.style.display = "none";
    }

    if ($("videoEmpty")) {
      $("videoEmpty").style.display = "grid";
    }
  }

  function stopPlayback() {

    stopAudioOnly();

    try {
      video.pause();
    } catch (_) {}

    video.removeAttribute("src");
    video.load();

    $("youtubeContainer").innerHTML = "";

    state.isPlaying = false;

    updatePlayButtons();

    showToast("Playback stopped", "info");
  }

  function nextSong() {

    if (!state.playlist.length) {
      state.playlist = [...state.songs];
    }

    if (!state.playlist.length) return;

    state.currentIndex++;

    if (state.currentIndex >= state.playlist.length) {
      state.currentIndex = 0;
    }

    playCurrent();
  }

  function previousSong() {

    if (!state.playlist.length) {
      state.playlist = [...state.songs];
    }

    if (!state.playlist.length) return;

    state.currentIndex--;

    if (state.currentIndex < 0) {
      state.currentIndex = state.playlist.length - 1;
    }

    playCurrent();
  }

  function autoNext() {

    setTimeout(() => {
      nextSong();
    }, 500);
  }

  /* =========================================================
     PLAY / PAUSE
  ========================================================= */

  async function togglePlay() {

    const song = state.playlist[state.currentIndex];

    if (!song) {
      playAll();
      return;
    }

    if (state.mode === "audio") {

      if (song.youtube) {

        /*
          Browsers don't expose direct pause/play control
          over a cross-origin iframe without the YouTube API.
          Recreating it lets us restart playback reliably.
        */

        if (state.isPlaying) {

          const frame = $("youtubeAudioFrame");

          if (frame) {
            frame.src = frame.src.replace(
              "autoplay=1",
              "autoplay=0"
            );
          }

          state.isPlaying = false;

        } else {

          playYoutubeAudio(song);
        }

      } else {

        if (audio.paused) {

          try {
            await audio.play();
            state.isPlaying = true;
          } catch (_) {}

        } else {

          audio.pause();
          state.isPlaying = false;
        }
      }

    } else {

      if (song.youtube) {

        /*
          YouTube iframe:
          reload the current frame with autoplay state.
        */

        const frame = $("youtubeVideoFrame");

        if (frame) {

          if (state.isPlaying) {

            frame.src = frame.src.replace(
              "autoplay=1",
              "autoplay=0"
            );

            state.isPlaying = false;

          } else {

            frame.src = frame.src.replace(
              "autoplay=0",
              "autoplay=1"
            );

            state.isPlaying = true;
          }
        }

      } else if (song.video) {

        if (video.paused) {

          try {
            await video.play();
            state.isPlaying = true;
          } catch (_) {}

        } else {

          video.pause();
          state.isPlaying = false;
        }

      } else {

        if (audio.paused) {

          try {
            await audio.play();
            state.isPlaying = true;
          } catch (_) {}

        } else {

          audio.pause();
          state.isPlaying = false;
        }
      }
    }

    updatePlayButtons();
  }

  /* =========================================================
     UI UPDATE
  ========================================================= */

  function updatePlayerUI(song) {

    $("mainSongTitle").textContent = song.title;
    $("mainSongArtist").textContent =
      `${song.artist} • ${song.category}`;

    $("playerHeading").textContent = song.title;

    $("miniTitle").textContent = song.title;
    $("miniArtist").textContent = song.artist;

    updateCover($("mainCover"), song);
    updateCover($("miniCover"), song);

    $("miniPlayer").classList.add("show");
  }

  function updateCover(element, song) {

    if (!element) return;

    if (song.cover) {

      element.innerHTML = `
        <img
          src="${escapeHTML(song.cover)}"
          alt=""
          onerror="this.style.display='none'"
        >
      `;

    } else {

      element.innerHTML = `
        <div class="cover-placeholder">♫</div>
      `;
    }
  }

  function updatePlayButtons() {

    const icon = state.isPlaying ? "❚❚" : "▶";

    $("playPauseBtn").textContent = icon;
    $("miniPlay").textContent = icon;
  }

  /* =========================================================
     PROGRESS
  ========================================================= */

  function updateProgress() {

    let current = 0;
    let duration = 0;

    if (
      state.mode === "video" &&
      !video.paused &&
      Number.isFinite(video.duration)
    ) {

      current = video.currentTime;
      duration = video.duration;

    } else if (
      !audio.paused &&
      Number.isFinite(audio.duration)
    ) {

      current = audio.currentTime;
      duration = audio.duration;
    }

    if (!duration) return;

    $("currentTime").textContent =
      formatTime(current);

    $("duration").textContent =
      formatTime(duration);

    $("progressBar").value =
      (current / duration) * 100;

    $("miniProgress").style.width =
      `${(current / duration) * 100}%`;
  }

  function seek(value) {

    const percent = Number(value) / 100;

    if (
      state.mode === "video" &&
      video.style.display !== "none" &&
      Number.isFinite(video.duration)
    ) {

      video.currentTime =
        video.duration * percent;

      return;
    }

    if (
      !audio.paused &&
      Number.isFinite(audio.duration)
    ) {

      audio.currentTime =
        audio.duration * percent;
    }
  }

  /* =========================================================
     MODE
  ========================================================= */

  function setMode(mode) {

    state.mode = mode;

    document.body.classList.toggle(
      "video-mode",
      mode === "video"
    );

    document
      .querySelectorAll(".mode-btn")
      .forEach(btn => {
        btn.classList.toggle(
          "active",
          btn.dataset.mode === mode
        );
      });

    const current =
      state.playlist[state.currentIndex];

    if (current) {
      playCurrent();
    }

    showToast(
      mode === "video"
        ? "Video mode enabled"
        : "Audio mode enabled",
      "info"
    );
  }

  /* =========================================================
     TABS
  ========================================================= */

  function openTab(tab) {

    document
      .querySelectorAll(".tab-page")
      .forEach(page => {
        page.classList.remove("active");
      });

    const target = $(`tab-${tab}`);

    if (target) {
      target.classList.add("active");
    }

    document
      .querySelectorAll(".nav-btn")
      .forEach(btn => {
        btn.classList.toggle(
          "active",
          btn.dataset.tab === tab
        );
      });

    $("sidebar")?.classList.remove("open");
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  function performSearch(query) {

    const q = query.trim().toLowerCase();

    if (!q) {

      renderAllSongs(state.songs);

      return;
    }

    const result = state.songs.filter(song => {

      return [
        song.title,
        song.artist,
        song.category,
        song.type
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    openTab("all");

    renderAllSongs(result);
  }

  /* =========================================================
     FAVORITES
  ========================================================= */

  function toggleFavorite(song) {

    const key = getSongKey(song);

    let favorites = JSON.parse(
      localStorage.getItem("swaraj_favorites") || "[]"
    );

    if (favorites.includes(key)) {

      favorites =
        favorites.filter(item => item !== key);

      showToast("Removed from favorites", "info");

    } else {

      favorites.push(key);

      showToast("Added to favorites");
    }

    localStorage.setItem(
      "swaraj_favorites",
      JSON.stringify(favorites)
    );

    renderFavorites();
  }

  /* =========================================================
     ADMIN
  ========================================================= */

  async function adminLogin() {

    const key = $("adminKey").value.trim();

    if (!key) {

      $("adminError").textContent =
        "Please enter the admin key.";

      return;
    }

    try {

      /*
        We intentionally test the key against the server.
        This supports the configured admin key on Render.
      */

      const result = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": key
        }
      });

      if (!result.ok) {

        throw new Error("Invalid admin key");
      }

      state.adminKey = key;

      sessionStorage.setItem(
        "swaraj_admin_key",
        key
      );

      $("adminLogin").classList.add("hidden");
      $("adminPanel").classList.remove("hidden");

      $("adminError").textContent = "";

      showToast("Admin login successful");

    } catch (error) {

      /*
        Some older server versions don't expose
        /api/admin/verify. In that case keep the key
        locally and allow upload operations to validate
        against the actual endpoint.
      */

      if (
        String(error.message)
          .toLowerCase()
          .includes("failed")
      ) {

        state.adminKey = key;

        sessionStorage.setItem(
          "swaraj_admin_key",
          key
        );

        $("adminLogin").classList.add("hidden");
        $("adminPanel").classList.remove("hidden");

        showToast("Admin key saved");

      } else {

        $("adminError").textContent =
          "Invalid admin key.";

        showToast(
          "Admin authentication failed",
          "error"
        );
      }
    }
  }

  async function uploadFiles(input, endpoint) {

    const files = input.files;

    if (!files || !files.length) {

      showToast("Select file(s) first", "error");

      return;
    }

    const formData = new FormData();

    Array.from(files).forEach(file => {
      formData.append("files", file);
    });

    try {

      $("adminMessage").textContent =
        "Uploading...";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-admin-key": state.adminKey
        },
        body: formData
      });

      const text = await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {};
      }

      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          text ||
          `Upload failed (${response.status})`
        );
      }

      $("adminMessage").textContent =
        data.message ||
        "Upload successful.";

      showToast("Upload successful");

      input.value = "";

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

  async function addYoutube() {

    const title =
      $("youtubeTitle").value.trim();

    const artist =
      $("youtubeArtist").value.trim();

    const url =
      $("youtubeUrl").value.trim();

    if (!title || !url) {

      showToast(
        "Title and YouTube URL are required",
        "error"
      );

      return;
    }

    try {

      $("adminMessage").textContent =
        "Adding YouTube song...";

      const data = await api(
        "/api/admin/youtube",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            artist,
            url
          })
        }
      );

      $("adminMessage").textContent =
        data.message ||
        "YouTube song added.";

      $("youtubeTitle").value = "";
      $("youtubeArtist").value = "";
      $("youtubeUrl").value = "";

      showToast("YouTube song added");

      await loadSongs();

    } catch (error) {

      $("adminMessage").textContent =
        error.message;

      showToast(
        error.message,
        "error"
      );
    }
  }

  /* =========================================================
     EVENT LISTENERS
  ========================================================= */

  document.addEventListener("click", event => {

    const songCard =
      event.target.closest("[data-song-index]");

    if (
      songCard &&
      !event.target.closest("button")
    ) {

      const index =
        Number(songCard.dataset.songIndex);

      const song =
        state.songs.find(
          item => item._index === index
        );

      if (song) {
        playSong(song);
      }

      return;
    }

    const playButton =
      event.target.closest("[data-play-index]");

    if (playButton) {

      event.stopPropagation();

      const index =
        Number(playButton.dataset.playIndex);

      const song =
        state.songs.find(
          item => item._index === index
        );

      if (song) {
        playSong(song);
      }

      return;
    }

    const nav =
      event.target.closest(".nav-btn");

    if (nav) {

      openTab(nav.dataset.tab);

      return;
    }

    const target =
      event.target.closest("[data-tab-target]");

    if (target) {

      openTab(target.dataset.tabTarget);

      return;
    }

    const category =
      event.target.closest("[data-category]");

    if (category) {

      const name =
        category.dataset.category;

      renderCategorySongs(name);

      return;
    }
  });

  document
    .querySelectorAll(".mode-btn")
    .forEach(btn => {

      btn.addEventListener("click", () => {
        setMode(btn.dataset.mode);
      });

    });

  $("heroPlayAll").addEventListener(
    "click",
    playAll
  );

  $("allPlayBtn").addEventListener(
    "click",
    playAll
  );

  $("heroShuffle").addEventListener(
    "click",
    shuffleAll
  );

  $("prevBtn").addEventListener(
    "click",
    previousSong
  );

  $("nextBtn").addEventListener(
    "click",
    nextSong
  );

  $("stopBtn").addEventListener(
    "click",
    stopPlayback
  );

  $("playPauseBtn").addEventListener(
    "click",
    togglePlay
  );

  $("miniPrev").addEventListener(
    "click",
    previousSong
  );

  $("miniNext").addEventListener(
    "click",
    nextSong
  );

  $("miniStop").addEventListener(
    "click",
    stopPlayback
  );

  $("miniPlay").addEventListener(
    "click",
    togglePlay
  );

  $("progressBar").addEventListener(
    "input",
    event => {
      seek(event.target.value);
    }
  );

  $("searchInput").addEventListener(
    "input",
    event => {
      performSearch(event.target.value);
    }
  );

  $("clearSearch").addEventListener(
    "click",
    () => {
      $("searchInput").value = "";
      performSearch("");
    }
  );

  $("refreshBtn").addEventListener(
    "click",
    async () => {
      showToast("Refreshing library...", "info");
      await loadSongs();
    }
  );

  $("mobileMenu").addEventListener(
    "click",
    () => {
      $("sidebar").classList.toggle("open");
    }
  );

  $("closeVideo").addEventListener(
    "click",
    () => {
      stopVideoPlayers();
      document.body.classList.remove("video-mode");

      document
        .querySelectorAll(".mode-btn")
        .forEach(btn => {
          btn.classList.toggle(
            "active",
            btn.dataset.mode === "audio"
          );
        });

      state.mode = "audio";
    }
  );

  $("adminLoginBtn").addEventListener(
    "click",
    adminLogin
  );

  $("adminKey").addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {
        adminLogin();
      }

    }
  );

  $("uploadAudioBtn").addEventListener(
    "click",
    () => {
      uploadFiles(
        $("audioUpload"),
        "/api/admin/upload"
      );
    }
  );

  $("uploadVideoBtn").addEventListener(
    "click",
    () => {
      uploadFiles(
        $("videoUpload"),
        "/api/admin/upload"
      );
    }
  );

  $("addYoutubeBtn").addEventListener(
    "click",
    addYoutube
  );

  /* =========================================================
     MEDIA EVENTS
  ========================================================= */

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
    autoNext
  );

  audio.addEventListener(
    "timeupdate",
    updateProgress
  );

  audio.addEventListener(
    "loadedmetadata",
    updateProgress
  );

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
    autoNext
  );

  video.addEventListener(
    "timeupdate",
    updateProgress
  );

  video.addEventListener(
    "loadedmetadata",
    updateProgress
  );

  /* =========================================================
     KEYBOARD CONTROLS
  ========================================================= */

  document.addEventListener(
    "keydown",
    event => {

      const tag =
        document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA"
      ) {
        return;
      }

      if (event.code === "Space") {

        event.preventDefault();

        togglePlay();
      }

      if (event.code === "ArrowRight") {
        nextSong();
      }

      if (event.code === "ArrowLeft") {
        previousSong();
      }
    }
  );

  /* =========================================================
     BACKGROUND / VISIBILITY
  ========================================================= */

  /*
    Do NOT pause audio when the browser tab becomes hidden.

    Browser audio/video policies control background playback.
    We deliberately don't call pause() here.
  */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (!document.hidden) {
        updatePlayButtons();
        updateProgress();
      }

    }
  );

  /* =========================================================
     MEDIA SESSION
  ========================================================= */

  function setupMediaSession(song) {

    if (!("mediaSession" in navigator) || !song) {
      return;
    }

    try {

      navigator.mediaSession.metadata =
        new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: "SwarAJ",
          artwork: song.cover
            ? [
                {
                  src: song.cover,
                  sizes: "512x512",
                  type: "image/jpeg"
                }
              ]
            : []
        });

      navigator.mediaSession.setActionHandler(
        "play",
        togglePlay
      );

      navigator.mediaSession.setActionHandler(
        "pause",
        togglePlay
      );

      navigator.mediaSession.setActionHandler(
        "previoustrack",
        previousSong
      );

      navigator.mediaSession.setActionHandler(
        "nexttrack",
        nextSong
      );

    } catch (error) {
      console.warn(
        "Media Session unavailable:",
        error
      );
    }
  }

  const originalUpdatePlayerUI =
    updatePlayerUI;

  updatePlayerUI = function(song) {

    originalUpdatePlayerUI(song);

    setupMediaSession(song);
  };

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  if (state.adminKey) {

    /*
      We don't automatically open Admin.
      The key remains available for API requests.
    */

  }

  loadSongs();

})();