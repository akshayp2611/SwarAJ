(() => {

  "use strict";


  /* =====================================================
     STATE
  ===================================================== */

  const state = {

    songs: [],

    mp3Playlist: [],

    youtubePlaylist: [],

    currentPlaylist: [],

    currentIndex: -1,

    currentSong: null,

    currentMode: null,

    playing: false,

    adminKey:
      localStorage.getItem(
        "swaraj-admin-key"
      ) || ""

  };


  /* =====================================================
     HELPERS
  ===================================================== */

  const $ = id =>
    document.getElementById(id);

  const audio =
    $("audio");


  const E = {

    sidebar:
      $("sidebar"),

    menuBtn:
      $("menuBtn"),

    navButtons:
      [...document.querySelectorAll(".nav-btn")],

    viewButtons:
      [...document.querySelectorAll("[data-view]")],

    search:
      $("searchInput"),

    homeSongs:
      $("homeSongs"),

    audioSongs:
      $("audioSongs"),

    videoSongs:
      $("videoSongs"),

    librarySongs:
      $("librarySongs"),

    videoPlayer:
      $("videoPlayer"),

    videoFrame:
      $("videoFrame"),

    videoPlayerTitle:
      $("videoPlayerTitle"),

    videoPlayerArtist:
      $("videoPlayerArtist"),

    videoClose:
      $("videoCloseBtn"),

    audioCount:
      $("audioPlaylistCount"),

    songCount:
      $("songCount"),

    playAll:
      $("playAllBtn"),

    previous:
      $("previousBtn"),

    next:
      $("nextBtn"),

    stop:
      $("stopBtn"),

    playPause:
      $("playPauseBtn"),

    watchVideo:
      $("watchVideoBtn"),

    playerImage:
      $("playerImage"),

    playerTitle:
      $("playerTitle"),

    playerArtist:
      $("playerArtist"),

    currentTime:
      $("currentTime"),

    duration:
      $("duration"),

    progress:
      $("progress"),

    toast:
      $("toast"),

    adminLock:
      $("adminLock"),

    adminPanel:
      $("adminPanel"),

    adminLoginForm:
      $("adminLoginForm"),

    adminKeyInput:
      $("adminKeyInput"),

    adminLogout:
      $("adminLogout"),

    youtubeForm:
      $("youtubeForm"),

    mp3Form:
      $("mp3Form"),

    mp3UrlForm:
      $("mp3UrlForm"),

    refreshAdmin:
      $("refreshAdmin"),

    adminSongs:
      $("adminSongs")

  };


  /* =====================================================
     TOAST
  ===================================================== */

  function toast(message) {

    E.toast.textContent =
      message;

    E.toast.classList.add(
      "show"
    );

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


  /* =====================================================
     HTML ESCAPE
  ===================================================== */

  function escapeHTML(value) {

    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  /* =====================================================
     YOUTUBE ID
  ===================================================== */

  function extractYouTubeId(value) {

    if (!value) {
      return null;
    }

    const text =
      String(value).trim();


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
        url.hostname
          .toLowerCase();


      if (
        host === "youtu.be" ||
        host === "www.youtu.be"
      ) {

        return (
          url.pathname
            .split("/")
            .filter(Boolean)[0]
          || null
        );

      }


      const v =
        url.searchParams.get("v");

      if (v) {
        return v;
      }


      const parts =
        url.pathname
          .split("/")
          .filter(Boolean);


      const markerIndex =
        parts.findIndex(
          part =>
            [
              "embed",
              "shorts",
              "live"
            ].includes(part)
        );


      if (
        markerIndex >= 0 &&
        parts[markerIndex + 1]
      ) {

        return parts[
          markerIndex + 1
        ];

      }

    } catch {

      return null;

    }


    return null;

  }


  /* =====================================================
     NORMALIZE
  ===================================================== */

  function normalizeSong(song) {

    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      "";

    const youtubeId =
      song.youtube_video_id ||
      song.youtubeVideoId ||
      extractYouTubeId(
        youtubeUrl
      );


    let source =
      String(
        song.source_type ||
        song.source ||
        song.type ||
        ""
      ).toLowerCase();


    if (
      youtubeId
    ) {

      source =
        "youtube";

    } else if (
      source.includes("mp3")
    ) {

      source =
        "mp3";

    } else if (
      source.includes("video") ||
      source === "mp4"
    ) {

      source =
        "video";

    }


    const audioUrl =
      song.audio_url ||
      song.audioUrl ||
      (
        source === "mp3_file"
          ? `/api/songs/${song.id}/audio`
          : ""
      );


    return {

      id:
        song.id,

      title:
        song.title ||
        "Untitled",

      artist:
        song.artist ||
        "SwarAJ",

      album:
        song.album ||
        "Singles",

      category:
        song.category ||
        "Other",

      source,

      audioUrl,

      youtubeUrl,

      youtubeId,

      cover:
        song.cover_url ||
        song.coverUrl ||
        (
          youtubeId
            ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
            : "/images/ganpati.jpg"
        )

    };

  }


  /* =====================================================
     API
  ===================================================== */

  async function api(
    path,
    options = {}
  ) {

    const config = {
      ...options,

      headers: {
        ...(options.headers || {})
      }

    };


    if (
      state.adminKey
    ) {

      config.headers[
        "x-admin-key"
      ] =
        state.adminKey;

    }


    const response =
      await fetch(
        path,
        config
      );


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
        message: text
      };

    }


    if (
      !response.ok
    ) {

      throw new Error(
        data.error ||
        data.message ||
        `${response.status} ${response.statusText}`
      );

    }


    return data;

  }


  /* =====================================================
     LOAD SONGS
  ===================================================== */

  async function loadSongs() {

    try {

      const data =
        await api(
          "/api/songs",
          {
            method: "GET"
          }
        );


      const rows =
        Array.isArray(data)
          ? data
          : (
              data.songs ||
              data.data ||
              []
            );


      state.songs =
        rows.map(
          normalizeSong
        );


      state.mp3Playlist =
        state.songs.filter(
          song =>
            song.source === "mp3" ||
            song.source === "mp3_file" ||
            (
              !song.youtubeId &&
              song.audioUrl
            )
        );


      state.youtubePlaylist =
        state.songs.filter(
          song =>
            Boolean(
              song.youtubeId
            )
        );


      renderAll();


    } catch (error) {

      console.error(
        "Songs error:",
        error
      );

      state.songs = [];

      state.mp3Playlist = [];

      state.youtubePlaylist = [];

      renderAll();

      toast(
        "Unable to load songs"
      );

    }

  }


  /* =====================================================
     FILTER
  ===================================================== */

  function getFilteredSongs() {

    const query =
      E.search.value
        .trim()
        .toLowerCase();


    if (!query) {

      return state.songs;

    }


    return state.songs.filter(
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

  }


  /* =====================================================
     RENDER
  ===================================================== */

  function renderAll() {

    const songs =
      getFilteredSongs();


    const mp3 =
      songs.filter(
        song =>
          state.mp3Playlist.some(
            item =>
              String(item.id) ===
              String(song.id)
          )
      );


    const youtube =
      songs.filter(
        song =>
          Boolean(
            song.youtubeId
          )
      );


    renderSongGrid(
      E.homeSongs,
      songs,
      "home"
    );


    renderSongGrid(
      E.audioSongs,
      mp3,
      "audio"
    );


    renderVideoGrid(
      youtube
    );


    renderSongGrid(
      E.librarySongs,
      songs,
      "library"
    );


    E.songCount.textContent =
      `${state.songs.length} song${
        state.songs.length === 1
          ? ""
          : "s"
      }`;


    E.audioCount.textContent =
      `${state.mp3Playlist.length} MP3 song${
        state.mp3Playlist.length === 1
          ? ""
          : "s"
      }`;

  }


  /* =====================================================
     SONG CARD
  ===================================================== */

  function renderSongGrid(
    container,
    songs,
    mode
  ) {

    if (!songs.length) {

      container.innerHTML =
        `<div class="empty">
          No MP3 songs found
        </div>`;

      return;

    }


    container.innerHTML =
      songs.map(
        song => {

          const isYouTube =
            Boolean(
              song.youtubeId
            );


          return `

            <article
              class="song-card"
            >

              <img
                class="song-cover"
                src="${escapeHTML(song.cover)}"
                alt=""
                loading="lazy"
                onerror="this.src='/images/ganpati.jpg'"
              >

              <div class="song-info">

                <strong>
                  ${escapeHTML(song.title)}
                </strong>

                <small>
                  ${escapeHTML(song.artist)}
                  ·
                  ${
                    isYouTube
                      ? "YouTube"
                      : "MP3"
                  }
                </small>

                <button
                  class="song-play"
                  data-play-id="${escapeHTML(song.id)}"
                  data-play-mode="${mode}"
                  type="button"
                >
                  ▶ Play
                </button>

              </div>

            </article>

          `;

        }
      ).join("");


    container
      .querySelectorAll(
        "[data-play-id]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const song =
                state.songs.find(
                  item =>
                    String(item.id) ===
                    String(
                      button.dataset.playId
                    )
                );


              if (!song) {
                return;
              }


              if (
                song.youtubeId
              ) {

                startYouTubeAudio(
                  song
                );

              } else {

                startMP3(
                  song
                );

              }

            }
          );

        }
      );

  }


  /* =====================================================
     VIDEO GRID
  ===================================================== */

  function renderVideoGrid(
    songs
  ) {

    if (!songs.length) {

      E.videoSongs.innerHTML =
        `<div class="empty">
          No YouTube videos found
        </div>`;

      return;

    }


    E.videoSongs.innerHTML =
      songs.map(
        song => {

          const thumb =
            song.youtubeId
              ? `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`
              : song.cover;


          return `

            <article
              class="video-card"
            >

              <div
                class="video-thumb-wrap"
                data-video-id="${escapeHTML(song.id)}"
              >

                <img
                  class="video-thumb"
                  src="${escapeHTML(thumb)}"
                  alt=""
                  loading="lazy"
                  onerror="this.src='/images/ganpati.jpg'"
                >

                <div class="video-play-overlay">

                  <div class="video-play-circle">
                    ▶
                  </div>

                </div>

              </div>


              <div class="video-card-info">

                <strong>
                  ${escapeHTML(song.title)}
                </strong>

                <small>
                  ${escapeHTML(song.artist)}
                </small>

              </div>

            </article>

          `;

        }
      ).join("");


    E.videoSongs
      .querySelectorAll(
        "[data-video-id]"
      )
      .forEach(
        element => {

          element.addEventListener(
            "click",
            () => {

              const song =
                state.songs.find(
                  item =>
                    String(item.id) ===
                    String(
                      element.dataset.videoId
                    )
                );


              if (song) {

                playYouTubeVideo(
                  song
                );

              }

            }
          );

        }
      );

  }


  /* =====================================================
     PLAYLIST POSITION
  ===================================================== */

  function setPlaylist(
    playlist,
    song
  ) {

    state.currentPlaylist =
      playlist;

    state.currentIndex =
      playlist.findIndex(
        item =>
          String(item.id) ===
          String(song.id)
      );

  }


  /* =====================================================
     PLAYER UI
  ===================================================== */

  function updatePlayer(
    song
  ) {

    E.playerImage.src =
      song.cover ||
      "/images/ganpati.jpg";

    E.playerTitle.textContent =
      song.title;

    E.playerArtist.textContent =
      song.artist;


    E.playerImage.onerror =
      () => {

        E.playerImage.src =
          "/images/ganpati.jpg";

      };

  }


  function setPlayingUI(
    playing
  ) {

    state.playing =
      playing;

    E.playPause.textContent =
      playing
        ? "❚❚"
        : "▶";

  }


  /* =====================================================
     MP3 PLAY
  ===================================================== */

  async function startMP3(
    song
  ) {

    if (!song.audioUrl) {

      toast(
        "MP3 URL is not available"
      );

      return;

    }


    setPlaylist(
      state.mp3Playlist,
      song
    );


    stopYouTube();


    state.currentSong =
      song;

    state.currentMode =
      "mp3";


    updatePlayer(
      song
    );


    try {

      audio.pause();

      audio.src =
        song.audioUrl;

      audio.load();

      await audio.play();

      setPlayingUI(true);

      hideWatchVideo();

    } catch (error) {

      console.error(
        "MP3 play error:",
        error
      );

      setPlayingUI(false);

      toast(
        "Unable to play this MP3"
      );

    }

  }


  /* =====================================================
     YOUTUBE API
  ===================================================== */

  let ytPlayer =
    null;

  let ytReady =
    false;

  let pendingYouTubeSong =
    null;


  function loadYouTubeAPI() {

    if (
      window.YT &&
      window.YT.Player
    ) {

      ytReady = true;

      if (
        pendingYouTubeSong
      ) {

        createYouTubePlayer();

      }

      return;

    }


    if (
      document.getElementById(
        "youtube-api"
      )
    ) {

      return;

    }


    const script =
      document.createElement(
        "script"
      );

    script.id =
      "youtube-api";

    script.src =
      "https://www.youtube.com/iframe_api";

    document.head.appendChild(
      script
    );

  }


  window.onYouTubeIframeAPIReady =
    function () {

      ytReady = true;

      if (
        pendingYouTubeSong
      ) {

        createYouTubePlayer();

      }

    };


  function createYouTubePlayer() {

    if (!pendingYouTubeSong) {
      return;
    }


    const song =
      pendingYouTubeSong;


    const container =
      $("youtubeAudioContainer");


    container.innerHTML =
      `<div id="youtubeAudioPlayer"></div>`;


    ytPlayer =
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

            modestbranding: 1,

            enablejsapi: 1

          },

          events: {

            onReady:
              event => {

                event.target.playVideo();

                setPlayingUI(true);

              },

            onStateChange:
              onYouTubeStateChange,

            onError:
              () => {

                setPlayingUI(false);

                toast(
                  "YouTube could not play this video"
                );

              }

          }

        }
      );

  }


  function onYouTubeStateChange(
    event
  ) {

    if (
      event.data ===
      YT.PlayerState.PLAYING
    ) {

      setPlayingUI(true);

      return;

    }


    if (
      event.data ===
      YT.PlayerState.PAUSED
    ) {

      setPlayingUI(false);

      return;

    }


    if (
      event.data ===
      YT.PlayerState.ENDED
    ) {

      playNext();

    }

  }


  /* =====================================================
     YOUTUBE AUDIO
  ===================================================== */

  function startYouTubeAudio(
    song
  ) {

    if (!song.youtubeId) {

      toast(
        "YouTube video ID not found"
      );

      return;

    }


    setPlaylist(
      state.youtubePlaylist,
      song
    );


    audio.pause();

    stopVisibleVideo();


    state.currentSong =
      song;

    state.currentMode =
      "youtube";


    updatePlayer(
      song
    );


    showWatchVideo();


    pendingYouTubeSong =
      song;


    if (
      ytPlayer &&
      typeof ytPlayer.loadVideoById ===
        "function"
    ) {

      ytPlayer.loadVideoById(
        song.youtubeId
      );

      ytPlayer.playVideo();

      setPlayingUI(true);

      return;

    }


    loadYouTubeAPI();


    if (!ytReady) {

      toast(
        "Starting YouTube audio..."
      );

      return;

    }


    createYouTubePlayer();

  }


  /* =====================================================
     STOP YOUTUBE
  ===================================================== */

  function stopYouTube() {

    if (
      ytPlayer &&
      typeof ytPlayer.stopVideo ===
        "function"
    ) {

      try {

        ytPlayer.stopVideo();

      } catch {}

    }

  }


  /* =====================================================
     VIDEO PLAY
  ===================================================== */

  function playYouTubeVideo(
    song
  ) {

    if (!song.youtubeId) {

      toast(
        "YouTube video unavailable"
      );

      return;

    }


    setPlaylist(
      state.youtubePlaylist,
      song
    );


    audio.pause();

    stopYouTube();


    state.currentSong =
      song;

    state.currentMode =
      "video";


    updatePlayer(
      song
    );


    E.videoPlayer.classList.remove(
      "hidden"
    );


    E.videoPlayerTitle.textContent =
      song.title;

    E.videoPlayerArtist.textContent =
      song.artist;


    E.videoFrame.innerHTML = `

      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(song.youtubeId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
        title="${escapeHTML(song.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>

    `;


    showView(
      "video"
    );


    setPlayingUI(true);

    hideWatchVideo();

  }


  /* =====================================================
     WATCH VIDEO BUTTON
  ===================================================== */

  function showWatchVideo() {

    E.watchVideo.classList.remove(
      "hidden"
    );

  }


  function hideWatchVideo() {

    E.watchVideo.classList.add(
      "hidden"
    );

  }


  E.watchVideo.addEventListener(
    "click",
    () => {

      if (
        state.currentSong &&
        state.currentSong.youtubeId
      ) {

        playYouTubeVideo(
          state.currentSong
        );

      }

    }
  );


  /* =====================================================
     CLOSE VIDEO
  ===================================================== */

  function stopVisibleVideo() {

    E.videoFrame.innerHTML = "";

    E.videoPlayer.classList.add(
      "hidden"
    );

  }


  E.videoClose.addEventListener(
    "click",
    () => {

      stopVisibleVideo();

    }
  );


  /* =====================================================
     NEXT
  ===================================================== */

  function playNext() {

    if (
      !state.currentPlaylist.length
    ) {

      return;

    }


    let next =
      state.currentIndex + 1;


    if (
      next >=
      state.currentPlaylist.length
    ) {

      next = 0;

    }


    const song =
      state.currentPlaylist[next];


    if (!song) {
      return;
    }


    if (
      state.currentMode ===
      "video"
    ) {

      playYouTubeVideo(
        song
      );

    } else if (
      song.youtubeId
    ) {

      startYouTubeAudio(
        song
      );

    } else {

      startMP3(
        song
      );

    }

  }


  /* =====================================================
     PREVIOUS
  ===================================================== */

  function playPrevious() {

    if (
      !state.currentPlaylist.length
    ) {

      return;

    }


    let previous =
      state.currentIndex - 1;


    if (
      previous < 0
    ) {

      previous =
        state.currentPlaylist.length - 1;

    }


    const song =
      state.currentPlaylist[
        previous
      ];


    if (!song) {
      return;
    }


    if (
      state.currentMode ===
      "video"
    ) {

      playYouTubeVideo(
        song
      );

    } else if (
      song.youtubeId
    ) {

      startYouTubeAudio(
        song
      );

    } else {

      startMP3(
        song
      );

    }

  }


  /* =====================================================
     STOP
  ===================================================== */

  function stopPlayback() {

    audio.pause();

    stopYouTube();

    state.playing =
      false;

    state.currentSong =
      state.currentSong;

    setPlayingUI(false);

  }


  /* =====================================================
     PLAY / PAUSE
  ===================================================== */

  E.playPause.addEventListener(
    "click",
    async () => {

      if (
        !state.currentSong
      ) {

        if (
          state.mp3Playlist.length
        ) {

          startMP3(
            state.mp3Playlist[0]
          );

        } else if (
          state.youtubePlaylist.length
        ) {

          startYouTubeAudio(
            state.youtubePlaylist[0]
          );

        }

        return;

      }


      if (
        state.currentMode ===
        "mp3"
      ) {

        if (
          audio.paused
        ) {

          try {

            await audio.play();

            setPlayingUI(true);

          } catch {}

        } else {

          audio.pause();

          setPlayingUI(false);

        }

        return;

      }


      if (
        ytPlayer
      ) {

        if (
          state.playing
        ) {

          ytPlayer.pauseVideo();

        } else {

          ytPlayer.playVideo();

        }

      }

    }
  );


  /* =====================================================
     PLAYER BUTTONS
  ===================================================== */

  E.next.addEventListener(
    "click",
    playNext
  );


  E.previous.addEventListener(
    "click",
    playPrevious
  );


  E.stop.addEventListener(
    "click",
    stopPlayback
  );


  /* =====================================================
     MP3 EVENTS
  ===================================================== */

  audio.addEventListener(
    "play",
    () => {

      setPlayingUI(true);

    }
  );


  audio.addEventListener(
    "pause",
    () => {

      if (
        state.currentMode ===
        "mp3"
      ) {

        setPlayingUI(false);

      }

    }
  );


  audio.addEventListener(
    "ended",
    () => {

      playNext();

    }
  );


  audio.addEventListener(
    "timeupdate",
    () => {

      if (
        !audio.duration ||
        !Number.isFinite(
          audio.duration
        )
      ) {

        return;

      }


      const percent =
        (
          audio.currentTime /
          audio.duration
        ) * 100;


      E.progress.value =
        percent;


      E.currentTime.textContent =
        formatTime(
          audio.currentTime
        );

      E.duration.textContent =
        formatTime(
          audio.duration
        );

    }
  );


  E.progress.addEventListener(
    "input",
    () => {

      if (
        !audio.duration
      ) {

        return;

      }


      audio.currentTime =
        (
          Number(
            E.progress.value
          ) / 100
        ) *
        audio.duration;

    }
  );


  /* =====================================================
     TIME
  ===================================================== */

  function formatTime(
    seconds
  ) {

    if (
      !Number.isFinite(
        seconds
      )
    ) {

      return "0:00";

    }


    const mins =
      Math.floor(
        seconds / 60
      );

    const secs =
      Math.floor(
        seconds % 60
      );


    return (
      mins +
      ":" +
      String(secs)
        .padStart(2, "0")
    );

  }


  /* =====================================================
     PLAY ALL MP3
  ===================================================== */

  E.playAll.addEventListener(
    "click",
    () => {

      if (
        state.mp3Playlist.length
      ) {

        startMP3(
          state.mp3Playlist[0]
        );

        return;

      }


      if (
        state.youtubePlaylist.length
      ) {

        startYouTubeAudio(
          state.youtubePlaylist[0]
        );

        return;

      }


      toast(
        "No songs available"
      );

    }
  );


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function showView(
    view
  ) {

    document
      .querySelectorAll(
        ".page-view"
      )
      .forEach(
        section => {

          section.classList.remove(
            "active"
          );

        }
      );


    const target =
      $(
        `view-${view}`
      );


    if (target) {

      target.classList.add(
        "active"
      );

    }


    E.navButtons.forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
            view
        );

      }
    );


    E.sidebar.classList.remove(
      "open"
    );


    if (
      view === "admin"
    ) {

      updateAdminScreen();

    }

  }


  E.viewButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const view =
            button.dataset.view;

          if (!view) {
            return;
          }


          showView(
            view
          );

        }
      );

    }
  );


  E.menuBtn.addEventListener(
    "click",
    () => {

      E.sidebar.classList.toggle(
        "open"
      );

    }
  );


  /* =====================================================
     SEARCH
  ===================================================== */

  E.search.addEventListener(
    "input",
    renderAll
  );


  /* =====================================================
     ADMIN SCREEN
  ===================================================== */

  function updateAdminScreen() {

    if (
      state.adminKey
    ) {

      E.adminLock.classList.add(
        "hidden"
      );

      E.adminPanel.classList.remove(
        "hidden"
      );

      loadAdminSongs();

    } else {

      E.adminLock.classList.remove(
        "hidden"
      );

      E.adminPanel.classList.add(
        "hidden"
      );

    }

  }


  /* =====================================================
     ADMIN LOGIN
  ===================================================== */

  E.adminLoginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const key =
        E.adminKeyInput.value.trim();


      if (!key) {
        return;
      }


      try {

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
              }),

            // Login itself does not
            // require an existing key.
            admin: false

          }
        );


        state.adminKey =
          key;


        localStorage.setItem(
          "swaraj-admin-key",
          key
        );


        E.adminKeyInput.value =
          "";


        updateAdminScreen();

        toast(
          "Admin unlocked"
        );


      } catch (error) {

        console.error(
          error
        );

        toast(
          error.message ||
          "Invalid admin key"
        );

      }

    }
  );


  /* =====================================================
     ADMIN LOGOUT
  ===================================================== */

  E.adminLogout.addEventListener(
    "click",
    () => {

      state.adminKey =
        "";

      localStorage.removeItem(
        "swaraj-admin-key"
      );


      updateAdminScreen();

      toast(
        "Admin locked"
      );

    }
  );


  /* =====================================================
     ADMIN YOUTUBE
  ===================================================== */

  E.youtubeForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.adminKey) {

        toast(
          "Admin access required"
        );

        return;

      }


      const form =
        new FormData(
          E.youtubeForm
        );


      const body = {

        title:
          form.get("title"),

        artist:
          form.get("artist"),

        album:
          form.get("album"),

        category:
          form.get("category"),

        youtubeUrl:
          form.get("youtubeUrl"),

        coverUrl:
          form.get("coverUrl")

      };


      try {

        await api(
          "/api/admin/songs/youtube",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(body)

          }
        );


        E.youtubeForm.reset();

        await loadSongs();

        await loadAdminSongs();

        toast(
          "YouTube song added"
        );


      } catch (error) {

        toast(
          error.message
        );

      }

    }
  );


  /* =====================================================
     ADMIN MP3 FILE
  ===================================================== */

  E.mp3Form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.adminKey) {

        toast(
          "Admin access required"
        );

        return;

      }


      const form =
        new FormData(
          E.mp3Form
        );


      try {

        await api(
          "/api/admin/songs/upload",
          {

            method: "POST",

            body:
              form

          }
        );


        E.mp3Form.reset();

        await loadSongs();

        await loadAdminSongs();

        toast(
          "MP3 uploaded successfully"
        );


      } catch (error) {

        toast(
          error.message
        );

      }

    }
  );


  /* =====================================================
     ADMIN MP3 URL
  ===================================================== */

  E.mp3UrlForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      if (!state.adminKey) {

        toast(
          "Admin access required"
        );

        return;

      }


      const form =
        new FormData(
          E.mp3UrlForm
        );


      const body = {

        title:
          form.get("title"),

        artist:
          form.get("artist"),

        category:
          form.get("category"),

        audioUrl:
          form.get("audioUrl"),

        coverUrl:
          form.get("coverUrl")

      };


      try {

        await api(
          "/api/admin/songs/mp3-url",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(body)

          }
        );


        E.mp3UrlForm.reset();

        await loadSongs();

        await loadAdminSongs();

        toast(
          "MP3 URL added"
        );


      } catch (error) {

        toast(
          error.message
        );

      }

    }
  );


  /* =====================================================
     ADMIN LIST
  ===================================================== */

  async function loadAdminSongs() {

    if (!state.adminKey) {
      return;
    }


    try {

      const data =
        await api(
          "/api/admin/songs"
        );


      const songs =
        data.songs || [];


      renderAdminSongs(
        songs
      );


    } catch (error) {

      console.error(
        error
      );


      if (
        error.message
          .toLowerCase()
          .includes("invalid admin")
      ) {

        state.adminKey =
          "";

        localStorage.removeItem(
          "swaraj-admin-key"
        );

        updateAdminScreen();

      }


      toast(
        error.message
      );

    }

  }


  function renderAdminSongs(
    songs
  ) {

    if (!songs) {
      return;
    }


    if (!songs.length) {

      E.adminSongs.innerHTML =
        `<div class="empty">
          No songs in database
        </div>`;

      return;

    }


    E.adminSongs.innerHTML =
      songs.map(
        song => `

          <div class="admin-song">

            <img
              src="${escapeHTML(song.cover || "/images/ganpati.jpg")}"
              onerror="this.src='/images/ganpati.jpg'"
              alt=""
            >

            <div class="admin-song-info">

              <strong>
                ${escapeHTML(song.title)}
              </strong>

              <small>
                ${escapeHTML(song.artist)}
                ·
                ${
                  song.youtubeId ||
                  song.youtube_video_id
                    ? "YouTube"
                    : "MP3"
                }
              </small>

            </div>

            <button
              class="delete-btn"
              data-delete-id="${escapeHTML(song.id)}"
              type="button"
              title="Delete"
            >
              ×
            </button>

          </div>

        `
      ).join("");


    E.adminSongs
      .querySelectorAll(
        "[data-delete-id]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const id =
                button.dataset.deleteId;


              if (
                !confirm(
                  "Delete this song?"
                )
              ) {

                return;

              }


              try {

                await api(
                  `/api/admin/songs/${encodeURIComponent(id)}`,
                  {
                    method: "DELETE"
                  }
                );


                await loadSongs();

                await loadAdminSongs();

                toast(
                  "Song deleted"
                );


              } catch (error) {

                toast(
                  error.message
                );

              }

            }
          );

        }
      );

  }


  E.refreshAdmin.addEventListener(
    "click",
    loadAdminSongs
  );


  /* =====================================================
     INITIALIZE
  ===================================================== */

  loadYouTubeAPI();

  loadSongs();

  updateAdminScreen();

})();