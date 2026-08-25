(() => {

  "use strict";


  /* ==========================================
     STATE
  ========================================== */

  const state = {

    songs: [],

    currentIndex: -1,

    liked:
      JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
      ),

    adminKey: null,

    youtubeReady: false,

    youtubePlayer: null,

    youtubeVideoId: null,

    isPlaying: false,

    progressTimer: null,

    selectedCategory: "all"

  };


  /* ==========================================
     HELPERS
  ========================================== */

  const $ = id =>
    document.getElementById(id);


  const audio =
    $("audioPlayer");


  const DEFAULT_COVER =
    "/images/default-cover.jpg";


  /* ==========================================
     CATEGORY DESIGN
  ========================================== */

  const CATEGORY_META = {

    all: {
      icon: "✦",
      colors: [
        "#7c5cff",
        "#00bfe5"
      ]
    },

    bhakti: {
      icon: "🕉️",
      colors: [
        "#ff7a18",
        "#af002d"
      ]
    },

    love: {
      icon: "❤️",
      colors: [
        "#ff3cac",
        "#784ba0"
      ]
    },

    marathi: {
      icon: "🚩",
      colors: [
        "#ff512f",
        "#f09819"
      ]
    },

    energetic: {
      icon: "⚡",
      colors: [
        "#f7971e",
        "#ffd200"
      ]
    },

    emotional: {
      icon: "💜",
      colors: [
        "#654ea3",
        "#eaafc8"
      ]
    },

    chill: {
      icon: "🌊",
      colors: [
        "#00c6ff",
        "#0072ff"
      ]
    },

    party: {
      icon: "🎉",
      colors: [
        "#f953c6",
        "#b91d73"
      ]
    },

    instrumental: {
      icon: "🎧",
      colors: [
        "#11998e",
        "#38ef7d"
      ]
    },

    devotional: {
      icon: "🙏",
      colors: [
        "#f46b45",
        "#eea849"
      ]
    },

    youtube: {
      icon: "▶️",
      colors: [
        "#ff0000",
        "#8b0000"
      ]
    },

    mp3: {
      icon: "♫",
      colors: [
        "#00e5ff",
        "#7c5cff"
      ]
    }

  };


  /* ==========================================
     YOUTUBE
  ========================================== */

  window.onYouTubeIframeAPIReady = function(){

    state.youtubeReady = true;


    state.youtubePlayer =
      new YT.Player(
        "youtubePlayer",
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


            onStateChange: event => {

              if (
                !state.songs[
                  state.currentIndex
                ]
              ) {

                return;

              }


              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {

                state.isPlaying = true;

                updatePlayButton();

                startProgress();

                renderAll();

              }


              if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {

                state.isPlaying = false;

                updatePlayButton();

                renderAll();

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


  /* ==========================================
     YOUTUBE ID
  ========================================== */

  function getYouTubeId(url){

    if (!url) {

      return null;

    }


    const value =
      String(url).trim();


    if (
      /^[a-zA-Z0-9_-]{11}$/.test(value)
    ) {

      return value;

    }


    try {

      const u =
        new URL(value);


      if (
        u.hostname.includes(
          "youtu.be"
        )
      ) {

        return u.pathname
          .replace("/", "")
          .substring(0, 11);

      }


      if (
        u.hostname.includes(
          "youtube.com"
        ) ||
        u.hostname.includes(
          "youtube-nocookie.com"
        )
      ) {

        const v =
          u.searchParams.get("v");


        if (v) {

          return v.substring(0, 11);

        }


        const parts =
          u.pathname.split("/");


        for (
          const type of [
            "embed",
            "shorts"
          ]
        ) {

          const index =
            parts.indexOf(type);


          if (
            index >= 0 &&
            parts[index + 1]
          ) {

            return parts[
              index + 1
            ].substring(0, 11);

          }

        }

      }

    } catch (_) {}

    return null;

  }


  /* ==========================================
     NORMALIZE SONG
  ========================================== */

  function normalizeSong(song){

    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      song.video_url ||
      song.videoUrl ||
      "";


    const isYouTube =
      song.type === "youtube" ||
      song.source === "youtube" ||
      song.source_type === "youtube" ||
      !!getYouTubeId(youtubeUrl);


    return {

      id:
        song.id ||
        crypto.randomUUID(),

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
          ? getYouTubeId(
              youtubeUrl
            )
          : null,

      audioUrl:
        song.audio_url ||
        song.audioUrl ||
        song.file_url ||
        song.fileUrl ||
        song.url ||
        ""

    };

  }


  /* ==========================================
     LOAD SONGS
  ========================================== */

  async function loadSongs(){

    const list =
      $("songList");


    if (list) {

      list.innerHTML =
        '<div class="loading">Loading music...</div>';

    }


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
        songs.map(
          normalizeSong
        );


      renderAll();


    } catch (error) {

      console.error(
        "Song loading failed:",
        error
      );


      if (list) {

        list.innerHTML =
          '<div class="loading">Unable to load songs</div>';

      }

    }

  }


  /* ==========================================
     CATEGORY KEY
  ========================================== */

  function categoryKey(value){

    return String(
      value || "Music"
    )
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        "-"
      );

  }


  /* ==========================================
     CATEGORY META
  ========================================== */

  function categoryMeta(name){

    const key =
      categoryKey(name);


    if (
      CATEGORY_META[key]
    ) {

      return CATEGORY_META[key];

    }


    if (
      key.includes("devot") ||
      key.includes("bhakti")
    ) {

      return CATEGORY_META.bhakti;

    }


    if (
      key.includes("love") ||
      key.includes("rom")
    ) {

      return CATEGORY_META.love;

    }


    if (
      key.includes("marath")
    ) {

      return CATEGORY_META.marathi;

    }


    if (
      key.includes("energy") ||
      key.includes("workout")
    ) {

      return CATEGORY_META.energetic;

    }


    if (
      key.includes("party")
    ) {

      return CATEGORY_META.party;

    }


    if (
      key.includes("chill") ||
      key.includes("relax")
    ) {

      return CATEGORY_META.chill;

    }


    return {

      icon: "🎵",

      colors: [
        "#7c5cff",
        "#00e5ff"
      ]

    };

  }


  /* ==========================================
     RENDER CATEGORIES
  ========================================== */

  function renderCategories(){

    const grid =
      $("categoryGrid");


    if (!grid) {

      return;

    }


    const map =
      new Map();


    state.songs.forEach(
      song => {

        const name =
          String(
            song.category ||
            "Music"
          ).trim() ||
          "Music";


        const key =
          categoryKey(name);


        if (!map.has(key)) {

          map.set(
            key,
            {
              name,
              count: 0
            }
          );

        }


        map.get(key).count++;

      }
    );


    const categories = [

      {
        key: "all",
        name: "All Music",
        count: state.songs.length
      },

      ...Array.from(
        map.entries()
      ).map(
        ([key, value]) => ({
          key,
          ...value
        })
      )

    ];


    $("categoryCount").textContent =
      `${Math.max(
        0,
        categories.length - 1
      )} categories`;


    grid.innerHTML =
      categories
        .map(
          (category, index) => {

            const meta =
              category.key === "all"
                ? CATEGORY_META.all
                : categoryMeta(
                    category.name
                  );


            return `

              <button

                class="
                  category-card
                  ${
                    state.selectedCategory ===
                    category.key
                      ? "active"
                      : ""
                  }
                "

                data-category="
                  ${escapeHtml(
                    category.key
                  )}
                "

                style="
                  --cat1:
                    ${meta.colors[0]};
                  --cat2:
                    ${meta.colors[1]};
                "

              >

                <div class="category-icon">

                  ${meta.icon}

                </div>


                <h3>

                  ${escapeHtml(
                    category.name
                  )}

                </h3>


                <p>

                  ${category.count}

                  ${
                    category.count === 1
                      ? "song"
                      : "songs"
                  }

                </p>


                <span class="count">

                  ${
                    index === 0
                      ? "All"
                      : category.count
                  }

                </span>

              </button>

            `;

          }
        )
        .join("");


    grid
      .querySelectorAll(
        "[data-category]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              state.selectedCategory =
                button.dataset.category;


              renderAll();


              document
                .getElementById(
                  "songList"
                )
                ?.scrollIntoView({
                  behavior:
                    "smooth",

                  block:
                    "start"

                });

            }
          );

        }
      );

  }


  /* ==========================================
     SELECTED SONGS
  ========================================== */

  function selectedSongs(){

    if (
      state.selectedCategory ===
      "all"
    ) {

      return state.songs;

    }


    return state.songs.filter(
      song =>
        categoryKey(
          song.category
        ) ===
        state.selectedCategory
    );

  }


  /* ==========================================
     RENDER ALL
  ========================================== */

  function renderAll(){

    renderCategories();


    const selected =
      selectedSongs();


    $("songCount").textContent =
      `${selected.length} songs`;


    $("selectedCategoryTitle")
      .textContent =
        state.selectedCategory ===
        "all"

          ? "Recently Added"

          : (
              selected[0]?.category ||
              "Category"
            );


    $("selectedCategorySubtitle")
      .textContent =
        state.selectedCategory ===
        "all"

          ? "Your latest music, all in one place."

          : "Music from this category.";


    renderSongs(
      selected,
      $("songList")
    );


    renderSongs(
      state.songs,
      $("libraryList")
    );


    renderSongs(
      state.songs,
      $("playlistList")
    );


    renderLiked();


    const query =
      $("searchInput")
        ?.value
        .trim()
        .toLowerCase();


    if (query) {

      renderSearch(query);

    }

  }


  /* ==========================================
     RENDER SONGS
  ========================================== */

  function renderSongs(
    songs,
    container
  ){

    if (!container) {

      return;

    }


    if (!songs.length) {

      container.innerHTML =
        '<div class="loading">No songs found</div>';

      return;

    }


    container.innerHTML =
      songs
        .map(
          song => {

            const index =
              state.songs.findIndex(
                x =>
                  x.id ===
                  song.id
              );


            return `

              <div

                class="
                  song
                  ${
                    index ===
                      state.currentIndex
                      ? "playing"
                      : ""
                  }
                "

                data-index="${index}"

              >

                <img

                  class="song-cover"

                  src="
                    ${escapeHtml(
                      song.cover ||
                      DEFAULT_COVER
                    )}
                  "

                  onerror="
                    this.src='${DEFAULT_COVER}'
                  "

                  alt=""

                >


                <div class="song-details">

                  <div class="song-name">

                    ${escapeHtml(
                      song.title
                    )}

                  </div>


                  <div class="song-artist">

                    ${escapeHtml(
                      song.artist
                    )}

                  </div>


                  <div class="song-type">

                    ${
                      song.type ===
                      "youtube"
                        ? "YouTube"
                        : "MP3"
                    }

                    •

                    ${escapeHtml(
                      song.category
                    )}

                  </div>

                </div>


                <div class="song-actions">

                  ${
                    song.type ===
                    "youtube"

                      ? `

                        <button
                          class="watch-song-btn"
                          data-watch="${index}"
                        >

                          ▶ Watch

                        </button>

                      `

                      : ""
                  }


                  <button

                    class="song-play"

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

              </div>

            `;

          }
        )
        .join("");


    container
      .querySelectorAll(
        "[data-play]"
      )
      .forEach(
        button => {

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

        }
      );


    container
      .querySelectorAll(
        "[data-watch]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();


              const index =
                Number(
                  button.dataset.watch
                );


              playSong(index);


              setTimeout(
                showYouTube,
                500
              );

            }
          );

        }
      );


    container
      .querySelectorAll(
        ".song"
      )
      .forEach(
        element => {

          element.addEventListener(
            "click",
            event => {

              if (
                event.target.closest(
                  "button"
                )
              ) {

                return;

              }


              playSong(
                Number(
                  element.dataset.index
                )
              );

            }
          );

        }
      );

  }


  /* ==========================================
     LIKED
  ========================================== */

  function renderLiked(){

    renderSongs(

      state.songs.filter(
        song =>
          state.liked.includes(
            String(song.id)
          )
      ),

      $("likedList")

    );

  }


  /* ==========================================
     SEARCH
  ========================================== */

  function renderSearch(query){

    const container =
      $("searchResults");


    if (!container) {

      return;

    }


    if (!query) {

      container.innerHTML =
        '<div class="loading">Start typing to search.</div>';

      return;

    }


    renderSongs(

      state.songs.filter(
        song =>
          `
            ${song.title}
            ${song.artist}
            ${song.category}
          `
            .toLowerCase()
            .includes(query)
      ),

      container

    );

  }


  /* ==========================================
     PLAY SONG
  ========================================== */

  async function playSong(index){

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


    updatePlayerInfo(song);


    if (
      song.type ===
      "youtube"
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


  /* ==========================================
     MP3
  ========================================== */

  function playMp3Song(song){

    hideYouTube();


    audio.src =
      song.audioUrl;


    audio.currentTime =
      0;


    const promise =
      audio.play();


    if (promise) {

      promise

        .then(
          () => {

            state.isPlaying =
              true;

            updatePlayButton();

            startProgress();

          }
        )

        .catch(
          error => {

            console.error(
              "MP3 playback failed:",
              error
            );

            state.isPlaying =
              false;

            updatePlayButton();

          }
        );

    }

  }


  /* ==========================================
     YOUTUBE
  ========================================== */

  async function playYouTubeSong(
    song
  ){

    const videoId =
      song.youtubeId ||
      getYouTubeId(
        song.youtubeUrl
      );


    if (!videoId) {

      alert(
        "Invalid YouTube URL"
      );

      return;

    }


    if (
      !state.youtubeReady ||
      !state.youtubePlayer
    ) {

      alert(
        "YouTube player is still loading. Please try again."
      );

      return;

    }


    state.youtubeVideoId =
      videoId;


    hideYouTube();


    audio.pause();


    audio.removeAttribute(
      "src"
    );


    audio.load();


    state.youtubePlayer
      .loadVideoById(
        videoId
      );


    state.youtubePlayer
      .playVideo();


    state.isPlaying =
      true;


    updatePlayButton();

    startProgress();

  }


  /* ==========================================
     STOP
  ========================================== */

  function stopCurrent(){

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


  /* ==========================================
     YOUTUBE WINDOW
  ========================================== */

  function showYouTube(){

    $("youtubeFrame")
      ?.classList
      .remove(
        "hidden-video"
      );

  }


  function hideYouTube(){

    $("youtubeFrame")
      ?.classList
      .add(
        "hidden-video"
      );

  }


  /* ==========================================
     NEXT
  ========================================== */

  function nextSong(){

    if (!state.songs.length) {

      return;

    }


    playSong(
      (
        state.currentIndex +
        1
      ) %
      state.songs.length
    );

  }


  /* ==========================================
     PREVIOUS
  ========================================== */

  function previousSong(){

    if (!state.songs.length) {

      return;

    }


    const current =
      state.songs[
        state.currentIndex
      ];


    let time = 0;


    if (
      current?.type ===
      "youtube"
    ) {

      try {

        time =
          state.youtubePlayer
            ?.getCurrentTime() ||
          0;

      } catch (_) {}

    } else {

      time =
        audio.currentTime ||
        0;

    }


    if (time > 3) {

      if (
        current.type ===
        "youtube"
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

        audio.play();

      }


      return;

    }


    playSong(

      (
        state.currentIndex -
        1 +
        state.songs.length
      ) %
      state.songs.length

    );

  }


  /* ==========================================
     PLAYER EVENTS
  ========================================== */

  $("nextBtn")
    ?.addEventListener(
      "click",
      nextSong
    );


  $("prevBtn")
    ?.addEventListener(
      "click",
      previousSong
    );


  $("playBtn")
    ?.addEventListener(
      "click",
      () => {

        if (
          state.currentIndex <
          0
        ) {

          if (
            state.songs.length
          ) {

            playSong(0);

          }

          return;

        }


        const song =
          state.songs[
            state.currentIndex
          ];


        if (
          song.type ===
          "youtube"
        ) {

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

          if (
            audio.paused
          ) {

            audio
              .play()
              .catch(
                console.error
              );

          } else {

            audio.pause();

          }

        }

      }
    );


  audio.addEventListener(
    "play",
    () => {

      state.isPlaying =
        true;

      updatePlayButton();

      startProgress();

    }
  );


  audio.addEventListener(
    "pause",
    () => {

      state.isPlaying =
        false;

      updatePlayButton();

    }
  );


  audio.addEventListener(
    "ended",
    nextSong
  );


  /* ==========================================
     PROGRESS
  ========================================== */

  function startProgress(){

    stopProgress();


    state.progressTimer =
      setInterval(
        updateProgress,
        500
      );

  }


  function stopProgress(){

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


  function updateProgress(){

    const song =
      state.songs[
        state.currentIndex
      ];


    if (!song) {

      return;

    }


    let current = 0;

    let duration = 0;


    if (
      song.type ===
      "youtube"
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


    if (duration > 0) {

      $("progress").value =
        (
          current /
          duration
        ) *
        100;

    }


    $("currentTime")
      .textContent =
      formatTime(current);


    $("duration")
      .textContent =
      formatTime(duration);

  }


  $("progress")
    ?.addEventListener(
      "input",
      () => {

        const song =
          state.songs[
            state.currentIndex
          ];


        if (!song) {

          return;

        }


        const percentage =
          Number(
            $("progress").value
          ) / 100;


        if (
          song.type ===
          "youtube"
        ) {

          const duration =
            state.youtubePlayer
              .getDuration();


          state.youtubePlayer
            .seekTo(
              duration *
              percentage,
              true
            );

        } else if (
          audio.duration
        ) {

          audio.currentTime =
            audio.duration *
            percentage;

        }

      }
    );


  function formatTime(seconds){

    if (
      !Number.isFinite(
        seconds
      )
    ) {

      return "0:00";

    }


    return (

      `${Math.floor(
        seconds / 60
      )}:` +

      `${Math.floor(
        seconds % 60
      )
        .toString()
        .padStart(
          2,
          "0"
        )}`

    );

  }


  /* ==========================================
     PLAYER INFO
  ========================================== */

  function updatePlayerInfo(song){

    $("playerTitle")
      .textContent =
      song.title;


    $("playerArtist")
      .textContent =
      song.artist;


    $("playerCover")
      .src =
      song.cover ||
      DEFAULT_COVER;


    $("playerCover")
      .onerror =
      () => {

        $("playerCover")
          .src =
          DEFAULT_COVER;

      };

  }


  function updatePlayButton(){

    $("playBtn")
      .textContent =
      state.isPlaying
        ? "❚❚"
        : "▶";

  }


  /* ==========================================
     PAGE NAVIGATION
  ========================================== */

  document
    .querySelectorAll(
      ".menu-item"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const page =
              button.dataset.page;


            if (page) {

              showPage(
                page
              );

            }


            closeDrawer();

          }
        );

      }
    );


  function showPage(page){

    document
      .querySelectorAll(
        ".page"
      )
      .forEach(
        pageElement =>
          pageElement
            .classList
            .remove(
              "active"
            )
      );


    $(
      `${page}Page`
    )
      ?.classList
      .add(
        "active"
      );


    document
      .querySelectorAll(
        ".menu-item"
      )
      .forEach(
        item =>
          item.classList.toggle(
            "active",
            item.dataset.page ===
            page
          )
      );


    window.scrollTo({
      top:0,
      behavior:"smooth"
    });

  }


  /* ==========================================
     MOBILE MENU
  ========================================== */

  $("mobileMenu")
    ?.addEventListener(
      "click",
      () => {

        $("sidebar")
          .classList
          .toggle(
            "open"
          );


        $("drawerOverlay")
          ?.classList
          .toggle(
            "show"
          );

      }
    );


  $("drawerOverlay")
    ?.addEventListener(
      "click",
      closeDrawer
    );


  function closeDrawer(){

    $("sidebar")
      ?.classList
      .remove(
        "open"
      );


    $("drawerOverlay")
      ?.classList
      .remove(
        "show"
      );

  }


  /* ==========================================
     SEARCH
  ========================================== */

  $("searchInput")
    ?.addEventListener(
      "input",
      event => {

        const query =
          event.target.value
            .trim()
            .toLowerCase();


        if (query) {

          showPage(
            "search"
          );


          renderSearch(
            query
          );

        } else {

          renderSearch("");

        }

      }
    );


  /* ==========================================
     HERO PLAY
  ========================================== */

  $("heroPlay")
    ?.addEventListener(
      "click",
      () => {

        if (
          state.songs.length
        ) {

          playSong(
            state.currentIndex >=
              0
              ? state.currentIndex
              : 0
          );

        }

      }
    );


  /* ==========================================
     REFRESH
  ========================================== */

  $("refreshBtn")
    ?.addEventListener(
      "click",
      loadSongs
    );


  /* ==========================================
     6D LIQUID LOGO
     MOUSE / TOUCH PARALLAX
  ========================================== */

  $("liquidLogoStage")
    ?.addEventListener(
      "pointermove",
      event => {

        const stage =
          event.currentTarget;


        const logo =
          $("heroLiquidLogo");


        const rect =
          stage.getBoundingClientRect();


        const x =
          (
            event.clientX -
            rect.left
          ) /
          rect.width -
          .5;


        const y =
          (
            event.clientY -
            rect.top
          ) /
          rect.height -
          .5;


        logo.style.transform =
          `
            perspective(800px)
            rotateX(${
              -y * 12
            }deg)
            rotateY(${
              x * 16
            }deg)
          `;

      }
    );


  $("liquidLogoStage")
    ?.addEventListener(
      "pointerleave",
      () => {

        $("heroLiquidLogo")
          .style
          .transform = "";

      }
    );


  /* ==========================================
     LIKED
  ========================================== */

  function toggleLike(
    songId
  ){

    const id =
      String(songId);


    if (
      state.liked.includes(
        id
      )
    ) {

      state.liked =
        state.liked.filter(
          x =>
            x !== id
        );

    } else {

      state.liked.push(
        id
      );

    }


    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        state.liked
      )
    );


    renderLiked();

  }


  /* ==========================================
     ADMIN
  ========================================== */

  $("adminLogin")
    ?.addEventListener(
      "click",
      async () => {

        const key =
          $("adminKey")
            .value
            .trim();


        if (!key) {

          $("adminError")
            .textContent =
            "Enter admin key.";

          return;

        }


        try {

          const response =
            await fetch(
              "/api/admin/login",
              {

                method:"POST",

                headers:{
                  "Content-Type":
                    "application/json",

                  "x-admin-key":
                    key
                },

                body:
                  JSON.stringify({
                    adminKey:key
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
              "Invalid key"
            );

          }


          state.adminKey =
            key;


          $("adminLocked")
            .classList
            .add(
              "hidden"
            );


          $("adminContent")
            .classList
            .remove(
              "hidden"
            );


          $("adminError")
            .textContent = "";


        } catch (error) {

          console.error(
            "Admin login failed:",
            error
          );


          $("adminError")
            .textContent =
            error.message ||
            "Admin authentication failed.";

        }

      }
    );


  /* ==========================================
     YOUTUBE ADMIN
  ========================================== */

  $("youtubeForm")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (
          !state.adminKey
        ) {

          $("youtubeStatus")
            .textContent =
            "Admin authentication required.";

          return;

        }


        const url =
          $("ytUrl")
            .value
            .trim();


        const videoId =
          getYouTubeId(
            url
          );


        if (!videoId) {

          $("youtubeStatus")
            .textContent =
            "Invalid YouTube URL.";

          return;

        }


        try {

          const response =
            await fetch(
              "/api/admin/songs/youtube",
              {

                method:"POST",

                headers:{
                  "Content-Type":
                    "application/json",

                  "x-admin-key":
                    state.adminKey
                },

                body:
                  JSON.stringify({

                    title:
                      $("ytTitle")
                        .value
                        .trim(),

                    artist:
                      $("ytArtist")
                        .value
                        .trim(),

                    category:
                      $("ytCategory")
                        .value
                        .trim(),

                    cover:
                      $("ytCover")
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
              "YouTube upload failed"
            );

          }


          $("youtubeStatus")
            .textContent =
            "YouTube song added successfully.";


          event.target.reset();


          $("ytCategory")
            .value =
            "Music";


          await loadSongs();


        } catch (error) {

          console.error(
            error
          );


          $("youtubeStatus")
            .textContent =
            error.message ||
            "YouTube upload failed.";

        }

      }
    );


  /* ==========================================
     MP3 ADMIN
  ========================================== */

  $("mp3Form")
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (
          !state.adminKey
        ) {

          $("mp3Status")
            .textContent =
            "Admin authentication required.";

          return;

        }


        const file =
          $("mp3File")
            .files[0];


        if (!file) {

          $("mp3Status")
            .textContent =
            "Select an MP3 file.";

          return;

        }


        try {

          const formData =
            new FormData();


          formData.append(
            "title",
            $("mp3Title")
              .value
              .trim()
          );


          formData.append(
            "artist",
            $("mp3Artist")
              .value
              .trim()
          );


          formData.append(
            "category",
            $("mp3Category")
              .value
              .trim()
          );


          formData.append(
            "file",
            file
          );


          const response =
            await fetch(
              "/api/admin/songs/upload",
              {

                method:"POST",

                headers:{
                  "x-admin-key":
                    state.adminKey
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


          $("mp3Status")
            .textContent =
            "MP3 uploaded successfully.";


          event.target.reset();


          $("mp3Category")
            .value =
            "Music";


          await loadSongs();


        } catch (error) {

          console.error(
            error
          );


          $("mp3Status")
            .textContent =
            error.message ||
            "MP3 upload failed.";

        }

      }
    );


  /* ==========================================
     ESCAPE HTML
  ========================================== */

  function escapeHtml(
    value
  ){

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


  /* ==========================================
     START
  ========================================== */

  loadSongs();

})();