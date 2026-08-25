"use strict";

/*
===========================================================
 SwarAJ FRONTEND
 Keeps MP3 + YouTube + Video + Admin in one application.
===========================================================
*/

const state = {
  songs: [],
  queue: [],
  queueIndex: -1,
  current: null,
  playing: false,
  favorites: JSON.parse(
    localStorage.getItem("swaraj-favorites") || "[]"
  ),
  adminKey:
    localStorage.getItem("swaraj-admin-key") || ""
};


const $ = id =>
  document.getElementById(id);


const E = {
  sidebar: $("sidebar"),
  menuBtn: $("menuBtn"),
  menuOverlay: $("menuOverlay"),

  pageTitle: $("pageTitle"),
  pageSubtitle: $("pageSubtitle"),

  searchInput: $("searchInput"),

  homeSongs: $("homeSongs"),
  musicSongs: $("musicSongs"),
  youtubeSongs: $("youtubeSongs"),
  videoSongs: $("videoSongs"),
  librarySongs: $("librarySongs"),
  favoriteSongs: $("favoriteSongs"),

  sideCategories: $("sideCategories"),

  audio: $("audio"),

  playerImage: $("playerImage"),
  playerTitle: $("playerTitle"),
  playerArtist: $("playerArtist"),

  playBtn: $("playBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  stopBtn: $("stopBtn"),

  progress: $("progress"),
  currentTime: $("currentTime"),
  duration: $("duration"),

  videoModal: $("videoModal"),
  videoFrame: $("videoFrame"),
  videoTitle: $("videoTitle"),
  videoArtist: $("videoArtist"),
  closeVideo: $("closeVideo"),

  youtubeForm: $("youtubeForm"),
  mp3Form: $("mp3Form"),
  videoForm: $("videoForm"),

  adminSongs: $("adminSongs"),

  homePlayAll: $("homePlayAll"),
  musicPlayAll
: $("musicPlayAll")
};


/* =========================================================
   API
========================================================= */

async function api(
  url,
  options = {}
) {

  const headers = {
    ...(options.headers || {})
  };

  /*
   * Admin key is sent only for Admin APIs.
   */
  if (
    state.adminKey &&
    options.admin
  ) {
    headers["x-admin-key"] =
      state.adminKey;
  }

  const response =
    await fetch(
      url,
      {
        ...options,
        headers
      }
    );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {

    throw new Error(
      data.error ||
      data.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   SONG NORMALIZATION
========================================================= */

function normalizeSong(song) {

  const source =
    String(
      song.source_type ||
      song.type ||
      song.source ||
      ""
    ).toLowerCase();

  const youtube =
    Boolean(
      song.youtube_id ||
      song.youtube_video_id ||
      song.youtube_url ||
      source.includes("youtube")
    );

  const video =
    Boolean(
      song.video_url ||
      song.videoUrl ||
      source === "video" ||
      source === "uploaded_video"
    );

  return {
    ...song,

    id:
      song.id ??
      song.song_id ??
      crypto.randomUUID(),

    title:
      song.title ||
      song.name ||
      "Untitled",

    artist:
      song.artist ||
      "SwarAJ",

    album:
      song.album ||
      "SwarAJ",

    category:
      song.category ||
      "All Songs",

    language:
      song.language ||
      "",

    cover_url:
      song.cover_url ||
      song.cover ||
      song.image ||
      "",

    audio_url:
      song.audio_url ||
      song.url ||
      song.file_url ||
      song.file ||
      "",

    youtube_url:
      song.youtube_url ||
      song.youtubeUrl ||
      "",

    youtube_id:
      song.youtube_id ||
      song.youtube_video_id ||
      extractYouTubeId(
        song.youtube_url ||
        song.youtubeUrl ||
        ""
      ),

    isYouTube: youtube,

    isVideo:
      video ||
      youtube

  };
}


/* =========================================================
   YOUTUBE
========================================================= */

function extractYouTubeId(url) {

  if (!url) return "";

  const value =
    String(url).trim();

  /*
   * Already an ID.
   */
  if (
    /^[a-zA-Z0-9_-]{11}$/.test(value)
  ) {
    return value;
  }

  const patterns = [

    /[?&]v=([a-zA-Z0-9_-]{11})/,

    /youtu\.be\/([a-zA-Z0-9_-]{11})/,

    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,

    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      value.match(pattern);

    if (match) {
      return match[1];
    }

  }

  return "";
}


function getYouTubeId(song) {

  return (
    song.youtube_id ||
    extractYouTubeId(
      song.youtube_url
    )
  );

}


function isYouTube(song) {

  return Boolean(
    song.isYouTube ||
    getYouTubeId(song)
  );

}


/* =========================================================
   LOAD SONGS
========================================================= */

async function loadSongs() {

  try {

    const data =
      await api(
        "/api/songs"
      );

    const raw =
      Array.isArray(data)
        ? data
        : (
            data.songs ||
            data.data ||
            []
          );

    state.songs =
      raw.map(
        normalizeSong
      );

    renderAll();

    renderCategories();

  } catch (error) {

    console.error(
      "Song loading error:",
      error
    );

    state.songs = [];

    renderAll();

    showToast(
      "Unable to load songs"
    );

  }

}


/* =========================================================
   COVER
========================================================= */

function imageFor(song) {

  if (song.cover_url) {
    return song.cover_url;
  }

  const id =
    getYouTubeId(song);

  if (id) {

    return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

  }

  return "/api/cover/All%20Songs";
}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* =========================================================
   SONG CARD
========================================================= */

function createSongCard(
  song
) {

  const liked =
    state.favorites.includes(
      String(song.id)
    );

  return `
    <article
      class="song-card"
      data-song-id="${escapeHTML(song.id)}"
    >

      <div class="song-cover">

        <img
          src="${escapeHTML(
            imageFor(song)
          )}"
          alt=""
          loading="lazy"
          onerror="
            this.src='/api/cover/All%20Songs'
          "
        >

        <button
          class="song-play"
          type="button"
          aria-label="Play"
        >
          ▶
        </button>

      </div>

      <div class="song-info">

        <h3>
          ${escapeHTML(song.title)}
        </h3>

        <p>
          ${escapeHTML(song.artist)}
        </p>

      </div>

      <button
        class="favorite-action"
        data-favorite-id="${escapeHTML(song.id)}"
        type="button"
        title="Like"
        style="
          background:none;
          border:0;
          color:${liked ? "#ff5578" : "rgba(255,255,255,.4)"};
          padding:5px;
        "
      >
        ${liked ? "♥" : "♡"}
      </button>

    </article>
  `;
}


/* =========================================================
   RENDER SONG GRID
========================================================= */

function renderSongGrid(
  container,
  songs
) {

  if (!container) return;

  if (!songs.length) {

    container.innerHTML = `
      <div class="glass"
           style="
             padding:30px;
             border-radius:20px;
             grid-column:1/-1;
           ">
        <h3>No songs found</h3>
        <p style="color:var(--muted)">
          Add music from the Admin section.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    songs
      .map(createSongCard)
      .join("");

  container
    .querySelectorAll(
      ".song-card"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              ".favorite-action"
            )
          ) {
            return;
          }

          const song =
            state.songs.find(
              item =>
                String(item.id) ===
                String(
                  card.dataset.songId
                )
            );

          if (song) {
            playSong(song);
          }

        }
      );

    });


  container
    .querySelectorAll(
      ".favorite-action"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          toggleFavorite(
            button.dataset.favoriteId
          );

        }
      );

    });

}


/* =========================================================
   VIDEO GRID
========================================================= */

function renderVideoGrid(
  container,
  songs
) {

  if (!container) return;

  if (!songs.length) {

    container.innerHTML = `
      <div class="glass"
           style="
             padding:30px;
             border-radius:20px;
             grid-column:1/-1;
           ">
        <h3>No videos found</h3>
        <p style="color:var(--muted)">
          Add a YouTube URL or upload a video.
        </p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    songs
      .map(song => {

        const yt =
          getYouTubeId(song);

        const thumbnail =
          song.cover_url ||
          (
            yt
              ? `https://i.ytimg.com/vi/${encodeURIComponent(yt)}/hqdefault.jpg`
              : imageFor(song)
          );

        return `
          <article
            class="video-card glass"
            data-video-id="${escapeHTML(song.id)}"
          >

            <div class="video-thumb">

              <img
                src="${escapeHTML(thumbnail)}"
                alt=""
                loading="lazy"
              >

              <div class="video-play">
                ▶
              </div>

            </div>

            <div class="video-info">

              <h3>
                ${escapeHTML(song.title)}
              </h3>

              <p>
                ${escapeHTML(song.artist)}
              </p>

            </div>

          </article>
        `;

      })
      .join("");


  container
    .querySelectorAll(
      "[data-video-id]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        () => {

          const song =
            state.songs.find(
              item =>
                String(item.id) ===
                String(
                  card.dataset.videoId
                )
            );

          if (song) {
            openVideo(song);
          }

        }
      );

    });

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

  const youtubeSongs =
    state.songs.filter(
      isYouTube
    );

  renderSongGrid(
    E.homeSongs,
    state.songs
  );

  /*
   * IMPORTANT:
   * YouTube songs are included in AUDIO.
   */
  renderSongGrid(
    E.musicSongs,
    state.songs
  );

  renderSongGrid(
    E.youtubeSongs,
    youtubeSongs
  );

  /*
   * YouTube videos.
   */
  renderVideoGrid(
    E.videoSongs,
    state.songs.filter(
      song =>
        isYouTube(song) ||
        song.isVideo
    )
  );

  renderSongGrid(
    E.librarySongs,
    state.songs
  );

  renderSongGrid(
    E.favoriteSongs,
    state.songs.filter(
      song =>
        state.favorites.includes(
          String(song.id)
        )
    )
  );

}


/* =========================================================
   CATEGORIES
========================================================= */

function renderCategories() {

  if (!E.sideCategories) {
    return;
  }

  const categories =
    [
      ...new Set(
        state.songs
          .map(
            song =>
              song.category ||
              "All Songs"
          )
      )
    ];

  E.sideCategories.innerHTML =
    categories
      .map(category => `
        <button
          class="category-btn"
          data-category="${escapeHTML(category)}"
          type="button"
        >
          • ${escapeHTML(category)}
        </button>
      `)
      .join("");


  E.sideCategories
    .querySelectorAll(
      ".category-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const category =
            button.dataset.category;

          showView(
            "music"
          );

          const songs =
            category === "All Songs"
              ? state.songs
              : state.songs.filter(
                  song =>
                    String(
                      song.category
                    ).toLowerCase() ===
                    String(
                      category
                    ).toLowerCase()
                );

          renderSongGrid(
            E.musicSongs,
            songs
          );

        }
      );

    });

}


