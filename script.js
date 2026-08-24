const state = {
  songs: [],
  categories: [],
  currentIndex: -1,
  shuffle: false,
  repeat: false,
  liked: new Set(
    JSON.parse(
      localStorage.getItem("swarajLiked") || "[]"
    )
  )
};

const audio = document.getElementById(
  "audioPlayer"
);

const playButton =
  document.getElementById("playButton");

const previousButton =
  document.getElementById("previousButton");

const nextButton =
  document.getElementById("nextButton");

const shuffleButton =
  document.getElementById("shuffleButton");

const repeatButton =
  document.getElementById("repeatButton");

const progressBar =
  document.getElementById("progressBar");

const volumeBar =
  document.getElementById("volumeBar");

const currentTime =
  document.getElementById("currentTime");

const duration =
  document.getElementById("duration");

const searchInput =
  document.getElementById("searchInput");

const toast =
  document.getElementById("toast");

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function escapeHTML(value) {
  return String(value || "")
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

  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${secs}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function saveLiked() {
  localStorage.setItem(
    "swarajLiked",
    JSON.stringify(
      Array.from(state.liked)
    )
  );
}

function getSongId(song) {
  return String(
    song.id ||
    song.filename ||
    song.file_path ||
    song.title
  );
}

function isLiked(song) {
  return state.liked.has(
    getSongId(song)
  );
}

// ----------------------------------------------------
// API
// ----------------------------------------------------

async function loadSongs() {
  const container =
    document.getElementById("homeSongs");

  container.innerHTML = `
    <div class="empty-state">
      Loading your music library...
    </div>
  `;

  try {
    const response = await fetch(
      "/api/songs",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Songs API returned ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Unable to load songs"
      );
    }

    state.songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    document.getElementById(
      "songCount"
    ).textContent = state.songs.length;

    renderHomeSongs();
    renderAllSongs();
    renderLikedSongs();

    updateLikedCount();

    await loadCategories();

    document.getElementById(
      "serverStatus"
    ).textContent = "Library ready";

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="error-state">
        <strong>Unable to load songs.</strong>
        <br><br>
        ${escapeHTML(error.message)}
      </div>
    `;

    document.getElementById(
      "serverStatus"
    ).textContent = "API error";
  }
}

async function loadCategories() {
  try {
    const response = await fetch(
      "/api/categories",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Categories API returned ${response.status}`
      );
    }

    const data = await response.json();

    state.categories =
      Array.isArray(data.categories)
        ? data.categories
        : [];

    document.getElementById(
      "categoryCount"
    ).textContent =
      state.categories.length;

    renderCategories();
    renderSidebarCategories();

  } catch (error) {
    console.error(
      "Category error:",
      error
    );
  }
}

// ----------------------------------------------------
// Rendering
// ----------------------------------------------------

function renderCategories() {
  const container =
    document.getElementById(
      "categoriesGrid"
    );

  if (!state.categories.length) {
    container.innerHTML = `
      <div class="empty-state">
        No categories found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.categories
      .map((category, index) => {
        const name =
          category.category ||
          "Uncategorized";

        const count =
          category.song_count || 0;

        return `
          <article
            class="category-card"
            data-category="${escapeHTML(name)}"
          >
            <h3>
              ${escapeHTML(name)}
            </h3>

            <span>
              ${count}
              ${count === 1 ? "song" : "songs"}
            </span>

            <div class="category-number">
              ${String(index + 1).padStart(2, "0")}
            </div>
          </article>
        `;
      })
      .join("");

  container
    .querySelectorAll(".category-card")
    .forEach((card) => {
      card.addEventListener(
        "click",
        () => {
          const category =
            card.dataset.category;

          showCategory(category);
        }
      );
    });
}

function renderSidebarCategories() {
  const container =
    document.getElementById(
      "sidebarCategories"
    );

  if (!state.categories.length) {
    container.innerHTML = `
      <div class="sidebar-loading">
        No categories
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.categories
      .map(
        (category) => `
          <div
            class="sidebar-category"
            data-category="${escapeHTML(
              category.category
            )}"
          >
            ${escapeHTML(
              category.category
            )}
          </div>
        `
      )
      .join("");

  container
    .querySelectorAll(".sidebar-category")
    .forEach((item) => {
      item.addEventListener(
        "click",
        () => {
          showCategory(
            item.dataset.category
          );
        }
      );
    });
}

function createSongHTML(song, index) {
  const liked = isLiked(song);

  const cover = song.cover
    ? `
      <img
        src="${escapeHTML(song.cover)}"
        alt=""
        loading="lazy"
        onerror="this.style.display='none'"
      >
    `
    : "♫";

  return `
    <article
      class="song-card"
      data-index="${index}"
    >

      <div class="song-cover">
        ${cover}
      </div>

      <div class="song-info">

        <div class="song-title">
          ${escapeHTML(song.title)}
        </div>

        <div class="song-meta">
          ${escapeHTML(
            song.artist || "स्वरAJ"
          )}
          ·
          ${escapeHTML(
            song.album ||
            song.category ||
            "Music"
          )}
        </div>

      </div>

      <div class="song-category">
        ${escapeHTML(
          song.category || ""
        )}
      </div>

      <button
        class="song-like ${
          liked ? "liked" : ""
        }"
        data-like-index="${index}"
        aria-label="Like"
      >
        ${liked ? "♥" : "♡"}
      </button>

    </article>
  `;
}

function bindSongList(container) {
  container
    .querySelectorAll(".song-card")
    .forEach((card) => {
      card.addEventListener(
        "click",
        (event) => {
          if (
            event.target.closest(
              ".song-like"
            )
          ) {
            return;
          }

          const index =
            Number(card.dataset.index);

          playSong(index);
        }
      );
    });

  container
    .querySelectorAll("[data-like-index]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          toggleLike(
            Number(
              button.dataset.likeIndex
            )
          );
        }
      );
    });
}

