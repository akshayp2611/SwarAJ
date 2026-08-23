const audio = document.getElementById("audio");

const state = {
  songs: [],
  filtered: [],
  index: -1,
  shuffle: false,
  repeat: false,
  liked: JSON.parse(
    localStorage.getItem("swaraj-liked") || "[]"
  )
};

const $ = id =>
  document.getElementById(id);

// --------------------------------------------------
// Escape HTML
// --------------------------------------------------

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]
  );
}

// --------------------------------------------------
// Time formatter
// --------------------------------------------------

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes = Math.floor(
    seconds / 60
  );

  const secs = Math.floor(
    seconds % 60
  )
    .toString()
    .padStart(2, "0");

  return `${minutes}:${secs}`;
}

// --------------------------------------------------
// Normalize song
// --------------------------------------------------

function normalizeSong(song, index) {
  return {
    id:
      song.id ??
      `song-${index + 1}`,

    title:
      song.title ??
      "Untitled",

    artist:
      song.artist ??
      "स्वरAJ",

    album:
      song.album ??
      song.category ??
      "Music",

    category:
      song.category ??
      "Music",

    cover:
      song.cover ||
      "/images/default-cover.svg",

    url:
      song.url ||
      "",

    file:
      song.file ||
      ""
  };
}

// --------------------------------------------------
// Load songs
// --------------------------------------------------

async function load() {
  try {
    const [
      songsResponse,
      categoriesResponse
    ] = await Promise.all([
      fetch("/api/songs", {
        cache: "no-store"
      }),

      fetch("/api/categories", {
        cache: "no-store"
      })
    ]);

    if (!songsResponse.ok) {
      throw new Error(
        `Songs API returned ${songsResponse.status}`
      );
    }

    const songsData =
      await songsResponse.json();

    // IMPORTANT:
    // server returns { success, count, songs }
    state.songs = Array.isArray(
      songsData
    )
      ? songsData
      : Array.isArray(songsData.songs)
        ? songsData.songs
        : [];

    state.songs =
      state.songs.map(
        normalizeSong
      );

    state.filtered = [
      ...state.songs
    ];

    let categories = [];

    if (categoriesResponse.ok) {
      const categoriesData =
        await categoriesResponse.json();

      categories =
        Array.isArray(
          categoriesData
        )
          ? categoriesData
          : Array.isArray(
              categoriesData.categories
            )
            ? categoriesData.categories
            : [];
    }

    $("songCount").textContent =
      state.songs.length;

    renderCategories(
      categories
    );

    renderSongs(
      state.songs
    );

    if (!state.songs.length) {
      $("songList").innerHTML = `
        <div class="empty">
          No songs found.
          <br><br>
          Add MP3 files inside
          <b>songs/</b>
          and redeploy.
        </div>
      `;
    }
  } catch (error) {
    console.error(
      "Unable to load music:",
      error
    );

    $("songCount").textContent =
      "0";

    $("songList").innerHTML = `
      <div class="empty">
        Unable to load songs.
        <br><br>
        ${esc(error.message)}
      </div>
    `;
  }
}

// --------------------------------------------------
// Render categories
// --------------------------------------------------

function renderCategories(
  categories
) {
  const icons = [
    "♫",
    "♥",
    "🙏",
    "⚡",
    "💔",
    "🎧",
    "🎼"
  ];

  const normalizedCategories =
    categories.map(
      (category, index) => {
        if (
          typeof category ===
          "string"
        ) {
          return {
            name: category,
            count:
              state.songs.filter(
                song =>
                  song.category ===
                  category
              ).length
          };
        }

        return {
          name:
            category.name ??
            "Music",

          count:
            Number(
              category.count
            ) || 0
        };
      }
    );

  $("categories").innerHTML =
    normalizedCategories.length
      ? normalizedCategories
          .map(
            (category, index) => `
              <button
                class="category"
                onclick='filterCategory(${JSON.stringify(
                  category.name
                )})'
              >
                <div class="category-icon">
                  ${
                    icons[
                      index %
                        icons.length
                    ]
                  }
                </div>

                <h3>
                  ${esc(
                    category.name
                  )}
                </h3>

                <p>
                  ${
                    category.count
                  }
                  song${
                    category.count ===
                    1
                      ? ""
                      : "s"
                  }
                </p>
              </button>
            `
          )
          .join("")
      : `
          <div class="empty">
            No categories yet.
          </div>
        `;

  $("sideCategories").innerHTML =
    normalizedCategories
      .map(
        category => `
          <button
            class="cat-side"
            onclick='filterCategory(${JSON.stringify(
              category.name
            )})'
          >
            ${esc(
              category.name
            )}
            <small>
              (${category.count})
            </small>
          </button>
        `
      )
      .join("");
}

// --------------------------------------------------
// Render songs
// --------------------------------------------------

