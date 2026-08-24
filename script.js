let songs = [];
let currentSong = null;
let currentIndex = -1;

let youtubeResults = [];

let currentAudio = null;
let youtubeFrame = null;

const $ = id =>
  document.getElementById(id);

const songList =
  $("songList");

const categoryGrid =
  $("categoryGrid");

const sideCategories =
  $("sideCategories");

const youtubeSongs =
  $("youtubeSongs");

const audio =
  $("audio");

const player =
  $("player");

const playerTitle =
  $("playerTitle");

const playerArtist =
  $("playerArtist");

const playerCover =
  $("playerCover");

const playButton =
  $("playButton");

const previousButton =
  $("previous");

const nextButton =
  $("next");

const modeButton =
  $("modeButton");

const progress =
  $("progress");

const currentTime =
  $("currentTime");

const duration =
  $("duration");

const toast =
  $("toast");

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function showToast(message) {
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  setTimeout(() => {
    toast.classList.remove(
      "show"
    );
  }, 3000);
}

function formatTime(seconds) {
  if (
    !Number.isFinite(
      seconds
    )
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

// --------------------------------------------------
// Load songs
// --------------------------------------------------

async function loadSongs() {
  try {
    const response =
      await fetch(
        "/api/songs",
        {
          cache:
            "no-store"
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        `API ${response.status}`
      );
    }

    songs =
      Array.isArray(
        data.songs
      )
        ? data.songs
        : Array.isArray(data)
          ? data
          : [];

    renderSongs(
      songs
    );

    updateStats();

    await loadCategories();

  } catch (error) {
    console.error(
      "Songs error:",
      error
    );

    songList.innerHTML = `
      <div class="loading-card glass">
        Unable to load songs.
        <br>
        <small>${escapeHtml(
          error.message
        )}</small>
      </div>
    `;
  }
}

// --------------------------------------------------
// Stats
// --------------------------------------------------

function updateStats() {
  const mp3Count =
    songs.filter(
      song =>
        song.source ===
        "mp3"
    ).length;

  const youtubeCount =
    songs.filter(
      song =>
        song.source ===
        "youtube"
    ).length;

  const categories =
    new Set(
      songs.map(
        song =>
          song.category ||
          "Other"
      )
    );

  if ($("songCount")) {
    $("songCount")
      .textContent =
      songs.length;
  }

  if ($("mp3Count")) {
    $("mp3Count")
      .textContent =
      mp3Count;
  }

  if ($("youtubeCount")) {
    $("youtubeCount")
      .textContent =
      youtubeCount;
  }

  if ($("categoryCount")) {
    $("categoryCount")
      .textContent =
      categories.size;
  }
}

// --------------------------------------------------
// Categories
// --------------------------------------------------

async function loadCategories() {
  try {
    const response =
      await fetch(
        "/api/categories",
        {
          cache:
            "no-store"
        }
      );

    const data =
      await response.json();

    const categories =
      Array.isArray(
        data.categories
      )
        ? data.categories
        : Array.isArray(data)
          ? data
          : [];

    renderCategories(
      categories
    );

  } catch (error) {
    console.error(
      "Categories error:",
      error
    );
  }
}

function renderCategories(
  categories
) {
  if (
    categoryGrid
  ) {
    categoryGrid.innerHTML =
      categories.length
        ? categories
            .map(
              category => `
                <button
                  class="category-card glass"
                  onclick="filterCategory('${escapeAttribute(
                    category.name
                  )}')"
                >
                  <span>
                    ${escapeHtml(
                      category.name
                    )}
                  </span>
                  <small>
                    ${Number(
                      category.count ||
                      0
                    )} songs
                  </small>
                </button>
              `
            )
            .join("")
        : `
          <div class="loading-card glass">
            No categories yet.
          </div>
        `;
  }

  if (
    sideCategories
  ) {
    sideCategories.innerHTML =
      categories
        .map(
          category => `
            <button
              class="side-category"
              onclick="filterCategory('${escapeAttribute(
                category.name
              )}')"
            >
              ${escapeHtml(
                category.name
              )}
              <span>
                ${Number(
                  category.count ||
                  0
                )}
              </span>
            </button>
          `
        )
        .join("");
  }
}

// --------------------------------------------------
// Render songs
// --------------------------------------------------

function renderSongs(
  list
) {
  if (!songList) {
    return;
  }

  if (!list.length) {
    songList.innerHTML = `
      <div class="loading-card glass">
        No songs found.
      </div>
    `;
    return;
  }

  songList.innerHTML =
    list
      .map(
        song => {
          const isYouTube =
            song.source ===
            "youtube";

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
              onclick="playSong('${escapeAttribute(
                song.id
              )}')"
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
                    "SwarAJ"
                  )}
                </small>

                <small>
                  ${escapeHtml(
                    song.category ||
                    "Other"
                  )}
                </small>
              </div>

              <div class="song-badge">
                ${
                  isYouTube
                    ? "▶ YouTube"
                    : "🎵 MP3"
                }
              </div>

            </article>
          `;
        }
      )
      .join("");
}

// --------------------------------------------------
// Filter
// --------------------------------------------------

function filterCategory(
  category
) {
  const filtered =
    songs.filter(
      song =>
        String(
          song.category ||
          ""
        ).toLowerCase() ===
        String(
          category
        ).toLowerCase()
    );

  renderSongs(
    filtered
  );

  const heading =
    $("songHeading");

  if (heading) {
    heading.textContent =
      category;
  }

  const home =
    $("homePage");

  if (
    home &&
    !home.classList.contains(
      "active-page"
    )
  ) {
    showPage(
      "home"
    );
  }

  document
    .querySelector(
      ".section:last-of-type"
    )
    ?.scrollIntoView({
      behavior:
        "smooth"
    });
}

window.filterCategory =
  filterCategory;

// --------------------------------------------------
// Search
// --------------------------------------------------

$("searchInput")
  ?.addEventListener(
    "input",
    event => {
      const query =
        event.target.value
          .trim()
          .toLowerCase();

      if (!query) {
        renderSongs(
          songs
        );
        return;
      }

      const filtered =
        songs.filter(
          song =>
            String(
              song.title ||
              ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              song.artist ||
              ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              song.category ||
              ""
            )
              .toLowerCase()
              .includes(query)
        );

      renderSongs(
        filtered
      );
    }
  );

// --------------------------------------------------
// Play song
// --------------------------------------------------

function playSong(
  id
) {
  const index =
    songs.findIndex(
      song =>
        String(
          song.id
        ) ===
        String(id)
    );

  if (
    index === -1
  ) {
    return;
  }

  currentIndex =
    index;

  currentSong =
    songs[index];

  if (
    currentSong.source ===
    "youtube"
  ) {
    playYouTube(
      currentSong
    );
  } else {
    playMP3(
      currentSong
    );
  }
}

window.playSong =
  playSong;

// --------------------------------------------------
// MP3 player
// --------------------------------------------------

function playMP3(
  song
) {
  stopYouTube();

  currentAudio =
    song;

  audio.src =
    song.audio_url;

  audio.load();

  audio
    .play()
    .then(() => {
      playButton.textContent =
        "❚❚";
    })
    .catch(error => {
      console.warn(
        "Audio playback:",
        error
      );

      playButton.textContent =
        "▶";
    });

  updatePlayer(
    song
  );
}

function stopMP3() {
  audio.pause();

  audio.removeAttribute(
    "src"
  );

  audio.load();

  currentAudio =
    null;
}

audio.addEventListener(
  "play",
  () => {
    playButton.textContent =
      "❚❚";
  }
);

audio.addEventListener(
  "pause",
  () => {
    playButton.textContent =
      "▶";
  }
);

audio.addEventListener(
  "timeupdate",
  () => {
    if (
      !audio.duration
    ) {
      return;
    }

    progress.value =
      (
        audio.currentTime /
        audio.duration
      ) *
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

audio.addEventListener(
  "ended",
  nextSong
);

progress?.addEventListener(
  "input",
  () => {
    if (
      !audio.duration
    ) {
      return;
    }

    audio.currentTime =
      (
        Number(
          progress.value
        ) / 100
      ) *
      audio.duration;
  }
);

// --------------------------------------------------
// YouTube
// --------------------------------------------------

function getYouTubeVideoId(
  url
) {
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
      host ===
      "youtu.be"
    ) {
      return (
        parsed.pathname
          .replace(
            /^\/+/,
            ""
          )
          .split(
            "/"
          )[0]
      );
    }

    if (
      host ===
        "youtube.com" ||
      host ===
        "m.youtube.com"
    ) {
      const v =
        parsed.searchParams.get(
          "v"
        );

      if (v) {
        return v;
      }

      const match =
        parsed.pathname.match(
          /^\/(?:shorts|embed|live)\/([^/?]+)/
        );

      return match
        ? match[1]
        : null;
    }
  } catch {
    return null;
  }

  return null;
}

function playYouTube(
  song
) {
  stopMP3();

  const videoId =
    getYouTubeVideoId(
      song.youtube_url
    );

  if (!videoId) {
    showToast(
      "Invalid YouTube URL"
    );
    return;
  }

  updatePlayer(
    song
  );

  modeButton.textContent =
    "🎬";

  const modal =
    $("videoModal");

  const frame =
    $("youtubeFrame");

  const title =
    $("videoTitle");

  if (title) {
    title.textContent =
      song.title ||
      "YouTube";
  }

  frame.src =
    `https://www.youtube.com/embed/${encodeURIComponent(
      videoId
    )}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  modal.classList.add(
    "active"
  );

  youtubeFrame =
    frame;
}

