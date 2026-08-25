(() => {
  "use strict";

  const state = {
    songs: [],
    playlist: [],
    index: -1,
    playing: false,
    adminKey: localStorage.getItem("swaraj-admin-key") || ""
  };

  const $ = id => document.getElementById(id);

  const audio = $("audio");

  const E = {
    sidebar: $("sidebar"),
    menuBtn: $("menuBtn"),
    closeMenu: $("closeMenu"),
    nav: [...document.querySelectorAll("[data-view]")],

    homeSongs: $("homeSongs"),
    audioSongs: $("audioSongs"),
    videoSongs: $("videoSongs"),
    librarySongs: $("librarySongs"),
    adminSongs: $("adminSongs"),

    playAll: $("playAllBtn"),
    previous: $("previousBtn"),
    next: $("nextBtn"),
    stop: $("stopBtn"),
    playPause: $("playPauseBtn"),

    playerImage: $("playerImage"),
    playerTitle: $("playerTitle"),
    playerArtist: $("playerArtist"),
    currentTime: $("currentTime"),
    duration: $("duration"),
    progress: $("progress"),

    search: $("searchInput"),

    youtubeForm: $("youtubeForm"),
    mp3Form: $("mp3Form"),
    videoForm: $("videoForm"),
    refreshAdmin: $("refreshAdmin"),

    videoPlayer: $("videoPlayer"),
    videoFrame: $("videoFrame"),

    toast: $("toast"),
    count: $("songCount")
  };

  function toast(message) {
    E.toast.textContent = message;
    E.toast.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      E.toast.classList.remove("show");
    }, 3000);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeSong(song) {
    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      song.url ||
      "";

    const youtubeId =
      song.youtube_video_id ||
      song.youtubeVideoId ||
      extractYouTubeId(youtubeUrl);

    return {
      id: song.id,
      title: song.title || "Untitled",
      artist: song.artist || "SwarAJ",
      album: song.album || "Singles",
      category: song.category || "Other",
      language: song.language || "",
      source:
        song.source_type ||
        song.source ||
        (youtubeId ? "youtube" : "mp3"),

      youtubeUrl,
      youtubeId,

      url:
        song.audio_url ||
        song.audioUrl ||
        song.file_url ||
        song.fileUrl ||
        song.url ||
        "",

      cover:
        song.cover_url ||
        song.coverUrl ||
        (youtubeId
          ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
          : "/images/ganpati.jpg")
    };
  }

  function extractYouTubeId(value) {
    if (!value) return null;

    try {
      const url = new URL(value.trim());

      if (url.hostname.includes("youtu.be")) {
        return url.pathname.split("/").filter(Boolean)[0] || null;
      }

      if (url.searchParams.get("v")) {
        return url.searchParams.get("v");
      }

      const parts = url.pathname.split("/").filter(Boolean);

      const index = parts.findIndex(part =>
        ["embed", "shorts", "live"].includes(part)
      );

      if (index !== -1 && parts[index + 1]) {
        return parts[index + 1];
      }
    } catch {
      return null;
    }

    return null;
  }

  function youtubeEmbedUrl(id) {
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
  }

  async function api(path, options = {}) {
    const opts = { ...options };

    opts.headers = {
      ...(options.headers || {})
    };

    if (options.admin !== false && state.adminKey) {
      opts.headers["x-admin-key"] = state.adminKey;
    }

    const response = await fetch(path, opts);

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `${response.status} ${response.statusText}`
      );
    }

    return data;
  }

  async function loadSongs() {
    try {
      const data = await api("/api/songs", {
        method: "GET",
        admin: false
      });

      const songs =
        Array.isArray(data)
          ? data
          : data.songs || data.data || [];

      state.songs = songs.map(normalizeSong);

      renderAll();

    } catch (error) {
      console.error("Song loading error:", error);

      state.songs = [];

      renderAll();

      toast("Unable to load songs");
    }
  }

  function renderAll() {
    const query =
      E.search.value.trim().toLowerCase();

    let songs = state.songs;

    if (query) {
      songs = songs.filter(song =>
        [
          song.title,
          song.artist,
          song.album,
          song.category,
          song.language
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    const audioSongs =
      songs.filter(song =>
        song.source === "youtube" ||
        song.source === "mp3" ||
        !song.source.includes("video")
      );

    const videoSongs =
      songs.filter(song =>
        song.source === "youtube" ||
        song.source === "video" ||
        song.source === "mp4"
      );

    renderSongGrid(E.homeSongs, songs);

    renderSongGrid(E.audioSongs, audioSongs);

    renderVideoGrid(videoSongs);

    renderSongGrid(E.librarySongs, songs);

    renderAdminSongs();

    E.count.textContent =
      `${state.songs.length} song${state.songs.length === 1 ? "" : "s"}`;
  }

  function renderSongGrid(container, songs) {
    if (!songs.length) {
      container.innerHTML =
        `<div class="empty">No songs found</div>`;
      return;
    }

    container.innerHTML = songs.map((song, i) => `
      <article class="song-card">
        <img
          class="song-cover"
          src="${escapeHTML(song.cover)}"
          alt=""
          loading="lazy"
          onerror="this.src='/images/ganpati.jpg'"
        >

        <div class="song-info">
          <strong>${escapeHTML(song.title)}</strong>
          <small>
            ${escapeHTML(song.artist)}
            ·
            ${song.source === "youtube" ? "YouTube" : "MP3"}
          </small>

          <button
            class="song-play"
            data-play-id="${escapeHTML(song.id)}"
          >
            ▶ Play
          </button>
        </div>
      </article>
    `).join("");

    container.querySelectorAll("[data-play-id]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const song = state.songs.find(
            item => String(item.id) === String(button.dataset.playId)
          );

          if (song) {
            playSong(song);
          }
        });
      });
  }

  function renderVideoGrid(songs) {
    if (!songs.length) {
      E.videoSongs.innerHTML =
        `<div class="empty">No video songs found</div>`;
      return;
    }

    E.videoSongs.innerHTML = songs.map(song => {

      const thumbnail =
        song.youtubeId
          ? `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`
          : song.cover;

      return `
        <article class="video-card">

          <img
            class="video-thumb"
            src="${escapeHTML(thumbnail)}"
            alt=""
            loading="lazy"
            onerror="this.src='/images/ganpati.jpg'"
          >

          <div class="video-card-body">
            <strong>${escapeHTML(song.title)}</strong>

            <p>${escapeHTML(song.artist)}</p>

            <button
              class="primary-btn video-open"
              data-video-id="${escapeHTML(song.id)}"
            >
              ▶ Watch
            </button>
          </div>

        </article>
      `;
    }).join("");

    E.videoSongs.querySelectorAll(".video-open")
      .forEach(button => {
        button.addEventListener("click", () => {
          const song = state.songs.find(
            item => String(item.id) === String(button.dataset.videoId)
          );

          if (song) {
            openVideo(song);
          }
        });
      });
  }

  function renderAdminSongs() {
    if (!state.songs.length) {
      E.adminSongs.innerHTML =
        `<div class="empty">No songs in database</div>`;
      return;
    }

    E.adminSongs.innerHTML = state.songs.map(song => `
      <div class="admin-song">
        <strong>${escapeHTML(song.title)}</strong>
        <br>
        <small>
          ${escapeHTML(song.artist)}
          ·
          ${escapeHTML(song.source)}
        </small>
      </div>
    `).join("");
  }

  function showView(name) {
    document.querySelectorAll(".page-view")
      .forEach(view => {
        view.classList.remove("active");
      });

    const target = $(`view-${name}`);

    if (target) {
      target.classList.add("active");
    }

    document.querySelectorAll(".nav-btn")
      .forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.view === name
        );
      });

    E.sidebar.classList.remove("open");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (name === "admin") {
      loadAdminSongs();
    }
  }

  async function loadAdminSongs() {
    try {
      const data = await api("/api/songs", {
        method: "GET",
        admin: false
      });

      const songs =
        Array.isArray(data)
          ? data
          : data.songs || data.data || [];

      state.songs = songs.map(normalizeSong);

      renderAdminSongs();

    } catch (error) {
      console.error(error);
    }
  }

  function playSong(song) {
    const index = state.songs.findIndex(
      item => String(item.id) === String(song.id)
    );

    state.playlist =
      state.songs.filter(item =>
        item.source === "youtube" ||
        item.source === "mp3"
      );

    state.index =
      state.playlist.findIndex(
        item => String(item.id) === String(song.id)
      );

    if (state.index < 0) {
      state.playlist = [song];
      state.index = 0;
    }

    loadCurrent();
  }

  function playAll() {
    state.playlist =
      state.songs.filter(song =>
        song.source === "youtube" ||
        song.source === "mp3"
      );

    if (!state.playlist.length) {
      toast("No audio songs available");
      return;
    }

    state.index = 0;

    loadCurrent();
  }

  function loadCurrent() {
    const song = state.playlist[state.index];

    if (!song) return;

    E.playerTitle.textContent = song.title;
    E.playerArtist.textContent = song.artist;
    E.playerImage.src = song.cover;

    E.currentTime.textContent = "0:00";
    E.duration.textContent = "0:00";
    E.progress.value = 0;

    if (song.source === "youtube") {
      playYouTubeAudio(song);
      return;
    }

    playMP3(song);
  }

  function playMP3(song) {
    if (!song.url) {
      toast("MP3 URL unavailable");
      return;
    }

    audio.src = song.url;
    audio.load();

    audio.play()
      .then(() => {
        state.playing = true;
        updatePlayButton();
      })
      .catch(error => {
        console.error(error);
        toast("Unable to play MP3");
      });
  }

  /*
   * Browser limitation:
   *
   * YouTube does NOT provide a direct audio URL through the normal
   * YouTube embed/player URL. Therefore we use the YouTube iframe
   * player for YouTube audio mode.
   *
   * The video itself is visually hidden while audio mode is active.
   */
  function playYouTubeAudio(song) {
    if (!song.youtubeId) {
      toast("Invalid YouTube song");
      return;
    }

    audio.pause();
    audio.removeAttribute("src");

    E.videoPlayer.classList.remove("hidden");

    E.videoFrame.innerHTML = `
      <iframe
        id="youtubeAudioFrame"
        src="${youtubeEmbedUrl(song.youtubeId)}"
        title="${escapeHTML(song.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen>
      </iframe>
    `;

    /*
     * Keep iframe visually hidden for Audio mode.
     * The browser still renders the YouTube player.
     */
    E.videoPlayer.style.position = "fixed";
    E.videoPlayer.style.width = "1px";
    E.videoPlayer.style.height = "1px";
    E.videoPlayer.style.left = "-100px";
    E.videoPlayer.style.bottom = "-100px";
    E.videoPlayer.style.opacity = "0";
    E.videoPlayer.style.pointerEvents = "none";

    state.playing = true;
    updatePlayButton();

    toast(`Playing ${song.title}`);
  }

  function openVideo(song) {
    showView("video");

    if (song.youtubeId) {

      E.videoPlayer.classList.remove("hidden");

      E.videoPlayer.style.position = "";
      E.videoPlayer.style.width = "";
      E.videoPlayer.style.height = "";
      E.videoPlayer.style.left = "";
      E.videoPlayer.style.bottom = "";
      E.videoPlayer.style.opacity = "";
      E.videoPlayer.style.pointerEvents = "";

      E.videoFrame.innerHTML = `
        <iframe
          src="${youtubeEmbedUrl(song.youtubeId)}"
          title="${escapeHTML(song.title)}"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen>
        </iframe>
      `;

      return;
    }

    if (song.url) {
      E.videoPlayer.classList.remove("hidden");

      E.videoFrame.innerHTML = `
        <video
          src="${escapeHTML(song.url)}"
          controls
          autoplay
          playsinline>
        </video>
      `;

      return;
    }

    toast("Video URL unavailable");
  }

  function nextSong() {
    if (!state.playlist.length) {
      playAll();
      return;
    }

    state.index++;

    if (state.index >= state.playlist.length) {
      state.index = 0;
    }

    loadCurrent();
  }

  function previousSong() {
    if (!state.playlist.length) return;

    state.index--;

    if (state.index < 0) {
      state.index = state.playlist.length - 1;
    }

    loadCurrent();
  }

  function stopSong() {
    audio.pause();
    audio.currentTime = 0;

    const frame =
      $("youtubeAudioFrame");

    if (frame) {
      frame.src = "about:blank";
    }

    state.playing = false;

    updatePlayButton();
  }

  function togglePlay() {
    const song = state.playlist[state.index];

    if (!song) {
      playAll();
      return;
    }

    if (song.source === "mp3") {
      if (audio.paused) {
        audio.play()
          .then(() => {
            state.playing = true;
            updatePlayButton();
          })
          .catch(() => toast("Unable to play"));
      } else {
        audio.pause();
        state.playing = false;
        updatePlayButton();
      }

      return;
    }

    toast("Use the YouTube player for YouTube playback");
  }

  function updatePlayButton() {
    E.playPause.textContent =
      state.playing ? "Ⅱ" : "▶";
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins}:${String(secs).padStart(2,"0")}`;
  }

  async function submitYouTubeSong(form) {

    const youtubeUrl =
      form.querySelector('[name="youtube_url"]')
        ?.value.trim();

    if (!youtubeUrl) {
      toast("Enter a YouTube URL");
      return;
    }

    const youtubeId =
      extractYouTubeId(youtubeUrl);

    if (!youtubeId) {
      toast("Invalid YouTube URL");
      return;
    }

    const data = {
      title:
        form.querySelector('[name="title"]')
          ?.value.trim() || "Untitled",

      artist:
        form.querySelector('[name="artist"]')
          ?.value.trim() || "SwarAJ",

      album:
        form.querySelector('[name="album"]')
          ?.value.trim() || "Singles",

      category:
        form.querySelector('[name="category"]')
          ?.value.trim() || "Other",

      language:
        form.querySelector('[name="language"]')
          ?.value.trim() || "",

      youtubeUrl,

      coverUrl:
        form.querySelector('[name="cover_url"]')
          ?.value.trim() ||
        `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
    };

    try {

      const result = await api(
        "/api/admin/songs/youtube",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(data),

          admin: true
        }
      );

      toast(
        result.message ||
        "YouTube song added successfully"
      );

      form.reset();

      await loadSongs();

      await loadAdminSongs();

    } catch (error) {

      console.error(
        "YouTube submit error:",
        error
      );

      toast(
        error.message ||
        "Unable to add YouTube song"
      );
    }
  }

  async function submitMultipart(form, endpoint) {

    const formData =
      new FormData(form);

    try {

      const result = await api(
        endpoint,
        {
          method: "POST",
          body: formData,
          admin: true
        }
      );

      toast(
        result.message ||
        "Upload successful"
      );

      form.reset();

      await loadSongs();

      await loadAdminSongs();

    } catch (error) {

      console.error(
        "Upload error:",
        error
      );

      toast(
        error.message ||
        "Upload failed"
      );
    }
  }

  /* NAVIGATION */

  E.nav.forEach(button => {

    button.addEventListener("click", event => {

      event.preventDefault();

      const view =
        button.dataset.view;

      if (view) {
        showView(view);
      }
    });
  });

  document
    .querySelectorAll("[data-view]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const view =
          button.dataset.view;

        if (view) {
          showView(view);
        }

      });

    });

  E.menuBtn.addEventListener(
    "click",
    () => {
      E.sidebar.classList.add("open");
    }
  );

  E.closeMenu.addEventListener(
    "click",
    () => {
      E.sidebar.classList.remove("open");
    }
  );

  E.playAll.addEventListener(
    "click",
    playAll
  );

  E.previous.addEventListener(
    "click",
    previousSong
  );

  E.next.addEventListener(
    "click",
    nextSong
  );

  E.stop.addEventListener(
    "click",
    stopSong
  );

  E.playPause.addEventListener(
    "click",
    togglePlay
  );

  E.search.addEventListener(
    "input",
    renderAll
  );

  /* YOUTUBE — IMPORTANT FIX */

  E.youtubeForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      submitYouTubeSong(
        E.youtubeForm
      );
    }
  );

  /* MP3 */

  E.mp3Form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      submitMultipart(
        E.mp3Form,
        "/api/admin/songs/mp3"
      );
    }
  );

  /* VIDEO */

  E.videoForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      submitMultipart(
        E.videoForm,
        "/api/admin/songs/video"
      );
    }
  );

  E.refreshAdmin.addEventListener(
    "click",
    loadAdminSongs
  );

  /* AUDIO EVENTS */

  audio.addEventListener(
    "loadedmetadata",
    () => {
      E.duration.textContent =
        formatTime(audio.duration);
    }
  );

  audio.addEventListener(
    "timeupdate",
    () => {

      if (!audio.duration) return;

      E.currentTime.textContent =
        formatTime(audio.currentTime);

      E.progress.value =
        (audio.currentTime / audio.duration) * 100;
    }
  );

  audio.addEventListener(
    "play",
    () => {

      state.playing = true;

      updatePlayButton();
    }
  );

  audio.addEventListener(
    "pause",
    () => {

      state.playing = false;

      updatePlayButton();
    }
  );

  audio.addEventListener(
    "ended",
    nextSong
  );

  E.progress.addEventListener(
    "input",
    () => {

      if (!audio.duration) return;

      audio.currentTime =
        (E.progress.value / 100) *
        audio.duration;
    }
  );

  /* START */

  showView("home");

  loadSongs();

})();