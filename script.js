(() => {
  "use strict";

  const state = {
    songs: [],
    audioQueue: [],
    videoQueue: [],
    currentIndex: -1,
    currentVideoIndex: -1,
    currentSong: null,
    mode: "audio",
    youtubePlayer: null,
    youtubeReady: false,
    liked: new Set(
      JSON.parse(localStorage.getItem("swaraj-liked") || "[]")
    ),
    adminKey:
      sessionStorage.getItem("swaraj-admin-key") || null
  };

  const $ = id => document.getElementById(id);

  const audio = $("audioElement");
  const video = $("videoElement");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(window.__toast);
    window.__toast = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Request failed: ${response.status}`
      );
    }

    return data;
  }

  function first(obj, keys, fallback = "") {
    for (const key of keys) {
      if (
        obj?.[key] !== undefined &&
        obj?.[key] !== null &&
        String(obj[key]).trim()
      ) {
        return obj[key];
      }
    }

    return fallback;
  }

  function youtubeId(value) {
    if (!value) return "";

    const text = String(value).trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
      return text;
    }

    const patterns = [
      /youtube\.com\/watch\?v=([^&]+)/i,
      /youtu\.be\/([^?&]+)/i,
      /youtube\.com\/embed\/([^?&]+)/i,
      /youtube\.com\/shorts\/([^?&]+)/i,
      /youtube\.com\/live\/([^?&]+)/i,
      /youtube-nocookie\.com\/embed\/([^?&]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return "";
  }

  function normalizeSong(raw, index) {
    raw = raw || {};

    const ytId = youtubeId(
      first(raw, [
        "youtubeId",
        "youtube_id",
        "youtube_video_id",
        "youtubeVideoId",
        "youtubeUrl",
        "youtube_url",
        "youtube"
      ])
    );

    const audioUrl = first(raw, [
      "audio_url",
      "audioUrl",
      "stream_url",
      "streamUrl"
    ]);

    const videoUrl = first(raw, [
      "video_url",
      "videoUrl"
    ]);

    const fileUrl = first(raw, [
      "file_url",
      "fileUrl",
      "path",
      "src",
      "url"
    ]);

    let type = String(
      first(raw, ["type", "media_type", "source"], "")
    ).toLowerCase();

    if (ytId) {
      type = "youtube";
    } else if (
      type === "video" ||
      /\.(mp4|webm|m4v|mov)(\?|$)/i.test(videoUrl || fileUrl)
    ) {
      type = "video";
    } else {
      type = "mp3";
    }

    return {
      ...raw,

      id: String(
        first(raw, ["id", "song_id", "songId"], index + 1)
      ),

      title: String(
        first(
          raw,
          ["title", "name", "song_name", "songName"],
          `Song ${index + 1}`
        )
      ),

      artist: String(
        first(
          raw,
          ["artist", "artist_name", "artistName", "singer"],
          "SwarAJ"
        )
      ),

      album: String(
        first(
          raw,
          ["album", "album_name", "albumName"],
          "SwarAJ"
        )
      ),

      category: String(
        first(
          raw,
          ["category", "genre", "folder"],
          "All"
        )
      ),

      image: String(
        first(raw, [
          "image",
          "image_url",
          "imageUrl",
          "cover",
          "cover_url",
          "coverUrl",
          "thumbnail",
          "thumbnail_url"
        ], "/images/ganpati.jpg")
      ),

      audioUrl,
      videoUrl,
      fileUrl,

      youtubeId: ytId,
      type,

      isYouTube: Boolean(ytId),

      isVideo:
        type === "video" ||
        type === "youtube"
    };
  }

  async function loadSongs() {
    try {
      const data = await api("/api/songs");

      let records = [];

      if (Array.isArray(data)) records = data;
      else if (Array.isArray(data.songs)) records = data.songs;
      else if (Array.isArray(data.data)) records = data.data;
      else if (Array.isArray(data.results)) records = data.results;

      state.songs = records.map(normalizeSong);

      state.audioQueue = state.songs.filter(
        s => s.type === "mp3" || s.type === "youtube"
      );

      state.videoQueue = state.songs.filter(
        s => s.type === "video" || s.type === "youtube"
      );

      renderAll();

      setServerStatus(true, "Server online");

    } catch (error) {
      console.error(error);
      setServerStatus(false, "API unavailable");
      toast("Unable to load songs");
    }
  }

  function setServerStatus(online, text) {
    const el = $("serverStatus");
    if (!el) return;

    el.classList.toggle("online", online);

    const span = el.querySelector("span");
    if (span) span.textContent = text;
  }

  function image(song) {
    return escapeHtml(
      song.image || "/images/ganpati.jpg"
    );
  }

  function card(song) {
    return `
      <article class="song-card">

        <div class="cover">

          <img
            src="${image(song)}"
            alt=""
            loading="lazy"
            onerror="this.src='/images/ganpati.jpg'"
          >

          <button
            class="cover-play"
            data-play="${escapeHtml(song.id)}"
          >
            ▶
          </button>

        </div>

        <div class="song-card-body">

          <strong>
            ${escapeHtml(song.title)}
          </strong>

          <span>
            ${escapeHtml(song.artist)}
          </span>

          <div class="song-meta">

            <small>
              ${song.type === "youtube"
                ? "YOUTUBE"
                : song.type === "video"
                  ? "VIDEO"
                  : "MP3"}
            </small>

            <button
              class="like-btn"
              data-like="${escapeHtml(song.id)}"
            >
              ${state.liked.has(song.id) ? "♥" : "♡"}
            </button>

          </div>

        </div>

      </article>
    `;
  }

  function row(song) {
    return `
      <div class="song-row">

        <div class="row-cover">

          <img
            src="${image(song)}"
            alt=""
            onerror="this.src='/images/ganpati.jpg'"
          >

          <button
            class="row-play"
            data-play="${escapeHtml(song.id)}"
          >
            ▶
          </button>

        </div>

        <div class="row-info">

          <strong>
            ${escapeHtml(song.title)}
          </strong>

          <span>
            ${escapeHtml(song.artist)}
            •
            ${escapeHtml(song.album)}
          </span>

        </div>

        <button
          class="like-btn"
          data-like="${escapeHtml(song.id)}"
        >
          ${state.liked.has(song.id) ? "♥" : "♡"}
        </button>

      </div>
    `;
  }

  function renderAll() {
    renderHome();
    renderList("allSongs", state.songs);
    renderList("audioSongs", state.audioQueue);
    renderList("videoSongs", state.videoQueue);
    renderList(
      "likedSongs",
      state.songs.filter(s => state.liked.has(s.id))
    );
    updateAdminStats();
  }

  function renderHome() {
    const el = $("homeSongs");
    if (!el) return;

    el.innerHTML = state.songs
      .slice(0, 8)
      .map(card)
      .join("");
  }

  function renderList(id, songs) {
    const el = $(id);
    if (!el) return;

    el.innerHTML = songs.length
      ? songs.map(row).join("")
      : `<div class="admin-empty">No songs available.</div>`;
  }

  function updateAdminStats() {
    $("statTotal").textContent = state.songs.length;

    $("statMp3").textContent =
      state.songs.filter(s => s.type === "mp3").length;

    $("statYoutube").textContent =
      state.songs.filter(s => s.type === "youtube").length;

    $("statVideo").textContent =
      state.songs.filter(s => s.type === "video").length;
  }

  function showPage(page) {
    document.querySelectorAll(".page").forEach(p => {
      p.classList.add("hidden");
    });

    $(`page-${page}`)?.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.page === page
      );
    });

    if (page === "audio") {
      state.mode = "audio";
      updateModes();
    }

    if (page === "video") {
      state.mode = "video";
      updateModes();
    }

    $("sidebar")?.classList.remove("open");
    $("sidebarOverlay")?.classList.remove("show");
  }

  function updateModes() {
    $("audioModeBtn")?.classList.toggle(
      "active",
      state.mode === "audio"
    );

    $("videoModeBtn")?.classList.toggle(
      "active",
      state.mode === "video"
    );
  }

  function findSong(id) {
    return state.songs.find(
      s => String(s.id) === String(id)
    );
  }

  function playSong(song) {
    if (!song) return;

    state.currentSong = song;

    if (song.type === "youtube") {
      playYouTubeAudio(song);
    } else if (song.type === "video") {
      playNativeVideo(song);
    } else {
      playMP3(song);
    }

    updateMiniPlayer(song);
  }

  function playMP3(song) {
    destroyYouTube();

    video.pause();
    video.classList.add("hidden");

    const src =
      song.audioUrl ||
      song.url ||
      song.fileUrl;

    if (!src) {
      toast("Audio URL not available");
      return;
    }

    audio.src = src;
    audio.currentTime = 0;

    audio.play()
      .then(() => {
        state.isPlaying = true;
      })
      .catch(error => {
        console.error(error);
        toast("Browser could not play this audio");
      });

    state.currentIndex =
      state.audioQueue.findIndex(
        s => String(s.id) === String(song.id)
      );
  }

  function playYouTubeAudio(song) {
    if (!song.youtubeId) {
      toast("YouTube video ID missing");
      return;
    }

    audio.pause();

    state.currentIndex =
      state.audioQueue.findIndex(
        s => String(s.id) === String(song.id)
      );

    loadYouTubeAPI().then(() => {

      createYouTubePlayer();

      state.youtubePlayer.loadVideoById(
        song.youtubeId
      );

      state.youtubePlayer.playVideo();

      state.isPlaying = true;

    }).catch(error => {
      console.error(error);
      toast("YouTube player could not start");
    });
  }

  function createYouTubePlayer() {
    if (state.youtubePlayer) return;

    state.youtubePlayer =
      new YT.Player("youtubeContainer", {

        width: "100%",
        height: "100%",

        videoId: "",

        playerVars: {
          autoplay: 0,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1
        },

        events: {

          onReady: () => {
            state.youtubeReady = true;
          },

          onStateChange: event => {

            if (
              event.data ===
              YT.PlayerState.ENDED
            ) {
              nextAudio();
            }

          }

        }

      });
  }

  function loadYouTubeAPI() {
    if (
      window.YT &&
      window.YT.Player
    ) {
      return Promise.resolve();
    }

    if (state.youtubeApiPromise) {
      return state.youtubeApiPromise;
    }

    state.youtubeApiPromise =
      new Promise(resolve => {

        const old =
          window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady =
          () => {

            old?.();

            state.youtubeReady = true;

            resolve();

          };

      });

    return state.youtubeApiPromise;
  }

  function destroyYouTube() {
    if (state.youtubePlayer) {
      try {
        state.youtubePlayer.stopVideo();
        state.youtubePlayer.destroy();
      } catch {}

      state.youtubePlayer = null;
    }

    $("youtubeContainer").innerHTML = "";
  }

  function playNativeVideo(song) {
    audio.pause();
    destroyYouTube();

    const src =
      song.videoUrl ||
      song.url ||
      song.fileUrl;

    if (!src) {
      toast("Video URL not available");
      return;
    }

    $("videoStage").classList.remove("hidden");

    video.classList.remove("hidden");

    video.src = src;
    video.poster =
      song.image ||
      "/images/ganpati.jpg";

    video.currentTime = 0;

    video.play()
      .then(() => {
        state.isPlaying = true;
      })
      .catch(() => {
        toast("Tap play to start video");
      });

    $("videoTitle").textContent = song.title;
    $("videoArtist").textContent = song.artist;
    $("videoCover").src =
      song.image ||
      "/images/ganpati.jpg";

    state.currentVideoIndex =
      state.videoQueue.findIndex(
        s => String(s.id) === String(song.id)
      );
  }

  function playAll() {
    if (!state.songs.length) {
      toast("No songs available");
      return;
    }

    state.mode = "audio";
    updateModes();

    showPage("audio");

    state.audioQueue =
      [...state.songs].filter(
        s =>
          s.type === "mp3" ||
          s.type === "youtube"
      );

    if (!state.audioQueue.length) {
      toast("No audio songs available");
      return;
    }

    playSong(state.audioQueue[0]);
  }

  function playAllVideos() {
    if (!state.videoQueue.length) {
      toast("No videos available");
      return;
    }

    state.mode = "video";
    updateModes();

    showPage("video");

    playSong(state.videoQueue[0]);
  }

  function nextAudio() {
    if (!state.audioQueue.length) return;

    let next =
      state.currentIndex + 1;

    if (next >= state.audioQueue.length) {
      next = 0;
    }

    state.currentIndex = next;

    playSong(
      state.audioQueue[next]
    );
  }

  function previousAudio() {
    if (!state.audioQueue.length) return;

    let previous =
      state.currentIndex - 1;

    if (previous < 0) {
      previous =
        state.audioQueue.length - 1;
    }

    state.currentIndex = previous;

    playSong(
      state.audioQueue[previous]
    );
  }

  function nextVideo() {
    if (!state.videoQueue.length) return;

    let next =
      state.currentVideoIndex + 1;

    if (next >= state.videoQueue.length) {
      next = 0;
    }

    state.currentVideoIndex = next;

    playSong(
      state.videoQueue[next]
    );
  }

  function previousVideo() {
    if (!state.videoQueue.length) return;

    let previous =
      state.currentVideoIndex - 1;

    if (previous < 0) {
      previous =
        state.videoQueue.length - 1;
    }

    state.currentVideoIndex = previous;

    playSong(
      state.videoQueue[previous]
    );
  }

  function stopPlayback() {
    audio.pause();

    video.pause();

    if (state.youtubePlayer) {
      try {
        state.youtubePlayer.stopVideo();
      } catch {}
    }

    state.isPlaying = false;
  }

  function updateMiniPlayer(song) {
    $("miniPlayer").classList.remove("hidden");

    $("miniCover").src =
      song.image ||
      "/images/ganpati.jpg";

    $("miniTitle").textContent =
      song.title;

    $("miniArtist").textContent =
      song.artist;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const minutes =
      Math.floor(seconds / 60);

    const secondsPart =
      Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");

    return `${minutes}:${secondsPart}`;
  }

  function updateProgress() {
    if (!audio.duration) return;

    $("currentTime").textContent =
      formatTime(audio.currentTime);

    $("duration").textContent =
      formatTime(audio.duration);

    $("progressBar").value =
      (audio.currentTime /
        audio.duration) *
      100;
  }

  function toggleLike(id) {
    id = String(id);

    if (state.liked.has(id)) {
      state.liked.delete(id);
    } else {
      state.liked.add(id);
    }

    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        [...state.liked]
      )
    );

    renderAll();
  }

  /* ADMIN */

  async function adminLogin(event) {
    event.preventDefault();

    const key =
      $("adminKey").value.trim();

    if (!key) return;

    try {

      /*
       * Verify using the existing admin
       * endpoint.
       */
      await api("/api/admin/songs", {
        headers: {
          "X-Admin-Key": key
        }
      });

      state.adminKey = key;

      sessionStorage.setItem(
        "swaraj-admin-key",
        key
      );

      showAdmin();

      toast("Admin login successful");

    } catch (error) {

      $("adminLoginMessage").textContent =
        error.message ||
        "Invalid admin key";

    }
  }

  function showAdmin() {
    $("adminLogin")
      .classList.add("hidden");

    $("adminDashboard")
      .classList.remove("hidden");
  }

  function logoutAdmin() {
    state.adminKey = null;

    sessionStorage.removeItem(
      "swaraj-admin-key"
    );

    $("adminLogin")
      .classList.remove("hidden");

    $("adminDashboard")
      .classList.add("hidden");
  }

  async function uploadMusic(event) {
    event.preventDefault();

    if (!state.adminKey) {
      toast("Please login as admin");
      return;
    }

    const title =
      $("uploadTitle").value.trim();

    const artist =
      $("uploadArtist").value.trim();

    const album =
      $("uploadAlbum").value.trim();

    const category =
      $("uploadCategory").value;

    const type =
      $("uploadType").value;

    const audioUrl =
      $("uploadAudioUrl").value.trim();

    const videoUrl =
      $("uploadVideoUrl").value.trim();

    const youtubeUrl =
      $("uploadYoutubeUrl").value.trim();

    const coverUrl =
      $("uploadCover").value.trim();

    const file =
      $("adminUploadFile").files[0];

    if (!title) {
      toast("Enter a title");
      return;
    }

    if (
      !file &&
      !audioUrl &&
      !videoUrl &&
      !youtubeUrl
    ) {
      toast(
        "Upload a file or enter an Audio, Video or YouTube URL"
      );
      return;
    }

    const formData =
      new FormData();

    formData.append(
      "title",
      title
    );

    formData.append(
      "artist",
      artist || "SwarAJ"
    );

    formData.append(
      "album",
      album || "Singles"
    );

    formData.append(
      "category",
      category
    );

    formData.append(
      "type",
      type
    );

    /*
     * IMPORTANT:
     * Send all three URL fields.
     */
    formData.append(
      "audioUrl",
      audioUrl
    );

    formData.append(
      "audio_url",
      audioUrl
    );

    formData.append(
      "videoUrl",
      videoUrl
    );

    formData.append(
      "video_url",
      videoUrl
    );

    formData.append(
      "youtubeUrl",
      youtubeUrl
    );

    formData.append(
      "youtube_url",
      youtubeUrl
    );

    formData.append(
      "coverUrl",
      coverUrl
    );

    formData.append(
      "cover_url",
      coverUrl
    );

    if (file) {
      formData.append(
        "file",
        file
      );
    }

    const button =
      $("adminUploadBtn");

    button.disabled = true;

    $("uploadProgress")
      .classList.remove("hidden");

    $("uploadProgressBar")
      .style.width = "20%";

    $("uploadProgressText")
      .textContent = "Uploading...";

    try {

      /*
       * Existing SwarAJ upload endpoint.
       */
      const response =
        await fetch(
          "/api/admin/upload",
          {
            method: "POST",
            headers: {
              "X-Admin-Key":
                state.adminKey
            },
            credentials:
              "same-origin",
            body: formData
          }
        );

      const text =
        await response.text();

      let data = {};

      try {
        data = text
          ? JSON.parse(text)
          : {};
      } catch {}

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Upload failed"
        );
      }

      $("uploadProgressBar")
        .style.width = "100%";

      $("uploadProgressText")
        .textContent =
        "Completed";

      $("uploadMessage")
        .textContent =
        "✓ Music added successfully.";

      event.target.reset();

      $("uploadFileName")
        .textContent =
        "No file selected";

      $("uploadFileName")
        .classList.remove(
          "has-file"
        );

      await loadSongs();

      toast("Music added successfully");

    } catch (error) {

      console.error(error);

      $("uploadMessage")
        .textContent =
        error.message ||
        "Upload failed";

      toast(
        error.message ||
        "Upload failed"
      );

    } finally {

      button.disabled = false;

      setTimeout(() => {

        $("uploadProgress")
          .classList.add("hidden");

        $("uploadProgressBar")
          .style.width = "0%";

      }, 1200);
    }
  }

  function setupEvents() {

    document.addEventListener(
      "click",
      event => {

        const play =
          event.target.closest(
            "[data-play]"
          );

        if (play) {
          const song =
            findSong(
              play.dataset.play
            );

          playSong(song);
          return;
        }

        const like =
          event.target.closest(
            "[data-like]"
          );

        if (like) {
          toggleLike(
            like.dataset.like
          );
        }

      }
    );


    document
      .querySelectorAll(".nav-item")
      .forEach(btn => {

        btn.addEventListener(
          "click",
          () =>
            showPage(
              btn.dataset.page
            )
        );

      });


    document
      .querySelectorAll("[data-page]")
      .forEach(btn => {

        if (
          btn.classList.contains(
            "nav-item"
          )
        ) return;

        btn.addEventListener(
          "click",
          () =>
            showPage(
              btn.dataset.page
            )
        );

      });


    $("mobileMenu")
      ?.addEventListener(
        "click",
        () => {

          $("sidebar")
            .classList.add("open");

          $("sidebarOverlay")
            .classList.add("show");

        }
      );


    $("sidebarOverlay")
      ?.addEventListener(
        "click",
        () => {

          $("sidebar")
            .classList.remove("open");

          $("sidebarOverlay")
            .classList.remove("show");

        }
      );


    $("heroPlayAll")
      ?.addEventListener(
        "click",
        playAll
      );


    $("playAllBtn")
      ?.addEventListener(
        "click",
        playAll
      );


    $("audioPlayAll")
      ?.addEventListener(
        "click",
        playAll
      );


    $("videoPlayAll")
      ?.addEventListener(
        "click",
        playAllVideos
      );


    $("nextBtn")
      ?.addEventListener(
        "click",
        nextAudio
      );


    $("previousBtn")
      ?.addEventListener(
        "click",
        previousAudio
      );


    $("stopBtn")
      ?.addEventListener(
        "click",
        stopPlayback
      );


    $("videoNext")
      ?.addEventListener(
        "click",
        nextVideo
      );


    $("videoPrevious")
      ?.addEventListener(
        "click",
        previousVideo
      );


    $("audioModeBtn")
      ?.addEventListener(
        "click",
        () => {

          state.mode = "audio";
          updateModes();
          showPage("audio");

        }
      );


    $("videoModeBtn")
      ?.addEventListener(
        "click",
        () => {

          state.mode = "video";
          updateModes();
          showPage("video");

        }
      );


    $("adminLoginForm")
      ?.addEventListener(
        "submit",
        adminLogin
      );


    $("adminLogout")
      ?.addEventListener(
        "click",
        logoutAdmin
      );


    $("adminUploadForm")
      ?.addEventListener(
        "submit",
        uploadMusic
      );


    $("adminUploadFile")
      ?.addEventListener(
        "change",
        event => {

          const file =
            event.target.files[0];

          const el =
            $("uploadFileName");

          if (!file) {
            el.textContent =
              "No file selected";

            el.classList.remove(
              "has-file"
            );

            return;
          }

          el.textContent =
            `${file.name} • ${
              (file.size / 1024 / 1024)
                .toFixed(2)
            } MB`;

          el.classList.add(
            "has-file"
          );

        }
      );


    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();

          const filtered =
            state.songs.filter(song =>
              [
                song.title,
                song.artist,
                song.album,
                song.category
              ]
                .join(" ")
                .toLowerCase()
                .includes(query)
            );

          renderList(
            "allSongs",
            filtered
          );

        }
      );


    $("progressBar")
      ?.addEventListener(
        "input",
        event => {

          if (!audio.duration) return;

          audio.currentTime =
            (Number(event.target.value) / 100) *
            audio.duration;

        }
      );


    audio.addEventListener(
      "timeupdate",
      updateProgress
    );


    audio.addEventListener(
      "ended",
      nextAudio
    );


    video.addEventListener(
      "ended",
      nextVideo
    );


    if (state.adminKey) {
      showAdmin();
    }
  }

  function init() {
    setupEvents();
    updateModes();
    loadSongs();
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();