// --------------------------------------------------
// Stop YouTube
// --------------------------------------------------

function stopYouTube() {
  const frame =
    $("youtubeFrame");

  if (frame) {
    frame.src =
      "about:blank";
  }

  const modal =
    $("videoModal");

  if (modal) {
    modal.classList.remove(
      "active"
    );
  }

  youtubeFrame =
    null;
}

// --------------------------------------------------
// Player info
// --------------------------------------------------

function updatePlayer(
  song
) {
  player.classList.add(
    "active"
  );

  playerTitle.textContent =
    song.title ||
    "Unknown Song";

  playerArtist.textContent =
    song.artist ||
    "SwarAJ";

  if (
    song.cover_url
  ) {
    playerCover.innerHTML = `
      <img
        src="${escapeAttribute(
          song.cover_url
        )}"
        alt=""
      >
    `;
  } else {
    playerCover.textContent =
      "स्व";
  }
}

// --------------------------------------------------
// Previous / Next
// --------------------------------------------------

function nextSong() {
  if (!songs.length) {
    return;
  }

  currentIndex =
    (
      currentIndex +
      1
    ) %
    songs.length;

  playSong(
    songs[currentIndex].id
  );
}

function previousSong() {
  if (!songs.length) {
    return;
  }

  currentIndex =
    (
      currentIndex -
      1 +
      songs.length
    ) %
    songs.length;

  playSong(
    songs[currentIndex].id
  );
}

