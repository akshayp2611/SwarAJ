(() => {
  "use strict";

  const state = {
    songs: [],
    filteredSongs: [],
    currentIndex: -1,
    youtubePlayer: null,
    youtubeReady: false,
    youtubeApiLoading: false,
    youtubeVisible: false,
    adminUnlocked: false,
    isPlaying: false,
    progressTimer: null,
    searchTimer: null
  };

  const $ = id => document.getElementById(id);

  const audio = $("audioPlayer");

  /* --------------------------------------------------
     BASIC HELPERS
  -------------------------------------------------- */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);

    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  function getCover(song) {
    return (
      song.cover ||
      song.image ||
      song.thumbnail ||
      song.artwork ||
      ""
    );
  }

  function getTitle(song) {
    return song.title || song.name || "Unknown Song";
  }

  function getArtist(song) {
    return song.artist || song.author || "SwarAJ";
  }

  function isYouTube(song) {
    const type = String(
      song.type ||
      song.source ||
      song.platform ||
      ""
    ).toLowerCase();

    return (
      type.includes("youtube") ||
      type === "video" ||
      Boolean(
        song.youtubeId ||
        song.youtube_id ||
        song.videoId ||
        song.video_id
      ) ||
      /(?:youtube\.com|youtu\.be)/i.test(
        song.url || song.src || song.audioUrl || ""
      )
    );
  }

  function getYouTubeId(song) {
    if (song.youtubeId) return song.youtubeId;
    if (song.youtube_id) return song.youtube_id;
    if (song.videoId) return song.videoId;
    if (song.video_id) return song.video_id;

    const value =
      song.url ||
      song.src ||
      song.audioUrl ||
      song.videoUrl ||
      "";

    try {
      const url = new URL(value);

      if (url.hostname.includes("youtu.be")) {
        return url.pathname.substring(1).split("/")[0];
      }

      if (url.hostname.includes("youtube.com")) {
        if (url.searchParams.get("v")) {
          return url.searchParams.get("v");
        }

        const parts = url.pathname.split("/");

        const index = parts.indexOf("embed");

        if (index >= 0 && parts[index + 1]) {
          return parts[index + 1];
        }

        const shortIndex = parts.indexOf("shorts");

        if (shortIndex >= 0 && parts[shortIndex + 1]) {
          return parts[shortIndex + 1];
        }
      }
    } catch (_) {}

    const match = String(value).match(
      /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/
    );

    return match ? match[1] : "";
  }

  function getAudioUrl(song) {
    return (
      song.audioUrl ||
      song.audio_url ||
      song.fileUrl ||
      song.file_url ||
      song.path ||
      song.url ||
      song.src ||
      ""
    );
  }

  /* --------------------------------------------------
     NORMALIZE SONG
  -------------------------------------------------- */

  function normalizeSong(song, index) {
    const youtube = isYouTube(song);

    return {
      ...song,
      id: song.id ?? song.song_id ?? `song-${index}`,
      title: getTitle(song),
      artist: getArtist(song),
      cover: getCover(song),
      type: youtube ? "youtube" : "mp3",
      youtubeId: youtube ? getYouTubeId(song) : "",
      audioUrl: youtube ? "" : getAudioUrl(song),
      category: song.category || "All Songs"
    };
  }

  /* --------------------------------------------------
     LOAD SONGS
  -------------------------------------------------- */

  async function loadSongs() {
    try {
      const response = await fetch("/api/songs", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      let songs = Array.isArray(data)
        ? data
        : (
          data.songs ||
          data.data ||
          data.items ||
          []
        );

      state.songs = songs.map(normalizeSong);

      state.filteredSongs = [...state.songs];

      renderAll();

      restorePlaylist();

    } catch (error) {
      console.error("Song loading error:", error);

      $("homeSongs").innerHTML =
        `<div class="empty">Unable to load songs</div>`;

      $("songsList").innerHTML =
        `<div class="empty">Unable to load songs</div>`;
    }
  }

  /* --------------------------------------------------
     RENDER
  -------------------------------------------------- */

  function renderAll() {
    renderHome();
    renderSongs();
    renderPlaylist();
    renderLiked();
  }

  function songCoverHTML(song) {
    const cover = getCover(song);

    if (cover) {
      return `
        <img
          src="${escapeHTML(cover)}"
          alt="${escapeHTML(getTitle(song))}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
      `;
    }

    return `<span>♫</span>`;
  }

  function renderHome() {
    const list = state.filteredSongs.slice(0, 12);

    if (!list.length) {
      $("homeSongs").innerHTML =
        `<div class="empty">No songs found</div>`;
      return;
    }

    $("homeSongs").innerHTML = list
      .map((song, index) => `
        <article class="song-card">

          <div class="cover">
            ${songCoverHTML(song)}
          </div>

          <div class="song-card-title">
            ${escapeHTML(song.title)}
          </div>

          <div class="song-card-artist">
            ${escapeHTML(song.artist)}
          </div>

          <button
            class="card-play"
            data-play-index="${state.songs.indexOf(song)}"
            aria-label="Play"
          >
            ▶
          </button>

        </article>
      `)
      .join("");
  }

  function renderSongs() {
    const list = state.filteredSongs;

    if (!list.length) {
      $("songsList").innerHTML =
        `<div class="empty">No songs found</div>`;
      return;
    }

    $("songsList").innerHTML = list
      .map(song => songRowHTML(song))
      .join("");
  }

  function songRowHTML(song) {
    const index = state.songs.indexOf(song);

    return `
      <div class="song-row">

        <div class="song-row-art">
          ${songCoverHTML(song)}
        </div>

        <div class="song-row-info">

          <div class="song-row-title">
            ${escapeHTML(song.title)}
          </div>

          <div class="song-row-artist">
            ${escapeHTML(song.artist)}
          </div>

        </div>

        <button
          class="row-play"
          data-play-index="${index}"
        >
          ▶
        </button>

      </div>
    `;
  }

  function renderPlaylist() {
    const playlist = getPlaylist();

    if (!playlist.length) {
      $("playlistList").innerHTML =
        `<div class="empty">Playlist is empty</div>`;
      return;
    }

    $("playlistList").innerHTML =
      playlist.map(song => songRowHTML(song)).join("");
  }

  function renderLiked() {
    const likedIds = getLikedIds();

    const liked = state.songs.filter(song =>
      likedIds.includes(String(song.id))
    );

    if (!liked.length) {
      $("likedList").innerHTML =
        `<div class="empty">No liked songs</div>`;
      return;
    }

    $("likedList").innerHTML =
      liked.map(song => songRowHTML(song)).join("");
  }

  /* --------------------------------------------------
     PLAYLIST
  -------------------------------------------------- */

  function getPlaylist() {
    return state.songs;
  }

  function getLikedIds() {
    try {
      return JSON.parse(
        localStorage.getItem("swarajLiked") || "[]"
      ).map(String);
    } catch (_) {
      return [];
    }
  }

  function isLiked(song) {
    return getLikedIds().includes(String(song.id));
  }

  function toggleLike() {
    const song = state.songs[state.currentIndex];

    if (!song) return;

    let liked = getLikedIds();

    const id = String(song.id);

    if (liked.includes(id)) {
      liked = liked.filter(x => x !== id);
    } else {
      liked.push(id);
    }

    localStorage.setItem(
      "swarajLiked",
      JSON.stringify(liked)
    );

    updateLikeButton();
    renderLiked();
  }

  function restorePlaylist() {
    renderPlaylist();
  }

  /* --------------------------------------------------
     AUDIO PLAYER
  -------------------------------------------------- */

  async function playSong(index) {
    if (
      index < 0 ||
      index >= state.songs.length
    ) {
      return;
    }

    const song = state.songs[index];

    state.currentIndex = index;

    updatePlayerInfo(song);

    /*
      IMPORTANT:
      Every new song starts in audio mode.
      YouTube video is ALWAYS hidden until Watch Video
      is clicked.
    */

    hideYouTubeVideo();

    if (song.type === "youtube") {
      await playYouTubeAudio(song);
    } else {
      await playMP3(song);
    }

    updateMediaSession(song);
  }

  async function playMP3(song) {
    stopYouTube();

    const url = getAudioUrl(song);

    if (!url) {
      console.error("No MP3 URL:", song);
      return;
    }

    audio.pause();

    audio.src = url;
    audio.currentTime = 0;

    audio.volume =
      Number($("volumeBar").value) || 1;

    try {
      await audio.play();

      state.isPlaying = true;

      updatePlayButton();

      startProgressTimer();

    } catch (error) {
      console.error("MP3 play error:", error);
    }
  }

  async function playYouTubeAudio(song) {
    const id = song.youtubeId;

    if (!id) {
      console.error("Invalid YouTube URL:", song);
      return;
    }

    /*
      YouTube video is loaded but visually hidden.
      The player remains the actual YouTube player so that
      playback is handled by YouTube.
    */

    await loadYouTubeAPI();

    createYouTubePlayer(id);

    if (state.youtubePlayer) {
      state.youtubePlayer.loadVideoById(id);
      state.youtubePlayer.playVideo();

      state.isPlaying = true;

      updatePlayButton();

      startProgressTimer();
    }
  }

  /* --------------------------------------------------
     YOUTUBE API
  -------------------------------------------------- */

  function loadYouTubeAPI() {
    return new Promise(resolve => {

      if (window.YT && window.YT.Player) {
        state.youtubeReady = true;
        resolve();
        return;
      }

      if (state.youtubeApiLoading) {
        const timer = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(timer);
            state.youtubeReady = true;
            resolve();
          }
        }, 100);

        return;
      }

      state.youtubeApiLoading = true;

      const oldCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof oldCallback === "function") {
          oldCallback();
        }

        state.youtubeReady = true;
        resolve();
      };

      const script = document.createElement("script");

      script.src =
        "https://www.youtube.com/iframe_api";

      script.async = true;

      document.head.appendChild(script);
    });
  }

  function createYouTubePlayer(videoId) {
    if (!state.youtubeReady) return;

    if (state.youtubePlayer) {
      try {
        state.youtubePlayer.loadVideoById(videoId);
        return;
      } catch (_) {}
    }

    state.youtubePlayer = new YT.Player(
      "youtubePlayer",
      {
        videoId,

        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          playsinline: 1,
          modestbranding: 1
        },

        events: {
          onReady: event => {
            event.target.setVolume(
              Number($("volumeBar").value) * 100
            );

            event.target.playVideo();

            startProgressTimer();
          },

          onStateChange: event => {

            if (
              event.data === YT.PlayerState.PLAYING
            ) {
              state.isPlaying = true;
              updatePlayButton();
            }

            if (
              event.data === YT.PlayerState.PAUSED
            ) {
              state.isPlaying = false;
              updatePlayButton();
            }

            if (
              event.data === YT.PlayerState.ENDED
            ) {
              playNext();
            }
          }
        }
      }
    );
  }

  function stopYouTube() {
    if (!state.youtubePlayer) return;

    try {
      state.youtubePlayer.stopVideo();
    } catch (_) {}
  }

  /* --------------------------------------------------
     WATCH VIDEO
  -------------------------------------------------- */

  function showYouTubeVideo() {
    const song = state.songs[state.currentIndex];

    if (!song || song.type !== "youtube") {
      return;
    }

    $("videoContainer").classList.remove("hidden");

    $("watchVideoBtn").textContent =
      "✕ Hide Video";

    state.youtubeVisible = true;

    if (
      state.youtubePlayer &&
      song.youtubeId
    ) {
      state.youtubePlayer.playVideo();
    }
  }

  function hideYouTubeVideo() {
    $("videoContainer").classList.add("hidden");

    $("watchVideoBtn").classList.add("hidden");

    $("watchVideoBtn").textContent =
      "▶ Watch Video";

    state.youtubeVisible = false;
  }

  function toggleYouTubeVideo() {
    const song = state.songs[state.currentIndex];

    if (!song || song.type !== "youtube") {
      return;
    }

    if (state.youtubeVisible) {
      hideYouTubeVideo();
    } else {
      showYouTubeVideo();
    }
  }

  /* --------------------------------------------------
     PLAYER INFO
  -------------------------------------------------- */

  function updatePlayerInfo(song) {
    $("playerTitle").textContent =
      song.title || "Unknown Song";

    $("playerArtist").textContent =
      song.artist || "SwarAJ";

    const cover = getCover(song);

    if (cover) {
      $("playerArtwork").innerHTML =
        `<img src="${escapeHTML(cover)}" alt="">`;
    } else {
      $("playerArtwork").innerHTML =
        `<span>♫</span>`;
    }

    if (song.type === "youtube") {
      $("watchVideoBtn").classList.remove("hidden");
    } else {
      $("watchVideoBtn").classList.add("hidden");
    }

    updateLikeButton();
  }

  function updateLikeButton() {
    const song = state.songs[state.currentIndex];

    $("likeBtn").textContent =
      song && isLiked(song)
        ? "♥"
        : "♡";
  }

  /* --------------------------------------------------
     PLAY / PAUSE
  -------------------------------------------------- */

  async function togglePlayPause() {
    const song = state.songs[state.currentIndex];

    if (!song) {
      if (state.songs.length) {
        await playSong(0);
      }

      return;
    }

    if (song.type === "youtube") {

      if (!state.youtubePlayer) {
        await playYouTubeAudio(song);
        return;
      }

      const playerState =
        state.youtubePlayer.getPlayerState();

      if (
        playerState === YT.PlayerState.PLAYING
      ) {
        state.youtubePlayer.pauseVideo();
      } else {
        state.youtubePlayer.playVideo();
      }

    } else {

      if (audio.paused) {
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

      updatePlayButton();
    }
  }

  function updatePlayButton() {
    $("playPauseBtn").textContent =
      state.isPlaying ? "❚❚" : "▶";
  }

  /* --------------------------------------------------
     NEXT / PREVIOUS
  -------------------------------------------------- */

  function playNext() {
    if (!state.songs.length) return;

    let next =
      state.currentIndex + 1;

    if (next >= state.songs.length) {
      next = 0;
    }

    playSong(next);
  }

  function playPrevious() {
    if (!state.songs.length) return;

    let previous =
      state.currentIndex - 1;

    if (previous < 0) {
      previous = state.songs.length - 1;
    }

    playSong(previous);
  }

  /* --------------------------------------------------
     PROGRESS
  -------------------------------------------------- */

  function startProgressTimer() {
    clearInterval(state.progressTimer);

    state.progressTimer = setInterval(
      updateProgress,
      500
    );
  }

  function updateProgress() {
    const song =
      state.songs[state.currentIndex];

    if (!song) return;

    let current = 0;
    let duration = 0;

    if (
      song.type === "youtube" &&
      state.youtubePlayer
    ) {
      try {
        current =
          state.youtubePlayer.getCurrentTime() || 0;

        duration =
          state.youtubePlayer.getDuration() || 0;
      } catch (_) {}
    } else {
      current = audio.currentTime || 0;
      duration = audio.duration || 0;
    }

    $("currentTime").textContent =
      formatTime(current);

    $("duration").textContent =
      formatTime(duration);

    $("progressBar").value =
      duration
        ? (current / duration) * 100
        : 0;
  }

  function seek(value) {
    const song =
      state.songs[state.currentIndex];

    if (!song) return;

    const percent =
      Number(value) / 100;

    if (
      song.type === "youtube" &&
      state.youtubePlayer
    ) {
      const duration =
        state.youtubePlayer.getDuration();

      if (duration) {
        state.youtubePlayer.seekTo(
          duration * percent,
          true
        );
      }
    } else if (
      Number.isFinite(audio.duration)
    ) {
      audio.currentTime =
        audio.duration * percent;
    }
  }

  /* --------------------------------------------------
     MEDIA SESSION / BACKGROUND CONTROLS
  -------------------------------------------------- */

  function updateMediaSession(song) {

    if (!("mediaSession" in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: "SwarAJ Music",
          artwork: getCover(song)
            ? [
                {
                  src: getCover(song),
                  sizes: "512x512",
                  type: "image/jpeg"
                }
              ]
            : []
        });

      navigator.mediaSession.setActionHandler(
        "play",
        () => togglePlayPause()
      );

      navigator.mediaSession.setActionHandler(
        "pause",
        () => togglePlayPause()
      );

      navigator.mediaSession.setActionHandler(
        "previoustrack",
        () => playPrevious()
      );

      navigator.mediaSession.setActionHandler(
        "nexttrack",
        () => playNext()
      );

      navigator.mediaSession.setActionHandler(
        "seekbackward",
        () => {
          seekRelative(-10);
        }
      );

      navigator.mediaSession.setActionHandler(
        "seekforward",
        () => {
          seekRelative(10);
        }
      );

    } catch (error) {
      console.warn(
        "Media Session not fully supported",
        error
      );
    }
  }

  function seekRelative(seconds) {
    const song =
      state.songs[state.currentIndex];

    if (!song) return;

    if (
      song.type === "youtube" &&
      state.youtubePlayer
    ) {
      const current =
        state.youtubePlayer.getCurrentTime();

      state.youtubePlayer.seekTo(
        Math.max(0,current + seconds),
        true
      );

    } else {
      audio.currentTime =
        Math.max(
          0,
          audio.currentTime + seconds
        );
    }
  }

  /* --------------------------------------------------
     SEARCH
  -------------------------------------------------- */

  function searchSongs(value) {
    const query =
      String(value || "")
        .trim()
        .toLowerCase();

    if (!query) {
      state.filteredSongs =
        [...state.songs];
    } else {
      state.filteredSongs =
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
    }

    renderHome();
    renderSongs();
  }

  /* --------------------------------------------------
     NAVIGATION
  -------------------------------------------------- */

  function openSection(section) {

    document
      .querySelectorAll(".page-section")
      .forEach(el =>
        el.classList.remove("active")
      );

    const target =
      $(`${section}Section`);

    if (target) {
      target.classList.add("active");
    }

    document
      .querySelectorAll(".menu-item")
      .forEach(btn =>
        btn.classList.toggle(
          "active",
          btn.dataset.section === section
        )
      );

    if (
      window.innerWidth <= 900
    ) {
      $("sidebar").classList.remove("open");
    }
  }

  /* --------------------------------------------------
     ADMIN
  -------------------------------------------------- */

  async function adminLogin() {
    const key =
      $("adminKeyInput").value.trim();

    if (!key) {
      $("adminLoginMessage").textContent =
        "Enter admin key.";
      return;
    }

    $("adminLoginMessage").textContent =
      "Checking...";

    /*
      Keeps backend admin protection.
      Supports common endpoint names.
    */

    const endpoints = [
      "/api/admin/login",
      "/api/admin/auth",
      "/api/admin/verify"
    ];

    let success = false;

    for (const endpoint of endpoints) {

      try {

        const response = await fetch(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              key
            })
          }
        );

        if (!response.ok) {
          continue;
        }

        const data =
          await response.json()
            .catch(() => ({}));

        if (
          data.success !== false &&
          data.authenticated !== false
        ) {
          success = true;
          break;
        }

      } catch (_) {}
    }

    if (!success) {
      $("adminLoginMessage").textContent =
        "Invalid admin key.";
      return;
    }

    state.adminUnlocked = true;

    sessionStorage.setItem(
      "swarajAdmin",
      "true"
    );

    $("adminLoginBox")
      .classList.add("hidden");

    $("adminPanel")
      .classList.remove("hidden");

    $("adminLoginMessage").textContent = "";

    openSection("admin");
  }

  function restoreAdmin() {
    if (
      sessionStorage.getItem(
        "swarajAdmin"
      ) === "true"
    ) {
      state.adminUnlocked = true;

      $("adminLoginBox")
        .classList.add("hidden");

      $("adminPanel")
        .classList.remove("hidden");
    }
  }

  /* --------------------------------------------------
     ADMIN TABS
  -------------------------------------------------- */

  function setupAdminTabs() {

    document
      .querySelectorAll(".admin-tab")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(".admin-tab")
              .forEach(btn =>
                btn.classList.remove("active")
              );

            document
              .querySelectorAll(
                ".admin-tab-content"
              )
              .forEach(tab =>
                tab.classList.remove("active")
              );

            button.classList.add("active");

            const name =
              button.dataset.adminTab;

            if (name === "upload") {
              $("uploadAdminTab")
                .classList.add("active");
            }

            if (name === "youtube") {
              $("youtubeAdminTab")
                .classList.add("active");
            }

          }
        );

      });
  }

  /* --------------------------------------------------
     MP3 UPLOAD
  -------------------------------------------------- */

  async function uploadMP3(event) {

    event.preventDefault();

    const form =
      $("uploadForm");

    const file =
      $("uploadFile").files[0];

    if (!file) {
      $("uploadMessage").textContent =
        "Select an MP3 file.";
      return;
    }

    const formData =
      new FormData(form);

    $("uploadMessage").textContent =
      "Uploading...";

    try {

      const response =
        await fetch(
          "/api/admin/upload",
          {
            method: "POST",
            body: formData,
            headers: getAdminHeaders()
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

      $("uploadMessage").textContent =
        data.message ||
        "Song uploaded successfully.";

      form.reset();

      await loadSongs();

    } catch (error) {

      console.error(error);

      $("uploadMessage").textContent =
        error.message ||
        "Upload failed.";

    }
  }

  /* --------------------------------------------------
     YOUTUBE ADD
  -------------------------------------------------- */

  async function addYouTubeSong(event) {

    event.preventDefault();

    const title =
      $("youtubeTitle").value.trim();

    const artist =
      $("youtubeArtist").value.trim();

    const category =
      $("youtubeCategory").value.trim();

    const url =
      $("youtubeUrl").value.trim();

    const cover =
      $("youtubeCover").value.trim();

    if (!title || !url) {
      $("youtubeMessage").textContent =
        "Title and YouTube URL are required.";
      return;
    }

    const youtubeId =
      extractYouTubeId(url);

    if (!youtubeId) {
      $("youtubeMessage").textContent =
        "Invalid YouTube URL.";
      return;
    }

    $("youtubeMessage").textContent =
      "Adding YouTube song...";

    try {

      const response =
        await fetch(
          "/api/admin/youtube",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              ...getAdminHeaders()
            },

            body: JSON.stringify({
              title,
              artist,
              category,
              url,
              cover,
              youtubeId,
              type: "youtube"
            })
          }
        );

      const data =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Request failed (${response.status})`
        );
      }

      $("youtubeMessage").textContent =
        data.message ||
        "YouTube song added successfully.";

      $("youtubeForm").reset();

      await loadSongs();

    } catch (error) {

      console.error(error);

      $("youtubeMessage").textContent =
        error.message ||
        "Unable to add YouTube song.";

    }
  }

  function extractYouTubeId(urlString) {

    try {

      const url =
        new URL(urlString);

      if (
        url.hostname === "youtu.be" ||
        url.hostname === "www.youtu.be"
      ) {
        return url.pathname
          .substring(1)
          .split("/")[0];
      }

      if (
        url.hostname.includes("youtube.com")
      ) {

        const v =
          url.searchParams.get("v");

        if (v) return v;

        const parts =
          url.pathname.split("/");

        const embed =
          parts.indexOf("embed");

        if (
          embed >= 0 &&
          parts[embed + 1]
        ) {
          return parts[embed + 1];
        }

        const shorts =
          parts.indexOf("shorts");

        if (
          shorts >= 0 &&
          parts[shorts + 1]
        ) {
          return parts[shorts + 1];
        }
      }

    } catch (_) {}

    return "";
  }

  function getAdminHeaders() {

    const key =
      $("adminKeyInput").value.trim();

    return key
      ? {
          "X-Admin-Key": key
        }
      : {};
  }

  /* --------------------------------------------------
     EVENTS
  -------------------------------------------------- */

  function setupEvents() {

    document.addEventListener(
      "click",
      event => {

        const play =
          event.target.closest(
            "[data-play-index]"
          );

        if (play) {

          const index =
            Number(
              play.dataset.playIndex
            );

          playSong(index);
        }
      }
    );

    document
      .querySelectorAll(".menu-item")
      .forEach(button => {

        button.addEventListener(
          "click",
          () =>
            openSection(
              button.dataset.section
            )
        );

      });

    $("menuToggle")
      .addEventListener(
        "click",
        () =>
          $("sidebar")
            .classList.toggle("open")
      );

    $("adminTopBtn")
      .addEventListener(
        "click",
        () => openSection("admin")
      );

    $("playPauseBtn")
      .addEventListener(
        "click",
        togglePlayPause
      );

    $("nextBtn")
      .addEventListener(
        "click",
        playNext
      );

    $("prevBtn")
      .addEventListener(
        "click",
        playPrevious
      );

    $("likeBtn")
      .addEventListener(
        "click",
        toggleLike
      );

    $("watchVideoBtn")
      .addEventListener(
        "click",
        toggleYouTubeVideo
      );

    $("progressBar")
      .addEventListener(
        "input",
        event =>
          seek(event.target.value)
      );

    $("volumeBar")
      .addEventListener(
        "input",
        event => {

          const volume =
            Number(event.target.value);

          audio.volume = volume;

          if (state.youtubePlayer) {
            try {
              state.youtubePlayer.setVolume(
                volume * 100
              );
            } catch (_) {}
          }

        }
      );

    $("searchInput")
      .addEventListener(
        "input",
        event => {

          clearTimeout(
            state.searchTimer
          );

          state.searchTimer =
            setTimeout(
              () =>
                searchSongs(
                  event.target.value
                ),
              150
            );
        }
      );

    $("playAllBtn")
      .addEventListener(
        "click",
        () => {

          if (state.songs.length) {
            playSong(0);
          }

        }
      );

    $("shuffleBtn")
      .addEventListener(
        "click",
        () => {

          if (!state.songs.length) return;

          const random =
            Math.floor(
              Math.random() *
              state.songs.length
            );

          playSong(random);

        }
      );

    $("adminLoginBtn")
      .addEventListener(
        "click",
        adminLogin
      );

    $("uploadForm")
      .addEventListener(
        "submit",
        uploadMP3
      );

    $("youtubeForm")
      .addEventListener(
        "submit",
        addYouTubeSong
      );

    audio.addEventListener(
      "play",
      () => {
        state.isPlaying = true;
        updatePlayButton();
      }
    );

    audio.addEventListener(
      "pause",
      () => {
        state.isPlaying = false;
        updatePlayButton();
      }
    );

    audio.addEventListener(
      "ended",
      playNext
    );

    audio.addEventListener(
      "loadedmetadata",
      updateProgress
    );

  }

  /* --------------------------------------------------
     INITIALIZE
  -------------------------------------------------- */

  function init() {

    setupEvents();

    setupAdminTabs();

    restoreAdmin();

    loadSongs();

  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();