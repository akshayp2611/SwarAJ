const audio =
  document.getElementById("audio");

const songsContainer =
  document.getElementById("songs");

const categoriesContainer =
  document.getElementById("categories");

const songCount =
  document.getElementById("songCount");

const playerTitle =
  document.getElementById("playerTitle");

const playerArtist =
  document.getElementById("playerArtist");

const playerCover =
  document.getElementById("playerCover");

const playBtn =
  document.getElementById("playBtn");

const previousBtn =
  document.getElementById("previousBtn");

const nextBtn =
  document.getElementById("nextBtn");

const shuffleBtn =
  document.getElementById("shuffleBtn");

const repeatBtn =
  document.getElementById("repeatBtn");

const progress =
  document.getElementById("progress");

const currentTime =
  document.getElementById("currentTime");

const duration =
  document.getElementById("duration");

const volume =
  document.getElementById("volume");

const searchInput =
  document.getElementById("searchInput");

const menuBtn =
  document.getElementById("menuBtn");

let songs = [];

let currentIndex = -1;

let shuffled = false;

let repeat = false;

let liked =
  JSON.parse(
    localStorage.getItem(
      "swaraj-liked"
    ) || "[]"
  );

// =====================================================
// LOAD SONGS
// =====================================================

async function loadSongs() {

  try {

    const response =
      await fetch("/api/songs");

    if (!response.ok) {
      throw new Error(
        `Songs API returned ${response.status}`
      );
    }

    const data =
      await response.json();

    songs =
      data.songs || [];

    renderSongs(songs);

    songCount.textContent =
      `${songs.length} Songs`;

  } catch (error) {

    console.error(error);

    songsContainer.innerHTML = `
      <div class="loading">
        Unable to load songs.<br>
        ${error.message}
      </div>
    `;

  }
}

// =====================================================
// LOAD CATEGORIES
// =====================================================

async function loadCategories() {

  try {

    const response =
      await fetch("/api/categories");

    if (!response.ok) {
      throw new Error(
        `Categories API returned ${response.status}`
      );
    }

    const data =
      await response.json();

    renderCategories(
      data.categories || []
    );

  } catch (error) {

    console.error(error);

    categoriesContainer.innerHTML = `
      <div class="loading">
        Unable to load categories.
      </div>
    `;

  }
}

// =====================================================
// RENDER CATEGORIES
// =====================================================