/* =========================================================
   NAVIGATION
========================================================= */

const VIEWS = [
  "home",
  "music",
  "youtube",
  "video",
  "library",
  "favorites",
  "admin"
];


function showView(
  name
) {

  if (!VIEWS.includes(name)) {
    name = "home";
  }


  /*
   * HIDE EVERYTHING FIRST.
   *
   * This fixes the problem where all
   * menu sections appeared underneath Home.
   */
  VIEWS.forEach(view => {

    const element =
      $(`${view}View`);

    if (!element) return;

    element.classList.remove(
      "active"
    );

    element.hidden = true;

  });


  /*
   * SHOW ONLY SELECTED VIEW.
   */
  const target =
    $(`${name}View`);

  if (target) {

    target.hidden = false;

    target.classList.add(
      "active"
    );

  }


  document
    .querySelectorAll(
      ".main-nav .nav"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.view === name
      );

    });


  const titles = {
    home: [
      "Home",
      "Your music, your vibe."
    ],

    music: [
      "Music",
      "Your complete audio collection."
    ],

    youtube: [
      "YouTube",
      "YouTube music in audio mode."
    ],

    video: [
      "Video",
      "Watch your video collection."
    ],

    library: [
      "Library",
      "Everything in your collection."
    ],

    favorites: [
      "Liked Songs",
      "Your favorite music."
    ],

    admin: [
      "Admin",
      "Manage your SwarAJ database."
    ]
  };


  if (E.pageTitle) {
    E.pageTitle.textContent =
      titles[name][0];
  }

  if (E.pageSubtitle) {
    E.pageSubtitle.textContent =
      titles[name][1];
  }


  closeMobileMenu();


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (name === "admin") {
    loadAdminSongs();
  }

}


