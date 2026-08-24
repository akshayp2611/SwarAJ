/* =========================================================
   SWARAJ MUSIC - FRONTEND
========================================================= */

const state = {
    songs: [],
    categories: [],
    currentIndex: -1,
    adminKey:
        localStorage.getItem(
            "swaraj_admin_key"
        ) || "",
    youtubeIframe: null,
    youtubeReady: false,
    youtubePlaying: false,
    audio: new Audio()
};

const $ = selector =>
    document.querySelector(selector);

const $$ = selector =>
    [...document.querySelectorAll(selector)];

/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupNavigation();
        setupPlayer();
        setupSearch();
        setupAdmin();

        loadSongs();
        loadCategories();
    }
);

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
    $$(".nav-btn").forEach(button => {
        button.addEventListener(
            "click",
            () => {
                showSection(
                    button.dataset.target
                );
            }
        );
    });

    $("#openAdmin")?.addEventListener(
        "click",
        () => showSection("admin")
    );
}

function showSection(id) {
    $$(".page-section").forEach(
        section => {
            section.classList.toggle(
                "active",
                section.id === id
            );
        }
    );

    $$(".nav-btn").forEach(
        button => {
            button.classList.toggle(
                "active",
                button.dataset.target === id
            );
        }
    );
}

/* =========================================================
   LOAD SONGS
========================================================= */

async function loadSongs() {
    const list =
        $("#songList");

    const featured =
        $("#featuredList");

    if (list) {
        list.innerHTML =
            `<div class="loading">
                Loading songs...
            </div>`;
    }

    try {
        const response =
            await fetch(
                "/api/songs",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `Songs API failed (${response.status})`
            );
        }

        const data =
            await response.json();

        if (!data.success) {
            throw new Error(
                data.error ||
                "Unable to load songs"
            );
        }

        state.songs =
            Array.isArray(data.songs)
                ? data.songs
                : [];

        renderSongs(
            state.songs
        );

        renderFeatured(
            state.songs
        );

        updateSongCount();

    } catch (error) {
        console.error(
            "loadSongs:",
            error
        );

        if (list) {
            list.innerHTML = `
                <div class="loading">
                    Unable to load songs.
                    <br>
                    <small>
                        ${escapeHtml(
                            error.message
                        )}
                    </small>
                </div>
            `;
        }

        showToast(
            "Unable to load songs",
            "error"
        );
    }
}

/* =========================================================
   SONG COUNT
========================================================= */

function updateSongCount() {
    const element =
        $("#songCount");

    if (!element) return;

    element.textContent =
        `${state.songs.length} song${
            state.songs.length === 1
                ? ""
                : "s"
        }`;
}

/* =========================================================
   RENDER SONGS
========================================================= */

function renderSongs(songs) {
    const container =
        $("#songList");

    if (!container) return;

    if (!songs.length) {
        container.innerHTML = `
            <div class="loading">
                No songs found.
            </div>
        `;

        return;
    }

    container.innerHTML = "";

    songs.forEach(
        (song, index) => {
            container.appendChild(
                createSongCard(
                    song,
                    index
                )
            );
        }
    );
}

function createSongCard(
    song,
    index
) {
    const card =
        document.createElement(
            "article"
        );

    card.className =
        "song-card";

    const cover =
        song.cover_url ||
        "/images/ganpati.jpg";

    const type =
        song.source_type ===
        "youtube"
            ? "YouTube"
            : "MP3";

    card.innerHTML = `
        <div class="song-cover-wrap">
            <img
                class="song-cover"
                src="${escapeAttr(
                    cover
                )}"
                alt="${escapeAttr(
                    song.title
                )}"
                loading="lazy"
                onerror="this.src='/images/ganpati.jpg'"
            >

            <button
                class="song-play-btn"
                type="button"
                aria-label="Play"
            >
                ▶
            </button>
        </div>

        <div class="song-card-info">
            <h3>
                ${escapeHtml(
                    song.title
                )}
            </h3>

            <p>
                ${escapeHtml(
                    song.artist ||
                    "SwarAJ"
                )}
            </p>

            <small>
                ${escapeHtml(
                    song.category ||
                    "Other"
                )}
                ·
                ${type}
            </small>
        </div>
    `;

    card.querySelector(
        ".song-play-btn"
    ).addEventListener(
        "click",
        () => {
            playSong(
                index
            );
        }
    );

    card.addEventListener(
        "dblclick",
        () => {
            playSong(index);
        }
    );

    return card;
}

/* =========================================================
   FEATURED
========================================================= */

