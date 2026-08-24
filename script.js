const state = {
  songs: [],
  filteredSongs: [],
  currentIndex: -1,
  shuffle: false,
  repeat: false
};

const audio =
  document.getElementById("audio");

const songsContainer =
  document.getElementById("songs");

const categoriesContainer =
  document.getElementById("categories");

const searchInput =
  document.getElementById("searchInput");

const songCount =
  document.getElementById("songCount");

const categoryCount =
  document.getElementById("categoryCount");

const status =
  document.getElementById("songStatus");

const playerTitle =
  document.getElementById("playerTitle");

const playerArtist =
  document.getElementById("playerArtist");

const playerCover =
  document.getElementById("playerCover");

const playButton =
  document.getElementById("playButton");

const progress =
  document.getElementById("progress");

const currentTime =
  document.getElementById("currentTime");

const duration =
  document.getElementById("duration");

const volume =
  document.getElementById("volume");

const shuffleButton =
  document.getElementById("shuffleButton");

const repeatButton =
  document.getElementById("repeatButton");

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(seconds) {

  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const mins =
    Math.floor(seconds / 60);

  const secs =
    Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");

  return `${mins}:${secs}`;
}

function cover(song) {

  return song.cover_url ||
    "https://placehold.co/500x500/15151d/ffffff?text=स्वरAJ";
}

async function loadSongs() {

  status.textContent =
    "Loading...";

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

    state.songs =
      data.songs || [];

    state.filteredSongs =
      [...state.songs];

    songCount.textContent =
      state.songs.length;

    status.textContent =
      `${state.songs.length} songs`;

    renderSongs();

    loadCategories();

  } catch (error) {

    console.error(error);

    status.textContent =
      "Unable to load songs";

    songsContainer.innerHTML = `
      <div class="song-card">
        <div class="song-info">
          <strong>
            Unable to load songs.
          </strong>
          <span>
            ${escapeHtml(error.message)}
          </span>
        </div>
      </div>
    `;
  }
}

async function loadCategories() {

  try {

    const response =
      await fetch("/api/categories");

    if (!response.ok) {
      throw new Error("Categories API failed");
    }

    const data =
      await response.json();

    const categories =
      data.categories || [];

    categoryCount.textContent =
      categories.length;

    renderCategories(categories);

  } catch (error) {

    console.error(error);

    categoriesContainer.innerHTML =
      `<div class="category-card">
        Unable to load categories
      </div>`;
  }
}

function renderCategories(categories) {

  if (!categories.length) {

    categoriesContainer.innerHTML =
      `<div class="category-card">
        <strong>No categories yet</strong>
        <span>Add songs from Admin</span>
      </div>`;

    return;
  }

  categoriesContainer.innerHTML =
    categories.map(category => `

      <div
        class="category-card"
        data-category="${escapeHtml(category.category)}"
      >

        <strong>
          ${escapeHtml(category.category)}
        </strong>

        <span>
          ${category.song_count} songs
        </span>

      </div>

    `).join("");

  document
    .querySelectorAll(".category-card")
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          const category =
            card.dataset.category;

          state.filteredSongs =
            state.songs.filter(
              song =>
                song.category === category
            );

          renderSongs();

          document
            .getElementById("songs")
            .scrollIntoView({
              behavior: "smooth"
            });

        }
      );

    });
}

function renderSongs() {

  if (!state.filteredSongs.length) {

    songsContainer.innerHTML =
      `<div class="song-card">
        <div class="song-info">
          <strong>No songs found</strong>
          <span>
            Add your first song from Admin.
          </span>
        </div>
      </div>`;

    return;
  }

  songsContainer.innerHTML =
    state.filteredSongs
      .map((song, index) => `

        <article class="song-card">

          <img
            class="song-cover"
            src="${escapeHtml(cover(song))}"
            alt=""
          >

          <div class="song-info">

            <strong>
              ${escapeHtml(song.title)}
            </strong>

            <span>
              ${escapeHtml(
                song.artist ||
                "Unknown Artist"
              )}
            </span>

            <span class="song-category">
              ${escapeHtml(
                song.category ||
                "Other"
              )}
            </span>

          </div>

          <button
            class="song-play"
            data-index="${index}"
          >
            ▶
          </button>

        </article>

      `)
      .join("");

  document
    .querySelectorAll(".song-play")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(button.dataset.index);

          playSong(index);

        }
      );

    });
}