nextButton?.addEventListener(
  "click",
  nextSong
);

previousButton?.addEventListener(
  "click",
  previousSong
);

playButton?.addEventListener(
  "click",
  () => {
    if (
      currentSong?.source ===
      "youtube"
    ) {
      showToast(
        "Use the YouTube player controls to pause/play."
      );
      return;
    }

    if (
      audio.paused
    ) {
      audio.play();
    } else {
      audio.pause();
    }
  }
);

// --------------------------------------------------
// Video close
// --------------------------------------------------

$("closeVideo")
  ?.addEventListener(
    "click",
    stopYouTube
  );

// --------------------------------------------------
// Page navigation
// --------------------------------------------------

function showPage(
  page
) {
  document
    .querySelectorAll(
      ".page"
    )
    .forEach(section => {
      section.classList.remove(
        "active-page"
      );
    });

  const target =
    $(
      `${page}Page`
    );

  if (target) {
    target.classList.add(
      "active-page"
    );
  }

  document
    .querySelectorAll(
      ".nav"
    )
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page ===
          page
      );
    });

  if (
    page ===
    "youtube"
  ) {
    loadYouTubeLibrary();
  }
}

document
  .querySelectorAll(
    ".nav[data-page]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () =>
        showPage(
          button.dataset.page
        )
    );
  });

// --------------------------------------------------
// Menu
// --------------------------------------------------

$("menuButton")
  ?.addEventListener(
    "click",
    () => {
      $("sidebar")
        ?.classList.toggle(
          "open"
        );
    }
  );

// --------------------------------------------------
// Refresh
// --------------------------------------------------

$("refreshButton")
  ?.addEventListener(
    "click",
    async () => {
      await loadSongs();

      showToast(
        "Library refreshed"
      );
    }
  );