function renderFeatured(
    songs
) {
    const container =
        $("#featuredList");

    if (!container) return;

    container.innerHTML = "";

    songs
        .slice(0, 6)
        .forEach(
            song => {
                const index =
                    state.songs.findIndex(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                song.id
                            )
                    );

                const card =
                    document.createElement(
                        "article"
                    );

                card.className =
                    "featured-card";

                card.innerHTML = `
                    <img
                        src="${escapeAttr(
                            song.cover_url ||
                            "/images/ganpati.jpg"
                        )}"
                        alt="${escapeAttr(
                            song.title
                        )}"
                        onerror="this.src='/images/ganpati.jpg'"
                    >

                    <div>
                        <strong>
                            ${escapeHtml(
                                song.title
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                song.artist ||
                                "SwarAJ"
                            )}
                        </span>
                    </div>

                    <button
                        type="button"
                        class="featured-play"
                    >
                        ▶
                    </button>
                `;

                card.querySelector(
                    ".featured-play"
                ).addEventListener(
                    "click",
                    () =>
                        playSong(index)
                );

                container.appendChild(
                    card
                );
            }
        );
}

/* =========================================================
   CATEGORIES
========================================================= */

async function loadCategories() {
    const container =
        $("#categoryList");

    if (container) {
        container.innerHTML =
            `<div class="loading">
                Loading categories...
            </div>`;
    }

    try {
        const response =
            await fetch(
                "/api/categories",
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                "Unable to load categories"
            );
        }

        const data =
            await response.json();

        state.categories =
            Array.isArray(
                data.categories
            )
                ? data.categories
                : [];

        renderCategories(
            state.categories
        );

    } catch (error) {
        console.error(
            error
        );

        if (container) {
            container.innerHTML = `
                <div class="loading">
                    Unable to load categories
                </div>
            `;
        }
    }
}

function renderCategories(
    categories
) {
    const container =
        $("#categoryList");

    if (!container) return;

    if (!categories.length) {
        container.innerHTML = `
            <div class="loading">
                No categories found.
            </div>
        `;

        return;
    }

    container.innerHTML = "";

    categories.forEach(
        category => {
            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "category-card";

            button.innerHTML = `
                <strong>
                    ${escapeHtml(
                        category.name ||
                        category.category
                    )}
                </strong>

                <span>
                    ${category.count || 0}
                    songs
                </span>
            `;

            button.addEventListener(
                "click",
                () => {
                    filterCategory(
                        category.name ||
                        category.category
                    );
                }
            );

            container.appendChild(
                button
            );
        }
    );
}

function filterCategory(
    category
) {
    const filtered =
        state.songs.filter(
            song =>
                String(
                    song.category
                ).toLowerCase() ===
                String(
                    category
                ).toLowerCase()
        );

    showSection(
        "songs"
    );

    renderSongs(
        filtered
    );
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
    const input =
        $("#searchInput");

    if (!input) return;

    let timer;

    input.addEventListener(
        "input",
        () => {
            clearTimeout(timer);

            timer =
                setTimeout(
                    () => {
                        performSearch(
                            input.value
                        );
                    },
                    200
                );
        }
    );
}

async function performSearch(
    query
) {
    const q =
        String(query || "").trim();

    if (!q) {
        renderSongs(
            state.songs
        );

        return;
    }

    const localResults =
        state.songs.filter(
            song => {
                const text =
                    [
                        song.title,
                        song.artist,
                        song.album,
                        song.category
                    ]
                        .join(" ")
                        .toLowerCase();

                return text.includes(
                    q.toLowerCase()
                );
            }
        );

    renderSongs(
        localResults
    );

    showSection(
        "songs"
    );
}

/* =========================================================
   PLAYER
========================================================= */

function setupPlayer() {
    const audio =
        state.audio;

    audio.preload =
        "metadata";

    audio.addEventListener(
        "loadedmetadata",
        updateDuration
    );

    audio.addEventListener(
        "timeupdate",
        updateProgress
    );

    audio.addEventListener(
        "ended",
        playNext
    );

    audio.addEventListener(
        "error",
        () => {
            showToast(
                "Unable to play this audio",
                "error"
            );
        }
    );

    $("#playPause")?.addEventListener(
        "click",
        togglePlay
    );

    $("#previousBtn")?.addEventListener(
        "click",
        playPrevious
    );

    $("#nextBtn")?.addEventListener(
        "click",
        playNext
    );

    $("#progressBar")?.addEventListener(
        "input",
        seekAudio
    );

    $("#volumeBar")?.addEventListener(
        "input",
        event => {
            state.audio.volume =
                Number(
                    event.target.value
                ) / 100;
        }
    );

    state.audio.volume = 1;
}

