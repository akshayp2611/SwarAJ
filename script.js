let songs = [];
let currentSong = null;
let currentIndex = -1;

let youtubePlayer = null;
let youtubeReady = false;
let youtubeVideoId = null;

const $ = id => document.getElementById(id);

// ============================================================
// Helpers
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminKey() {
  return (
    $("adminKey")?.value.trim() ||
    localStorage.getItem(
      "swaraj_admin_key"
    ) ||
    ""
  );
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(
      data.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes =
    Math.floor(seconds / 60);

  const secondsPart =
    Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");

  return `${minutes}:${secondsPart}`;
}

// ============================================================
// Load songs from PostgreSQL
// ============================================================

async function loadSongs() {
  try {
    const data =
      await api("/api/songs");

    songs =
      Array.isArray(data.songs)
        ? data.songs
        : [];

    renderSongs(songs);
    renderAdminSongs(songs);

    updateStats();
    await loadCategories();
  } catch (error) {
    console.error(error);

    $("songList").innerHTML = `
      <div class="empty glass">
        Unable to load songs.
        <small>${escapeHtml(
          error.message
        )}</small>
      </div>
    `;
  }
}

// ============================================================
// Stats
// ============================================================

function updateStats() {
  const uploaded =
    songs.filter(
      s => s.source_type === "upload"
    ).length;

  const mp3Urls =
    songs.filter(
      s => s.source_type === "mp3_url"
    ).length;

  const youtube =
    songs.filter(
      s => s.source_type === "youtube"
    ).length;

  const categories =
    new Set(
      songs.map(
        s => s.category
      )
    );

  if ($("songCount"))
    $("songCount").textContent =
      songs.length;

  if ($("mp3Count"))
    $("mp3Count").textContent =
      uploaded + mp3Urls;

  if ($("youtubeCount"))
    $("youtubeCount").textContent =
      youtube;

  if ($("categoryCount"))
    $("categoryCount").textContent =
      categories.size;
}

// ============================================================
// Categories
// ============================================================

async function loadCategories() {
  try {
    const data =
      await api(
        "/api/categories"
      );

    renderCategories(
      data.categories || []
    );
  } catch (error) {
    console.error(error);
  }
}

function renderCategories(
  categories
) {
  const grid =
    $("categoryGrid");

  const sidebar =
    $("sideCategories");

  if (grid) {
    grid.innerHTML =
      categories.length
        ? categories.map(
            category => `
              <button
                class="category-card glass"
                onclick="filterCategory('${escapeHtml(
                  category.name
                ).replace(/'/g, "\\'")}')"
              >
                <span>
                  ${escapeHtml(
                    category.name
                  )}
                </span>

                <small>
                  ${category.count} songs
                </small>
              </button>
            `
          ).join("")
        : `
          <div class="empty glass">
            No categories yet.
          </div>
        `;
  }

  if (sidebar) {
    sidebar.innerHTML =
      categories.map(
        category => `
          <button
            class="side-category"
            onclick="filterCategory('${escapeHtml(
              category.name
            ).replace(/'/g, "\\'")}')"
          >
            ${escapeHtml(
              category.name
            )}

            <span>
              ${category.count}
            </span>
          </button>
        `
      ).join("");
  }
}

// ============================================================
// Render songs
// ============================================================

function renderSongs(list) {
  const container =
    $("songList");

  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty glass">
        No songs found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    list.map(song => {
      const youtube =
        song.source_type ===
        "youtube";

      const badge =
        youtube
          ? "▶ YouTube"
          : song.source_type ===
              "mp3_url"
            ? "🔗 MP3 URL"
            : "🎵 MP3";

      return `
        <article
          class="song-card glass"
          onclick="playSong('${escapeHtml(
            song.id
          )}')"
        >

          <div class="song-art">
            <img
              src="${escapeHtml(
                song.cover_url ||
                "/images/ganpati.jpg"
              )}"
              alt=""
              loading="lazy"
            >
          </div>

          <div class="song-details">
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

            <small>
              ${escapeHtml(
                song.category
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

// ============================================================
// Search
// ============================================================

$("searchInput")
  ?.addEventListener(
    "input",
    async event => {
      const query =
        event.target.value.trim();

      if (!query) {
        renderSongs(songs);
        return;
      }

      try {
        const data =
          await api(
            `/api/search?q=${encodeURIComponent(
              query
            )}`
          );

        renderSongs(
          data.songs || []
        );
      } catch (error) {
        console.error(error);
      }
    }
  );

// ============================================================
// Category
// ============================================================

function filterCategory(category) {
  const filtered =
    songs.filter(
      song =>
        String(
          song.category
        ).toLowerCase() ===
        String(
          category
        ).toLowerCase()
    );

  renderSongs(filtered);

  if ($("songHeading")) {
    $("songHeading").textContent =
      category;
  }

  showPage("home");
}

window.filterCategory =
  filterCategory;

// ============================================================
// Play song
// ============================================================

function playSong(id) {
  const index =
    songs.findIndex(
      song =>
        String(song.id) ===
        String(id)
    );

  if (index < 0) return;

  currentIndex = index;
  currentSong = songs[index];

  if (
    currentSong.source_type ===
    "youtube"
  ) {
    playYouTubeAudio(
      currentSong
    );
  } else {
    playMP3(
      currentSong
    );
  }
}

window.playSong = playSong;

// ============================================================
// MP3
// ============================================================

function playMP3(song) {
  stopYouTube();

  const audio =
    $("audio");

  audio.src =
    song.audio_url;

  audio.load();

  audio.play()
    .then(() => {
      $("playButton").textContent =
        "❚❚";
    })
    .catch(error => {
      console.error(error);

      showToast(
        "Unable to play this MP3."
      );
    });

  updatePlayer(song);
}

// ============================================================
// YouTube Audio Mode
// ============================================================

function playYouTubeAudio(song) {
  const videoId =
    song.youtube_video_id;

  if (!videoId) {
    showToast(
      "YouTube video ID is missing."
    );

    return;
  }

  stopMP3();

  currentSong = song;
  youtubeVideoId = videoId;

  updatePlayer(song);

  // Hidden YouTube player
  openHiddenYouTubePlayer(
    videoId
  );
}

// ============================================================
// YouTube IFrame API
// ============================================================

function loadYouTubeAPI() {
  if (
    window.YT &&
    window.YT.Player
  ) {
    youtubeReady = true;
    return;
  }

  if (
    document.getElementById(
      "youtube-api"
    )
  ) {
    return;
  }

  const script =
    document.createElement(
      "script"
    );

  script.id =
    "youtube-api";

  script.src =
    "https://www.youtube.com/iframe_api";

  document.head.appendChild(
    script
  );

  window.onYouTubeIframeAPIReady =
    () => {
      youtubeReady = true;

      if (youtubeVideoId) {
        openHiddenYouTubePlayer(
          youtubeVideoId
        );
      }
    };
}

// ============================================================
// Hidden YouTube player
// ============================================================

function openHiddenYouTubePlayer(
  videoId
) {
  loadYouTubeAPI();

  const container =
    $("youtubeAudioPlayer");

  if (!container) return;

  container.innerHTML =
    `<div id="ytHiddenFrame"></div>`;

  if (
    !window.YT ||
    !window.YT.Player
  ) {
    setTimeout(
      () =>
        openHiddenYouTubePlayer(
          videoId
        ),
      500
    );

    return;
  }

  youtubePlayer =
    new YT.Player(
      "ytHiddenFrame",
      {
        width: "1",
        height: "1",

        videoId,

        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },

        events: {
          onReady(event) {
            event.target.playVideo();

            $("playButton")
              .textContent =
              "❚❚";
          },

          onStateChange(event) {
            if (
              event.data ===
              YT.PlayerState.ENDED
            ) {
              nextSong();
            }

            if (
              event.data ===
              YT.PlayerState.PLAYING
            ) {
              $("playButton")
                .textContent =
                "❚❚";
            }

            if (
              event.data ===
              YT.PlayerState.PAUSED
            ) {
              $("playButton")
                .textContent =
                "▶";
            }
          }
        }
      }
    );
}

// ============================================================
// Show YouTube Video
// ============================================================

function showYouTubeVideo() {
  if (
    !currentSong ||
    currentSong.source_type !==
      "youtube"
  ) {
    showToast(
      "Select a YouTube song first."
    );

    return;
  }

  const modal =
    $("videoModal");

  const iframe =
    $("youtubeVideoFrame");

  iframe.src =
    `https://www.youtube.com/embed/${encodeURIComponent(
      currentSong.youtube_video_id
    )}?autoplay=1&playsinline=1&rel=0`;

  $("videoTitle").textContent =
    currentSong.title;

  modal.classList.add(
    "active"
  );
}

window.showYouTubeVideo =
  showYouTubeVideo;

// ============================================================
// Stop YouTube
// ============================================================

function stopYouTube() {
  if (youtubePlayer) {
    try {
      youtubePlayer.stopVideo();
      youtubePlayer.destroy();
    } catch (_) {}

    youtubePlayer = null;
  }

  const container =
    $("youtubeAudioPlayer");

  if (container) {
    container.innerHTML = "";
  }
}

// ============================================================
// Stop MP3
// ============================================================

function stopMP3() {
  const audio =
    $("audio");

  audio.pause();

  audio.removeAttribute(
    "src"
  );

  audio.load();
}

// ============================================================
// Player
// ============================================================

function updatePlayer(song) {
  $("player")
    ?.classList.add("active");

  $("playerTitle").textContent =
    song.title;

  $("playerArtist").textContent =
    song.artist;

  $("playerCover").innerHTML = `
    <img
      src="${escapeHtml(
        song.cover_url ||
        "/images/ganpati.jpg"
      )}"
      alt=""
    >
  `;

  $("youtubeVideoButton")
    ?.classList.toggle(
      "hidden",
      song.source_type !==
        "youtube"
    );
}

// ============================================================
// Play/Pause
// ============================================================

$("playButton")
  ?.addEventListener(
    "click",
    () => {
      if (!currentSong) {
        if (songs.length) {
          playSong(
            songs[0].id
          );
        }

        return;
      }

      if (
        currentSong.source_type ===
        "youtube"
      ) {
        if (!youtubePlayer)
          return;

        const state =
          youtubePlayer.getPlayerState();

        if (
          state ===
          YT.PlayerState.PLAYING
        ) {
          youtubePlayer.pauseVideo();
        } else {
          youtubePlayer.playVideo();
        }

        return;
      }

      const audio =
        $("audio");

      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    }
  );

// ============================================================
// Next / Previous
// ============================================================

function nextSong() {
  if (!songs.length)
    return;

  currentIndex =
    (currentIndex + 1) %
    songs.length;

  playSong(
    songs[currentIndex].id
  );
}

function previousSong() {
  if (!songs.length)
    return;

  currentIndex =
    (currentIndex - 1 +
      songs.length) %
    songs.length;

  playSong(
    songs[currentIndex].id
  );
}

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

// ============================================================
// MP3 progress
// ============================================================

$("audio")
  ?.addEventListener(
    "timeupdate",
    event => {
      const audio =
        event.target;

      if (!audio.duration)
        return;

      $("progress").value =
        (
          audio.currentTime /
          audio.duration
        ) * 100;

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

$("audio")
  ?.addEventListener(
    "play",
    () => {
      $("playButton")
        .textContent =
        "❚❚";
    }
  );

$("audio")
  ?.addEventListener(
    "pause",
    () => {
      $("playButton")
        .textContent =
        "▶";
    }
  );

$("audio")
  ?.addEventListener(
    "ended",
    nextSong
  );

$("progress")
  ?.addEventListener(
    "input",
    event => {
      const audio =
        $("audio");

      if (!audio.duration)
        return;

      audio.currentTime =
        (
          Number(
            event.target.value
          ) / 100
        ) *
        audio.duration;
    }
  );

// ============================================================
// ADMIN
// ============================================================

async function verifyAdmin() {
  const key =
    adminKey();

  if (!key) {
    showToast(
      "Enter Admin Key."
    );

    return false;
  }

  try {
    await api(
      "/api/admin/verify",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-admin-key":
            key
        },

        body: "{}"
      }
    );

    localStorage.setItem(
      "swaraj_admin_key",
      key
    );

    showToast(
      "Admin authentication successful."
    );

    return true;
  } catch (error) {
    showToast(
      error.message
    );

    return false;
  }
}

$("verifyAdmin")
  ?.addEventListener(
    "click",
    verifyAdmin
  );

// ============================================================
// UPLOAD MP3 FILE
// ============================================================

$("uploadMp3")
  ?.addEventListener(
    "click",
    async () => {
      if (
        !(await verifyAdmin())
      ) {
        return;
      }

      const file =
        $("mp3File")
          ?.files?.[0];

      if (!file) {
        showToast(
          "Select an MP3 file."
        );

        return;
      }

      const form =
        new FormData();

      form.append(
        "title",
        $("mp3Title").value
      );

      form.append(
        "artist",
        $("mp3Artist").value
      );

      form.append(
        "album",
        $("mp3Album").value
      );

      form.append(
        "category",
        $("mp3Category").value
      );

      form.append(
        "coverUrl",
        $("mp3Cover").value
      );

      form.append(
        "file",
        file
      );

      try {
        const response =
          await fetch(
            "/api/admin/upload",
            {
              method: "POST",

              headers: {
                "x-admin-key":
                  adminKey()
              },

              body: form
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
            "Upload failed."
          );
        }

        showToast(
          "MP3 stored in PostgreSQL."
        );

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

// ============================================================
// ADD MP3 URL
// ============================================================

$("addMp3Url")
  ?.addEventListener(
    "click",
    async () => {
      if (
        !(await verifyAdmin())
      ) {
        return;
      }

      try {
        await api(
          "/api/admin/mp3-url",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-key":
                adminKey()
            },

            body: JSON.stringify({
              title:
                $("urlTitle").value,

              artist:
                $("urlArtist").value,

              album:
                $("urlAlbum").value,

              category:
                $("urlCategory").value,

              coverUrl:
                $("urlCover").value,

              audioUrl:
                $("mp3Url").value
            })
          }
        );

        showToast(
          "MP3 URL added."
        );

        await loadSongs();
      } catch (error) {
        showToast(
          error.message
        );
      }
    }
  );

// ============================================================
// ADD YOUTUBE
// ============================================================

$("addYouTube")
  ?.addEventListener(
    "click",
    async () => {
      if (
        !(await verifyAdmin())
      ) {
        return;
      }

      try {
        await api(
          "/api/admin/youtube",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-admin-key":
                adminKey()
            },

            body: JSON.stringify({
              title:
                $("youtubeTitle").value,

              artist:
                $("youtubeArtist").value,

              album:
                $("youtubeAlbum").value,

              category:
                $("youtubeCategory").value,

              coverUrl:
                $("youtubeCover").value,

              youtubeUrl:
                $("youtubeUrl").value
            })
          }
        );

        showToast(
          "YouTube song added."
        );

        await loadSongs();
      } catch (error) {
        showToast(
          error.message
        );
      }
    }
  );

// ============================================================
// ADMIN SONG LIST
// ============================================================

function renderAdminSongs(
  list
) {
  const container =
    $("adminSongList");

  if (!container)
    return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty glass">
        No songs in database.
      </div>
    `;

    return;
  }

  container.innerHTML =
    list.map(song => `
      <div class="admin-song glass">

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

          <small>
            ${escapeHtml(
              song.category
            )}
          </small>
        </div>

        <span class="source-pill">
          ${escapeHtml(
            song.source_type
          )}
        </span>

        <button
          class="delete-button"
          onclick="deleteSong('${escapeHtml(
            song.id
          )}')"
        >
          Delete
        </button>

      </div>
    `).join("");
}

