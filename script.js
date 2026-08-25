(() => {

  "use strict";


  /* =====================================================
     STATE
  ====================================================== */

  const state = {

    songs: [],

    playlist: [],

    index: -1,

    playing: false,

    adminKey:
      localStorage.getItem(
        "swaraj-admin-key"
      ) || ""

  };


  /* =====================================================
     ELEMENT HELPER
  ====================================================== */

  const $ = id =>
    document.getElementById(id);


  const audio =
    $("audio");


  const E = {

    sidebar:
      $("sidebar"),

    menuBtn:
      $("menuBtn"),

    closeMenu:
      $("closeMenu"),

    nav:
      [...document.querySelectorAll(
        ".nav-btn"
      )],

    viewButtons:
      [...document.querySelectorAll(
        "[data-view]"
      )],

    homeSongs:
      $("homeSongs"),

    audioSongs:
      $("audioSongs"),

    videoSongs:
      $("videoSongs"),

    librarySongs:
      $("librarySongs"),

    adminSongs:
      $("adminSongs"),

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

    search:
      $("searchInput"),

    youtubeForm:
      $("youtubeForm"),

    mp3Form:
      $("mp3Form"),

    videoForm:
      $("videoForm"),

    refreshAdmin:
      $("refreshAdmin"),

    videoPlayer:
      $("videoPlayer"),

    videoFrame:
      $("videoFrame"),

    toast:
      $("toast"),

    count:
      $("songCount")

  };


  /* =====================================================
     YOUTUBE PLAYER
  ====================================================== */

  let youtubePlayer = null;

  let youtubeAPIReady = false;

  let youtubePendingId = null;


  /* =====================================================
     TOAST
  ====================================================== */

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
  ====================================================== */

  function escapeHTML(value) {

    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );

  }


  /* =====================================================
     YOUTUBE ID
  ====================================================== */

  function extractYouTubeId(value) {

    if (!value) {
      return null;
    }

    value =
      String(value).trim();


    /*
     * Direct 11-character ID
     */

    if (
      /^[a-zA-Z0-9_-]{11}$/.test(
        value
      )
    ) {
      return value;
    }


    try {

      const url =
        new URL(value);


      /*
       * youtu.be/VIDEO_ID
       */

      if (
        url.hostname.includes(
          "youtu.be"
        )
      ) {

        return (
          url.pathname
            .split("/")
            .filter(Boolean)[0]
          || null
        );

      }


      /*
       * youtube.com/watch?v=VIDEO_ID
       */

      const queryId =
        url.searchParams.get(
          "v"
        );

      if (queryId) {
        return queryId;
      }


      /*
       * /embed/VIDEO_ID
       * /shorts/VIDEO_ID
       * /live/VIDEO_ID
       */

      const parts =
        url.pathname
          .split("/")
          .filter(Boolean);


      const index =
        parts.findIndex(
          part =>
            [
              "embed",
              "shorts",
              "live"
            ].includes(part)
        );


      if (
        index !== -1 &&
        parts[index + 1]
      ) {

        return parts[
          index + 1
        ];

      }

    } catch (error) {

      console.warn(
        "YouTube URL parse error:",
        error
      );

    }

    return null;

  }


  /* =====================================================
     YOUTUBE API
  ====================================================== */

  function loadYouTubeAPI() {

    if (
      window.YT &&
      window.YT.Player
    ) {

      youtubeAPIReady =
        true;

      if (
        youtubePendingId
      ) {

        createYouTubeAudioPlayer(
          youtubePendingId
        );

      }

      return;

    }


    if (
      document.getElementById(
        "youtube-iframe-api"
      )
    ) {
      return;
    }


    const script =
      document.createElement(
        "script"
      );

    script.id =
      "youtube-iframe-api";

    script.src =
      "https://www.youtube.com/iframe_api";

    document.head.appendChild(
      script
    );

  }


  window.onYouTubeIframeAPIReady =
    function () {

      youtubeAPIReady =
        true;


      if (
        youtubePendingId
      ) {

        createYouTubeAudioPlayer(
          youtubePendingId
        );

      }

    };


  /* =====================================================
     API
  ====================================================== */

  async function api(
    path,
    options = {}
  ) {

    const opts = {
      ...options
    };


    opts.headers = {
      ...(options.headers || {})
    };


    if (
      options.admin !== false &&
      state.adminKey
    ) {

      opts.headers[
        "x-admin-key"
      ] =
        state.adminKey;

    }


    const response =
      await fetch(
        path,
        opts
      );


    const text =
      await response.text();


    let data;


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


    if (!response.ok) {

      throw new Error(
        data.message ||
        data.error ||
        `${response.status} ${response.statusText}`
      );

    }


    return data;

  }


  /* =====================================================
     NORMALIZE SONG
  ====================================================== */

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

      song.source_type ||

      song.source ||

      song.type ||

      "";


    source =
      String(source)
        .toLowerCase();


    /*
     * Automatically identify YouTube.
     */

    if (
      youtubeId &&
      (
        !source ||
        source.includes(
          "youtube"
        )
      )
    ) {

      source =
        "youtube";

    }


    /*
     * Automatically identify video.
     */

    if (
      source.includes(
        "video"
      ) ||
      source === "mp4"
    ) {

      source =
        "video";

    }


    /*
     * Automatically identify MP3.
     */

    if (
      !source &&
      (
        song.audio_url ||
        song.audioUrl ||
        song.file_url ||
        song.fileUrl
      )
    ) {

      source =
        "mp3";

    }


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

      language:
        song.language ||
        "",

      source,

      youtubeUrl,

      youtubeId,

      url:

        song.audio_url ||

        song.audioUrl ||

        song.video_url ||

        song.videoUrl ||

        song.file_url ||

        song.fileUrl ||

        song.url ||

        "",

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
     LOAD SONGS
  ====================================================== */

  async function loadSongs() {

    try {

      const data =
        await api(
          "/api/songs",
          {
            method: "GET",
            admin: false
          }
        );


      const songs =

        Array.isArray(data)

          ? data

          : (
              data.songs ||
              data.data ||
              []
            );


      state.songs =
        songs.map(
          normalizeSong
        );


      renderAll();


    } catch (error) {

      console.error(
        "Song loading error:",
        error
      );


      state.songs = [];


      renderAll();


      toast(
        "Unable to load songs"
      );

    }

  }


  /* =====================================================
     RENDER ALL
  ====================================================== */

  function renderAll() {

    const query =
      E.search.value
        .trim()
        .toLowerCase();


    let songs =
      state.songs;


    if (query) {

      songs =
        songs.filter(
          song =>

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


    /*
     * AUDIO:
     * MP3 + YouTube
     */

    const audioSongs =
      songs.filter(
        song =>

          song.source === "youtube" ||

          song.source === "mp3" ||

          (
            !song.source ||
            song.source === ""
          )
      );


    /*
     * VIDEO:
     * YouTube + uploaded video
     */

    const videoSongs =
      songs.filter(
        song =>

          song.source === "youtube" ||

          song.source === "video" ||

          song.source === "mp4"

      );


    renderSongGrid(
      E.homeSongs,
      songs
    );


    renderSongGrid(
      E.audioSongs,
      audioSongs
    );


    renderVideoGrid(
      videoSongs
    );


    renderSongGrid(
      E.librarySongs,
      songs
    );


    renderAdminSongs();


    E.count.textContent =

      `${state.songs.length} song${
        state.songs.length === 1
          ? ""
          : "s"
      }`;

  }


  /* =====================================================
     SONG GRID
  ====================================================== */

  function renderSongGrid(
    container,
    songs
  ) {

    if (!songs.length) {

      container.innerHTML =
        `
        <div class="empty">
          No songs found
        </div>
        `;

      return;

    }


    container.innerHTML =

      songs.map(
        song => `

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

            <div
              class="song-info"
            >

              <strong>
                ${escapeHTML(song.title)}
              </strong>

              <small>
                ${escapeHTML(song.artist)}
                ·
                ${
                  song.source === "youtube"
                    ? "YouTube"
                    : "MP3"
                }
              </small>

              <button
                class="song-play"
                data-play-id="${escapeHTML(song.id)}"
                type="button"
              >
                ▶ Play
              </button>

            </div>

          </article>

        `
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


              if (song) {

                playSong(
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
  ====================================================== */

  function renderVideoGrid(
    songs
  ) {

    if (!songs.length) {

      E.videoSongs.innerHTML =
        `
        <div class="empty">
          No video songs found
        </div>
        `;

      return;

    }


    E.videoSongs.innerHTML =

      songs.map(
        song => {

          const thumbnail =

            song.youtubeId

              ? `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`

              : (
                  song.cover ||
                  "/images/ganpati.jpg"
                );


          return `

            <article
              class="video-card"
            >

              <img
                class="video-thumb"
                src="${escapeHTML(thumbnail)}"
                alt=""
                loading="lazy"
                onerror="this.src='/images/ganpati.jpg'"
              >

              <div
                class="video-card-body"
              >

                <strong>
                  ${escapeHTML(song.title)}
                </strong>

                <p>
                  ${escapeHTML(song.artist)}
                </p>

                <button
                  class="primary-btn video-open"
                  data-video-id="${escapeHTML(song.id)}"
                  type="button"
                >
                  ▶ Watch
                </button>

              </div>

            </article>

          `;

        }
      ).join("");


    E.videoSongs
      .querySelectorAll(
        ".video-open"
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
                      button.dataset.videoId
                    )
                );


              if (song) {

                openVideo(
                  song
                );

              }

            }
          );

        }
      );

  }


  /* =====================================================
     ADMIN LIST
  ====================================================== */

  function renderAdminSongs() {

    if (!state.songs.length) {

      E.adminSongs.innerHTML =
        `
        <div class="empty">
          No songs in database
        </div>
        `;

      return;

    }


    E.adminSongs.innerHTML =

      state.songs.map(
        song => `

          <div
            class="admin-song"
          >

            <strong>
              ${escapeHTML(song.title)}
            </strong>

            <br>

            <small>

              ${escapeHTML(song.artist)}

              ·

              ${escapeHTML(
                song.source ||
                "unknown"
              )}

            </small>

          </div>

        `
      ).join("");

  }


  /* =====================================================
     NAVIGATION
  ====================================================== */

  function showView(
    name
  ) {

    document
      .querySelectorAll(
        ".page-view"
      )
      .forEach(
        view => {

          view.classList.remove(
            "active"
          );

        }
      );


    const target =
      $(`view-${name}`);


    if (target) {

      target.classList.add(
        "active"
      );

    }


    E.nav.forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
          name
        );

      }
    );


    E.sidebar.classList.remove(
      "open"
    );


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });


    if (
      name === "admin"
    ) {

      loadAdminSongs();

    }

  }


  /* =====================================================
     PLAY SONG
  ====================================================== */

  function playSong(
    song
  ) {

    /*
     * Audio playlist contains:
     * MP3 + YouTube
     */

    state.playlist =
      state.songs.filter(
        item =>

          item.source === "youtube" ||

          item.source === "mp3" ||

          !item.source
      );


    state.index =
      state.playlist.findIndex(
        item =>
          String(item.id) ===
          String(song.id)
      );


    if (
      state.index < 0
    ) {

      state.playlist =
        [song];

      state.index = 0;

    }


    loadCurrent();

  }


  /* =====================================================
     PLAY ALL
  ====================================================== */

  function playAll() {

    state.playlist =
      state.songs.filter(
        song =>

          song.source === "youtube" ||

          song.source === "mp3" ||

          !song.source
      );


    if (
      !state.playlist.length
    ) {

      toast(
        "No audio songs available"
      );

      return;

    }


    state.index = 0;


    loadCurrent();

  }


  /* =====================================================
     LOAD CURRENT
  ====================================================== */

  function loadCurrent() {

    const song =
      state.playlist[
        state.index
      ];


    if (!song) {
      return;
    }


    E.playerTitle.textContent =
      song.title ||
      "Untitled";


    E.playerArtist.textContent =
      song.artist ||
      "SwarAJ";


    E.playerImage.src =
      song.cover ||
      "/images/ganpati.jpg";


    E.currentTime.textContent =
      "0:00";


    E.duration.textContent =
      "0:00";


    E.progress.value =
      0;


    /*
     * Stop old YouTube
     */

    destroyYouTubePlayer();


    /*
     * YouTube
     */

    if (
      song.source === "youtube" ||
      song.youtubeId
    ) {

      playYouTubeAudio(
        song
      );

      return;

    }


    /*
     * MP3
     */

    if (
      song.source === "mp3" ||
      song.url
    ) {

      playMP3(
        song
      );

      return;

    }


    toast(
      "Song URL unavailable"
    );

  }


  /* =====================================================
     MP3 PLAYBACK
  ====================================================== */

  function playMP3(
    song
  ) {

    if (!song.url) {

      toast(
        "MP3 URL unavailable"
      );

      return;

    }


    try {

      audio.pause();

      audio.src =
        song.url;

      audio.load();


      audio.play()
        .then(
          () => {

            state.playing =
              true;

            updatePlayButton();

          }
        )
        .catch(
          error => {

            console.error(
              "MP3 playback:",
              error
            );

            toast(
              "Unable to play MP3"
            );

          }
        );

    } catch (error) {

      console.error(
        error
      );

    }

  }


  /* =====================================================
     YOUTUBE AUDIO
  ====================================================== */

  function playYouTubeAudio(
    song
  ) {

    const youtubeId =

      song.youtubeId ||

      extractYouTubeId(
        song.youtubeUrl
      ) ||

      extractYouTubeId(
        song.url
      );


    if (!youtubeId) {

      toast(
        "Invalid YouTube URL"
      );

      return;

    }


    youtubePendingId =
      youtubeId;


    /*
     * Stop normal MP3.
     */

    try {

      audio.pause();

      audio.removeAttribute(
        "src"
      );

      audio.load();

    } catch (error) {

      console.warn(
        error
      );

    }


    /*
     * Hide the video completely
     * during Audio mode.
     */

    E.videoPlayer.classList.remove(
      "hidden"
    );


    E.videoPlayer.style.position =
      "fixed";

    E.videoPlayer.style.width =
      "1px";

    E.videoPlayer.style.height =
      "1px";

    E.videoPlayer.style.left =
      "-10000px";

    E.videoPlayer.style.top =
      "-10000px";

    E.videoPlayer.style.bottom =
      "auto";

    E.videoPlayer.style.opacity =
      "0";

    E.videoPlayer.style.pointerEvents =
      "none";

    E.videoPlayer.style.overflow =
      "hidden";


    /*
     * Load YouTube API.
     */

    if (!youtubeAPIReady) {

      loadYouTubeAPI();

      toast(
        "Loading YouTube..."
      );

      return;

    }


    createYouTubeAudioPlayer(
      youtubeId
    );

  }


  /* =====================================================
     CREATE YOUTUBE AUDIO PLAYER
  ====================================================== */

  function createYouTubeAudioPlayer(
    videoId
  ) {

    if (!videoId) {
      return;
    }


    youtubePendingId =
      videoId;


    destroyYouTubePlayer();


    E.videoFrame.innerHTML =
      `
      <div
        id="youtubeAudioPlayer"
      ></div>
      `;


    youtubePlayer =
      new YT.Player(
        "youtubeAudioPlayer",
        {

          width: "1",

          height: "1",

          videoId: videoId,

          playerVars: {

            autoplay: 1,

            controls: 0,

            rel: 0,

            playsinline: 1,

            modestbranding: 1,

            enablejsapi: 1

          },


          events: {

            onReady:
              function(event) {

                try {

                  event.target.setVolume(
                    100
                  );

                  event.target.playVideo();


                  state.playing =
                    true;


                  updatePlayButton();

                } catch (error) {

                  console.error(
                    "YouTube ready/play:",
                    error
                  );

                  toast(
                    "Tap Play again to start YouTube"
                  );

                }

              },


            onStateChange:
              function(event) {

                /*
                 * PLAYING
                 */

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {

                  state.playing =
                    true;

                  updatePlayButton();

                  return;

                }


                /*
                 * PAUSED
                 */

                if (
                  event.data ===
                  YT.PlayerState.PAUSED
                ) {

                  state.playing =
                    false;

                  updatePlayButton();

                  return;

                }


                /*
                 * ENDED
                 */

                if (
                  event.data ===
                  YT.PlayerState.ENDED
                ) {

                  state.playing =
                    false;

                  updatePlayButton();

                  nextSong();

                }

              },


            onError:
              function(event) {

                console.error(
                  "YouTube error:",
                  event.data
                );


                state.playing =
                  false;


                updatePlayButton();


                /*
                 * 2 = invalid ID
                 * 5 = HTML5 error
                 * 100 = unavailable
                 * 101/150 = embedding disabled
                 */

                if (
                  event.data === 101 ||
                  event.data === 150
                ) {

                  toast(
                    "This YouTube video does not allow embedding."
                  );

                } else if (
                  event.data === 100
                ) {

                  toast(
                    "YouTube video is unavailable."
                  );

                } else {

                  toast(
                    "Unable to play this YouTube song."
                  );

                }

              }

          }

        }
      );

  }


  /* =====================================================
     DESTROY YOUTUBE
  ====================================================== */

  function destroyYouTubePlayer() {

    if (!youtubePlayer) {
      return;
    }


    try {

      youtubePlayer.stopVideo();

    } catch (error) {

      console.warn(
        error
      );

    }


    try {

      youtubePlayer.destroy();

    } catch (error) {

      console.warn(
        error
      );

    }


    youtubePlayer =
      null;


    E.videoFrame.innerHTML =
      "";

  }


  /* =====================================================
     YOUTUBE PLAY / PAUSE
  ====================================================== */

  function toggleYouTubePlayback() {

    if (!youtubePlayer) {

      const song =
        state.playlist[
          state.index
        ];


      if (song) {

        playYouTubeAudio(
          song
        );

      }

      return;

    }


    try {

      const playerState =
        youtubePlayer.getPlayerState();


      if (
        playerState ===
        YT.PlayerState.PLAYING
      ) {

        youtubePlayer.pauseVideo();

        state.playing =
          false;

      } else {

        youtubePlayer.playVideo();

        state.playing =
          true;

      }


      updatePlayButton();

    } catch (error) {

      console.error(
        "YouTube toggle:",
        error
      );

    }

  }


  /* =====================================================
     OPEN VIDEO
  ====================================================== */

  function openVideo(
    song
  ) {

    showView(
      "video"
    );


    /*
     * YouTube Video
     */

    if (
      song.youtubeId
    ) {

      destroyYouTubePlayer();


      E.videoPlayer.classList.remove(
        "hidden"
      );


      /*
       * Restore normal video dimensions.
       */

      E.videoPlayer.style.position =
        "";

      E.videoPlayer.style.width =
        "";

      E.videoPlayer.style.height =
        "";

      E.videoPlayer.style.left =
        "";

      E.videoPlayer.style.top =
        "";

      E.videoPlayer.style.bottom =
        "";

      E.videoPlayer.style.opacity =
        "";

      E.videoPlayer.style.pointerEvents =
        "";

      E.videoPlayer.style.overflow =
        "";


      E.videoFrame.innerHTML =

        `
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(song.youtubeId)}?autoplay=1&rel=0&playsinline=1"
          title="${escapeHTML(song.title)}"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen>
        </iframe>
        `;


      return;

    }


    /*
     * Uploaded Video
     */

    if (
      song.url
    ) {

      E.videoPlayer.classList.remove(
        "hidden"
      );


      E.videoPlayer.style.position =
        "";

      E.videoPlayer.style.width =
        "";

      E.videoPlayer.style.height =
        "";

      E.videoPlayer.style.left =
        "";

      E.videoPlayer.style.top =
        "";

      E.videoPlayer.style.bottom =
        "";

      E.videoPlayer.style.opacity =
        "";

      E.videoPlayer.style.pointerEvents =
        "";

      E.videoPlayer.style.overflow =
        "";


      E.videoFrame.innerHTML =

        `
        <video
          src="${escapeHTML(song.url)}"
          controls
          autoplay
          playsinline>
        </video>
        `;


      return;

    }


    toast(
      "Video URL unavailable"
    );

  }


  /* =====================================================
     NEXT
  ====================================================== */

  function nextSong() {

    if (
      !state.playlist.length
    ) {

      playAll();

      return;

    }


    state.index++;


    if (
      state.index >=
      state.playlist.length
    ) {

      state.index = 0;

    }


    loadCurrent();

  }


  /* =====================================================
     PREVIOUS
  ====================================================== */

  function previousSong() {

    if (
      !state.playlist.length
    ) {

      return;

    }


    state.index--;


    if (
      state.index < 0
    ) {

      state.index =
        state.playlist.length - 1;

    }


    loadCurrent();

  }


  /* =====================================================
     STOP
  ====================================================== */

  function stopSong() {

    /*
     * MP3
     */

    try {

      audio.pause();

      audio.currentTime =
        0;

    } catch (error) {

      console.warn(
        error
      );

    }


    /*
     * YouTube
     */

    if (
      youtubePlayer
    ) {

      try {

        youtubePlayer.stopVideo();

      } catch (error) {

        console.warn(
          error
        );

      }

    }


    state.playing =
      false;


    updatePlayButton();

  }


  /* =====================================================
     PLAY / PAUSE
  ====================================================== */

  function togglePlay() {

    const song =
      state.playlist[
        state.index
      ];


    if (!song) {

      playAll();

      return;

    }


    /*
     * YouTube
     */

    if (
      song.source === "youtube" ||
      song.youtubeId
    ) {

      toggleYouTubePlayback();

      return;

    }


    /*
     * MP3
     */

    if (
      audio.paused
    ) {

      audio.play()
        .then(
          () => {

            state.playing =
              true;

            updatePlayButton();

          }
        )
        .catch(
          error => {

            console.error(
              error
            );

            toast(
              "Unable to play audio"
            );

          }
        );

    } else {

      audio.pause();

      state.playing =
        false;

      updatePlayButton();

    }

  }


  /* =====================================================
     PLAY BUTTON
  ====================================================== */

  function updatePlayButton() {

    E.playPause.textContent =
      state.playing
        ? "Ⅱ"
        : "▶";

  }


  /* =====================================================
     TIME
  ====================================================== */

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
      `${mins}:${String(secs).padStart(2,"0")}`
    );

  }


  /* =====================================================
     YOUTUBE ADMIN SUBMIT
  ====================================================== */

  async function submitYouTubeSong(
    form
  ) {

    const youtubeUrl =
      form.querySelector(
        '[name="youtube_url"]'
      )?.value.trim();


    if (!youtubeUrl) {

      toast(
        "Enter a YouTube URL"
      );

      return;

    }


    const youtubeId =
      extractYouTubeId(
        youtubeUrl
      );


    if (!youtubeId) {

      toast(
        "Invalid YouTube URL"
      );

      return;

    }


    const data = {

      title:
        form.querySelector(
          '[name="title"]'
        )?.value.trim()
        ||
        "Untitled",


      artist:
        form.querySelector(
          '[name="artist"]'
        )?.value.trim()
        ||
        "SwarAJ",


      album:
        form.querySelector(
          '[name="album"]'
        )?.value.trim()
        ||
        "Singles",


      category:
        form.querySelector(
          '[name="category"]'
        )?.value.trim()
        ||
        "Other",


      language:
        form.querySelector(
          '[name="language"]'
        )?.value.trim()
        ||
        "",


      /*
       * Send both names.
       * This makes the frontend compatible
       * with either backend naming convention.
       */

      youtubeUrl:
        youtubeUrl,

      youtube_url:
        youtubeUrl,


      youtubeVideoId:
        youtubeId,

      youtube_video_id:
        youtubeId,


      coverUrl:
        form.querySelector(
          '[name="cover_url"]'
        )?.value.trim()
        ||
        `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,

      cover_url:
        form.querySelector(
          '[name="cover_url"]'
        )?.value.trim()
        ||
        `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`

    };


    try {

      const result =
        await api(
          "/api/admin/songs/youtube",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify(
                data
              ),

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
        "YouTube submit:",
        error
      );


      toast(
        error.message ||
        "Unable to add YouTube song"
      );

    }

  }


  /* =====================================================
     MULTIPART UPLOAD
  ====================================================== */

  async function submitMultipart(
    form,
    endpoint
  ) {

    const formData =
      new FormData(
        form
      );


    try {

      const result =
        await api(
          endpoint,
          {

            method: "POST",

            body:
              formData,

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
        "Upload:",
        error
      );


      toast(
        error.message ||
        "Upload failed"
      );

    }

  }


  /* =====================================================
     ADMIN LOAD
  ====================================================== */

  async function loadAdminSongs() {

    try {

      const data =
        await api(
          "/api/songs",
          {
            method: "GET",
            admin: false
          }
        );


      const songs =

        Array.isArray(data)

          ? data

          : (
              data.songs ||
              data.data ||
              []
            );


      state.songs =
        songs.map(
          normalizeSong
        );


      renderAdminSongs();

      renderAll();


    } catch (error) {

      console.error(
        "Admin songs:",
        error
      );

    }

  }


  /* =====================================================
     NAV BUTTONS
  ====================================================== */

  E.nav.forEach(
    button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          showView(
            button.dataset.view
          );

        }
      );

    }
  );


  /*
   * Hero Browse Audio and
   * any other data-view buttons.
   */

  E.viewButtons.forEach(
    button => {

      if (
        button.classList.contains(
          "nav-btn"
        )
      ) {
        return;
      }


      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          const view =
            button.dataset.view;


          if (view) {

            showView(
              view
            );

          }

        }
      );

    }
  );


  /* =====================================================
     MOBILE MENU
  ====================================================== */

  E.menuBtn.addEventListener(
    "click",
    () => {

      E.sidebar.classList.add(
        "open"
      );

    }
  );


  E.closeMenu.addEventListener(
    "click",
    () => {

      E.sidebar.classList.remove(
        "open"
      );

    }
  );


  /* =====================================================
     PLAYER
  ====================================================== */

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


  /* =====================================================
     SEARCH
  ====================================================== */

  E.search.addEventListener(
    "input",
    renderAll
  );


  /* =====================================================
     YOUTUBE FORM
  ====================================================== */

  E.youtubeForm.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      submitYouTubeSong(
        E.youtubeForm
      );

    }
  );


  /* =====================================================
     MP3 FORM
  ====================================================== */

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


  /* =====================================================
     VIDEO FORM
  ====================================================== */

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


  /* =====================================================
     REFRESH
  ====================================================== */

  E.refreshAdmin.addEventListener(
    "click",
    loadAdminSongs
  );


  /* =====================================================
     MP3 EVENTS
  ====================================================== */

  audio.addEventListener(
    "loadedmetadata",
    () => {

      E.duration.textContent =
        formatTime(
          audio.duration
        );

    }
  );


  audio.addEventListener(
    "timeupdate",
    () => {

      if (
        !audio.duration
      ) {

        return;

      }


      E.currentTime.textContent =
        formatTime(
          audio.currentTime
        );


      E.progress.value =

        (
          audio.currentTime /
          audio.duration
        ) * 100;

    }
  );


  audio.addEventListener(
    "play",
    () => {

      state.playing =
        true;

      updatePlayButton();

    }
  );


  audio.addEventListener(
    "pause",
    () => {

      state.playing =
        false;

      updatePlayButton();

    }
  );


  audio.addEventListener(
    "ended",
    nextSong
  );


  /* =====================================================
     SEEK
  ====================================================== */

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
     START
  ====================================================== */

  showView(
    "home"
  );


  /*
   * Load API immediately.
   * This means YouTube playback is ready
   * when the user presses a song.
   */

  loadYouTubeAPI();


  /*
   * Load database.
   */

  loadSongs();


})();