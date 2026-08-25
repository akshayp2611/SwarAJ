/* =========================================================
   SwarAJ MUSIC PLAYER
   ONE COMBINED PLAYLIST
   MP3 + YOUTUBE
   YouTube starts as AUDIO, video shown only on request
   ========================================================= */

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

    adminKey: localStorage.getItem("swarajAdminKey") || null,
    adminUnlocked: false,

    favorites: JSON.parse(
      localStorage.getItem("swarajFavorites") || "[]"
    )
  };

  const $ = id => document.getElementById(id);

  let audio = $("audioPlayer");

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    ensureAudioPlayer();

    bindNavigation();
    bindSearch();
    bindPlayerControls();
    bindAdmin();
    bindHero();

    await loadSongs();

    loadYouTubeAPI();

    restoreAdmin();
  }

  /* =========================================================
     AUDIO PLAYER
     ========================================================= */

  function ensureAudioPlayer() {
    audio = $("audioPlayer");

    if (!audio) {
      audio = document.createElement("audio");

      audio.id = "audioPlayer";
      audio.preload = "metadata";
      audio.controls = false;

      document.body.appendChild(audio);
    }

    audio.addEventListener("play", () => {
      state.isPlaying = true;
      updatePlayButtons(true);
      updateMiniPlayer();
    });

    audio.addEventListener("pause", () => {
      state.isPlaying = false;
      updatePlayButtons(false);
      updateMiniPlayer();
    });

    audio.addEventListener("ended", () => {
      nextSong();
    });

    audio.addEventListener("error", () => {
      console.error("Audio error:", audio.error);

      showToast(
        "Unable to play this audio source"
      );
    });
  }

  /* =========================================================
     LOAD ALL SONGS
     IMPORTANT:
     NO MP3 / VIDEO SEPARATION
     ========================================================= */

  async function loadSongs() {
    try {
      const response = await fetch(
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

      const data = await response.json();

      const songs = Array.isArray(data)
        ? data
        : (
            data.songs ||
            data.data ||
            []
          );

      state.songs = songs
        .map(normalizeSong)
        .filter(Boolean);

      updateStats();

      renderHome();
      renderCombinedPlaylist();
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

  /* =========================================================
     NORMALIZE
     ========================================================= */

  function normalizeSong(raw) {
    if (!raw) return null;

    const sourceType =
      String(
        raw.source_type ||
        raw.sourceType ||
        raw.type ||
        ""
      ).toLowerCase();

    const youtubeUrl =
      raw.youtube_url ||
      raw.youtubeUrl ||
      raw.youtube ||
      raw.video_url ||
      raw.videoUrl ||
      "";

    const audioUrl =
      raw.audio_url ||
      raw.audioUrl ||
      raw.audio ||
      raw.url ||
      raw.path ||
      "";

    const isYouTube =
      sourceType === "youtube" ||
      Boolean(youtubeUrl) ||
      isYouTubeUrl(audioUrl);

    let youtubeId =
      raw.youtube_video_id ||
      raw.youtubeVideoId ||
      "";

    if (!youtubeId && isYouTube) {
      youtubeId =
        getYouTubeId(
          youtubeUrl || audioUrl
        );
    }

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
      isYouTube &&
      !cover &&
      youtubeId
    ) {
      cover =
        `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    if (!cover) {
      cover = "/images/ganpati.jpg";
    }

    return {
      id: String(
        raw.id ||
        raw._id ||
        `${sourceType}-${raw.title}`
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
        isYouTube
          ? "youtube"
          : "mp3",

      audioUrl:
        isYouTube
          ? ""
          : audioUrl,

      youtubeUrl:
        isYouTube
          ? (
              youtubeUrl ||
              audioUrl
            )
          : "",

      youtubeId,

      cover,

      duration:
        raw.duration || "",

      raw
    };
  }

  /* =========================================================
     YOUTUBE URL PARSER
     ========================================================= */

  function isYouTubeUrl(value) {
    if (!value) return false;

    return (
      /youtube\.com/i.test(
        String(value)
      ) ||
      /youtu\.be/i.test(
        String(value)
      )
    );
  }

  function getYouTubeId(value) {
    if (!value) return null;

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
        url.hostname.toLowerCase();

      if (
        host === "youtu.be"
      ) {
        return (
          url.pathname
            .split("/")
            .filter(Boolean)[0] ||
          null
        );
      }

      if (
        host === "youtube.com" ||
        host === "www.youtube.com" ||
        host.endsWith(".youtube.com")
      ) {
        const v =
          url.searchParams.get("v");

        if (v) return v;

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
          index >= 0 &&
          parts[index + 1]
        ) {
          return parts[index + 1];
        }
      }

    } catch (error) {
      console.warn(
        "Invalid YouTube URL:",
        value
      );
    }

    return null;
  }

  /* =========================================================
     YOUTUBE API
     ========================================================= */

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
        state.youtubeReady = true;
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

    if (!container) return;

    container.innerHTML = `
      <div id="youtube-player"></div>
    `;

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
                handleYouTubeState,

              onError:
                handleYouTubeError
            }
          }
        );

    } catch (error) {
      console.error(
        "YouTube player creation error:",
        error
      );
    }
  }

  function handleYouTubeReady() {
    state.youtubeReady = true;
  }

  function handleYouTubeError(event) {
    console.error(
      "YouTube playback error:",
      event.data
    );

    showToast(
      "YouTube cannot play this video"
    );
  }

  function handleYouTubeState(event) {
    if (!window.YT) return;

    switch (event.data) {
      case YT.PlayerState.PLAYING:
        state.isPlaying = true;
        updatePlayButtons(true);
        updateMiniPlayer();
        break;

      case YT.PlayerState.PAUSED:
        state.isPlaying = false;
        updatePlayButtons(false);
        updateMiniPlayer();
        break;

      case YT.PlayerState.ENDED:
        nextSong();
        break;
    }
  }

  /* =========================================================
     ONE COMBINED PLAYLIST
     ========================================================= */

  function renderCombinedPlaylist() {
    const containers = [
      $("mp3Playlist"),
      $("videoPlaylist")
    ];

    containers.forEach(container => {
      if (!container) return;

      container.innerHTML = "";

      if (!state.songs.length) {
        container.innerHTML =
          emptyState(
            "♫",
            "No songs found"
          );
        return;
      }

      state.songs.forEach(
        (song, index) => {

          const card =
            createSongCard(
              song,
              index
            );

          container.appendChild(
            card
          );
        }
      );
    });
  }

  /* =========================================================
     SONG CARD
     ========================================================= */

  function createSongCard(
    song,
    index
  ) {
    const card =
      document.createElement(
        "article"
      );

    card.className =
      "song-card";

    const label =
      song.type === "youtube"
        ? "YOUTUBE"
        : "MP3";

    card.innerHTML = `
      <div class="song-cover">

        <img
          src="${escapeAttr(song.cover)}"
          alt="${escapeAttr(song.title)}"
          loading="lazy"
          onerror="
            this.onerror=null;
            this.src='/images/ganpati.jpg';
          "
        >

        <span class="song-type">
          ${label}
        </span>

        <button
          class="card-play"
          type="button"
          aria-label="Play ${escapeAttr(song.title)}"
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

      <small class="song-category">
        ${escapeHtml(song.category)}
      </small>
    `;

    card
      .querySelector(".card-play")
      ?.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          playSong(index);
        }
      );

    card.addEventListener(
      "click",
      () => playSong(index)
    );

    return card;
  }

  /* =========================================================
     PLAY ANY SONG
     ========================================================= */

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

    if (
      song.type === "youtube"
    ) {
      playYouTubeAsAudio(
        song
      );
    } else {
      playMP3(
        song
      );
    }

    updateCurrentSongUI();
    updateMiniPlayer();
  }

  /* =========================================================
     MP3 PLAYBACK
     ========================================================= */

  async function playMP3(song) {
    stopYouTube();

    state.videoVisible = false;

    hideVideoArea();

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
        "MP3 playback error:",
        error
      );

      showToast(
        "Unable to play MP3"
      );
    }
  }

  /* =========================================================
     YOUTUBE AS AUDIO
     ========================================================= */

  function playYouTubeAsAudio(song) {
    const id =
      song.youtubeId ||
      getYouTubeId(
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

    stopMP3();

    showAudioMode();

    if (
      !state.youtubeReady ||
      !state.youtubePlayer
    ) {
      showToast(
        "YouTube player is loading..."
      );

      setTimeout(
        () => {
          if (
            state.youtubeReady
          ) {
            loadAndPlayYouTube(
              id
            );
          }
        },
        1000
      );

      return;
    }

    loadAndPlayYouTube(
      id
    );
  }

  function loadAndPlayYouTube(id) {
    try {
      state.youtubePlayer.loadVideoById(
        {
          videoId: id,
          startSeconds: 0
        }
      );

      state.youtubePlayer.playVideo();

      state.isPlaying = true;

      updatePlayButtons(true);

      showWatchVideoOption();

    } catch (error) {
      console.error(
        "YouTube play error:",
        error
      );

      showToast(
        "YouTube playback failed"
      );
    }
  }

  /* =========================================================
     WATCH VIDEO
     ========================================================= */

  function watchCurrentVideo() {
    if (
      !state.currentSong ||
      state.currentSong.type !==
        "youtube"
    ) {
      return;
    }

    state.videoVisible =
      true;

    showVideoMode();

    if (
      state.youtubePlayer
    ) {
      try {
        state.youtubePlayer.playVideo();
      } catch {}
    }
  }

  function showWatchVideoOption() {
    const button =
      $("watchVideoButton");

    if (!button) return;

    button.classList.remove(
      "hidden"
    );

    button.style.display =
      "inline-flex";

    button.textContent =
      "▶ Watch Video";
  }

  function hideVideoArea() {
    const area =
      $("videoPlayerArea");

    if (!area) return;

    area.classList.add(
      "hidden"
    );
  }

  function showAudioMode() {
    const area =
      $("videoPlayerArea");

    const frame =
      $("youtubeFrame");

    if (!area) return;

    area.classList.remove(
      "hidden"
    );

    if (frame) {
      frame.classList.add(
        "audio-mode"
      );

      frame.classList.remove(
        "video-mode"
      );
    }

    const button =
      $("watchVideoButton");

    if (button) {
      button.style.display =
        "inline-flex";
    }

    const label =
      document.querySelector(
        ".player-label"
      );

    if (label) {
      label.textContent =
        "PLAYING AS AUDIO";
    }
  }

  function showVideoMode() {
    const area =
      $("videoPlayerArea");

    const frame =
      $("youtubeFrame");

    if (!area) return;

    area.classList.remove(
      "hidden"
    );

    if (frame) {
      frame.classList.remove(
        "audio-mode"
      );

      frame.classList.add(
        "video-mode"
      );
    }

    const button =
      $("watchVideoButton");

    if (button) {
      button.style.display =
        "none";
    }

    const label =
      document.querySelector(
        ".player-label"
      );

    if (label) {
      label.textContent =
        "WATCHING VIDEO";
    }
  }

  /* =========================================================
     STOP
     ========================================================= */

  function stopMP3() {
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
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

  /* =========================================================
     NEXT
     ========================================================= */

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

  /* =========================================================
     PREVIOUS
     ========================================================= */

  function previousSong() {
    if (!state.songs.length) {
      return;
    }

    let previous =
      state.currentIndex - 1;

    if (previous < 0) {
      previous =
        state.songs.length - 1;
    }

    playSong(previous);
  }

  /* =========================================================
     PLAYER CONTROLS
     ========================================================= */

  function bindPlayerControls() {
    $("watchVideoButton")
      ?.addEventListener(
        "click",
        watchCurrentVideo
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
      .querySelector(
        "[data-player='previous']"
      )
      ?.addEventListener(
        "click",
        previousSong
      );

    document
      .querySelector(
        "[data-player='next']"
      )
      ?.addEventListener(
        "click",
        nextSong
      );

    document
      .querySelector(
        "[data-player='play']"
      )
      ?.addEventListener(
        "click",
        togglePlay
      );
  }

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
      ) return;

      if (state.isPlaying) {
        state.youtubePlayer.pauseVideo();
      } else {
        state.youtubePlayer.playVideo();
      }

    } else {
      if (!audio) return;

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
  }

  function updatePlayButtons(
    playing
  ) {
    document
      .querySelectorAll(
        ".play-control, [data-player='play'], #videoPlayButton"
      )
      .forEach(button => {
        button.textContent =
          playing
            ? "❚❚"
            : "▶";
      });
  }

  /* =========================================================
     CURRENT SONG UI
     ========================================================= */

  function updateCurrentSongUI() {
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
      .forEach(el => {
        el.textContent =
          song.title;
      });

    document
      .querySelectorAll(
        "[data-current-artist]"
      )
      .forEach(el => {
        el.textContent =
          song.artist;
      });

    document
      .querySelectorAll(
        "[data-current-cover]"
      )
      .forEach(el => {
        el.src =
          song.cover;
      });
  }

  /* =========================================================
     MINI PLAYER
     ========================================================= */

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

    const title =
      mini.querySelector(
        "[data-mini-title]"
      );

    const artist =
      mini.querySelector(
        "[data-mini-artist]"
      );

    const image =
      mini.querySelector(
        "[data-mini-image]"
      );

    if (title) {
      title.textContent =
        song.title;
    }

    if (artist) {
      artist.textContent =
        song.artist;
    }

    if (image) {
      image.src =
        song.cover;
    }
  }

  /* =========================================================
     HOME
     ========================================================= */

  function renderHome() {
    const container =
      $("recentSongs");

    if (!container) return;

    container.innerHTML = "";

    state.songs
      .slice(0, 8)
      .forEach(
        (song, index) => {
          container.appendChild(
            createSongCard(
              song,
              index
            )
          );
        }
      );
  }

  /* =========================================================
     CATEGORIES
     ========================================================= */

  function renderCategories() {
    const grid =
      $("categoriesGrid");

    if (!grid) return;

    const map =
      new Map();

    state.songs.forEach(
      song => {
        const name =
          song.category ||
          "Other";

        if (!map.has(name)) {
          map.set(name, []);
        }

        map.get(name).push(
          song
        );
      }
    );

    grid.innerHTML = "";

    map.forEach(
      (songs, category) => {

        const button =
          document.createElement(
            "button"
          );

        button.className =
          "category-card";

        button.innerHTML = `
          <strong>
            ${escapeHtml(category)}
          </strong>

          <span>
            ${songs.length} songs
          </span>
        `;

        button.addEventListener(
          "click",
          () => {
            renderCategorySongs(
              songs
            );
          }
        );

        grid.appendChild(
          button
        );
      }
    );
  }

  function renderCategorySongs(
    songs
  ) {
    const container =
      $("categorySongs");

    if (!container) return;

    container.innerHTML = "";

    songs.forEach(
      song => {
        const index =
          state.songs.indexOf(
            song
          );

        container.appendChild(
          createSongCard(
            song,
            index
          )
        );
      }
    );
  }

  /* =========================================================
     FAVORITES
     ========================================================= */

  function renderFavorites() {
    const container =
      $("favoritesList");

    if (!container) return;

    const songs =
      state.songs.filter(
        song =>
          state.favorites.includes(
            song.id
          )
      );

    container.innerHTML = "";

    if (!songs.length) {
      container.innerHTML =
        emptyState(
          "♥",
          "No favorite songs"
        );

      return;
    }

    songs.forEach(song => {
      const index =
        state.songs.indexOf(
          song
        );

      container.appendChild(
        createSongCard(
          song,
          index
        )
      );
    });
  }

  /* =========================================================
     STATS
     ========================================================= */

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

  /* =========================================================
     SEARCH
     ========================================================= */

  function bindSearch() {
    $("searchInput")
      ?.addEventListener(
        "input",
        event => {

          const query =
            event.target.value
              .trim()
              .toLowerCase();

          const filtered =
            state.songs.filter(
              song =>
                song.title
                  .toLowerCase()
                  .includes(query) ||
                song.artist
                  .toLowerCase()
                  .includes(query) ||
                song.album
                  .toLowerCase()
                  .includes(query) ||
                song.category
                  .toLowerCase()
                  .includes(query)
            );

          renderSearchResults(
            filtered
          );
        }
      );
  }

  function renderSearchResults(
    songs
  ) {
    const container =
      $("recentSongs");

    if (!container) return;

    container.innerHTML = "";

    songs.forEach(song => {
      const index =
        state.songs.indexOf(
          song
        );

      container.appendChild(
        createSongCard(
          song,
          index
        )
      );
    });
  }

  /* =========================================================
     ADMIN
     ========================================================= */

  function bindAdmin() {
    $("adminButton")
      ?.addEventListener(
        "click",
        () => {
          showSection("admin");
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
        loadAdminSongs
      );

    $("youtubeUploadForm")
      ?.addEventListener(
        "submit",
        handleYouTubeUpload
      );

    $("mp3UploadForm")
      ?.addEventListener(
        "submit",
        handleMP3UrlUpload
      );
  }

  function restoreAdmin() {
    if (!state.adminKey) {
      showAdminLogin();
      return;
    }

    verifyAdminKey();
  }

  async function verifyAdminKey() {
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
        throw new Error(
          "Invalid key"
        );
      }

      state.adminUnlocked =
        true;

      showAdminContent();

      await loadAdminSongs();

    } catch {
      state.adminKey = null;
      localStorage.removeItem(
        "swarajAdminKey"
      );

      showAdminLogin();
    }
  }

  async function handleAdminLogin(
    event
  ) {
    event.preventDefault();

    const input =
      $("adminKey");

    const key =
      input?.value.trim();

    if (!key) return;

    try {
      const response =
        await fetch(
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

      state.adminUnlocked =
        true;

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
      const message =
        $("adminLoginMessage");

      if (message) {
        message.textContent =
          error.message;
      }

      showToast(
        error.message
      );
    }
  }

  function adminLogout() {
    state.adminKey = null;
    state.adminUnlocked =
      false;

    localStorage.removeItem(
      "swarajAdminKey"
    );

    showAdminLogin();

    showToast(
      "Admin logged out"
    );
  }

  function showAdminLogin() {
    $("adminLogin")
      ?.classList.remove(
        "hidden"
      );

    $("adminContent")
      ?.classList.add(
        "hidden"
      );
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

  /* =========================================================
     YOUTUBE ADMIN UPLOAD
     ========================================================= */

  async function handleYouTubeUpload(
    event
  ) {
    event.preventDefault();

    if (!state.adminKey) {
      showToast(
        "Admin key required"
      );
      return;
    }

    const title =
      $("youtubeTitle")
        ?.value.trim();

    const artist =
      $("youtubeArtist")
        ?.value.trim();

    const category =
      $("youtubeCategory")
        ?.value.trim();

    const coverUrl =
      $("youtubeCover")
        ?.value.trim();

    const youtubeUrl =
      $("youtubeUrl")
        ?.value.trim();

    try {
      const response =
        await fetch(
          "/api/admin/songs/youtube",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-key":
                state.adminKey
            },

            body:
              JSON.stringify({
                title,
                artist,
                category,
                coverUrl,
                youtubeUrl
              })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "YouTube upload failed"
        );
      }

      event.target.reset();

      if ($("youtubeCategory")) {
        $("youtubeCategory").value =
          "Other";
      }

      showToast(
        "YouTube song added"
      );

      await loadSongs();

    } catch (error) {
      console.error(error);

      showToast(
        error.message
      );
    }
  }

  /* =========================================================
     MP3 URL ADMIN
     ========================================================= */

  async function handleMP3UrlUpload(
    event
  ) {
    event.preventDefault();

    if (!state.adminKey) {
      showToast(
        "Admin key required"
      );
      return;
    }

    const title =
      $("uploadTitle")
        ?.value.trim();

    const artist =
      $("uploadArtist")
        ?.value.trim();

    const category =
      $("uploadCategory")
        ?.value.trim();

    const coverUrl =
      $("uploadCover")
        ?.value.trim();

    const audioUrl =
      $("uploadAudioUrl")
        ?.value.trim();

    try {
      const response =
        await fetch(
          "/api/admin/songs/mp3-url",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-key":
                state.adminKey
            },

            body:
              JSON.stringify({
                title,
                artist,
                category,
                coverUrl,
                audioUrl
              })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "MP3 upload failed"
        );
      }

      event.target.reset();

      if ($("uploadCategory")) {
        $("uploadCategory").value =
          "Other";
      }

      showToast(
        "MP3 added"
      );

      await loadSongs();

    } catch (error) {
      console.error(error);

      showToast(
        error.message
      );
    }
  }

  /* =========================================================
     ADMIN SONGS
     ========================================================= */

  async function loadAdminSongs() {
    if (!state.adminKey) {
      return;
    }

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
        throw new Error(
          "Unable to load admin songs"
        );
      }

      const data =
        await response.json();

      renderAdminSongs(
        data.songs || []
      );

    } catch (error) {
      console.error(error);
    }
  }

  function renderAdminSongs(
    songs = state.songs
  ) {
    const container =
      $("adminSongList");

    if (!container) return;

    container.innerHTML = "";

    songs.forEach(song => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "admin-song-row";

      row.innerHTML = `
        <img
          src="${escapeAttr(song.cover)}"
          alt=""
          onerror="
            this.onerror=null;
            this.src='/images/ganpati.jpg';
          "
        >

        <div class="admin-song-info">
          <strong>
            ${escapeHtml(song.title)}
          </strong>

          <small>
            ${escapeHtml(song.artist)}
            ·
            ${song.type === "youtube"
              ? "YouTube"
              : "MP3"}
          </small>
        </div>

        <button
          class="danger-button"
          type="button"
          data-delete-id="${escapeAttr(song.id)}"
        >
          Delete
        </button>
      `;

      row
        .querySelector(
          "[data-delete-id]"
        )
        ?.addEventListener(
          "click",
          () =>
            deleteSong(
              song.id
            )
        );

      container.appendChild(
        row
      );
    });
  }

  async function deleteSong(id) {
    if (
      !state.adminKey ||
      !confirm(
        "Delete this song?"
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/admin/songs/${encodeURIComponent(id)}`,
          {
            method: "DELETE",

            headers: {
              "x-admin-key":
                state.adminKey
            }
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Delete failed"
        );
      }

      showToast(
        "Song deleted"
      );

      await loadSongs();

    } catch (error) {
      showToast(
        error.message
      );
    }
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function bindNavigation() {
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

  /* =========================================================
     HERO
     ========================================================= */

  function bindHero() {
    $("heroPlayButton")
      ?.addEventListener(
        "click",
        () => {
          if (state.songs.length) {
            playSong(0);
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

          const firstYouTube =
            state.songs.findIndex(
              song =>
                song.type ===
                "youtube"
            );

          if (
            firstYouTube >= 0
          ) {
            playSong(
              firstYouTube
            );
          }
        }
      );
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function emptyState(
    icon,
    message
  ) {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          ${icon}
        </div>

        <h3>
          ${escapeHtml(message)}
        </h3>
      </div>
    `;
  }

  function makeCover(
    title
  ) {
    return "/images/ganpati.jpg";
  }

  function escapeHtml(
    value
  ) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(
    value
  ) {
    return escapeHtml(
      value || ""
    );
  }

  function showToast(
    message
  ) {
    let toast =
      $("swarajToast");

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "swarajToast";

      toast.className =
        "swaraj-toast";

      document.body.appendChild(
        toast
      );
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
        3000
      );
  }

})();