/* =========================================================
   PLAYER
========================================================= */

function playSong(
  song
) {

  if (!song) return;

  state.current =
    song;

  state.queue =
    state.songs;

  state.queueIndex =
    state.queue.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );


  updatePlayer(
    song
  );


  /*
   * YouTube audio.
   *
   * Browser cannot use a normal
   * <audio> element with a YouTube
   * page URL. Use YouTube embed as
   * audio-mode player.
   */
  if (isYouTube(song)) {

    playYouTubeAudio(
      song
    );

    return;
  }


  /*
   * Normal MP3.
   */
  const url =
    song.audio_url;

  if (!url) {

    showToast(
      "Audio URL not available"
    );

    return;
  }


  E.audio.src =
    url;

  E.audio.load();

  E.audio.play()
    .then(() => {

      state.playing =
        true;

      updatePlayButton();

    })
    .catch(error => {

      console.error(
        error
      );

      showToast(
        "Unable to play this song"
      );

    });

}


/* =========================================================
   YOUTUBE AUDIO MODE
========================================================= */

let youtubeAudioFrame = null;


function playYouTubeAudio(
  song
) {

  const id =
    getYouTubeId(song);

  if (!id) {

    showToast(
      "Invalid YouTube URL"
    );

    return;
  }


  /*
   * Stop local audio.
   */
  E.audio.pause();

  E.audio.removeAttribute(
    "src"
  );


  /*
   * Hidden YouTube player.
   *
   * It plays audio while the
   * Video UI remains hidden.
   */
  let frame =
    document.getElementById(
      "youtubeAudioFrame"
    );

  if (!frame) {

    frame =
      document.createElement(
        "iframe"
      );

    frame.id =
      "youtubeAudioFrame";

    frame.style.position =
      "fixed";

    frame.style.width =
      "1px";

    frame.style.height =
      "1px";

    frame.style.opacity =
      "0.01";

    frame.style.pointerEvents =
      "none";

    frame.style.left =
      "-10px";

    frame.style.bottom =
      "-10px";

    frame.allow =
      "autoplay; encrypted-media";

    frame.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.appendChild(
      frame
    );

  }


  frame.src =
    `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&controls=0&rel=0&playsinline=1`;


  youtubeAudioFrame =
    frame;

  state.playing =
    true;

  updatePlayButton();

}


