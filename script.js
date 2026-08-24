const state = {
    songs: [],
    queue: [],
    index: -1,
    shuffle: false,
    repeat: false,
    liked: JSON.parse(
        localStorage.getItem("swaraj-liked") || "[]"
    ),
    adminKey: sessionStorage.getItem("swaraj-admin-key") || "",
    youtube: null,
    youtubeReady: false,
    youtubeTimer: null
};

const audio =
    document.getElementById("audio");

audio.volume = 1;


/* =====================================================
   START
===================================================== */

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

        if (state.adminKey) {
            showAdminPanel();
        }
    }
);


/* =====================================================
   API
===================================================== */

async function api(
    url,
    options = {}
) {

    const response =
        await fetch(url, {
            cache: "no-store",
            ...options
        });

    let data = {};

    try {
        data = await response.json();
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


/* =====================================================
   LOAD SONGS
===================================================== */

async function loadSongs() {

    try {

        const data =
            await api("/api/songs");

        state.songs =
            Array.isArray(data.songs)
                ? data.songs.map(normalizeSong)
                : [];

        renderHomeSongs();
        renderAllSongs();
        renderLibrary();
        updateStats();

    } catch (error) {

        console.error(error);

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


function normalizeSong(song) {

    const source =
        String(
            song.source_type ||
            song.source ||
            "mp3_url"
        ).toLowerCase();

    let youtubeId =
        song.youtube_video_id ||
        extractYouTubeId(
            song.youtube_url
        );

    let audioUrl =
        song.audio_url;

    if (
        source === "mp3_file" &&
        song.id
    ) {
        audioUrl =
            `/api/songs/${song.id}/audio`;
    }

    return {
        ...song,

        id: Number(song.id),

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
            "/images/ganpati.jpg",

        source_type:
            source,

        audio_url:
            audioUrl || null,

        youtube_video_id:
            youtubeId || null
    };
}


/* =====================================================
   CATEGORIES
===================================================== */

async function loadCategories() {

    try {

        const data =
            await api("/api/categories");

        const categories =
            Array.isArray(data.categories)
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

    } catch (error) {

        console.error(error);

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


/* =====================================================
   NAVIGATION
===================================================== */

function showSection(name) {

    const ids = {
        home: "homeSection",
        songs: "songsSection",
        categories: "categoriesSection",
        library: "librarySection",
        liked: "likedSection",
        queue: "queueSection",
        admin: "adminSection"
    };

    Object.values(ids).forEach(id => {

        const el =
            document.getElementById(id);

        if (el) {
            el.classList.remove("active");
        }

    });

    const target =
        document.getElementById(
            ids[name] || ids.home
        );

    if (target) {
        target.classList.add("active");
    }

    document
        .querySelectorAll(".nav")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === name
            );

        });

    if (name === "queue") {
        renderQueue();
    }

    if (name === "liked") {
        renderLiked();
    }

    if (name === "admin") {
        if (state.adminKey) {
            showAdminPanel();
        }
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    const sidebar =
        document.getElementById("sidebar");

    if (
        window.innerWidth < 1000
    ) {
        sidebar.classList.remove("open");
    }
}


function showAdmin() {

    showSection("admin");

    if (!state.adminKey) {

        document
            .getElementById("adminLoginBox")
            .hidden = false;

        document
            .getElementById("adminPanel")
            .hidden = true;

    }

}


function toggleSidebar() {

    document
        .getElementById("sidebar")
        .classList.toggle("open");

}


/* =====================================================
   SONG CARD
===================================================== */

function songHTML(song, index = null) {

    const liked =
        state.liked.includes(song.id);

    const type =
        song.source_type === "youtube"
            ? "YouTube"
            : "MP3";

    const onclick =
        index !== null
            ? `playFromList(${index})`
            : `playSong(${song.id})`;

    return `
        <article
            class="song-card ${
                currentSong()?.id === song.id
                    ? "current"
                    : ""
            }"
            data-song-id="${song.id}"
        >

            <img
                class="song-cover"
                src="${escapeHTML(song.cover_url)}"
                alt=""
                onerror="this.src='/images/ganpati.jpg'"
            >

            <div class="song-info">

                <b>${escapeHTML(song.title)}</b>

                <small>
                    ${escapeHTML(song.artist)}
                </small>

                <div class="song-tags">
                    <span>
                        ${escapeHTML(song.category)}
                    </span>

                    <span>
                        ${type}
                    </span>
                </div>

            </div>

            <div class="song-actions">

                <button
                    title="Play"
                    onclick="event.stopPropagation();${onclick}">
                    ▶
                </button>

                <button
                    title="Like"
                    onclick="event.stopPropagation();toggleLike(${song.id})">
                    ${liked ? "♥" : "♡"}
                </button>

            </div>

        </article>
    `;
}


function renderSongList(
    containerId,
    songs
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }

    if (!songs.length) {

        container.innerHTML = `
            <div class="empty">
                No songs found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        songs
            .map(song =>
                songHTML(
                    song,
                    null
                )
            )
            .join("");
}


/* =====================================================
   HOME
===================================================== */

function renderHomeSongs() {

    const container =
        document.getElementById(
            "homeSongs"
        );

    if (!container) {
        return;
    }

    const songs =
        state.songs.slice(0, 8);

    container.innerHTML =
        songs.length
            ? songs
                .map(song =>
                    songHTML(song)
                )
                .join("")
            : `
                <div class="empty">
                    No songs found.
                </div>
            `;

    document
        .getElementById("homeCount")
        .textContent =
        `${state.songs.length} songs available`;
}


function renderAllSongs() {

    const container =
        document.getElementById(
            "allSongs"
        );

    if (!container) {
        return;
    }

    if (!state.songs.length) {

        container.innerHTML =
            `<div class="empty">
                No songs found.
            </div>`;

        return;
    }

    container.innerHTML =
        state.songs
            .map((song, index) =>
                songHTML(song, index)
            )
            .join("");
}


function renderLibrary() {

    renderSongList(
        "librarySongs",
        state.songs
    );
}


/* =====================================================
   CATEGORIES
===================================================== */

function renderCategories(
    containerId,
    categories
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }

    if (!categories.length) {

        container.innerHTML =
            `<div class="empty">
                No categories found.
            </div>`;

        return;
    }

    container.innerHTML =
        categories
            .map(category => {

                const name =
                    category.name ||
                    category.category ||
                    "Other";

                const count =
                    Number(
                        category.count || 0
                    );

                return `
                    <button
                        class="category-card"
                        onclick="openCategory('${escapeAttribute(name)}')">

                        <div class="category-icon">
                            ♫
                        </div>

                        <b>
                            ${escapeHTML(name)}
                        </b>

                        <small>
                            ${count} song${count === 1 ? "" : "s"}
                        </small>

                    </button>
                `;

            })
            .join("");
}


async function openCategory(
    category
) {

    try {

        const data =
            await api(
                `/api/categories/${encodeURIComponent(category)}`
            );

        const songs =
            Array.isArray(data.songs)
                ? data.songs.map(normalizeSong)
                : [];

        document
            .getElementById("categoryView")
            .hidden = false;

        document
            .getElementById("categoryTitle")
            .textContent = category;

        document
            .getElementById("categoryCount")
            .textContent =
            `${songs.length} songs`;

        const container =
            document.getElementById(
                "categorySongs"
            );

        container.innerHTML =
            songs.length
                ? songs
                    .map(song =>
                        songHTML(song)
                    )
                    .join("")
                : `<div class="empty">
                    No songs found.
                   </div>`;

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


function closeCategory() {

    document
        .getElementById("categoryView")
        .hidden = true;

}


/* =====================================================
   PLAY ALL
===================================================== */

async function playAll() {

    if (!state.songs.length) {

        await loadSongs();

        if (!state.songs.length) {
            showToast(
                "No songs available",
                "error"
            );
            return;
        }
    }

    state.queue =
        state.shuffle
            ? shuffled([...state.songs])
            : [...state.songs];

    state.index = 0;

    showSection("queue");

    await playCurrent();
}


/* =====================================================
   PLAY SINGLE
===================================================== */

async function playSong(id) {

    const index =
        state.songs.findIndex(
            song =>
                Number(song.id) ===
                Number(id)
        );

    if (index < 0) {
        return;
    }

    state.queue =
        state.shuffle
            ? shuffled([...state.songs])
            : [...state.songs];

    const targetId =
        Number(id);

    state.index =
        state.queue.findIndex(
            song =>
                Number(song.id) ===
                targetId
        );

    if (state.index < 0) {
        state.index = 0;
    }

    await playCurrent();
}


async function playFromList(
    index
) {

    state.queue =
        state.songs.slice();

    state.index =
        Number(index);

    await playCurrent();
}


/* =====================================================
   CURRENT SONG
===================================================== */

function currentSong() {

    return state.queue[
        state.index
    ] || null;
}


async function playCurrent() {

    const song =
        currentSong();

    if (!song) {
        return;
    }

    updatePlayer(song);

    stopPlayback();

    if (
        song.source_type ===
            "youtube" ||
        song.youtube_video_id
    ) {

        playYouTube(song);

    } else {

        playMP3(song);

    }

    renderQueue();
    renderAllSongs();
}


/* =====================================================
   MP3
===================================================== */

function playMP3(song) {

    if (!song.audio_url) {

        showToast(
            "MP3 URL is missing",
            "error"
        );

        playNext();
        return;
    }

    audio.src =
        song.audio_url;

    audio.load();

    const promise =
        audio.play();

    if (promise) {

        promise
            .then(() => {

                state.playing = true;
                updatePlayButton();

            })
            .catch(error => {

                console.error(
                    "MP3 error",
                    error
                );

                showToast(
                    "Unable to play this MP3",
                    "error"
                );

            });
    }
}


audio.addEventListener(
    "ended",
    () => {

        state.playing = false;

        playNext();

    }
);


/* =====================================================
   NEXT / PREVIOUS
===================================================== */

async function playNext() {

    if (!state.queue.length) {
        return;
    }

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

    state.playing = false;

    updatePlayButton();

    showToast(
        "Playlist finished",
        "success"
    );
}


async function playPrevious() {

    if (!state.queue.length) {
        return;
    }

    if (
        !audio.paused &&
        audio.currentTime > 3
    ) {

        audio.currentTime = 0;

        return;
    }

    if (
        state.index > 0
    ) {

        state.index--;

        await playCurrent();

    }

}


/* =====================================================
   PLAY / PAUSE
===================================================== */

async function togglePlay() {

    const song =
        currentSong();

    if (!song) {

        await playAll();

        return;
    }

    if (
        song.source_type ===
            "youtube" ||
        song.youtube_video_id
    ) {

        if (state.youtube) {

            if (state.playing) {
                state.youtube.pauseVideo();
            } else {
                state.youtube.playVideo();
            }

            return;
        }

        playYouTube(song);

        return;
    }

    if (audio.paused) {

        try {

            await audio.play();

            state.playing = true;

        } catch (error) {

            console.error(error);

        }

    } else {

        audio.pause();

        state.playing = false;

    }

    updatePlayButton();
}


function updatePlayButton() {

    const button =
        document.getElementById(
            "playBtn"
        );

    if (!button) {
        return;
    }

    button.textContent =
        state.playing
            ? "❚❚"
            : "▶";
}


/* =====================================================
   SHUFFLE
===================================================== */

function toggleShuffle() {

    state.shuffle =
        !state.shuffle;

    document
        .getElementById("shuffleBtn")
        ?.classList.toggle(
            "active",
            state.shuffle
        );

    if (
        state.queue.length
    ) {

        const current =
            currentSong();

        state.queue =
            state.shuffle
                ? shuffled([...state.queue])
                : [...state.songs];

        if (current) {

            const index =
                state.queue.findIndex(
                    song =>
                        song.id ===
                        current.id
                );

            if (index >= 0) {
                state.index = index;
            }
        }
    }

    showToast(
        state.shuffle
            ? "Shuffle enabled"
            : "Shuffle disabled",
        "success"
    );

}


function shuffled(array) {

    for (
        let i = array.length - 1;
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
        ] = [
            array[j],
            array[i]
        ];

    }

    return array;
}


/* =====================================================
   REPEAT
===================================================== */

function toggleRepeat() {

    state.repeat =
        !state.repeat;

    document
        .getElementById("repeatBtn")
        ?.classList.toggle(
            "active",
            state.repeat
        );

    showToast(
        state.repeat
            ? "Repeat enabled"
            : "Repeat disabled",
        "success"
    );
}


/* =====================================================
   YOUTUBE
===================================================== */

window.onYouTubeIframeAPIReady =
    function () {

        state.youtubeReady =
            true;

    };


function playYouTube(song) {

    if (
        !song.youtube_video_id
    ) {

        showToast(
            "YouTube video ID missing",
            "error"
        );

        playNext();

        return;
    }

    const wrapper =
        document.getElementById(
            "ytWrap"
        );

    wrapper.hidden = false;

    if (
        state.youtube &&
        typeof state.youtube.destroy ===
            "function"
    ) {

        try {
            state.youtube.destroy();
        } catch {}

        state.youtube = null;
    }

    const container =
        document.getElementById(
            "youtubePlayer"
        );

    container.innerHTML = "";

    if (
        !window.YT ||
        !YT.Player
    ) {

        showToast(
            "YouTube player is still loading",
            "error"
        );

        setTimeout(
            () => playYouTube(song),
            1000
        );

        return;
    }

    state.youtube =
        new YT.Player(
            "youtubePlayer",
            {
                videoId:
                    song.youtube_video_id,

                playerVars: {
                    autoplay: 1,
                    controls: 1,
                    rel: 0,
                    playsinline: 1,
                    enablejsapi: 1
                },

                events: {

                    onReady:
                        event => {

                            event
                                .target
                                .playVideo();

                            state.playing =
                                true;

                            updatePlayButton();

                        },

                    onStateChange:
                        event => {

                            if (
                                event.data ===
                                YT.PlayerState.PLAYING
                            ) {

                                state.playing =
                                    true;

                                updatePlayButton();

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

                        },

                    onError:
                        error => {

                            console.error(
                                "YouTube error",
                                error
                            );

                            showToast(
                                "YouTube cannot play this video",
                                "error"
                            );

                            playNext();

                        }
                }
            }
        );
}


function closeYouTube() {

    document
        .getElementById(
            "ytWrap"
        )
        .hidden = true;

    if (
        state.youtube &&
        typeof state.youtube.stopVideo ===
            "function"
    ) {

        try {
            state.youtube.stopVideo();
        } catch {}

    }

}


function stopYouTube() {

    if (
        state.youtube &&
        typeof state.youtube.destroy ===
            "function"
    ) {

        try {
            state.youtube.destroy();
        } catch {}

    }

    state.youtube = null;

    document
        .getElementById(
            "youtubePlayer"
        )
        .innerHTML = "";

    document
        .getElementById(
            "ytWrap"
        )
        .hidden = true;
}


/* =====================================================
   STOP
===================================================== */

function stopPlayback() {

    audio.pause();

    audio.removeAttribute(
        "src"
    );

    audio.load();

    stopYouTube();

    state.playing = false;

    updatePlayButton();
}


/* =====================================================
   PLAYER UI
===================================================== */

function updatePlayer(
    song
) {

    document
        .getElementById(
            "playerTitle"
        )
        .textContent =
        song.title;

    document
        .getElementById(
            "playerArtist"
        )
        .textContent =
        song.artist;

    const cover =
        document.getElementById(
            "playerCover"
        );

    cover.src =
        song.cover_url ||
        "/images/ganpati.jpg";

    cover.onerror =
        () => {
            cover.src =
                "/images/ganpati.jpg";
        };

    document
        .getElementById(
            "likeCurrent"
        )
        .textContent =
        state.liked.includes(song.id)
            ? "♥"
            : "♡";

    document
        .getElementById(
            "progress"
        )
        .value = 0;

    document
        .getElementById(
            "currentTime"
        )
        .textContent = "0:00";

    document
        .getElementById(
            "duration"
        )
        .textContent = "0:00";

}


function setupAudio() {

    audio.addEventListener(
        "timeupdate",
        () => {

            if (
                !audio.duration ||
                !Number.isFinite(
                    audio.duration
                )
            ) {
                return;
            }

            const percent =
                (
                    audio.currentTime /
                    audio.duration
                ) * 100;

            document
                .getElementById(
                    "progress"
                )
                .value =
                percent;

            document
                .getElementById(
                    "currentTime"
                )
                .textContent =
                formatTime(
                    audio.currentTime
                );

            document
                .getElementById(
                    "duration"
                )
                .textContent =
                formatTime(
                    audio.duration
                );

        }
    );


    audio.addEventListener(
        "loadedmetadata",
        () => {

            document
                .getElementById(
                    "duration"
                )
                .textContent =
                formatTime(
                    audio.duration
                );

        }
    );


    document
        .getElementById(
            "progress"
        )
        .addEventListener(
            "input",
            event => {

                if (
                    !audio.duration
                ) {
                    return;
                }

                audio.currentTime =
                    (
                        Number(
                            event.target.value
                        ) / 100
                    ) *
                    audio.duration;

            }
        );

}


/* =====================================================
   VOLUME
===================================================== */

function setupVolume() {

    document
        .getElementById(
            "volume"
        )
        .addEventListener(
            "input",
            event => {

                audio.volume =
                    Number(
                        event.target.value
                    );

                audio.muted = false;

                document
                    .getElementById(
                        "muteBtn"
                    )
                    .textContent =
                    "🔊";

            }
        );

}


function toggleMute() {

    audio.muted =
        !audio.muted;

    document
        .getElementById(
            "muteBtn"
        )
        .textContent =
        audio.muted
            ? "🔇"
            : "🔊";

}


/* =====================================================
   LIKES
===================================================== */

function toggleLike(id) {

    id = Number(id);

    if (
        state.liked.includes(id)
    ) {

        state.liked =
            state.liked.filter(
                x => x !== id
            );

    } else {

        state.liked.push(id);

    }

    localStorage.setItem(
        "swaraj-liked",
        JSON.stringify(
            state.liked
        )
    );

    renderAllSongs();
    renderHomeSongs();
    renderLiked();
    updateStats();

}


function toggleCurrentLike() {

    const song =
        currentSong();

    if (song) {
        toggleLike(song.id);
    }

}


/* =====================================================
   LIKED
===================================================== */

function renderLiked() {

    const container =
        document.getElementById(
            "likedSongs"
        );

    const songs =
        state.songs.filter(
            song =>
                state.liked.includes(
                    song.id
                )
        );

    container.innerHTML =
        songs.length
            ? songs
                .map(song =>
                    songHTML(song)
                )
                .join("")
            : `
                <div class="empty">
                    No liked songs yet.
                </div>
            `;

}


/* =====================================================
   QUEUE
===================================================== */

function renderQueue() {

    const container =
        document.getElementById(
            "queueList"
        );

    if (!container) {
        return;
    }

    if (!state.queue.length) {

        container.innerHTML =
            `<div class="empty">
                Queue is empty.
             </div>`;

        return;
    }

    container.innerHTML =
        state.queue
            .map(
                (song, index) => `
                    ${songHTML(
                        song,
                        index
                    )}
                `
            )
            .join("");

}


function clearQueue() {

    stopPlayback();

    state.queue = [];
    state.index = -1;

    renderQueue();

    updatePlayer({
        title: "Nothing playing",
        artist: "SwarAJ",
        cover_url:
            "/images/ganpati.jpg"
    });

}


/* =====================================================
   ADMIN
===================================================== */

async function adminLogin(
    event
) {

    event.preventDefault();

    const input =
        document.getElementById(
            "adminKeyInput"
        );

    const message =
        document.getElementById(
            "adminMessage"
        );

    const key =
        input.value.trim();

    if (!key) {
        return;
    }

    try {

        const data =
            await api(
                "/api/admin/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            adminKey: key
                        })
                }
            );

        if (!data.success) {
            throw new Error(
                data.error ||
                "Login failed"
            );
        }

        state.adminKey = key;

        sessionStorage.setItem(
            "swaraj-admin-key",
            key
        );

        message.textContent =
            "Admin login successful.";

        message.className =
            "message success";

        showAdminPanel();

        loadAdminSongs();

        showToast(
            "Admin login successful",
            "success"
        );

    } catch (error) {

        message.textContent =
            error.message;

        message.className =
            "message error";

    }

}


function showAdminPanel() {

    document
        .getElementById(
            "adminLoginBox"
        )
        .hidden = true;

    document
        .getElementById(
            "adminPanel"
        )
        .hidden = false;

}


async function loadAdminSongs() {

    if (!state.adminKey) {
        return;
    }

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
                        "x-admin-key":
                            state.adminKey
                    }
                }
            );

        const songs =
            Array.isArray(data.songs)
                ? data.songs.map(
                    normalizeSong
                )
                : [];

        container.innerHTML =
            songs.length
                ? songs
                    .map(song =>
                        songHTML(song)
                    )
                    .join("")
                : `<div class="empty">
                    No songs.
                   </div>`;

    } catch (error) {

        container.innerHTML =
            `<div class="empty">
                ${escapeHTML(
                    error.message
                )}
             </div>`;

        if (
            error.message
                .toLowerCase()
                .includes("invalid admin")
        ) {

            logoutAdmin();

        }

    }

}


async function uploadMP3(
    event
) {

    event.preventDefault();

    if (!state.adminKey) {

        showToast(
            "Login as admin first",
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
        new FormData(form);

    message.textContent =
        "Uploading...";

    message.className =
        "message";

    try {

        const response =
            await fetch(
                "/api/admin/songs/upload",
                {
                    method: "POST",

                    headers: {
                        "x-admin-key":
                            state.adminKey
                    },

                    body: formData
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

        message.textContent =
            "MP3 uploaded successfully.";

        message.className =
            "message success";

        form.reset();

        await loadSongs();

        await loadCategories();

        await loadAdminSongs();

        showToast(
            "MP3 uploaded",
            "success"
        );

    } catch (error) {

        message.textContent =
            error.message;

        message.className =
            "message error";

    }

}


function logoutAdmin() {

    state.adminKey = "";

    sessionStorage.removeItem(
        "swaraj-admin-key"
    );

    document
        .getElementById(
            "adminLoginBox"
        )
        .hidden = false;

    document
        .getElementById(
            "adminPanel"
        )
        .hidden = true;

}


/* =====================================================
   SEARCH
===================================================== */

function setupSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );

    let timer;

    input.addEventListener(
        "input",
        () => {

            clearTimeout(timer);

            const query =
                input.value
                    .trim()
                    .toLowerCase();

            document
                .getElementById(
                    "clearSearch"
                )
                .hidden =
                !query;

            timer =
                setTimeout(
                    () =>
                        searchSongs(query),
                    150
                );

        }
    );

}


function searchSongs(query) {

    if (!query) {

        showSection(
            "home"
        );

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
                    .includes(query)
        );

    showSection(
        "songs"
    );

    const container =
        document.getElementById(
            "allSongs"
        );

    container.innerHTML =
        results.length
            ? results
                .map(song =>
                    songHTML(song)
                )
                .join("")
            : `<div class="empty">
                No results for
                "${escapeHTML(query)}"
               </div>`;

}


function clearSearch() {

    document
        .getElementById(
            "searchInput"
        )
        .value = "";

    document
        .getElementById(
            "clearSearch"
        )
        .hidden = true;

    renderAllSongs();

}


/* =====================================================
   STATS
===================================================== */

function updateStats() {

    document
        .getElementById(
            "statSongs"
        )
        .textContent =
        state.songs.length;

    const categories =
        new Set(
            state.songs.map(
                song =>
                    song.category
            )
        );

    document
        .getElementById(
            "statCats"
        )
        .textContent =
        categories.size;

    document
        .getElementById(
            "statLiked"
        )
        .textContent =
        state.liked.length;

}


/* =====================================================
   HELPERS
===================================================== */

function extractYouTubeId(
    value
) {

    if (!value) {
        return null;
    }

    const text =
        String(value).trim();

    if (
        /^[A-Za-z0-9_-]{11}$/.test(
            text
        )
    ) {
        return text;
    }

    try {

        const url =
            new URL(text);

        if (
            url.hostname ===
            "youtu.be"
        ) {

            return url.pathname
                .split("/")
                .filter(Boolean)[0] ||
                null;

        }

        const v =
            url.searchParams.get("v");

        if (v) {
            return v;
        }

        const parts =
            url.pathname
                .split("/")
                .filter(Boolean);

        const index =
            parts.findIndex(
                x =>
                    [
                        "embed",
                        "shorts",
                        "live"
                    ].includes(x)
            );

        return index >= 0
            ? parts[index + 1] ||
                null
            : null;

    } catch {

        return null;

    }

}


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
            .padStart(2,"0");

    return `${minutes}:${secs}`;

}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


function escapeAttribute(
    value
) {

    return String(value)
        .replaceAll(
            "'",
            "\\'"
        );

}


function showError(
    id,
    message
) {

    const el =
        document.getElementById(id);

    if (!el) {
        return;
    }

    el.innerHTML =
        `<div class="empty">
            Unable to load:
            ${escapeHTML(message)}
         </div>`;

}


function showToast(
    message,
    type = "info"
) {

    const toast =
        document.getElementById(
            "toast"
        );

    toast.textContent =
        message;

    toast.className =
        `toast show ${type}`;

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {
                toast.className =
                    "toast";
            },
            3000
        );

}