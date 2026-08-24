const state = {
  songs: [],
  queue: [],
  queueIndex: -1,
  current: null,
  index: -1,

  shuffle: false,
  repeat: "off",

  youtubeReady: false,
  youtubeLoading: null,
  youtubePlayer: null,

  favorites: new Set(),

  mode: "music"
};

const audio =
  document.getElementById("audio");

const $ = id =>
  document.getElementById(id);

/* -------------------------------------------------------
   YOUTUBE API
------------------------------------------------------- */

function loadYouTubeAPI() {
  if (
    state.youtubeReady &&
    window.YT &&
    window.YT.Player
  ) {
    return Promise.resolve();
  }

  if (state.youtubeLoading) {
    return state.youtubeLoading;
  }

  state.youtubeLoading =
    new Promise(resolve => {

      const previous =
        window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady =
        () => {

          state.youtubeReady = true;

          if (
            typeof previous ===
            "function"
          ) {
            previous();
          }

          resolve();
        };

      const existing =
        document.querySelector(
          "script[data-youtube-api]"
        );

      if (!existing) {

        const script =
          document.createElement(
            "script"
          );

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        script.dataset.youtubeApi =
          "true";

        document.head.appendChild(
          script
        );
      }
    });

  return state.youtubeLoading;
}

/* -------------------------------------------------------
   TOAST
------------------------------------------------------- */

function toast(message) {
  const element =
    $("toast");

  element.textContent =
    message;

  element.classList.add(
    "show"
  );

  clearTimeout(
    toast.timer
  );

  toast.timer =
    setTimeout(() => {
      element.classList.remove(
        "show"
      );
    }, 2500);
}

/* -------------------------------------------------------
   API
------------------------------------------------------- */

async function loadSongs() {

  try {

    const response =
      await fetch(
        "/api/songs"
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
        "Unable to load songs"
      );
    }

    state.songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    state.queue =
      [...state.songs];

    renderAll();

  } catch (error) {

    console.error(error);

    toast(
      "Unable to load songs"
    );
  }
}

async function loadYouTubeSongs() {

  try {

    const response =
      await fetch(
        "/api/youtube"
      );

    const data =
      await response.json();

    return data.songs || [];

  } catch (error) {

    console.error(
      "YouTube load error:",
      error
    );

    return [];
  }
}

/* -------------------------------------------------------
   RENDER
------------------------------------------------------- */

function renderAll() {

  renderSongs(
    $("recentSongs"),
    state.songs.slice(0, 12)
  );

  renderSongs(
    $("musicSongs"),
    state.songs.filter(
      song =>
        song.source_type ===
        "mp3"
    )
  );

  renderSongs(
    $("youtubeSongs"),
    state.songs.filter(
      song =>
        song.source_type ===
        "youtube"
    )
  );

  renderSongs(
    $("librarySongs"),
    state.songs.filter(
      song =>
        state.favorites.has(
          String(song.id)
        )
    )
  );

  renderCategories();
}

function renderSongs(
  container,
  songs
) {

  if (!container) {
    return;
  }

  if (!songs.length) {

    container.innerHTML =
      `<div class="empty">
        No songs found
      </div>`;

    return;
  }

  container.innerHTML =
    songs.map(song => {

      const isYouTube =
        song.source_type ===
        "youtube";

      const cover =
        song.cover_url ||
        "/images/ganpati.jpg";

      return `
        <article
          class="song-card"
          data-id="${escapeHtml(song.id)}"
        >

          <div class="cover-wrap">

            <img
              src="${escapeHtml(cover)}"
              alt=""
              loading="lazy"
            >

            <button
              class="play-button"
              onclick="playById('${escapeHtml(song.id)}')"
            >
              ${isYouTube ? "▶" : "▶"}
            </button>

          </div>

          <div class="song-details">

            <h3>
              ${escapeHtml(song.title)}
            </h3>

            <p>
              ${escapeHtml(song.artist)}
            </p>

            <span class="source">
              ${
                isYouTube
                  ? "▶ YouTube"
                  : "🎵 MP3"
              }
            </span>

          </div>

          <button
            class="favorite"
            onclick="toggleFavorite('${escapeHtml(song.id)}')"
          >
            ${
              state.favorites.has(
                String(song.id)
              )
                ? "♥"
                : "♡"
            }
          </button>

        </article>
      `;
    }).join("");
}