/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayer(
  song
) {

  E.playerTitle.textContent =
    song.title;

  E.playerArtist.textContent =
    song.artist;

  E.playerImage.src =
    imageFor(song);

}


function updatePlayButton() {

  E.playBtn.textContent =
    state.playing
      ? "Ⅱ"
      : "▶";

}


function stopSong() {

  E.audio.pause();

  E.audio.currentTime =
    0;

  if (youtubeAudioFrame) {

    youtubeAudioFrame.src =
      "about:blank";

  }

  state.playing =
    false;

  updatePlayButton();

}


function nextSong() {

  if (!state.queue.length) {
    return;
  }

  let index =
    state.queueIndex + 1;

  if (
    index >=
    state.queue.length
  ) {
    index = 0;
  }

  playSong(
    state.queue[index]
  );

}


function previousSong() {

  if (!state.queue.length) {
    return;
  }

  let index =
    state.queueIndex - 1;

  if (index < 0) {
    index =
      state.queue.length - 1;
  }

  playSong(
    state.queue[index]
  );

}


function playAll(
  songs = state.songs
) {

  if (!songs.length) {

    showToast(
      "No songs available"
    );

    return;
  }

  state.queue =
    [...songs];

  state.queueIndex =
    0;

  playSong(
    state.queue[0]
  );

}


/* =========================================================
   VIDEO
========================================================= */

function openVideo(
  song
) {

  const id =
    getYouTubeId(song);

  if (!id) {

    /*
     * Uploaded video.
     */
    if (
      song.video_url ||
      song.audio_url
    ) {

      E.videoFrame.innerHTML = `
        <video
          src="${escapeHTML(
            song.video_url ||
            song.audio_url
          )}"
          controls
          autoplay
          playsinline
        ></video>
      `;

    } else {

      showToast(
        "Video URL not available"
      );

      return;
    }

  } else {

    E.videoFrame.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1"
        title="${escapeHTML(song.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;

  }


  E.videoTitle.textContent =
    song.title;

  E.videoArtist.textContent =
    song.artist;


  E.videoModal.hidden =
    false;

}


function closeVideo() {

  E.videoFrame.innerHTML =
    "";

  E.videoModal.hidden =
    true;

}


/* =========================================================
   FAVORITES
========================================================= */

function toggleFavorite(
  id
) {

  id =
    String(id);

  const index =
    state.favorites.indexOf(
      id
    );

  if (index >= 0) {

    state.favorites.splice(
      index,
      1
    );

  } else {

    state.favorites.push(
      id
    );

  }

  localStorage.setItem(
    "swaraj-favorites",
    JSON.stringify(
      state.favorites
    )
  );

  renderAll();

}


