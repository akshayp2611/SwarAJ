let songs = [];

let currentSong = null;

let currentMode = "video";

const songList =
  document.getElementById("songList");

const categoryList =
  document.getElementById("categoryList");

const songCount =
  document.getElementById("songCount");

const audioPlayer =
  document.getElementById("audioPlayer");

const youtubePlayer =
  document.getElementById("youtubePlayer");

const youtubeFrame =
  document.getElementById("youtubeFrame");

const videoContainer =
  document.getElementById("videoContainer");

const playerTitle =
  document.getElementById("playerTitle");

const playerArtist =
  document.getElementById("playerArtist");

const playerCover =
  document.getElementById("playerCover");

const miniPlayer =
  document.getElementById("miniPlayer");

const miniTitle =
  document.getElementById("miniTitle");

const miniArtist =
  document.getElementById("miniArtist");

const musicModeButton =
  document.getElementById("musicModeButton");

const videoModeButton =
  document.getElementById("videoModeButton");

const minimizeButton =
  document.getElementById("minimizeButton");

const closeButton =
  document.getElementById("closeButton");

const expandButton =
  document.getElementById("expandButton");

const miniCloseButton =
  document.getElementById("miniCloseButton");


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
        `API error ${response.status}`
      );
    }

    const data =
      await response.json();

    songs =
      Array.isArray(data)
        ? data
        : Array.isArray(data.songs)
          ? data.songs
          : [];

    renderSongs(songs);

    loadCategories();

  } catch (error) {

    console.error(
      "LOAD SONGS ERROR:",
      error
    );

    songList.innerHTML = `
      <div class="loading-card glass">
        ❌ Unable to load songs.
      </div>
    `;
  }
}


/* =====================================================
   CATEGORIES
===================================================== */

async function loadCategories() {

  try {

    const response =
      await fetch(
        "/api/categories",
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `API error ${response.status}`
      );
    }

    const data =
      await response.json();

    const categories =
      Array.isArray(data)
        ? data
        : data.categories || [];

    renderCategories(categories);

  } catch (error) {

    console.error(
      "CATEGORY ERROR:",
      error
    );

    categoryList.innerHTML = `
      <div class="loading-card glass">
        Unable to load categories.
      </div>
    `;
  }
}


/* =====================================================
   RENDER CATEGORIES
===================================================== */

function renderCategories(categories) {

  if (!categories.length) {

    categoryList.innerHTML = `
      <div class="loading-card glass">
        No categories yet.
      </div>
    `;

    return;
  }

  categoryList.innerHTML =
    categories.map(
      category => {

        const name =
          category.category ||
          "Other";

        const count =
          Number(
            category.song_count || 0
          );

        return `
          <div
            class="category-card glass"
            onclick="filterCategory(${JSON.stringify(name)})"
          >

            <span class="section-kicker">
              MOOD
            </span>

            <br><br>

            <strong>
              ${escapeHtml(name)}
            </strong>

            <small>
              ${count} songs
            </small>

          </div>
        `;
      }
    ).join("");
}


/* =====================================================
   RENDER SONGS
===================================================== */

function renderSongs(list) {

  songCount.textContent =
    `${list.length} ${
      list.length === 1
        ? "song"
        : "songs"
    }`;

  if (!list.length) {

    songList.innerHTML = `
      <div class="loading-card glass">
        No songs available.
      </div>
    `;

    return;
  }

  songList.innerHTML =
    list.map(
      song => {

        const isYouTube =
          Boolean(
            song.youtube_url
          );

        const badge =
          isYouTube
            ? "▶ YouTube"
            : "🎵 MP3";

        const cover =
          song.cover_url
            ? `
              <img
                src="${escapeAttribute(song.cover_url)}"
                alt=""
                loading="lazy"
              >
            `
            : "♪";

        return `
          <div
            class="song-card glass"
            onclick="playSong(${Number(song.id)})"
          >

            <div class="song-art">
              ${cover}
            </div>

            <div class="song-details">

              <strong>
                ${escapeHtml(
                  song.title ||
                  "Unknown Song"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  song.artist ||
                  "Unknown Artist"
                )}
              </small>

            </div>

            <div class="song-badge">
              ${badge}
            </div>

          </div>
        `;
      }
    ).join("");
}