function playSong(
    index
) {
    if (
        index < 0 ||
        index >= state.songs.length
    ) {
        return;
    }

    const song =
        state.songs[index];

    state.currentIndex =
        index;

    updatePlayerUI(
        song
    );

    if (
        song.source_type ===
        "youtube"
    ) {
        playYouTube(
            song
        );
    } else {
        playMP3(
            song
        );
    }
}

function playMP3(
    song
) {
    stopYouTube();

    if (!song.audio_url) {
        showToast(
            "No audio URL available",
            "error"
        );

        return;
    }

    const audio =
        state.audio;

    audio.pause();

    audio.src =
        song.audio_url;

    audio.currentTime =
        0;

    audio.load();

    audio.play()
        .then(() => {
            updatePlayButton(
                true
            );
        })
        .catch(error => {
            console.error(
                "MP3 play:",
                error
            );

            showToast(
                "Tap Play again to start the song",
                "error"
            );
        });
}

function togglePlay() {
    const song =
        state.songs[
            state.currentIndex
        ];

    if (!song) {
        if (state.songs.length) {
            playSong(0);
        }

        return;
    }

    if (
        song.source_type ===
        "youtube"
    ) {
        if (
            state.youtubePlaying
        ) {
            pauseYouTube();
        } else {
            resumeYouTube();
        }

        return;
    }

    if (
        state.audio.paused
    ) {
        state.audio
            .play()
            .then(() =>
                updatePlayButton(
                    true
                )
            )
            .catch(() => {});
    } else {
        state.audio.pause();

        updatePlayButton(
            false
        );
    }
}

/* =========================================================
   NEXT / PREVIOUS
========================================================= */

function playNext() {
    if (!state.songs.length) {
        return;
    }

    const next =
        state.currentIndex < 0
            ? 0
            : (
                state.currentIndex +
                1
            ) %
              state.songs.length;

    playSong(
        next
    );
}

function playPrevious() {
    if (!state.songs.length) {
        return;
    }

    const previous =
        state.currentIndex <= 0
            ? state.songs.length - 1
            : state.currentIndex - 1;

    playSong(
        previous
    );
}

/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayerUI(
    song
) {
    const cover =
        $("#playerCover");

    const title =
        $("#playerTitle");

    const artist =
        $("#playerArtist");

    const source =
        $("#playerSource");

    if (cover) {
        cover.src =
            song.cover_url ||
            "/images/ganpati.jpg";
    }

    if (title) {
        title.textContent =
            song.title ||
            "Untitled";
    }

    if (artist) {
        artist.textContent =
            song.artist ||
            "SwarAJ";
    }

    if (source) {
        source.textContent =
            song.source_type ===
            "youtube"
                ? "YouTube"
                : "MP3";
    }

    updatePlayButton(
        false
    );
}

function updatePlayButton(
    playing
) {
    const button =
        $("#playPause");

    if (!button) return;

    button.textContent =
        playing
            ? "❚❚"
            : "▶";
}

function updateDuration() {
    const duration =
        $("#duration");

    if (!duration) return;

    duration.textContent =
        formatTime(
            state.audio.duration
        );
}

function updateProgress() {
    const audio =
        state.audio;

    const bar =
        $("#progressBar");

    const current =
        $("#currentTime");

    if (
        !audio.duration ||
        !Number.isFinite(
            audio.duration
        )
    ) {
        return;
    }

    if (bar) {
        bar.value =
            (
                audio.currentTime /
                audio.duration
            ) * 100;
    }

    if (current) {
        current.textContent =
            formatTime(
                audio.currentTime
            );
    }
}

function seekAudio(
    event
) {
    if (
        !state.audio.duration
    ) {
        return;
    }

    state.audio.currentTime =
        (
            Number(
                event.target.value
            ) / 100
        ) *
        state.audio.duration;
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

    return (
        minutes +
        ":" +
        String(
            remaining
        ).padStart(2, "0")
    );
}

/* =========================================================
   YOUTUBE
========================================================= */