function renderCategories(categories) {

  if (!categories.length) {

    categoriesContainer.innerHTML = `
      <div class="loading">
        No categories yet.<br>
        Upload your first song from Admin.
      </div>
    `;

    return;
  }

  categoriesContainer.innerHTML =
    categories.map(
      (item) => {

        const name =
          item.category;

        const count =
          item.song_count || 0;

        return `
          <div
            class="category"
            data-category="${escapeHtml(name)}"
          >

            <div class="category-icon">
              ${getCategoryIcon(name)}
            </div>

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

  document
    .querySelectorAll(".category")
    .forEach((element) => {

      element.addEventListener(
        "click",
        () => {

          const category =
            element.dataset.category;

          const filtered =
            songs.filter(
              (song) =>
                song.category
                  ?.toLowerCase() ===
                category.toLowerCase()
            );

          renderSongs(filtered);

        }
      );

    });
}

// =====================================================
// RENDER SONGS
// =====================================================

function renderSongs(list) {

  if (!list.length) {

    songsContainer.innerHTML = `
      <div class="loading">
        No songs found.
      </div>
    `;

    return;
  }

  songsContainer.innerHTML =
    list.map(
      (song) => {

        const originalIndex =
          songs.findIndex(
            (item) =>
              item.id === song.id
          );

        return `
          <div
            class="song"
            data-index="${originalIndex}"
          >

            <div class="song-cover">
              ${song.cover_url
                ? `<img
                    src="${escapeHtml(song.cover_url)}"
                    style="width:100%;height:100%;object-fit:cover;border-radius:10px"
                  >`
                : "♫"
              }
            </div>

            <div>

              <div class="song-title">
                ${escapeHtml(song.title)}
              </div>

              <div class="song-meta">
                ${escapeHtml(song.artist || "Unknown Artist")}
                ·
                ${escapeHtml(song.album || "Unknown Album")}
              </div>

            </div>

            <div class="song-category">
              ${escapeHtml(song.category || "Other")}
            </div>

          </div>
        `;

      }
    ).join("");

  document
    .querySelectorAll(".song")
    .forEach((element) => {

      element.addEventListener(
        "click",
        () => {

          const index =
            Number(
              element.dataset.index
            );

          playSong(index);

        }
      );

    });
}

// =====================================================
// PLAY SONG
// =====================================================

function playSong(index) {

  if (
    index < 0 ||
    index >= songs.length
  ) {
    return;
  }

  currentIndex = index;

  const song =
    songs[currentIndex];

  audio.src =
    song.audio_url;

  audio.play()
    .catch(
      console.error
    );

  playerTitle.textContent =
    song.title;

  playerArtist.textContent =
    song.artist ||
    "Unknown Artist";

  if (song.cover_url) {

    playerCover.innerHTML = `
      <img
        src="${escapeHtml(song.cover_url)}"
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          border-radius:10px
        "
      >
    `;

  } else {

    playerCover.textContent =
      "♫";

  }

  updatePlayButton();
}

// =====================================================
// PLAY / PAUSE
// =====================================================

playBtn.addEventListener(
  "click",
  () => {

    if (!audio.src) {

      if (songs.length) {
        playSong(0);
      }

      return;
    }

    if (audio.paused) {

      audio.play();

    } else {

      audio.pause();

    }

  }
);

audio.addEventListener(
  "play",
  updatePlayButton
);

audio.addEventListener(
  "pause",
  updatePlayButton
);

function updatePlayButton() {

  playBtn.textContent =
    audio.paused
      ? "▶"
      : "Ⅱ";

}

// =====================================================
// NEXT
// =====================================================

nextBtn.addEventListener(
  "click",
  nextSong
);

function nextSong() {

  if (!songs.length) {
    return;
  }

  if (shuffled) {

    let next =
      Math.floor(
        Math.random() *
        songs.length
      );

    if (songs.length > 1) {

      while (
        next === currentIndex
      ) {

        next =
          Math.floor(
            Math.random() *
            songs.length
          );

      }

    }

    playSong(next);

    return;
  }

  let next =
    currentIndex + 1;

  if (
    next >= songs.length
  ) {
    next = 0;
  }

  playSong(next);
}

// =====================================================
// PREVIOUS
// =====================================================

previousBtn.addEventListener(
  "click",
  () => {

    if (!songs.length) {
      return;
    }

    let previous =
      currentIndex - 1;

    if (previous < 0) {
      previous =
        songs.length - 1;
    }

    playSong(previous);

  }
);

// =====================================================
// SHUFFLE
// =====================================================

shuffleBtn.addEventListener(
  "click",
  () => {

    shuffled =
      !shuffled;

    shuffleBtn.style.opacity =
      shuffled ? "1" : ".5";

  }
);

// =====================================================
// REPEAT
// =====================================================

repeatBtn.addEventListener(
  "click",
  () => {

    repeat =
      !repeat;

    repeatBtn.style.opacity =
      repeat ? "1" : ".5";

  }
);

audio.addEventListener(
  "ended",
  () => {

    if (repeat) {

      audio.currentTime = 0;

      audio.play();

    } else {

      nextSong();

    }

  }
);

// =====================================================
// PROGRESS
// =====================================================

audio.addEventListener(
  "timeupdate",
  () => {

    if (!audio.duration) {
      return;
    }

    progress.value =
      (
        audio.currentTime /
        audio.duration
      ) * 100;

    currentTime.textContent =
      formatTime(
        audio.currentTime
      );

  }
);

audio.addEventListener(
  "loadedmetadata",
  () => {

    duration.textContent =
      formatTime(
        audio.duration
      );

  }
);

progress.addEventListener(
  "input",
  () => {

    if (!audio.duration) {
      return;
    }

    audio.currentTime =
      (
        progress.value / 100
      ) * audio.duration;

  }
);

// =====================================================
// VOLUME
// =====================================================

audio.volume =
  Number(volume.value);

volume.addEventListener(
  "input",
  () => {

    audio.volume =
      Number(volume.value);

  }
);

// =====================================================
// SEARCH
// =====================================================

searchInput.addEventListener(
  "input",
  () => {

    const query =
      searchInput.value
        .toLowerCase()
        .trim();

    if (!query) {

      renderSongs(songs);

      return;

    }

    const filtered =
      songs.filter(
        (song) =>
          String(song.title)
            .toLowerCase()
            .includes(query) ||

          String(song.artist)
            .toLowerCase()
            .includes(query) ||

          String(song.album)
            .toLowerCase()
            .includes(query) ||

          String(song.category)
            .toLowerCase()
            .includes(query)
      );

    renderSongs(filtered);

  }
);

// =====================================================
// MENU
// =====================================================

menuBtn.addEventListener(
  "click",
  () => {

    document
      .querySelector(".sidebar")
      .classList.toggle(
        "open"
      );

  }
);

// =====================================================
// EXPLORE
// =====================================================

document
  .getElementById("exploreBtn")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector(".section")
        ?.scrollIntoView({
          behavior: "smooth"
        });

    }
  );

// =====================================================
// UTILITIES
// =====================================================

function formatTime(seconds) {

  if (
    !seconds ||
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

function escapeHtml(value) {

  return String(value ?? "")
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

function getCategoryIcon(
  category
) {

  const name =
    String(category)
      .toLowerCase();

  if (name.includes("bhakti"))
    return "🪔";

  if (name.includes("love"))
    return "♡";

  if (name.includes("marathi"))
    return "🎵";

  if (name.includes("energetic"))
    return "⚡";

  if (name.includes("emotional"))
    return "💜";

  return "♫";

}

// =====================================================
// INITIALIZE
// =====================================================

loadSongs();

loadCategories();