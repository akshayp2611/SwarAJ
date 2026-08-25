/* =========================================================
   SwarAJ MUSIC PLAYER
   MP3 + YOUTUBE/VIDEO SEPARATION
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    allSongs: [],
    mp3Songs: [],
    videoSongs: [],

    mp3Index: -1,
    videoIndex: -1,

    currentType: null,
    currentSong: null,

    youtubePlayer: null,
    youtubeReady: false,

    videoVisible: false,

    adminKey: null,
    adminUnlocked: false,

    favorites:
      JSON.parse(
        localStorage.getItem("swarajFavorites") || "[]"
      )
  };

  /* =======================================================
     DOM
     ======================================================= */

  const $ = (id) =>
    document.getElementById(id);

  const audio =
    $("audioPlayer");

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

  async function init() {

    bindNavigation();

    bindSearch();

    bindPlayerControls();

    bindAdmin();

    bindHero();

    await loadSongs();

    loadYouTubeAPI();

  }

  /* =======================================================
     LOAD SONGS
     ======================================================= */

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

      let songs =
        Array.isArray(data)
          ? data
          : (
              data.songs ||
              data.data ||
              []
            );

      state.allSongs =
        songs
          .map(normalizeSong)
          .filter(Boolean);

      state.mp3Songs =
        state.allSongs.filter(
          song => song.type === "mp3"
        );

      state.videoSongs =
        state.allSongs.filter(
          song => song.type === "youtube"
        );

      updateStats();

      renderHome();

      renderMP3();

      renderVideos();

      renderCategories();

      renderFavorites();

      renderAdminSongs();

    } catch (error) {

      console.error(
        "Song loading failed:",
        error
      );

      showToast(
        "Unable to load songs"
      );

    }

  }

  /* =======================================================
     NORMALIZE SONG
     ======================================================= */

  function normalizeSong(raw) {

    if (!raw) {
      return null;
    }

    const title =
      raw.title ||
      raw.name ||
      raw.song_name ||
      "Untitled";

    const artist =
      raw.artist ||
      raw.singer ||
      raw.author ||
      "Unknown Artist";

    const category =
      raw.category ||
      raw.genre ||
      raw.folder ||
      "General";

    const cover =
      raw.cover ||
      raw.coverUrl ||
      raw.image ||
      raw.imageUrl ||
      raw.thumbnail ||
      raw.thumbnailUrl ||
      "";

    const audioUrl =
      raw.audioUrl ||
      raw.audio ||
      raw.url ||
      raw.path ||
      raw.file ||
      "";

    const youtubeUrl =
      raw.youtubeUrl ||
      raw.youtube_url ||
      raw.videoUrl ||
      raw.video_url ||
      raw.youtube ||
      (
        raw.type === "youtube"
          ? raw.url
          : ""
      ) ||
      "";

    const detectedYouTube =
      isYouTubeUrl(
        youtubeUrl
      ) ||
      raw.type === "youtube" ||
      raw.type === "video" ||
      raw.source === "youtube";

    const type =
      detectedYouTube
        ? "youtube"
        : "mp3";

    return {

      id:
        String(
          raw.id ||
          raw._id ||
          raw.songId ||
          `${type}-${title}-${artist}`
        ),

      title,

      artist,

      category,

      cover:
        cover ||
        makeCover(title),

      type,

      audioUrl:
        type === "mp3"
          ? audioUrl
          : "",

      youtubeUrl:
        type === "youtube"
          ? youtubeUrl || audioUrl
          : "",

      duration:
        raw.duration ||
        "",

      raw

    };

  }

  /* =======================================================
     YOUTUBE URL
     ======================================================= */

  function isYouTubeUrl(url) {

    if (!url) {
      return false;
    }

    return (
      /youtube\.com/i.test(url) ||
      /youtu\.be/i.test(url)
    );

  }

  function getYouTubeId(url) {

    if (!url) {
      return null;
    }

    try {

      const value =
        String(url).trim();

      const patterns = [

        /[?&]v=([^&#]+)/i,

        /youtu\.be\/([^?&#/]+)/i,

        /youtube\.com\/shorts\/([^?&#/]+)/i,

        /youtube\.com\/embed\/([^?&#/]+)/i,

        /youtube\.com\/live\/([^?&#/]+)/i

      ];

      for (
        const pattern of patterns
      ) {

        const match =
          value.match(pattern);

        if (match) {
          return match[1];
        }

      }

      return null;

    } catch {

      return null;

    }

  }

  /* =======================================================
     YOUTUBE API
     ======================================================= */

  function loadYouTubeAPI() {

    if (
      window.YT &&
      window.YT.Player
    ) {

      state.youtubeReady = true;

      createYouTubePlayer();

      return;

    }

    if (
      document.getElementById(
        "youtube-api-script"
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

    script.id =
      "youtube-api-script";

    script.src =
      "https://www.youtube.com/iframe_api";

    document.head.appendChild(
      script
    );

    window.onYouTubeIframeAPIReady =
      () => {

        state.youtubeReady =
          true;

        createYouTubePlayer();

      };

  }

  function createYouTubePlayer() {

    if (
      !state.youtubeReady ||
      state.youtubePlayer
    ) {
      return;
    }

    const container =
      $("youtubeFrame");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    const iframe =
      document.createElement("div");

    iframe.id =
      "youtube-player";

    container.appendChild(
      iframe
    );

    try {

      state.youtubePlayer =
        new YT.Player(
          "youtube-player",
          {

            width: "100%",
            height: "100%",

            videoId: "",

            playerVars: {

              autoplay: 0,

              controls: 1,

              rel: 0,

              modestbranding: 1,

              playsinline: 1,

              enablejsapi: 1

            },

            events: {

              onReady:
                handleYouTubeReady,

              onStateChange:
                handleYouTubeState

            }

          }
        );

    } catch (error) {

      console.error(
        "YouTube player error:",
        error
      );

    }

  }

  function handleYouTubeReady() {

    state.youtubeReady =
      true;

  }

  function handleYouTubeState(event) {

    if (
      !window.YT
    ) {
      return;
    }

    if (
      event.data ===
      YT.PlayerState.PLAYING
    ) {

      updatePlayButtons(
        true
      );

    }

    if (
      event.data ===
      YT.PlayerState.PAUSED
    ) {

      updatePlayButtons(
        false
      );

    }

    if (
      event.data ===
      YT.PlayerState.ENDED
    ) {

      nextVideo();

    }

  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function bindNavigation() {

    document
      .querySelectorAll(
        "[data-section]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const section =
              button.dataset.section;

            showSection(
              section
            );

          }
        );

      });

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

          const search =
            $("searchInput");

          if (!search) {
            return;
          }

          search.focus();

        }
      );

  }

  function showSection(
    section
  ) {

    document
      .querySelectorAll(
        ".page-section"
      )
      .forEach(item => {

        item.classList.remove(
          "active"
        );

      });

    const target =
      $(
        `section-${section}`
      ) ||
      document.getElementById(
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
      .forEach(item => {

        item.classList.toggle(
          "active",
          item.dataset.section ===
            section
        );

      });

    $("sidebar")
      ?.classList.remove(
        "open"
      );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }

  /* =======================================================
     HERO
     ======================================================= */

  function bindHero() {

    $("heroPlayButton")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.mp3Songs.length
          ) {

            playMP3(0);

            showSection(
              "mp3"
            );

          }

        }
      );

    $("heroVideoButton")
      ?.addEventListener(
        "click",
        () => {

          showSection(
            "videos"
          );

        }
      );

  }

  /* =======================================================
     MP3 RENDER
     ======================================================= */

  function renderMP3(
    songs = state.mp3Songs
  ) {

    const container =
      $("mp3Playlist");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    if (!songs.length) {

      container.innerHTML =
        emptyState(
          "♫",
          "No MP3 songs found"
        );

      return;

    }

    songs.forEach(
      (song, index) => {

        container.appendChild(
          createSongCard(
            song,
            () => {

              const actualIndex =
                state.mp3Songs.indexOf(
                  song
                );

              playMP3(
                actualIndex
              );

            }
          )
        );

      }
    );

  }

  /* =======================================================
     VIDEO RENDER
     ======================================================= */

  function renderVideos(
    songs = state.videoSongs
  ) {

    const container =
      $("videoPlaylist");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    if (!songs.length) {

      container.innerHTML =
        emptyState(
          "▶",
          "No YouTube videos found"
        );

      return;

    }

    songs.forEach(
      song => {

        container.appendChild(
          createSongCard(
            song,
            () => {

              const index =
                state.videoSongs.indexOf(
                  song
                );

              playVideoAudio(
                index
              );

            }
          )
        );

      }
    );

  }

  /* =======================================================
     SONG CARD
     ======================================================= */

  function createSongCard(
    song,
    onPlay
  ) {

    const card =
      document.createElement(
        "article"
      );

    card.className =
      "song-card";

    const typeLabel =
      song.type === "youtube"
        ? "YOUTUBE"
        : "MP3";

    card.innerHTML = `

      <div class="song-cover">

        ${
          song.cover
            ? `
              <img
                src="${escapeAttr(song.cover)}"
                alt=""
                loading="lazy"
                onerror="this.style.display='none'"
              >
            `
            : `
              <div class="song-cover-placeholder">
                ${song.type === "youtube" ? "▶" : "♫"}
              </div>
            `
        }

        <span class="song-type">
          ${typeLabel}
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

    `;

    card
      .querySelector(
        ".card-play"
      )
      ?.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          onPlay();

        }
      );

    card.addEventListener(
      "click",
      onPlay
    );

    return card;

  }

  /* =======================================================
     PLAY MP3
     ======================================================= */

  function playMP3(index) {

    if (
      index < 0 ||
      index >=
        state.mp3Songs.length
    ) {
      return;
    }

    const song =
      state.mp3Songs[index];

    if (
      !song.audioUrl
    ) {

      showToast(
        "MP3 URL is missing"
      );

      return;

    }

    stopYouTube();

    state.currentType =
      "mp3";

    state.currentSong =
      song;

    state.mp3Index =
      index;

    audio.src =
      song.audioUrl;

    audio.load();

    const playPromise =
      audio.play();

    if (
      playPromise &&
      typeof playPromise.catch ===
        "function"
    ) {

      playPromise.catch(
        error => {

          console.error(
            "MP3 playback error:",
            error
          );

          showToast(
            "Unable to play this MP3"
          );

        }
      );

    }

    updateMiniPlayer(
      song,
      true
    );

  }

  /* =======================================================
     AUDIO EVENTS
     ======================================================= */

  audio.addEventListener(
    "play",
    () => {

      if (
        state.currentType ===
        "mp3"
      ) {

        updatePlayButtons(
          true
        );

      }

    }
  );

  audio.addEventListener(
    "pause",
    () => {

      if (
        state.currentType ===
        "mp3"
      ) {

        updatePlayButtons(
          false
        );

      }

    }
  );

  audio.addEventListener(
    "ended",
    () => {

      nextMP3();

    }
  );

  /* =======================================================
     PLAY YOUTUBE AS AUDIO
     ======================================================= */

  function playVideoAudio(
    index
  ) {

    if (
      index < 0 ||
      index >=
        state.videoSongs.length
    ) {
      return;
    }

    const song =
      state.videoSongs[index];

    const videoId =
      getYouTubeId(
        song.youtubeUrl
      );

    if (!videoId) {

      showToast(
        "Invalid YouTube URL"
      );

      return;

    }

    state.currentType =
      "youtube";

    state.currentSong =
      song;

    state.videoIndex =
      index;

    state.videoVisible =
      false;

    showSection(
      "videos"
    );

    const playerArea =
      $("videoPlayerArea");

    playerArea
      ?.classList.remove(
        "hidden"
      );

    $("videoPlayerTitle")
      .textContent =
        song.title;

    const frame =
      $("youtubeFrame");

    frame
      ?.classList.remove(
        "video-mode"
      );

    frame
      ?.classList.add(
        "audio-mode"
      );

    $("watchVideoButton")
      .textContent =
        "▶ Watch Video";

    stopMP3();

    updateMiniPlayer(
      song,
      true
    );

    if (
      !state.youtubeReady
    ) {

      loadYouTubeAPI();

      setTimeout(
        () => {

          loadYouTubeVideo(
            videoId
          );

        },
        1200
      );

      return;

    }

    loadYouTubeVideo(
      videoId
    );

  }

  function loadYouTubeVideo(
    videoId
  ) {

    if (
      !state.youtubePlayer
    ) {

      createYouTubePlayer();

    }

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

      updatePlayButtons(
        true
      );

    } catch (error) {

      console.error(
        "YouTube playback failed:",
        error
      );

      showToast(
        "Unable to play YouTube video"
      );

    }

  }

  /* =======================================================
     WATCH VIDEO
     ======================================================= */

  $("watchVideoButton")
    ?.addEventListener(
      "click",
      () => {

        if (
          state.currentType !==
            "youtube" ||
          !state.currentSong
        ) {
          return;
        }

        state.videoVisible =
          !state.videoVisible;

        const frame =
          $("youtubeFrame");

        if (
          state.videoVisible
        ) {

          frame
            ?.classList.remove(
              "audio-mode"
            );

          frame
            ?.classList.add(
              "video-mode"
            );

          $("watchVideoButton")
            .textContent =
              "♪ Audio Mode";

        } else {

          frame
            ?.classList.remove(
              "video-mode"
            );

          frame
            ?.classList.add(
              "audio-mode"
            );

          $("watchVideoButton")
            .textContent =
              "▶ Watch Video";

        }

      }
    );

  /* =======================================================
     STOP FUNCTIONS
     ======================================================= */

  function stopMP3() {

    try {

      audio.pause();

      audio.removeAttribute(
        "src"
      );

      audio.load();

    } catch {}

  }

  function stopYouTube() {

    try {

      if (
        state.youtubePlayer
      ) {

        state.youtubePlayer.stopVideo();

      }

    } catch {}

  }

  /* =======================================================
     NEXT / PREVIOUS MP3
     ======================================================= */

  function nextMP3() {

    if (
      !state.mp3Songs.length
    ) {
      return;
    }

    let next =
      state.mp3Index + 1;

    if (
      next >=
      state.mp3Songs.length
    ) {
      next = 0;
    }

    playMP3(next);

  }

  function previousMP3() {

    if (
      !state.mp3Songs.length
    ) {
      return;
    }

    let previous =
      state.mp3Index - 1;

    if (
      previous < 0
    ) {

      previous =
        state.mp3Songs.length - 1;

    }

    playMP3(previous);

  }

  /* =======================================================
     NEXT / PREVIOUS VIDEO
     ======================================================= */

  function nextVideo() {

    if (
      !state.videoSongs.length
    ) {
      return;
    }

    let next =
      state.videoIndex + 1;

    if (
      next >=
      state.videoSongs.length
    ) {
      next = 0;
    }

    playVideoAudio(
      next
    );

  }

  function previousVideo() {

    if (
      !state.videoSongs.length
    ) {
      return;
    }

    let previous =
      state.videoIndex - 1;

    if (
      previous < 0
    ) {

      previous =
        state.videoSongs.length - 1;

    }

    playVideoAudio(
      previous
    );

  }

  /* =======================================================
     PLAYER CONTROLS
     ======================================================= */

  function bindPlayerControls() {

    $("videoPrevButton")
      ?.addEventListener(
        "click",
        previousVideo
      );

    $("videoNextButton")
      ?.addEventListener(
        "click",
        nextVideo
      );

    $("videoPlayButton")
      ?.addEventListener(
        "click",
        toggleCurrentPlayback
      );

    $("miniPrev")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.currentType ===
            "mp3"
          ) {

            previousMP3();

          } else if (
            state.currentType ===
            "youtube"
          ) {

            previousVideo();

          }

        }
      );

    $("miniNext")
      ?.addEventListener(
        "click",
        () => {

          if (
            state.currentType ===
            "mp3"
          ) {

            nextMP3();

          } else if (
            state.currentType ===
            "youtube"
          ) {

            nextVideo();

          }

        }
      );

    $("miniPlay")
      ?.addEventListener(
        "click",
        toggleCurrentPlayback
      );

    $("miniClose")
      ?.addEventListener(
        "click",
        () => {

          stopMP3();

          stopYouTube();

          $("miniPlayer")
            ?.classList.add(
              "hidden"
            );

        }
      );

    $("refreshButton")
      ?.addEventListener(
        "click",
        loadSongs
      );

  }

  function toggleCurrentPlayback() {

    if (
      state.currentType ===
      "mp3"
    ) {

      if (
        audio.paused
      ) {

        audio.play()
          .catch(
            () => {}
          );

      } else {

        audio.pause();

      }

      return;

    }

    if (
      state.currentType ===
      "youtube"
    ) {

      if (
        !state.youtubePlayer
      ) {
        return;
      }

      try {

        const stateValue =
          state.youtubePlayer
            .getPlayerState();

        if (
          stateValue ===
          YT.PlayerState.PLAYING
        ) {

          state.youtubePlayer
            .pauseVideo();

        } else {

          state.youtubePlayer
            .playVideo();

        }

      } catch {}

    }

  }

  function updatePlayButtons(
    playing
  ) {

    const symbol =
      playing
        ? "❚❚"
        : "▶";

    if ($("miniPlay")) {
      $("miniPlay")
        .textContent =
          symbol;
    }

    if ($("videoPlayButton")) {
      $("videoPlayButton")
        .textContent =
          symbol;
    }

  }

  /* =======================================================
     MINI PLAYER
     ======================================================= */

  function updateMiniPlayer(
    song,
    playing
  ) {

    const mini =
      $("miniPlayer");

    if (!mini) {
      return;
    }

    mini
      .classList.remove(
        "hidden"
      );

    $("miniCover")
      .src =
        song.cover ||
        makeCover(
          song.title
        );

    $("miniTitle")
      .textContent =
        song.title;

    $("miniArtist")
      .textContent =
        `${song.artist} • ${
          song.type === "youtube"
            ? "YouTube"
            : "MP3"
        }`;

    updatePlayButtons(
      playing
    );

  }

  /* =======================================================
     SEARCH
     ======================================================= */

  function bindSearch() {

    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();

          if (!query) {

            renderMP3();

            renderVideos();

            return;

          }

          const results =
            state.allSongs.filter(
              song =>
                song.title
                  .toLowerCase()
                  .includes(query) ||

                song.artist
                  .toLowerCase()
                  .includes(query) ||

                song.category
                  .toLowerCase()
                  .includes(query)
            );

          renderMP3(
            results.filter(
              song =>
                song.type === "mp3"
            )
          );

          renderVideos(
            results.filter(
              song =>
                song.type === "youtube"
            )
          );

          showSection(
            "mp3"
          );

        }
      );

  }

  /* =======================================================
     HOME
     ======================================================= */

  function renderHome() {

    const container =
      $("recentSongs");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    const recent =
      state.allSongs
        .slice(0,8);

    recent.forEach(
      song => {

        container.appendChild(
          createSongCard(
            song,
            () => {

              if (
                song.type ===
                "youtube"
              ) {

                playVideoAudio(
                  state.videoSongs.indexOf(
                    song
                  )
                );

              } else {

                playMP3(
                  state.mp3Songs.indexOf(
                    song
                  )
                );

              }

            }
          )
        );

      }
    );

  }

  /* =======================================================
     CATEGORIES
     ======================================================= */

  function renderCategories() {

    const container =
      $("categoriesGrid");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    const categories =
      [
        ...new Set(
          state.mp3Songs.map(
            song =>
              song.category
          )
        )
      ];

    categories.forEach(
      category => {

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "category-card";

        card.innerHTML = `

          <div style="font-size:28px">
            ♫
          </div>

          <strong>
            ${escapeHtml(category)}
          </strong>

        `;

        card.addEventListener(
          "click",
          () => {

            const songs =
              state.mp3Songs.filter(
                song =>
                  song.category ===
                  category
              );

            renderCategorySongs(
              songs
            );

          }
        );

        container.appendChild(
          card
        );

      }
    );

  }

  function renderCategorySongs(
    songs
  ) {

    const container =
      $("categorySongs");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    songs.forEach(
      song => {

        container.appendChild(
          createSongCard(
            song,
            () => {

              playMP3(
                state.mp3Songs.indexOf(
                  song
                )
              );

            }
          )
        );

      }
    );

  }

  /* =======================================================
     FAVORITES
     ======================================================= */

  function renderFavorites() {

    const container =
      $("favoritesList");

    if (!container) {
      return;
    }

    const songs =
      state.allSongs.filter(
        song =>
          state.favorites.includes(
            song.id
          )
      );

    container.innerHTML =
      "";

    if (!songs.length) {

      container.innerHTML =
        emptyState(
          "♥",
          "No favorite songs"
        );

      return;

    }

    songs.forEach(
      song => {

        container.appendChild(
          createSongCard(
            song,
            () => {

              if (
                song.type ===
                "youtube"
              ) {

                playVideoAudio(
                  state.videoSongs.indexOf(
                    song
                  )
                );

              } else {

                playMP3(
                  state.mp3Songs.indexOf(
                    song
                  )
                );

              }

            }
          )
        );

      }
    );

  }

  /* =======================================================
     ADMIN
     ======================================================= */

  function bindAdmin() {

    $("adminButton")
      ?.addEventListener(
        "click",
        () => {

          showSection(
            "admin"
          );

          if (
            state.adminUnlocked
          ) {

            showAdminContent();

          }

        }
      );

    $("adminLoginForm")
      ?.addEventListener(
        "submit",
        handleAdminLogin
      );

    $("adminLogoutButton")
      ?.addEventListener(
        "click",
        adminLogout
      );

    $("adminRefreshButton")
      ?.addEventListener(
        "click",
        async () => {

          await loadSongs();

          showToast(
            "Library refreshed"
          );

        }
      );

    $("mp3UploadForm")
      ?.addEventListener(
        "submit",
        uploadMP3
      );

    $("youtubeUploadForm")
      ?.addEventListener(
        "submit",
        uploadYouTube
      );

  }

  async function handleAdminLogin(
    event
  ) {

    event.preventDefault();

    const key =
      $("adminKey")
        ?.value
        .trim();

    if (!key) {
      return;
    }

    /*
      Your server can accept this key.
      We do not expose it in the page.
    */

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

      if (
        response.ok
      ) {

        state.adminKey =
          key;

        state.adminUnlocked =
          true;

        sessionStorage.setItem(
          "swarajAdminKey",
          key
        );

        showAdminContent();

        showToast(
          "Admin unlocked"
        );

        return;

      }

      /*
        Fallback for servers that don't
        expose /api/admin/verify.
      */

      if (
        response.status === 404
      ) {

        state.adminKey =
          key;

        state.adminUnlocked =
          true;

        sessionStorage.setItem(
          "swarajAdminKey",
          key
        );

        showAdminContent();

        return;

      }

      throw new Error(
        "Invalid admin key"
      );

    } catch (error) {

      console.error(error);

      $("adminLoginMessage")
        .textContent =
          "Invalid admin key or server unavailable.";

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

  function adminLogout() {

    state.adminUnlocked =
      false;

    state.adminKey =
      null;

    sessionStorage.removeItem(
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

    $("adminKey")
      .value = "";

  }

  /* =======================================================
     MP3 UPLOAD
     ======================================================= */

  async function uploadMP3(
    event
  ) {

    event.preventDefault();

    if (
      !state.adminKey
    ) {

      showToast(
        "Admin authentication required"
      );

      return;

    }

    const payload = {

      title:
        $("uploadTitle")
          .value
          .trim(),

      artist:
        $("uploadArtist")
          .value
          .trim(),

      category:
        $("uploadCategory")
          .value
          .trim(),

      cover:
        $("uploadCover")
          .value
          .trim(),

      audioUrl:
        $("uploadAudioUrl")
          .value
          .trim(),

      type:
        "mp3"

    };

    await submitAdminSong(
      payload,
      $("mp3UploadMessage")
    );

  }

  /* =======================================================
     YOUTUBE UPLOAD
     ======================================================= */

  async function uploadYouTube(
    event
  ) {

    event.preventDefault();

    if (
      !state.adminKey
    ) {

      showToast(
        "Admin authentication required"
      );

      return;

    }

    const youtubeUrl =
      $("youtubeUrl")
        .value
        .trim();

    const videoId =
      getYouTubeId(
        youtubeUrl
      );

    if (!videoId) {

      $("youtubeUploadMessage")
        .textContent =
          "Please enter a valid YouTube URL.";

      return;

    }

    const payload = {

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
          .trim() ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,

      youtubeUrl,

      type:
        "youtube",

      videoId

    };

    await submitAdminSong(
      payload,
      $("youtubeUploadMessage")
    );

  }

  /* =======================================================
     ADMIN API
     ======================================================= */

  async function submitAdminSong(
    payload,
    messageElement
  ) {

    try {

      /*
        Common endpoint.
        Change only this endpoint if your
        existing server uses a different
        admin upload route.
      */

      const response =
        await fetch(
          "/api/admin/songs",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${state.adminKey}`,

              "X-Admin-Key":
                state.adminKey

            },

            body:
              JSON.stringify(
                payload
              )

          }
        );

      const text =
        await response.text();

      let result;

      try {

        result =
          JSON.parse(text);

      } catch {

        result = {
          message: text
        };

      }

      if (
        !response.ok
      ) {

        throw new Error(
          result.message ||
          result.error ||
          `Upload failed (${response.status})`
        );

      }

      messageElement
        .textContent =
          "Successfully added.";

      showToast(
        "Song added successfully"
      );

      await loadSongs();

    } catch (error) {

      console.error(
        "Admin upload error:",
        error
      );

      messageElement
        .textContent =
          error.message ||
          "Upload failed.";

    }

  }

  /* =======================================================
     ADMIN LIST
     ======================================================= */

  function renderAdminSongs() {

    const container =
      $("adminSongList");

    if (!container) {
      return;
    }

    container.innerHTML =
      "";

    state.allSongs.forEach(
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
              song.cover
            )}"
            alt=""
            onerror="this.style.display='none'"
          >

          <div class="admin-song-info">

            <strong>
              ${escapeHtml(
                song.title
              )}
            </strong>

            <small>
              ${escapeHtml(
                song.artist
              )}
              •
              ${song.type === "youtube"
                ? "YouTube"
                : "MP3"}
            </small>

          </div>

        `;

        container.appendChild(
          row
        );

      }
    );

  }

  /* =======================================================
     STATS
     ======================================================= */

  function updateStats() {

    $("mp3Count")
      .textContent =
        state.mp3Songs.length;

    $("videoCount")
      .textContent =
        state.videoSongs.length;

    const categories =
      new Set(
        state.mp3Songs.map(
          song =>
            song.category
        )
      );

    $("categoryCount")
      .textContent =
        categories.size;

  }

  /* =======================================================
     HELPERS
     ======================================================= */

  function makeCover(
    title
  ) {

    const safe =
      encodeURIComponent(
        String(title)
      );

    return `https://dummyimage.com/600x600/11152b/ffffff&text=${safe}`;

  }

  function emptyState(
    icon,
    text
  ) {

    return `

      <div
        style="
          grid-column:1/-1;
          padding:50px;
          text-align:center;
          color:#9ba0b8;
        "
      >

        <div
          style="
            font-size:40px;
            margin-bottom:12px;
          "
        >
          ${icon}
        </div>

        <div>
          ${escapeHtml(text)}
        </div>

      </div>

    `;

  }

  function escapeHtml(
    value
  ) {

    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
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
      showToast.timer
    );

    showToast.timer =
      setTimeout(
        () => {

          toast.classList.remove(
            "show"
          );

        },
        2500
      );

  }

})();