function renderSongs(
  songs
) {
  state.filtered = [
    ...songs
  ];

  $("songList").innerHTML =
    songs.length
      ? songs
          .map(
            (song, index) => `
              <div class="song">

                <img
                  src="${esc(
                    song.cover
                  )}"
                  onerror="
                    this.onerror=null;
                    this.src='/images/default-cover.svg';
                  "
                  alt=""
                >

                <div class="song-info">

                  <b>
                    ${esc(
                      song.title
                    )}
                  </b>

                  <span>
                    ${esc(
                      song.artist
                    )}
                    •
                    ${esc(
                      song.album
                    )}
                  </span>

                </div>

                <button
                  onclick='toggleLike(${JSON.stringify(
                    song.id
                  )})'
                  title="Like"
                >
                  ${
                    state.liked.includes(
                      song.id
                    )
                      ? "♥"
                      : "♡"
                  }
                </button>

                <button
                  class="play-small"
                  onclick="playFromList(${index})"
                  title="Play"
                >
                  ▶
                </button>

              </div>
            `
          )
          .join("")
      : `
          <div class="empty">
            No matching songs.
          </div>
        `;
}

// --------------------------------------------------
// Play song from displayed list
// --------------------------------------------------

window.playFromList =
  function (index) {
    const song =
      state.filtered[index];

    if (!song) {
      return;
    }

    const globalIndex =
      state.songs.findIndex(
        item =>
          item.id ===
          song.id
      );

    if (globalIndex !== -1) {
      play(globalIndex);
    }
  };

// --------------------------------------------------
// Filter category
// --------------------------------------------------

window.filterCategory =
  function (category) {
    const songs =
      category === "All Songs"
        ? state.songs
        : state.songs.filter(
            song =>
              song.category ===
              category
          );

    $("songsTitle").textContent =
      category;

    $("songsSubtitle").textContent =
      `${songs.length} song${
        songs.length === 1
          ? ""
          : "s"
      }`;

    renderSongs(
      songs
    );

    $("songsSection").scrollIntoView(
      {
        behavior: "smooth"
      }
    );

    closeMenu();
  };

// --------------------------------------------------
// Play
// --------------------------------------------------

function play(index) {
  const song =
    state.songs[index];

  if (!song) {
    return;
  }

  if (!song.url) {
    console.error(
      "Song URL missing:",
      song
    );

    return;
  }

  state.index =
    index;

  console.log(
    "Playing:",
    song.title
  );

  console.log(
    "URL:",
    song.url
  );

  audio.pause();

  audio.src =
    song.url;

  audio.load();

  audio.play()
    .then(() => {
      $("playBtn").textContent =
        "❚❚";
    })
    .catch(error => {
      console.error(
        "Audio playback error:",
        error
      );

      $("playBtn").textContent =
        "▶";

      alert(
        `Unable to play "${song.title}".\n\nCheck that the audio file exists in the songs folder.`
      );
    });

  $("nowTitle").textContent =
    song.title;

  $("nowArtist").textContent =
    `${song.artist} • ${song.album}`;

  $("cover").src =
    song.cover ||
    "/images/default-cover.svg";

  $("likeBtn").textContent =
    state.liked.includes(
      song.id
    )
      ? "♥"
      : "♡";
}

// --------------------------------------------------
// Next
// --------------------------------------------------

function next() {
  if (!state.songs.length) {
    return;
  }

  if (
    state.index === -1
  ) {
    play(0);
    return;
  }

  if (state.shuffle) {
    let nextIndex =
      Math.floor(
        Math.random() *
          state.songs.length
      );

    if (
      state.songs.length >
        1 &&
      nextIndex ===
        state.index
    ) {
      nextIndex =
        (nextIndex + 1) %
        state.songs.length;
    }

    play(
      nextIndex
    );

    return;
  }

  play(
    (state.index + 1) %
      state.songs.length
  );
}

// --------------------------------------------------
// Previous
// --------------------------------------------------

function previous() {
  if (!state.songs.length) {
    return;
  }

  if (
    state.index === -1
  ) {
    play(0);
    return;
  }

  play(
    (
      state.index -
      1 +
      state.songs.length
    ) %
      state.songs.length
  );
}

// --------------------------------------------------
// Like
// --------------------------------------------------

window.toggleLike =
  function (id) {
    if (
      state.liked.includes(
        id
      )
    ) {
      state.liked =
        state.liked.filter(
          item =>
            item !== id
        );
    } else {
      state.liked.push(
        id
      );
    }

    localStorage.setItem(
      "swaraj-liked",
      JSON.stringify(
        state.liked
      )
    );

    if (
      state.index >= 0 &&
      state.songs[
        state.index
      ]
    ) {
      $("likeBtn").textContent =
        state.liked.includes(
          state.songs[
            state.index
          ].id
        )
          ? "♥"
          : "♡";
    }

    renderSongs(
      state.filtered
    );
  };

// --------------------------------------------------
// Play button
// --------------------------------------------------