/* =====================================================
   PLAY SONG
===================================================== */

function playSong(id) {

  const song =
    songs.find(
      item =>
        Number(item.id) ===
        Number(id)
    );

  if (!song) return;

  currentSong = song;

  updatePlayerInfo(song);

  /*
   * MP3 / CLOUDINARY
   */

  if (song.audio_url) {

    closeYouTube();

    audioPlayer.style.display =
      "block";

    audioPlayer.src =
      song.audio_url;

    audioPlayer.load();

    audioPlayer.play()
      .catch(
        error =>
          console.warn(
            "Autoplay blocked:",
            error.message
          )
      );

    return;
  }

  /*
   * YOUTUBE
   */

  if (song.youtube_url) {

    audioPlayer.pause();

    audioPlayer.removeAttribute(
      "src"
    );

    audioPlayer.load();

    audioPlayer.style.display =
      "none";

    /*
     * Default YouTube mode:
     * Video
     */

    openYouTube(
      song,
      "video"
    );

    return;
  }

  alert(
    "This song has no playable source."
  );
}


/* =====================================================
   PLAYER INFO
===================================================== */

function updatePlayerInfo(song) {

  const title =
    song.title ||
    "Unknown Song";

  const artist =
    song.artist ||
    "SwarAJ";

  playerTitle.textContent =
    title;

  playerArtist.textContent =
    artist;

  miniTitle.textContent =
    title;

  miniArtist.textContent =
    artist;

  if (song.cover_url) {

    playerCover.innerHTML = `
      <img
        src="${escapeAttribute(song.cover_url)}"
        alt=""
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:inherit;
        "
      >
    `;

  } else {

    playerCover.textContent =
      "♪";
  }
}


/* =====================================================
   YOUTUBE ID
===================================================== */

function getYouTubeVideoId(url) {

  if (!url) return null;

  try {

    const parsed =
      new URL(url);

    const host =
      parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    if (
      host === "youtu.be"
    ) {

      return cleanYouTubeId(
        parsed.pathname
          .replace(/^\/+/, "")
          .split("/")[0]
      );
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {

      const watch =
        parsed.searchParams.get("v");

      if (watch) {
        return cleanYouTubeId(
          watch
        );
      }

      const patterns = [
        /^\/shorts\/([^/?]+)/,
        /^\/embed\/([^/?]+)/,
        /^\/live\/([^/?]+)/
      ];

      for (
        const pattern of patterns
      ) {

        const match =
          parsed.pathname.match(
            pattern
          );

        if (match) {
          return cleanYouTubeId(
            match[1]
          );
        }
      }
    }

  } catch (error) {

    console.warn(
      "Invalid YouTube URL:",
      url
    );

  }

  return null;
}


/* =====================================================
   CLEAN YOUTUBE ID
===================================================== */

function cleanYouTubeId(id) {

  if (!id) return null;

  const value =
    String(id)
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

  if (
    value.length < 5 ||
    value.length > 20
  ) {
    return null;
  }

  return value;
}


/* =====================================================
   OPEN YOUTUBE
===================================================== */

function openYouTube(
  song,
  mode = "video"
) {

  const videoId =
    getYouTubeVideoId(
      song.youtube_url
    );

  if (!videoId) {

    alert(
      "Invalid YouTube URL."
    );

    return;
  }

  currentMode =
    mode;

  youtubePlayer.classList.add(
    "active"
  );

  youtubePlayer.classList.remove(
    "music-only"
  );

  miniPlayer.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "hidden";

  updatePlayerInfo(song);

  setPlayerMode(
    mode,
    false
  );

  /*
   * Official YouTube embed.
   */

  const params =
    new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      controls: "1"
    });

  youtubeFrame.src =
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}


/* =====================================================
   MUSIC ONLY
===================================================== */

