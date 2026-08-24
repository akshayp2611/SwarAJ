const state = {
  songs: [],
  filteredSongs: [],
  categories: [],
  currentIndex: -1,
  currentSong: null,
  favorites: JSON.parse(
    localStorage.getItem("swaraj-favorites") || "[]"
  ),
  shuffle: false,
  repeat: false,
  currentCategory: null
};

const $ = (selector) =>
  document.querySelector(selector);

const audio = $("#audio");

const elements = {
  songList: $("#songList"),
  categoryGrid: $("#categoryGrid"),
  sidebarCategories: $("#sidebarCategories"),

  songCount: $("#songCount"),
  categoryCount: $("#categoryCount"),
  likedCount: $("#likedCount"),

  searchInput: $("#searchInput"),
  clearSearch: $("#clearSearch"),

  playerTitle: $("#playerTitle"),
  playerCategory: $("#playerCategory"),
  playerCover: $("#playerCover"),

  playButton: $("#playButton"),
  previousButton: $("#previousButton"),
  nextButton: $("#nextButton"),

  progress: $("#progress"),
  currentTime: $("#currentTime"),
  duration: $("#duration"),

  volume: $("#volume"),
  volumeButton: $("#volumeButton"),

  playerLike: $("#playerLike"),

  toast: $("#toast")
};

function escapeHTML(value) {
  return String(value)
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

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2500);
}

function isFavorite(song) {
  return state.favorites.includes(song.id);
}

function saveFavorites() {
  localStorage.setItem(
    "swaraj-favorites",
    JSON.stringify(state.favorites)
  );

  elements.likedCount.textContent =
    state.favorites.length;
}

function toggleFavorite(song) {
  if (!song) return;

  const index =
    state.favorites.indexOf(song.id);

  if (index === -1) {
    state.favorites.push(song.id);
    showToast("Added to liked songs");
  } else {
    state.favorites.splice(index, 1);
    showToast("Removed from liked songs");
  }

  saveFavorites();
  renderSongs(state.filteredSongs);
  updatePlayerLike();
}

async function loadLibrary() {
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

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Song API failed"
      );
    }

    state.songs = Array.isArray(data.songs)
      ? data.songs
      : [];

    state.filteredSongs =
      [...state.songs];

    elements.songCount.textContent =
      state.songs.length;

    renderSongs(state.filteredSongs);

    await loadCategories();

    if (!state.songs.length) {
      showToast(
        "No songs found. Add audio files to songs/"
      );
    }

  } catch (error) {
    console.error(error);

    elements.songList.innerHTML = `
      <div class="empty-state">
        <strong>Unable to load songs</strong>
        <span>${escapeHTML(error.message)}</span>
        <button
          class="secondary-button"
          onclick="loadLibrary()"
        >
          Try again
        </button>
      </div>
    `;

    showToast("Music library could not be loaded");
  }
}

async function loadCategories() {
  try {
    const response =
      await fetch("/api/categories", {
        cache: "no-store"
      });

    const data = await response.json();

    state.categories =
      Array.isArray(data.categories)
        ? data.categories
        : [];

    elements.categoryCount.textContent =
      state.categories.length;

    renderCategories();
    renderSidebarCategories();

  } catch (error) {
    console.error(
      "Category loading failed:",
      error
    );
  }
}

function categorySymbol(name) {
  const lower = name.toLowerCase();

  if (
    lower.includes("love") ||
    lower.includes("romantic")
  ) {
    return "♥";
  }

  if (
    lower.includes("bhakti") ||
    lower.includes("devotional") ||
    lower.includes("ganpati")
  ) {
    return "ॐ";
  }

  if (
    lower.includes("marathi")
  ) {
    return "म";
  }

  if (
    lower.includes("energetic") ||
    lower.includes("party")
  ) {
    return "⚡";
  }

  if (
    lower.includes("emotional") ||
    lower.includes("sad")
  ) {
    return "◒";
  }

  return "♫";
}