/* =========================================================
   SEARCH
========================================================= */

function searchSongs(
  value
) {

  const query =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!query) {

    showView(
      "home"
    );

    return;
  }


  const results =
    state.songs.filter(
      song => {

        const text = [

          song.title,
          song.artist,
          song.album,
          song.category,
          song.language

        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(
          query
        );

      }
    );


  VIEWS.forEach(view => {

    const element =
      $(`${view}View`);

    if (!element) return;

    element.hidden =
      true;

    element.classList.remove(
      "active"
    );

  });


  $("searchView").hidden =
    false;

  $("searchView").classList.add(
    "active"
  );

  $("searchTitle").textContent =
    `${results.length} result${
      results.length === 1
        ? ""
        : "s"
    }`;

  renderSongGrid(
    $("searchSongs"),
    results
  );

}


/* =========================================================
   ADMIN
========================================================= */

async function loadAdminSongs() {

  if (!E.adminSongs) return;

  try {

    const data =
      await api(
        "/api/admin/songs",
        {
          admin: true
        }
      );

    const songs =
      Array.isArray(data)
        ? data
        : (
            data.songs ||
            data.data ||
            []
          );


    E.adminSongs.innerHTML =
      songs
        .map(song => `
          <div
            class="glass"
            style="
              display:flex;
              align-items:center;
              gap:12px;
              padding:12px;
              margin-bottom:8px;
              border-radius:14px;
            "
          >

            <img
              src="${escapeHTML(
                imageFor(
                  normalizeSong(song)
                )
              )}"
              style="
                width:50px;
                height:50px;
                object-fit:cover;
                border-radius:10px;
              "
            >

            <div style="flex:1;min-width:0">

              <strong>
                ${escapeHTML(
                  song.title ||
                  "Untitled"
                )}
              </strong>

              <div style="
                color:var(--muted);
                font-size:11px;
              ">
                ${escapeHTML(
                  song.artist ||
                  "SwarAJ"
                )}
              </div>

            </div>

            <button
              class="delete-song"
              data-id="${escapeHTML(song.id)}"
              type="button"
              style="
                border:0;
                border-radius:10px;
                padding:9px 12px;
                background:rgba(255,70,100,.12);
                color:#ff6685;
              "
            >
              Delete
            </button>

          </div>
        `)
        .join("");


    E.adminSongs
      .querySelectorAll(
        ".delete-song"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                "Delete this song?"
              )
            ) {
              return;
            }

            try {

              await api(
                `/api/admin/songs/${encodeURIComponent(
                  button.dataset.id
                )}`,
                {
                  method: "DELETE",
                  admin: true
                }
              );

              showToast(
                "Song deleted"
              );

              await loadSongs();

              await loadAdminSongs();

            } catch (error) {

              showToast(
                error.message
              );

            }

          }
        );

      });


  } catch (error) {

    console.error(
      error
    );

    E.adminSongs.innerHTML = `
      <div class="glass"
           style="
             padding:20px;
             border-radius:15px;
           ">
        <strong>
          Unable to load Admin songs
        </strong>

        <p style="color:var(--muted)">
          ${escapeHTML(error.message)}
        </p>
      </div>
    `;

  }

}


/* =========================================================
   FORM HELPERS
========================================================= */

async function submitForm(
  form,
  endpoint
) {

  const formData =
    new FormData(form);

  try {

    await api(
      endpoint,
      {
        method: "POST",
        body: formData,
        admin: true
      }
    );

    showToast(
      "Added successfully"
    );

    form.reset();

    await loadSongs();

    await loadAdminSongs();

  } catch (error) {

    console.error(
      error
    );

    showToast(
      error.message
    );

  }

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer;

function showToast(
  message
) {

  const toast =
    $("toast");

  if (!toast) return;

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      3000
    );

}


/* =========================================================
   MOBILE MENU
========================================================= */

function closeMobileMenu() {

  E.sidebar?.classList.remove(
    "open"
  );

  E.menuOverlay?.classList.remove(
    "active"
  );

}