function renderHomeSongs() {
  const container =
    document.getElementById("homeSongs");

  if (!state.songs.length) {
    container.innerHTML = `
      <div class="empty-state">
        No songs found.
        <br><br>
        Add MP3 files inside the
        <strong>songs/</strong>
        folder.
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.songs
      .slice(0, 12)
      .map((song) =>
        createSongHTML(
          song,
          state.songs.indexOf(song)
        )
      )
      .join("");

  bindSongList(container);
}

function renderAllSongs(songs = state.songs) {
  const container =
    document.getElementById("allSongs");

  if (!songs.length) {
    container.innerHTML = `
      <div class="empty-state">
        No songs found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    songs
      .map((song) => {
        const index =
          state.songs.indexOf(song);

        return createSongHTML(
          song,
          index
        );
      })
      .join("");

  bindSongList(container);
}

function renderLikedSongs() {
  const container =
    document.getElementById(
      "likedSongs"
    );

  const likedSongs =
    state.songs.filter((song) =>
      isLiked(song)
    );

  if (!likedSongs.length) {
    container.innerHTML = `
      <div class="empty-state">
        You haven't liked any songs yet.
        <br><br>
        Tap ♡ on a song to add it here.
      </div>
    `;

    return;
  }

  container.innerHTML =
    likedSongs
      .map((song) => {
        const index =
          state.songs.indexOf(song);

        return createSongHTML(
          song,
          index
        );
      })
      .join("");

  bindSongList(container);
}

function updateLikedCount() {
  const count =
    state.songs.filter((song) =>
      isLiked(song)
    ).length;

  document.getElementById(
    "likedCount"
  ).textContent = count;
}

// ----------------------------------------------------
// Category
// ----------------------------------------------------

function showCategory(category) {
  const filtered =
    state.songs.filter(
      (song) =>
        String(song.category)
          .toLowerCase() ===
        String(category)
          .toLowerCase()
    );

  switchView("all");

  renderAllSongs(filtered);

  showToast(
    `${category}: ${filtered.length} songs`
  );
}

// ----------------------------------------------------
// Playback
// ----------------------------------------------------

function playSong(index) {
  if (
    index < 0 ||
    index >= state.songs.length
  ) {
    return;
  }

  const song =
    state.songs[index];

  if (!song.file_path) {
    showToast(
      "Audio file not available."
    );

    return;
  }

  state.currentIndex = index;

  audio.src = song.file_path;
  audio.load();

  audio.play()
    .then(() => {
      playButton.textContent = "Ⅱ";
    })
    .catch((error) => {
      console.error(
        "Playback error:",
        error
      );

      showToast(
        "Unable to play this song."
      );
    });

  updatePlayer(song);
}

function updatePlayer(song) {
  document.getElementById(
    "playerTitle"
  ).textContent =
    song.title || "Unknown Song";

  document.getElementById(
    "playerArtist"
  ).textContent =
    song.artist || "स्वरAJ";

  const cover =
    document.getElementById(
      "playerCover"
    );

  if (song.cover) {
    cover.innerHTML = `
      <img
        src="${escapeHTML(song.cover)}"
        alt=""
      >
    `;
  } else {
    cover.textContent = "♫";
  }

  document.getElementById(
    "likeCurrent"
  ).textContent =
    isLiked(song)
      ? "♥"
      : "♡";
}

function playNext() {
  if (!state.songs.length) {
    return;
  }

  let nextIndex;

  if (state.shuffle) {
    nextIndex =
      Math.floor(
        Math.random() *
          state.songs.length
      );
  } else {
    nextIndex =
      state.currentIndex + 1;

    if (
      nextIndex >=
      state.songs.length
    ) {
      nextIndex = 0;
    }
  }

  playSong(nextIndex);
}

function playPrevious() {
  if (!state.songs.length) {
    return;
  }

  let previousIndex =
    state.currentIndex - 1;

  if (previousIndex < 0) {
    previousIndex =
      state.songs.length - 1;
  }

  playSong(previousIndex);
}

// ----------------------------------------------------
// Like
// ----------------------------------------------------

function toggleLike(index) {
  const song =
    state.songs[index];

  if (!song) {
    return;
  }

  const id = getSongId(song);

  if (state.liked.has(id)) {
    state.liked.delete(id);
    showToast("Removed from liked songs.");
  } else {
    state.liked.add(id);
    showToast("Added to liked songs.");
  }

  saveLiked();

  renderHomeSongs();
  renderAllSongs();
  renderLikedSongs();
  updateLikedCount();

  if (
    state.currentIndex === index
  ) {
    updatePlayer(song);
  }
}

// ----------------------------------------------------
// Navigation
// ----------------------------------------------------

function switchView(view) {
  document
    .querySelectorAll(".view")
    .forEach((element) => {
      element.classList.remove(
        "active-view"
      );
    });

  const target =
    document.getElementById(
      `${view}View`
    );

  if (target) {
    target.classList.add(
      "active-view"
    );
  }

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.view === view
      );
    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document
  .querySelectorAll(".nav-item")
  .forEach((item) => {
    item.addEventListener(
      "click",
      () => {
        switchView(
          item.dataset.view
        );
      }
    );
  });

// ----------------------------------------------------
// Search
// ----------------------------------------------------

searchInput.addEventListener(
  "input",
  () => {
    const query =
      searchInput.value
        .trim()
        .toLowerCase();

    if (!query) {
      renderHomeSongs();
      renderAllSongs();
      return;
    }

    const results =
      state.songs.filter(
        (song) =>
          String(
            song.title || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            song.artist || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            song.album || ""
          )
            .toLowerCase()
            .includes(query) ||
          String(
            song.category || ""
          )
            .toLowerCase()
            .includes(query)
      );

    switchView("all");

    renderAllSongs(results);
  }
);

// ----------------------------------------------------
// Player events
// ----------------------------------------------------

playButton.addEventListener(
  "click",
  () => {
    if (!state.songs.length) {
      showToast("No songs available.");
      return;
    }

    if (state.currentIndex === -1) {
      playSong(0);
      return;
    }

    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }
);

nextButton.addEventListener(
  "click",
  playNext
);

previousButton.addEventListener(
  "click",
  playPrevious
);

shuffleButton.addEventListener(
  "click",
  () => {
    state.shuffle =
      !state.shuffle;

    shuffleButton.style.color =
      state.shuffle
        ? "#b98aff"
        : "";

    showToast(
      state.shuffle
        ? "Shuffle enabled"
        : "Shuffle disabled"
    );
  }
);

repeatButton.addEventListener(
  "click",
  () => {
    state.repeat =
      !state.repeat;

    repeatButton.style.color =
      state.repeat
        ? "#b98aff"
        : "";

    showToast(
      state.repeat
        ? "Repeat enabled"
        : "Repeat disabled"
    );
  }
);

audio.addEventListener(
  "play",
  () => {
    playButton.textContent = "Ⅱ";
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
    if (!audio.duration) {
      return;
    }

    const percentage =
      (audio.currentTime /
        audio.duration) *
      100;

    progressBar.value =
      percentage;

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

audio.addEventListener(
  "ended",
  () => {
    if (state.repeat) {
      audio.currentTime = 0;
      audio.play();
      return;
    }

    playNext();
  }
);

progressBar.addEventListener(
  "input",
  () => {
    if (!audio.duration) {
      return;
    }

    audio.currentTime =
      (progressBar.value / 100) *
      audio.duration;
  }
);

volumeBar.addEventListener(
  "input",
  () => {
    audio.volume =
      Number(
        volumeBar.value
      );
  }
);

audio.volume = 0.8;

// ----------------------------------------------------
// Current song like
// ----------------------------------------------------

document
  .getElementById("likeCurrent")
  .addEventListener(
    "click",
    () => {
      if (
        state.currentIndex === -1
      ) {
        return;
      }

      toggleLike(
        state.currentIndex
      );
    }
  );

// ----------------------------------------------------
// Explore buttons
// ----------------------------------------------------

document
  .getElementById("exploreButton")
  .addEventListener(
    "click",
    () => {
      switchView("all");
    }
  );

document
  .getElementById("viewAllSongs")
  .addEventListener(
    "click",
    () => {
      switchView("all");
      renderAllSongs();
    }
  );

document
  .getElementById("viewAllCategories")
  .addEventListener(
    "click",
    () => {
      document
        .getElementById(
          "categoriesGrid"
        )
        .scrollIntoView({
          behavior: "smooth"
        });
    }
  );

// ----------------------------------------------------
// Mobile menu
// ----------------------------------------------------

document
  .getElementById("mobileMenu")
  .addEventListener(
    "click",
    () => {
      document
        .querySelector(".sidebar")
        .classList.toggle(
          "mobile-open"
        );
    }
  );

// ----------------------------------------------------
// Keyboard shortcuts
// ----------------------------------------------------

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.target.tagName ===
      "INPUT"
    ) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      playButton.click();
    }

    if (event.code === "ArrowRight") {
      playNext();
    }

    if (event.code === "ArrowLeft") {
      playPrevious();
    }
  }
);

// ----------------------------------------------------
// Start
// ----------------------------------------------------

loadSongs();