function renderCategories() {
  if (!state.categories.length) {
    elements.categoryGrid.innerHTML = `
      <div class="empty-state">
        No categories found
      </div>
    `;

    return;
  }

  elements.categoryGrid.innerHTML =
    state.categories
      .map((category) => `
        <article
          class="category-card"
          data-category="${escapeHTML(category.name)}"
        >
          <div class="category-symbol">
            ${categorySymbol(category.name)}
          </div>

          <h3>
            ${escapeHTML(category.name)}
          </h3>

          <p>
            ${category.count}
            ${category.count === 1 ? "song" : "songs"}
          </p>
        </article>
      `)
      .join("");

  elements.categoryGrid
    .querySelectorAll(".category-card")
    .forEach((card) => {
      card.addEventListener("click", () => {
        filterCategory(
          card.dataset.category
        );
      });
    });
}

function renderSidebarCategories() {
  if (!state.categories.length) {
    elements.sidebarCategories.innerHTML = `
      <div class="sidebar-loading">
        No categories
      </div>
    `;

    return;
  }

  elements.sidebarCategories.innerHTML =
    state.categories
      .map((category) => `
        <button
          class="sidebar-category"
          data-category="${escapeHTML(category.name)}"
        >
          <span>
            ${escapeHTML(category.name)}
          </span>

          <span class="sidebar-category-count">
            ${category.count}
          </span>
        </button>
      `)
      .join("");

  elements.sidebarCategories
    .querySelectorAll(".sidebar-category")
    .forEach((button) => {
      button.addEventListener("click", () => {
        filterCategory(
          button.dataset.category
        );
      });
    });
}

function renderSongs(songs) {
  if (!songs.length) {
    elements.songList.innerHTML = `
      <div class="empty-state">
        <strong>No songs found</strong>
        <span>
          Try another search or category.
        </span>
      </div>
    `;

    return;
  }

  elements.songList.innerHTML =
    songs
      .map((song, index) => `
        <article
          class="song-row"
          data-id="${escapeHTML(song.id)}"
        >

          <div class="song-number">
            ${String(index + 1).padStart(2, "0")}
          </div>

          <div class="song-info">

            <img
              class="song-cover"
              src="${song.cover}"
              alt=""
              loading="lazy"
              onerror="this.style.display='none'"
            >

            <div class="song-text">

              <strong class="song-title">
                ${escapeHTML(song.title)}
              </strong>

              <span class="song-meta">
                ${escapeHTML(song.extension.toUpperCase())}
              </span>

            </div>

          </div>

          <div class="song-category">
            ${escapeHTML(song.category)}
          </div>

          <button
            class="song-play"
            data-play="${escapeHTML(song.id)}"
            title="Play"
          >
            ▶
          </button>

          <button
            class="song-like ${
              isFavorite(song) ? "liked" : ""
            }"
            data-like="${escapeHTML(song.id)}"
            title="Like"
          >
            ${isFavorite(song) ? "♥" : "♡"}
          </button>

        </article>
      `)
      .join("");

  elements.songList
    .querySelectorAll("[data-play]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        playSongById(
          button.dataset.play
        );
      });
    });

  elements.songList
    .querySelectorAll("[data-like]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const song =
          state.songs.find(
            (item) =>
              item.id === button.dataset.like
          );

        toggleFavorite(song);
      });
    });

  elements.songList
    .querySelectorAll(".song-row")
    .forEach((row) => {
      row.addEventListener("dblclick", () => {
        playSongById(row.dataset.id);
      });
    });
}

function filterCategory(category) {
  state.currentCategory = category;

  state.filteredSongs =
    state.songs.filter(
      (song) =>
        song.category === category
    );

  $("#songSectionTitle").textContent =
    category;

  renderSongs(state.filteredSongs);

  window.scrollTo({
    top: document.querySelector(".section").offsetTop - 80,
    behavior: "smooth"
  });
}

function showAllSongs() {
  state.currentCategory = null;
  state.filteredSongs = [...state.songs];

  $("#songSectionTitle").textContent =
    "All Songs";

  renderSongs(state.filteredSongs);
}

function searchSongs(query) {
  const value = query
    .trim()
    .toLowerCase();

  elements.clearSearch.hidden =
    !value;

  if (!value) {
    showAllSongs();
    return;
  }

  state.currentCategory = null;

  state.filteredSongs =
    state.songs.filter((song) => {
      return (
        song.title.toLowerCase().includes(value) ||
        song.category.toLowerCase().includes(value) ||
        song.filename.toLowerCase().includes(value)
      );
    });

  $("#songSectionTitle").textContent =
    `Search: ${query}`;

  renderSongs(state.filteredSongs);
}