/* =========================================================
   EVENTS
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
     * Menu navigation.
     */
    document
      .querySelectorAll(
        ".main-nav .nav"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          event => {

            event.preventDefault();

            showView(
              button.dataset.view
            );

          }
        );

      });


    /*
     * Buttons that contain
     * data-view.
     */
    document
      .querySelectorAll(
        "[data-view]:not(.nav)"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            showView(
              button.dataset.view
            );

          }
        );

      });


    /*
     * Mobile menu.
     */
    E.menuBtn?.addEventListener(
      "click",
      () => {

        E.sidebar.classList.toggle(
          "open"
        );

        E.menuOverlay.classList.toggle(
          "active"
        );

      }
    );


    E.menuOverlay?.addEventListener(
      "click",
      closeMobileMenu
    );


    /*
     * Search.
     */
    E.searchInput?.addEventListener(
      "input",
      event => {

        searchSongs(
          event.target.value
        );

      }
    );


    /*
     * Player.
     */
    E.playBtn?.addEventListener(
      "click",
      () => {

        if (!state.current) {

          playAll();

          return;
        }


        if (
          isYouTube(
            state.current
          )
        ) {

          if (
            youtubeAudioFrame
          ) {

            const src =
              youtubeAudioFrame.src;

            youtubeAudioFrame.src =
              src;

          }

          state.playing =
            !state.playing;

          updatePlayButton();

          return;
        }


        if (
          E.audio.paused
        ) {

          E.audio.play();

        } else {

          E.audio.pause();

        }

      }
    );


    E.prevBtn?.addEventListener(
      "click",
      previousSong
    );


    E.nextBtn?.addEventListener(
      "click",
      nextSong
    );


    E.stopBtn?.addEventListener(
      "click",
      stopSong
    );


    E.audio?.addEventListener(
      "play",
      () => {

        state.playing =
          true;

        updatePlayButton();

      }
    );


    E.audio?.addEventListener(
      "pause",
      () => {

        state.playing =
          false;

        updatePlayButton();

      }
    );


    E.audio?.addEventListener(
      "ended",
      nextSong
    );


    E.audio?.addEventListener(
      "timeupdate",
      () => {

        if (
          !E.audio.duration
        ) {
          return;
        }

        E.progress.value =
          (
            E.audio.currentTime /
            E.audio.duration
          ) * 100;

        E.currentTime.textContent =
          formatTime(
            E.audio.currentTime
          );

        E.duration.textContent =
          formatTime(
            E.audio.duration
          );

      }
    );


    E.progress?.addEventListener(
      "input",
      () => {

        if (
          !E.audio.duration
        ) {
          return;
        }

        E.audio.currentTime =
          (
            Number(
              E.progress.value
            ) / 100
          ) *
          E.audio.duration;

      }
    );


    /*
     * Play All.
     */
    E.homePlayAll?.addEventListener(
      "click",
      () =>
        playAll(
          state.songs
        )
    );


    E.musicPlayAll?.addEventListener(
      "click",
      () =>
        playAll(
          state.songs
        )
    );


    /*
     * Close video.
     */
    E.closeVideo?.addEventListener(
      "click",
      closeVideo
    );


    E.videoModal?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          E.videoModal
        ) {

          closeVideo();

        }

      }
    );


    /*
     * Admin key.
     *
     * The key is requested only when
     * an Admin API call actually needs it.
     */
    E.youtubeForm?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        if (
          !ensureAdminKey()
        ) {
          return;
        }

        await submitForm(
          E.youtubeForm,
          "/api/admin/songs"
        );

      }
    );


    E.mp3Form?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        if (
          !ensureAdminKey()
        ) {
          return;
        }

        await submitForm(
          E.mp3Form,
          "/api/admin/upload"
        );

      }
    );


    E.videoForm?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        if (
          !ensureAdminKey()
        ) {
          return;
        }

        await submitForm(
          E.videoForm,
          "/api/admin/upload-video"
        );

      }
    );


    /*
     * Initial page.
     */
    showView(
      "home"
    );


    loadSongs();

  }
);


/* =========================================================
   ADMIN KEY
========================================================= */

function ensureAdminKey() {

  if (state.adminKey) {
    return true;
  }


  const key =
    window.prompt(
      "Enter SwarAJ Admin Key"
    );


  if (!key) {

    showToast(
      "Admin key required"
    );

    return false;
  }


  state.adminKey =
    key;

  localStorage.setItem(
    "swaraj-admin-key",
    key
  );

  return true;

}


/* =========================================================
   TIME
========================================================= */

function formatTime(
  seconds
) {

  if (
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