function playYouTube(
    song
) {
    state.audio.pause();

    const videoId =
        song.youtube_video_id;

    if (!videoId) {
        showToast(
            "YouTube video ID is missing",
            "error"
        );

        return;
    }

    const player =
        $("#youtubePlayer");

    if (!player) {
        return;
    }

    player.innerHTML = `
        <iframe
            id="youtubeAudioFrame"
            width="1"
            height="1"
            src="https://www.youtube.com/embed/${encodeURIComponent(
                videoId
            )}?autoplay=1&enablejsapi=1&rel=0"
            title="${escapeAttr(
                song.title
            )}"
            frameborder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;

    state.youtubeIframe =
        $("#youtubeAudioFrame");

    state.youtubePlaying =
        true;

    updatePlayButton(
        true
    );
}

function stopYouTube() {
    const player =
        $("#youtubePlayer");

    if (player) {
        player.innerHTML = "";
    }

    state.youtubeIframe =
        null;

    state.youtubePlaying =
        false;
}

function pauseYouTube() {
    if (
        state.youtubeIframe?.contentWindow
    ) {
        state.youtubeIframe.contentWindow
            .postMessage(
                JSON.stringify({
                    event:
                        "command",
                    func:
                        "pauseVideo",
                    args: []
                }),
                "*"
            );
    }

    state.youtubePlaying =
        false;

    updatePlayButton(
        false
    );
}

function resumeYouTube() {
    if (
        state.youtubeIframe?.contentWindow
    ) {
        state.youtubeIframe.contentWindow
            .postMessage(
                JSON.stringify({
                    event:
                        "command",
                    func:
                        "playVideo",
                    args: []
                }),
                "*"
            );

        state.youtubePlaying =
            true;

        updatePlayButton(
            true
        );
    }
}

/* =========================================================
   VIDEO MODAL
========================================================= */

function openVideoModal(
    song
) {
    const videoId =
        song?.youtube_video_id;

    if (!videoId) {
        return;
    }

    const modal =
        $("#videoModal");

    const frame =
        $("#videoFrame");

    if (!modal || !frame) {
        return;
    }

    frame.src =
        `https://www.youtube.com/embed/${encodeURIComponent(
            videoId
        )}?autoplay=1&rel=0`;

    modal.classList.add(
        "active"
    );
}

function closeVideoModal() {
    const modal =
        $("#videoModal");

    const frame =
        $("#videoFrame");

    if (frame) {
        frame.src =
            "about:blank";
    }

    modal?.classList.remove(
        "active"
    );
}

$("#closeVideoBtn")?.addEventListener(
    "click",
    closeVideoModal
);

/* =========================================================
   ADMIN
========================================================= */

function setupAdmin() {
    $("#adminLoginBtn")?.addEventListener(
        "click",
        adminLogin
    );

    $("#adminLogoutBtn")?.addEventListener(
        "click",
        adminLogout
    );

    $("#refreshAdminSongs")?.addEventListener(
        "click",
        loadAdminSongs
    );

    $("#uploadForm")?.addEventListener(
        "submit",
        uploadMP3File
    );

    $("#mp3UrlForm")?.addEventListener(
        "submit",
        addMP3URL
    );

    $("#youtubeForm")?.addEventListener(
        "submit",
        addYouTubeSong
    );

    if (
        state.adminKey
    ) {
        verifyAdmin();
    }
}

async function adminLogin() {
    const input =
        $("#adminKey");

    const key =
        input?.value.trim();

    if (!key) {
        showToast(
            "Enter admin key",
            "error"
        );

        return;
    }

    try {
        const response =
            await fetch(
                "/api/admin/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            adminKey:
                                key
                        })
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Invalid admin key"
            );
        }

        state.adminKey =
            key;

        localStorage.setItem(
            "swaraj_admin_key",
            key
        );

        showAdminDashboard();

        showToast(
            "Admin login successful",
            "success"
        );

        await loadAdminSongs();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

async function verifyAdmin() {
    try {
        const response =
            await fetch(
                "/api/admin/songs",
                {
                    headers: {
                        "x-admin-key":
                            state.adminKey
                    }
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                "Invalid admin session"
            );
        }

        showAdminDashboard();

        const data =
            await response.json();

        renderAdminSongs(
            data.songs || []
        );

    } catch {
        adminLogout(
            false
        );
    }
}

function showAdminDashboard() {
    $("#adminLoginPanel")
        ?.classList.add(
            "hidden"
        );

    $("#adminDashboard")
        ?.classList.remove(
            "hidden"
        );
}

function adminLogout(
    showMessage = true
) {
    localStorage.removeItem(
        "swaraj_admin_key"
    );

    state.adminKey =
        "";

    $("#adminLoginPanel")
        ?.classList.remove(
            "hidden"
        );

    $("#adminDashboard")
        ?.classList.add(
            "hidden"
        );

    if (showMessage) {
        showToast(
            "Admin logged out",
            "success"
        );
    }
}

async function loadAdminSongs() {
    if (!state.adminKey) {
        return;
    }

    const container =
        $("#adminSongList");

    if (container) {
        container.innerHTML =
            "<div>Loading...</div>";
    }

    try {
        const response =
            await fetch(
                "/api/admin/songs",
                {
                    headers: {
                        "x-admin-key":
                            state.adminKey
                    }
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Unable to load admin songs"
            );
        }

        renderAdminSongs(
            data.songs || []
        );

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

function renderAdminSongs(
    songs
) {
    const container =
        $("#adminSongList");

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    if (!songs.length) {
        container.innerHTML =
            "<p>No songs in database.</p>";

        return;
    }

    songs.forEach(
        song => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "admin-song-row";

            row.innerHTML = `
                <div>
                    <strong>
                        ${escapeHtml(
                            song.title
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            song.artist ||
                            "SwarAJ"
                        )}
                        •
                        ${escapeHtml(
                            song.category ||
                            "Other"
                        )}
                        •
                        ${escapeHtml(
                            song.source_type ||
                            ""
                        )}
                    </small>
                </div>

                <button
                    class="secondary-btn"
                    type="button"
                >
                    Delete
                </button>
            `;

            row.querySelector(
                "button"
            ).addEventListener(
                "click",
                () =>
                    deleteAdminSong(
                        song.id
                    )
            );

            container.appendChild(
                row
            );
        }
    );
}

/* =========================================================
   ADMIN UPLOAD
========================================================= */

async function uploadMP3File(
    event
) {
    event.preventDefault();

    if (!state.adminKey) {
        showToast(
            "Please login first",
            "error"
        );

        return;
    }

    const form =
        event.currentTarget;

    const button =
        form.querySelector(
            "button[type=submit]"
        );

    const original =
        button?.textContent;

    if (button) {
        button.disabled =
            true;

        button.textContent =
            "Uploading...";
    }

    try {
        const formData =
            new FormData(
                form
            );

        const response =
            await fetch(
                "/api/admin/songs/upload",
                {
                    method: "POST",

                    headers: {
                        "x-admin-key":
                            state.adminKey
                    },

                    body:
                        formData
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Upload failed"
            );
        }

        form.reset();

        showToast(
            "MP3 uploaded successfully",
            "success"
        );

        await refreshAll();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );

    } finally {
        if (button) {
            button.disabled =
                false;

            button.textContent =
                original;
        }
    }
}

/* =========================================================
   ADMIN MP3 URL
========================================================= */

async function addMP3URL(
    event
) {
    event.preventDefault();

    await submitAdminForm(
        event.currentTarget,
        "/api/admin/songs/mp3-url",
        "MP3 URL added successfully"
    );
}

/* =========================================================
   ADMIN YOUTUBE
========================================================= */

async function addYouTubeSong(
    event
) {
    event.preventDefault();

    await submitAdminForm(
        event.currentTarget,
        "/api/admin/songs/youtube",
        "YouTube song added successfully"
    );
}

async function submitAdminForm(
    form,
    endpoint,
    successMessage
) {
    if (!state.adminKey) {
        showToast(
            "Please login first",
            "error"
        );

        return;
    }

    const button =
        form.querySelector(
            "button[type=submit]"
        );

    const original =
        button?.textContent;

    if (button) {
        button.disabled =
            true;

        button.textContent =
            "Saving...";
    }

    try {
        const payload =
            Object.fromEntries(
                new FormData(
                    form
                )
            );

        const response =
            await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-key":
                            state.adminKey
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Request failed"
            );
        }

        form.reset();

        showToast(
            successMessage,
            "success"
        );

        await refreshAll();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );

    } finally {
        if (button) {
            button.disabled =
                false;

            button.textContent =
                original;
        }
    }
}

/* =========================================================
   ADMIN DELETE
========================================================= */

async function deleteAdminSong(
    id
) {
    if (!state.adminKey) {
        return;
    }

    if (
        !confirm(
            "Delete this song permanently?"
        )
    ) {
        return;
    }

    try {
        const response =
            await fetch(
                `/api/admin/songs/${encodeURIComponent(
                    id
                )}`,
                {
                    method:
                        "DELETE",

                    headers: {
                        "x-admin-key":
                            state.adminKey
                    }
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Delete failed"
            );
        }

        showToast(
            "Song deleted successfully",
            "success"
        );

        await refreshAll();

    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    }
}

/* =========================================================
   REFRESH
========================================================= */

async function refreshAll() {
    await Promise.all([
        loadSongs(),
        loadCategories(),
        loadAdminSongs()
    ]);
}

/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {
    const container =
        $("#toastContainer");

    if (!container) {
        alert(message);
        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type}`;

    toast.textContent =
        message;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {
            toast.remove();
        },
        3500
    );
}

/* =========================================================
   SECURITY HELPERS
========================================================= */

function escapeHtml(
    value
) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

function escapeAttr(
    value
) {
    return escapeHtml(
        value
    );
}