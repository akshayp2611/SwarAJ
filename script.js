(() => {

  "use strict";

  /* =====================================================
     HELPERS
     ===================================================== */

  const $ = (id) => document.getElementById(id);

  const audio = $("audioPlayer");

  const state = {

    songs: [],

    filteredSongs: [],

    currentIndex: -1,

    category: "All",

    search: "",

    shuffle: false,

    repeat: false,

    liked: new Set(
      JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
      )
    )

  };

  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }

  function getTitle(song) {

    return (
      song?.title ||
      song?.name ||
      song?.file_name ||
      "Unknown Song"
    );

  }

  function getArtist(song) {

    return (
      song?.artist ||
      song?.artist_name ||
      "SwarAJ"
    );

  }

  function getAudioUrl(song) {

    return (
      song?.audio_url ||
      song?.audioUrl ||
      song?.url ||
      song?.src ||
      null
    );

  }

  function getSongKey(song) {

    return String(
      song?.id ??
      song?.audio_url ??
      song?.file_name ??
      song?.title ??
      Math.random()
    );

  }

  function showToast(message) {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer =
      setTimeout(() => {

        toast.classList.remove("show");

      }, 2200);

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

    return (
      minutes +
      ":" +
      String(secs).padStart(2, "0")
    );

  }

  /* =====================================================
     YOUTUBE ID
     ===================================================== */

  function getYouTubeId(song) {

    if (!song) return null;

    if (song.youtube_video_id) {

      return song.youtube_video_id;

    }

    if (song.youtubeId) {

      return song.youtubeId;

    }

    const url =
      song.youtube_url ||
      song.youtubeUrl ||
      song.youtube ||
      null;

    if (!url) return null;

    const match =
      String(url).match(
        /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/
      );

    return match
      ? match[1]
      : null;

  }

  /* =====================================================
     LOAD SONGS
     ===================================================== */

  async function loadSongs() {

    try {

      showLoading();

      const response =
        await fetch(
          "/api/songs",
          {
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          "HTTP " + response.status
        );

      }

      const data =
        await response.json();

      let songs = [];

      if (Array.isArray(data)) {

        songs = data;

      } else if (
        Array.isArray(data.songs)
      ) {

        songs = data.songs;

      } else if (
        Array.isArray(data.data)
      ) {

        songs = data.data;

      }

      state.songs =
        songs.map(
          (song, index) => ({

            ...song,

            _key:
              getSongKey(song) +
              "-" +
              index

          })
        );

      state.currentIndex = -1;

      renderCategories();

      applyFilter();

      updateSongCount();

    } catch (error) {

      console.error(
        "SwarAJ song loading error:",
        error
      );

      $("songGrid").innerHTML = `
        <div class="loading">
          Unable to load songs.
          <br>
          <small>
            Check that /api/songs is working.
          </small>
        </div>
      `;

      showToast(
        "Could not load songs"
      );

    }

  }

  function showLoading() {

    if (!$("songGrid")) return;

    $("songGrid").innerHTML = `
      <div class="loading">
        Loading songs...
      </div>
    `;

  }

  /* =====================================================
     CATEGORIES
     ===================================================== */

  function getCategories() {

    const categories =
      state.songs
        .map(
          song =>
            String(
              song.category ||
              "Other"
            )
        )
        .filter(Boolean);

    return [
      "All",
      ...new Set(categories)
    ];

  }

  function renderCategories() {

    const container =
      $("categoryBar");

    if (!container) return;

    const categories =
      getCategories();

    container.innerHTML =
      categories
        .map(
          category => `
            <button
              type="button"
              class="category ${
                category === state.category
                  ? "active"
                  : ""
              }"
              data-category="${escapeHTML(category)}"
            >
              ${escapeHTML(category)}
            </button>
          `
        )
        .join("");

    container
      .querySelectorAll(
        ".category"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            state.category =
              button.dataset.category;

            renderCategories();

            applyFilter();

          }
        );

      });

  }

  /* =====================================================
     FILTER / SEARCH
     ===================================================== */

  function applyFilter() {

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

          const matchesCategory =
            state.category === "All" ||
            category === state.category;

          if (!matchesCategory) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable = [

            getTitle(song),

            getArtist(song),

            song.album,

            song.category,

            song.file_name

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query
          );

        }
      );

    updateSectionTitle();

    renderSongs();

  }

  function updateSectionTitle() {

    const title =
      $("sectionTitle");

    if (!title) return;

    if (state.search) {

      title.textContent =
        `Search: ${state.search}`;

      return;

    }

    if (
      state.category === "All"
    ) {

      title.textContent =
        "All Songs";

    } else {

      title.textContent =
        state.category;

    }

  }

  function updateSongCount() {

    const count =
      $("songCount");

    if (!count) return;

    count.textContent =
      `${state.songs.length} songs`;

  }

  /* =====================================================
     RENDER SONGS
     ===================================================== */

  function renderSongs() {

    const grid =
      $("songGrid");

    if (!grid) return;

    if (
      !state.filteredSongs.length
    ) {

      grid.innerHTML = `
        <div class="loading">
          No songs found.
        </div>
      `;

      return;

    }

    grid.innerHTML =
      state.filteredSongs
        .map(
          song => {

            const liked =
              state.liked.has(
                song._key
              );

            const playing =
              state.songs[
                state.currentIndex
              ]?._key === song._key;

            const cover =
              song.cover_url ||
              song.cover ||
              song.coverUrl ||
              null;

            return `
              <article
                class="song-card ${
                  playing
                    ? "playing"
                    : ""
                }"
                data-song-key="${escapeHTML(song._key)}"
              >

                <div class="cover">

                  ${
                    cover
                      ? `
                        <img
                          src="${escapeHTML(cover)}"
                          alt=""
                          loading="lazy"
                          onerror="this.style.display='none'"
                        >
                      `
                      : `
                        <div class="cover-fallback">
                          ♪
                        </div>
                      `
                  }

                  <div class="card-actions">

                    <button
                      type="button"
                      class="like-card"
                      title="Like"
                    >
                      ${
                        liked
                          ? "♥"
                          : "♡"
                      }
                    </button>

                  </div>

                  <button
                    type="button"
                    class="card-play"
                    title="Play"
                  >
                    ▶
                  </button>

                </div>

                <div class="song-info">

                  <div class="song-title">
                    ${escapeHTML(
                      getTitle(song)
                    )}
                  </div>

                  <div class="song-artist">
                    ${escapeHTML(
                      getArtist(song)
                    )}
                  </div>

                  <div class="song-category">
                    ${escapeHTML(
                      song.category ||
                      "Other"
                    )}
                  </div>

                </div>

              </article>
            `;

          }
        )
        .join("");

    grid
      .querySelectorAll(
        ".song-card"
      )
      .forEach(card => {

        const song =
          state.filteredSongs.find(
            item =>
              item._key ===
              card.dataset.songKey
          );

        if (!song) return;

        card.addEventListener(
          "click",
          event => {

            if (
              event.target.closest(
                ".like-card"
              )
            ) {
              return;
            }

            playSong(song);

          }
        );

        const like =
          card.querySelector(
            ".like-card"
          );

        like?.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            toggleLike(song);

          }
        );

      });

  }

  /* =====================================================
     PLAY SONG
     ===================================================== */

  async function playSong(song) {

    if (!song) return;

    const index =
      state.songs.findIndex(
        item =>
          item._key ===
          song._key
      );

    if (index < 0) return;

    state.currentIndex = index;

    updatePlayer(song);

    renderSongs();

    const audioUrl =
      getAudioUrl(song);

    /*
     * Existing local filesystem songs
     * normally arrive from server.js as:
     *
     * /songs/category/file.mp3
     *
     * Existing database mp3 songs can arrive as:
     *
     * /api/songs/:id/audio
     */

    if (audioUrl) {

      try {

        audio.pause();

        audio.src = audioUrl;

        audio.load();

        await audio.play();

      } catch (error) {

        console.error(
          "Audio playback error:",
          error
        );

        showToast(
          "Tap Play to start the song"
        );

      }

      return;

    }

    /*
     * IMPORTANT:
     *
     * YouTube does NOT automatically
     * open the video here.
     *
     * The Watch button is responsible
     * for displaying the video.
     */

    if (getYouTubeId(song)) {

      showToast(
        "Use Watch to open the YouTube video"
      );

      return;

    }

    showToast(
      "No playable audio found"
    );

  }

  /* =====================================================
     PLAYER UPDATE
     ===================================================== */

  function updatePlayer(song) {

    if (!song) return;

    $("playerTitle").textContent =
      getTitle(song);

    $("playerArtist").textContent =
      getArtist(song);

    const cover =
      song.cover_url ||
      song.cover ||
      song.coverUrl ||
      null;

    if (cover) {

      $("playerCover").innerHTML = `
        <img
          src="${escapeHTML(cover)}"
          alt=""
        >
      `;

    } else {

      $("playerCover").textContent =
        "♪";

    }

    $("likeBtn").textContent =
      state.liked.has(song._key)
        ? "♥"
        : "♡";

    const hasYouTube =
      Boolean(
        getYouTubeId(song)
      );

    $("watchBtn").hidden =
      !hasYouTube;

    updateMediaSession(song);

  }

  /* =====================================================
     PLAY / PAUSE
     ===================================================== */

  function togglePlayPause() {

    const current =
      getCurrentSong();

    if (!current) {

      if (
        state.filteredSongs.length
      ) {

        playSong(
          state.filteredSongs[0]
        );

      } else {

        showToast(
          "No songs available"
        );

      }

      return;

    }

    if (audio.paused) {

      audio.play()
        .catch(
          () =>
            showToast(
              "Tap Play again"
            )
        );

    } else {

      audio.pause();

    }

  }

  /* =====================================================
     CURRENT SONG
     ===================================================== */

  function getCurrentSong() {

    if (
      state.currentIndex < 0
    ) {
      return null;
    }

    return (
      state.songs[
        state.currentIndex
      ] || null
    );

  }

  /* =====================================================
     NEXT
     ===================================================== */

  function playNext() {

    if (!state.songs.length) {
      return;
    }

    let nextIndex;

    if (state.shuffle) {

      if (
        state.songs.length === 1
      ) {

        nextIndex = 0;

      } else {

        do {

          nextIndex =
            Math.floor(
              Math.random() *
              state.songs.length
            );

        } while (
          nextIndex ===
          state.currentIndex
        );

      }

    } else {

      nextIndex =
        state.currentIndex < 0
          ? 0
          : (
              state.currentIndex + 1
            ) %
            state.songs.length;

    }

    playSong(
      state.songs[nextIndex]
    );

  }

  /* =====================================================
     PREVIOUS
     ===================================================== */

  function playPrevious() {

    if (!state.songs.length) {
      return;
    }

    if (
      audio.currentTime > 5
    ) {

      audio.currentTime = 0;

      return;

    }

    const index =
      state.currentIndex <= 0
        ? state.songs.length - 1
        : state.currentIndex - 1;

    playSong(
      state.songs[index]
    );

  }

  /* =====================================================
     LIKE
     ===================================================== */

  function toggleLike(song) {

    if (!song) return;

    if (
      state.liked.has(
        song._key
      )
    ) {

      state.liked.delete(
        song._key
      );

    } else {

      state.liked.add(
        song._key
      );

    }

    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        [...state.liked]
      )
    );

    const current =
      getCurrentSong();

    if (
      current &&
      current._key === song._key
    ) {

      $("likeBtn").textContent =
        state.liked.has(song._key)
          ? "♥"
          : "♡";

    }

    renderSongs();

  }

  /* =====================================================
     WATCH YOUTUBE
     ===================================================== */

  function watchCurrentSong() {

    const song =
      getCurrentSong();

    if (!song) {

      showToast(
        "Select a song first"
      );

      return;

    }

    const videoId =
      getYouTubeId(song);

    if (!videoId) {

      showToast(
        "No YouTube video available"
      );

      return;

    }

    /*
     * YouTube video is displayed ONLY here.
     */

    $("youtubeFrame").innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0"
        title="${escapeHTML(
          getTitle(song)
        )}"
        allow="
          autoplay;
          encrypted-media;
          picture-in-picture;
          web-share
        "
        allowfullscreen
      ></iframe>
    `;

    $("videoModal")
      .classList
      .remove("hidden");

  }

  function closeVideo() {

    $("youtubeFrame").innerHTML = "";

    $("videoModal")
      .classList
      .add("hidden");

  }

  /* =====================================================
     MEDIA SESSION
     ===================================================== */

  function updateMediaSession(song) {

    if (
      !("mediaSession" in navigator)
    ) {
      return;
    }

    try {

      navigator.mediaSession.metadata =
        new MediaMetadata({

          title:
            getTitle(song),

          artist:
            getArtist(song),

          album:
            song.album ||
            "SwarAJ"

        });

    } catch (error) {

      console.warn(
        "Media Session metadata error:",
        error
      );

    }

  }

  function setupMediaSession() {

    if (
      !("mediaSession" in navigator)
    ) {
      return;
    }

    const actions = {

      play:
        () =>
          audio.play(),

      pause:
        () =>
          audio.pause(),

      previoustrack:
        playPrevious,

      nexttrack:
        playNext,

      seekbackward:
        () => {

          audio.currentTime =
            Math.max(
              0,
              audio.currentTime - 10
            );

        },

      seekforward:
        () => {

          audio.currentTime =
            Math.min(
              audio.duration || 0,
              audio.currentTime + 10
            );

        }

    };

    Object.entries(actions)
      .forEach(
        ([action, handler]) => {

          try {

            navigator.mediaSession
              .setActionHandler(
                action,
                handler
              );

          } catch {

            // Some browsers don't
            // support every action.

          }

        }
      );

  }

  /* =====================================================
     AUDIO EVENTS
     ===================================================== */

  audio.addEventListener(
    "play",
    () => {

      $("playBtn").textContent =
        "❚❚";

      if (
        "mediaSession" in navigator
      ) {

        navigator.mediaSession
          .playbackState =
          "playing";

      }

    }
  );

  audio.addEventListener(
    "pause",
    () => {

      $("playBtn").textContent =
        "▶";

      if (
        "mediaSession" in navigator
      ) {

        navigator.mediaSession
          .playbackState =
          "paused";

      }

    }
  );

  audio.addEventListener(
    "loadedmetadata",
    () => {

      $("duration").textContent =
        formatTime(
          audio.duration
        );

    }
  );

  audio.addEventListener(
    "timeupdate",
    () => {

      $("currentTime").textContent =
        formatTime(
          audio.currentTime
        );

      const seek =
        $("seekBar");

      if (
        audio.duration &&
        Number.isFinite(
          audio.duration
        )
      ) {

        seek.value =
          (
            audio.currentTime /
            audio.duration
          ) * 100;

      }

    }
  );

  audio.addEventListener(
    "ended",
    () => {

      if (state.repeat) {

        audio.currentTime = 0;

        audio.play()
          .catch(() => {});

      } else {

        playNext();

      }

    }
  );

  audio.addEventListener(
    "error",
    () => {

      console.error(
        "Audio element error",
        audio.error
      );

      showToast(
        "Audio file failed to load"
      );

    }
  );

  /* =====================================================
     BUTTON EVENTS
     ===================================================== */

  $("playBtn")
    .addEventListener(
      "click",
      togglePlayPause
    );

  $("nextBtn")
    .addEventListener(
      "click",
      playNext
    );

  $("prevBtn")
    .addEventListener(
      "click",
      playPrevious
    );

  $("shuffleBtn")
    .addEventListener(
      "click",
      () => {

        state.shuffle =
          !state.shuffle;

        $("shuffleBtn")
          .classList
          .toggle(
            "active",
            state.shuffle
          );

      }
    );

  $("repeatBtn")
    .addEventListener(
      "click",
      () => {

        state.repeat =
          !state.repeat;

        $("repeatBtn")
          .classList
          .toggle(
            "active",
            state.repeat
          );

      }
    );

  $("likeBtn")
    .addEventListener(
      "click",
      () => {

        toggleLike(
          getCurrentSong()
        );

      }
    );

  $("watchBtn")
    .addEventListener(
      "click",
      watchCurrentSong
    );

  $("videoClose")
    .addEventListener(
      "click",
      closeVideo
    );

  $("videoModal")
    .addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("videoModal")
        ) {

          closeVideo();

        }

      }
    );

  /* =====================================================
     SEEK
     ===================================================== */

  $("seekBar")
    .addEventListener(
      "input",
      event => {

        if (
          !audio.duration
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

  /* =====================================================
     VOLUME
     ===================================================== */

  $("volumeBar")
    .addEventListener(
      "input",
      event => {

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

  $("muteBtn")
    .addEventListener(
      "click",
      () => {

        audio.muted =
          !audio.muted;

        $("muteBtn").textContent =
          audio.muted
            ? "🔇"
            : "🔊";

      }
    );

  /* =====================================================
     SEARCH
     ===================================================== */

  $("searchInput")
    .addEventListener(
      "input",
      event => {

        state.search =
          event.target.value;

        $("clearSearch").hidden =
          !state.search;

        applyFilter();

      }
    );

  $("clearSearch")
    .addEventListener(
      "click",
      () => {

        $("searchInput").value =
          "";

        state.search = "";

        $("clearSearch").hidden =
          true;

        applyFilter();

      }
    );

  /* =====================================================
     REFRESH
     ===================================================== */

  $("refreshBtn")
    .addEventListener(
      "click",
      loadSongs
    );

  /* =====================================================
     MOBILE MENU
     ===================================================== */

  $("mobileMenu")
    .addEventListener(
      "click",
      () => {

        $("sidebar")
          .classList
          .toggle("open");

      }
    );

  /* =====================================================
     NAVIGATION
     ===================================================== */

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
                  item.classList
                    .remove("active")
              );

            button.classList
              .add("active");

            const view =
              button.dataset.view;

            if (
              view === "liked"
            ) {

              state.filteredSongs =
                state.songs.filter(
                  song =>
                    state.liked.has(
                      song._key
                    )
                );

              $("sectionTitle")
                .textContent =
                "Liked Songs";

              renderSongs();

              return;

            }

            /*
             * Home / Library /
             * Categories currently
             * use the existing song
             * collection.
             */

            state.category =
              "All";

            state.search =
              "";

            $("searchInput")
              .value = "";

            $("clearSearch")
              .hidden = true;

            renderCategories();

            applyFilter();

            if (
              window.innerWidth <= 900
            ) {

              $("sidebar")
                .classList
                .remove("open");

            }

          }
        );

      }
    );

  /* =====================================================
     KEYBOARD
     ===================================================== */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.code ===
        "Space" &&
        !["INPUT", "TEXTAREA"]
          .includes(
            document.activeElement.tagName
          )
      ) {

        event.preventDefault();

        togglePlayPause();

      }

      if (
        event.key === "Escape"
      ) {

        closeVideo();

        $("themePanel")
          .classList
          .remove("open");

      }

    }
  );

  /* =====================================================
     START
     ===================================================== */

  setupMediaSession();

  loadSongs();

})();