function renderCategories() {

  const element =
    $("categories");

  if (!element) {
    return;
  }

  const categories =
    [
      ...new Set(
        state.songs
          .map(
            song =>
              song.category
          )
          .filter(Boolean)
      )
    ];

  element.innerHTML =
    categories.map(
      category => `
        <button
          onclick="filterCategory('${escapeHtml(category)}')"
        >
          ${escapeHtml(category)}
        </button>
      `
    ).join("");
}

/* -------------------------------------------------------
   PLAY
------------------------------------------------------- */

function playById(id) {

  const song =
    state.songs.find(
      item =>
        String(item.id) ===
        String(id)
    );

  if (!song) {
    toast("Song not found");
    return;
  }

  state.current =
    song;

  state.index =
    state.songs.indexOf(song);

  if (!state.queue.length) {
    state.queue =
      [...state.songs];
  }

  state.queueIndex =
    state.queue.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  if (
    song.source_type ===
    "youtube"
  ) {

    playYouTube(song);

  } else {

    playMP3(song);
  }
}

/* -------------------------------------------------------
   MP3
------------------------------------------------------- */

function playMP3(song) {

  stopYouTube();

  const url =
    song.audio_url ||
    song.file_path;

  if (!url) {
    toast(
      "MP3 URL is missing"
    );

    return;
  }

  audio.src =
    url;

  audio.load();

  audio.play()
    .then(() => {
      setPlaying(true);
    })
    .catch(error => {

      console.error(
        "MP3 PLAY ERROR:",
        error
      );

      toast(
        "Unable to play MP3"
      );
    });

  state.mode =
    "music";

  $("videoModeButton")
    ?.classList.add(
      "hidden"
    );

  $("musicModeButton")
    ?.classList.add(
      "hidden"
    );

  updatePlayer(song);
}

/* -------------------------------------------------------
   YOUTUBE
------------------------------------------------------- */

async function playYouTube(song) {

  if (!song.youtube_id) {

    toast(
      "YouTube video ID missing"
    );

    return;
  }

  audio.pause();

  try {

    await loadYouTubeAPI();

    if (!state.youtubePlayer) {

      state.youtubePlayer =
        new YT.Player(
          "youtubePlayer",
          {
            width: "100%",
            height: "100%",

            videoId:
              song.youtube_id,

            playerVars: {
              autoplay: 1,
              playsinline: 1,
              controls: 1,
              rel: 0,
              modestbranding: 1
            },

            events: {

              onReady(event) {
                event.target.playVideo();
              },

              onStateChange(event) {
                youtubeStateChange(
                  event
                );
              },

              onError(event) {

                console.error(
                  "YouTube error:",
                  event.data
                );

                toast(
                  "Unable to play this YouTube video"
                );
              }
            }
          }
        );

    } else {

      state.youtubePlayer
        .loadVideoById(
          song.youtube_id
        );
    }

    state.mode =
      "music";

    $("videoModeButton")
      ?.classList.remove(
        "hidden"
      );

    $("musicModeButton")
      ?.classList.add(
        "hidden"
      );

    updatePlayer(song);

    setPlaying(true);

  } catch (error) {

    console.error(
      "YOUTUBE ERROR:",
      error
    );

    toast(
      "Unable to start YouTube"
    );
  }
}

function youtubeStateChange(event) {

  if (!window.YT) {
    return;
  }

  if (
    event.data ===
    YT.PlayerState.PLAYING
  ) {

    setPlaying(true);
  }

  if (
    event.data ===
    YT.PlayerState.PAUSED
  ) {

    setPlaying(false);
  }

  if (
    event.data ===
    YT.PlayerState.ENDED
  ) {

    setPlaying(false);

    nextSong();
  }
}

function stopYouTube() {

  if (
    state.youtubePlayer &&
    typeof
      state.youtubePlayer.pauseVideo ===
      "function"
  ) {

    state.youtubePlayer.pauseVideo();
  }
}

/* -------------------------------------------------------
   PLAYER
------------------------------------------------------- */

