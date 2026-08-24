/* =========================================================
   SwarAJ Music - Unified MP3 + YouTube Player
========================================================= */

const state = {

    songs: [],

    queue: [],

    index: -1,

    shuffle: false,

    repeat: false,

    playing: false,

    currentType: null,

    youtubePlayer: null,

    youtubeReady: false,

    youtubePendingSong: null,

    liked: JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
    ),

    adminKey:
        sessionStorage.getItem(
            "swaraj-admin-key"
        ) || ""

};


const audio =
    document.getElementById("audio");


audio.volume = 1;


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupAudio();

        setupSearch();

        setupVolume();

        await loadSongs();

        await loadCategories();

        renderLiked();

        updateStats();

        setupYouTube();

        if (state.adminKey) {

            showAdminPanel();

        }

    }
);


/* =========================================================
   API
========================================================= */

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(
            url,
            {
                cache: "no-store",
                ...options
            }
        );

    let data = {};

    try {

        data =
            await response.json();

    } catch {

        data = {};

    }

    if (!response.ok) {

        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${response.status})`
        );

    }

    return data;

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

        state.songs =
            Array.isArray(data.songs)
                ? data.songs.map(
                    normalizeSong
                )
                : [];

        renderHomeSongs();

        renderAllSongs();

        renderLibrary();

        updateStats();

        setConnection(
            true
        );

    } catch (error) {

        console.error(
            "Song loading error:",
            error
        );

        setConnection(
            false
        );

        showError(
            "homeSongs",
            error.message
        );

        showError(
            "allSongs",
            error.message
        );

    }

}


/* =========================================================
   NORMALIZE SONG
========================================================= */

function normalizeSong(song) {

    const source =
        String(
            song.source_type ||
            song.source ||
            ""
        ).toLowerCase();

    let type =
        source;

    if (
        source === "youtube" ||
        song.youtube_video_id ||
        song.youtube_url
    ) {

        type =
            "youtube";

    } else {

        type =
            "mp3_file";

    }


    let youtubeId =
        song.youtube_video_id ||
        extractYouTubeId(
            song.youtube_url
        );


    let audioUrl =
        song.audio_url ||
        song.url ||
        null;


    if (
        type === "mp3_file" &&
        song.id
    ) {

        audioUrl =
            `/api/songs/${song.id}/audio`;

    }


    return {

        ...song,

        id:
            Number(song.id),

        title:
            song.title ||
            "Untitled",

        artist:
            song.artist ||
            "SwarAJ",

        album:
            song.album ||
            "Singles",

        category:
            song.category ||
            "Other",

        cover_url:
            song.cover_url ||
            song.coverUrl ||
            "/images/ganpati.jpg",

        source_type:
            type,

        audio_url:
            audioUrl,

        youtube_video_id:
            youtubeId || null

    };

}


/* =========================================================
   CONNECTION
========================================================= */

function setConnection(
    online
) {

    const dot =
        document.getElementById(
            "connectionDot"
        );

    const text =
        document.getElementById(
            "connectionText"
        );

    if (!dot) return;

    dot.classList.remove(
        "online",
        "offline"
    );

    dot.classList.add(
        online
            ? "online"
            : "offline"
    );

    if (text) {

        text.textContent =
            online
                ? "Database connected"
                : "Connection error";

    }

}


/* =========================================================
   CATEGORIES
========================================================= */

async function loadCategories() {

    try {

        const data =
            await api(
                "/api/categories"
            );

        const categories =
            Array.isArray(
                data.categories
            )
                ? data.categories
                : [];

        renderCategories(
            "homeCategories",
            categories
        );

        renderCategories(
            "categoriesGrid",
            categories
        );

        document.getElementById(
            "heroCategoryCount"
        ).textContent =
            categories.length;

    } catch (error) {

        console.error(
            error
        );

        showError(
            "homeCategories",
            error.message
        );

        showError(
            "categoriesGrid",
            error.message
        );

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

function showSection(
    name
) {

    const ids = {

        home:
            "homeSection",

        songs:
            "songsSection",

        categories:
            "categoriesSection",

        library:
            "librarySection",

        liked:
            "likedSection",

        queue:
            "queueSection",

        admin:
            "adminSection"

    };


    document
        .querySelectorAll(
            ".section"
        )
        .forEach(
            section =>
                section.classList.remove(
                    "active"
                )
        );


    const target =
        document.getElementById(
            ids[name] ||
            ids.home
        );


    if (target) {

        target.classList.add(
            "active"
        );

    }


    document
        .querySelectorAll(
            ".nav"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                    name
                );

            }
        );


    if (
        name ===
        "queue"
    ) {

        renderQueue();

    }


    if (
        name ===
        "liked"
    ) {

        renderLiked();

    }


    if (
        name ===
        "admin" &&
        state.adminKey
    ) {

        showAdminPanel();

    }


    window.scrollTo(
        {
            top: 0,
            behavior: "smooth"
        }
    );


    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (
        window.innerWidth < 900
    ) {

        sidebar.classList.remove(
            "open"
        );

    }

}


/* =========================================================
   ADMIN NAV
========================================================= */

function showAdmin() {

    showSection(
        "admin"
    );


    const login =
        document.getElementById(
            "adminLoginBox"
        );

    const panel =
        document.getElementById(
            "adminPanel"
        );


    if (
        state.adminKey
    ) {

        if (login)
            login.hidden = true;

        if (panel)
            panel.hidden = false;

        loadAdminSongs();

    } else {

        if (login)
            login.hidden = false;

        if (panel)
            panel.hidden = true;

    }

}


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    document
        .getElementById(
            "sidebar"
        )
        .classList.toggle(
            "open"
        );

}


/* =========================================================
   SONG HTML
========================================================= */

function songHTML(
    song,
    listIndex = null
) {

    const liked =
        state.liked.includes(
            Number(song.id)
        );


    const current =
        currentSong();


    const isCurrent =
        current &&
        Number(current.id) ===
        Number(song.id);


    const type =
        song.source_type ===
        "youtube"
            ? "YouTube"
            : "MP3";


    let playCode;


    if (
        listIndex !== null
    ) {

        playCode =
            `playFromList(${listIndex})`;

    } else {

        playCode =
            `playSong(${song.id})`;

    }


    return `

        <article
            class="song-card ${isCurrent ? "current" : ""}"
            data-song-id="${song.id}"
        >

            <img
                class="song-cover"
                src="${escapeAttribute(
                    song.cover_url
                )}"
                alt=""
                onerror="this.src='/images/ganpati.jpg'"
            >

            <div class="song-info">

                <b>
                    ${escapeHTML(
                        song.title
                    )}
                </b>

                <small>
                    ${escapeHTML(
                        song.artist
                    )}
                </small>

                <div class="song-tags">

                    <span>
                        ${escapeHTML(
                            song.category
                        )}
                    </span>

                    <span>
                        ${type}
                    </span>

                </div>

            </div>

            <div class="song-actions">

                <button
                    title="Play"
                    onclick="
                        event.stopPropagation();
                        ${playCode}
                    "
                >
                    ▶
                </button>

                <button
                    title="Like"
                    onclick="
                        event.stopPropagation();
                        toggleLike(${song.id})
                    "
                >
                    ${liked ? "♥" : "♡"}
                </button>

            </div>

        </article>

    `;

}


/* =========================================================
   RENDER SONG LIST
========================================================= */

function renderSongList(
    containerId,
    songs
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container)
        return;


    if (!songs.length) {

        container.innerHTML =
            `
                <div class="empty">
                    No songs found.
                </div>
            `;

        return;

    }


    container.innerHTML =
        songs
            .map(
                song =>
                    songHTML(song)
            )
            .join("");

}


/* =========================================================
   HOME
========================================================= */

function renderHomeSongs() {

    const container =
        document.getElementById(
            "homeSongs"
        );


    if (!container)
        return;


    const songs =
        state.songs.slice(
            0,
            8
        );


    container.innerHTML =
        songs.length
            ? songs
                .map(
                    song =>
                        songHTML(song)
                )
                .join("")
            :
                `
                    <div class="empty">
                        No songs found.
                    </div>
                `;


    const count =
        document.getElementById(
            "homeCount"
        );


    if (count) {

        count.textContent =
            `${state.songs.length} songs available`;

    }


    const heroCount =
        document.getElementById(
            "heroSongCount"
        );


    if (heroCount) {

        heroCount.textContent =
            state.songs.length;

    }

}


/* =========================================================
   ALL SONGS
========================================================= */

function renderAllSongs() {

    const container =
        document.getElementById(
            "allSongs"
        );


    if (!container)
        return;


    if (!state.songs.length) {

        container.innerHTML =
            `
                <div class="empty">
                    No songs found.
                </div>
            `;

        return;

    }


    container.innerHTML =
        state.songs
            .map(
                (
                    song,
                    index
                ) =>
                    songHTML(
                        song,
                        index
                    )
            )
            .join("");

}


/* =========================================================
   LIBRARY
========================================================= */

function renderLibrary() {

    renderSongList(
        "librarySongs",
        state.songs
    );

}


/* =========================================================
   CATEGORIES
========================================================= */

function renderCategories(
    containerId,
    categories
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container)
        return;


    if (!categories.length) {

        container.innerHTML =
            `
                <div class="empty">
                    No categories found.
                </div>
            `;

        return;

    }


    container.innerHTML =
        categories
            .map(
                category => {

                    const name =
                        category.name ||
                        category.category ||
                        "Other";

                    const count =
                        Number(
                            category.count ||
                            0
                        );


                    return `

                        <button
                            class="category-card"
                            onclick="openCategory(${JSON.stringify(name)})"
                        >

                            <div class="category-icon">
                                ♫
                            </div>

                            <b>
                                ${escapeHTML(
                                    name
                                )}
                            </b>

                            <small>
                                ${count}
                                song${count === 1 ? "" : "s"}
                            </small>

                        </button>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   OPEN CATEGORY
