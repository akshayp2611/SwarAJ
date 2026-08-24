let songs = [];

let currentSong = null;

let currentTab = "all";

const songList =
  document.getElementById(
    "songList"
  );

const categoryList =
  document.getElementById(
    "categoryList"
  );

const songCount =
  document.getElementById(
    "songCount"
  );

const libraryTitle =
  document.getElementById(
    "libraryTitle"
  );

const libraryKicker =
  document.getElementById(
    "libraryKicker"
  );


/* =====================================================
   YOUTUBE ELEMENTS
===================================================== */

const youtubePlayer =
  document.getElementById(
    "youtubePlayer"
  );

const youtubeFrame =
  document.getElementById(
    "youtubeFrame"
  );

const videoContainer =
  document.getElementById(
    "videoContainer"
  );

const playerTitle =
  document.getElementById(
    "playerTitle"
  );

const playerArtist =
  document.getElementById(
    "playerArtist"
  );

const playerCover =
  document.getElementById(
    "playerCover"
  );

const musicModeButton =
  document.getElementById(
    "musicModeButton"
  );

const videoModeButton =
  document.getElementById(
    "videoModeButton"
  );

const minimizeButton =
  document.getElementById(
    "minimizeButton"
  );

const closeButton =
  document.getElementById(
    "closeButton"
  );


/* =====================================================
   MINI PLAYER
===================================================== */

const miniPlayer =
  document.getElementById(
    "miniPlayer"
  );

const miniTitle =
  document.getElementById(
    "miniTitle"
  );

const miniArtist =
  document.getElementById(
    "miniArtist"
  );

const expandButton =
  document.getElementById(
    "expandButton"
  );

const miniCloseButton =
  document.getElementById(
    "miniCloseButton"
  );


/* =====================================================
   MP3 PLAYER
===================================================== */

const audioBar =
  document.getElementById(
    "audioBar"
  );

const audioPlayer =
  document.getElementById(
    "audioPlayer"
  );

const audioCover =
  document.getElementById(
    "audioCover"
  );

const audioTitle =
  document.getElementById(
    "audioTitle"
  );

const audioArtist =
  document.getElementById(
    "audioArtist"
  );

const audioPlayPause =
  document.getElementById(
    "audioPlayPause"
  );

const audioClose =
  document.getElementById(
    "audioClose"
  );

const audioProgress =
  document.getElementById(
    "audioProgress"
  );


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
        `API ${response.status}`
      );
    }

    const data =
      await response.json();

    songs =
      Array.isArray(data)
        ? data
        : [];

    renderCurrentTab();

    loadCategories();

  } catch (error) {

    console.error(
      "SONG LOAD ERROR:",
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
   LOAD CATEGORIES
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
        `API ${response.status}`
      );
    }

    const data =
      await response.json();

    renderCategories(
      Array.isArray(data)
        ? data
        : []
    );

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
   CATEGORIES
===================================================== */

function renderCategories(
  categories
) {

  if (!categories.length) {

    categoryList.innerHTML = `
      <div class="loading-card glass">
        No categories yet.
      </div>
    `;

    return;
  }

  categoryList.innerHTML =
    categories
      .map(category => {

        const name =
          category.category ||
          "Other";

        const count =
          Number(
            category.song_count ||
            0
          );

        return `
          <button
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

          </button>
        `;
      })
      .join("");
}


/* =====================================================
   TAB FILTER
===================================================== */

function getFilteredSongs() {

  if (currentTab === "mp3") {

    return songs.filter(
      song =>
        Boolean(song.audio_url)
    );
  }

  if (currentTab === "youtube") {

    return songs.filter(
      song =>
        !song.audio_url &&
        Boolean(song.youtube_url)
    );
  }

  return songs;
}


/* =====================================================
   TAB UI
===================================================== */

document
  .querySelectorAll(".nav-tab")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".nav-tab"
          )
          .forEach(item =>
            item.classList.remove(
              "active"
            )
          );

        button.classList.add(
          "active"
        );

        currentTab =
          button.dataset.tab;

        if (
          currentTab ===
          "categories"
        ) {

          document
            .getElementById(
              "categories"
            )
            .scrollIntoView({
              behavior:
                "smooth"
            });

          return;
        }

        renderCurrentTab();

        document
          .getElementById(
            "songs"
          )
          .scrollIntoView({
            behavior:
              "smooth"
          });
      }
    );
  });


