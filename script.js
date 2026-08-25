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
    youtubeApiPromise: null,

    isPlaying: false,

    liked: new Set(
      JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
      )
    ),

    adminKey:
      sessionStorage.getItem(
        "swaraj-admin-key"
      ) || null
  };


  /* =====================================================
     HELPERS
  ===================================================== */

  const $ = id =>
    document.getElementById(id);


  function escapeHtml(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  async function api(url, options = {}) {

    const response =
      await fetch(url, {
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


  let toastTimer;

  function toast(message) {

    const element =
      $("toast");

    if (!element) return;

    element.textContent =
      message;

    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
      setTimeout(() => {
        element.classList.remove("show");
      }, 2600);

  }


  function clean(value, fallback = "") {

    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    const result =
      String(value).trim();

    return result || fallback;
  }


  function first(obj, keys, fallback = "") {

    for (const key of keys) {

      if (
        obj?.[key] !== undefined &&
        obj?.[key] !== null &&
        String(obj[key]).trim() !== ""
      ) {
        return obj[key];
      }

    }

    return fallback;
  }


  /* =====================================================
     YOUTUBE
  ===================================================== */

  function youtubeId(value) {

    if (!value) return "";

    const text =
      String(value).trim();

    if (
      /^[a-zA-Z0-9_-]{11}$/.test(text)
    ) {
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

      const match =
        text.match(pattern);

      if (match) {
        return match[1];
      }

    }

    return "";
  }


  function isYouTube(raw) {

    const id =
      youtubeId(
        first(raw, [
          "youtubeId",
          "youtube_id",
          "youtube_video_id",
          "youtubeUrl",
          "youtube_url",
          "youtube",
          "source_url",
          "url"
        ])
      );

    return !!id;
  }


  function isVideo(raw, ytId) {

    if (ytId) return true;

    const type =
      clean(
        first(raw, [
          "type",
          "source",
          "media_type",
          "platform"
        ])
      ).toLowerCase();

    if (
      type === "video" ||
      type === "mp4" ||
      type === "webm" ||
      type === "m4v" ||
      type.includes("video")
    ) {
      return true;
    }

    const url =
      clean(
        first(raw, [
          "video_url",
          "videoUrl",
          "file_url",
          "fileUrl",
          "url",
          "path",
          "src"
        ])
      );

    return /\.(mp4|webm|m4v|mov)(\?|$)/i.test(
      url
    );
  }


  function normalizeSong(raw, index) {

    raw = raw || {};

    const ytId =
      youtubeId(
        first(raw, [
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


    const url =
      clean(
        first(raw, [
          "audio_url",
          "audioUrl",
          "file_url",
          "fileUrl",
          "stream_url",
          "streamUrl",
          "video_url",
          "videoUrl",
          "path",
          "src",
          "url"
        ])
      );


    const title =
      clean(
        first(raw, [
          "title",
          "name",
          "song_name",
          "songName"
        ]),
        `Song ${index + 1}`
      );


    const artist =
      clean(
        first(raw, [
          "artist",
          "artist_name",
          "artistName",
          "singer"
        ]),
        "SwarAJ"
      );


    const album =
      clean(
        first(raw, [
          "album",
          "album_name",
          "albumName"
        ]),
        "SwarAJ"
      );


    const category =
      clean(
        first(raw, [
          "category",
          "genre",
          "folder"
        ]),
        "All"
      );


    const image =
      clean(
        first(raw, [
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


    let type = "mp3";

    if (ytId) {
      type = "youtube";
    } else if (
      isVideo(raw, ytId)
    ) {
      type = "video";
    }


    return {

      ...raw,

      id:
        clean(
          first(raw, [
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
      url,

      type,

      youtubeId: ytId,

      isYouTube:
        !!ytId,

      isVideo:
        type === "video" ||
        type === "youtube"

    };

  }


  /* =====================================================
     LOAD SONGS
  ===================================================== */

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


      if (!state.songs.length) {
        toast(
          "No songs found in database"
        );
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


  /* =====================================================
     SERVER
  ===================================================== */

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

    const element =
      $("serverStatus");

    if (!element) return;

    element.classList.toggle(
      "online",
      online
    );

    const span =
      element.querySelector("span");

    if (span) {
      span.textContent =
        text;
    }

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function showPage(page) {

    document
      .querySelectorAll(".page")
      .forEach(element => {
        element.classList.add("hidden");
      });


    $(`page-${page}`)
      ?.classList.remove("hidden");


    document
      .querySelectorAll(".nav-item")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.page === page
        );

      });


    if (page === "audio") {

      state.mode =
        "audio";

      updateModeButtons();

    }


    if (page === "video") {

      state.mode =
        "video";

      updateModeButtons();

    }


    closeMobileMenu();

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

          state.mode =
            "audio";

          updateModeButtons();

          showPage("audio");

        }
      );


    $("videoModeBtn")
      ?.addEventListener(
        "click",
        () => {

          state.mode =
            "video";

          updateModeButtons();

          showPage("video");

        }
      );


    $("mobileMenu")
      ?.addEventListener(
        "click",
        openMobileMenu
      );


    $("sidebarOverlay")
      ?.addEventListener(
        "click",
        closeMobileMenu
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


  function openMobileMenu() {

    $("sidebar")
      ?.classList.add("open");

    $("sidebarOverlay")
      ?.classList.add("show");

  }


  function closeMobileMenu() {

    $("sidebar")
      ?.classList.remove("open");

    $("sidebarOverlay")
      ?.classList.remove("show");

  }


  /* =====================================================
     RENDER
  ===================================================== */

  function renderAll() {

    renderHome();
    renderAllSongs();
    renderAudio();
    renderVideo();
    renderLiked();
    updateAdminStats();

  }


  function imageHtml(song) {

    const image =
      song.image ||
      "/images/ganpati.jpg";

    return `
      <img
        src="${escapeHtml(image)}"
        alt=""
        loading="lazy"
        onerror="this.src='/images/ganpati.jpg'"
      >
    `;

  }


  function songCard(song) {

    return `
      <article
        class="song-card"
        data-id="${escapeHtml(song.id)}"
      >

        <div class="cover">

          ${imageHtml(song)}

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
              ${
                song.type === "youtube"
                  ? "YOUTUBE"
                  : song.type === "video"
                    ? "VIDEO"
                    : "MP3"
              }
            </small>

            <button
              class="like-btn"
              data-like="${escapeHtml(song.id)}"
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
        data-id="${escapeHtml(song.id)}"
      >

        <div class="row-cover">
          ${imageHtml(song)}

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


        <span class="row-type">
          ${
            song.type === "youtube"
              ? "YouTube"
              : song.type === "video"
                ? "Video"
                : "MP3"
          }
        </span>


        <button
          class="like-btn"
          data-like="${escapeHtml(song.id)}"
        >
          ${
            state.liked.has(song.id)
              ? "♥"
              : "♡"
          }
        </button>

      </div>
    `;

  }


  function renderHome() {

    const container =
      $("homeSongs");

    if (!container) return;

    container.innerHTML =
      state.songs
        .slice(0, 8)
        .map(songCard)
        .join("");

    bindSongButtons();

  }


  function renderAllSongs() {

    const container =
      $("allSongs");

    if (!container) return;

    container.innerHTML =
      state.songs
        .map(songRow)
        .join("");

    const count =
      $("allSongsCount");

    if (count) {
      count.textContent =
        `${state.songs.length} songs`;
    }

    bindSongButtons();

  }


  function renderAudio() {

    const container =
      $("audioSongs");

    if (!container) return;

    const songs =
      state.audioQueue;

    container.innerHTML =
      songs.length
        ? songs.map(songRow).join("")
        : `<div class="empty-state">
             No audio songs available.
           </div>`;

    bindSongButtons();

  }


  function renderVideo() {

    const container =
      $("videoSongs");

    if (!container) return;

    const songs =
      state.videoQueue;

    container.innerHTML =
      songs.length
        ? songs.map(videoCard).join("")
        : `<div class="empty-state">
             No videos available.
           </div>`;


    const count =
      $("videoCount");

    if (count) {
      count.textContent =
        `${songs.length} videos`;
    }


    document
      .querySelectorAll(
        "[data-video-play]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const id =
              button.dataset.videoPlay;

            playVideoById(id);

          }
        );

      });

  }


  function videoCard(song) {

    const image =
      song.image ||
      (
        song.youtubeId
          ? `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`
          : "/images/ganpati.jpg"
      );


    return `
      <article class="video-card">

        <div class="video-thumb">

          <img
            src="${escapeHtml(image)}"
            alt=""
            loading="lazy"
          >

          <button
            data-video-play="${escapeHtml(song.id)}"
            class="video-play"
          >
            ▶
          </button>

        </div>

        <div class="video-card-info">

          <strong>
            ${escapeHtml(song.title)}
          </strong>

          <span>
            ${escapeHtml(song.artist)}
          </span>

        </div>

      </article>
    `;

  }


  function renderLiked() {

    const container =
      $("likedSongs");

    if (!container) return;

    const songs =
      state.songs.filter(
        song =>
          state.liked.has(song.id)
      );

    container.innerHTML =
      songs.length
        ? songs.map(songRow).join("")
        : `<div class="empty-state">
             No liked songs yet.
           </div>`;

    bindSongButtons();

  }


  function bindSongButtons() {

    document
      .querySelectorAll(
        "[data-play]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.stopPropagation();

            playById(
              button.dataset.play
            );

          };

      });


    document
      .querySelectorAll(
        "[data-like]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.stopPropagation();

            toggleLike(
              button.dataset.like
            );

          };

      });

  }


  /* =====================================================
     LIKE
  ===================================================== */

  function toggleLike(id) {

    if (
      state.liked.has(id)
    ) {

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


  /* =====================================================
     AUDIO PLAYER
  ===================================================== */

  function playById(id) {

    const index =
      state.audioQueue.findIndex(
        song =>
          String(song.id) === String(id)
      );


    if (index < 0) {

      const song =
        state.songs.find(
          item =>
            String(item.id) === String(id)
        );

      if (!song) return;

      if (
        song.type === "video"
      ) {

        playVideoById(id);

        return;
      }

    }


    playAudioIndex(
      index < 0 ? 0 : index
    );

  }


  async function playAudioIndex(index) {

    if (
      index < 0 ||
      index >= state.audioQueue.length
    ) {
      return;
    }


    const song =
      state.audioQueue[index];


    state.currentIndex =
      index;

    state.currentSong =
      song;

    state.mode =
      "audio";

    updateModeButtons();


    stopVideoPlayer();


    updateMiniPlayer();


    if (
      song.type === "youtube" &&
      song.youtubeId
    ) {

      await playYouTubeAudio(
        song
      );

    } else {

      playMp3(song);

    }

  }


  function playMp3(song) {

    const audio =
      $("audioPlayer");

    if (!audio) return;


    stopYouTube();


    audio.src =
      song.url;


    audio.load();


    audio.play()
      .then(() => {

        state.isPlaying =
          true;

        updateMiniPlayer();

      })
      .catch(error => {

        console.error(
          "MP3 playback error:",
          error
        );

        toast(
          "Unable to play this MP3"
        );

      });

  }


  audioEndedHandler();


  function audioEndedHandler() {

    const audio =
      $("audioPlayer");

    if (!audio) return;

    audio.addEventListener(
      "ended",
      nextAudio
    );


    audio.addEventListener(
      "play",
      () => {

        state.isPlaying =
          true;

        updateMiniPlayer();

      }
    );


    audio.addEventListener(
      "pause",
      () => {

        state.isPlaying =
          false;

        updateMiniPlayer();

      }
    );


    audio.addEventListener(
      "timeupdate",
      updateProgress
    );

  }


  /* =====================================================
     YOUTUBE AUDIO
  ===================================================== */

  function loadYouTubeAPI() {

    if (
      state.youtubeApiPromise
    ) {
      return state.youtubeApiPromise;
    }


    state.youtubeApiPromise =
      new Promise(resolve => {

        if (
          window.YT &&
          window.YT.Player
        ) {

          state.youtubeReady =
            true;

          resolve();

          return;
        }


        const oldCallback =
          window.onYouTubeIframeAPIReady;


        window.onYouTubeIframeAPIReady =
          () => {

            oldCallback?.();

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

        document.head.appendChild(
          script
        );

      });


    return state.youtubeApiPromise;

  }


  async function playYouTubeAudio(song) {

    await loadYouTubeAPI();


    stopMp3();


    const host =
      $("youtubeAudioPlayer");

    if (!host) return;


    if (
      state.youtubePlayer
    ) {

      try {
        state.youtubePlayer.destroy();
      } catch {}

      state.youtubePlayer =
        null;

    }


    state.youtubePlayer =
      new YT.Player(
        "youtubeAudioPlayer",
        {

          width: "1",
          height: "1",

          videoId:
            song.youtubeId,

          playerVars: {
            autoplay: 1,
            controls: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1
          },

          events: {

            onReady:
              event => {

                event.target.playVideo();

                state.isPlaying =
                  true;

                updateMiniPlayer();

              },

            onStateChange:
              event => {

                if (
                  event.data ===
                  YT.PlayerState.ENDED
                ) {

                  nextAudio();

                }

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {

                  state.isPlaying =
                    true;

                  updateMiniPlayer();

                }

                if (
                  event.data ===
                  YT.PlayerState.PAUSED
                ) {

                  state.isPlaying =
                    false;

                  updateMiniPlayer();

                }

              },

            onError:
              event => {

                console.error(
                  "YouTube error:",
                  event.data
                );

                toast(
                  "YouTube playback is unavailable for this song"
                );

              }

          }

        }
      );

  }


  function stopYouTube() {

    if (
      state.youtubePlayer
    ) {

      try {

        state.youtubePlayer.stopVideo();

      } catch {}

    }

  }


  function stopMp3() {

    const audio =
      $("audioPlayer");

    if (!audio) return;

    audio.pause();

    audio.removeAttribute(
      "src"
    );

    audio.load();

  }


  /* =====================================================
     NEXT / PREVIOUS
  ===================================================== */

  function nextAudio() {

    if (
      !state.audioQueue.length
    ) {
      return;
    }


    const next =
      (
        state.currentIndex + 1
      ) %
      state.audioQueue.length;


    playAudioIndex(next);

  }


  function previousAudio() {

    if (
      !state.audioQueue.length
    ) {
      return;
    }


    const previous =
      state.currentIndex <= 0
        ? state.audioQueue.length - 1
        : state.currentIndex - 1;


    playAudioIndex(previous);

  }


  function playAll() {

    if (
      !state.audioQueue.length
    ) {

      toast(
        "No audio songs available"
      );

      return;
    }


    playAudioIndex(0);

  }


  /* =====================================================
     VIDEO
  ===================================================== */

  function playVideoById(id) {

    const index =
      state.videoQueue.findIndex(
        song =>
          String(song.id) === String(id)
      );


    if (index < 0) return;


    state.currentVideoIndex =
      index;


    const song =
      state.videoQueue[index];


    state.currentSong =
      song;

    state.mode =
      "video";

    updateModeButtons();


    stopMp3();
    stopYouTube();


    $("videoPlayerArea")
      ?.classList.remove(
        "hidden"
      );


    $("videoTitle")
      .textContent =
      song.title;


    const frame =
      $("videoFrame");


    if (!frame) return;


    if (
      song.youtubeId
    ) {

      frame.innerHTML = `
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(song.youtubeId)}?autoplay=1&rel=0"
          title="${escapeHtml(song.title)}"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      `;

    } else {

      frame.innerHTML = `
        <video
          controls
          autoplay
          playsinline
          src="${escapeHtml(song.url)}"
        ></video>
      `;

    }

  }


  function stopVideoPlayer() {

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


  function nextVideo() {

    if (
      !state.videoQueue.length
    ) {
      return;
    }


    const next =
      (
        state.currentVideoIndex + 1
      ) %
      state.videoQueue.length;


    playVideoById(
      state.videoQueue[next].id
    );

  }


  function previousVideo() {

    if (
      !state.videoQueue.length
    ) {
      return;
    }


    const previous =
      state.currentVideoIndex <= 0
        ? state.videoQueue.length - 1
        : state.currentVideoIndex - 1;


    playVideoById(
      state.videoQueue[previous].id
    );

  }


  /* =====================================================
     MINI PLAYER
  ===================================================== */

  function updateMiniPlayer() {

    const mini =
      $("miniPlayer");

    if (!mini) return;


    if (!state.currentSong) {

      mini.classList.add(
        "hidden"
      );

      return;

    }


    mini.classList.remove(
      "hidden"
    );


    $("miniTitle")
      .textContent =
      state.currentSong.title;


    $("miniArtist")
      .textContent =
      state.currentSong.artist;


    const image =
      state.currentSong.image ||
      (
        state.currentSong.youtubeId
          ? `https://i.ytimg.com/vi/${state.currentSong.youtubeId}/hqdefault.jpg`
          : "/images/ganpati.jpg"
      );


    $("miniImage").style.backgroundImage =
      `url("${image}")`;


    $("miniImage").textContent =
      "";


    $("miniPlay")
      .textContent =
      state.isPlaying
        ? "Ⅱ"
        : "▶";

  }


  function updateProgress() {

    const audio =
      $("audioPlayer");

    if (!audio) return;


    if (
      !audio.duration ||
      !isFinite(audio.duration)
    ) {
      return;
    }


    const percentage =
      (
        audio.currentTime /
        audio.duration
      ) * 100;


    const progress =
      $("miniProgress");


    if (progress) {

      progress.style.width =
        `${percentage}%`;

    }

  }


  function togglePlayPause() {

    if (
      !state.currentSong
    ) {

      playAll();

      return;

    }


    if (
      state.currentSong.type ===
      "youtube"
    ) {

      if (
        state.youtubePlayer
      ) {

        if (state.isPlaying) {

          state.youtubePlayer.pauseVideo();

        } else {

          state.youtubePlayer.playVideo();

        }

      }

      return;

    }


    const audio =
      $("audioPlayer");


    if (!audio) return;


    if (
      audio.paused
    ) {

      audio.play();

    } else {

      audio.pause();

    }

  }


  function stopCurrent() {

    stopMp3();
    stopYouTube();
    stopVideoPlayer();


    state.isPlaying =
      false;


    updateMiniPlayer();

  }


  /* =====================================================
     ADMIN LOGIN
  ===================================================== */

  function setupAdmin() {

    $("adminLoginBtn")
      ?.addEventListener(
        "click",
        adminLogin
      );


    $("adminKeyInput")
      ?.addEventListener(
        "keydown",
        event => {

          if (
            event.key === "Enter"
          ) {

            event.preventDefault();

            adminLogin();

          }

        }
      );


    $("adminLogout")
      ?.addEventListener(
        "click",
        adminLogout
      );


    $("adminUploadForm")
      ?.addEventListener(
        "submit",
        uploadAdminSong
      );


    $("adminUploadFile")
      ?.addEventListener(
        "change",
        handleUploadFile
      );


    $("adminRefreshSongs")
      ?.addEventListener(
        "click",
        loadAdminSongs
      );


    if (state.adminKey) {

      showAdminDashboard();

      loadAdminSongs();

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
      "Checking admin key...";


    try {

      const result =
        await api(
          "/api/admin/login",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                adminKey: key
              })

          }
        );


      if (
        result?.success === false
      ) {

        throw new Error(
          result.error ||
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

      await loadAdminSongs();


      message.textContent = "";

      toast(
        "Admin login successful"
      );


    } catch (error) {

      console.error(
        "Admin login:",
        error
      );

      message.textContent =
        error.message ||
        "Invalid admin key.";

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


    $("adminDashboard")
      ?.classList.add(
        "hidden"
      );


    $("adminLoginBox")
      ?.classList.remove(
        "hidden"
      );


    $("adminKeyInput")
      && (
        $("adminKeyInput").value = ""
      );


    toast(
      "Admin logged out"
    );

  }


  /* =====================================================
     ADMIN FILE
  ===================================================== */

  function handleUploadFile(event) {

    const file =
      event.target.files?.[0];

    const display =
      $("uploadFileName");


    if (!file) {

      display.textContent =
        "No file selected";

      display.classList.remove(
        "has-file"
      );

      return;

    }


    const mb =
      (
        file.size /
        1024 /
        1024
      ).toFixed(2);


    display.textContent =
      `${file.name} • ${mb} MB`;


    display.classList.add(
      "has-file"
    );


    const title =
      $("uploadTitle");


    if (
      title &&
      !title.value.trim()
    ) {

      title.value =
        file.name
          .replace(
            /\.[^/.]+$/,
            ""
          )
          .replace(
            /[_-]+/g,
            " "
          )
          .trim();

    }

  }


  /* =====================================================
     ADMIN UPLOAD
  ===================================================== */

  function uploadAdminSong(event) {

    event.preventDefault();


    if (!state.adminKey) {

      toast(
        "Login as admin first"
      );

      return;

    }


    const form =
      $("adminUploadForm");

    const file =
      $("adminUploadFile")
        ?.files?.[0];


    if (!file) {

      $("uploadMessage")
        .textContent =
        "Please select an audio file.";

      return;

    }


    if (
      file.size >
      100 * 1024 * 1024
    ) {

      $("uploadMessage")
        .textContent =
        "Maximum file size is 100 MB.";

      return;

    }


    const formData =
      new FormData(form);


    const xhr =
      new XMLHttpRequest();


    const button =
      $("adminUploadBtn");


    const progress =
      $("uploadProgress");


    const bar =
      $("uploadProgressBar");


    const progressText =
      $("uploadProgressText");


    const message =
      $("uploadMessage");


    button.disabled =
      true;


    button.textContent =
      "⏳ Uploading...";


    message.textContent =
      "Uploading...";


    progress
      .classList.remove(
        "hidden"
      );


    xhr.open(
      "POST",
      "/api/admin/songs/upload"
    );


    /*
      IMPORTANT:
      Your server expects the admin
      key in this header.
    */

    xhr.setRequestHeader(
      "x-admin-key",
      state.adminKey
    );


    xhr.upload.onprogress =
      event => {

        if (
          !event.lengthComputable
        ) {
          return;
        }


        const percent =
          Math.round(
            event.loaded /
            event.total *
            100
          );


        bar.style.width =
          `${percent}%`;


        progressText.textContent =
          `Uploading ${percent}%`;

      };


    xhr.onload =
      async () => {

        let result = {};

        try {

          result =
            JSON.parse(
              xhr.responseText ||
              "{}"
            );

        } catch {

          result = {};

        }


        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          result.success !== false
        ) {

          message.textContent =
            result.message ||
            "Song uploaded successfully.";

          bar.style.width =
            "100%";


          progressText.textContent =
            "Upload complete";


          toast(
            "Song uploaded successfully"
          );


          form.reset();


          $("uploadFileName")
            .textContent =
            "No file selected";


          $("uploadFileName")
            .classList.remove(
              "has-file"
            );


          await loadSongs();

          await loadAdminSongs();

          updateAdminStats();


        } else {

          const error =
            result.error ||
            `Upload failed (${xhr.status})`;


          message.textContent =
            error;


          toast(error);

        }


        button.disabled =
          false;


        button.textContent =
          "⬆ Upload Song";

      };


    xhr.onerror =
      () => {

        message.textContent =
          "Network error during upload.";

        toast(
          "Upload failed"
        );


        button.disabled =
          false;

        button.textContent =
          "⬆ Upload Song";

      };


    xhr.send(
      formData
    );

  }


  /* =====================================================
     ADMIN DATABASE
  ===================================================== */

  async function loadAdminSongs() {

    if (!state.adminKey) {
      return;
    }


    const container =
      $("adminSongList");


    if (!container) {
      return;
    }


    container.innerHTML =
      `<div class="admin-empty">
        Loading database...
      </div>`;


    try {

      const result =
        await api(
          "/api/admin/songs",
          {

            headers: {
              "x-admin-key":
                state.adminKey
            }

          }
        );


      const songs =
        Array.isArray(
          result.songs
        )
          ? result.songs
          : Array.isArray(result)
            ? result
            : [];


      if (!songs.length) {

        container.innerHTML =
          `<div class="admin-empty">
            No songs in database.
          </div>`;

        return;

      }


      container.innerHTML =
        songs
          .map(
            adminSongRow
          )
          .join("");


    } catch (error) {

      console.error(
        "Admin songs:",
        error
      );


      container.innerHTML =
        `<div class="admin-empty">
          ${escapeHtml(
            error.message ||
            "Unable to load database."
          )}
        </div>`;

    }

  }


  function adminSongRow(song) {

    const image =
      song.image ||
      song.cover_url ||
      song.coverUrl ||
      "/images/ganpati.jpg";


    const type =
      song.type ||
      song.source_type ||
      "mp3";


    return `
      <div class="admin-song-item">

        <img
          class="admin-song-cover"
          src="${escapeHtml(image)}"
          alt=""
          onerror="this.src='/images/ganpati.jpg'"
        >

        <div class="admin-song-info">

          <strong>
            ${escapeHtml(
              song.title ||
              song.name ||
              "Untitled"
            )}
          </strong>

          <span>
            ${escapeHtml(
              song.artist ||
              "SwarAJ"
            )}
            •
            ${escapeHtml(type)}
          </span>

        </div>

      </div>
    `;

  }


  function updateAdminStats() {

    const total =
      $("adminTotalSongs");

    const youtube =
      $("adminYoutubeSongs");

    const mp3 =
      $("adminMp3Songs");

    const video =
      $("adminVideoSongs");


    if (total) {
      total.textContent =
        state.songs.length;
    }


    if (youtube) {

      youtube.textContent =
        state.songs.filter(
          song =>
            song.type === "youtube"
        ).length;

    }


    if (mp3) {

      mp3.textContent =
        state.songs.filter(
          song =>
            song.type === "mp3"
        ).length;

    }


    if (video) {

      video.textContent =
        state.songs.filter(
          song =>
            song.type === "video" ||
            song.type === "youtube"
        ).length;

    }

  }


  /* =====================================================
     SEARCH
  ===================================================== */

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


          const filtered =
            state.songs.filter(
              song =>
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


          const all =
            $("allSongs");


          if (all) {

            all.innerHTML =
              filtered
                .map(songRow)
                .join("");

            bindSongButtons();

          }


          showPage("songs");

        }
      );

  }


  /* =====================================================
     PLAYER EVENTS
  ===================================================== */

  function setupPlayerControls() {

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


    $("miniPrevious")
      ?.addEventListener(
        "click",
        previousAudio
      );


    $("miniNext")
      ?.addEventListener(
        "click",
        nextAudio
      );


    $("miniPlay")
      ?.addEventListener(
        "click",
        togglePlayPause
      );


    $("miniStop")
      ?.addEventListener(
        "click",
        stopCurrent
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
        stopVideoPlayer
      );


    $("closeVideo")
      ?.addEventListener(
        "click",
        stopVideoPlayer
      );

  }


  /* =====================================================
     START
  ===================================================== */

  async function init() {

    setupNavigation();

    setupSearch();

    setupPlayerControls();

    setupAdmin();

    checkHealth();

    await loadSongs();

  }


  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();