function updatePlayer(song) {

  $("playerTitle").textContent =
    song.title;

  $("playerArtist").textContent =
    song.artist;

  $("playerCover").src =
    song.cover_url ||
    "/images/ganpati.jpg";
}

function setPlaying(playing) {

  const button =
    $("playPause");

  if (!button) {
    return;
  }

  button.textContent =
    playing
      ? "⏸"
      : "▶";
}

function togglePlay() {

  if (!state.current) {
    return;
  }

  if (
    state.current.source_type ===
    "youtube"
  ) {

    if (
      !state.youtubePlayer
    ) {
      return;
    }

    const playerState =
      state.youtubePlayer
        .getPlayerState();

    if (
      playerState ===
      YT.PlayerState.PLAYING
    ) {

      state.youtubePlayer
        .pauseVideo();

    } else {

      state.youtubePlayer
        .playVideo();
    }

    return;
  }

  if (audio.paused) {

    audio.play()
      .then(() => {
        setPlaying(true);
      });

  } else {

    audio.pause();

    setPlaying(false);
  }
}

/* -------------------------------------------------------
   NEXT / PREVIOUS
------------------------------------------------------- */

function nextSong() {

  if (!state.queue.length) {
    return;
  }

  if (
    state.repeat ===
    "one"
  ) {

    playById(
      state.current.id
    );

    return;
  }

  let nextIndex;

  if (state.shuffle) {

    nextIndex =
      Math.floor(
        Math.random() *
        state.queue.length
      );

  } else {

    nextIndex =
      state.queueIndex + 1;

    if (
      nextIndex >=
      state.queue.length
    ) {

      if (
        state.repeat ===
        "all"
      ) {
        nextIndex = 0;
      } else {
        return;
      }
    }
  }

  state.queueIndex =
    nextIndex;

  playById(
    state.queue[nextIndex].id
  );
}

function previousSong() {

  if (!state.queue.length) {
    return;
  }

  let previousIndex =
    state.queueIndex - 1;

  if (
    previousIndex < 0
  ) {
    previousIndex =
      state.queue.length - 1;
  }

  state.queueIndex =
    previousIndex;

  playById(
    state.queue[previousIndex].id
  );
}

/* -------------------------------------------------------
   SHUFFLE / REPEAT
------------------------------------------------------- */

function toggleShuffle() {

  state.shuffle =
    !state.shuffle;

  $("shuffle")
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

function toggleRepeat() {

  const modes =
    [
      "off",
      "one",
      "all"
    ];

  const index =
    modes.indexOf(
      state.repeat
    );

  state.repeat =
    modes[
      (index + 1) %
      modes.length
    ];

  $("repeat").textContent =
    state.repeat === "one"
      ? "🔂"
      : "🔁";

  toast(
    `Repeat: ${state.repeat}`
  );
}

/* -------------------------------------------------------
   MUSIC / VIDEO MODE
------------------------------------------------------- */

function switchToVideoMode() {

  if (
    state.current?.source_type !==
    "youtube"
  ) {
    return;
  }

  state.mode =
    "video";

  $("youtubePlayer")
    ?.classList.add(
      "video-active"
    );

  $("videoModeButton")
    ?.classList.add(
      "hidden"
    );

  $("musicModeButton")
    ?.classList.remove(
      "hidden"
    );
}

function switchToMusicMode() {

  state.mode =
    "music";

  $("youtubePlayer")
    ?.classList.remove(
      "video-active"
    );

  $("videoModeButton")
    ?.classList.remove(
      "hidden"
    );

  $("musicModeButton")
    ?.classList.add(
      "hidden"
    );
}

/* -------------------------------------------------------
   SEARCH
------------------------------------------------------- */

function searchSongs(value) {

  const query =
    value
      .trim()
      .toLowerCase();

  if (!query) {

    renderAll();

    return;
  }

  const results =
    state.songs.filter(
      song =>
        [
          song.title,
          song.artist,
          song.album,
          song.category,
          song.language
        ]
          .filter(Boolean)
          .some(
            field =>
              String(field)
                .toLowerCase()
                .includes(query)
          )
    );

  renderSongs(
    $("musicSongs"),
    results
  );
}

/* -------------------------------------------------------
   CATEGORY
------------------------------------------------------- */

function filterCategory(category) {

  const results =
    state.songs.filter(
      song =>
        song.category ===
        category
    );

  document
    .querySelectorAll(".page")
    .forEach(
      page =>
        page.classList.remove(
          "active"
        )
    );

  $("music")
    .classList.add(
      "active"
    );

  renderSongs(
    $("musicSongs"),
    results
  );
}

/* -------------------------------------------------------
   FAVORITES
------------------------------------------------------- */

function toggleFavorite(id) {

  const key =
    String(id);

  if (
    state.favorites.has(key)
  ) {

    state.favorites.delete(
      key
    );

  } else {

    state.favorites.add(
      key
    );
  }

  renderAll();
}

/* -------------------------------------------------------
   ADMIN
------------------------------------------------------- */

async function addYouTubeSong(event) {

  event.preventDefault();

  const form =
    event.target;

  const formData =
    new FormData(form);

  formData.append(
    "source_type",
    "youtube"
  );

  try {

    const response =
      await fetch(
        "/api/admin/songs",
        {
          method: "POST",
          body: formData
        }
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
        "Failed to add YouTube song"
      );
    }

    toast(
      "YouTube song added"
    );

    form.reset();

    await loadSongs();

  } catch (error) {

    console.error(error);

    toast(
      error.message
    );
  }
}