function setMusicOnly() {

  if (!currentSong) return;

  currentMode =
    "music";

  youtubePlayer.classList.add(
    "music-only"
  );

  videoContainer.style.display =
    "";

  musicModeButton.classList.add(
    "active"
  );

  videoModeButton.classList.remove(
    "active"
  );

  /*
   * We keep the same YouTube iframe
   * playing while hiding the video.
   */

  miniPlayer.classList.add(
    "active"
  );
}


/* =====================================================
   VIDEO MODE
===================================================== */

function setVideoMode() {

  if (!currentSong) return;

  currentMode =
    "video";

  youtubePlayer.classList.remove(
    "music-only"
  );

  musicModeButton.classList.remove(
    "active"
  );

  videoModeButton.classList.add(
    "active"
  );

  miniPlayer.classList.remove(
    "active"
  );

  youtubePlayer.classList.add(
    "active"
  );

  document.body.style.overflow =
    "hidden";
}


/* =====================================================
   MODE
===================================================== */

function setPlayerMode(
  mode,
  reload
) {

  if (mode === "music") {

    setMusicOnly();

  } else {

    setVideoMode();

  }

  if (reload) {

    reloadCurrentYouTube();
  }
}


/* =====================================================
   RELOAD CURRENT YOUTUBE
===================================================== */

function reloadCurrentYouTube() {

  if (!currentSong) return;

  const videoId =
    getYouTubeVideoId(
      currentSong.youtube_url
    );

  if (!videoId) return;

  const params =
    new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      controls: "1"
    });

  youtubeFrame.src =
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}


/* =====================================================
   MINIMIZE
===================================================== */

function minimizePlayer() {

  if (!currentSong) return;

  youtubePlayer.classList.remove(
    "active"
  );

  miniPlayer.classList.add(
    "active"
  );

  document.body.style.overflow =
    "";

  /*
   * Important:
   * We DO NOT clear the iframe.
   * Therefore the YouTube playback continues.
   */
}


/* =====================================================
   EXPAND
===================================================== */

function expandPlayer() {

  youtubePlayer.classList.add(
    "active"
  );

  miniPlayer.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "hidden";
}


/* =====================================================
   CLOSE
===================================================== */

function closeYouTube() {

  youtubeFrame.src =
    "about:blank";

  youtubePlayer.classList.remove(
    "active"
  );

  miniPlayer.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "";

  currentSong =
    null;
}


/* =====================================================
   BUTTON EVENTS
===================================================== */

musicModeButton.addEventListener(
  "click",
  () => {

    setMusicOnly();

  }
);

videoModeButton.addEventListener(
  "click",
  () => {

    setVideoMode();

  }
);

minimizeButton.addEventListener(
  "click",
  () => {

    minimizePlayer();

  }
);

closeButton.addEventListener(
  "click",
  () => {

    closeYouTube();

  }
);

expandButton.addEventListener(
  "click",
  () => {

    expandPlayer();

  }
);

miniCloseButton.addEventListener(
  "click",
  () => {

    closeYouTube();

  }
);


/* =====================================================
   BACKDROP
===================================================== */

const youtubeBackdrop =
  document.querySelector(
    ".youtube-backdrop"
  );

if (youtubeBackdrop) {

  youtubeBackdrop.addEventListener(
    "click",
    () => {

      minimizePlayer();

    }
  );
}


/* =====================================================
   ESC
===================================================== */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      youtubePlayer.classList.contains(
        "active"
      )
    ) {

      minimizePlayer();

    }

  }
);


/* =====================================================
   CATEGORY FILTER
===================================================== */

function filterCategory(
  category
) {

  const filtered =
    songs.filter(
      song =>
        song.category ===
        category
    );

  renderSongs(
    filtered
  );

  document
    .getElementById("songs")
    .scrollIntoView({
      behavior: "smooth"
    });
}


/* =====================================================
   ESCAPE
===================================================== */

function escapeHtml(value) {

  return String(
    value || ""
  )
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

function escapeAttribute(value) {
  return escapeHtml(value);
}


/* =====================================================
   START
===================================================== */

loadSongs();