function playSong(index) {

  const song =
    state.filteredSongs[index];

  if (!song) return;

  state.currentIndex =
    index;

  audio.src =
    song.audio_url;

  playerTitle.textContent =
    song.title;

  playerArtist.textContent =
    song.artist ||
    "Unknown Artist";

  playerCover.src =
    cover(song);

  audio.play()
    .then(() => {

      playButton.textContent =
        "❚❚";

    })
    .catch(error => {

      console.error(
        "Audio playback error:",
        error
      );

      alert(
        "This MP3 URL cannot be played. Make sure it is a public direct audio URL."
      );

    });
}

function nextSong() {

  if (!state.filteredSongs.length) {
    return;
  }

  if (state.shuffle) {

    state.currentIndex =
      Math.floor(
        Math.random() *
        state.filteredSongs.length
      );

  } else {

    state.currentIndex =
      state.currentIndex + 1;

    if (
      state.currentIndex >=
      state.filteredSongs.length
    ) {
      state.currentIndex = 0;
    }

  }

  playSong(state.currentIndex);
}

function previousSong() {

  if (!state.filteredSongs.length) {
    return;
  }

  state.currentIndex--;

  if (state.currentIndex < 0) {
    state.currentIndex =
      state.filteredSongs.length - 1;
  }

  playSong(state.currentIndex);
}

playButton.addEventListener(
  "click",
  () => {

    if (!audio.src) {

      if (state.filteredSongs.length) {
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

document
  .getElementById("nextButton")
  .addEventListener(
    "click",
    nextSong
  );

document
  .getElementById("previousButton")
  .addEventListener(
    "click",
    previousSong
  );

shuffleButton.addEventListener(
  "click",
  () => {

    state.shuffle =
      !state.shuffle;

    shuffleButton.style.color =
      state.shuffle
        ? "#c084fc"
        : "";

  }
);

repeatButton.addEventListener(
  "click",
  () => {

    state.repeat =
      !state.repeat;

    repeatButton.style.color =
      state.repeat
        ? "#c084fc"
        : "";

  }
);

audio.addEventListener(
  "play",
  () => {
    playButton.textContent = "❚❚";
  }
);

audio.addEventListener(
  "pause",
  () => {
    playButton.textContent = "▶";
  }
);

audio.addEventListener(
  "timeupdate",
  () => {

    if (!audio.duration) return;

    progress.value =
      (audio.currentTime /
        audio.duration) *
      100;

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

progress.addEventListener(
  "input",
  () => {

    if (!audio.duration) return;

    audio.currentTime =
      (
        Number(progress.value) /
        100
      ) *
      audio.duration;

  }
);

volume.addEventListener(
  "input",
  () => {

    audio.volume =
      Number(volume.value);

  }
);

audio.volume = .8;

audio.addEventListener(
  "ended",
  () => {

    if (state.repeat) {

      audio.currentTime = 0;
      audio.play();

    } else {

      nextSong();

    }

  }
);

searchInput.addEventListener(
  "input",
  () => {

    const query =
      searchInput.value
        .trim()
        .toLowerCase();

    state.filteredSongs =
      state.songs.filter(song => {

        return (
          String(song.title || "")
            .toLowerCase()
            .includes(query) ||

          String(song.artist || "")
            .toLowerCase()
            .includes(query) ||

          String(song.album || "")
            .toLowerCase()
            .includes(query) ||

          String(song.category || "")
            .toLowerCase()
            .includes(query)
        );

      });

    renderSongs();

  }
);

document
  .getElementById("exploreButton")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector(".section")
        .scrollIntoView({
          behavior: "smooth"
        });

    }
  );

loadSongs();