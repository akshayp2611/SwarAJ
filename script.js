let songs = [];

const songList =
  document.getElementById("songList");

const categoryList =
  document.getElementById("categoryList");

const audioPlayer =
  document.getElementById("audioPlayer");

const playerTitle =
  document.getElementById("playerTitle");

const playerArtist =
  document.getElementById("playerArtist");

const youtubeModal =
  document.getElementById("youtubeModal");

const youtubeFrame =
  document.getElementById("youtubeFrame");

const youtubeTitle =
  document.getElementById("youtubeTitle");

const youtubeArtist =
  document.getElementById("youtubeArtist");

const closeYoutube =
  document.getElementById("closeYoutube");


/* ==================================================
   LOAD SONGS
================================================== */

async function loadSongs() {

  try {

    const response =
      await fetch("/api/songs", {
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `Songs API returned ${response.status}`
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
      <div class="song">
        ❌ Unable to load songs.
        <br><br>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


/* ==================================================
   LOAD CATEGORIES
================================================== */

async function loadCategories() {

  try {

    const response =
      await fetch("/api/categories", {
        cache: "no-store"
      });

    if (!response.ok) {
      throw new Error(
        `Categories API returned ${response.status}`
      );
    }

    const data =
      await response.json();

    const categories =
      Array.isArray(data)
        ? data
        : Array.isArray(data.categories)
          ? data.categories
          : [];

    renderCategories(categories);

  } catch (error) {

    console.error(
      "LOAD CATEGORIES ERROR:",
      error
    );

    categoryList.innerHTML = `
      <div class="category">
        Unable to load categories
      </div>
    `;
  }
}


/* ==================================================
   RENDER CATEGORIES
================================================== */

function renderCategories(categories) {

  if (
    !categories ||
    categories.length === 0
  ) {

    categoryList.innerHTML = `
      <div class="category">
        No categories yet
      </div>
    `;

    return;
  }

  categoryList.innerHTML =
    categories
      .map((category) => {

        const name =
          category.category || "Other";

        const count =
          Number(
            category.song_count || 0
          );

        return `
          <div
            class="category"
            onclick="filterCategory(${JSON.stringify(name)})"
          >

            <strong>
              ${escapeHtml(name)}
            </strong>

            <br>

            <small>
              ${count} songs
            </small>

          </div>
        `;
      })
      .join("");
}


/* ==================================================
   RENDER SONGS
================================================== */

function renderSongs(list) {

  if (
    !list ||
    list.length === 0
  ) {

    songList.innerHTML = `
      <div class="song">
        No songs available.
      </div>
    `;

    return;
  }

  songList.innerHTML =
    list
      .map((song) => {

        let source =
          "No source";

        if (song.audio_url) {
          source =
            "🎵 MP3";
        } else if (song.youtube_url) {
          source =
            "▶ YouTube";
        }

        return `
          <div
            class="song"
            onclick="playSong(${Number(song.id)})"
          >

            <div class="song-info">

              <strong>
                ${escapeHtml(
                  song.title
                )}
              </strong>

              <small>
                ${escapeHtml(
                  song.artist ||
                  "Unknown Artist"
                )}
              </small>

            </div>

            <div class="song-type">
              ${source}
            </div>

          </div>
        `;
      })
      .join("");
}


/* ==================================================
   PLAY SONG
================================================== */

function playSong(id) {

  const song =
    songs.find(
      (item) =>
        Number(item.id) ===
        Number(id)
    );

  if (!song) {
    return;
  }

  playerTitle.textContent =
    song.title || "Unknown Song";

  playerArtist.textContent =
    song.artist || "SwarAJ";


  /* -----------------------------------------------
     MP3 / CLOUDINARY
  ------------------------------------------------ */

  if (song.audio_url) {

    closeYouTubePlayer();

    audioPlayer.style.display =
      "block";

    audioPlayer.src =
      song.audio_url;

    audioPlayer.load();

    audioPlayer.play()
      .catch((error) => {

        console.warn(
          "Audio autoplay blocked:",
          error.message
        );

      });

    return;
  }


  /* -----------------------------------------------
     YOUTUBE
  ------------------------------------------------ */

  if (song.youtube_url) {

    audioPlayer.pause();

    audioPlayer.removeAttribute(
      "src"
    );

    audioPlayer.load();

    audioPlayer.style.display =
      "none";

    openYouTubePlayer(song);

    return;
  }

  console.warn(
    "Song has no playable source:",
    song
  );
}


/* ==================================================
   EXTRACT YOUTUBE VIDEO ID
================================================== */

function getYouTubeVideoId(url) {

  if (!url) {
    return null;
  }

  try {

    const parsed =
      new URL(url);

    const hostname =
      parsed.hostname
        .toLowerCase()
        .replace(/^www\./, "");

    /* youtu.be/VIDEO_ID */

    if (
      hostname === "youtu.be"
    ) {

      return cleanVideoId(
        parsed.pathname
          .replace("/", "")
      );
    }


    /* youtube.com/watch?v=VIDEO_ID */

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {

      const watchId =
        parsed.searchParams.get("v");

      if (watchId) {
        return cleanVideoId(
          watchId
        );
      }


      /* /shorts/VIDEO_ID */

      const shortsMatch =
        parsed.pathname.match(
          /^\/shorts\/([^/?]+)/
        );

      if (shortsMatch) {
        return cleanVideoId(
          shortsMatch[1]
        );
      }


      /* /embed/VIDEO_ID */

      const embedMatch =
        parsed.pathname.match(
          /^\/embed\/([^/?]+)/
        );

      if (embedMatch) {
        return cleanVideoId(
          embedMatch[1]
        );
      }


      /* /live/VIDEO_ID */

      const liveMatch =
        parsed.pathname.match(
          /^\/live\/([^/?]+)/
        );

      if (liveMatch) {
        return cleanVideoId(
          liveMatch[1]
        );
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


/* ==================================================
   CLEAN VIDEO ID
================================================== */

function cleanVideoId(id) {

  if (!id) {
    return null;
  }

  const cleaned =
    String(id)
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

  if (
    cleaned.length < 5 ||
    cleaned.length > 20
  ) {
    return null;
  }

  return cleaned;
}


/* ==================================================
   OPEN YOUTUBE PLAYER
================================================== */

function openYouTubePlayer(song) {

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

  youtubeTitle.textContent =
    song.title ||
    "YouTube Song";

  youtubeArtist.textContent =
    song.artist ||
    "SwarAJ";


  /*
   * YouTube embedded player.
   *
   * autoplay=1:
   * Starts after the user's song click.
   *
   * playsinline=1:
   * Important for mobile playback.
   *
   * rel=0:
   * Limits related-video behavior.
   */

  const embedUrl =
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` +
    `?autoplay=1` +
    `&playsinline=1` +
    `&rel=0` +
    `&modestbranding=1`;

  youtubeFrame.src =
    embedUrl;

  youtubeModal.classList.add(
    "active"
  );

  youtubeModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow =
    "hidden";
}


/* ==================================================
   CLOSE YOUTUBE PLAYER
================================================== */

function closeYouTubePlayer() {

  if (!youtubeModal) {
    return;
  }

  youtubeFrame.src =
    "about:blank";

  youtubeModal.classList.remove(
    "active"
  );

  youtubeModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow =
    "";
}


/* ==================================================
   CLOSE BUTTON
================================================== */

if (closeYoutube) {

  closeYoutube.addEventListener(
    "click",
    closeYouTubePlayer
  );
}


/* ==================================================
   BACKDROP CLICK
================================================== */

if (youtubeModal) {

  youtubeModal.addEventListener(
    "click",
    (event) => {

      if (
        event.target.classList.contains(
          "youtube-backdrop"
        )
      ) {

        closeYouTubePlayer();

      }

    }
  );
}


/* ==================================================
   ESCAPE KEY
================================================== */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape"
    ) {

      closeYouTubePlayer();

    }

  }
);


/* ==================================================
   CATEGORY FILTER
================================================== */

function filterCategory(category) {

  const filtered =
    songs.filter(
      (song) =>
        song.category ===
        category
    );

  renderSongs(
    filtered
  );

  const songsSection =
    document.getElementById(
      "songs"
    );

  if (songsSection) {

    songsSection.scrollIntoView({
      behavior: "smooth"
    });

  }
}


/* ==================================================
   HTML ESCAPE
================================================== */

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


/* ==================================================
   START
================================================== */

loadSongs();