function playSongById(id) {
  const index =
    state.songs.findIndex(
      (song) => song.id === id
    );

  if (index === -1) return;

  state.currentIndex = index;
  state.currentSong =
    state.songs[index];

  audio.src =
    state.currentSong.url;

  audio.load();

  audio.play()
    .then(() => {
      updatePlayer();
      showToast(
        `Playing ${state.currentSong.title}`
      );
    })
    .catch((error) => {
      console.error(error);

      showToast(
        "Unable to play this audio file"
      );
    });

  updatePlayer();
}

function updatePlayer() {
  const song = state.currentSong;

  if (!song) {
    elements.playerTitle.textContent =
      "Nothing playing";

    elements.playerCategory.textContent =
      "Select a song";

    return;
  }

  elements.playerTitle.textContent =
    song.title;

  elements.playerCategory.textContent =
    song.category;

  elements.playerCover.innerHTML = `
    <img
      src="${song.cover}"
      alt=""
      style="
        width:100%;
        height:100%;
        object-fit:cover;
        border-radius:12px;
      "
      onerror="this.remove()"
    >
  `;

  updatePlayerLike();
}

function updatePlayerLike() {
  if (!state.currentSong) return;

  const liked =
    isFavorite(state.currentSong);

  elements.playerLike.textContent =
    liked ? "♥" : "♡";

  elements.playerLike.style.color =
    liked ? "#f472b6" : "";
}

function togglePlay() {
  if (!state.currentSong) {
    if (state.songs.length) {
      playSongById(
        state.songs[0].id
      );
    }

    return;
  }

  if (audio.paused) {
    audio.play()
      .catch(() => {});
  } else {
    audio.pause();
  }
}

function nextSong() {
  if (!state.songs.length) return;

  let index;

  if (state.shuffle) {
    index =
      Math.floor(
        Math.random() *
        state.songs.length
      );
  } else {
    index =
      state.currentIndex + 1;

    if (index >= state.songs.length) {
      index = 0;
    }
  }

  playSongById(
    state.songs[index].id
  );
}

function previousSong() {
  if (!state.songs.length) return;

  if (
    audio.currentTime > 3
  ) {
    audio.currentTime = 0;
    return;
  }

  let index =
    state.currentIndex - 1;

  if (index < 0) {
    index =
      state.songs.length - 1;
  }

  playSongById(
    state.songs[index].id
  );
}

function playAll() {
  if (!state.songs.length) {
    showToast("Your library is empty");
    return;
  }

  state.shuffle = false;

  playSongById(
    state.songs[0].id
  );
}

function shufflePlay() {
  if (!state.songs.length) {
    showToast("Your library is empty");
    return;
  }

  state.shuffle = true;

  const index =
    Math.floor(
      Math.random() *
      state.songs.length
    );

  playSongById(
    state.songs[index].id
  );
}

