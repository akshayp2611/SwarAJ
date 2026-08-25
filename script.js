(() => {
  "use strict";

  const state = {
    songs: [],
    currentIndex: -1,
    liked: JSON.parse(localStorage.getItem("swaraj-liked") || "[]"),
    adminKey: null,
    youtubeReady: false,
    youtubePlayer: null,
    youtubeVideoId: null,
    youtubeVisible: false,
    isPlaying: false,
    progressTimer: null
  };

  const $ = id => document.getElementById(id);

  const audio = $("audioPlayer");

  const DEFAULT_COVER =
    "/images/default-cover.jpg";


  /*
   * ----------------------------------------------------
   * YOUTUBE API
   * ----------------------------------------------------
   */

  window.onYouTubeIframeAPIReady = function () {

    state.youtubeReady = true;

    state.youtubePlayer = new YT.Player("youtubePlayer", {

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

          if (!state.songs[state.currentIndex]) return;

          if (
            event.data ===
            YT.PlayerState.PLAYING
          ) {

            state.isPlaying = true;

            updatePlayButton();

            startProgress();
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

            nextSong();
          }

        }

      }

    });

  };


  function getYouTubeId(url) {

    if (!url) return null;

    const value = String(url).trim();

    if (
      /^[a-zA-Z0-9_-]{11}$/.test(value)
    ) {

      return value;
    }

    try {

      const parsed = new URL(value);

      if (
        parsed.hostname.includes("youtu.be")
      ) {

        return parsed.pathname
          .replace("/", "")
          .substring(0, 11);
      }

      if (
        parsed.hostname.includes("youtube.com") ||
        parsed.hostname.includes("youtube-nocookie.com")
      ) {

        const v =
          parsed.searchParams.get("v");

        if (v) {
          return v.substring(0, 11);
        }

        const parts =
          parsed.pathname.split("/");

        const index =
          parts.indexOf("embed");

        if (
          index >= 0 &&
          parts[index + 1]
        ) {

          return parts[index + 1]
            .substring(0, 11);
        }

        const shorts =
          parts.indexOf("shorts");

        if (
          shorts >= 0 &&
          parts[shorts + 1]
        ) {

          return parts[shorts + 1]
            .substring(0, 11);
        }

      }

    } catch (_) {}

    return null;
  }


  /*
   * ----------------------------------------------------
   * NORMALIZE SONG
   * ----------------------------------------------------
   */

  function normalizeSong(song) {

    const youtubeUrl =
      song.youtube_url ||
      song.youtubeUrl ||
      song.video_url ||
      song.videoUrl ||
      song.url ||
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
          ? getYouTubeId(youtubeUrl)
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


  /*
   * ----------------------------------------------------
   * LOAD SONGS
   * ----------------------------------------------------
   */

  async function loadSongs() {

    $("songList").innerHTML =
      `<div class="loading">
        Loading music...
      </div>`;

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

      $("songList").innerHTML =
        `<div class="loading">
          Unable to load songs
        </div>`;
    }
  }


  /*
   * ----------------------------------------------------
   * RENDER
   * ----------------------------------------------------
   */

  function renderAll() {

    $("songCount").textContent =
      `${state.songs.length} songs`;

    renderSongs(
      state.songs,
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
        .value
        .trim()
        .toLowerCase();

    if (query) {
      renderSearch(query);
    }
  }


  function renderSongs(
    songs,
    container
  ) {

    if (!container) return;

    if (!songs.length) {

      container.innerHTML =
        `<div class="loading">
          No songs found
        </div>`;

      return;
    }

    container.innerHTML =
      songs.map(song => {

        const index =
          state.songs.findIndex(
            item =>
              item.id === song.id
          );

        return `

          <div
            class="song ${
              index === state.currentIndex
                ? "playing"
                : ""
            }"
            data-index="${index}"
          >

            <img
              class="song-cover"
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

              <div class="song-name">
                ${escapeHtml(song.title)}
              </div>

              <div class="song-artist">
                ${escapeHtml(song.artist)}
              </div>

              <div class="song-type">
                ${
                  song.type === "youtube"
                    ? "YouTube"
                    : "MP3"
                }
              </div>

            </div>

            <button
              class="song-play"
              data-play="${index}"
            >
              ${
                index === state.currentIndex &&
                state.isPlaying
                  ? "❚❚"
                  : "▶"
              }
            </button>

          </div>

        `;

      }).join("");


    container
      .querySelectorAll("[data-play]")
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            const index =
              Number(
                button.dataset.play
              );

            playSong(index);
          }
        );

      });
  }


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
      $("likedList")
    );
  }


  function renderSearch(query) {

    const songs =
      state.songs.filter(song => {

        const text = `
          ${song.title}
          ${song.artist}
          ${song.category}
        `.toLowerCase();

        return text.includes(query);
      });

    renderSongs(
      songs,
      $("searchResults")
    );
  }


  /*
   * ----------------------------------------------------
   * PLAY SONG
   * ----------------------------------------------------
   */

  async function playSong(index) {

    if (
      index < 0 ||
      index >= state.songs.length
    ) return;

    const song =
      state.songs[index];

    stopCurrent();

    state.currentIndex = index;

    updatePlayerInfo(song);

    if (song.type === "youtube") {

      await playYouTubeSong(song);

    } else {

      playMp3Song(song);
    }

    renderAll();
  }


  /*
   * MP3
   * ----------------------------------------------------
   */

  function playMp3Song(song) {

    hideYouTube();

    audio.src =
      song.audioUrl;

    audio.currentTime = 0;

    const promise =
      audio.play();

    if (promise) {

      promise
        .then(() => {

          state.isPlaying = true;

          updatePlayButton();

          startProgress();

        })
        .catch(error => {

          console.error(
            "MP3 playback failed:",
            error
          );

          state.isPlaying = false;

          updatePlayButton();

        });
    }
  }


  /*
   * YOUTUBE
   * ----------------------------------------------------
   */

  async function playYouTubeSong(song) {

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

    hideYouTube();

    audio.pause();

    audio.removeAttribute("src");

    audio.load();

    state.youtubePlayer
      .loadVideoById(videoId);

    state.youtubePlayer
      .playVideo();

    state.isPlaying = true;

    $("watchVideoBtn")
      .classList.remove("hidden");

    updatePlayButton();

    startProgress();
  }


  /*
   * STOP
   * ----------------------------------------------------
   */

  function stopCurrent() {

    audio.pause();

    if (state.youtubePlayer) {

      try {

        state.youtubePlayer
          .stopVideo();

      } catch (_) {}

    }

    state.isPlaying = false;

    stopProgress();
  }


  /*
   * WATCH VIDEO
   * ----------------------------------------------------
   */

  $("watchVideoBtn")
    .addEventListener(
      "click",
      () => {

        if (
          !state.songs[
            state.currentIndex
          ]
        ) return;

        const song =
          state.songs[
            state.currentIndex
          ];

        if (
          song.type !== "youtube"
        ) return;

        showYouTube();
      }
    );


  function showYouTube() {

    const frame =
      $("youtubeFrame");

    frame.classList
      .remove("hidden-video");

    state.youtubeVisible =
      true;
  }


  function hideYouTube() {

    const frame =
      $("youtubeFrame");

    frame.classList
      .add("hidden-video");

    state.youtubeVisible =
      false;
  }


  /*
   * ----------------------------------------------------
   * NEXT / PREVIOUS
   * ----------------------------------------------------
   */

  function nextSong() {

    if (!state.songs.length)
      return;

    let next =
      state.currentIndex + 1;

    if (
      next >= state.songs.length
    ) {
      next = 0;
    }

    playSong(next);
  }


  function previousSong() {

    if (!state.songs.length)
      return;

    const current =
      state.songs[
        state.currentIndex
      ];

    let currentTime = 0;

    if (
      current?.type === "youtube"
    ) {

      try {

        currentTime =
          state.youtubePlayer
            ?.getCurrentTime() || 0;

      } catch (_) {}

    } else {

      currentTime =
        audio.currentTime || 0;
    }

    if (currentTime > 3) {

      if (
        current.type === "youtube"
      ) {

        state.youtubePlayer
          .seekTo(0, true);

        state.youtubePlayer
          .playVideo();

      } else {

        audio.currentTime = 0;

        audio.play();
      }

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


  $("nextBtn")
    .addEventListener(
      "click",
      nextSong
    );

  $("prevBtn")
    .addEventListener(
      "click",
      previousSong
    );


  /*
   * ----------------------------------------------------
   * PLAY / PAUSE
   * ----------------------------------------------------
   */

  $("playBtn")
    .addEventListener(
      "click",
      () => {

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

        if (!song) return;

        if (
          song.type === "youtube"
        ) {

          if (state.isPlaying) {

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

                updatePlayButton();
              })
              .catch(console.error);

          } else {

            audio.pause();
          }
        }
      }
    );


  audio.addEventListener(
    "play",
    () => {

      state.isPlaying = true;

      updatePlayButton();

      startProgress();

    }
  );


  audio.addEventListener(
    "pause",
    () => {

      state.isPlaying = false;

      updatePlayButton();

    }
  );


  audio.addEventListener(
    "ended",
    nextSong
  );


  /*
   * ----------------------------------------------------
   * PROGRESS
   * ----------------------------------------------------
   */

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

    if (!song) return;

    let current = 0;
    let duration = 0;

    if (
      song.type === "youtube"
    ) {

      try {

        current =
          state.youtubePlayer
            ?.getCurrentTime() || 0;

        duration =
          state.youtubePlayer
            ?.getDuration() || 0;

      } catch (_) {}

    } else {

      current =
        audio.currentTime || 0;

      duration =
        audio.duration || 0;
    }

    if (duration > 0) {

      $("progress").value =
        (current / duration) * 100;
    }

    $("currentTime")
      .textContent =
      formatTime(current);

    $("duration")
      .textContent =
      formatTime(duration);
  }


  $("progress")
    .addEventListener(
      "input",
      () => {

        const song =
          state.songs[
            state.currentIndex
          ];

        if (!song) return;

        const percentage =
          Number(
            $("progress").value
          ) / 100;

        if (
          song.type === "youtube"
        ) {

          const duration =
            state.youtubePlayer
              .getDuration();

          state.youtubePlayer
            .seekTo(
              duration * percentage,
              true
            );

        } else {

          if (!audio.duration)
            return;

          audio.currentTime =
            audio.duration *
            percentage;
        }
      }
    );


  function formatTime(seconds) {

    if (
      !Number.isFinite(seconds)
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
      .padStart(2, "0");

    return `${minutes}:${secs}`;
  }


  /*
   * ----------------------------------------------------
   * PLAYER INFO
   * ----------------------------------------------------
   */

  function updatePlayerInfo(song) {

    $("playerTitle")
      .textContent =
      song.title;

    $("playerArtist")
      .textContent =
      song.artist;

    $("playerCover").src =
      song.cover ||
      DEFAULT_COVER;

    $("playerCover").onerror =
      () => {

        $("playerCover").src =
          DEFAULT_COVER;
      };


    if (
      song.type === "youtube"
    ) {

      $("watchVideoBtn")
        .classList
        .remove("hidden");

    } else {

      $("watchVideoBtn")
        .classList
        .add("hidden");

      hideYouTube();
    }
  }


  function updatePlayButton() {

    $("playBtn").textContent =
      state.isPlaying
        ? "❚❚"
        : "▶";
  }


  /*
   * ----------------------------------------------------
   * SIDE DRAWER / MENU
   *
   * ONLY UI/NAVIGATION CHANGE
   * ----------------------------------------------------
   */

  document
    .querySelectorAll(".menu-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          if (page) {

            showPage(page);
          }

          closeDrawer();
        }
      );

    });


  function showPage(page) {

    document
      .querySelectorAll(".page")
      .forEach(item => {

        item.classList
          .remove("active");

      });


    const target =
      $(`${page}Page`);

    if (target) {

      target.classList
        .add("active");
    }


    document
      .querySelectorAll(".menu-item")
      .forEach(item => {

        item.classList.toggle(
          "active",
          item.dataset.page === page
        );

      });


    if (page === "admin") {

      openAdmin();
    }


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  /*
   * ----------------------------------------------------
   * MOBILE DRAWER
   * ----------------------------------------------------
   */

  const mobileMenu =
    $("mobileMenu");

  const sidebar =
    $("sidebar");

  const drawerOverlay =
    $("drawerOverlay");


  function openDrawer() {

    if (sidebar) {

      sidebar.classList
        .add("open");
    }

    if (drawerOverlay) {

      drawerOverlay.classList
        .add("active");
    }

    document.body
      .classList
      .add("drawer-open");
  }


  function closeDrawer() {

    if (sidebar) {

      sidebar.classList
        .remove("open");
    }

    if (drawerOverlay) {

      drawerOverlay.classList
        .remove("active");
    }

    document.body
      .classList
      .remove("drawer-open");
  }


  if (mobileMenu) {

    mobileMenu.addEventListener(
      "click",
      () => {

        if (
          sidebar.classList
            .contains("open")
        ) {

          closeDrawer();

        } else {

          openDrawer();
        }
      }
    );
  }


  if (drawerOverlay) {

    drawerOverlay.addEventListener(
      "click",
      closeDrawer
    );
  }


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeDrawer();
      }
    }
  );


  /*
   * ----------------------------------------------------
   * SEARCH
   * ----------------------------------------------------
   */

  $("searchInput")
    .addEventListener(
      "input",
      event => {

        const query =
          event.target.value
            .trim()
            .toLowerCase();

        if (query) {

          showPage("search");

          renderSearch(query);

        } else {

          renderSearch("");
        }
      }
    );


  /*
   * ----------------------------------------------------
   * HERO PLAY
   * ----------------------------------------------------
   */

  $("heroPlay")
    .addEventListener(
      "click",
      () => {

        if (!state.songs.length)
          return;

        playSong(
          state.currentIndex >= 0
            ? state.currentIndex
            : 0
        );
      }
    );


  /*
   * ----------------------------------------------------
   * REFRESH
   * ----------------------------------------------------
   */

  $("refreshBtn")
    .addEventListener(
      "click",
      loadSongs
    );


  /*
   * ----------------------------------------------------
   * LIKES
   * ----------------------------------------------------
   */

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

    renderLiked();
  }


  /*
   * ----------------------------------------------------
   * ADMIN
   * ----------------------------------------------------
   */

  function openAdmin() {

    $("adminContent")
      .classList
      .add("hidden");

    $("adminLocked")
      .classList
      .remove("hidden");

    $("adminKey").value = "";

    $("adminError")
      .textContent = "";
  }


  $("adminLogin")
    .addEventListener(
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
              "Invalid key"
            );
          }


          state.adminKey =
            key;


          $("adminLocked")
            .classList
            .add("hidden");


          $("adminContent")
            .classList
            .remove("hidden");


        } catch (error) {

          $("adminError")
            .textContent =
            error.message ||
            "Admin authentication failed.";
        }

      }
    );


  /*
   * ----------------------------------------------------
   * YOUTUBE ADMIN UPLOAD
   * ----------------------------------------------------
   */

  $("youtubeForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (!state.adminKey) {

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
          getYouTubeId(url);


        if (!videoId) {

          $("youtubeStatus")
            .textContent =
            "Invalid YouTube URL.";

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

                    type: "youtube",

                    source: "youtube",

                    youtube_url: url,

                    youtubeUrl: url,

                    youtube_id: videoId
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


          $("youtubeStatus")
            .textContent =
            "YouTube song added successfully.";


          event.target.reset();


          $("ytCategory").value =
            "Music";


          await loadSongs();


        } catch (error) {

          console.error(error);

          $("youtubeStatus")
            .textContent =
            error.message;
        }

      }
    );


  /*
   * ----------------------------------------------------
   * MP3 ADMIN UPLOAD
   * ----------------------------------------------------
   */

  $("mp3Form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        if (!state.adminKey) {

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
              "/api/admin/upload",
              {
                method: "POST",

                headers: {
                  "Authorization":
                    `Bearer ${state.adminKey}`
                },

                body: formData
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


          $("mp3Category").value =
            "Music";


          await loadSongs();


        } catch (error) {

          console.error(error);

          $("mp3Status")
            .textContent =
            error.message;
        }

      }
    );


  /*
   * ----------------------------------------------------
   * ESCAPE HTML
   * ----------------------------------------------------
   */

  function escapeHtml(value) {

    return String(value ?? "")

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


  /*
   * ----------------------------------------------------
   * INITIALIZE
   * ----------------------------------------------------
   */

  loadSongs();

})();