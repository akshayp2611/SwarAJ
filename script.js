(() => {

  "use strict";

  const state = {
    songs: [],
    currentIndex: -1,
    currentSong: null,

    youtubePlayer: null,
    youtubeReady: false,
    youtubeId: null,

    videoVisible: false,
    isPlaying: false,

    adminKey:
      localStorage.getItem("swarajAdminKey") || null,

    favorites:
      JSON.parse(
        localStorage.getItem("swarajFavorites") || "[]"
      )
  };


  const $ = id =>
    document.getElementById(id);


  let audio = null;


  /* =====================================================
     INIT
  ===================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    init
  );


  async function init() {

    setupAudio();

    setupNavigation();

    setupSearch();

    setupControls();

    setupAdmin();

    setupHero();

    await loadSongs();

    loadYouTubeAPI();

    restoreAdmin();

  }


  /* =====================================================
     AUDIO
  ===================================================== */

  function setupAudio() {

    audio = $("audioPlayer");

    if (!audio) {

      audio =
        document.createElement("audio");

      audio.id = "audioPlayer";

      audio.preload = "metadata";

      document.body.appendChild(audio);

    }


    audio.addEventListener(
      "play",
      () => {

        state.isPlaying = true;

        updatePlayButtons(true);

        updateMiniPlayer();

      }
    );


    audio.addEventListener(
      "pause",
      () => {

        state.isPlaying = false;

        updatePlayButtons(false);

        updateMiniPlayer();

      }
    );


    audio.addEventListener(
      "ended",
      nextSong
    );


    audio.addEventListener(
      "error",
      () => {

        showToast(
          "Unable to play MP3"
        );

      }
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


      const list =
        Array.isArray(data)
          ? data
          : (
              data.songs ||
              data.data ||
              []
            );


      state.songs =
        list
          .map(normalizeSong)
          .filter(Boolean);


      updateStats();

      renderHome();

      renderPlaylist();

      renderCategories();

      renderFavorites();

      renderAdminSongs();


    } catch (error) {

      console.error(
        "Songs:",
        error
      );

      showToast(
        "Unable to load songs"
      );

    }

  }


  /* =====================================================
     NORMALIZE
  ===================================================== */

  function normalizeSong(raw) {

    if (!raw) return null;


    const youtubeUrl =
      raw.youtube_url ||
      raw.youtubeUrl ||
      raw.youtube ||
      raw.video_url ||
      raw.videoUrl ||
      "";


    const sourceType =
      String(
        raw.source_type ||
        raw.sourceType ||
        raw.type ||
        ""
      ).toLowerCase();


    const normalAudio =
      raw.audio_url ||
      raw.audioUrl ||
      raw.audio ||
      raw.url ||
      raw.path ||
      "";


    const isYoutube =
      sourceType === "youtube" ||
      Boolean(youtubeUrl) ||
      isYoutubeUrl(normalAudio);


    const finalYoutubeUrl =
      youtubeUrl ||
      (
        isYoutube
          ? normalAudio
          : ""
      );


    const youtubeId =
      raw.youtube_video_id ||
      raw.youtubeVideoId ||
      getYoutubeId(
        finalYoutubeUrl
      );


    let cover =
      raw.cover_url ||
      raw.coverUrl ||
      raw.cover ||
      raw.image ||
      raw.imageUrl ||
      raw.thumbnail ||
      raw.thumbnailUrl ||
      "";


    if (
      isYoutube &&
      !cover &&
      youtubeId
    ) {

      cover =
        `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    }


    if (!cover) {

      cover =
        "/images/ganpati.jpg";

    }


    return {

      id:
        String(
          raw.id ||
          raw._id ||
          `${Date.now()}-${Math.random()}`
        ),

      title:
        raw.title ||
        raw.name ||
        "Untitled",

      artist:
        raw.artist ||
        raw.singer ||
        raw.author ||
        "SwarAJ",

      album:
        raw.album ||
        "Singles",

      category:
        raw.category ||
        raw.genre ||
        raw.folder ||
        "Other",

      type:
        isYoutube
          ? "youtube"
          : "mp3",

      audioUrl:
        isYoutube
          ? ""
          : normalAudio,

      youtubeUrl:
        finalYoutubeUrl,

      youtubeId:

        youtubeId || "",

      cover,

      raw

    };

  }


  /* =====================================================
     YOUTUBE ID
  ===================================================== */

  function isYoutubeUrl(url) {

    return (
      /youtube\.com/i.test(
        String(url || "")
      ) ||
      /youtu\.be/i.test(
        String(url || "")
      )
    );

  }


  function getYoutubeId(url) {

    if (!url) return "";


    const text =
      String(url).trim();


    if (
      /^[A-Za-z0-9_-]{11}$/.test(
        text
      )
    ) {

      return text;

    }


    try {

      const parsed =
        new URL(text);


      if (
        parsed.hostname ===
        "youtu.be"
      ) {

        return (
          parsed.pathname
            .split("/")
            .filter(Boolean)[0] ||
          ""
        );

      }


      const v =
        parsed.searchParams.get(
          "v"
        );


      if (v) return v;


      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);


      const index =
        parts.findIndex(
          x =>
            [
              "embed",
              "shorts",
              "live"
            ].includes(x)
        );


      if (
        index >= 0 &&
        parts[index + 1]
      ) {

        return parts[index + 1];

      }

    } catch {}

    return "";

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

      createYoutubePlayer();

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
      document.createElement("script");


    script.id =
      "youtube-api";


    script.src =
      "https://www.youtube.com/iframe_api";


    document.head.appendChild(
      script
    );


    window.onYouTubeIframeAPIReady =
      () => {

        state.youtubeReady = true;

        createYoutubePlayer();

      };

  }


  /* =====================================================
     CREATE YOUTUBE PLAYER
     
     IMPORTANT:
     PLAYER IS CREATED ONLY IN MEMORY.
     
     NO VIDEO CONTAINER IS SHOWN.
  ===================================================== */

  function createYoutubePlayer() {

    if (
      !state.youtubeReady ||
      state.youtubePlayer
    ) {

      return;

    }


    /*
      Do NOT create a visible iframe here.

      YouTube player is created only when
      Watch Video is clicked.
    */

  }


  function createVisibleYoutubePlayer(
    videoId
  ) {

    const frame =
      $("youtubeFrame");


    if (!frame) return;


    frame.innerHTML = "";


    frame.hidden = false;

    frame.style.display = "block";


    const div =
      document.createElement("div");


    div.id =
      "youtube-player";


    frame.appendChild(div);


    state.youtubePlayer =
      new YT.Player(
        div,
        {

          width: "100%",

          height: "100%",

          videoId,

          playerVars: {

            autoplay: 1,

            controls: 1,

            rel: 0,

            modestbranding: 1,

            playsinline: 1

          },

          events: {

            onReady:
              event => {

                state.youtubeReady = true;

                event.target.playVideo();

              },


            onStateChange:
              handleYoutubeState,


            onError:
              () => {

                showToast(
                  "YouTube video cannot be played"
                );

              }

          }

        }
      );

  }


  /* =====================================================
     PLAY SONG
  ===================================================== */

  function playSong(index) {

    if (
      index < 0 ||
      index >= state.songs.length
    ) {

      return;

    }


    const song =
      state.songs[index];


    state.currentIndex =
      index;


    state.currentSong =
      song;


    /*
      ALWAYS HIDE VIDEO WHEN
      CHANGING SONG.
    */

    hideVideo();


    if (
      song.type === "youtube"
    ) {

      playYoutubeAudio(song);

    } else {

      playMp3(song);

    }


    updateCurrentSong();

    updateMiniPlayer();

  }


  /* =====================================================
     MP3
  ===================================================== */

  async function playMp3(song) {

    stopYoutube();

    hideVideo();


    if (!song.audioUrl) {

      showToast(
        "MP3 URL is missing"
      );

      return;

    }


    audio.src =
      song.audioUrl;


    audio.load();


    try {

      await audio.play();

      state.isPlaying = true;

      updatePlayButtons(true);

    } catch (error) {

      console.error(
        error
      );

      showToast(
        "Unable to play MP3"
      );

    }

  }


  /* =====================================================
     YOUTUBE AUDIO
     
     IMPORTANT:
     YouTube iframe is NOT shown.
  ===================================================== */

  function playYoutubeAudio(song) {

    stopMp3();


    const id =
      song.youtubeId ||
      getYoutubeId(
        song.youtubeUrl
      );


    if (!id) {

      showToast(
        "Invalid YouTube URL"
      );

      return;

    }


    state.youtubeId =
      id;


    state.videoVisible =
      false;


    /*
      Completely remove iframe.
    */

    hideVideo();


    /*
      YouTube audio-only playback
      requires the YouTube player internally,
      but we keep its visual container hidden.
    */

    if (
      !window.YT ||
      !window.YT.Player
    ) {

      loadYoutubeAudioHidden(
        id
      );

      return;

    }


    loadYoutubeAudioHidden(
      id
    );


    showWatchButton();

  }


  function loadYoutubeAudioHidden(
    id
  ) {

    let holder =
      $("youtubeAudioHolder");


    if (!holder) {

      holder =
        document.createElement(
          "div"
        );

      holder.id =
        "youtubeAudioHolder";


      holder.style.position =
        "fixed";

      holder.style.width =
        "1px";

      holder.style.height =
        "1px";

      holder.style.left =
        "-10000px";

      holder.style.top =
        "-10000px";

      holder.style.opacity =
        "0";

      holder.style.pointerEvents =
        "none";

      document.body.appendChild(
        holder
      );

    }


    holder.innerHTML =
      `<div id="youtube-audio-player"></div>`;


    try {

      state.youtubePlayer =
        new YT.Player(
          "youtube-audio-player",
          {

            width: "1",

            height: "1",

            videoId: id,

            playerVars: {

              autoplay: 1,

              controls: 0,

              rel: 0,

              playsinline: 1

            },

            events: {

              onReady:
                event => {

                  event.target.playVideo();

                },

              onStateChange:
                handleYoutubeState,

              onError:
                () => {

                  showToast(
                    "YouTube playback failed"
                  );

                }

            }

          }
        );

    } catch (error) {

      console.error(
        error
      );

      showToast(
        "YouTube player failed"
      );

    }

  }


  /* =====================================================
     WATCH VIDEO
  ===================================================== */

  function watchVideo() {

    const song =
      state.currentSong;


    if (
      !song ||
      song.type !== "youtube"
    ) {

      return;

    }


    const id =
      song.youtubeId ||
      getYoutubeId(
        song.youtubeUrl
      );


    if (!id) return;


    /*
      Stop hidden audio player.
    */

    stopYoutube();


    /*
      Now and ONLY now show video.
    */

    const area =
      $("videoPlayerArea");


    const frame =
      $("youtubeFrame");


    if (!area || !frame) return;


    area.hidden = false;

    area.style.display =
      "block";


    frame.hidden = false;

    frame.style.display =
      "block";


    state.videoVisible =
      true;


    const label =
      $("playerModeLabel");


    if (label) {

      label.textContent =
        "WATCHING VIDEO";

    }


    const button =
      $("watchVideoButton");


    if (button) {

      button.style.display =
        "none";

    }


    if (
      window.YT &&
      window.YT.Player
    ) {

      createVisibleYoutubePlayer(
        id
      );

    }

  }


  /* =====================================================
     HIDE VIDEO
  ===================================================== */

  function hideVideo() {

    state.videoVisible =
      false;


    const area =
      $("videoPlayerArea");


    const frame =
      $("youtubeFrame");


    if (frame) {

      frame.innerHTML =
        "";

      frame.hidden =
        true;

      frame.style.display =
        "none";

    }


    if (area) {

      area.hidden =
        true;

      area.style.display =
        "none";

    }


    const button =
      $("watchVideoButton");


    if (button) {

      button.style.display =
        "inline-flex";

    }


    const label =
      $("playerModeLabel");


    if (label) {

      label.textContent =
        "PLAYING AS AUDIO";

    }

  }


  /* =====================================================
     WATCH BUTTON
  ===================================================== */

  function showWatchButton() {

    const button =
      $("watchVideoButton");


    if (!button) return;


    button.style.display =
      "inline-flex";


    button.textContent =
      "▶ Watch Video";

  }


  /* =====================================================
     YOUTUBE STATE
  ===================================================== */

  function handleYoutubeState(
    event
  ) {

    if (!window.YT) return;


    if (
      event.data ===
      YT.PlayerState.PLAYING
    ) {

      state.isPlaying =
        true;

      updatePlayButtons(
        true
      );

      updateMiniPlayer();

    }


    if (
      event.data ===
      YT.PlayerState.PAUSED
    ) {

      state.isPlaying =
        false;

      updatePlayButtons(
        false
      );

    }


    if (
      event.data ===
      YT.PlayerState.ENDED
    ) {

      nextSong();

    }

  }


  /* =====================================================
     STOP
  ===================================================== */

  function stopMp3() {

    if (!audio) return;


    try {

      audio.pause();

      audio.currentTime =
        0;

    } catch {}

  }


  function stopYoutube() {

    if (
      state.youtubePlayer
    ) {

      try {

        state.youtubePlayer.stopVideo();

      } catch {}

    }


    const holder =
      $("youtubeAudioHolder");


    if (holder) {

      holder.innerHTML =
        "";

    }


    state.youtubePlayer =
      null;

  }


  /* =====================================================
     NEXT
  ===================================================== */

  function nextSong() {

    if (!state.songs.length) {
      return;
    }


    let index =
      state.currentIndex + 1;


    if (
      index >=
      state.songs.length
    ) {

      index = 0;

    }


    playSong(index);

  }


  /* =====================================================
     PREVIOUS
  ===================================================== */

  function previousSong() {

    if (!state.songs.length) {
      return;
    }


    let index =
      state.currentIndex - 1;


    if (index < 0) {

      index =
        state.songs.length - 1;

    }


    playSong(index);

  }


  /* =====================================================
     TOGGLE
  ===================================================== */

  function togglePlay() {

    if (
      !state.currentSong
    ) {

      if (state.songs.length) {
        playSong(0);
      }

      return;

    }


    if (
      state.currentSong.type ===
      "youtube"
    ) {

      if (
        !state.youtubePlayer
      ) {

        playSong(
          state.currentIndex
        );

        return;

      }


      try {

        if (
          state.isPlaying
        ) {

          state.youtubePlayer.pauseVideo();

        } else {

          state.youtubePlayer.playVideo();

        }

      } catch {}

      return;

    }


    if (
      audio.paused
    ) {

      audio.play().catch(
        console.error
      );

    } else {

      audio.pause();

    }

  }


  /* =====================================================
     CONTROLS
  ===================================================== */

  function setupControls() {

    $("watchVideoButton")
      ?.addEventListener(
        "click",
        watchVideo
      );


    $("videoPrevButton")
      ?.addEventListener(
        "click",
        previousSong
      );


    $("videoNextButton")
      ?.addEventListener(
        "click",
        nextSong
      );


    $("videoPlayButton")
      ?.addEventListener(
        "click",
        togglePlay
      );


    document
      .querySelectorAll(
        "[data-player='previous']"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            previousSong
          )
      );


    document
      .querySelectorAll(
        "[data-player='next']"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            nextSong
          )
      );


    document
      .querySelectorAll(
        "[data-player='play']"
      )
      .forEach(
        button =>
          button.addEventListener(
            "click",
            togglePlay
          )
      );

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function setupNavigation() {

    document
      .querySelectorAll(
        "[data-section]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              showSection(
                button.dataset.section
              );

            }
          );

        }
      );


    $("mobileMenuButton")
      ?.addEventListener(
        "click",
        () => {

          $("sidebar")
            ?.classList.toggle(
              "open"
            );

        }
      );


    $("mobileSearchButton")
      ?.addEventListener(
        "click",
        () => {

          $("searchInput")
            ?.focus();

        }
      );


    $("refreshButton")
      ?.addEventListener(
        "click",
        loadSongs
      );

  }


  function showSection(
    section
  ) {

    /*
      IMPORTANT:
      Only ONE section gets active.
      This prevents menu sections from
      appearing underneath Home.
    */

    document
      .querySelectorAll(
        ".page-section"
      )
      .forEach(
        item => {

          item.classList.remove(
            "active"
          );

        }
      );


    const target =
      $(
        `section-${section}`
      );


    if (target) {

      target.classList.add(
        "active"
      );

    }


    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(
        item => {

          item.classList.toggle(
            "active",
            item.dataset.section ===
              section
          );

        }
      );


    $("sidebar")
      ?.classList.remove(
        "open"
      );


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  /* =====================================================
     SEARCH
  ===================================================== */

  function setupSearch() {

    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          const q =
            event.target.value
              .trim()
              .toLowerCase();


          if (!q) {

            renderPlaylist();

            return;

          }


          const results =
            state.songs.filter(
              song =>

                song.title
                  .toLowerCase()
                  .includes(q) ||

                song.artist
                  .toLowerCase()
                  .includes(q) ||

                song.category
                  .toLowerCase()
                  .includes(q)

            );


          renderPlaylist(
            results
          );

        }
      );

  }


  /* =====================================================
     PLAYLIST
  ===================================================== */

  function renderPlaylist(
    songs = state.songs
  ) {

    const main =
      $("mp3Playlist");


    const youtube =
      $("videoPlaylist");


    if (main) {

      main.innerHTML =
        "";

      songs.forEach(
        song => {

          main.appendChild(
            createSongCard(
              song
            )
          );

        }
      );

    }


    if (youtube) {

      youtube.innerHTML =
        "";

      state.songs
        .filter(
          song =>
            song.type ===
            "youtube"
        )
        .forEach(
          song => {

            youtube.appendChild(
              createSongCard(
                song
              )
            );

          }
        );

    }

  }


  /* =====================================================
     SONG CARD
  ===================================================== */

  function createSongCard(
    song
  ) {

    const index =
      state.songs.indexOf(
        song
      );


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "song-card";


    card.innerHTML = `

      <div class="song-cover">

        <img
          src="${escapeAttr(song.cover)}"
          alt="${escapeAttr(song.title)}"
          loading="lazy"
        >

        <span class="song-type">
          ${song.type === "youtube"
            ? "YOUTUBE"
            : "MP3"}
        </span>

        <button
          class="card-play"
          type="button"
        >
          ▶
        </button>

      </div>

      <h3>
        ${escapeHtml(song.title)}
      </h3>

      <p>
        ${escapeHtml(song.artist)}
      </p>

      <small>
        ${escapeHtml(song.category)}
      </small>

    `;


    card.addEventListener(
      "click",
      () =>
        playSong(index)
    );


    card
      .querySelector(
        ".card-play"
      )
      ?.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          playSong(index);

        }
      );


    return card;

  }


  /* =====================================================
     HOME
  ===================================================== */

  function renderHome() {

    const container =
      $("recentSongs");


    if (!container) return;


    container.innerHTML =
      "";


    state.songs
      .slice(0,8)
      .forEach(
        song => {

          container.appendChild(
            createSongCard(
              song
            )
          );

        }
      );

  }


  /* =====================================================
     CATEGORIES
  ===================================================== */

  function renderCategories() {

    const grid =
      $("categoriesGrid");


    if (!grid) return;


    const groups =
      {};


    state.songs.forEach(
      song => {

        const category =
          song.category ||
          "Other";


        if (!groups[category]) {

          groups[category] =
            [];

        }


        groups[category].push(
          song
        );

      }
    );


    grid.innerHTML =
      "";


    Object.entries(groups)
      .forEach(
        ([name,songs]) => {

          const button =
            document.createElement(
              "button"
            );


          button.className =
            "category-card";


          button.innerHTML = `
            <strong>
              ${escapeHtml(name)}
            </strong>

            <span>
              ${songs.length} songs
            </span>
          `;


          button.addEventListener(
            "click",
            () => {

              const container =
                $("categorySongs");


              if (!container) return;


              container.innerHTML =
                "";


              songs.forEach(
                song => {

                  container.appendChild(
                    createSongCard(
                      song
                    )
                  );

                }
              );

            }
          );


          grid.appendChild(
            button
          );

        }
      );

  }


  /* =====================================================
     FAVORITES
  ===================================================== */

  function renderFavorites() {

    const container =
      $("favoritesList");


    if (!container) return;


    container.innerHTML =
      "";


    state.songs
      .filter(
        song =>
          state.favorites.includes(
            song.id
          )
      )
      .forEach(
        song => {

          container.appendChild(
            createSongCard(
              song
            )
          );

        }
      );

  }


  /* =====================================================
     STATS
  ===================================================== */

  function updateStats() {

    const mp3 =
      state.songs.filter(
        song =>
          song.type === "mp3"
      ).length;


    const youtube =
      state.songs.filter(
        song =>
          song.type === "youtube"
      ).length;


    const categories =
      new Set(
        state.songs.map(
          song =>
            song.category
        )
      ).size;


    if ($("mp3Count")) {

      $("mp3Count").textContent =
        mp3;

    }


    if ($("videoCount")) {

      $("videoCount").textContent =
        youtube;

    }


    if ($("categoryCount")) {

      $("categoryCount").textContent =
        categories;

    }

  }


  /* =====================================================
     CURRENT SONG
  ===================================================== */

  function updateCurrentSong() {

    const song =
      state.currentSong;


    if (!song) return;


    const title =
      $("videoPlayerTitle");


    if (title) {

      title.textContent =
        song.title;

    }


    document
      .querySelectorAll(
        "[data-current-title]"
      )
      .forEach(
        el =>
          el.textContent =
            song.title
      );

  }


  /* =====================================================
     MINI PLAYER
  ===================================================== */

  function updateMiniPlayer() {

    const song =
      state.currentSong;


    if (!song) return;


    const mini =
      $("miniPlayer");


    if (!mini) return;


    mini.classList.remove(
      "hidden"
    );


    const image =
      mini.querySelector(
        "[data-mini-image]"
      );


    const title =
      mini.querySelector(
        "[data-mini-title]"
      );


    const artist =
      mini.querySelector(
        "[data-mini-artist]"
      );


    if (image) {

      image.src =
        song.cover;

    }


    if (title) {

      title.textContent =
        song.title;

    }


    if (artist) {

      artist.textContent =
        song.artist;

    }

  }


  function updatePlayButtons(
    playing
  ) {

    document
      .querySelectorAll(
        "[data-player='play'],#videoPlayButton"
      )
      .forEach(
        button => {

          button.textContent =
            playing
              ? "❚❚"
              : "▶";

        }
      );

  }


  /* =====================================================
     HERO
  ===================================================== */

  function setupHero() {

    $("heroPlayButton")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.songs.length
          ) {

            playSong(0);

          }

        }
      );


    $("heroVideoButton")
      ?.addEventListener(
        "click",
        () => {

          const index =
            state.songs.findIndex(
              song =>
                song.type ===
                "youtube"
            );


          if (index >= 0) {

            showSection(
              "youtube"
            );

            playSong(
              index
            );

          } else {

            showToast(
              "No YouTube songs available"
            );

          }

        }
      );

  }


  /* =====================================================
     ADMIN
  ===================================================== */

  function setupAdmin() {

    $("adminLoginForm")
      ?.addEventListener(
        "submit",
        loginAdmin
      );


    $("adminLogoutButton")
      ?.addEventListener(
        "click",
        logoutAdmin
      );


    $("adminRefreshButton")
      ?.addEventListener(
        "click",
        loadAdminSongs
      );


    $("youtubeUploadForm")
      ?.addEventListener(
        "submit",
        uploadYoutube
      );


    $("mp3UploadForm")
      ?.addEventListener(
        "submit",
        uploadMp3
      );

  }


  function restoreAdmin() {

    if (
      state.adminKey
    ) {

      verifyAdmin();

    }

  }


  async function verifyAdmin() {

    try {

      const response =
        await fetch(
          "/api/admin/songs",
          {
            headers: {
              "x-admin-key":
                state.adminKey
            }
          }
        );


      if (!response.ok) {

        throw new Error();

      }


      showAdminContent();


    } catch {

      logoutAdmin();

    }

  }


  async function loginAdmin(
    event
  ) {

    event.preventDefault();


    const key =
      $("adminKey")
        ?.value
        .trim();


    if (!key) return;


    try {

      const response =
        await fetch(
          "/api/admin/login",
          {

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                adminKey:
                  key
              })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Invalid admin key"
        );

      }


      state.adminKey =
        key;


      localStorage.setItem(
        "swarajAdminKey",
        key
      );


      showAdminContent();

      await loadAdminSongs();


      showToast(
        "Admin unlocked"
      );


    } catch (error) {

      $("adminLoginMessage")
        .textContent =
          error.message;

    }

  }


  function showAdminContent() {

    $("adminLogin")
      ?.classList.add(
        "hidden"
      );


    $("adminContent")
      ?.classList.remove(
        "hidden"
      );

  }


  function logoutAdmin() {

    state.adminKey =
      null;


    localStorage.removeItem(
      "swarajAdminKey"
    );


    $("adminLogin")
      ?.classList.remove(
        "hidden"
      );


    $("adminContent")
      ?.classList.add(
        "hidden"
      );

  }


  /* =====================================================
     YOUTUBE UPLOAD
  ===================================================== */

  async function uploadYoutube(
    event
  ) {

    event.preventDefault();


    if (!state.adminKey) {

      showToast(
        "Admin key required"
      );

      return;

    }


    try {

      const response =
        await fetch(
          "/api/admin/songs/youtube",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "x-admin-key":
                state.adminKey

            },

            body:
              JSON.stringify({

                title:
                  $("youtubeTitle").value.trim(),

                artist:
                  $("youtubeArtist").value.trim(),

                category:
                  $("youtubeCategory").value.trim(),

                coverUrl:
                  $("youtubeCover").value.trim(),

                youtubeUrl:
                  $("youtubeUrl").value.trim()

              })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Upload failed"
        );

      }


      event.target.reset();


      $("youtubeArtist").value =
        "YouTube";


      $("youtubeCategory").value =
        "Other";


      showToast(
        "YouTube song added"
      );


      await loadSongs();


    } catch (error) {

      showToast(
        error.message
      );

    }

  }


  /* =====================================================
     MP3 UPLOAD
  ===================================================== */

  async function uploadMp3(
    event
  ) {

    event.preventDefault();


    if (!state.adminKey) {

      showToast(
        "Admin key required"
      );

      return;

    }


    try {

      const response =
        await fetch(
          "/api/admin/songs/mp3-url",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "x-admin-key":
                state.adminKey

            },

            body:
              JSON.stringify({

                title:
                  $("uploadTitle").value.trim(),

                artist:
                  $("uploadArtist").value.trim(),

                category:
                  $("uploadCategory").value.trim(),

                coverUrl:
                  $("uploadCover").value.trim(),

                audioUrl:
                  $("uploadAudioUrl").value.trim()

              })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Upload failed"
        );

      }


      event.target.reset();


      $("uploadArtist").value =
        "SwarAJ";


      $("uploadCategory").value =
        "Other";


      showToast(
        "MP3 song added"
      );


      await loadSongs();


    } catch (error) {

      showToast(
        error.message
      );

    }

  }


  /* =====================================================
     ADMIN LIST
  ===================================================== */

  async function loadAdminSongs() {

    if (!state.adminKey) return;


    try {

      const response =
        await fetch(
          "/api/admin/songs",
          {
            headers: {
              "x-admin-key":
                state.adminKey
            }
          }
        );


      if (!response.ok) return;


      const data =
        await response.json();


      renderAdminSongs(
        data.songs || []
      );

    } catch {}

  }


  function renderAdminSongs(
    songs = []
  ) {

    const container =
      $("adminSongList");


    if (!container) return;


    container.innerHTML =
      "";


    songs.forEach(
      song => {

        const row =
          document.createElement(
            "div"
          );


        row.className =
          "admin-song-row";


        row.innerHTML = `

          <img
            src="${escapeAttr(
              song.cover_url ||
              song.cover ||
              "/images/ganpati.jpg"
            )}"
            alt=""
          >

          <div class="admin-song-info">

            <strong>
              ${escapeHtml(
                song.title ||
                song.name ||
                "Untitled"
              )}
            </strong>

            <small>
              ${escapeHtml(
                song.artist ||
                "SwarAJ"
              )}
            </small>

          </div>

        `;


        container.appendChild(
          row
        );

      }
    );

  }


  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHtml(
    value
  ) {

    return String(
      value || ""
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


  function escapeAttr(
    value
  ) {

    return escapeHtml(
      value
    );

  }


  function showToast(
    message
  ) {

    const toast =
      $("swarajToast");


    if (!toast) return;


    toast.textContent =
      message;


    toast.classList.add(
      "show"
    );


    clearTimeout(
      showToast.timer
    );


    showToast.timer =
      setTimeout(
        () => {

          toast.classList.remove(
            "show"
          );

        },
        3000
      );

  }

})();