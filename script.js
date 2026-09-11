(() => {
  "use strict";

  /* =========================================================
     SWARAJ PLAYER
     Local MP3 + YouTube
     ========================================================= */

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
    ),

    youtubePlayer: null,
    youtubeReady: false,
    youtubePlaying: false,

    mediaType: null, // "local" | "youtube"
  };

  /* =========================================================
     HELPERS
     ========================================================= */

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

  function getYouTubeId(song) {
    if (!song) return null;

    const directId =
      song.youtube_video_id ||
      song.youtubeVideoId ||
      song.youtubeId ||
      song.videoId;

    if (
      directId &&
      /^[A-Za-z0-9_-]{11}$/.test(String(directId))
    ) {
      return String(directId);
    }

    const url =
      song.youtube_url ||
      song.youtubeUrl ||
      song.youtube ||
      song.youtube_link ||
      null;

    if (!url) return null;

    const value = String(url).trim();

    const patterns = [
      /[?&]v=([A-Za-z0-9_-]{11})/,
      /youtu\.be\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
      /youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return null;
  }

  function isYouTubeSong(song) {
    return Boolean(getYouTubeId(song));
  }

  function showToast(message) {
    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
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

    const minutes = Math.floor(seconds / 60);

    const secs = Math.floor(seconds % 60);

    return (
      minutes +
      ":" +
      String(secs).padStart(2, "0")
    );
  }

  /* =========================================================
     YOUTUBE API
     ========================================================= */

  function loadYouTubeAPI() {
    if (
      window.YT &&
      window.YT.Player
    ) {
      createYouTubePlayer();
      return;
    }

    if (
      document.querySelector(
        'script[data-swaraj-youtube="true"]'
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://www.youtube.com/iframe_api";

    script.async = true;

    script.dataset.swarajYoutube = "true";

    document.head.appendChild(script);

    window.onYouTubeIframeAPIReady =
      () => {
        createYouTubePlayer();
      };
  }

  function createYouTubePlayer() {
    if (state.youtubePlayer) {
      state.youtubeReady = true;
      return;
    }

    const container =
      $("youtubePlayer") ||
      $("youtubeFrame") ||
      $("youtube-container");

    if (!container) {
      console.warn(
        "SwarAJ: YouTube container not found"
      );
      return;
    }

    let elementId = container.id;

    if (!elementId) {
      elementId = "swarajYouTubePlayer";

      container.id = elementId;
    }

    try {
      state.youtubePlayer =
        new YT.Player(
          elementId,
          {
            width: "100%",
            height: "100%",

            videoId: "",

            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              playsinline: 1,
              modestbranding: 1
            },

            events: {
              onReady:
                onYouTubeReady,

              onStateChange:
                onYouTubeStateChange,

              onError:
                onYouTubeError
            }
          }
        );
    } catch (error) {
      console.error(
        "SwarAJ YouTube player error:",
        error
      );
    }
  }

  function onYouTubeReady() {
    state.youtubeReady = true;

    console.log(
      "SwarAJ YouTube player ready"
    );
  }

  function onYouTubeStateChange(event) {
    if (
      !window.YT ||
      !window.YT.PlayerState
    ) {
      return;
    }

    switch (event.data) {
      case YT.PlayerState.PLAYING:

        state.youtubePlaying = true;
        state.mediaType = "youtube";

        updatePlayButton();

        updateProgressFromYouTube();

        break;

      case YT.PlayerState.PAUSED:

        state.youtubePlaying = false;

        updatePlayButton();

        break;

      case YT.PlayerState.ENDED:

        state.youtubePlaying = false;

        handleSongEnded();

        break;

      case YT.PlayerState.BUFFERING:

        break;

      default:
        break;
    }
  }

  function onYouTubeError(event) {
    console.error(
      "YouTube playback error:",
      event.data
    );

    const messages = {
      2: "Invalid YouTube video",
      5: "YouTube player error",
      100: "YouTube video not found",
      101: "YouTube video cannot be played",
      150: "YouTube video cannot be played"
    };

    showToast(
      messages[event.data] ||
      "YouTube playback failed"
    );
  }

  /* =========================================================
     LOAD SONGS
     ========================================================= */

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
          "HTTP " +
          response.status
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

      const grid =
        $("songGrid");

      if (grid) {
        grid.innerHTML = `
          <div class="loading">
            Unable to load songs.
            <br>
            <small>
              Check that /api/songs is working.
            </small>
          </div>
        `;
      }

      showToast(
        "Could not load songs"
      );
    }
  }

  function showLoading() {
    const grid =
      $("songGrid");

    if (!grid) return;

    grid.innerHTML = `
      <div class="loading">
        Loading songs...
      </div>
    `;
  }

  /* =========================================================
     CATEGORIES
     ========================================================= */

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
                category ===
                state.category
                  ? "active"
                  : ""
              }"
              data-category="${escapeHTML(
                category
              )}"
            >
              ${escapeHTML(
                category
              )}
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

  /* =========================================================
     SEARCH / FILTER
     ========================================================= */

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
            state.category ===
              "All" ||
            category ===
              state.category;

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

    title.textContent =
      state.category === "All"
        ? "All Songs"
        : state.category;
  }

  function updateSongCount() {
    const count =
      $("songCount");

    if (!count) return;

    count.textContent =
      `${state.songs.length} songs`;
  }

  /* =========================================================
     RENDER SONGS
     ========================================================= */

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
        .map(song => {
          const liked =
            state.liked.has(
              song._key
            );

          const current =
            getCurrentSong();

          const playing =
            current &&
            current._key ===
              song._key &&
            (
              state.mediaType ===
                "local" &&
              !audio.paused
              ||
              state.mediaType ===
                "youtube" &&
              state.youtubePlaying
            );

          const cover =
            song.cover_url ||
            song.cover ||
            song.coverUrl ||
            null;

          const youtube =
            isYouTubeSong(song);

          return `
            <article
              class="song-card ${
                playing
                  ? "playing"
                  : ""
              }"
              data-song-key="${escapeHTML(
                song._key
              )}"
            >

              <div class="cover">

                ${
                  cover
                    ? `
                      <img
                        src="${escapeHTML(
                          cover
                        )}"
                        alt=""
                        loading="lazy"
                        onerror="
                          this.style.display='none'
                        "
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
                  ${
                    playing
                      ? "❚❚"
                      : "▶"
                  }
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

                ${
                  youtube
                    ? `
                      <button
                        type="button"
                        class="youtube-watch-card"
                      >
                        🎬 Watch
                      </button>
                    `
                    : ""
                }

              </div>

            </article>
          `;
        })
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

            if (
              event.target.closest(
                ".youtube-watch-card"
              )
            ) {
              return;
            }

            playSong(song);
          }
        );

        const play =
          card.querySelector(
            ".card-play"
          );

        play?.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

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
            event.preventDefault();
            event.stopPropagation();

            toggleLike(song);
          }
        );

        const watch =
          card.querySelector(
            ".youtube-watch-card"
          );

        watch?.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            watchSong(song);
          }
        );
      });
  }

  /* =========================================================
     MAIN PLAY FUNCTION
     ========================================================= */

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

    /*
     ========================================================
     YOUTUBE SONG
     ========================================================
     */

    if (isYouTubeSong(song)) {
      await playYouTube(song);
      return;
    }

    /*
     ========================================================
     LOCAL SONG
     ========================================================
     */

    const audioUrl =
      getAudioUrl(song);

    if (!audioUrl) {
      showToast(
        "No playable audio found"
      );

      return;
    }

    try {
      stopYouTube();

      state.mediaType = "local";

      audio.pause();

      audio.src = audioUrl;

      audio.load();

      await audio.play();

      updatePlayButton();

      updateMediaSession(song);

    } catch (error) {
      console.error(
        "Local audio playback error:",
        error
      );

      showToast(
        "Tap Play again"
      );
    }
  }

  /* =========================================================
     YOUTUBE PLAYBACK
     ========================================================= */

  async function playYouTube(song) {
    const videoId =
      getYouTubeId(song);

    if (!videoId) {
      showToast(
        "Invalid YouTube video"
      );

      return;
    }

    /*
     * Make sure YouTube API exists.
     */

    if (
      !state.youtubePlayer ||
      !state.youtubeReady
    ) {
      loadYouTubeAPI();

      showToast(
        "YouTube player is loading..."
      );

      /*
       * Retry after API initialization.
       */

      let attempts = 0;

      const retry =
        setInterval(() => {
          attempts++;

          if (
            state.youtubePlayer &&
            state.youtubeReady
          ) {
            clearInterval(retry);

            playYouTube(song);

          } else if (
            attempts >= 30
          ) {
            clearInterval(retry);

            showToast(
              "YouTube player failed to load"
            );
          }
        }, 300);

      return;
    }

    try {
      /*
       * Stop normal HTML audio.
       */

      audio.pause();

      audio.removeAttribute(
        "src"
      );

      audio.load();

      state.mediaType =
        "youtube";

      state.youtubePlaying =
        false;

      /*
       * IMPORTANT:
       *
       * We load the YouTube video
       * into the hidden player.
       *
       * We DO NOT open the Watch modal.
       */

      state.youtubePlayer.loadVideoById(
        {
          videoId: videoId,
          startSeconds: 0
        }
      );

      /*
       * Start YouTube playback.
       */

      state.youtubePlayer.playVideo();

      updateMediaSession(song);

      updatePlayer(song);

      renderSongs();

    } catch (error) {
      console.error(
        "YouTube playback error:",
        error
      );

      showToast(
        "YouTube playback failed"
      );
    }
  }

  /* =========================================================
     STOP YOUTUBE
     ========================================================= */

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
        "Could not stop YouTube:",
        error
      );
    }

    state.youtubePlaying =
      false;
  }

  /* =========================================================
     WATCH YOUTUBE VIDEO
     ========================================================= */

  function watchSong(song) {
    if (!song) return;

    const videoId =
      getYouTubeId(song);

    if (!videoId) {
      showToast(
        "Invalid YouTube video"
      );

      return;
    }

    state.currentIndex =
      state.songs.findIndex(
        item =>
          item._key ===
          song._key
      );

    updatePlayer(song);

    /*
     * If YouTube player isn't ready,
     * load it first.
     */

    if (
      !state.youtubePlayer ||
      !state.youtubeReady
    ) {
      loadYouTubeAPI();

      showToast(
        "YouTube player is loading..."
      );

      setTimeout(() => {
        if (
          state.youtubePlayer &&
          state.youtubeReady
        ) {
          openYouTubeVideo(
            song,
            videoId
          );
        }
      }, 1000);

      return;
    }

    openYouTubeVideo(
      song,
      videoId
    );
  }

  function openYouTubeVideo(
    song,
    videoId
  ) {
    if (!state.youtubePlayer) {
      return;
    }

    try {
      state.mediaType =
        "youtube";

      state.youtubePlayer.loadVideoById(
        videoId
      );

      state.youtubePlayer.playVideo();

      showVideoModal();

    } catch (error) {
      console.error(
        "Watch video error:",
        error
      );
    }
  }

  /* =========================================================
     VIDEO MODAL
     ========================================================= */

  function showVideoModal() {
    const modal =
      $("videoModal");

    if (!modal) return;

    modal.classList.remove(
      "hidden"
    );

    modal.classList.add(
      "open"
    );

    const youtubeContainer =
      $("youtubePlayer") ||
      $("youtubeFrame") ||
      $("youtube-container");

    if (youtubeContainer) {
      youtubeContainer.style.pointerEvents =
        "auto";
    }
  }

  function closeVideoModal() {
    const modal =
      $("videoModal");

    if (!modal) return;

    modal.classList.add(
      "hidden"
    );

    modal.classList.remove(
      "open"
    );

    const youtubeContainer =
      $("youtubePlayer") ||
      $("youtubeFrame") ||
      $("youtube-container");

    if (youtubeContainer) {
      youtubeContainer.style.pointerEvents =
        "none";
    }

    /*
     * Do NOT stop the song when the
     * Watch window is closed.
     *
     * Audio should continue playing.
     */
  }

  /* =========================================================
     PLAY / PAUSE
     ========================================================= */

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

    /*
     * YOUTUBE
     */

    if (
      isYouTubeSong(current) &&
      state.mediaType === "youtube"
    ) {
      if (
        state.youtubePlaying
      ) {
        state.youtubePlayer?.pauseVideo();
      } else {
        state.youtubePlayer?.playVideo();
      }

      return;
    }

    /*
     * LOCAL
     */

    if (
      state.mediaType === "local"
    ) {
      if (audio.paused) {
        audio.play()
          .catch(() => {
            showToast(
              "Tap Play again"
            );
          });
      } else {
        audio.pause();
      }

      return;
    }

    playSong(current);
  }

  /* =========================================================
     CURRENT SONG
     ========================================================= */

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

  /* =========================================================
     NEXT
     ========================================================= */

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
        state.currentIndex + 1;

      if (
        nextIndex >=
        state.songs.length
      ) {
        nextIndex = 0;
      }
    }

    playSong(
      state.songs[nextIndex]
    );
  }

  /* =========================================================
     PREVIOUS
     ========================================================= */

  function playPrevious() {
    if (!state.songs.length) {
      return;
    }

    /*
     * If song already played for more
     * than 3 seconds, restart it.
     */

    if (
      state.mediaType === "local" &&
      audio.currentTime > 3
    ) {
      audio.currentTime = 0;
      return;
    }

    if (
      state.mediaType === "youtube" &&
      state.youtubePlayer
    ) {
      try {
        if (
          state.youtubePlayer.getCurrentTime() >
          3
        ) {
          state.youtubePlayer.seekTo(
            0,
            true
          );

          return;
        }
      } catch (_) {}
    }

    let previousIndex =
      state.currentIndex - 1;

    if (
      previousIndex < 0
    ) {
      previousIndex =
        state.songs.length - 1;
    }

    playSong(
      state.songs[
        previousIndex
      ]
    );
  }

  /* =========================================================
     SONG END
     ========================================================= */

  function handleSongEnded() {
    if (state.repeat) {
      const current =
        getCurrentSong();

      if (!current) return;

      if (
        isYouTubeSong(current)
      ) {
        state.youtubePlayer?.seekTo(
          0,
          true
        );

        state.youtubePlayer?.playVideo();

      } else {
        audio.currentTime = 0;

        audio.play()
          .catch(() => {});
      }

      return;
    }

    playNext();
  }

  /* =========================================================
     LIKE
     ========================================================= */

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

    renderSongs();

    updatePlayer(song);
  }

  /* =========================================================
     PLAYER UI
     ========================================================= */

  function updatePlayer(song) {
    if (!song) return;

    const title =
      $("playerTitle");

    const artist =
      $("playerArtist");

    const cover =
      $("playerCover");

    if (title) {
      title.textContent =
        getTitle(song);
    }

    if (artist) {
      artist.textContent =
        getArtist(song);
    }

    const coverUrl =
      song.cover_url ||
      song.cover ||
      song.coverUrl ||
      null;

    if (cover) {
      if (coverUrl) {
        cover.innerHTML = `
          <img
            src="${escapeHTML(
              coverUrl
            )}"
            alt=""
          >
        `;
      } else {
        cover.textContent = "♪";
      }
    }

    const likeBtn =
      $("likeBtn");

    if (likeBtn) {
      likeBtn.textContent =
        state.liked.has(
          song._key
        )
          ? "♥"
          : "♡";
    }

    const watchBtn =
      $("watchBtn");

    if (watchBtn) {
      watchBtn.hidden =
        !isYouTubeSong(song);
    }

    updateMediaSession(song);
  }

  /* =========================================================
     PLAY BUTTON
     ========================================================= */

  function updatePlayButton() {
    const buttons =
      document.querySelectorAll(
        "#playBtn, .play-button, .player-play"
      );

    let playing = false;

    if (
      state.mediaType === "youtube"
    ) {
      playing =
        state.youtubePlaying;
    } else {
      playing =
        audio &&
        !audio.paused;
    }

    buttons.forEach(button => {
      button.textContent =
        playing
          ? "❚❚"
          : "▶";
    });
  }

  /* =========================================================
     AUDIO EVENTS
     ========================================================= */

  if (audio) {
    audio.addEventListener(
      "play",
      () => {
        state.mediaType =
          "local";

        updatePlayButton();

        const song =
          getCurrentSong();

        if (song) {
          updateMediaSession(song);
        }
      }
    );

    audio.addEventListener(
      "pause",
      () => {
        updatePlayButton();
      }
    );

    audio.addEventListener(
      "ended",
      () => {
        handleSongEnded();
      }
    );

    audio.addEventListener(
      "timeupdate",
      () => {
        updateProgress();
      }
    );

    audio.addEventListener(
      "loadedmetadata",
      () => {
        updateDuration();
      }
    );

    audio.addEventListener(
      "error",
      event => {
        console.error(
          "HTML audio error:",
          event
        );
      }
    );
  }

  /* =========================================================
     PROGRESS
     ========================================================= */

  function updateProgress() {
    if (!audio) return;

    if (
      state.mediaType !== "local"
    ) {
      return;
    }

    const current =
      audio.currentTime || 0;

    const duration =
      audio.duration || 0;

    setProgress(
      current,
      duration
    );
  }

  function updateProgressFromYouTube() {
    if (
      !state.youtubePlayer
    ) {
      return;
    }

    if (
      state.mediaType !== "youtube"
    ) {
      return;
    }

    try {
      const current =
        state.youtubePlayer
          .getCurrentTime();

      const duration =
        state.youtubePlayer
          .getDuration();

      setProgress(
        current,
        duration
      );
    } catch (_) {}
  }

  function setProgress(
    current,
    duration
  ) {
    const progress =
      $("progressBar") ||
      $("progress");

    const currentTime =
      $("currentTime");

    const durationElement =
      $("duration");

    if (currentTime) {
      currentTime.textContent =
        formatTime(current);
    }

    if (durationElement) {
      durationElement.textContent =
        formatTime(duration);
    }

    if (
      progress &&
      duration > 0
    ) {
      progress.value =
        (current / duration) *
        100;
    }
  }

  function updateDuration() {
    if (!audio) return;

    if (
      state.mediaType !== "local"
    ) {
      return;
    }

    setProgress(
      audio.currentTime || 0,
      audio.duration || 0
    );
  }

  function seekFromProgress(event) {
    const value =
      Number(
        event.target.value
      );

    if (
      state.mediaType ===
      "youtube"
    ) {
      try {
        const duration =
          state.youtubePlayer
            .getDuration();

        state.youtubePlayer.seekTo(
          duration *
            (value / 100),
          true
        );
      } catch (_) {}

      return;
    }

    if (
      state.mediaType ===
      "local" &&
      audio &&
      Number.isFinite(
        audio.duration
      )
    ) {
      audio.currentTime =
        audio.duration *
        (value / 100);
    }
  }

  /* =========================================================
     MEDIA SESSION
     ========================================================= */

  function updateMediaSession(song) {
    if (
      !song ||
      !("mediaSession" in navigator)
    ) {
      return;
    }

    try {
      navigator.mediaSession.metadata =
        new MediaMetadata({
          title: getTitle(song),
          artist: getArtist(song),
          album:
            song.album ||
            "SwarAJ",

          artwork: song.cover_url
            ? [
                {
                  src:
                    song.cover_url
                }
              ]
            : []
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
      play: () => {
        togglePlayPause();
      },

      pause: () => {
        if (
          state.mediaType ===
          "youtube"
        ) {
          state.youtubePlayer?.pauseVideo();
        } else {
          audio?.pause();
        }
      },

      previoustrack: () => {
        playPrevious();
      },

      nexttrack: () => {
        playNext();
      },

      seekbackward: () => {
        seekRelative(-10);
      },

      seekforward: () => {
        seekRelative(10);
      }
    };

    Object.entries(actions)
      .forEach(
        ([action, handler]) => {
          try {
            navigator.mediaSession.setActionHandler(
              action,
              handler
            );
          } catch (_) {}
        }
      );
  }

  function seekRelative(seconds) {
    if (
      state.mediaType ===
      "youtube"
    ) {
      try {
        const current =
          state.youtubePlayer
            .getCurrentTime();

        state.youtubePlayer.seekTo(
          Math.max(
            0,
            current + seconds
          ),
          true
        );
      } catch (_) {}

      return;
    }

    if (audio) {
      audio.currentTime =
        Math.max(
          0,
          audio.currentTime +
            seconds
        );
    }
  }

  /* =========================================================
     BUTTON EVENTS
     ========================================================= */

  function setupControls() {
    const play =
      $("playBtn");

    const next =
      $("nextBtn");

    const previous =
      $("prevBtn") ||
      $("previousBtn");

    const shuffle =
      $("shuffleBtn");

    const repeat =
      $("repeatBtn");

    const like =
      $("likeBtn");

    const watch =
      $("watchBtn");

    play?.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        togglePlayPause();
      }
    );

    next?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        playNext();
      }
    );

    previous?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        playPrevious();
      }
    );

    shuffle?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        state.shuffle =
          !state.shuffle;

        shuffle.classList.toggle(
          "active",
          state.shuffle
        );

        showToast(
          state.shuffle
            ? "Shuffle ON"
            : "Shuffle OFF"
        );
      }
    );

    repeat?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        state.repeat =
          !state.repeat;

        repeat.classList.toggle(
          "active",
          state.repeat
        );

        showToast(
          state.repeat
            ? "Repeat ON"
            : "Repeat OFF"
        );
      }
    );

    like?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        const current =
          getCurrentSong();

        if (current) {
          toggleLike(current);
        }
      }
    );

    watch?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        const current =
          getCurrentSong();

        if (current) {
          watchSong(current);
        }
      }
    );

    const progress =
      $("progressBar") ||
      $("progress");

    progress?.addEventListener(
      "input",
      seekFromProgress
    );

    setupSearch();
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  function setupSearch() {
    const input =
      $("searchInput") ||
      document.querySelector(
        ".search-container input"
      );

    if (!input) return;

    input.addEventListener(
      "input",
      () => {
        state.search =
          input.value || "";

        applyFilter();
      }
    );
  }

  /* =========================================================
     VIDEO CLOSE
     ========================================================= */

  function setupVideoClose() {
    const modal =
      $("videoModal");

    const close =
      $("videoClose");

    close?.addEventListener(
      "click",
      event => {
        event.preventDefault();

        closeVideoModal();
      }
    );

    modal?.addEventListener(
      "click",
      event => {
        if (
          event.target === modal
        ) {
          closeVideoModal();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape"
        ) {
          closeVideoModal();
        }
      }
    );
  }

  /* =========================================================
     MOBILE MENU
     ========================================================= */

  function setupMobileMenu() {
    const menu =
      $("mobileMenu");

    const sidebar =
      $("sidebar");

    if (
      !menu ||
      !sidebar
    ) {
      return;
    }

    menu.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        sidebar.classList.toggle(
          "open"
        );
      }
    );
  }

  /* =========================================================
     YOUTUBE BACKGROUND PROGRESS
     ========================================================= */

  setInterval(() => {
    if (
      state.mediaType ===
        "youtube" &&
      state.youtubePlaying
    ) {
      updateProgressFromYouTube();
    }
  }, 500);

  /* =========================================================
     INIT
     ========================================================= */

  function init() {
    setupControls();

    setupMediaSession();

    setupVideoClose();

    setupMobileMenu();

    /*
     * Start YouTube API loading.
     */

    loadYouTubeAPI();

    /*
     * Load SwarAJ songs.
     */

    loadSongs();

    console.log(
      "SwarAJ player initialized"
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();