========================================================= */

async function openCategory(
    category
) {

    try {

        const data =
            await api(
                `/api/categories/${encodeURIComponent(
                    category
                )}`
            );


        const songs =
            Array.isArray(
                data.songs
            )
                ? data.songs.map(
                    normalizeSong
                )
                : [];


        document.getElementById(
            "categoryView"
        ).hidden = false;


        document.getElementById(
            "categoryTitle"
        ).textContent =
            category;


        document.getElementById(
            "categoryCount"
        ).textContent =
            `${songs.length} songs`;


        renderSongList(
            "categorySongs",
            songs
        );


    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }

}


function closeCategory() {

    document.getElementById(
        "categoryView"
    ).hidden = true;

}


/* =========================================================
   PLAY ALL
========================================================= */

async function playAll() {

    if (!state.songs.length) {

        await loadSongs();

    }


    if (!state.songs.length) {

        showToast(
            "No songs available",
            "error"
        );

        return;

    }


    state.queue =
        state.shuffle
            ? shuffleArray(
                [...state.songs]
            )
            : [...state.songs];


    state.index = 0;


    renderQueue();


    await playCurrent();

}


/* =========================================================
   PLAY SONG
========================================================= */

async function playSong(
    id
) {

    const song =
        state.songs.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (!song)
        return;


    state.queue =
        state.songs.slice();


    if (
        state.shuffle
    ) {

        state.queue =
            shuffleArray(
                state.queue
            );

    }


    state.index =
        state.queue.findIndex(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (
        state.index < 0
    ) {

        state.index = 0;

    }


    await playCurrent();

}


/* =========================================================
   PLAY FROM LIST
========================================================= */

async function playFromList(
    index
) {

    state.queue =
        state.songs.slice();


    state.index =
        Number(index);


    await playCurrent();

}


/* =========================================================
   CURRENT
========================================================= */

function currentSong() {

    return (
        state.queue[
            state.index
        ] || null
    );

}


/* =========================================================
   PLAY CURRENT
========================================================= */

async function playCurrent() {

    const song =
        currentSong();


    if (!song)
        return;


    updatePlayer(
        song
    );


    stopPlayback();


    if (
        song.source_type ===
            "youtube" ||
        song.youtube_video_id
    ) {

        playYouTube(
            song
        );

    } else {

        playMP3(
            song
        );

    }


    renderQueue();

    renderAllSongs();

}


/* =========================================================
   STOP
========================================================= */

function stopPlayback() {

    state.playing = false;


    try {

        audio.pause();

    } catch {}


    audio.removeAttribute(
        "src"
    );

    audio.load();


    stopYouTube();

    hideYouTube();


    updatePlayButton();

}


/* =========================================================
   MP3 PLAY
========================================================= */

function playMP3(
    song
) {

    if (!song.audio_url) {

        showToast(
            "MP3 URL is missing",
            "error"
        );

        setTimeout(
            playNext,
            300
        );

        return;

    }


    state.currentType =
        "mp3";


    audio.src =
        song.audio_url;


    audio.load();


    const promise =
        audio.play();


    if (
        promise &&
        typeof promise.then ===
        "function"
    ) {

        promise
            .then(
                () => {

                    state.playing =
                        true;

                    updatePlayButton();

                }
            )
            .catch(
                error => {

                    console.error(
                        "MP3 playback:",
                        error
                    );

                    showToast(
                        "MP3 could not be played",
                        "error"
                    );

                }
            );

    }

}


/* =========================================================
   AUDIO EVENTS
========================================================= */

function setupAudio() {

    audio.addEventListener(
        "loadedmetadata",
        () => {

            updateDuration();

        }
    );


    audio.addEventListener(
        "timeupdate",
        () => {

            updateProgress();

        }
    );


    audio.addEventListener(
        "play",
        () => {

            state.playing =
                true;

            updatePlayButton();

        }
    );


    audio.addEventListener(
        "pause",
        () => {

            if (
                state.currentType ===
                "mp3"
            ) {

                state.playing =
                    false;

                updatePlayButton();

            }

        }
    );


    audio.addEventListener(
        "ended",
        () => {

            state.playing =
                false;

            playNext();

        }
    );


    audio.addEventListener(
        "error",
        () => {

            if (
                state.currentType ===
                "mp3"
            ) {

                showToast(
                    "MP3 playback error",
                    "error"
                );

            }

        }
    );


    const progress =
        document.getElementById(
            "progress"
        );


    progress.addEventListener(
        "input",
        () => {

            if (
                !audio.duration
            )
                return;


            audio.currentTime =
                (
                    Number(
                        progress.value
                    ) / 100
                ) *
                audio.duration;

        }
    );

}


/* =========================================================
   NEXT
========================================================= */

async function playNext() {

    if (!state.queue.length)
        return;


    if (
        state.index <
        state.queue.length - 1
    ) {

        state.index++;

        await playCurrent();

        return;

    }


    if (state.repeat) {

        state.index = 0;

        await playCurrent();

        return;

    }


    state.playing =
        false;

    updatePlayButton();


    showToast(
        "Playlist finished",
        "success"
    );

}


/* =========================================================
   PREVIOUS
========================================================= */

async function playPrevious() {

    if (!state.queue.length)
        return;


    if (
        state.currentType ===
            "mp3" &&
        audio.currentTime >
            5
    ) {

        audio.currentTime = 0;

        return;

    }


    if (
        state.index > 0
    ) {

        state.index--;

        await playCurrent();

        return;

    }


    if (state.repeat) {

        state.index =
            state.queue.length -
            1;

        await playCurrent();

        return;

    }


    audio.currentTime = 0;

}


/* =========================================================
   TOGGLE PLAY
========================================================= */

function togglePlay() {

    const song =
        currentSong();


    if (!song) {

        playAll();

        return;

    }


    if (
        song.source_type ===
        "youtube"
    ) {

        toggleYouTubePlay();

        return;

    }


    if (
        audio.paused
    ) {

        audio.play()
            .then(
                () => {

                    state.playing =
                        true;

                    updatePlayButton();

                }
            )
            .catch(
                error =>
                    console.error(
                        error
                    )
            );

    } else {

        audio.pause();

    }

}


/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayer(
    song
) {

    document.getElementById(
        "playerTitle"
    ).textContent =
        song.title;


    document.getElementById(
        "playerArtist"
    ).textContent =
        song.artist;


    document.getElementById(
        "playerCover"
    ).src =
        song.cover_url ||
        "/images/ganpati.jpg";


    document.getElementById(
        "playerSource"
    ).textContent =
        song.source_type ===
        "youtube"
            ? "YouTube"
            : "MP3";


    const like =
        document.getElementById(
            "likeCurrent"
        );


    like.textContent =
        state.liked.includes(
            Number(song.id)
        )
            ? "♥"
            : "♡";


    document.getElementById(
        "currentTime"
    ).textContent =
        "0:00";


    document.getElementById(
        "duration"
    ).textContent =
        song.source_type ===
        "youtube"
            ? "LIVE"
            : "0:00";


    document.getElementById(
        "progress"
    ).value = 0;

}


/* =========================================================
   PLAY BUTTON
========================================================= */

function updatePlayButton() {

    const button =
        document.getElementById(
            "playBtn"
        );


    if (!button)
        return;


    button.textContent =
        state.playing
            ? "❚❚"
            : "▶";

}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress() {

    if (
        !audio.duration
    )
        return;


    const percent =
        (
            audio.currentTime /
            audio.duration
        ) * 100;


    document.getElementById(
        "progress"
    ).value =
        percent || 0;


    document.getElementById(
        "currentTime"
    ).textContent =
        formatTime(
            audio.currentTime
        );


    document.getElementById(
        "duration"
    ).textContent =
        formatTime(
            audio.duration
        );

}


function updateDuration() {

    if (
        audio.duration &&
        Number.isFinite(
            audio.duration
        )
    ) {

        document.getElementById(
            "duration"
        ).textContent =
            formatTime(
                audio.duration
            );

    }

}


function formatTime(
    seconds
) {

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


    const remaining =
        Math.floor(
            seconds % 60
        );


    return `${minutes}:${String(
        remaining
    ).padStart(2,"0")}`;

}


/* =========================================================
   YOUTUBE API
========================================================= */

function setupYouTube() {

    window.onYouTubeIframeAPIReady =
        function () {

            state.youtubeReady =
                true;

            if (
                state.youtubePendingSong
            ) {

                const song =
                    state.youtubePendingSong;

                state.youtubePendingSong =
                    null;

                playYouTube(
                    song
                );

            }

        };

}


/* =========================================================
   YOUTUBE PLAY
========================================================= */

function playYouTube(
    song
) {

    const id =
        song.youtube_video_id ||
        extractYouTubeId(
            song.youtube_url
        );


    if (!id) {

        showToast(
            "Invalid YouTube video",
            "error"
        );

        setTimeout(
            playNext,
            400
        );

        return;

    }


    state.currentType =
        "youtube";


    showYouTube();


    if (
        !window.YT ||
        !window.YT.Player
    ) {

        state.youtubePendingSong =
            song;

        loadYouTubeAPI();

        return;

    }


    if (
        state.youtubePlayer
    ) {

        try {

            state.youtubePlayer.loadVideoById(
                id
            );

            return;

        } catch (
            error
        ) {

            console.error(
                error
            );

        }

    }


    createYouTubePlayer(
        id
    );

}


/* =========================================================
   LOAD YOUTUBE API
========================================================= */

function loadYouTubeAPI() {

    if (
        document.querySelector(
            "script[data-youtube-api]"
        )
    )
        return;


    const script =
        document.createElement(
            "script"
        );


    script.src =
        "https://www.youtube.com/iframe_api";


    script.dataset.youtubeApi =
        "true";


    document.head.appendChild(
        script
    );

}


/* =========================================================
   CREATE YOUTUBE PLAYER
========================================================= */

function createYouTubePlayer(
    videoId
) {

    const container =
        document.getElementById(
            "youtubePlayer"
        );


    container.innerHTML =
        "";


    const iframe =
        document.createElement(
            "div"
        );


    iframe.id =
        "yt-frame";


    container.appendChild(
        iframe
    );


    state.youtubePlayer =
        new YT.Player(
            "yt-frame",
            {

                width: "100%",

                height: "100%",

                videoId,

                playerVars: {

                    autoplay: 1,

                    controls: 1,

                    rel: 0,

                    modestbranding: 1,

                    playsinline: 1

                },

                events: {

                    onReady:
                        onYouTubeReady,

                    onStateChange:
                        onYouTubeStateChange,

                    onError:
                        onYouTubeError

                }

            }
        );

}


/* =========================================================
   YOUTUBE READY
========================================================= */

function onYouTubeReady(
    event
) {

    try {

        event.target.playVideo();

    } catch {}

}


/* =========================================================
   YOUTUBE STATE
========================================================= */

function onYouTubeStateChange(
    event
) {

    if (
        event.data ===
        YT.PlayerState.PLAYING
    ) {

        state.playing =
            true;

        updatePlayButton();

        startYouTubeProgress();

    }


    if (
        event.data ===
        YT.PlayerState.PAUSED
    ) {

        state.playing =
            false;

        updatePlayButton();

    }


    if (
        event.data ===
        YT.PlayerState.ENDED
    ) {

        state.playing =
            false;

        playNext();

    }

}


/* =========================================================
   YOUTUBE ERROR
========================================================= */

function onYouTubeError(
    event
) {

    console.error(
        "YouTube error:",
        event.data
    );


    showToast(
        "YouTube song unavailable. Moving to next song.",
        "error"
    );


    state.playing =
        false;


    setTimeout(
        playNext,
        700
    );

}


/* =========================================================
   YOUTUBE CONTROLS
========================================================= */

function toggleYouTubePlay() {

    if (
        !state.youtubePlayer
    ) {

        return;

    }


    const status =
        state.youtubePlayer.getPlayerState();


    if (
        status ===
        YT.PlayerState.PLAYING
    ) {

        state.youtubePlayer.pauseVideo();

    } else {

        state.youtubePlayer.playVideo();

    }

}


/* =========================================================
   STOP YOUTUBE
========================================================= */

function stopYouTube() {

    if (
        state.youtubePlayer
    ) {

        try {

            state.youtubePlayer.stopVideo();

        } catch {}

    }

}


/* =========================================================
   YOUTUBE PROGRESS
========================================================= */

function startYouTubeProgress() {

    setTimeout(
        function tick() {

            if (
                state.currentType !==
                "youtube" ||
                !state.youtubePlayer
            ) {

                return;

            }


            try {

                const current =
                    state.youtubePlayer
                        .getCurrentTime();


                const duration =
                    state.youtubePlayer
                        .getDuration();


                if (
                    duration > 0
                ) {

                    document.getElementById(
                        "progress"
                    ).value =
                        (
                            current /
                            duration
                        ) * 100;


                    document.getElementById(
                        "currentTime"
                    ).textContent =
                        formatTime(
                            current
                        );


                    document.getElementById(
                        "duration"
                    ).textContent =
                        formatTime(
                            duration
                        );

                }

            } catch {}


            setTimeout(
                tick,
                500
            );

        },
        300
    );

}


/* =========================================================
   SHOW / HIDE YOUTUBE
========================================================= */

function showYouTube() {

    const element =
        document.getElementById(
            "youtubeContainer"
        );


    if (element) {

        element.hidden =
            false;

    }

}


function hideYouTube() {

    const element =
        document.getElementById(
            "youtubeContainer"
        );


    if (element) {

        element.hidden =
            true;

    }

}


/* =========================================================
   SHUFFLE
========================================================= */

function toggleShuffle() {

    state.shuffle =
        !state.shuffle;


    const button =
        document.getElementById(
            "shuffleBtn"
        );


    button.classList.toggle(
        "active",
        state.shuffle
    );


    showToast(
        state.shuffle
            ? "Shuffle ON"
            : "Shuffle OFF",
        "success"
    );


    if (
        state.queue.length
    ) {

        const current =
            currentSong();


        let newQueue =
            state.shuffle
                ? shuffleArray(
                    [...state.queue]
                )
                : state.songs.slice();


        if (current) {

            const newIndex =
                newQueue.findIndex(
                    song =>
                        Number(
                            song.id
                        ) ===
                        Number(
                            current.id
                        )
                );


            if (
                newIndex >= 0
            ) {

                state.queue =
                    newQueue;

                state.index =
                    newIndex;

            }

        }

    }


    renderQueue();

}


/* =========================================================
   REPEAT
========================================================= */

function toggleRepeat() {

    state.repeat =
        !state.repeat;


    document.getElementById(
        "repeatBtn"
    ).classList.toggle(
        "active",
        state.repeat
    );


    showToast(
        state.repeat
            ? "Repeat ON"
            : "Repeat OFF",
        "success"
    );

}


/* =========================================================
   QUEUE
========================================================= */

function renderQueue() {

    const container =
        document.getElementById(
            "queueList"
        );


    if (!container)
        return;


    if (
        !state.queue.length
    ) {

        container.innerHTML =
            `
                <div class="empty">
                    Queue is empty.
                    <br><br>
                    Press Play All to start
                    the entire database.
                </div>
            `;

        return;

    }


    container.innerHTML =
        state.queue
            .map(
                (
                    song,
                    index
                ) =>
                    songHTML(
                        song,
                        index
                    )
            )
            .join("");

}


function clearQueue() {

    state.queue = [];

    state.index = -1;

    stopPlayback();

    updatePlayer(
        {
            title:
                "Nothing playing",

            artist:
                "SwarAJ",

            cover_url:
                "/images/ganpati.jpg",

            source_type:
                "mp3_file"
        }
    );

    renderQueue();

}


/* =========================================================
   LIKE
========================================================= */

function toggleLike(
    id
) {

    id =
        Number(id);


    if (
        state.liked.includes(id)
    ) {

        state.liked =
            state.liked.filter(
                item =>
                    Number(item) !==
                    id
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


    renderAllSongs();

    renderHomeSongs();

    renderLibrary();

    renderLiked();

    updateStats();

}


/* =========================================================
   CURRENT LIKE
========================================================= */

function toggleCurrentLike() {

    const song =
        currentSong();


    if (!song)
        return;


    toggleLike(
        song.id
    );

}


/* =========================================================
   LIKED
========================================================= */

function renderLiked() {

    const songs =
        state.songs.filter(
            song =>
                state.liked.includes(
                    Number(song.id)
                )
        );


    renderSongList(
        "likedSongs",
        songs
    );

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    const songs =
        document.getElementById(
            "statSongs"
        );

    const cats =
        document.getElementById(
            "statCats"
        );

    const liked =
        document.getElementById(
            "statLiked"
        );


    if (songs)
        songs.textContent =
            state.songs.length;


    const categories =
        [
            ...new Set(
                state.songs.map(
                    song =>
                        song.category
                )
            )
        ];


    if (cats)
        cats.textContent =
            categories.length;


    if (liked)
        liked.textContent =
            state.liked.length;


    const hero =
        document.getElementById(
            "heroCategoryCount"
        );


    if (hero)
        hero.textContent =
            categories.length;

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    if (!input)
        return;


    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .trim()
                    .toLowerCase();


            document.getElementById(
                "clearSearch"
            ).hidden =
                !query;


            if (!query) {

                renderAllSongs();

                return;

            }


            const results =
                state.songs.filter(
                    song =>
                        [
                            song.title,
                            song.artist,
                            song.album,
                            song.category
                        ]
                            .join(" ")
                            .toLowerCase()
                            .includes(
                                query
                            )
                );


            showSection(
                "songs"
            );


            renderSongList(
                "allSongs",
                results
            );

        }
    );

}


function clearSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    input.value = "";


    document.getElementById(
        "clearSearch"
    ).hidden = true;


    renderAllSongs();

}