/* =====================================================
   RENDER CURRENT TAB
===================================================== */

function renderCurrentTab() {

  const filtered =
    getFilteredSongs();

  if (currentTab === "mp3") {

    libraryKicker.textContent =
      "MP3 LIBRARY";

    libraryTitle.textContent =
      "Your MP3 Songs";

  } else if (
    currentTab === "youtube"
  ) {

    libraryKicker.textContent =
      "YOUTUBE MUSIC";

    libraryTitle.textContent =
      "YouTube Songs";

  } else {

    libraryKicker.textContent =
      "YOUR LIBRARY";

    libraryTitle.textContent =
      "All Songs";
  }

  renderSongs(filtered);
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
        No songs found.
      </div>
    `;

    return;
  }

  songList.innerHTML =
    list.map(song => {

      const isMP3 =
        Boolean(song.audio_url);

      const isYouTube =
        !isMP3 &&
        Boolean(song.youtube_url);

      const badge =
        isMP3
          ? "🎵 MP3"
          : isYouTube
            ? "▶ YouTube"
            : "Unavailable";

      const cover =
        song.cover_url
          ? `
            <img
              src="${escapeAttribute(
                song.cover_url
              )}"
              alt=""
              loading="lazy"
            >
          `
          : "♪";

      return `
        <article
          class="song-card glass"
          onclick="playSong(${Number(
            song.id
          )})"
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

        </article>
      `;
    }).join("");
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

  if (!song) {
    return;
  }

  currentSong =
    song;

  updateSongInfo(song);

  /*
   * IMPORTANT:
   *
   * MP3 always gets native audio.
   * YouTube always gets embedded player.
   */

  if (song.audio_url) {

    playMP3(song);

    return;
  }

  if (song.youtube_url) {

    playYouTubeMusic(song);

    return;
  }

  alert(
    "This song has no playable source."
  );
}


/* =====================================================
   MP3
===================================================== */

function playMP3(song) {

  stopYouTube();

  audioPlayer.pause();

  audioPlayer.src =
    song.audio_url;

  audioPlayer.load();

  audioBar.classList.add(
    "active"
  );

  audioPlayPause.textContent =
    "⏳";

  audioPlayer
    .play()
    .then(() => {

      audioPlayPause.textContent =
        "❚❚";

    })
    .catch(error => {

      console.warn(
        "MP3 autoplay:",
        error.message
      );

      audioPlayPause.textContent =
        "▶";
    });
}


/* =====================================================
   YOUTUBE MUSIC FIRST
===================================================== */

function playYouTubeMusic(song) {

  stopMP3();

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

  updateSongInfo(song);

  youtubePlayer.classList.add(
    "active"
  );

  youtubePlayer.classList.add(
    "music-only"
  );

  miniPlayer.classList.remove(
    "active"
  );

  musicModeButton.classList.add(
    "active"
  );

  videoModeButton.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "hidden";

  youtubeFrame.src =
    createYouTubeUrl(
      videoId
    );

  /*
   * User clicked the song,
   * therefore autoplay is initiated
   * from that interaction.
   */
}


/* =====================================================
   SHOW VIDEO
===================================================== */

function showYouTubeVideo() {

  if (!currentSong) {
    return;
  }

  youtubePlayer.classList.remove(
    "music-only"
  );

  musicModeButton.classList.remove(
    "active"
  );

  videoModeButton.classList.add(
    "active"
  );

  youtubePlayer.classList.add(
    "active"
  );

  miniPlayer.classList.remove(
    "active"
  );
}


/* =====================================================
   MUSIC MODE
===================================================== */

function showYouTubeMusic() {

  if (!currentSong) {
    return;
  }

  youtubePlayer.classList.add(
    "music-only"
  );

  musicModeButton.classList.add(
    "active"
  );

  videoModeButton.classList.remove(
    "active"
  );

  youtubePlayer.classList.add(
    "active"
  );
}


/* =====================================================
   YOUTUBE URL
===================================================== */

function createYouTubeUrl(
  videoId
) {

  const params =
    new URLSearchParams({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      controls: "1"
    });

  return (
    "https://www.youtube.com/embed/" +
    encodeURIComponent(videoId) +
    "?" +
    params.toString()
  );
}


/* =====================================================
   YOUTUBE ID
===================================================== */

function getYouTubeVideoId(url) {

  if (!url) {
    return null;
  }

  try {

    const parsed =
      new URL(url);

    const host =
      parsed.hostname
        .toLowerCase()
        .replace(
          /^www\./,
          ""
        );

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

      const v =
        parsed.searchParams.get(
          "v"
        );

      if (v) {
        return cleanYouTubeId(v);
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
      "Invalid YouTube URL",
      error
    );
  }

  return null;
}


function cleanYouTubeId(id) {

  if (!id) {
    return null;
  }

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
   PLAYER INFO
===================================================== */

function updateSongInfo(song) {

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

  audioTitle.textContent =
    title;

  audioArtist.textContent =
    artist;


  if (song.cover_url) {

    const image =
      `
      <img
        src="${escapeAttribute(
          song.cover_url
        )}"
        alt=""
      >
      `;

    playerCover.innerHTML =
      image;

    audioCover.innerHTML =
      image;

  } else {

    playerCover.textContent =
      "♪";

    audioCover.textContent =
      "♪";
  }
}


/* =====================================================
   MP3 CONTROLS
===================================================== */

audioPlayPause.addEventListener(
  "click",
  () => {

    if (!audioPlayer.src) {
      return;
    }

    if (
      audioPlayer.paused
    ) {

      audioPlayer
        .play()
        .then(() => {
          audioPlayPause.textContent =
            "❚❚";
        })
        .catch(() => {});

    } else {

      audioPlayer.pause();

      audioPlayPause.textContent =
        "▶";
    }
  }
);


audioPlayer.addEventListener(
  "play",
  () => {

    audioPlayPause.textContent =
      "❚❚";
  }
);


audioPlayer.addEventListener(
  "pause",
  () => {

    audioPlayPause.textContent =
      "▶";
  }
);


audioPlayer.addEventListener(
  "timeupdate",
  () => {

    if (
      !audioPlayer.duration
    ) {
      return;
    }

    audioProgress.value =
      (
        audioPlayer.currentTime /
        audioPlayer.duration
      ) * 100;
  }
);


audioProgress.addEventListener(
  "input",
  () => {

    if (
      !audioPlayer.duration
    ) {
      return;
    }

    audioPlayer.currentTime =
      (
        Number(
          audioProgress.value
        ) / 100
      ) *
      audioPlayer.duration;
  }
);


audioClose.addEventListener(
  "click",
  () => {

    stopMP3();

    currentSong =
      null;
  }
);


/* =====================================================
   STOP MP3
===================================================== */

function stopMP3() {

  audioPlayer.pause();

  audioPlayer.removeAttribute(
    "src"
  );

  audioPlayer.load();

  audioBar.classList.remove(
    "active"
  );

  audioProgress.value =
    0;

  audioPlayPause.textContent =
    "▶";
}


/* =====================================================
   YOUTUBE CONTROLS
===================================================== */

musicModeButton.addEventListener(
  "click",
  showYouTubeMusic
);


videoModeButton.addEventListener(
  "click",
  showYouTubeVideo
);


minimizeButton.addEventListener(
  "click",
  () => {

    youtubePlayer.classList.remove(
      "active"
    );

    miniPlayer.classList.add(
      "active"
    );

    document.body.style.overflow =
      "";
  }
);


expandButton.addEventListener(
  "click",
  () => {

    youtubePlayer.classList.add(
      "active"
    );

    miniPlayer.classList.remove(
      "active"
    );

    document.body.style.overflow =
      "hidden";
  }
);


closeButton.addEventListener(
  "click",
  stopYouTube
);


miniCloseButton.addEventListener(
  "click",
  stopYouTube
);


/* =====================================================
   STOP YOUTUBE
===================================================== */

function stopYouTube() {

  youtubeFrame.src =
    "about:blank";

  youtubePlayer.classList.remove(
    "active"
  );

  youtubePlayer.classList.remove(
    "music-only"
  );

  miniPlayer.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "";

}


/* =====================================================
   CATEGORY FILTER
===================================================== */

function filterCategory(
  category
) {

  currentTab =
    "category";

  const filtered =
    songs.filter(
      song =>
        song.category ===
        category
    );

  libraryKicker.textContent =
    "CATEGORY";

  libraryTitle.textContent =
    category;

  renderSongs(filtered);

  document
    .getElementById(
      "songs"
    )
    .scrollIntoView({
      behavior:
        "smooth"
    });
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

      minimizeButton.click();
    }
  }
);


/* =====================================================
   HTML SAFETY
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