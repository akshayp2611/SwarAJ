(() => {
  "use strict";

  const state = {
    songs: [],
    currentIndex: -1,

    liked: JSON.parse(
      localStorage.getItem("swaraj-liked") || "[]"
    ),

    playlist: JSON.parse(
      localStorage.getItem("swaraj-playlist") || "[]"
    ),

    adminKey: null,

    youtubeReady: false,
    youtubePlayer: null,
    youtubeVideoId: null,
    youtubeVisible: false,

    isPlaying: false,
    progressTimer: null,

    selectedCategory: null
  };


  const $ = id =>
    document.getElementById(id);


  const audio =
    $("audioPlayer");


  const DEFAULT_COVER =
    "/images/default-cover.jpg";


  /* =====================================================
     HELPERS
  ===================================================== */

  function exists(id) {
    return !!$(id);
  }


  function setText(id, value) {
    if ($(id)) {
      $(id).textContent = value;
    }
  }


  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  /* =====================================================
     3D LIQUID LOGO
  ===================================================== */

  function createLiquidLogo() {

    document
      .querySelectorAll(".logo-disc")
      .forEach(logo => {

        if (logo.dataset.liquidReady) {
          return;
        }

        logo.dataset.liquidReady =
          "true";

        logo.innerHTML = `
          <div class="liquid-logo-mini">

            <span
              class="liquid-bubble bubble-one"
            ></span>

            <span
              class="liquid-bubble bubble-two"
            ></span>

            <span
              class="liquid-bubble bubble-three"
            ></span>

            <div class="liquid-logo-letter">
              स्व
            </div>

          </div>
        `;
      });


    document
      .querySelectorAll(".hero-disc")
      .forEach(logo => {

        if (logo.dataset.liquidReady) {
          return;
        }

        logo.dataset.liquidReady =
          "true";

        logo.innerHTML = `
          <div class="liquid-orb">

            <i></i>
            <i></i>
            <i></i>

            <div class="orb-letter">
              स्व
            </div>

          </div>
        `;
      });
  }


  /* =====================================================
     YOUTUBE API
  ===================================================== */

  window.onYouTubeIframeAPIReady =
    function () {

      state.youtubeReady =
        true;

      const container =
        $("youtubeFrame");

      if (!container) {
        return;
      }


      state.youtubePlayer =
        new YT.Player(
          "youtubeFrame",
          {

            width: "100%",
            height: "100%",

            videoId: "",

            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              modestbranding: 1,
              playsinline: 1
            },

            events: {

              onReady: () => {},

              onStateChange:
                event => {

                  if (
                    event.data ===
                    YT.PlayerState.PLAYING
                  ) {

                    state.isPlaying =
                      true;

                    updatePlayButtons();

                    startProgress();
                  }


                  if (
                    event.data ===
                    YT.PlayerState.PAUSED
                  ) {

                    state.isPlaying =
                      false;

                    updatePlayButtons();
                  }


                  if (
                    event.data ===
                    YT.PlayerState.ENDED
                  ) {

                    nextSong();
                  }
                }
            }
          }
        );
    };


  /* =====================================================
     YOUTUBE ID
  ===================================================== */

  function getYouTubeId(url) {

    if (!url) {
      return null;
    }


    const value =
      String(url).trim();


    if (
      /^[a-zA-Z0-9_-]{11}$/
        .test(value)
    ) {
      return value;
    }


    try {

      const parsed =
        new URL(value);


      if (
        parsed.hostname
          .includes("youtu.be")
      ) {

        return parsed.pathname
          .replace("/", "")
          .substring(0, 11);
      }


      if (
        parsed.hostname
          .includes("youtube.com") ||

        parsed.hostname
          .includes("youtube-nocookie.com")
      ) {

        const v =
          parsed.searchParams
            .get("v");

        if (v) {
          return v.substring(0, 11);
        }


        const parts =
          parsed.pathname
            .split("/");


        const embed =
          parts.indexOf("embed");


        if (
          embed >= 0 &&
          parts[embed + 1]
        ) {

          return parts[
            embed + 1
          ].substring(0, 11);
        }


        const shorts =
          parts.indexOf("shorts");


        if (
          shorts >= 0 &&
          parts[shorts + 1]
        ) {

          return parts[
            shorts + 1
          ].substring(0, 11);
        }
      }

    } catch (_) {}


    return null;
  }


  /* =====================================================
     NORMALIZE SONG
  ===================================================== */

  function normalizeSong(song) {

    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      song.video_url ||
      song.videoUrl ||
      "";


    const audioUrl =
      song.audio_url ||
      song.audioUrl ||
      song.file_url ||
      song.fileUrl ||
      song.url ||
      "";


    const isYouTube =
      song.type === "youtube" ||
      song.source === "youtube" ||
      song.source_type === "youtube" ||
      !!getYouTubeId(youtubeUrl);


    return {

      id: String(
        song.id ||
        crypto.randomUUID()
      ),


      title:
        song.title ||
        song.name ||
        "Unknown Song",


      artist:
        song.artist ||
        song.singer ||
        "Unknown Artist",


      category:
        song.category ||
        "Music",


      cover:
        song.cover ||
        song.cover_url ||
        song.coverUrl ||
        DEFAULT_COVER,


      type:
        isYouTube
          ? "youtube"
          : "mp3",


      youtubeUrl:
        isYouTube
          ? youtubeUrl
          : "",


      youtubeId:
        isYouTube
          ? (
              getYouTubeId(
                youtubeUrl
              ) ||
              song.youtube_id ||
              song.youtubeId
            )
          : null,


      audioUrl:
        audioUrl
    };
  }


  /* =====================================================
     LOAD SONGS
  ===================================================== */

  async function loadSongs() {

    const containers = [
      "recentSongs",
      "mp3Playlist",
      "videoPlaylist",
      "favoritesList",
      "categorySongs",
      "playlistList",
      "adminSongList"
    ];


    containers.forEach(id => {

      if ($(id)) {

        $(id).innerHTML =
          `
            <div class="loading">
              Loading music...
            </div>
          `;
      }
    });


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


      const songs =
        Array.isArray(data)
          ? data
          : Array.isArray(data.songs)
            ? data.songs
            : Array.isArray(data.data)
              ? data.data
              : [];


      state.songs =
        songs.map(normalizeSong);


      renderAll();

    } catch (error) {

      console.error(
        "Song loading failed:",
        error
      );


      containers.forEach(id => {

        if ($(id)) {

          $(id).innerHTML =
            `
              <div class="loading">
                Unable to load songs
              </div>
            `;
        }
      });
    }
  }


  /* =====================================================
     RENDER ALL
  ===================================================== */

  function renderAll() {

    const mp3Songs =
      state.songs.filter(
        song =>
          song.type === "mp3"
      );


    const youtubeSongs =
      state.songs.filter(
        song =>
          song.type === "youtube"
      );


    const categories =
      [
        ...new Set(
          state.songs.map(
            song =>
              song.category ||
              "Music"
          )
        )
      ];


    setText(
      "mp3Count",
      mp3Songs.length
    );


    setText(
      "videoCount",
      youtubeSongs.length
    );


    setText(
      "categoryCount",
      categories.length
    );


    renderSongs(
      state.songs.slice(0, 8),
      $("recentSongs")
    );


    renderSongs(
      state.songs,
      $("mp3Playlist")
    );


    renderSongs(
      youtubeSongs,
      $("videoPlaylist")
    );


    renderLiked();

    renderCategories();

    renderPlaylist();

    renderAdminSongs();


    const query =
      $("searchInput")
        ?.value
        ?.trim()
        .toLowerCase();


    if (query) {
      renderSearch(query);
    }
  }


  /* =====================================================
     SONG CARDS
  ===================================================== */

  function renderSongs(
    songs,
    container
  ) {

    if (!container) {
      return;
    }


    if (!songs.length) {

      container.innerHTML =
        `
          <div class="loading">
            No songs found
          </div>
        `;

      return;
    }


    container.innerHTML =
      songs.map(song => {

        const index =
          state.songs.findIndex(
            item =>
              item.id === song.id
          );


        const liked =
          state.liked.includes(
            String(song.id)
          );


        return `

          <div
            class="
              song-card
              ${index === state.currentIndex
                ? "playing"
                : ""}
            "
            data-song-index="${index}"
          >

            <div class="song-image-wrap">

              <img
                src="${escapeHtml(
                  song.cover ||
                  DEFAULT_COVER
                )}"
                onerror="
                  this.src='${DEFAULT_COVER}'
                "
                alt=""
              >


              <button
                class="song-card-play"
                data-play="${index}"
              >
                ${
                  index ===
                    state.currentIndex &&
                  state.isPlaying
                    ? "❚❚"
                    : "▶"
                }
              </button>

            </div>


            <div class="song-card-info">

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

              <small>
                ${escapeHtml(
                  song.category
                )}
                ·
                ${
                  song.type === "youtube"
                    ? "YouTube"
                    : "MP3"
                }
              </small>

            </div>


            <button
              class="
                song-like
                ${liked ? "liked" : ""}
              "
              data-like="${escapeHtml(
                song.id
              )}"
              title="Like"
            >
              ${liked ? "♥" : "♡"}
            </button>

          </div>

        `;
      }).join("");


    container
      .querySelectorAll(
        "[data-play]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            playSong(
              Number(
                button.dataset.play
              )
            );
          }
        );
      });


    container
      .querySelectorAll(
        "[data-like]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            toggleLike(
              button.dataset.like
            );
          }
        );
      });


    container
      .querySelectorAll(
        "[data-song-index]"
      )
      .forEach(card => {

        card.addEventListener(
          "click",
          () => {

            playSong(
              Number(
                card.dataset.songIndex
              )
            );
          }
        );
      });
  }


  /* =====================================================
     LIKED
  ===================================================== */

  function renderLiked() {

    const songs =
      state.songs.filter(
        song =>
          state.liked.includes(
            String(song.id)
          )
      );


    renderSongs(
      songs,
      $("favoritesList")
    );
  }


  function toggleLike(songId) {

    const id =
      String(songId);


    if (
      state.liked.includes(id)
    ) {

      state.liked =
        state.liked.filter(
          item =>
            item !== id
        );

    } else {

      state.liked.push(id);
    }


    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        state.liked
      )
    );


    renderAll();
  }


  /* =====================================================
     PLAYLIST
  ===================================================== */

  function renderPlaylist() {

    const songs =
      state.songs.filter(
        song =>
          state.playlist.includes(
            String(song.id)
          )
      );


    renderSongs(
      songs,
      $("playlistList")
    );
  }


  function togglePlaylist(songId) {

    const id =
      String(songId);


    if (
      state.playlist.includes(id)
    ) {

      state.playlist =
        state.playlist.filter(
          item =>
            item !== id
        );

    } else {

      state.playlist.push(id);
    }


    localStorage.setItem(
      "swaraj-playlist",
      JSON.stringify(
        state.playlist
      )
    );


    renderPlaylist();
  }


  /* =====================================================
     CATEGORIES
  ===================================================== */

  function renderCategories() {

    const container =
      $("categoriesGrid");


    if (!container) {
      return;
    }


    const categories =
      [
        ...new Set(
          state.songs.map(
            song =>
              song.category ||
              "Music"
          )
        )
      ];


    if (!categories.length) {

      container.innerHTML =
        `
          <div class="loading">
            No categories found
          </div>
        `;

      return;
    }


    container.innerHTML =
      categories.map(
        category => {

          const count =
            state.songs.filter(
              song =>
                (
                  song.category ||
                  "Music"
                ) === category
            ).length;


          return `

            <button
              class="category-card"
              data-category="${escapeHtml(
                category
              )}"
            >

              <strong>
                ${escapeHtml(
                  category
                )}
              </strong>

              <span>
                ${count} songs
              </span>

            </button>

          `;
        }
      ).join("");


    container
      .querySelectorAll(
        "[data-category]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            state.selectedCategory =
              button.dataset.category;


            const songs =
              state.songs.filter(
                song =>
                  (
                    song.category ||
                    "Music"
                  ) ===
                  state.selectedCategory
              );


            renderSongs(
              songs,
              $("categorySongs")
            );
          }
        );
      });
  }


  /* =====================================================
     SEARCH
  ===================================================== */

  function renderSearch(query) {

    const container =
      $("searchResults");


    if (!container) {
      return;
    }


    const songs =
      state.songs.filter(
        song => {

          const text = `
            ${song.title}
            ${song.artist}
            ${song.category}
          `.toLowerCase();


          return text.includes(
            query
          );
        }
      );


    renderSongs(
      songs,
      container
    );
  }


  /* =====================================================
     PLAY SONG
  ===================================================== */

  async function playSong(index) {

    if (
      index < 0 ||
      index >= state.songs.length
    ) {
      return;
    }


    const song =
      state.songs[index];


    stopCurrent();


    state.currentIndex =
      index;


    updatePlayerInfo(
      song
    );


    showMiniPlayer();


    if (
      song.type === "youtube"
    ) {

      await playYouTubeSong(
        song
      );

    } else {

      playMp3Song(
        song
      );
    }


    renderAll();
  }


  /* =====================================================
     MP3
  ===================================================== */

  function playMp3Song(song) {

    hideYouTube();


    if (!song.audioUrl) {

      console.error(
        "MP3 URL missing:",
        song
      );

      return;
    }


    audio.src =
      song.audioUrl;


    audio.currentTime =
      0;


    const promise =
      audio.play();


    if (promise) {

      promise
        .then(() => {

          state.isPlaying =
            true;

          updatePlayButtons();

          startProgress();
        })

        .catch(error => {

          console.error(
            "MP3 playback failed:",
            error
          );

          state.isPlaying =
            false;

          updatePlayButtons();
        });
    }
  }


  /* =====================================================
     YOUTUBE
  ===================================================== */

  async function playYouTubeSong(
    song
  ) {

    const videoId =
      song.youtubeId ||
      getYouTubeId(
        song.youtubeUrl
      );


    if (!videoId) {

      alert(
        "Invalid YouTube URL."
      );

      return;
    }


    if (!state.youtubeReady) {

      alert(
        "YouTube player is still loading. Please try again."
      );

      return;
    }


    if (!state.youtubePlayer) {

      alert(
        "YouTube player is unavailable. Refresh the page."
      );

      return;
    }


    state.youtubeVideoId =
      videoId;


    audio.pause();

    audio.removeAttribute(
      "src"
    );

    audio.load();


    const area =
      $("videoPlayerArea");


    if (area) {
      area.hidden = false;
    }


    try {

      state.youtubePlayer
        .loadVideoById(
          videoId
        );


      state.youtubePlayer
        .playVideo();

    } catch (error) {

      console.error(
        "YouTube playback failed:",
        error
      );
    }


    state.isPlaying =
      true;


    updatePlayButtons();

    startProgress();
  }


  /* =====================================================
     STOP
  ===================================================== */

  function stopCurrent() {

    audio.pause();


    if (
      state.youtubePlayer
    ) {

      try {

        state.youtubePlayer
          .stopVideo();

      } catch (_) {}
    }


    state.isPlaying =
      false;


    stopProgress();
  }


  /* =====================================================
     YOUTUBE VISIBILITY
  ===================================================== */

  function showYouTube() {

    const frame =
      $("youtubeFrame");


    if (!frame) {
      return;
    }


    frame.hidden =
      false;


    state.youtubeVisible =
      true;
  }


  function hideYouTube() {

    const frame =
      $("youtubeFrame");


    if (!frame) {
      return;
    }


    frame.hidden =
      true;


    state.youtubeVisible =
      false;
  }


  /* =====================================================
     NEXT
  ===================================================== */

  function nextSong() {

    if (!state.songs.length) {
      return;
    }


    let next =
      state.currentIndex + 1;


    if (
      next >= state.songs.length
    ) {
      next = 0;
    }


    playSong(next);
  }


  /* =====================================================
     PREVIOUS
  ===================================================== */

  function previousSong() {

    if (!state.songs.length) {
      return;
    }


    const current =
      state.songs[
        state.currentIndex
      ];


    let currentTime =
      0;


    if (
      current?.type === "youtube"
    ) {

      try {

        currentTime =
          state.youtubePlayer
            ?.getCurrentTime() ||
          0;

      } catch (_) {}

    } else {

      currentTime =
        audio.currentTime ||
        0;
    }


    if (currentTime > 3) {

      if (
        current.type === "youtube"
      ) {

        state.youtubePlayer
          .seekTo(
            0,
            true
          );

        state.youtubePlayer
          .playVideo();

      } else {

        audio.currentTime =
          0;

        audio.play()
          .catch(
            console.error
          );
      }

      return;
    }


    let previous =
      state.currentIndex - 1;


    if (previous < 0) {

      previous =
        state.songs.length - 1;
    }


    playSong(
      previous
    );
  }


  /* =====================================================
     PLAY / PAUSE
  ===================================================== */

  function togglePlayback() {

    if (
      state.currentIndex < 0
    ) {

      if (state.songs.length) {
        playSong(0);
      }

      return;
    }


    const song =
      state.songs[
        state.currentIndex
      ];


    if (!song) {
      return;
    }


    if (
      song.type === "youtube"
    ) {

      if (!state.youtubePlayer) {
        return;
      }


      if (
        state.isPlaying
      ) {

        state.youtubePlayer
          .pauseVideo();

      } else {

        state.youtubePlayer
          .playVideo();
      }

    } else {

      if (audio.paused) {

        audio.play()
          .then(() => {

            state.isPlaying =
              true;

            updatePlayButtons();
          })

          .catch(
            console.error
          );

      } else {

        audio.pause();
      }
    }
  }


  /* =====================================================
     AUDIO EVENTS
  ===================================================== */

  audio.addEventListener(
    "play",
    () => {

      state.isPlaying =
        true;

      updatePlayButtons();

      startProgress();
    }
  );


  audio.addEventListener(
    "pause",
    () => {

      state.isPlaying =
        false;

      updatePlayButtons();
    }
  );


  audio.addEventListener(
    "ended",
    nextSong
  );


  /* =====================================================
     PROGRESS
  ===================================================== */

  function startProgress() {

    stopProgress();


    state.progressTimer =
      setInterval(
        updateProgress,
        500
      );
  }


  function stopProgress() {

    if (
      state.progressTimer
    ) {

      clearInterval(
        state.progressTimer
      );

      state.progressTimer =
        null;
    }
  }


  function updateProgress() {

    const song =
      state.songs[
        state.currentIndex
      ];


    if (!song) {
      return;
    }


    let current =
      0;

    let duration =
      0;


    if (
      song.type === "youtube"
    ) {

      try {

        current =
          state.youtubePlayer
            ?.getCurrentTime() ||
          0;


        duration =
          state.youtubePlayer
            ?.getDuration() ||
          0;

      } catch (_) {}

    } else {

      current =
        audio.currentTime ||
        0;


      duration =
        audio.duration ||
        0;
    }


    const progress =
      $("progressBar");


    if (
      progress &&
      duration > 0
    ) {

      progress.value =
        (
          current /
          duration
        ) * 100;
    }


    setText(
      "currentTime",
      formatTime(
        current
      )
    );


    setText(
      "duration",
      formatTime(
        duration
      )
    );
  }


  function seekProgress(
    value
  ) {

    const song =
      state.songs[
        state.currentIndex
      ];


    if (!song) {
      return;
    }


    const percentage =
      Number(value) /
      100;


    if (
      song.type === "youtube"
    ) {

      if (
        !state.youtubePlayer
      ) {
        return;
      }


      const duration =
        state.youtubePlayer
          .getDuration();


      state.youtubePlayer
        .seekTo(
          duration *
          percentage,
          true
        );

    } else {

      if (!audio.duration) {
        return;
      }


      audio.currentTime =
        audio.duration *
        percentage;
    }
  }


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


    const minutes =
      Math.floor(
        seconds / 60
      );


    const secs =
      Math.floor(
        seconds % 60
      )
      .toString()
      .padStart(
        2,
        "0"
      );


    return `${minutes}:${secs}`;
  }


  /* =====================================================
     PLAYER INFO
  ===================================================== */

  function updatePlayerInfo(
    song
  ) {

    setText(
      "miniTitle",
      song.title
    );


    setText(
      "miniArtist",
      song.artist
    );


    const image =
      $("miniCover");


    if (image) {

      image.src =
        song.cover ||
        DEFAULT_COVER;


      image.onerror =
        () => {

          image.src =
            DEFAULT_COVER;
        };
    }


    setText(
      "videoPlayerTitle",
      song.title
    );


    setText(
      "playerModeLabel",

      song.type === "youtube"
        ? "YOUTUBE MUSIC"
        : "MP3 MUSIC"
    );
  }


  function updatePlayButtons() {

    const symbol =
      state.isPlaying
        ? "❚❚"
        : "▶";


    [
      "miniPlayButton",
      "videoPlayButton"
    ]
      .forEach(id => {

        if ($(id)) {
          $(id).textContent =
            symbol;
        }
      });


    document
      .querySelectorAll(
        "[data-player='play']"
      )
      .forEach(button => {

        button.textContent =
          symbol;
      });
  }


  /* =====================================================
     MINI PLAYER
  ===================================================== */

  function showMiniPlayer() {

    const player =
      $("miniPlayer");


    if (player) {

      player.classList
        .remove(
          "hidden"
        );
    }
  }


  /* =====================================================
     SIDE DRAWER
  ===================================================== */

  function closeDrawer() {

    const sidebar =
      $("sidebar");


    if (sidebar) {

      sidebar.classList
        .remove(
          "open"
        );
    }


    const overlay =
      $("drawerOverlay");


    if (overlay) {

      overlay.classList
        .remove(
          "active"
        );
    }
  }


  function openDrawer() {

    const sidebar =
      $("sidebar");


    if (sidebar) {

      sidebar.classList
        .add(
          "open"
        );
    }


    const overlay =
      $("drawerOverlay");


    if (overlay) {

      overlay.classList
        .add(
          "active"
        );
    }
  }


  /* =====================================================
     SECTION NAVIGATION
  ===================================================== */

  function showSection(
    section
  ) {

    document
      .querySelectorAll(
        ".page-section"
      )
      .forEach(item => {

        item.classList
          .remove(
            "active"
          );
      });


    const target =
      $(`section-${section}`);


    if (target) {

      target.classList
        .add(
          "active"
        );
    }


    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(item => {

        item.classList.toggle(
          "active",

          item.dataset.section ===
          section
        );
      });


    closeDrawer();


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  document
    .querySelectorAll(
      "[data-section]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showSection(
            button.dataset.section
          );
        }
      );
    });


  /* =====================================================
     MOBILE MENU
  ===================================================== */

  if (
    exists(
      "mobileMenuButton"
    )
  ) {

    $("mobileMenuButton")
      .addEventListener(
        "click",
        () => {

          const sidebar =
            $("sidebar");


          if (
            sidebar?.classList
              .contains("open")
          ) {

            closeDrawer();

          } else {

            openDrawer();
          }
        }
      );
  }


  if (
    exists(
      "drawerOverlay"
    )
  ) {

    $("drawerOverlay")
      .addEventListener(
        "click",
        closeDrawer
      );
  }


  /* =====================================================
     MOBILE SEARCH
  ===================================================== */

  if (
    exists(
      "mobileSearchButton"
    )
  ) {

    $("mobileSearchButton")
      .addEventListener(
        "click",
        () => {

          showSection(
            "search"
          );


          if (
            $("searchInput")
          ) {

            $("searchInput")
              .focus();
          }
        }
      );
  }


  /* =====================================================
     SEARCH
  ===================================================== */

  if (
    exists(
      "searchInput"
    )
  ) {

    $("searchInput")
      .addEventListener(
        "input",
        event => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();


          showSection(
            "search"
          );


          renderSearch(
            query
          );
        }
      );
  }


  /* =====================================================
     HERO PLAY
  ===================================================== */

  if (
    exists(
      "heroPlayButton"
    )
  ) {

    $("heroPlayButton")
      .addEventListener(
        "click",
        () => {

          if (
            !state.songs.length
          ) {
            return;
          }


          playSong(
            state.currentIndex >= 0
              ? state.currentIndex
              : 0
          );
        }
      );
  }


  /* =====================================================
     HERO YOUTUBE
  ===================================================== */

  if (
    exists(
      "heroVideoButton"
    )
  ) {

    $("heroVideoButton")
      .addEventListener(
        "click",
        () => {

          showSection(
            "youtube"
          );


          const index =
            state.songs.findIndex(
              song =>
                song.type ===
                "youtube"
            );


          if (index >= 0) {

            playSong(
              index
            );
          }
        }
      );
  }


  /* =====================================================
     REFRESH
  ===================================================== */

  if (
    exists(
      "refreshButton"
    )
  ) {

    $("refreshButton")
      .addEventListener(
        "click",
        loadSongs
      );
  }


  if (
    exists(
      "adminRefreshButton"
    )
  ) {

    $("adminRefreshButton")
      .addEventListener(
        "click",
        loadSongs
      );
  }


  /* =====================================================
     MINI PLAYER
  ===================================================== */

  document
    .querySelectorAll(
      "[data-player]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const action =
            button.dataset.player;


          if (
            action ===
            "previous"
          ) {

            previousSong();
          }


          if (
            action ===
            "play"
          ) {

            togglePlayback();
          }


          if (
            action ===
            "next"
          ) {

            nextSong();
          }
        }
      );
    });


  /* =====================================================
     VIDEO CONTROLS
  ===================================================== */

  if (
    exists(
      "watchVideoButton"
    )
  ) {

    $("watchVideoButton")
      .addEventListener(
        "click",
        showYouTube
      );
  }


  if (
    exists(
      "videoPrevButton"
    )
  ) {

    $("videoPrevButton")
      .addEventListener(
        "click",
        previousSong
      );
  }


  if (
    exists(
      "videoNextButton"
    )
  ) {

    $("videoNextButton")
      .addEventListener(
        "click",
        nextSong
      );
  }


  if (
    exists(
      "videoPlayButton"
    )
  ) {

    $("videoPlayButton")
      .addEventListener(
        "click",
        togglePlayback
      );
  }


  if (
    exists(
      "progressBar"
    )
  ) {

    $("progressBar")
      .addEventListener(
        "input",
        event => {

          seekProgress(
            event.target.value
          );
        }
      );
  }


  /* =====================================================
     ADMIN LOGIN
  ===================================================== */

  if (
    exists(
      "adminLoginForm"
    )
  ) {

    $("adminLoginForm")
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const key =
            $("adminKey")
              .value
              .trim();


          if (!key) {

            setText(
              "adminLoginMessage",
              "Enter admin key."
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
                      "application/json"
                  },

                  body:
                    JSON.stringify({
                      key
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
                data.message ||
                "Invalid admin key"
              );
            }


            state.adminKey =
              key;


            $("adminLogin")
              .classList
              .add(
                "hidden"
              );


            $("adminContent")
              .classList
              .remove(
                "hidden"
              );


            setText(
              "adminLoginMessage",
              ""
            );


            renderAdminSongs();

          } catch (error) {

            setText(
              "adminLoginMessage",

              error.message ||
              "Admin authentication failed."
            );
          }
        }
      );
  }


  /* =====================================================
     ADMIN LOGOUT
  ===================================================== */

  if (
    exists(
      "adminLogoutButton"
    )
  ) {

    $("adminLogoutButton")
      .addEventListener(
        "click",
        () => {

          state.adminKey =
            null;


          $("adminContent")
            .classList
            .add(
              "hidden"
            );


          $("adminLogin")
            .classList
            .remove(
              "hidden"
            );


          if (
            exists(
              "adminKey"
            )
          ) {

            $("adminKey").value =
              "";
          }
        }
      );
  }


  /* =====================================================
     ADMIN YOUTUBE UPLOAD
  ===================================================== */

  if (
    exists(
      "youtubeUploadForm"
    )
  ) {

    $("youtubeUploadForm")
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          if (!state.adminKey) {

            setText(
              "youtubeUploadStatus",
              "Admin authentication required."
            );

            return;
          }


          const url =
            $("youtubeUrl")
              .value
              .trim();


          const videoId =
            getYouTubeId(
              url
            );


          if (!videoId) {

            setText(
              "youtubeUploadStatus",
              "Invalid YouTube URL."
            );

            return;
          }


          try {

            const response =
              await fetch(
                "/api/admin/songs",
                {
                  method: "POST",

                  headers: {

                    "Content-Type":
                      "application/json",

                    "Authorization":
                      `Bearer ${state.adminKey}`
                  },

                  body:
                    JSON.stringify({

                      title:
                        $("youtubeTitle")
                          .value
                          .trim(),

                      artist:
                        $("youtubeArtist")
                          .value
                          .trim(),

                      category:
                        $("youtubeCategory")
                          .value
                          .trim(),

                      cover:
                        $("youtubeCover")
                          .value
                          .trim(),

                      type:
                        "youtube",

                      source:
                        "youtube",

                      youtube_url:
                        url,

                      youtubeUrl:
                        url,

                      youtube_id:
                        videoId
                    })
                }
              );


            const data =
              await response.json();


            if (!response.ok) {

              throw new Error(
                data.message ||
                "Upload failed"
              );
            }


            setText(
              "youtubeUploadStatus",
              "YouTube song added successfully."
            );


            event.target.reset();


            $("youtubeArtist")
              .value =
              "YouTube";


            $("youtubeCategory")
              .value =
              "Other";


            await loadSongs();

          } catch (error) {

            console.error(
              error
            );


            setText(
              "youtubeUploadStatus",
              error.message
            );
          }
        }
      );
  }


  /* =====================================================
     ADMIN MP3 UPLOAD
  ===================================================== */

  if (
    exists(
      "mp3UploadForm"
    )
  ) {

    $("mp3UploadForm")
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          if (!state.adminKey) {

            setText(
              "mp3UploadStatus",
              "Admin authentication required."
            );

            return;
          }


          const file =
            $("mp3File")
              ?.files
              ?. [0];


          if (!file) {

            setText(
              "mp3UploadStatus",
              "Select an MP3 file."
            );

            return;
          }


          try {

            const formData =
              new FormData();


            formData.append(
              "title",

              $("uploadTitle")
                .value
                .trim()
            );


            formData.append(
              "artist",

              $("uploadArtist")
                .value
                .trim()
            );


            formData.append(
              "category",

              $("uploadCategory")
                .value
                .trim()
            );


            formData.append(
              "file",
              file
            );


            const response =
              await fetch(
                "/api/admin/upload",
                {
                  method: "POST",

                  headers: {

                    "Authorization":
                      `Bearer ${state.adminKey}`
                  },

                  body:
                    formData
                }
              );


            const data =
              await response.json();


            if (!response.ok) {

              throw new Error(
                data.message ||
                "MP3 upload failed"
              );
            }


            setText(
              "mp3UploadStatus",
              "MP3 uploaded successfully."
            );


            event.target.reset();


            $("uploadArtist")
              .value =
              "SwarAJ";


            $("uploadCategory")
              .value =
              "Other";


            await loadSongs();

          } catch (error) {

            console.error(
              error
            );


            setText(
              "mp3UploadStatus",
              error.message
            );
          }
        }
      );
  }


  /* =====================================================
     ADMIN LIBRARY
  ===================================================== */

  function renderAdminSongs() {

    const container =
      $("adminSongList");


    if (!container) {
      return;
    }


    if (!state.songs.length) {

      container.innerHTML =
        `
          <div class="loading">
            No songs found
          </div>
        `;

      return;
    }


    container.innerHTML =
      state.songs
        .map(song => {

          return `

            <div
              class="admin-song-row"
            >

              <img
                src="${escapeHtml(
                  song.cover ||
                  DEFAULT_COVER
                )}"
                onerror="
                  this.src='${DEFAULT_COVER}'
                "
                alt=""
              >


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
                  ${
                    song.type ===
                    "youtube"
                      ? "YouTube"
                      : "MP3"
                  }
                </small>

              </div>

            </div>

          `;
        })
        .join("");
  }


  /* =====================================================
     INITIALIZE
  ===================================================== */

  createLiquidLogo();

  loadSongs();

})();