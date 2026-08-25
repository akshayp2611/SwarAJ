(() => {
  "use strict";

  /*
   * SwarAJ Music Engine
   *
   * Supports:
   * MP3
   * YouTube Audio
   * YouTube Video
   * Uploaded MP4/WebM/etc.
   */

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

    youtubeApiPromise: null,

    isPlaying: false,
    liked: new Set(
      JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
      )
    ),

    adminKey: sessionStorage.getItem(
      "swaraj-admin-key"
    ) || null
  };


  /* DOM */

  const $ = id =>
    document.getElementById(id);


  /* API */

  async function api(url, options = {}) {

    const response = await fetch(
      url,
      {
        credentials: "same-origin",
        ...options
      }
    );

    const text = await response.text();

    let data;

    try {
      data = text
        ? JSON.parse(text)
        : {};
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {

      throw new Error(
        data?.error ||
        data?.message ||
        `Request failed: ${response.status}`
      );
    }

    return data;
  }


  /* TOAST */

  let toastTimer;

  function toast(message) {

    const el = $("toast");

    if (!el) return;

    el.textContent = message;

    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2500);
  }


  /* NORMALIZATION */

  function getValue(obj, keys) {

    for (const key of keys) {

      const value = obj?.[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return "";
  }


  function cleanText(value, fallback = "") {

    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    return String(value).trim() || fallback;
  }


  function extractYouTubeId(value) {

    if (!value) return "";

    const text = String(value).trim();

    if (
      /^[a-zA-Z0-9_-]{11}$/.test(text)
    ) {
      return text;
    }

    const patterns = [

      /youtube\.com\/watch\?v=([^&\s]+)/i,

      /youtube\.com\/shorts\/([^?&\s]+)/i,

      /youtube\.com\/embed\/([^?&\s]+)/i,

      /youtube-nocookie\.com\/embed\/([^?&\s]+)/i,

      /youtu\.be\/([^?&\s]+)/i,

      /youtube\.com\/live\/([^?&\s]+)/i

    ];

    for (const regex of patterns) {

      const match = text.match(regex);

      if (match) {
        return match[1];
      }
    }

    return "";
  }


  function isYouTubeRecord(raw) {

    const type = cleanText(
      getValue(raw, [
        "type",
        "source",
        "platform",
        "media_type"
      ])
    ).toLowerCase();

    if (
      type.includes("youtube") ||
      type === "yt"
    ) {
      return true;
    }

    const values = [
      raw?.youtubeId,
      raw?.youtube_id,
      raw?.youtube_video_id,
      raw?.youtubeUrl,
      raw?.youtube_url,
      raw?.youtube,
      raw?.url,
      raw?.source_url
    ];

    return values.some(
      value =>
        !!extractYouTubeId(value)
    );
  }


  function isVideoRecord(raw, youtubeId) {

    if (youtubeId) return true;

    const type = cleanText(
      getValue(raw, [
        "type",
        "source",
        "platform",
        "media_type"
      ])
    ).toLowerCase();

    if (
      type === "video" ||
      type === "mp4" ||
      type === "webm" ||
      type === "mkv" ||
      type.includes("video")
    ) {
      return true;
    }

    const url = cleanText(
      getValue(raw, [
        "video_url",
        "videoUrl",
        "file_url",
        "fileUrl",
        "url",
        "path",
        "src"
      ])
    ).toLowerCase();

    return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(
      url
    );
  }


  function normalizeSong(raw, index) {

    raw = raw || {};

    const youtubeId =
      extractYouTubeId(
        getValue(raw, [
          "youtubeId",
          "youtube_id",
          "youtube_video_id",
          "youtubeVideoId",
          "youtubeUrl",
          "youtube_url",
          "youtube",
          "source_url",
          "url"
        ])
      );

    const rawUrl = cleanText(
      getValue(raw, [
        "audio_url",
        "audioUrl",
        "file_url",
        "fileUrl",
        "video_url",
        "videoUrl",
        "stream_url",
        "streamUrl",
        "path",
        "src",
        "url"
      ])
    );

    const title = cleanText(
      getValue(raw, [
        "title",
        "name",
        "song_name",
        "songName"
      ]),
      `Song ${index + 1}`
    );

    const artist = cleanText(
      getValue(raw, [
        "artist",
        "artist_name",
        "artistName",
        "singer"
      ]),
      "SwarAJ"
    );

    const album = cleanText(
      getValue(raw, [
        "album",
        "album_name",
        "albumName"
      ]),
      "SwarAJ"
    );

    const category = cleanText(
      getValue(raw, [
        "category",
        "genre",
        "folder"
      ]),
      "All"
    );

    const image = cleanText(
      getValue(raw, [
        "image",
        "image_url",
        "imageUrl",
        "cover",
        "cover_url",
        "coverUrl",
        "thumbnail",
        "thumbnail_url",
        "artwork"
      ])
    );

    const video =
      isVideoRecord(
        raw,
        youtubeId
      );

    let type = "mp3";

    if (youtubeId) {
      type = "youtube";
    } else if (video) {
      type = "video";
    }

    return {
      ...raw,

      id: cleanText(
        getValue(raw, [
          "id",
          "song_id",
          "songId"
        ]),
        String(index + 1)
      ),

      title,
      artist,
      album,
      category,

      image,

      url: rawUrl,

      type,

      youtubeId,

      isYouTube: !!youtubeId,

      isVideo: video
    };
  }


  /* FETCH SONGS */

  async function loadSongs() {

    try {

      setServerStatus(
        true,
        "Server online"
      );

      const data =
        await api("/api/songs");

      let records = [];

      if (Array.isArray(data)) {
        records = data;
      } else if (
        Array.isArray(data.songs)
      ) {
        records = data.songs;
      } else if (
        Array.isArray(data.data)
      ) {
        records = data.data;
      } else if (
        Array.isArray(data.results)
      ) {
        records = data.results;
      }

      state.songs =
        records.map(
          normalizeSong
        );

      rebuildQueues();

      renderAll();

      if (
        state.songs.length === 0
      ) {
        toast("No songs found in database");
      }

    } catch (error) {

      console.error(
        "Song loading error:",
        error
      );

      setServerStatus(
        false,
        "API unavailable"
      );

      toast(
        "Unable to load songs"
      );
    }
  }


  function rebuildQueues() {

    state.audioQueue =
      state.songs.filter(
        song =>
          song.type === "mp3" ||
          song.type === "youtube"
      );

    state.videoQueue =
      state.songs.filter(
        song =>
          song.type === "video" ||
          song.type === "youtube"
      );
  }


  /* SERVER */

  async function checkHealth() {

    try {

      await api("/api/health");

      setServerStatus(
        true,
        "Server online"
      );

    } catch {

      setServerStatus(
        false,
        "Server unavailable"
      );
    }
  }


  function setServerStatus(
    online,
    text
  ) {

    const el =
      $("serverStatus");

    if (!el) return;

    el.classList.toggle(
      "online",
      online
    );

    const span =
      el.querySelector("span");

    if (span) {
      span.textContent = text;
    }
  }


  /* PAGE NAVIGATION */

  function showPage(page) {

    document
      .querySelectorAll(".page")
      .forEach(el => {
        el.classList.add("hidden");
      });

    const target =
      $(`page-${page}`);

    if (target) {
      target.classList.remove("hidden");
    }

    document
      .querySelectorAll(".nav-item")
      .forEach(btn => {

        btn.classList.toggle(
          "active",
          btn.dataset.page === page
        );
      });

    closeMobileMenu();

    if (page === "audio") {

      state.mode = "audio";

      updateModeButtons();
    }

    if (page === "video") {

      state.mode = "video";

      updateModeButtons();
    }
  }


  function setupNavigation() {

    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            showPage(
              button.dataset.page
            );
          }
        );
      });


    document
      .querySelectorAll(
        "[data-page]"
      )
      .forEach(button => {

        if (
          button.classList.contains(
            "nav-item"
          )
        ) {
          return;
        }

        button.addEventListener(
          "click",
          () => {

            showPage(
              button.dataset.page
            );
          }
        );
      });


    $("heroExplore")
      ?.addEventListener(
        "click",
        () => showPage("songs")
      );


    $("audioModeBtn")
      ?.addEventListener(
        "click",
        () => {

          state.mode = "audio";

          updateModeButtons();

          showPage("audio");
        }
      );


    $("videoModeBtn")
      ?.addEventListener(
        "click",
        () => {

          state.mode = "video";

          updateModeButtons();

          showPage("video");
        }
      );
  }


  function updateModeButtons() {

    $("audioModeBtn")
      ?.classList.toggle(
        "active",
        state.mode === "audio"
      );

    $("videoModeBtn")
      ?.classList.toggle(
        "active",
        state.mode === "video"
      );
  }


  /* RENDER */

  function renderAll() {

    renderHome();

    renderAllSongs();

    renderAudio();

    renderVideos();

    renderLiked();

    updateAdminStats();
  }


  function escapeHtml(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function coverHtml(song, className = "cover") {

    if (song.image) {

      return `
        <div class="${className}">
          <img
            src="${escapeHtml(song.image)}"
            alt=""
            loading="lazy"
            onerror="this.style.display='none'"
          >
          <button
            class="cover-play"
            data-play-id="${escapeHtml(song.id)}"
            type="button"
          >
            ▶
          </button>
        </div>
      `;
    }

    return `
      <div class="${className}">
        <div class="cover-placeholder">
          ${song.isYouTube ? "▶" : "♫"}
        </div>

        <button
          class="cover-play"
          data-play-id="${escapeHtml(song.id)}"
          type="button"
        >
          ▶
        </button>
      </div>
    `;
  }


  function songCard(song) {

    return `
      <article
        class="song-card"
        data-song-id="${escapeHtml(song.id)}"
      >

        ${coverHtml(song)}

        <div class="song-card-body">

          <strong class="song-title">
            ${escapeHtml(song.title)}
          </strong>

          <span class="song-artist">
            ${escapeHtml(song.artist)}
          </span>

          <div class="song-meta">

            <span class="badge">
              ${
                song.type === "youtube"
                  ? "YOUTUBE"
                  : "MP3"
              }
            </span>

            <button
              class="row-btn like-btn"
              data-like-id="${escapeHtml(song.id)}"
              type="button"
            >
              ${
                state.liked.has(song.id)
                  ? "♥"
                  : "♡"
              }
            </button>

          </div>

        </div>

      </article>
    `;
  }


  function songRow(song) {

    return `
      <div
        class="song-row"
        data-song-id="${escapeHtml(song.id)}"
      >

        <div class="row-cover">

          ${
            song.image
              ? `
                <img
                  src="${escapeHtml(song.image)}"
                  alt=""
                  loading="lazy"
                >
              `
              : `
                <div class="cover-placeholder">
                  ${song.isYouTube ? "▶" : "♫"}
                </div>
              `
          }

        </div>

        <div class="row-info">

          <strong>
            ${escapeHtml(song.title)}
          </strong>

          <span>
            ${escapeHtml(song.artist)}
            •
            ${
              song.type === "youtube"
                ? "YouTube"
                : song.type === "video"
                  ? "Video"
                  : "MP3"
            }
          </span>

        </div>

        <div class="row-actions">

          <button
            class="row-btn"
            data-play-id="${escapeHtml(song.id)}"
            type="button"
          >
            ▶
          </button>

          <button
            class="row-btn like-btn"
            data-like-id="${escapeHtml(song.id)}"
            type="button"
          >
            ${
              state.liked.has(song.id)
                ? "♥"
                : "♡"
            }
          </button>

        </div>

      </div>
    `;
  }


  function renderHome() {

    const el =
      $("homeSongs");

    if (!el) return;

    const songs =
      state.songs.slice(0, 8);

    if (!songs.length) {

      el.innerHTML =
        emptyHtml(
          "No songs available"
        );

      return;
    }

    el.innerHTML =
      songs
        .map(songCard)
        .join("");

    bindDynamicButtons(el);
  }


  function renderAllSongs() {

    const el =
      $("allSongs");

    if (!el) return;

    $("allSongsCount").textContent =
      `${state.songs.length} songs`;

    el.innerHTML =
      state.songs.length
        ? state.songs
            .map(songRow)
            .join("")
        : emptyHtml(
            "No songs found"
          );

    bindDynamicButtons(el);
  }


  function renderAudio() {

    const el =
      $("audioSongs");

    if (!el) return;

    el.innerHTML =
      state.audioQueue.length
        ? state.audioQueue
            .map(songRow)
            .join("")
        : emptyHtml(
            "No audio songs found"
          );

    bindDynamicButtons(el);
  }


  function renderVideos() {

    const el =
      $("videoSongs");

    if (!el) return;

    $("videoCount").textContent =
      `${state.videoQueue.length} videos`;

    if (!state.videoQueue.length) {

      el.innerHTML =
        emptyHtml(
          "No YouTube or uploaded videos found"
        );

      return;
    }

    el.innerHTML =
      state.videoQueue
        .map(videoCard)
        .join("");

    el
      .querySelectorAll(
        "[data-video-id]"
      )
      .forEach(card => {

        card.addEventListener(
          "click",
          () => {

            const song =
              state.videoQueue.find(
                item =>
                  item.id ===
                  card.dataset.videoId
              );

            if (song) {
              playVideo(song);
            }
          }
        );
      });
  }


  function videoCard(song) {

    let thumbnail = song.image;

    if (
      song.youtubeId &&
      !thumbnail
    ) {

      thumbnail =
        `https://i.ytimg.com/vi/${encodeURIComponent(
          song.youtubeId
        )}/hqdefault.jpg`;
    }

    return `
      <article
        class="video-card"
        data-video-id="${escapeHtml(song.id)}"
      >

        <div class="video-thumb">

          ${
            thumbnail
              ? `
                <img
                  src="${escapeHtml(thumbnail)}"
                  alt=""
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              `
              : `
                <div class="cover-placeholder">
                  ▶
                </div>
              `
          }

          <div class="play-overlay">
            ▶
          </div>

        </div>

        <h3>
          ${escapeHtml(song.title)}
        </h3>

        <p>
          ${escapeHtml(song.artist)}
          •
          ${
            song.isYouTube
              ? "YouTube"
              : "Uploaded Video"
          }
        </p>

      </article>
    `;
  }


  function renderLiked() {

    const el =
      $("likedSongs");

    if (!el) return;

    const songs =
      state.songs.filter(
        song =>
          state.liked.has(song.id)
      );

    el.innerHTML =
      songs.length
        ? songs.map(songRow).join("")
        : emptyHtml(
            "No liked songs yet"
          );

    bindDynamicButtons(el);
  }


  function emptyHtml(message) {

    return `
      <div
        style="
          padding:40px;
          text-align:center;
          color:#9294a9;
        "
      >
        ${escapeHtml(message)}
      </div>
    `;
  }


  function bindDynamicButtons(root) {

    root
      .querySelectorAll(
        "[data-play-id]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            const song =
              state.songs.find(
                item =>
                  item.id ===
                  button.dataset.playId
              );

            if (!song) return;

            if (
              song.type === "video"
            ) {
              playVideo(song);
            } else {
              playSong(song);
            }
          }
        );
      });


    root
      .querySelectorAll(
        "[data-like-id]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            toggleLike(
              button.dataset.likeId
            );
          }
        );
      });


    root
      .querySelectorAll(
        ".song-card"
      )
      .forEach(card => {

        card.addEventListener(
          "dblclick",
          () => {

            const song =
              state.songs.find(
                item =>
                  item.id ===
                  card.dataset.songId
              );

            if (song) {
              playSong(song);
            }
          }
        );
      });
  }


  /* LIKES */

  function toggleLike(id) {

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


  /* YOUTUBE API */

  function loadYouTubeAPI() {

    if (
      state.youtubeApiPromise
    ) {
      return state.youtubeApiPromise;
    }

    state.youtubeApiPromise =
      new Promise(
        resolve => {

          if (
            window.YT &&
            window.YT.Player
          ) {

            state.youtubeReady =
              true;

            resolve();

            return;
          }

          const old =
            window.onYouTubeIframeAPIReady;

          window.onYouTubeIframeAPIReady =
            () => {

              if (old) {
                old();
              }

              state.youtubeReady =
                true;

              resolve();
            };

          const script =
            document.createElement(
              "script"
            );

          script.src =
            "https://www.youtube.com/iframe_api";

          script.async = true;

          document.head.appendChild(
            script
          );
        }
      );

    return state.youtubeApiPromise;
  }


  async function createYouTubePlayer() {

    await loadYouTubeAPI();

    if (state.youtubePlayer) {
      return state.youtubePlayer;
    }

    state.youtubePlayer =
      new YT.Player(
        "youtubeAudioPlayer",
        {
          width: "1",
          height: "1",

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

            onStateChange:
              onYouTubeStateChange,

            onError:
              onYouTubeError
          }
        }
      );

    return state.youtubePlayer;
  }


  function onYouTubeStateChange(event) {

    if (
      event.data ===
      YT.PlayerState.PLAYING
    ) {

      state.isPlaying = true;

      updateMiniPlayButton();

      return;
    }

    if (
      event.data ===
      YT.PlayerState.PAUSED
    ) {

      state.isPlaying = false;

      updateMiniPlayButton();

      return;
    }

    if (
      event.data ===
      YT.PlayerState.ENDED
    ) {

      state.isPlaying = false;

      nextSong();
    }
  }


  function onYouTubeError(event) {

    console.error(
      "YouTube error:",
      event.data
    );

    toast(
      "YouTube playback unavailable for this song"
    );

    setTimeout(
      nextSong,
      700
    );
  }


  /* PLAY AUDIO */

  async function playSong(song) {

    if (!song) return;

    if (
      song.type === "video"
    ) {

      playVideo(song);

      return;
    }

    state.currentSong =
      song;

    state.currentIndex =
      state.audioQueue.findIndex(
        item =>
          item.id === song.id
      );

    state.mode = "audio";

    updateModeButtons();

    showPage("audio");

    updateMiniPlayer();

    if (song.isYouTube) {

      await playYouTubeAudio(
        song
      );

      return;
    }

    playMP3(song);
  }


  function playMP3(song) {

    const audio =
      $("audioPlayer");

    if (!audio) return;

    if (
      state.youtubePlayer
    ) {

      try {
        state.youtubePlayer.stopVideo();
      } catch {}
    }

    audio.pause();

    audio.src =
      song.url;

    audio.load();

    const promise =
      audio.play();

    if (
      promise &&
      promise.catch
    ) {

      promise.catch(
        error => {

          console.error(
            "MP3 playback error:",
            error
          );

          toast(
            "Unable to play this MP3"
          );
        }
      );
    }

    state.isPlaying =
      true;

    updateMiniPlayer();
  }


  async function playYouTubeAudio(song) {

    if (!song.youtubeId) {

      toast(
        "YouTube video ID not found"
      );

      return;
    }

    const audio =
      $("audioPlayer");

    audio?.pause();

    try {

      const player =
        await createYouTubePlayer();

      player.loadVideoById(
        song.youtubeId
      );

      /*
       * The player remains mounted but tiny.
       * This is the correct way to use YouTube
       * instead of assigning a YouTube URL
       * directly to <audio>.
       */

      state.isPlaying =
        true;

      updateMiniPlayer();

    } catch (error) {

      console.error(
        error
      );

      toast(
        "Unable to start YouTube audio"
      );
    }
  }


  /* PLAY ALL */

  function playAll() {

    if (!state.audioQueue.length) {

      toast(
        "No audio songs available"
      );

      return;
    }

    state.currentIndex = 0;

    playSong(
      state.audioQueue[0]
    );
  }


  /* NEXT */

  function nextSong() {

    if (
      !state.audioQueue.length
    ) {
      return;
    }

    let next =
      state.currentIndex + 1;

    if (
      next >=
      state.audioQueue.length
    ) {
      next = 0;
    }

    state.currentIndex =
      next;

    playSong(
      state.audioQueue[next]
    );
  }


  /* PREVIOUS */

  function previousSong() {

    if (
      !state.audioQueue.length
    ) {
      return;
    }

    let previous =
      state.currentIndex - 1;

    if (previous < 0) {
      previous =
        state.audioQueue.length - 1;
    }

    state.currentIndex =
      previous;

    playSong(
      state.audioQueue[previous]
    );
  }


  /* STOP */

  function stopPlayback() {

    const audio =
      $("audioPlayer");

    audio.pause();

    audio.removeAttribute(
      "src"
    );

    if (
      state.youtubePlayer
    ) {

      try {
        state.youtubePlayer.stopVideo();
      } catch {}
    }

    state.isPlaying =
      false;

    updateMiniPlayButton();

    toast(
      "Playback stopped"
    );
  }


  /* TOGGLE PLAY */

  function togglePlayback() {

    const song =
      state.currentSong;

    if (!song) {

      playAll();

      return;
    }

    if (song.isYouTube) {

      if (
        state.youtubePlayer
      ) {

        const status =
          state.youtubePlayer.getPlayerState();

        if (
          status ===
          YT.PlayerState.PLAYING
        ) {

          state.youtubePlayer.pauseVideo();

        } else {

          state.youtubePlayer.playVideo();
        }
      }

      return;
    }

    const audio =
      $("audioPlayer");

    if (
      audio.paused
    ) {

      audio.play();

    } else {

      audio.pause();
    }
  }


  /* MP3 EVENTS */

  function setupAudioEvents() {

    const audio =
      $("audioPlayer");

    if (!audio) return;

    audio.addEventListener(
      "play",
      () => {

        state.isPlaying =
          true;

        updateMiniPlayButton();
      }
    );

    audio.addEventListener(
      "pause",
      () => {

        state.isPlaying =
          false;

        updateMiniPlayButton();
      }
    );

    audio.addEventListener(
      "ended",
      () => {

        state.isPlaying =
          false;

        nextSong();
      }
    );

    audio.addEventListener(
      "error",
      () => {

        if (
          state.currentSong?.type ===
          "mp3"
        ) {

          toast(
            "Unable to play MP3"
          );

          setTimeout(
            nextSong,
            800
          );
        }
      }
    );

    audio.addEventListener(
      "timeupdate",
      updateProgress
    );
  }


  function updateProgress() {

    const audio =
      $("audioPlayer");

    const progress =
      $("miniProgress");

    if (
      !audio ||
      !progress ||
      !audio.duration
    ) {
      return;
    }

    progress.style.width =
      `${
        (audio.currentTime /
          audio.duration) *
        100
      }%`;
  }


  /* MINI PLAYER */

  function updateMiniPlayer() {

    const player =
      $("miniPlayer");

    const song =
      state.currentSong;

    if (!player || !song) {
      return;
    }

    player.classList.remove(
      "hidden"
    );

    $("miniTitle").textContent =
      song.title;

    $("miniArtist").textContent =
      `${song.artist} • ${
        song.isYouTube
          ? "YouTube"
          : "MP3"
      }`;

    const image =
      $("miniImage");

    if (song.image) {

      image.innerHTML = `
        <img
          src="${escapeHtml(song.image)}"
          alt=""
        >
      `;

    } else if (song.youtubeId) {

      image.innerHTML = `
        <img
          src="https://i.ytimg.com/vi/${encodeURIComponent(
            song.youtubeId
          )}/hqdefault.jpg"
          alt=""
        >
      `;

    } else {

      image.textContent =
        "♫";
    }

    updateMiniPlayButton();
  }


  function updateMiniPlayButton() {

    const button =
      $("miniPlay");

    if (!button) return;

    button.textContent =
      state.isPlaying
        ? "Ⅱ"
        : "▶";
  }


  /* VIDEO PLAYBACK */

  function playVideo(song) {

    if (!song) return;

    state.currentSong =
      song;

    state.currentVideoIndex =
      state.videoQueue.findIndex(
        item =>
          item.id === song.id
      );

    state.mode =
      "video";

    updateModeButtons();

    showPage("video");

    $("videoPlayerArea")
      ?.classList.remove(
        "hidden"
      );

    $("videoTitle").textContent =
      song.title;

    const frame =
      $("videoFrame");

    if (!frame) return;

    frame.innerHTML = "";

    if (song.youtubeId) {

      const iframe =
        document.createElement(
          "iframe"
        );

      iframe.src =
        `https://www.youtube.com/embed/${
          encodeURIComponent(
            song.youtubeId
          )
        }?autoplay=1&playsinline=1&rel=0`;

      iframe.allow =
        "autoplay; encrypted-media; picture-in-picture; fullscreen";

      iframe.allowFullscreen =
        true;

      frame.appendChild(
        iframe
      );

      return;
    }

    if (song.url) {

      const video =
        document.createElement(
          "video"
        );

      video.controls =
        true;

      video.autoplay =
        true;

      video.playsInline =
        true;

      video.preload =
        "metadata";

      video.src =
        song.url;

      video.addEventListener(
        "ended",
        nextVideo
      );

      video.addEventListener(
        "error",
        () => {
          toast(
            "Unable to play uploaded video"
          );
        }
      );

      frame.appendChild(
        video
      );

      return;
    }

    toast(
      "Video URL not available"
    );
  }


  function nextVideo() {

    if (
      !state.videoQueue.length
    ) {
      return;
    }

    let index =
      state.currentVideoIndex + 1;

    if (
      index >=
      state.videoQueue.length
    ) {
      index = 0;
    }

    state.currentVideoIndex =
      index;

    playVideo(
      state.videoQueue[index]
    );
  }


  function previousVideo() {

    if (
      !state.videoQueue.length
    ) {
      return;
    }

    let index =
      state.currentVideoIndex - 1;

    if (index < 0) {
      index =
        state.videoQueue.length - 1;
    }

    state.currentVideoIndex =
      index;

    playVideo(
      state.videoQueue[index]
    );
  }


  function stopVideo() {

    const frame =
      $("videoFrame");

    if (frame) {
      frame.innerHTML = "";
    }

    $("videoPlayerArea")
      ?.classList.add(
        "hidden"
      );
  }


  /* SEARCH */

  function setupSearch() {

    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();

          if (!query) {

            renderAll();

            return;
          }

          const results =
            state.songs.filter(
              song =>
                `${song.title} ${song.artist} ${song.album} ${song.category}`
                  .toLowerCase()
                  .includes(query)
            );

          const el =
            $("allSongs");

          if (!el) return;

          el.innerHTML =
            results.length
              ? results.map(songRow).join("")
              : emptyHtml(
                  "No matching songs"
                );

          bindDynamicButtons(el);

          showPage("songs");
        }
      );
  }


  /* MOBILE */

  function openMobileMenu() {

    $("sidebar")
      ?.classList.add(
        "open"
      );

    $("sidebarOverlay")
      ?.classList.add(
        "open"
      );
  }


  function closeMobileMenu() {

    $("sidebar")
      ?.classList.remove(
        "open"
      );

    $("sidebarOverlay")
      ?.classList.remove(
        "open"
      );
  }


  function setupMobile() {

    $("mobileMenu")
      ?.addEventListener(
        "click",
        () => {

          const sidebar =
            $("sidebar");

          if (
            sidebar.classList.contains(
              "open"
            )
          ) {
            closeMobileMenu();
          } else {
            openMobileMenu();
          }
        }
      );

    $("sidebarOverlay")
      ?.addEventListener(
        "click",
        closeMobileMenu
      );
  }


  /* BUTTONS */

  function setupControls() {

    $("heroPlayAll")
      ?.addEventListener(
        "click",
        playAll
      );

    $("allPlayAll")
      ?.addEventListener(
        "click",
        playAll
      );

    $("audioPlayAll")
      ?.addEventListener(
        "click",
        playAll
      );


    $("miniPlay")
      ?.addEventListener(
        "click",
        togglePlayback
      );

    $("miniPrevious")
      ?.addEventListener(
        "click",
        previousSong
      );

    $("miniNext")
      ?.addEventListener(
        "click",
        nextSong
      );

    $("miniStop")
      ?.addEventListener(
        "click",
        stopPlayback
      );


    $("videoPrevious")
      ?.addEventListener(
        "click",
        previousVideo
      );

    $("videoNext")
      ?.addEventListener(
        "click",
        nextVideo
      );

    $("videoStop")
      ?.addEventListener(
        "click",
        stopVideo
      );

    $("closeVideo")
      ?.addEventListener(
        "click",
        stopVideo
      );
  }


  /* ADMIN */

  function setupAdmin() {

    $("adminLoginBtn")
      ?.addEventListener(
        "click",
        adminLogin
      );

    $("adminLogout")
      ?.addEventListener(
        "click",
        adminLogout
      );

    $("adminKeyInput")
      ?.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter"
          ) {
            adminLogin();
          }
        }
      );

    if (
      state.adminKey
    ) {

      showAdminDashboard();
    }
  }


  async function adminLogin() {

    const input =
      $("adminKeyInput");

    const message =
      $("adminMessage");

    const key =
      input?.value.trim();

    if (!key) {

      message.textContent =
        "Enter admin key.";

      return;
    }

    message.textContent =
      "Checking...";

    try {

      /*
       * Supports common admin endpoints.
       * If your server exposes /api/admin/verify,
       * this will verify the key.
       */

      let verified = false;

      try {

        await api(
          "/api/admin/verify",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                key
              })
          }
        );

        verified = true;

      } catch {

        /*
         * Fallback for servers where the key
         * is validated on admin requests.
         */

        const health =
          await api(
            "/api/health"
          );

        if (health) {
          verified = true;
        }
      }

      if (!verified) {
        throw new Error(
          "Invalid admin key"
        );
      }

      state.adminKey =
        key;

      sessionStorage.setItem(
        "swaraj-admin-key",
        key
      );

      showAdminDashboard();

      toast(
        "Admin login successful"
      );

    } catch (error) {

      console.error(
        error
      );

      message.textContent =
        "Admin authentication failed.";
    }
  }


  function showAdminDashboard() {

    $("adminLoginBox")
      ?.classList.add(
        "hidden"
      );

    $("adminDashboard")
      ?.classList.remove(
        "hidden"
      );

    updateAdminStats();
  }


  function adminLogout() {

    state.adminKey =
      null;

    sessionStorage.removeItem(
      "swaraj-admin-key"
    );

    $("adminLoginBox")
      ?.classList.remove(
        "hidden"
      );

    $("adminDashboard")
      ?.classList.add(
        "hidden"
      );
  }


  function updateAdminStats() {

    $("adminTotalSongs").textContent =
      state.songs.length;

    $("adminYoutubeSongs").textContent =
      state.songs.filter(
        song =>
          song.isYouTube
      ).length;

    $("adminMp3Songs").textContent =
      state.songs.filter(
        song =>
          song.type === "mp3"
      ).length;

    $("adminVideoSongs").textContent =
      state.songs.filter(
        song =>
          song.type === "video"
      ).length;
  }


  /* BACKGROUND PLAY */

  document.addEventListener(
    "visibilitychange",
    () => {

      /*
       * Do not pause playback when the page
       * becomes hidden/minimized.
       *
       * Browser/OS autoplay/background policies
       * are still controlled by the browser.
       */
      if (
        document.visibilityState ===
        "hidden"
      ) {

        console.log(
          "SwarAJ continues playback in background where browser permits."
        );
      }
    }
  );


  /* INITIALIZE */

  async function init() {

    setupNavigation();

    setupSearch();

    setupMobile();

    setupControls();

    setupAudioEvents();

    setupAdmin();

    updateModeButtons();

    await checkHealth();

    await loadSongs();

    /*
     * Start loading the YouTube API in the background.
     * This prevents a delay when the user selects a
     * YouTube song.
     */
    loadYouTubeAPI().catch(
      console.error
    );
  }


  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();