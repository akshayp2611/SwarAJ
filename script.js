(() => {
  "use strict";

  const state = {
    songs: [],
    currentIndex: -1,
    isPlaying: false,
    shuffle: localStorage.getItem("swaraj-shuffle") === "1",
    repeat: localStorage.getItem("swaraj-repeat") === "1",
    liked: JSON.parse(
      localStorage.getItem("swaraj-liked") || "[]"
    ),
    youtubeReady: false,
    youtubePlayer: null
  };

  const $ = id => document.getElementById(id);

  const audio = $("audioPlayer");

  const DEFAULT_COVER =
    "/images/default-cover.jpg";


  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );
  }


  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
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


  function toast(message) {
    const el = $("sjToast");

    if (!el) return;

    el.textContent = message;

    el.classList.add("show");

    clearTimeout(
      window.__swarajToast
    );

    window.__swarajToast =
      setTimeout(() => {
        el.classList.remove("show");
      }, 1800);
  }


  /* =====================================================
     YOUTUBE
  ===================================================== */

  window.onYouTubeIframeAPIReady = function () {

    state.youtubeReady = true;

    try {

      state.youtubePlayer =
        new YT.Player(
          "youtubePlayer",
          {
            width: "100%",
            height: "100%",

            playerVars: {
              autoplay: 0,
              controls: 1,
              rel: 0,
              playsinline: 1,
              modestbranding: 1
            },

            events: {

              onStateChange(event) {

                if (
                  typeof YT === "undefined"
                ) {
                  return;
                }

                if (
                  event.data ===
                  YT.PlayerState.PLAYING
                ) {

                  state.isPlaying = true;

                  updatePlayButton();

                  updatePlayerTime();

                  showVideo();

                }


                if (
                  event.data ===
                  YT.PlayerState.PAUSED
                ) {

                  state.isPlaying = false;

                  updatePlayButton();

                }


                if (
                  event.data ===
                  YT.PlayerState.ENDED
                ) {

                  if (state.repeat) {

                    try {
                      state.youtubePlayer
                        .seekTo(0, true);

                      state.youtubePlayer
                        .playVideo();

                    } catch (_) {}

                  } else {

                    nextSong();

                  }

                }

              }

            }

          }
        );

    } catch (error) {

      console.error(
        "YouTube initialization failed:",
        error
      );

    }

  };


  function getYouTubeId(url) {

    if (!url) {
      return null;
    }

    const value =
      String(url).trim();

    if (
      /^[a-zA-Z0-9_-]{11}$/.test(
        value
      )
    ) {
      return value;
    }

    try {

      const parsed =
        new URL(value);

      if (
        parsed.hostname.includes(
          "youtu.be"
        )
      ) {

        return parsed.pathname
          .replace("/", "")
          .substring(0, 11);

      }


      if (
        parsed.hostname.includes(
          "youtube.com"
        ) ||
        parsed.hostname.includes(
          "youtube-nocookie.com"
        )
      ) {

        const v =
          parsed.searchParams.get("v");

        if (v) {
          return v.substring(0, 11);
        }

        const parts =
          parsed.pathname.split("/");

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
     NORMALIZE
  ===================================================== */

  function normalizeSong(song) {

    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      song.video_url ||
      song.videoUrl ||
      "";

    const youtubeId =
      song.youtube_video_id ||
      song.youtubeVideoId ||
      getYouTubeId(
        youtubeUrl
      );

    const isYouTube =
      song.source_type === "youtube" ||
      song.type === "youtube" ||
      song.source === "youtube" ||
      !!youtubeId;

    return {

      id:
        song.id ??
        (
          crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now() +
              Math.random()
        ),

      title:
        song.title ||
        song.name ||
        "Unknown Song",

      artist:
        song.artist ||
        song.singer ||
        "Unknown Artist",

      album:
        song.album ||
        "Singles",

      category:
        song.category ||
        "Music",

      cover:
        song.cover_url ||
        song.cover ||
        song.coverUrl ||
        DEFAULT_COVER,

      type:
        isYouTube
          ? "youtube"
          : "mp3",

      youtubeId:
        youtubeId || null,

      youtubeUrl:
        youtubeUrl || "",

      audioUrl:
        song.audio_url ||
        song.audioUrl ||
        song.file_url ||
        song.fileUrl ||
        song.url ||
        ""

    };

  }


  /* =====================================================
     LOAD SONGS
  ===================================================== */

  async function loadSongs() {

    const list =
      $("songList");

    if (list) {

      list.innerHTML =
        `
        <div class="loading">
          Loading music...
        </div>
        `;

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
          "HTTP " +
          response.status
        );

      }

      const data =
        await response.json();

      const rawSongs =
        Array.isArray(data)
          ? data
          : Array.isArray(data.songs)
            ? data.songs
            : Array.isArray(data.data)
              ? data.data
              : [];

      state.songs =
        rawSongs.map(
          normalizeSong
        );


      renderEverything();

      toast(
        state.songs.length +
        " songs loaded"
      );

    } catch (error) {

      console.error(
        "SwarAJ song loading error:",
        error
      );

      if (list) {

        list.innerHTML =
          `
          <div class="loading">
            Unable to load songs.<br>
            <small>
              Check /api/songs
            </small>
          </div>
          `;

      }

      toast(
        "Unable to load songs"
      );

    }

  }


  /* =====================================================
     RENDER
  ===================================================== */

  function renderEverything() {

    const count =
      $("songCount");

    if (count) {

      count.textContent =
        state.songs.length +
        (
          state.songs.length === 1
            ? " song"
            : " songs"
        );

    }


    renderSongList(
      state.songs,
      $("songList")
    );

    renderSongList(
      state.songs,
      $("libraryList")
    );

    renderLiked();

    renderSearch();

    renderCategories();

    updatePlayButton();

    updateFavoriteButton();

  }


  function renderSongList(
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
              String(item.id) ===
              String(song.id)
          );

        const playing =
          index ===
          state.currentIndex;


        return `
          <div
            class="song ${
              playing
                ? "playing"
                : ""
            }"
            data-index="${index}"
          >

            <img
              class="song-cover"
              src="${escapeHtml(
                song.cover
              )}"
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
                    : escapeHtml(
                        song.category
                      )
                }
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
                      type="button"
                    >
                      ▶ Watch
                    </button>
                  `
                  : ""
              }


              <button
                class="song-play"
                data-play="${index}"
                type="button"
              >
                ${
                  playing &&
                  state.isPlaying
                    ? "❚❚"
                    : "▶"
                }
              </button>

            </div>

          </div>
        `;

      }).join("");


    bindSongButtons(
      container
    );

  }


  function bindSongButtons(
    container
  ) {

    container
      .querySelectorAll(
        "[data-play]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.preventDefault();

            event.stopPropagation();

            playSong(
              Number(
                button.dataset.play
              )
            );

          };

      });


    container
      .querySelectorAll(
        "[data-watch]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.preventDefault();

            event.stopPropagation();

            const index =
              Number(
                button.dataset.watch
              );

            playSong(
              index
            );

            setTimeout(
              showVideo,
              300
            );

          };

      });


    container
      .querySelectorAll(
        ".song"
      )
      .forEach(row => {

        row.onclick =
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
                row.dataset.index
              )
            );

          };

      });

  }


  /* =====================================================
     CATEGORIES
  ===================================================== */

  function renderCategories() {

    const container =
      $("sjCategoryContainer");

    if (!container) {
      return;
    }


    const groups =
      new Map();


    state.songs.forEach(song => {

      const category =
        String(
          song.category ||
          "Music"
        ).trim() ||
        "Music";

      if (!groups.has(category)) {
        groups.set(
          category,
          []
        );
      }

      groups
        .get(category)
        .push(song);

    });


    container.innerHTML =
      [...groups.entries()]
        .map(
          ([category, songs]) =>
            `
            <section
              class="sj-category-block"
            >

              <div
                class="sj-category-header"
              >

                <h2
                  class="sj-category-title"
                >
                  ${escapeHtml(
                    category
                  )}
                </h2>

                <span
                  class="sj-category-count"
                >
                  ${songs.length} songs
                </span>

              </div>


              <div
                class="sj-category-scroll"
              >

                ${songs.map(
                  song => {

                    const index =
                      state.songs
                        .findIndex(
                          item =>
                            String(
                              item.id
                            ) ===
                            String(
                              song.id
                            )
                        );

                    return `
                      <article
                        class="sj-song-card"
                        data-category-index="${index}"
                      >

                        <img
                          src="${escapeHtml(
                            song.cover
                          )}"
                          onerror="
                            this.src='${DEFAULT_COVER}'
                          "
                          alt=""
                        >

                        <div
                          class="sj-card-title"
                        >
                          ${escapeHtml(
                            song.title
                          )}
                        </div>

                        <div
                          class="sj-card-artist"
                        >
                          ${escapeHtml(
                            song.artist
                          )}
                        </div>

                        <button
                          class="sj-card-play"
                          data-category-play="${index}"
                          type="button"
                        >
                          ▶
                        </button>

                      </article>
                    `;

                  }
                ).join("")}

              </div>

            </section>
            `
        )
        .join("");


    container
      .querySelectorAll(
        "[data-category-play]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.preventDefault();

            event.stopPropagation();

            playSong(
              Number(
                button.dataset
                  .categoryPlay
              )
            );

          };

      });


    container
      .querySelectorAll(
        "[data-category-index]"
      )
      .forEach(card => {

        card.onclick =
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
                card.dataset
                  .categoryIndex
              )
            );

          };

      });

  }


  /* =====================================================
     SEARCH
  ===================================================== */

  function renderSearch() {

    const input =
      $("searchInput");

    const container =
      $("searchResults");

    if (!input || !container) {
      return;
    }

    const query =
      input.value
        .trim()
        .toLowerCase();


    if (!query) {

      container.innerHTML =
        `
        <div class="loading">
          Type something to search.
        </div>
        `;

      return;

    }


    const songs =
      state.songs.filter(song => {

        const text = `
          ${song.title}
          ${song.artist}
          ${song.album}
          ${song.category}
        `.toLowerCase();

        return text.includes(
          query
        );

      });


    renderSongList(
      songs,
      container
    );

  }


  /* =====================================================
     LIKED
  ===================================================== */

  function renderLiked() {

    const container =
      $("likedList");

    if (!container) {
      return;
    }


    const liked =
      state.songs.filter(song =>
        state.liked.includes(
          String(song.id)
        )
      );


    renderSongList(
      liked,
      container
    );

  }


  function toggleFavorite() {

    if (
      state.currentIndex < 0
    ) {

      toast(
        "Play a song first"
      );

      return;

    }


    const song =
      state.songs[
        state.currentIndex
      ];

    if (!song) {
      return;
    }


    const id =
      String(song.id);

    const index =
      state.liked.indexOf(id);


    if (index >= 0) {

      state.liked.splice(
        index,
        1
      );

      toast(
        "Removed from favorites"
      );

    } else {

      state.liked.push(id);

      toast(
        "Added to favorites"
      );

    }


    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        state.liked
      )
    );


    updateFavoriteButton();

    renderLiked();

  }


  function updateFavoriteButton() {

    const button =
      $("sjFavorite");

    if (!button) {
      return;
    }


    if (
      state.currentIndex < 0
    ) {

      button.textContent =
        "♡";

      return;

    }


    const song =
      state.songs[
        state.currentIndex
      ];

    if (!song) {
      return;
    }


    button.textContent =
      state.liked.includes(
        String(song.id)
      )
        ? "♥"
        : "♡";

  }


  /* =====================================================
     PLAYER
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

    state.currentIndex =
      index;


    updatePlayerInfo(
      song
    );


    stopAudioOnly();


    if (
      song.type ===
      "youtube"
    ) {

      await playYouTube(
        song
      );

    } else {

      playMP3(
        song
      );

    }


    renderEverything();

  }


  function updatePlayerInfo(
    song
  ) {

    const title =
      $("playerTitle");

    const artist =
      $("playerArtist");

    const cover =
      $("playerCover");

    const category =
      $("sjPlayerCategory");


    if (title) {
      title.textContent =
        song.title;
    }

    if (artist) {
      artist.textContent =
        song.artist;
    }

    if (cover) {
      cover.src =
        song.cover ||
        DEFAULT_COVER;
    }

    if (category) {
      category.textContent =
        song.category ||
        "Music";
    }

  }


  function playMP3(song) {

    hideVideo();


    if (!song.audioUrl) {

      toast(
        "This song has no audio URL"
      );

      return;

    }


    audio.pause();

    audio.src =
      song.audioUrl;

    audio.currentTime =
      0;

    audio.load();


    const promise =
      audio.play();


    if (
      promise &&
      typeof promise.catch ===
        "function"
    ) {

      promise.catch(
        error => {

          console.error(
            "Audio play error:",
            error
          );

          state.isPlaying =
            false;

          updatePlayButton();

          toast(
            "Unable to play this song"
          );

        }
      );

    }

  }


  async function playYouTube(
    song
  ) {

    const videoId =
      song.youtubeId ||
      getYouTubeId(
        song.youtubeUrl
      );


    if (!videoId) {

      toast(
        "Invalid YouTube video"
      );

      return;

    }


    if (
      !state.youtubeReady ||
      !state.youtubePlayer
    ) {

      toast(
        "YouTube player is still loading"
      );

      return;

    }


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

    showVideo();

  }


  function stopAudioOnly() {

    if (!audio) {
      return;
    }

    audio.pause();

    audio.currentTime =
      0;

  }


  /* =====================================================
     PLAY / PAUSE
  ===================================================== */

  function togglePlay() {

    if (
      state.currentIndex < 0
    ) {

      if (
        state.songs.length
      ) {

        playSong(0);

      } else {

        toast(
          "No songs available"
        );

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
      song.type ===
      "youtube"
    ) {

      if (
        !state.youtubePlayer
      ) {
        return;
      }


      try {

        if (
          state.isPlaying
        ) {

          state.youtubePlayer
            .pauseVideo();

        } else {

          state.youtubePlayer
            .playVideo();

        }

      } catch (_) {}

      return;

    }


    if (
      audio.paused
    ) {

      audio.play()
        .then(() => {

          state.isPlaying =
            true;

          updatePlayButton();

        })
        .catch(() => {

          toast(
            "Unable to play audio"
          );

        });

    } else {

      audio.pause();

      state.isPlaying =
        false;

      updatePlayButton();

    }

  }


  function updatePlayButton() {

    const button =
      $("playBtn");

    if (!button) {
      return;
    }


    button.textContent =
      state.isPlaying
        ? "❚❚"
        : "▶";

  }


  /* =====================================================
     NEXT
  ===================================================== */

  function nextSong() {

    if (
      !state.songs.length
    ) {
      return;
    }


    let index;


    if (state.shuffle) {

      if (
        state.songs.length ===
        1
      ) {

        index = 0;

      } else {

        do {

          index =
            Math.floor(
              Math.random() *
              state.songs.length
            );

        } while (
          index ===
          state.currentIndex
        );

      }

    } else {

      index =
        state.currentIndex + 1;

      if (
        index >=
        state.songs.length
      ) {
        index = 0;
      }

    }


    playSong(index);

  }


  /* =====================================================
     PREVIOUS
  ===================================================== */

  function previousSong() {

    if (
      !state.songs.length
    ) {
      return;
    }


    const song =
      state.songs[
        state.currentIndex
      ];


    if (
      song &&
      song.type !==
        "youtube" &&
      audio.currentTime > 3
    ) {

      audio.currentTime =
        0;

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
     AUDIO EVENTS
  ===================================================== */

  function setupAudio() {

    if (!audio) {
      return;
    }


    audio.addEventListener(
      "play",
      () => {

        state.isPlaying =
          true;

        updatePlayButton();

        updateMediaSession();

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
      () => {

        if (
          state.repeat
        ) {

          audio.currentTime =
            0;

          audio.play();

        } else {

          nextSong();

        }

      }
    );


    audio.addEventListener(
      "timeupdate",
      updatePlayerTime
    );


    audio.addEventListener(
      "loadedmetadata",
      updatePlayerTime
    );

  }


  function updatePlayerTime() {

    if (!audio) {
      return;
    }


    const current =
      $("currentTime");

    const duration =
      $("duration");

    const progress =
      $("progress");


    if (current) {

      current.textContent =
        formatTime(
          audio.currentTime
        );

    }


    if (duration) {

      duration.textContent =
        formatTime(
          audio.duration
        );

    }


    if (
      progress &&
      Number.isFinite(
        audio.duration
      ) &&
      audio.duration > 0
    ) {

      progress.value =
        (
          audio.currentTime /
          audio.duration
        ) * 100;

    }

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function setupNavigation() {

    document
      .querySelectorAll(
        ".menu-item[data-page]"
      )
      .forEach(button => {

        button.onclick =
          event => {

            event.preventDefault();

            const page =
              button.dataset.page;

            showPage(page);

            closeMobileMenu();

          };

      });

  }


  function showPage(page) {

    document
      .querySelectorAll(
        ".page"
      )
      .forEach(section => {

        section.classList.remove(
          "active"
        );

        section.style.display =
          "none";

      });


    const target =
      $(
        page +
        "Page"
      );


    if (target) {

      target.classList.add(
        "active"
      );

      target.style.display =
        "block";

    }


    document
      .querySelectorAll(
        ".menu-item"
      )
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );

      });


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  /* =====================================================
     MOBILE MENU
  ===================================================== */

  function setupMobileMenu() {

    const button =
      $("mobileMenu");

    const sidebar =
      $("sidebar");

    const overlay =
      $("drawerOverlay");


    if (button) {

      button.onclick =
        event => {

          event.preventDefault();

          event.stopPropagation();

          sidebar?.classList.toggle(
            "mobile-open"
          );

          overlay?.classList.toggle(
            "active"
          );

        };

    }


    if (overlay) {

      overlay.onclick =
        closeMobileMenu;

    }

  }


  function closeMobileMenu() {

    $("sidebar")
      ?.classList.remove(
        "mobile-open"
      );

    $("drawerOverlay")
      ?.classList.remove(
        "active"
      );

  }


  /* =====================================================
     TOPBAR
  ===================================================== */

  function setupTopbar() {

    $("refreshBtn")?.addEventListener(
      "click",
      () => {

        loadSongs();

      }
    );


    $("heroPlay")?.addEventListener(
      "click",
      () => {

        if (
          state.currentIndex >=
          0
        ) {

          togglePlay();

        } else if (
          state.songs.length
        ) {

          playSong(0);

        } else {

          toast(
            "No songs available"
          );

        }

      }
    );


    $("searchInput")?.addEventListener(
      "input",
      () => {

        renderSearch();

        showPage(
          "search"
        );

      }
    );

  }


  /* =====================================================
     PLAYER CONTROLS
  ===================================================== */

  function setupPlayerControls() {

    $("playBtn")?.addEventListener(
      "click",
      togglePlay
    );


    $("nextBtn")?.addEventListener(
      "click",
      nextSong
    );


    $("prevBtn")?.addEventListener(
      "click",
      previousSong
    );


    $("sjFavorite")?.addEventListener(
      "click",
      toggleFavorite
    );


    $("sjShuffle")?.addEventListener(
      "click",
      () => {

        state.shuffle =
          !state.shuffle;

        localStorage.setItem(
          "swaraj-shuffle",
          state.shuffle
            ? "1"
            : "0"
        );

        $("sjShuffle")
          ?.classList.toggle(
            "active",
            state.shuffle
          );

        toast(
          state.shuffle
            ? "Shuffle ON"
            : "Shuffle OFF"
        );

      }
    );


    $("sjRepeat")?.addEventListener(
      "click",
      () => {

        state.repeat =
          !state.repeat;

        localStorage.setItem(
          "swaraj-repeat",
          state.repeat
            ? "1"
            : "0"
        );

        if (audio) {
          audio.loop =
            state.repeat;
        }

        $("sjRepeat")
          ?.classList.toggle(
            "active",
            state.repeat
          );

        toast(
          state.repeat
            ? "Repeat ON"
            : "Repeat OFF"
        );

      }
    );


    $("sjMute")?.addEventListener(
      "click",
      () => {

        if (!audio) {
          return;
        }

        audio.muted =
          !audio.muted;

        $("sjMute").textContent =
          audio.muted
            ? "🔇"
            : "🔊";

      }
    );


    $("sjVolume")?.addEventListener(
      "input",
      event => {

        if (!audio) {
          return;
        }

        audio.volume =
          Number(
            event.target.value
          );

        if (audio.muted) {

          audio.muted =
            false;

          $("sjMute").textContent =
            "🔊";

        }

      }
    );


    $("progress")?.addEventListener(
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
     VIDEO
  ===================================================== */

  function showVideo() {

    const common =
      $("sjCommonVideo");

    const frame =
      $("youtubeFrame");


    if (!common || !frame) {
      return;
    }


    frame.classList.remove(
      "hidden-video"
    );

    common.classList.add(
      "open"
    );

  }


  function hideVideo() {

    const common =
      $("sjCommonVideo");

    const frame =
      $("youtubeFrame");


    frame?.classList.add(
      "hidden-video"
    );

    common?.classList.remove(
      "open"
    );

  }


  function setupVideo() {

    $("sjVideoClose")
      ?.addEventListener(
        "click",
        hideVideo
      );


    $("sjFullscreen")
      ?.addEventListener(
        "click",
        fullscreenVideo
      );


    $("sjMiniFullscreen")
      ?.addEventListener(
        "click",
        fullscreenVideo
      );

  }


  async function fullscreenVideo() {

    const target =
      $("sjCommonVideo")
        ?.querySelector(
          ".sj-video-inner"
        );


    if (!target) {
      return;
    }


    try {

      if (
        document.fullscreenElement
      ) {

        await document
          .exitFullscreen();

      } else {

        await target
          .requestFullscreen();

      }

    } catch (error) {

      toast(
        "Fullscreen unavailable"
      );

    }

  }


  /* =====================================================
     QUEUE
  ===================================================== */

  function setupQueue() {

    $("sjQueue")
      ?.addEventListener(
        "click",
        () => {

          renderQueue();

          $("sjQueuePanel")
            ?.classList.toggle(
              "open"
            );

        }
      );


    $("sjQueueClose")
      ?.addEventListener(
        "click",
        () => {

          $("sjQueuePanel")
            ?.classList.remove(
              "open"
            );

        }
      );

  }


  function renderQueue() {

    const container =
      $("sjQueueList");

    if (!container) {
      return;
    }


    if (!state.songs.length) {

      container.innerHTML =
        `
        <div class="sj-queue-row">
          No songs loaded.
        </div>
        `;

      return;

    }


    container.innerHTML =
      state.songs.map(
        (song, index) =>
          `
          <button
            class="sj-queue-row ${
              index ===
              state.currentIndex
                ? "active"
                : ""
            }"
            data-queue-index="${index}"
            type="button"
          >

            <img
              src="${escapeHtml(
                song.cover
              )}"
              alt=""
            >

            <span>

              <b>
                ${escapeHtml(
                  song.title
                )}
              </b>

              <small>
                ${escapeHtml(
                  song.artist
                )}
              </small>

            </span>

          </button>
          `
      ).join("");


    container
      .querySelectorAll(
        "[data-queue-index]"
      )
      .forEach(button => {

        button.onclick =
          () => {

            playSong(
              Number(
                button.dataset
                  .queueIndex
              )
            );

            $("sjQueuePanel")
              ?.classList.remove(
                "open"
              );

          };

      });

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


    const actions = {

      play:
        () => togglePlay(),

      pause:
        () => togglePlay(),

      nexttrack:
        () => nextSong(),

      previoustrack:
        () => previousSong(),

      seekbackward:
        details => {

          if (!audio) return;

          audio.currentTime =
            Math.max(
              0,
              audio.currentTime -
              (
                details.seekOffset ||
                10
              )
            );

        },

      seekforward:
        details => {

          if (!audio) return;

          audio.currentTime =
            Math.min(
              audio.duration || Infinity,
              audio.currentTime +
              (
                details.seekOffset ||
                10
              )
            );

        }

    };


    Object.entries(
      actions
    ).forEach(
      ([name, handler]) => {

        try {

          navigator
            .mediaSession
            .setActionHandler(
              name,
              handler
            );

        } catch (_) {}

      }
    );

  }


  function updateMediaSession() {

    if (
      !("mediaSession" in navigator)
    ) {
      return;
    }


    const song =
      state.songs[
        state.currentIndex
      ];

    if (!song) {
      return;
    }


    try {

      navigator.mediaSession.metadata =
        new MediaMetadata({

          title:
            song.title,

          artist:
            song.artist,

          album:
            "SwarAJ Music",

          artwork: [
            {
              src:
                song.cover ||
                DEFAULT_COVER,

              sizes:
                "512x512"
            }
          ]

        });

    } catch (_) {}

  }


  /* =====================================================
     INIT
  ===================================================== */

  function init() {

    console.log(
      "SwarAJ frontend initialized"
    );


    setupNavigation();

    setupMobileMenu();

    setupTopbar();

    setupPlayerControls();

    setupAudio();

    setupVideo();

    setupQueue();

    setupMediaSession();


    $("sjShuffle")
      ?.classList.toggle(
        "active",
        state.shuffle
      );


    $("sjRepeat")
      ?.classList.toggle(
        "active",
        state.repeat
      );


    if (audio) {
      audio.volume = 1;
      audio.loop =
        state.repeat;
    }


    loadSongs();

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