async function deleteSong(id) {
  if (
    !confirm(
      "Delete this song permanently?"
    )
  ) {
    return;
  }

  if (
    !(await verifyAdmin())
  ) {
    return;
  }

  try {
    await api(
      `/api/admin/songs/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",

        headers: {
          "x-admin-key":
            adminKey()
        }
      }
    );

    showToast(
      "Song deleted permanently."
    );

    if (
      currentSong &&
      String(
        currentSong.id
      ) === String(id)
    ) {
      stopMP3();
      stopYouTube();
      currentSong = null;
    }

    await loadSongs();
  } catch (error) {
    showToast(
      error.message
    );
  }
}

window.deleteSong =
  deleteSong;

// ============================================================
// UI
// ============================================================

function showPage(page) {
  document
    .querySelectorAll(
      ".page"
    )
    .forEach(element => {
      element.classList.remove(
        "active-page"
      );
    });

  $(`${page}Page`)
    ?.classList.add(
      "active-page"
    );

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

  $("sidebar")
    ?.classList.remove(
      "open"
    );
}

document
  .querySelectorAll(
    ".nav"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        showPage(
          button.dataset.page
        );
      }
    );
  });

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

$("refreshButton")
  ?.addEventListener(
    "click",
    loadSongs
  );

$("showAll")
  ?.addEventListener(
    "click",
    () => {
      $("songHeading")
        .textContent =
        "All Songs";

      renderSongs(songs);
    }
  );

$("playAll")
  ?.addEventListener(
    "click",
    () => {
      if (songs.length) {
        playSong(
          songs[0].id
        );
      }
    }
  );

$("shuffleAll")
  ?.addEventListener(
    "click",
    () => {
      if (!songs.length)
        return;

      const index =
        Math.floor(
          Math.random() *
            songs.length
        );

      playSong(
        songs[index].id
      );
    }
  );

$("closeVideo")
  ?.addEventListener(
    "click",
    () => {
      $("youtubeVideoFrame").src =
        "about:blank";

      $("videoModal")
        .classList.remove(
          "active"
        );
    }
  );

// ============================================================
// Initialization
// ============================================================

const savedAdminKey =
  localStorage.getItem(
    "swaraj_admin_key"
  );

if (
  savedAdminKey &&
  $("adminKey")
) {
  $("adminKey").value =
    savedAdminKey;
}

loadSongs();
loadYouTubeAPI();