// --------------------------------------------------
// Show all
// --------------------------------------------------

$("showAll")
  ?.addEventListener(
    "click",
    () => {
      renderSongs(
        songs
      );

      $("songHeading")
        .textContent =
        "All Songs";
    }
  );

// --------------------------------------------------
// Play all
// --------------------------------------------------

$("playAll")
  ?.addEventListener(
    "click",
    () => {
      if (
        songs.length
      ) {
        playSong(
          songs[0].id
        );
      }
    }
  );

// --------------------------------------------------
// Shuffle
// --------------------------------------------------

$("shuffleAll")
  ?.addEventListener(
    "click",
    () => {
      if (
        !songs.length
      ) {
        return;
      }

      const random =
        Math.floor(
          Math.random() *
          songs.length
        );

      playSong(
        songs[random].id
      );
    }
  );

// --------------------------------------------------
// Sort
// --------------------------------------------------

$("sortSelect")
  ?.addEventListener(
    "change",
    event => {
      const value =
        event.target.value;

      const sorted =
        [
          ...songs
        ].sort(
          (a, b) => {
            if (
              value ===
              "category"
            ) {
              return String(
                a.category ||
                ""
              ).localeCompare(
                String(
                  b.category ||
                  ""
                )
              );
            }

            return String(
              a.title ||
              ""
            ).localeCompare(
              String(
                b.title ||
                ""
              )
            );
          }
        );

      renderSongs(
        sorted
      );
    }
  );

// --------------------------------------------------
// YouTube Search
// --------------------------------------------------