/* =========================================================
   VOLUME
========================================================= */

function setupVolume() {

    const volume =
        document.getElementById(
            "volume"
        );


    volume.addEventListener(
        "input",
        () => {

            audio.volume =
                Number(
                    volume.value
                );

        }
    );

}


function toggleMute() {

    audio.muted =
        !audio.muted;


    document.getElementById(
        "muteBtn"
    ).textContent =
        audio.muted
            ? "🔇"
            : "🔊";

}


/* =========================================================
   ADMIN LOGIN
========================================================= */

async function adminLogin(
    event
) {

    event.preventDefault();


    const input =
        document.getElementById(
            "adminKeyInput"
        );


    const key =
        input.value.trim();


    if (!key)
        return;


    const message =
        document.getElementById(
            "adminMessage"
        );


    message.className =
        "message";


    message.textContent =
        "Checking admin key...";


    try {

        await api(
            "/api/admin/songs",
            {
                headers: {
                    "X-Admin-Key":
                        key
                }
            }
        );


        state.adminKey =
            key;


        sessionStorage.setItem(
            "swaraj-admin-key",
            key
        );


        showAdminPanel();


        showToast(
            "Admin login successful",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        message.className =
            "message error";


        message.textContent =
            "Invalid admin key.";

    }

}


/* =========================================================
   ADMIN PANEL
========================================================= */

function showAdminPanel() {

    document.getElementById(
        "adminLoginBox"
    ).hidden = true;


    document.getElementById(
        "adminPanel"
    ).hidden = false;


    loadAdminSongs();

}


/* =========================================================
   ADMIN LOGOUT
========================================================= */

function adminLogout() {

    state.adminKey =
        "";


    sessionStorage.removeItem(
        "swaraj-admin-key"
    );


    document.getElementById(
        "adminLoginBox"
    ).hidden = false;


    document.getElementById(
        "adminPanel"
    ).hidden = true;


    document.getElementById(
        "adminKeyInput"
    ).value = "";


    showToast(
        "Logged out",
        "success"
    );

}


/* =========================================================
   PASSWORD
========================================================= */

function togglePassword() {

    const input =
        document.getElementById(
            "adminKeyInput"
        );


    input.type =
        input.type ===
        "password"
            ? "text"
            : "password";

}


/* =========================================================
   ADMIN SONGS
========================================================= */

async function loadAdminSongs() {

    if (
        !state.adminKey
    )
        return;


    const container =
        document.getElementById(
            "adminSongs"
        );


    try {

        const data =
            await api(
                "/api/admin/songs",
                {
                    headers: {
                        "X-Admin-Key":
                            state.adminKey
                    }
                }
            );


        const songs =
            Array.isArray(
                data.songs
            )
                ? data.songs.map(
                    normalizeSong
                )
                : [];


        if (!songs.length) {

            container.innerHTML =
                `
                    <div class="empty">
                        No songs in database.
                    </div>
                `;

            return;

        }


        container.innerHTML =
            songs
                .map(
                    song =>
                        adminSongHTML(
                            song
                        )
                )
                .join("");


    } catch (error) {

        console.error(
            error
        );


        container.innerHTML =
            `
                <div class="empty">
                    ${escapeHTML(
                        error.message
                    )}
                </div>
            `;

    }

}


/* =========================================================
   ADMIN SONG CARD
========================================================= */

function adminSongHTML(
    song
) {

    return `

        <article
            class="song-card"
        >

            <img
                class="song-cover"
                src="${escapeAttribute(
                    song.cover_url
                )}"
                alt=""
                onerror="this.src='/images/ganpati.jpg'"
            >

            <div class="song-info">

                <b>
                    ${escapeHTML(
                        song.title
                    )}
                </b>

                <small>
                    ${escapeHTML(
                        song.artist
                    )}
                </small>

                <div class="song-tags">

                    <span>
                        ${song.source_type === "youtube"
                            ? "YouTube"
                            : "MP3"}
                    </span>

                    <span>
                        ID ${song.id}
                    </span>

                </div>

            </div>

            <div class="song-actions">

                <button
                    title="Play"
                    onclick="
                        playSong(${song.id})
                    "
                >
                    ▶
                </button>

                <button
                    title="Delete"
                    onclick="
                        deleteSong(${song.id})
                    "
                >
                    🗑
                </button>

            </div>

        </article>

    `;

}


/* =========================================================
   UPLOAD MP3
========================================================= */

async function uploadMP3(
    event
) {

    event.preventDefault();


    if (
        !state.adminKey
    ) {

        showToast(
            "Please login as admin first",
            "error"
        );

        return;

    }


    const form =
        document.getElementById(
            "uploadForm"
        );


    const message =
        document.getElementById(
            "uploadMessage"
        );


    const formData =
        new FormData(
            form
        );


    message.className =
        "message";


    message.textContent =
        "Uploading MP3...";


    try {

        const response =
            await fetch(
                "/api/admin/upload",
                {
                    method:
                        "POST",

                    headers: {
                        "X-Admin-Key":
                            state.adminKey
                    },

                    body:
                        formData
                }
            );


        let data = {};


        try {

            data =
                await response.json();

        } catch {}


        if (
            !response.ok
        ) {

            throw new Error(
                data.error ||
                data.message ||
                `Upload failed (${response.status})`
            );

        }


        message.className =
            "message success";


        message.textContent =
            "MP3 uploaded successfully.";


        form.reset();


        await loadSongs();

        await loadCategories();

        await loadAdminSongs();


        showToast(
            "MP3 uploaded successfully",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        message.className =
            "message error";


        message.textContent =
            error.message;

    }

}


/* =========================================================
   DELETE
========================================================= */

async function deleteSong(
    id
) {

    if (
        !state.adminKey
    )
        return;


    const song =
        state.songs.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    const name =
        song
            ? song.title
            : `song ${id}`;


    if (
        !confirm(
            `Delete "${name}"?`
        )
    ) {

        return;

    }


    try {

        await api(
            `/api/admin/songs/${id}`,
            {
                method:
                    "DELETE",

                headers: {
                    "X-Admin-Key":
                        state.adminKey
                }
            }
        );


        state.songs =
            state.songs.filter(
                song =>
                    Number(song.id) !==
                    Number(id)
            );


        state.queue =
            state.queue.filter(
                song =>
                    Number(song.id) !==
                    Number(id)
            );


        renderHomeSongs();

        renderAllSongs();

        renderLibrary();

        renderLiked();

        renderQueue();

        updateStats();

        await loadCategories();

        await loadAdminSongs();


        showToast(
            "Song deleted",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            error.message,
            "error"
        );

    }

}


/* =========================================================
   HELPERS
========================================================= */

function shuffleArray(
    array
) {

    for (
        let i =
            array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }


    return array;

}


function extractYouTubeId(
    value
) {

    if (!value)
        return null;


    const text =
        String(value).trim();


    if (
        /^[A-Za-z0-9_-]{11}$/
            .test(text)
    ) {

        return text;

    }


    const patterns = [

        /youtu\.be\/([A-Za-z0-9_-]{11})/,

        /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,

        /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,

        /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/

    ];


    for (
        const pattern
        of patterns
    ) {

        const match =
            text.match(
                pattern
            );


        if (
            match &&
            match[1]
        ) {

            return match[1];

        }

    }


    return null;

}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
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


function escapeAttribute(
    value
) {

    return escapeHTML(
        value
    );

}


function showError(
    id,
    message
) {

    const element =
        document.getElementById(
            id
        );


    if (!element)
        return;


    element.innerHTML =
        `
            <div class="empty">
                Unable to load:
                ${escapeHTML(
                    message
                )}
            </div>
        `;

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(
    message,
    type = ""
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast)
        return;


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            2800
        );

}