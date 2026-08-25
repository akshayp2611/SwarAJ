(() => {

  "use strict";


  /* =====================================================
     STATE
  ===================================================== */

  const state = {

    songs: [],

    currentIndex: -1,

    liked: JSON.parse(
      localStorage.getItem("swaraj-liked") || "[]"
    ),

    playlist: JSON.parse(
      localStorage.getItem("swaraj-playlist") || "[]"
    ),

    adminKey: localStorage.getItem(
      "swaraj-admin-key"
    ) || null,

    youtubeReady: false,

    youtubePlayer: null,

    youtubeIndex: -1,

    currentPage: "home"

  };


  /* =====================================================
     DOM
  ===================================================== */

  const $ = id =>
    document.getElementById(id);


  const audio = $("audioPlayer");

  const playerTitle =
    $("playerTitle");

  const playerArtist =
    $("playerArtist");

  const playerCover =
    $("playerCover");

  const playBtn =
    $("playBtn");

  const progress =
    $("progress");

  const currentTime =
    $("currentTime");

  const duration =
    $("duration");

  const songCount =
    $("songCount");

  const sidebar =
    $("sidebar");

  const drawerOverlay =
    $("drawerOverlay");


  /* =====================================================
     HELPERS
  ===================================================== */

  function escapeHtml(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const min =
      Math.floor(seconds / 60);

    const sec =
      Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");

    return `${min}:${sec}`;
  }


  function saveLiked() {

    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(state.liked)
    );
  }


  function savePlaylist() {

    localStorage.setItem(
      "swaraj-playlist",
      JSON.stringify(state.playlist)
    );
  }


  function getSongId(song) {

    return String(
      song.id ||
      song.url ||
      song.path ||
      song.title
    );
  }


  function isLiked(song) {

    return state.liked.includes(
      getSongId(song)
    );
  }


  function isInPlaylist(song) {

    return state.playlist.includes(
      getSongId(song)
    );
  }


  /* =====================================================
     NORMALIZE SONG
  ===================================================== */

  function normalizeSong(song, index) {

    const rawUrl =
      song.url ||
      song.src ||
      song.path ||
      "";

    let type =
      String(
        song.type ||
        song.source ||
        ""
      ).toLowerCase();

    if (
      type !== "youtube" &&
      (
        rawUrl.includes("youtube.com") ||
        rawUrl.includes("youtu.be")
      )
    ) {
      type = "youtube";
    }

    if (!type) {
      type = "mp3";
    }

    let cover =
      song.cover ||
      song.coverUrl ||
      song.image ||
      song.thumbnail ||
      "/images/default-cover.jpg";

    let title =
      song.title ||
      song.name ||
      `Song ${index + 1}`;

    let artist =
      song.artist ||
      song.author ||
      (type === "youtube"
        ? "YouTube"
        : "SwarAJ");

    let category =
      song.category ||
      song.genre ||
      "Music";

    return {

      ...song,

      id:
        song.id ||
        `${type}-${index}-${title}`,

      title,

      artist,

      category,

      cover,

      url:
        rawUrl,

      type

    };
  }


  /* =====================================================
     LOAD SONGS
  ===================================================== */

  async function loadSongs() {

    renderLoading(
      $("songList")
    );

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
        songs.map(normalizeSong);

      renderAll();

    } catch (error) {

      console.error(
        "Song loading failed:",
        error
      );

      state.songs = [];

      renderEmpty(
        $("songList"),
        "Unable to load songs."
      );

      songCount.textContent =
        "0 songs";
    }
  }


  /* =====================================================
     RENDER
  ===================================================== */

  function renderAll() {

    songCount.textContent =
      `${state.songs.length} ${
        state.songs.length === 1
          ? "song"
          : "songs"
      }`;

    renderSongs(
      state.songs,
      $("songList")
    );

    renderSongs(
      state.songs,
      $("libraryList")
    );

    renderLiked();

    renderPlaylist();

    updateSearch();
  }


  function renderLoading(container) {

    if (!container) return;

    container.innerHTML = `
      <div class="admin-card">
        Loading music...
      </div>
    `;
  }


  function renderEmpty(
    container,
    message
  ) {

    if (!container) return;

    container.innerHTML = `
      <div class="admin-card">
        ${escapeHtml(message)}
      </div>
    `;
  }


  function renderSongs(
    songs,
    container
  ) {

    if (!container) return;

    if (!songs.length) {

      renderEmpty(
        container,
        "No songs found."
      );

      return;
    }

    container.innerHTML =
      songs.map(
        (song, index) =>
          songTemplate(
            song,
            index
          )
      ).join("");
  }


  /* =====================================================
     SONG TEMPLATE
  ===================================================== */

  function songTemplate(
    song,
    index
  ) {

    const youtube =
      song.type === "youtube";

    const liked =
      isLiked(song);

    const playlist =
      isInPlaylist(song);

    return `

      <article
        class="song ${
          state.currentIndex === index
            ? "playing"
            : ""
        }"
        data-song-index="${index}"
      >

        <img
          class="song-cover"
          src="${escapeHtml(song.cover)}"
          alt=""
          loading="lazy"
          onerror="this.src='/images/default-cover.jpg'"
        >

        <div class="song-details">

          <div class="song-name">
            ${escapeHtml(song.title)}
          </div>

          <div class="song-artist">
            ${escapeHtml(song.artist)}
          </div>

          <div class="song-type">
            ${youtube ? "YouTube" : escapeHtml(song.category)}
          </div>

        </div>

        <div class="song-actions">

          ${
            youtube
              ? `
                <button
                  class="watch-song-btn"
                  data-action="watch"
                  data-index="${index}"
                >
                  ▶ Watch
                </button>
              `
              : ""
          }

          <button
            class="song-play"
            data-action="play"
            data-index="${index}"
            title="Play"
          >
            ▶
          </button>

          <button
            class="song-play"
            data-action="like"
            data-index="${index}"
            title="Like"
          >
            ${liked ? "♥" : "♡"}
          </button>

          <button
            class="song-play"
            data-action="playlist"
            data-index="${index}"
            title="Playlist"
          >
            ${playlist ? "✓" : "+"}
          </button>

        </div>

      </article>
    `;
  }


  /* =====================================================
     LIKED
  ===================================================== */

  function renderLiked() {

    const likedSongs =
      state.songs.filter(
        song =>
          isLiked(song)
      );

    renderSongs(
      likedSongs,
      $("likedList")
    );
  }


  /* =====================================================
     PLAYLIST
  ===================================================== */

  function renderPlaylist() {

    const playlistSongs =
      state.songs.filter(
        song =>
          isInPlaylist(song)
      );

    renderSongs(
      playlistSongs,
      $("playlistList")
    );
  }


  /* =====================================================
     PLAY SONG
  ===================================================== */

  function playSong(
    index
  ) {

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

    stopYoutube();

    playerTitle.textContent =
      song.title;

    playerArtist.textContent =
      song.artist;

    playerCover.src =
      song.cover ||
      "/images/default-cover.jpg";


    if (
      song.type === "youtube"
    ) {

      playYoutube(
        song,
        index
      );

    } else {

      audio.src =
        song.url;

      audio.play()
        .then(() => {

          playBtn.textContent =
            "❚❚";

        })
        .catch(error => {

          console.error(
            "Audio play error:",
            error
          );

          playBtn.textContent =
            "▶";
        });
    }

    renderAll();
  }


  /* =====================================================
     AUDIO
  ===================================================== */

  audio.addEventListener(
    "play",
    () => {

      playBtn.textContent =
        "❚❚";
    }
  );


  audio.addEventListener(
    "pause",
    () => {

      playBtn.textContent =
        "▶";
    }
  );


  audio.addEventListener(
    "timeupdate",
    () => {

      if (
        !Number.isFinite(
          audio.duration
        )
      ) {
        return;
      }

      const percentage =
        audio.duration
          ? (
              audio.currentTime /
              audio.duration
            ) * 100
          : 0;

      progress.value =
        percentage;

      currentTime.textContent =
        formatTime(
          audio.currentTime
        );

      duration.textContent =
        formatTime(
          audio.duration
        );
    }
  );


  audio.addEventListener(
    "ended",
    () => {

      nextSong();
    }
  );


  /* =====================================================
     PROGRESS
  ===================================================== */

  progress.addEventListener(
    "input",
    () => {

      if (
        !Number.isFinite(
          audio.duration
        )
      ) {
        return;
      }

      audio.currentTime =
        (
          Number(progress.value) /
          100
        ) *
        audio.duration;
    }
  );


  /* =====================================================
     PLAY / PAUSE
  ===================================================== */

  playBtn.addEventListener(
    "click",
    () => {

      if (
        state.currentIndex === -1
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

      if (
        song &&
        song.type === "youtube"
      ) {

        if (
          state.youtubePlayer &&
          state.youtubeReady
        ) {

          const playerState =
            state.youtubePlayer
              .getPlayerState();

          if (
            playerState === 1
          ) {

            state.youtubePlayer.pauseVideo();

          } else {

            state.youtubePlayer.playVideo();
          }
        }

      } else {

        if (audio.paused) {

          audio.play();

        } else {

          audio.pause();
        }
      }
    }
  );


  /* =====================================================
     NEXT
  ===================================================== */

  function nextSong() {

    if (!state.songs.length) {
      return;
    }

    const next =
      state.currentIndex < 0
        ? 0
        : (
            state.currentIndex + 1
          ) %
          state.songs.length;

    playSong(next);
  }


  $("nextBtn").addEventListener(
    "click",
    nextSong
  );


  /* =====================================================
     PREVIOUS
  ===================================================== */

  function previousSong() {

    if (!state.songs.length) {
      return;
    }

    const previous =
      state.currentIndex <= 0
        ? state.songs.length - 1
        : state.currentIndex - 1;

    playSong(previous);
  }


  $("prevBtn").addEventListener(
    "click",
    previousSong
  );


  /* =====================================================
     YOUTUBE
  ===================================================== */

  window.onYouTubeIframeAPIReady =
    function () {

      state.youtubeReady =
        true;

      console.log(
        "YouTube API ready"
      );
    };


  function extractYoutubeId(url) {

    if (!url) {
      return null;
    }

    try {

      const parsed =
        new URL(url);

      if (
        parsed.hostname.includes(
          "youtu.be"
        )
      ) {

        return parsed.pathname
          .replace("/", "")
          .split("/")[0];
      }

      if (
        parsed.searchParams.has("v")
      ) {

        return parsed.searchParams
          .get("v");
      }

      const match =
        url.match(
          /(?:embed\/|shorts\/)([A-Za-z0-9_-]{11})/
        );

      return match
        ? match[1]
        : null;

    } catch {

      const match =
        String(url).match(
          /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/
        );

      return match
        ? match[1]
        : null;
    }
  }


  function playYoutube(
    song,
    index
  ) {

    const videoId =
      extractYoutubeId(
        song.url
      );

    if (!videoId) {

      console.error(
        "Invalid YouTube URL:",
        song.url
      );

      return;
    }

    state.youtubeIndex =
      index;

    const frame =
      $("youtubeFrame");

    frame.classList.remove(
      "hidden-video"
    );


    if (
      state.youtubePlayer &&
      state.youtubeReady
    ) {

      state.youtubePlayer.loadVideoById(
        videoId
      );

      return;
    }


    if (
      !window.YT ||
      !window.YT.Player
    ) {

      setTimeout(
        () =>
          playYoutube(
            song,
            index
          ),
        500
      );

      return;
    }


    state.youtubePlayer =
      new YT.Player(
        "youtubePlayer",
        {

          width: "100%",

          height: "100%",

          videoId,

          playerVars: {

            autoplay: 1,

            controls: 1,

            rel: 0,

            modestbranding: 1
          },

          events: {

            onReady: event => {

              state.youtubeReady =
                true;

              event.target.playVideo();

            },

            onStateChange: event => {

              if (
                event.data ===
                YT.PlayerState.PLAYING
              ) {

                playBtn.textContent =
                  "❚❚";

              }

              if (
                event.data ===
                YT.PlayerState.PAUSED
              ) {

                playBtn.textContent =
                  "▶";
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
  }


  function stopYoutube() {

    if (
      state.youtubePlayer &&
      state.youtubeReady
    ) {

      try {

        state.youtubePlayer.stopVideo();

      } catch {}
    }

    $("youtubeFrame")
      .classList.add(
        "hidden-video"
      );
  }


  /* =====================================================
     SONG BUTTON EVENTS
  ===================================================== */

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-action]"
        );

      if (!button) {
        return;
      }

      const index =
        Number(
          button.dataset.index
        );

      if (
        !Number.isInteger(index)
      ) {
        return;
      }

      const song =
        state.songs[index];

      if (!song) {
        return;
      }

      const action =
        button.dataset.action;


      if (
        action === "play"
      ) {

        playSong(index);

      }


      if (
        action === "watch"
      ) {

        playSong(index);

      }


      if (
        action === "like"
      ) {

        const id =
          getSongId(song);

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

        saveLiked();

        renderAll();
      }


      if (
        action === "playlist"
      ) {

        const id =
          getSongId(song);

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

        savePlaylist();

        renderAll();
      }

    }
  );


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function showPage(
    page
  ) {

    state.currentPage =
      page;

    document
      .querySelectorAll(".page")
      .forEach(section => {

        section.classList.remove(
          "active"
        );
      });

    const target =
      $(`${page}Page`);

    if (target) {

      target.classList.add(
        "active"
      );
    }

    document
      .querySelectorAll(".menu-item")
      .forEach(button => {

        button.classList.toggle(
          "active",
          button.dataset.page === page
        );
      });

    closeDrawer();
  }


  document
    .querySelectorAll(".menu-item")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );
        }
      );
    });


  /* =====================================================
     MOBILE DRAWER
  ===================================================== */

  $("mobileMenu")
    .addEventListener(
      "click",
      () => {

        sidebar.classList.add(
          "open"
        );

        drawerOverlay.classList.add(
          "active"
        );

        drawerOverlay.classList.add(
          "show"
        );

        document.body.classList.add(
          "drawer-open"
        );
      }
    );


  function closeDrawer() {

    sidebar.classList.remove(
      "open"
    );

    drawerOverlay.classList.remove(
      "active"
    );

    drawerOverlay.classList.remove(
      "show"
    );

    document.body.classList.remove(
      "drawer-open"
    );
  }


  drawerOverlay.addEventListener(
    "click",
    closeDrawer
  );


  /* =====================================================
     SEARCH
  ===================================================== */

  function updateSearch() {

    const input =
      $("searchInput");

    const query =
      input
        ? input.value
            .trim()
            .toLowerCase()
        : "";

    const results =
      query
        ? state.songs.filter(
            song =>
              `${song.title} ${song.artist} ${song.category}`
                .toLowerCase()
                .includes(query)
          )
        : [];

    if (!query) {

      $("searchResults").innerHTML =
        `
          <div class="admin-card">
            Start typing to search your music.
          </div>
        `;

      return;
    }

    renderSongs(
      results,
      $("searchResults")
    );
  }


  $("searchInput")
    .addEventListener(
      "input",
      () => {

        showPage("search");

        updateSearch();
      }
    );


  /* =====================================================
     HERO PLAY
  ===================================================== */

  $("heroPlay")
    .addEventListener(
      "click",
      () => {

        if (!state.songs.length) {

          alert(
            "No songs available."
          );

          return;
        }

        playSong(
          state.currentIndex >= 0
            ? state.currentIndex
            : 0
        );
      }
    );


  /* =====================================================
     REFRESH
  ===================================================== */

  $("refreshBtn")
    .addEventListener(
      "click",
      () => {

        loadSongs();
      }
    );


  /* =====================================================
     ADMIN LOGIN
  ===================================================== */

  $("adminLogin")
    .addEventListener(
      "click",
      async () => {

        const key =
          $("adminKey")
            .value
            .trim();

        const error =
          $("adminError");

        error.textContent =
          "";

        if (!key) {

          error.textContent =
            "Enter admin key.";

          return;
        }


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
                    key
                  })
              }
            );


          const data =
            await response.json();


          if (!response.ok) {

            throw new Error(
              data.error ||
              "Invalid admin key."
            );
          }


          state.adminKey =
            key;

          localStorage.setItem(
            "swaraj-admin-key",
            key
          );

          $("adminLocked")
            .classList.add(
              "hidden"
            );

          $("adminContent")
            .classList.remove(
              "hidden"
            );

        } catch (error) {

          error =
            error.message ||
            "Admin login failed.";

          $("adminError")
            .textContent =
            error;
        }
      }
    );


  /* =====================================================
     AUTO ADMIN SESSION
  ===================================================== */

  if (state.adminKey) {

    $("adminLocked")
      .classList.add(
        "hidden"
      );

    $("adminContent")
      .classList.remove(
        "hidden"
      );
  }


  /* =====================================================
     YOUTUBE ADMIN
  ===================================================== */

  $("youtubeForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const status =
          $("youtubeStatus");

        status.textContent =
          "Adding YouTube song...";


        const payload = {

          title:
            $("ytTitle").value.trim(),

          artist:
            $("ytArtist").value.trim(),

          category:
            $("ytCategory").value.trim(),

          cover:
            $("ytCover").value.trim(),

          url:
            $("ytUrl").value.trim(),

          type:
            "youtube"
        };


        try {

          const response =
            await fetch(
              "/api/admin/youtube",
              {

                method:
                  "POST",

                headers: {

                  "Content-Type":
                    "application/json",

                  "Authorization":
                    `Bearer ${state.adminKey}`
                },

                body:
                  JSON.stringify(
                    payload
                  )
              }
            );


          const data =
            await response.json();


          if (!response.ok) {

            throw new Error(
              data.error ||
              "Unable to add song."
            );
          }


          status.textContent =
            "✓ YouTube song added.";

          $("youtubeForm")
            .reset();

          $("ytArtist").value =
            "YouTube";

          $("ytCategory").value =
            "Music";

          await loadSongs();

        } catch (error) {

          status.textContent =
            error.message ||
            "Unable to add YouTube song.";
        }
      }
    );


  /* =====================================================
     MP3 ADMIN
  ===================================================== */

  $("mp3Form")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const status =
          $("mp3Status");

        const file =
          $("mp3File").files[0];


        if (!file) {

          status.textContent =
            "Select an MP3 file.";

          return;
        }


        status.textContent =
          "Uploading MP3...";


        const formData =
          new FormData();

        formData.append(
          "title",
          $("mp3Title").value.trim()
        );

        formData.append(
          "artist",
          $("mp3Artist").value.trim()
        );

        formData.append(
          "category",
          $("mp3Category").value.trim()
        );

        formData.append(
          "file",
          file
        );


        try {

          const response =
            await fetch(
              "/api/admin/upload",
              {

                method:
                  "POST",

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
              data.error ||
              "Upload failed."
            );
          }


          status.textContent =
            "✓ MP3 uploaded successfully.";

          $("mp3Form")
            .reset();

          $("mp3Artist").value =
            "SwarAJ";

          $("mp3Category").value =
            "Music";

          await loadSongs();

        } catch (error) {

          status.textContent =
            error.message ||
            "MP3 upload failed.";
        }
      }
    );


  /* =====================================================
     START
  ===================================================== */

  loadSongs();

})();