function sortSongs(type) {
  const songs =
    [...state.filteredSongs];

  if (type === "title") {
    songs.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  if (type === "category") {
    songs.sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }

  if (type === "recent") {
    songs.reverse();
  }

  state.filteredSongs = songs;

  renderSongs(songs);
}

/* Events */

elements.searchInput.addEventListener(
  "input",
  (event) => {
    searchSongs(event.target.value);
  }
);

elements.clearSearch.addEventListener(
  "click",
  () => {
    elements.searchInput.value = "";
    searchSongs("");
    elements.searchInput.focus();
  }
);

$("#showAllButton")
  .addEventListener(
    "click",
    showAllSongs
  );

$("#playAllButton")
  .addEventListener(
    "click",
    playAll
  );

$("#shuffleButton")
  .addEventListener(
    "click",
    shufflePlay
  );

$("#shufflePlayer")
  .addEventListener(
    "click",
    () => {
      state.shuffle =
        !state.shuffle;

      showToast(
        state.shuffle
          ? "Shuffle enabled"
          : "Shuffle disabled"
      );
    }
  );

$("#repeatButton")
  .addEventListener(
    "click",
    () => {
      state.repeat =
        !state.repeat;

      showToast(
        state.repeat
          ? "Repeat enabled"
          : "Repeat disabled"
      );
    }
  );

elements.playButton.addEventListener(
  "click",
  togglePlay
);

elements.nextButton.addEventListener(
  "click",
  nextSong
);

elements.previousButton.addEventListener(
  "click",
  previousSong
);

elements.playerLike.addEventListener(
  "click",
  () => {
    toggleFavorite(
      state.currentSong
    );
  }
);

elements.progress.addEventListener(
  "input",
  () => {
    if (!audio.duration) return;

    audio.currentTime =
      (elements.progress.value / 100) *
      audio.duration;
  }
);

elements.volume.addEventListener(
  "input",
  () => {
    audio.volume =
      Number(elements.volume.value);

    updateVolumeIcon();
  }
);

elements.volumeButton.addEventListener(
  "click",
  () => {
    audio.muted =
      !audio.muted;

    updateVolumeIcon();
  }
);

function updateVolumeIcon() {
  if (
    audio.muted ||
    audio.volume === 0
  ) {
    elements.volumeButton.textContent =
      "🔇";
  } else if (audio.volume < .5) {
    elements.volumeButton.textContent =
      "🔉";
  } else {
    elements.volumeButton.textContent =
      "🔊";
  }
}

audio.addEventListener(
  "loadedmetadata",
  () => {
    elements.duration.textContent =
      formatTime(audio.duration);
  }
);

audio.addEventListener(
  "timeupdate",
  () => {
    if (!audio.duration) return;

    elements.currentTime.textContent =
      formatTime(audio.currentTime);

    elements.progress.value =
      (audio.currentTime /
        audio.duration) *
      100;
  }
);

audio.addEventListener(
  "play",
  () => {
    elements.playButton.textContent =
      "Ⅱ";
  }
);

audio.addEventListener(
  "pause",
  () => {
    elements.playButton.textContent =
      "▶";
  }
);

audio.addEventListener(
  "ended",
  () => {
    if (state.repeat) {
      audio.currentTime = 0;

      audio.play()
        .catch(() => {});

      return;
    }

    nextSong();
  }
);

audio.addEventListener(
  "error",
  () => {
    showToast(
      "Audio file could not be loaded"
    );
  }
);

$("#sortSelect")
  .addEventListener(
    "change",
    (event) => {
      sortSongs(event.target.value);
    }
  );

$("#refreshButton")
  .addEventListener(
    "click",
    async () => {
      showToast("Refreshing library...");
      await loadLibrary();
      showToast("Music library updated");
    }
  );

$("#mobileMenu")
  .addEventListener(
    "click",
    () => {
      $("#sidebar")
        .classList.toggle("open");
    }
  );

document
  .querySelectorAll(".nav-item")
  .forEach((item) => {
    item.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".nav-item")
          .forEach((nav) =>
            nav.classList.remove("active")
          );

        item.classList.add("active");

        const action =
          item.dataset.action;

        if (action === "home") {
          showAllSongs();
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }

        if (action === "library") {
          showAllSongs();

          document
            .querySelector(".section")
            ?.scrollIntoView({
              behavior: "smooth"
            });
        }

        if (action === "favorites") {
          const favorites =
            state.songs.filter(
              (song) =>
                isFavorite(song)
            );

          state.filteredSongs =
            favorites;

          $("#songSectionTitle")
            .textContent =
            "Liked Songs";

          renderSongs(favorites);
        }

        if (action === "categories") {
          document
            .querySelector(".category-grid")
            ?.scrollIntoView({
              behavior: "smooth"
            });
        }

        $("#sidebar")
          .classList.remove("open");
      }
    );
  });

$("#youtubeButton")
  .addEventListener(
    "click",
    () => {
      const query =
        $("#youtubeSearch")
          .value
          .trim();

      if (!query) {
        showToast(
          "Enter a song to search"
        );

        return;
      }

      const url =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    }
  );

$("#youtubeSearch")
  .addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        $("#youtubeButton").click();
      }
    }
  );

/* Initial */

audio.volume = .8;

loadLibrary();