async function addMP3Song(event) {

  event.preventDefault();

  const form =
    event.target;

  const formData =
    new FormData(form);

  formData.append(
    "source_type",
    "mp3"
  );

  try {

    const response =
      await fetch(
        "/api/admin/songs",
        {
          method: "POST",
          body: formData
        }
      );

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
        "Failed to add MP3"
      );
    }

    toast(
      "MP3 song added"
    );

    form.reset();

    await loadSongs();

  } catch (error) {

    console.error(error);

    toast(
      error.message
    );
  }
}

/* -------------------------------------------------------
   NAVIGATION
------------------------------------------------------- */

document
  .querySelectorAll(
    "[data-tab]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const tab =
          button.dataset.tab;

        document
          .querySelectorAll(
            ".page"
          )
          .forEach(page => {
            page.classList.remove(
              "active"
            );
          });

        const target =
          $(tab);

        if (target) {
          target.classList.add(
            "active"
          );
        }
      }
    );
  });

/* -------------------------------------------------------
   EVENTS
------------------------------------------------------- */

$("playPause")
  ?.addEventListener(
    "click",
    togglePlay
  );

$("next")
  ?.addEventListener(
    "click",
    nextSong
  );

$("previous")
  ?.addEventListener(
    "click",
    previousSong
  );

$("shuffle")
  ?.addEventListener(
    "click",
    toggleShuffle
  );

$("repeat")
  ?.addEventListener(
    "click",
    toggleRepeat
  );

$("videoModeButton")
  ?.addEventListener(
    "click",
    switchToVideoMode
  );

$("musicModeButton")
  ?.addEventListener(
    "click",
    switchToMusicMode
  );

$("searchInput")
  ?.addEventListener(
    "input",
    event =>
      searchSongs(
        event.target.value
      )
  );

$("youtubeForm")
  ?.addEventListener(
    "submit",
    addYouTubeSong
  );

$("mp3Form")
  ?.addEventListener(
    "submit",
    addMP3Song
  );

audio.addEventListener(
  "timeupdate",
  () => {

    if (
      !audio.duration
    ) {
      return;
    }

    const percentage =
      (
        audio.currentTime /
        audio.duration
      ) * 100;

    $("progressBar").value =
      percentage;

    $("currentTime")
      .textContent =
        formatTime(
          audio.currentTime
        );

    $("duration")
      .textContent =
        formatTime(
          audio.duration
        );
  }
);

audio.addEventListener(
  "ended",
  nextSong
);

$("progressBar")
  ?.addEventListener(
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

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

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

  const remaining =
    Math.floor(
      seconds % 60
    );

  return `${minutes}:${String(
    remaining
  ).padStart(2, "0")}`;
}

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------------------------------------------------------
   START
------------------------------------------------------- */

loadSongs();