$("playBtn").onclick =
  () => {
    if (!state.songs.length) {
      return;
    }

    if (
      state.index < 0
    ) {
      play(0);
      return;
    }

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          $("playBtn").textContent =
            "❚❚";
        })
        .catch(error => {
          console.error(
            error
          );
        });
    } else {
      audio.pause();

      $("playBtn").textContent =
        "▶";
    }
  };

// --------------------------------------------------
// Navigation
// --------------------------------------------------

$("nextBtn").onclick =
  next;

$("prevBtn").onclick =
  previous;

// --------------------------------------------------
// Shuffle
// --------------------------------------------------

$("shuffleBtn").onclick =
  () => {
    state.shuffle =
      !state.shuffle;

    $("shuffleBtn").style.color =
      state.shuffle
        ? "#ff3192"
        : "";
  };

// --------------------------------------------------
// Repeat
// --------------------------------------------------

$("repeatBtn").onclick =
  () => {
    state.repeat =
      !state.repeat;

    $("repeatBtn").style.color =
      state.repeat
        ? "#ff3192"
        : "";
  };

// --------------------------------------------------
// Player like
// --------------------------------------------------

$("likeBtn").onclick =
  () => {
    if (
      state.index >= 0
    ) {
      toggleLike(
        state.songs[
          state.index
        ].id
      );
    }
  };

// --------------------------------------------------
// Audio metadata
// --------------------------------------------------

audio.addEventListener(
  "loadedmetadata",
  () => {
    $("duration").textContent =
      formatTime(
        audio.duration
      );
  }
);

// --------------------------------------------------
// Audio time
// --------------------------------------------------

audio.addEventListener(
  "timeupdate",
  () => {
    $("currentTime").textContent =
      formatTime(
        audio.currentTime
      );

    $("progress").value =
      audio.duration
        ? (
            audio.currentTime /
            audio.duration
          ) * 100
        : 0;
  }
);

// --------------------------------------------------
// Audio playing
// --------------------------------------------------

audio.addEventListener(
  "play",
  () => {
    $("playBtn").textContent =
      "❚❚";
  }
);

// --------------------------------------------------
// Audio paused
// --------------------------------------------------

audio.addEventListener(
  "pause",
  () => {
    $("playBtn").textContent =
      "▶";
  }
);

// --------------------------------------------------
// Audio error
// --------------------------------------------------

audio.addEventListener(
  "error",
  () => {
    console.error(
      "Audio element error:",
      audio.error
    );

    $("playBtn").textContent =
      "▶";
  }
);

// --------------------------------------------------
// Song ended
// --------------------------------------------------

audio.addEventListener(
  "ended",
  () => {
    if (state.repeat) {
      play(
        state.index
      );
    } else {
      next();
    }
  }
);

// --------------------------------------------------
// Progress
// --------------------------------------------------

$("progress").oninput =
  event => {
    if (
      audio.duration
    ) {
      audio.currentTime =
        (
          Number(
            event.target.value
          ) / 100
        ) *
        audio.duration;
    }
  };

// --------------------------------------------------
// Volume
// --------------------------------------------------

$("volume").oninput =
  event => {
    audio.volume =
      Number(
        event.target.value
      );
  };

audio.volume = 0.9;

// --------------------------------------------------
// Search
// --------------------------------------------------

$("search").addEventListener(
  "input",
  event => {
    const query =
      event.target.value
        .trim()
        .toLowerCase();

    const songs =
      !query
        ? state.songs
        : state.songs.filter(
            song =>
              [
                song.title,
                song.artist,
                song.album,
                song.category,
                song.file
              ].some(
                value =>
                  String(
                    value
                  )
                    .toLowerCase()
                    .includes(
                      query
                    )
              )
          );

    $("songsTitle").textContent =
      query
        ? `Search: ${event.target.value}`
        : "All Songs";

    $("songsSubtitle").textContent =
      `${songs.length} song${
        songs.length === 1
          ? ""
          : "s"
      }`;

    renderSongs(
      songs
    );
  });

// --------------------------------------------------
// Explore
// --------------------------------------------------

$("exploreBtn").onclick =
  () => {
    $("songsSection").scrollIntoView(
      {
        behavior: "smooth"
      }
    );
  };

// --------------------------------------------------
// View all
// --------------------------------------------------

$("viewAll").onclick =
  () => {
    filterCategory(
      "All Songs"
    );
  };

// --------------------------------------------------
// Mobile menu
// --------------------------------------------------

$("menuBtn").onclick =
  () => {
    $("sidebar").classList.toggle(
      "open"
    );

    $("overlay").classList.toggle(
      "show"
    );
  };

$("overlay").onclick =
  closeMenu;

function closeMenu() {
  $("sidebar").classList.remove(
    "open"
  );

  $("overlay").classList.remove(
    "show"
  );
}

// --------------------------------------------------
// Start
// --------------------------------------------------

load();