async function searchYouTube() {
  const input =
    $("youtubeSearchInput");

  const results =
    $("youtubeResults");

  if (!input || !results) {
    return;
  }

  const query =
    input.value.trim();

  if (!query) {
    showToast(
      "Enter a YouTube search"
    );
    return;
  }

  results.innerHTML = `
    <div class="loading-card glass">
      Searching YouTube...
    </div>
  `;

  try {
    const response =
      await fetch(
        `/api/youtube/search?q=${encodeURIComponent(
          query
        )}`,
        {
          cache:
            "no-store"
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "YouTube search failed"
      );
    }

    youtubeResults =
      data.items || [];

    renderYouTubeResults(
      youtubeResults
    );

  } catch (error) {
    console.error(
      error
    );

    results.innerHTML = `
      <div class="loading-card glass">
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}

$("youtubeSearchButton")
  ?.addEventListener(
    "click",
    searchYouTube
  );

$("youtubeSearchInput")
  ?.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        searchYouTube();
      }
    }
  );

function renderYouTubeResults(
  results
) {
  const container =
    $("youtubeResults");

  if (!container) {
    return;
  }

  if (!results.length) {
    container.innerHTML = `
      <div class="loading-card glass">
        No YouTube results.
      </div>
    `;
    return;
  }

  container.innerHTML =
    results
      .map(
        item => `
          <article class="youtube-result glass">

            <img
              src="${escapeAttribute(
                item.thumbnail ||
                ""
              )}"
              alt=""
              loading="lazy"
            >

            <div>
              <strong>
                ${escapeHtml(
                  item.title
                )}
              </strong>

              <small>
                ${escapeHtml(
                  item.artist
                )}
              </small>

              <div class="youtube-actions">

                <button
                  onclick="previewYouTube('${escapeAttribute(
                    item.youtube_url
                  )}')"
                >
                  ▶ Play
                </button>

                <button
                  onclick="saveYouTube('${escapeAttribute(
                    item.video_id
                  )}')"
                >
                  ＋ Add
                </button>

              </div>

            </div>

          </article>
        `
      )
      .join("");
}

window.previewYouTube =
  function (
    url
  ) {
    playYouTube({
      id:
        "preview-" +
        Date.now(),

      source:
        "youtube",

      title:
        "YouTube Preview",

      artist:
        "YouTube",

      youtube_url:
        url,

      cover_url:
        null
    });
  };

// --------------------------------------------------
// Save YouTube result
// --------------------------------------------------

window.saveYouTube =
  async function (
    videoId
  ) {
    const result =
      youtubeResults.find(
        item =>
          item.video_id ===
          videoId
      );

    if (!result) {
      return;
    }

    const adminKey =
      prompt(
        "Enter ADMIN_KEY"
      );

    if (!adminKey) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/youtube",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "X-Admin-Key":
                adminKey
            },

            body:
              JSON.stringify({
                title:
                  result.title,

                artist:
                  result.artist,

                category:
                  "YouTube",

                youtubeUrl:
                  result.youtube_url
              })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to add"
        );
      }

      showToast(
        "YouTube song added"
      );

      await loadSongs();

      await loadYouTubeLibrary();

    } catch (error) {
      showToast(
        error.message
      );
    }
  };

// --------------------------------------------------
// YouTube library
// --------------------------------------------------

async function loadYouTubeLibrary() {
  const container =
    youtubeSongs;

  if (!container) {
    return;
  }

  const youtube =
    songs.filter(
      song =>
        song.source ===
        "youtube"
    );

  if (!youtube.length) {
    container.innerHTML = `
      <div class="loading-card glass">
        No YouTube songs saved yet.
      </div>
    `;
    return;
  }

  container.innerHTML =
    youtube
      .map(
        song => `
          <article
            class="youtube-result glass"
            onclick="playSong('${escapeAttribute(
              song.id
            )}')"
          >

            <img
              src="${escapeAttribute(
                song.cover_url ||
                ""
              )}"
              alt=""
              loading="lazy"
            >

            <div>
              <strong>
                ${escapeHtml(
                  song.title
                )}
              </strong>

              <small>
                ${escapeHtml(
                  song.artist
                )}
              </small>
            </div>

          </article>
        `
      )
      .join("");
}

// --------------------------------------------------
// Admin
// --------------------------------------------------

function getAdminKey() {
  const input =
    $("adminKey");

  return input
    ? input.value.trim()
    : "";
}

$("addYoutube")
  ?.addEventListener(
    "click",
    async () => {
      const key =
        getAdminKey();

      const title =
        $("ytTitle")
          ?.value.trim();

      const artist =
        $("ytArtist")
          ?.value.trim();

      const category =
        $("ytCategory")
          ?.value.trim();

      const url =
        $("ytUrl")
          ?.value.trim();

      if (!key) {
        showToast(
          "Enter ADMIN_KEY first"
        );
        return;
      }

      if (!url) {
        showToast(
          "Enter YouTube URL"
        );
        return;
      }

      try {
        const response =
          await fetch(
            "/api/youtube",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "X-Admin-Key":
                  key
              },

              body:
                JSON.stringify({
                  title,
                  artist,
                  category,
                  youtubeUrl:
                    url
                })
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Unable to add YouTube song"
          );
        }

        showToast(
          "YouTube song added successfully"
        );

        $("ytTitle").value =
          "";

        $("ytArtist").value =
          "";

        $("ytCategory").value =
          "";

        $("ytUrl").value =
          "";

        await loadSongs();

        await loadYouTubeLibrary();

      } catch (error) {
        showToast(
          error.message
        );
      }
    }
  );

// --------------------------------------------------
// MP3 upload
// --------------------------------------------------

$("uploadMp3")
  ?.addEventListener(
    "click",
    async () => {
      const key =
        getAdminKey();

      const file =
        $("mp3File")
          ?.files?.[0];

      const title =
        $("mp3Title")
          ?.value.trim();

      const artist =
        $("mp3Artist")
          ?.value.trim();

      const category =
        $("mp3Category")
          ?.value.trim() ||
        "Uncategorized";

      if (!key) {
        showToast(
          "Enter ADMIN_KEY first"
        );
        return;
      }

      if (!file) {
        showToast(
          "Select an MP3 file"
        );
        return;
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith(".mp3")
      ) {
        showToast(
          "Only MP3 files are allowed"
        );
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "title",
        title
      );

      formData.append(
        "artist",
        artist
      );

      formData.append(
        "category",
        category
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
                "X-Admin-Key":
                  key
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
            "Upload failed"
          );
        }

        showToast(
          "MP3 uploaded successfully"
        );

        $("mp3Title").value =
          "";

        $("mp3Artist").value =
          "";

        $("mp3Category").value =
          "";

        $("mp3File").value =
          "";

        await loadSongs();

      } catch (error) {
        showToast(
          error.message
        );
      }
    }
  );

// --------------------------------------------------
// Start
// --------------------------------------------------

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    await loadSongs();
  }
);