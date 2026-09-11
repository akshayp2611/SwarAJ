(() => {
  "use strict";

  /* =====================================================
     SWARAJ PLAYER
     ===================================================== */

  const state = {
    songs: [],
    filteredSongs: [],

    currentIndex: -1,
    currentSong: null,

    category: "All",
    search: "",

    shuffle: false,
    repeat: false,

    liked: new Set(),

    youtubePlayer: null,
    youtubeWatchPlayer: null,

    youtubeReady: false,
    youtubeLoading: false,

    initialized: false,

    videoOpening: false
  };


  /* =====================================================
     DOM
     ===================================================== */

  const $ = (id) =>
    document.getElementById(id);


  /* =====================================================
     AUDIO
     ===================================================== */

  const audio =
    $("audioPlayer");


  if (audio) {

    audio.preload = "metadata";

    audio.setAttribute(
      "playsinline",
      ""
    );

    audio.setAttribute(
      "webkit-playsinline",
      ""
    );

  }


  /* =====================================================
     HELPERS
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


  function formatTime(seconds) {

    if (
      !Number.isFinite(seconds) ||
      seconds < 0
    ) {
      return "0:00";
    }

    const minutes =
      Math.floor(seconds / 60);

    const secs =
      Math.floor(seconds % 60);

    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }


  function getSongId(song) {

    return String(
      song?.id ?? ""
    );

  }


  /* =====================================================
     YOUTUBE ID
     ===================================================== */

  function getYouTubeId(song) {

    if (!song) {
      return null;
    }


    if (song.youtube_video_id) {

      return String(
        song.youtube_video_id
      ).trim();

    }


    if (song.youtubeVideoId) {

      return String(
        song.youtubeVideoId
      ).trim();

    }


    const url =
      song.youtube_url ||
      song.youtubeUrl ||
      "";


    if (!url) {
      return null;
    }


    const value =
      String(url).trim();


    let match =
      value.match(
        /youtu\.be\/([^?&#/]+)/i
      );


    if (match) {
      return match[1];
    }


    match =
      value.match(
        /[?&]v=([^?&#/]+)/i
      );


    if (match) {
      return match[1];
    }


    match =
      value.match(
        /youtube\.com\/embed\/([^?&#/]+)/i
      );


    if (match) {
      return match[1];
    }


    match =
      value.match(
        /youtube\.com\/shorts\/([^?&#/]+)/i
      );


    if (match) {
      return match[1];
    }


    match =
      value.match(
        /youtube\.com\/live\/([^?&#/]+)/i
      );


    if (match) {
      return match[1];
    }


    return null;
  }


  function isYouTubeSong(song) {

    return Boolean(
      getYouTubeId(song)
    );

  }


  /* =====================================================
     YOUTUBE API
     ===================================================== */

  function loadYouTubeAPI() {

    if (
      window.YT &&
      window.YT.Player
    ) {

      state.youtubeReady = true;

      createBackgroundYouTubePlayer();

      return;

    }


    if (
      state.youtubeLoading
    ) {
      return;
    }


    state.youtubeLoading = true;


    const previousCallback =
      window.onYouTubeIframeAPIReady;


    window.onYouTubeIframeAPIReady =
      () => {

        state.youtubeReady = true;

        createBackgroundYouTubePlayer();


        if (
          typeof previousCallback ===
          "function"
        ) {

          try {
            previousCallback();
          } catch (error) {
            console.warn(error);
          }

        }

      };


    if (
      document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      )
    ) {
      return;
    }


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


  /* =====================================================
     BACKGROUND YOUTUBE PLAYER
     ===================================================== */

  function createBackgroundYouTubePlayer() {

    if (
      !state.youtubeReady
    ) {
      return;
    }


    if (
      state.youtubePlayer
    ) {
      return;
    }


    const container =
      $("youtubeAudioPlayer");


    if (!container) {

      console.error(
        "SwarAJ: youtubeAudioPlayer missing"
      );

      return;

    }


    state.youtubePlayer =
      new YT.Player(
        "youtubeAudioPlayer",
        {

          width: "2",
          height: "2",

          videoId: "",

          playerVars: {

            autoplay: 0,

            controls: 0,

            disablekb: 1,

            fs: 0,

            modestbranding: 1,

            playsinline: 1,

            rel: 0

          },


          events: {

            onReady() {

              console.log(
                "SwarAJ YouTube audio player ready"
              );

            },


            onStateChange(event) {

              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {

                updatePlayButton(true);

                updateSongPlayingState();

              }


              if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {

                updatePlayButton(false);

                updateSongPlayingState();

              }


              if (
                event.data ===
                YT.PlayerState.ENDED
              ) {

                updatePlayButton(false);

                nextSong();

              }

            },


            onError(event) {

              console.error(
                "SwarAJ YouTube error:",
                event.data
              );

              showToast(
                "YouTube playback error"
              );

            }

          }

        }
      );

  }


  /* =====================================================
     LOCAL AUDIO PLAYBACK
     ===================================================== */

  async function playLocalSong(song) {

    if (!audio) {
      return;
    }


    stopYouTube();


    const url =
      song.audio_url ||
      song.audioUrl;


    if (!url) {

      showToast(
        "Audio file not available"
      );

      return;

    }


    try {

      audio.pause();


      if (
        audio.src !==
        new URL(
          url,
          window.location.href
        ).href
      ) {

        audio.src = url;

        audio.load();

      }


      await audio.play();


      updatePlayButton(true);

      updateSongPlayingState();


    } catch (error) {

      console.error(
        "Local audio playback error:",
        error
      );


      showToast(
        "Unable to play this song"
      );

    }

  }


  /* =====================================================
     YOUTUBE AUDIO PLAYBACK
     ===================================================== */

  function playYouTubeSong(song) {

    const videoId =
      getYouTubeId(song);


    if (!videoId) {

      showToast(
        "YouTube video unavailable"
      );

      return;

    }


    if (audio) {

      audio.pause();

      audio.removeAttribute(
        "src"
      );

      audio.load();

    }


    state.youtubeCurrentId =
      videoId;


    if (
      !state.youtubeReady
    ) {

      loadYouTubeAPI();


      const started =
        Date.now();


      const timer =
        setInterval(() => {

          if (
            state.youtubePlayer
          ) {

            clearInterval(timer);


            try {

              state.youtubePlayer.loadVideoById(
                videoId
              );

              state.youtubePlayer.playVideo();

            } catch (error) {

              console.error(
                error
              );

            }

          }


          if (
            Date.now() -
            started >
            10000
          ) {

            clearInterval(timer);

          }

        }, 150);


      return;

    }


    createBackgroundYouTubePlayer();


    if (
      !state.youtubePlayer
    ) {

      showToast(
        "YouTube player is not ready"
      );

      return;

    }


    try {

      state.youtubePlayer.loadVideoById(
        videoId
      );

      state.youtubePlayer.playVideo();


      updatePlayButton(true);

      updateSongPlayingState();

    } catch (error) {

      console.error(
        "YouTube playback error:",
        error
      );

    }

  }


  /* =====================================================
     MAIN PLAY FUNCTION

     CLICK SONG = IMMEDIATE PLAY
     ===================================================== */

  async function playSong(
    songOrIndex
  ) {

    let song = null;

    let index = -1;


    if (
      typeof songOrIndex ===
      "number"
    ) {

      index =
        songOrIndex;

      song =
        state.filteredSongs[
          index
        ];

    } else {

      song =
        songOrIndex;

      index =
        state.filteredSongs.findIndex(
          item =>
            getSongId(item) ===
            getSongId(song)
        );

    }


    if (!song) {

      console.warn(
        "SwarAJ: song not found"
      );

      return;

    }


    state.currentSong =
      song;


    if (
      index >= 0
    ) {

      state.currentIndex =
        index;

    }


    updatePlayerInfo(
      song
    );


    updateMediaSession(
      song
    );


    if (
      isYouTubeSong(song)
    ) {

      playYouTubeSong(
        song
      );

    } else {

      await playLocalSong(
        song
      );

    }


    updateSongPlayingState();

  }


  /* =====================================================
     STOP YOUTUBE
     ===================================================== */

  function stopYouTube() {

    if (
      !state.youtubePlayer
    ) {
      return;
    }


    try {

      state.youtubePlayer.stopVideo();

    } catch (error) {

      console.warn(
        error
      );

    }

  }


  /* =====================================================
     PLAY / PAUSE
     ===================================================== */

  function togglePlay() {

    const song =
      state.currentSong;


    if (!song) {

      if (
        state.filteredSongs.length
      ) {

        playSong(0);

      }

      return;

    }


    if (
      isYouTubeSong(song)
    ) {

      if (
        !state.youtubePlayer
      ) {

        playYouTubeSong(
          song
        );

        return;

      }


      try {

        const status =
          state.youtubePlayer
            .getPlayerState();


        if (
          status ===
          YT.PlayerState.PLAYING
        ) {

          state.youtubePlayer.pauseVideo();

        } else {

          state.youtubePlayer.playVideo();

        }

      } catch (error) {

        playYouTubeSong(
          song
        );

      }


      return;

    }


    if (!audio) {
      return;
    }


    if (audio.paused) {

      audio
        .play()
        .catch(error => {

          console.error(
            error
          );

        });

    } else {

      audio.pause();

    }

  }


  /* =====================================================
     NEXT
     ===================================================== */

  function nextSong() {

    if (
      !state.filteredSongs.length
    ) {
      return;
    }


    let nextIndex;


    if (
      state.shuffle
    ) {

      if (
        state.filteredSongs.length ===
        1
      ) {

        nextIndex = 0;

      } else {

        do {

          nextIndex =
            Math.floor(
              Math.random() *
              state.filteredSongs.length
            );

        } while (
          nextIndex ===
          state.currentIndex
        );

      }

    } else {

      nextIndex =
        state.currentIndex + 1;


      if (
        nextIndex >=
        state.filteredSongs.length
      ) {

        if (
          state.repeat
        ) {

          nextIndex = 0;

        } else {

          updatePlayButton(false);

          return;

        }

      }

    }


    playSong(
      nextIndex
    );

  }


  /* =====================================================
     PREVIOUS
     ===================================================== */

  function previousSong() {

    if (
      !state.filteredSongs.length
    ) {
      return;
    }


    let previousIndex =
      state.currentIndex - 1;


    if (
      previousIndex < 0
    ) {

      previousIndex =
        state.filteredSongs.length - 1;

    }


    playSong(
      previousIndex
    );

  }


  /* =====================================================
     LOAD SONGS
     ===================================================== */

  async function loadSongs() {

    try {

      const response =
        await fetch(
          "/api/songs",
          {
            cache: "no-store"
          }
        );


      if (!response.ok) {

        throw new Error(
          `HTTP ${response.status}`
        );

      }


      const data =
        await response.json();


      if (
        Array.isArray(data)
      ) {

        state.songs =
          data;

      } else if (
        Array.isArray(data.songs)
      ) {

        state.songs =
          data.songs;

      } else if (
        Array.isArray(data.data)
      ) {

        state.songs =
          data.data;

      } else {

        state.songs =
          [];

      }


      state.filteredSongs =
        [...state.songs];


      buildCategories();

      renderSongs();


      updateSongCount();


    } catch (error) {

      console.error(
        "SwarAJ song loading failed:",
        error
      );


      state.songs = [];

      state.filteredSongs = [];


      renderSongs();

      showToast(
        "Unable to load songs"
      );

    }

  }


  /* =====================================================
     CATEGORIES
     ===================================================== */

  function buildCategories() {

    const bar =
      $("categoryBar");


    if (!bar) {
      return;
    }


    const categories =
      new Set();


    state.songs.forEach(
      song => {

        const category =
          String(
            song.category ||
            "Other"
          ).trim();


        if (category) {

          categories.add(
            category
          );

        }

      }
    );


    const sorted =
      [...categories]
        .sort(
          (a, b) =>
            a.localeCompare(
              b
            )
        );


    const all =
      [
        "All",
        ...sorted
      ];


    bar.innerHTML =
      all.map(
        category => `

          <button
            class="category ${
              state.category === category
                ? "active"
                : ""
            }"
            type="button"
            data-category="${escapeHTML(category)}"
          >
            ${escapeHTML(category)}
          </button>

        `
      ).join("");

  }


  /* =====================================================
     SELECT CATEGORY

     IMPORTANT:
     Theme/player remains untouched.
     ===================================================== */

  function selectCategory(
    category
  ) {

    state.category =
      category ||
      "All";


    const currentSongId =
      state.currentSong
        ? getSongId(
            state.currentSong
          )
        : null;


    applyFilters();


    /*
     * Re-render category buttons.
     */

    document
      .querySelectorAll(
        "#categoryBar .category"
      )
      .forEach(
        button => {

          button.classList.toggle(
            "active",
            button.dataset.category ===
            state.category
          );

        }
      );


    /*
     * Keep currently playing
     * song alive.
     */

    if (
      currentSongId
    ) {

      document
        .querySelectorAll(
          ".song-card"
        )
        .forEach(
          card => {

            card.classList.toggle(
              "playing",
              card.dataset.songId ===
              currentSongId
            );

          }
        );

    }

  }


  /* =====================================================
     FILTER
     ===================================================== */

  function applyFilters() {

    const query =
      state.search
        .trim()
        .toLowerCase();


    state.filteredSongs =
      state.songs.filter(
        song => {

          const category =
            String(
              song.category ||
              "Other"
            );


          const categoryMatch =
            state.category ===
            "All" ||
            category.toLowerCase() ===
            state.category.toLowerCase();


          if (!categoryMatch) {
            return false;
          }


          if (!query) {
            return true;
          }


          const searchable =
            [
              song.title,
              song.artist,
              song.album,
              song.category
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();


          return searchable.includes(
            query
          );

        }
      );


    renderSongs();

    updateSongCount();

  }


  /* =====================================================
     RENDER SONGS
     ===================================================== */

  function renderSongs() {

    const grid =
      $("songGrid");


    if (!grid) {
      return;
    }


    grid.innerHTML = "";


    if (
      !state.filteredSongs.length
    ) {

      grid.innerHTML = `

        <div class="empty-state">

          <div class="empty-icon">
            ♪
          </div>

          <h3>
            No songs found
          </h3>

          <p>
            Try another category or search.
          </p>

        </div>

      `;

      return;

    }


    state.filteredSongs.forEach(
      (song, index) => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "song-card";


        card.dataset.songIndex =
          String(index);


        card.dataset.songId =
          getSongId(song);


        if (
          state.currentSong &&
          getSongId(
            state.currentSong
          ) ===
          getSongId(song)
        ) {

          card.classList.add(
            "playing"
          );

        }


        const cover =
          song.cover_url ||
          song.coverUrl ||
          "/images/default-cover.jpg";


        const title =
          song.title ||
          "Untitled";


        const artist =
          song.artist ||
          "SwarAJ";


        const category =
          song.category ||
          "Other";


        const youtube =
          isYouTubeSong(
            song
          );


        card.innerHTML = `

          <div class="cover">

            <img
              src="${escapeHTML(cover)}"
              alt="${escapeHTML(title)}"
              loading="lazy"
              onerror="this.src='/images/default-cover.jpg'"
            >


            <button
              class="card-play"
              type="button"
              data-play
              aria-label="Play ${escapeHTML(title)}"
            >
              ▶
            </button>

          </div>


          <div class="song-info">

            <div
              class="song-title"
              title="${escapeHTML(title)}"
            >
              ${escapeHTML(title)}
            </div>


            <div
              class="song-artist"
              title="${escapeHTML(artist)}"
            >
              ${escapeHTML(artist)}
            </div>


            <div class="song-category">
              ${escapeHTML(category)}
            </div>

          </div>


          ${
            youtube
              ? `

                <button
                  class="watch-button card-watch-button"
                  type="button"
                  data-watch
                >
                  ▷ Watch
                </button>

              `
              : ""
          }

        `;


        /*
         * MAIN REQUIREMENT:
         *
         * Click anywhere on song card
         * = immediately play.
         */

        card.addEventListener(
          "click",
          event => {

            if (
              event.target.closest(
                "[data-watch]"
              )
            ) {
              return;
            }


            playSong(
              song
            );

          }
        );


        /*
         * Play button.
         */

        const playButton =
          card.querySelector(
            "[data-play]"
          );


        playButton?.addEventListener(
          "click",
          event => {

            event.preventDefault();

            event.stopPropagation();

            playSong(
              song
            );

          }
        );


        /*
         * Watch button.
         */

        const watchButton =
          card.querySelector(
            "[data-watch]"
          );


        watchButton?.addEventListener(
          "click",
          event => {

            event.preventDefault();

            event.stopPropagation();

            watchSong(
              song
            );

          }
        );


        grid.appendChild(
          card
        );

      }
    );

  }


  /* =====================================================
     WATCH YOUTUBE VIDEO
     ===================================================== */

  function watchSong(song) {

    const videoId =
      getYouTubeId(song);


    if (!videoId) {

      showToast(
        "No YouTube video available"
      );

      return;

    }


    const modal =
      $("videoModal");


    const frame =
      $("youtubeFrame");


    if (!modal || !frame) {

      window.open(
        `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
        "_blank",
        "noopener,noreferrer"
      );

      return;

    }


    modal.classList.remove(
      "hidden"
    );


    modal.setAttribute(
      "aria-hidden",
      "false"
    );


    frame.style.pointerEvents =
      "auto";


    createWatchPlayer(
      videoId
    );

  }


  /* =====================================================
     WATCH PLAYER
     ===================================================== */

  function createWatchPlayer(
    videoId
  ) {

    if (
      !state.youtubeReady
    ) {

      loadYouTubeAPI();


      const started =
        Date.now();


      const timer =
        setInterval(
          () => {

            if (
              state.youtubeReady
            ) {

              clearInterval(
                timer
              );


              createWatchPlayer(
                videoId
              );

            }


            if (
              Date.now() -
              started >
              10000
            ) {

              clearInterval(
                timer
              );

            }

          },
          150
        );


      return;

    }


    const frame =
      $("youtubeFrame");


    if (!frame) {
      return;
    }


    if (
      state.youtubeWatchPlayer
    ) {

      try {

        state.youtubeWatchPlayer.loadVideoById(
          videoId
        );

        state.youtubeWatchPlayer.playVideo();

        return;

      } catch (error) {

        console.warn(
          error
        );

        state.youtubeWatchPlayer =
          null;

      }

    }


    frame.innerHTML = "";


    const container =
      document.createElement(
        "div"
      );


    container.id =
      "swarajWatchPlayer";


    container.style.width =
      "100%";


    container.style.height =
      "100%";


    frame.appendChild(
      container
    );


    state.youtubeWatchPlayer =
      new YT.Player(
        "swarajWatchPlayer",
        {

          width: "100%",

          height: "100%",

          videoId,

          playerVars: {

            autoplay: 1,

            controls: 1,

            playsinline: 1,

            rel: 0,

            modestbranding: 1

          },

          events: {

            onReady(event) {

              try {

                event.target.playVideo();

              } catch (error) {

                console.warn(
                  error
                );

              }

            }

          }

        }
      );

  }


  /* =====================================================
     CLOSE VIDEO
     ===================================================== */

  function closeVideo() {

    const modal =
      $("videoModal");


    if (!modal) {
      return;
    }


    /*
     * Stop Watch player only.
     *
     * DO NOT:
     *
     * youtubeFrame.innerHTML = "";
     *
     * unnecessarily.
     */

    if (
      state.youtubeWatchPlayer
    ) {

      try {

        state.youtubeWatchPlayer.stopVideo();

      } catch (error) {

        console.warn(
          error
        );

      }

    }


    modal.classList.add(
      "hidden"
    );


    modal.setAttribute(
      "aria-hidden",
      "true"
    );


    const frame =
      $("youtubeFrame");


    if (frame) {

      frame.style.pointerEvents =
        "none";

    }

  }


  /* =====================================================
     PLAYER INFO
     ===================================================== */

  function updatePlayerInfo(
    song
  ) {

    if (!song) {
      return;
    }


    const title =
      song.title ||
      "Nothing playing";


    const artist =
      song.artist ||
      "SwarAJ";


    const cover =
      song.cover_url ||
      song.coverUrl ||
      "/images/default-cover.jpg";


    const titleElement =
      $("playerTitle");


    const artistElement =
      $("playerArtist");


    const coverElement =
      $("playerCover");


    if (titleElement) {

      titleElement.textContent =
        title;

    }


    if (artistElement) {

      artistElement.textContent =
        artist;

    }


    if (coverElement) {

      if (
        coverElement.tagName ===
        "IMG"
      ) {

        coverElement.src =
          cover;

      } else {

        coverElement.innerHTML = `

          <img
            src="${escapeHTML(cover)}"
            alt="${escapeHTML(title)}"
            onerror="this.style.display='none'"
          >

        `;

      }

    }


    const watchButton =
      $("watchBtn");


    if (
      watchButton
    ) {

      if (
        isYouTubeSong(song)
      ) {

        watchButton.hidden =
          false;

      } else {

        watchButton.hidden =
          true;

      }

    }


    document.title =
      `${title} • SwarAJ`;

  }


  /* =====================================================
     PLAY BUTTON UI
     ===================================================== */

  function updatePlayButton(
    playing
  ) {

    const button =
      $("playBtn");


    if (!button) {
      return;
    }


    button.textContent =
      playing
        ? "❚❚"
        : "▶";


    button.title =
      playing
        ? "Pause"
        : "Play";

  }


  /* =====================================================
     CURRENT SONG UI
     ===================================================== */

  function updateSongPlayingState() {

    const currentId =
      state.currentSong
        ? getSongId(
            state.currentSong
          )
        : null;


    let playing = false;


    if (
      state.currentSong &&
      isYouTubeSong(
        state.currentSong
      )
    ) {

      if (
        state.youtubePlayer &&
        window.YT
      ) {

        try {

          playing =
            state.youtubePlayer.getPlayerState() ===
            YT.PlayerState.PLAYING;

        } catch {

          playing = false;

        }

      }

    } else {

      playing =
        Boolean(
          audio &&
          !audio.paused
        );

    }


    document
      .querySelectorAll(
        ".song-card"
      )
      .forEach(
        card => {

          card.classList.toggle(
            "playing",
            Boolean(
              currentId &&
              card.dataset.songId ===
              currentId &&
              playing
            )
          );

        }
      );


    updatePlayButton(
      playing
    );

  }


  /* =====================================================
     SONG COUNT
     ===================================================== */

  function updateSongCount() {

    const element =
      $("songCount");


    if (!element) {
      return;
    }


    const count =
      state.filteredSongs.length;


    element.textContent =
      `${count} ${
        count === 1
          ? "song"
          : "songs"
      }`;

  }


  /* =====================================================
     SEARCH
     ===================================================== */

  function setupSearch() {

    const input =
      $("searchInput");


    const clear =
      $("clearSearch");


    if (!input) {
      return;
    }


    input.addEventListener(
      "input",
      () => {

        state.search =
          input.value;


        if (clear) {

          clear.hidden =
            !input.value;

        }


        applyFilters();

      }
    );


    clear?.addEventListener(
      "click",
      () => {

        input.value = "";

        state.search = "";

        clear.hidden = true;

        applyFilters();

        input.focus();

      }
    );

  }


  /* =====================================================
     CATEGORY EVENTS
     ===================================================== */

  function setupCategories() {

    const bar =
      $("categoryBar");


    if (!bar) {
      return;
    }


    bar.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-category]"
          );


        if (!button) {
          return;
        }


        event.preventDefault();


        selectCategory(
          button.dataset.category
        );

      }
    );

  }


  /* =====================================================
     PLAYER EVENTS
     ===================================================== */

  function setupPlayer() {

    $("playBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        togglePlay();

      }
    );


    $("prevBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        previousSong();

      }
    );


    $("nextBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        nextSong();

      }
    );


    $("shuffleBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        state.shuffle =
          !state.shuffle;


        event.currentTarget.classList.toggle(
          "active",
          state.shuffle
        );

      }
    );


    $("repeatBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        state.repeat =
          !state.repeat;


        event.currentTarget.classList.toggle(
          "active",
          state.repeat
        );

      }
    );


    $("watchBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        if (
          state.currentSong
        ) {

          watchSong(
            state.currentSong
          );

        }

      }
    );


    $("videoClose")?.addEventListener(
      "click",
      event => {

        event.preventDefault();

        closeVideo();

      }
    );


    $("videoModal")?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          event.currentTarget
        ) {

          closeVideo();

        }

      }
    );


    $("muteBtn")?.addEventListener(
      "click",
      () => {

        if (!audio) {
          return;
        }


        audio.muted =
          !audio.muted;


        $("muteBtn").textContent =
          audio.muted
            ? "🔇"
            : "🔊";

      }
    );


    $("volumeBar")?.addEventListener(
      "input",
      event => {

        if (!audio) {
          return;
        }


        audio.volume =
          Number(
            event.target.value
          );


        if (
          audio.volume > 0
        ) {

          audio.muted = false;

          $("muteBtn").textContent =
            "🔊";

        }

      }
    );


    $("seekBar")?.addEventListener(
      "input",
      event => {

        if (
          !audio ||
          !Number.isFinite(
            audio.duration
          )
        ) {
          return;
        }


        audio.currentTime =
          (
            Number(
              event.target.value
            ) / 100
          ) *
          audio.duration;

      }
    );

  }


  /* =====================================================
     LOCAL AUDIO EVENTS
     ===================================================== */

  function setupAudioEvents() {

    if (!audio) {
      return;
    }


    audio.addEventListener(
      "play",
      () => {

        updatePlayButton(
          true
        );

        updateSongPlayingState();

      }
    );


    audio.addEventListener(
      "pause",
      () => {

        updatePlayButton(
          false
        );

        updateSongPlayingState();

      }
    );


    audio.addEventListener(
      "timeupdate",
      () => {

        const current =
          $("currentTime");


        const seek =
          $("seekBar");


        if (current) {

          current.textContent =
            formatTime(
              audio.currentTime
            );

        }


        if (
          seek &&
          Number.isFinite(
            audio.duration
          ) &&
          audio.duration > 0
        ) {

          seek.value =
            (
              audio.currentTime /
              audio.duration
            ) *
            100;

        }

      }
    );


    audio.addEventListener(
      "loadedmetadata",
      () => {

        const duration =
          $("duration");


        if (duration) {

          duration.textContent =
            formatTime(
              audio.duration
            );

        }

      }
    );


    audio.addEventListener(
      "ended",
      () => {

        if (
          state.repeat
        ) {

          audio.currentTime = 0;

          audio
            .play()
            .catch(console.error);

        } else {

          nextSong();

        }

      }
    );


    audio.addEventListener(
      "error",
      () => {

        console.error(
          "SwarAJ audio error:",
          audio.error
        );


        showToast(
          "Unable to play audio"
        );

      }
    );

  }


  /* =====================================================
     REFRESH
     ===================================================== */

  function setupRefresh() {

    $("refreshBtn")?.addEventListener(
      "click",
      async () => {

        await loadSongs();

        showToast(
          "Songs refreshed"
        );

      }
    );

  }


  /* =====================================================
     LIKES
     ===================================================== */

  function setupLikes() {

    const saved =
      localStorage.getItem(
        "swaraj-liked"
      );


    if (saved) {

      try {

        const array =
          JSON.parse(
            saved
          );


        if (
          Array.isArray(array)
        ) {

          state.liked =
            new Set(
              array.map(
                String
              )
            );

        }

      } catch {

        state.liked =
          new Set();

      }

    }


    $("likeBtn")?.addEventListener(
      "click",
      event => {

        event.preventDefault();


        const song =
          state.currentSong;


        if (!song) {
          return;
        }


        const id =
          getSongId(song);


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


        updateLikeButton();

      }
    );


    updateLikeButton();

  }


  function updateLikeButton() {

    const button =
      $("likeBtn");


    if (!button) {
      return;
    }


    const liked =
      state.currentSong &&
      state.liked.has(
        getSongId(
          state.currentSong
        )
      );


    button.textContent =
      liked
        ? "♥"
        : "♡";


    button.classList.toggle(
      "active",
      Boolean(liked)
    );

  }


  /* =====================================================
     MEDIA SESSION
     ===================================================== */

  function setupMediaSession() {

    if (
      !("mediaSession" in navigator)
    ) {
      return;
    }


    try {

      navigator.mediaSession.setActionHandler(
        "play",
        () => togglePlay()
      );


      navigator.mediaSession.setActionHandler(
        "pause",
        () => togglePlay()
      );


      navigator.mediaSession.setActionHandler(
        "nexttrack",
        () => nextSong()
      );


      navigator.mediaSession.setActionHandler(
        "previoustrack",
        () => previousSong()
      );

    } catch (error) {

      console.warn(
        "Media Session:",
        error
      );

    }

  }


  function updateMediaSession(
    song
  ) {

    if (
      !("mediaSession" in navigator) ||
      !song
    ) {
      return;
    }


    try {

      navigator.mediaSession.metadata =
        new MediaMetadata({

          title:
            song.title ||
            "SwarAJ",

          artist:
            song.artist ||
            "SwarAJ",

          album:
            song.album ||
            "SwarAJ",

          artwork: [

            {
              src:
                song.cover_url ||
                "/images/default-cover.jpg"
            }

          ]

        });

    } catch (error) {

      console.warn(
        error
      );

    }

  }


  /* =====================================================
     MOBILE NAV
     ===================================================== */

  function setupNavigation() {

    const sidebar =
      $("sidebar");


    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              document
                .querySelectorAll(
                  ".nav-item"
                )
                .forEach(
                  item =>
                    item.classList.remove(
                      "active"
                    )
                );


              button.classList.add(
                "active"
              );


              const view =
                button.dataset.view;


              if (
                view ===
                "liked"
              ) {

                state.filteredSongs =
                  state.songs.filter(
                    song =>
                      state.liked.has(
                        getSongId(
                          song
                        )
                      )
                  );


                renderSongs();

              } else {

                state.category =
                  "All";

                state.search =
                  "";


                const search =
                  $("searchInput");


                if (search) {
                  search.value = "";
                }


                buildCategories();

                applyFilters();

              }


              sidebar?.classList.remove(
                "open"
              );

            }
          );

        }
      );

  }


  /* =====================================================
     TOAST
     ===================================================== */

  let toastTimer = null;


  function showToast(
    message
  ) {

    const toast =
      $("toast");


    if (!toast) {
      return;
    }


    toast.textContent =
      message;


    toast.classList.add(
      "show"
    );


    clearTimeout(
      toastTimer
    );


    toastTimer =
      setTimeout(
        () => {

          toast.classList.remove(
            "show"
          );

        },
        2200
      );

  }


  /* =====================================================
     KEYBOARD
     ===================================================== */

  function setupKeyboard() {

    document.addEventListener(
      "keydown",
      event => {

        const tag =
          event.target?.tagName;


        if (
          tag === "INPUT" ||
          tag === "TEXTAREA"
        ) {
          return;
        }


        if (
          event.code ===
          "Space"
        ) {

          event.preventDefault();

          togglePlay();

        }


        if (
          event.code ===
          "ArrowRight"
        ) {

          nextSong();

        }


        if (
          event.code ===
          "ArrowLeft"
        ) {

          previousSong();

        }

      }
    );

  }


  /* =====================================================
     INIT
     ===================================================== */

  async function init() {

    if (
      state.initialized
    ) {
      return;
    }


    state.initialized =
      true;


    /*
     * Start loading YouTube API
     * immediately.
     */

    loadYouTubeAPI();


    setupSearch();

    setupCategories();

    setupPlayer();

    setupAudioEvents();

    setupRefresh();

    setupLikes();

    setupMediaSession();

    setupNavigation();

    setupKeyboard();


    await loadSongs();


    updatePlayButton(
      false
    );


    console.log(
      "SwarAJ A-Z player initialized"
    );

  }


  /* =====================================================
     GLOBAL API
     ===================================================== */

  window.SwarAJPlayer = {

    state,

    playSong,

    nextSong,

    previousSong,

    togglePlay,

    watchSong,

    closeVideo,

    selectCategory,

    loadSongs,

    getYouTubeId,

    isYouTubeSong

  };


  /* =====================================================
     START
     ===================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();

  }

})();