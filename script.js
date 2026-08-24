const playerState = {
    queue: [],
    index: -1,
    shuffle: false,
    repeat: false,
    playing: false,
    youtubePlayer: null
};

const audio = new Audio();
audio.preload = "metadata";

/* ===============================
   PLAY ALL
================================ */

async function playAll() {
    try {
        const response = await fetch(
            "/api/songs",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Unable to load playlist"
            );
        }

        const data = await response.json();

        if (
            !data.success ||
            !Array.isArray(data.songs) ||
            !data.songs.length
        ) {
            showToast(
                "No songs available",
                "error"
            );
            return;
        }

        playerState.queue = [
            ...data.songs
        ];

        playerState.index = 0;

        if (playerState.shuffle) {
            shuffleQueue();
        }

        await playCurrentSong();

    } catch (error) {
        console.error(error);

        showToast(
            error.message ||
            "Unable to start playlist",
            "error"
        );
    }
}

/* ===============================
   CURRENT SONG
================================ */

async function playCurrentSong() {
    if (
        !playerState.queue.length ||
        playerState.index < 0 ||
        playerState.index >=
            playerState.queue.length
    ) {
        return;
    }

    const song =
        playerState.queue[
            playerState.index
        ];

    updatePlayerUI(song);

    stopCurrentPlayback();

    if (
        song.source_type === "youtube"
    ) {
        playYouTubeSong(song);
    } else {
        playMPSong(song);
    }
}

/* ===============================
   MP3
================================ */

function playMPSong(song) {
    if (!song.audio_url) {
        showToast(
            "MP3 URL is missing",
            "error"
        );

        playNext();
        return;
    }

    audio.src = song.audio_url;

    audio.load();

    audio.play()
        .then(() => {
            playerState.playing = true;
            updatePlayButton(true);
        })
        .catch(error => {
            console.error(
                "MP3 playback error:",
                error
            );

            showToast(
                "Unable to play MP3",
                "error"
            );
        });
}

/* ===============================
   MP3 FINISHED
================================ */

audio.addEventListener(
    "ended",
    () => {
        playNext();
    }
);

/* ===============================
   NEXT
================================ */

async function playNext() {
    if (
        !playerState.queue.length
    ) {
        return;
    }

    if (
        playerState.index <
        playerState.queue.length - 1
    ) {
        playerState.index++;

        await playCurrentSong();

        return;
    }

    if (playerState.repeat) {
        playerState.index = 0;

        await playCurrentSong();

        return;
    }

    playerState.playing = false;

    updatePlayButton(false);
}

/* ===============================
   PREVIOUS
================================ */

async function playPrevious() {
    if (
        !playerState.queue.length
    ) {
        return;
    }

    if (
        audio.currentTime > 3
    ) {
        audio.currentTime = 0;
        return;
    }

    if (
        playerState.index > 0
    ) {
        playerState.index--;

        await playCurrentSong();
    }
}

/* ===============================
   PLAY / PAUSE
================================ */

async function togglePlay() {
    const song =
        playerState.queue[
            playerState.index
        ];

    if (!song) {
        await playAll();
        return;
    }

    if (
        song.source_type ===
        "youtube"
    ) {
        toggleYouTube();

        return;
    }

    if (audio.paused) {
        try {
            await audio.play();

            playerState.playing = true;

            updatePlayButton(true);

        } catch (error) {
            console.error(error);
        }

    } else {
        audio.pause();

        playerState.playing = false;

        updatePlayButton(false);
    }
}

/* ===============================
   STOP
================================ */

function stopCurrentPlayback() {
    audio.pause();

    audio.currentTime = 0;

    audio.removeAttribute("src");

    stopYouTube();

    playerState.playing = false;
}

/* ===============================
   SHUFFLE
================================ */

function toggleShuffle() {
    playerState.shuffle =
        !playerState.shuffle;

    const button =
        document.querySelector(
            "#shuffleBtn"
        );

    button?.classList.toggle(
        "active",
        playerState.shuffle
    );

    showToast(
        playerState.shuffle
            ? "Shuffle enabled"
            : "Shuffle disabled",
        "success"
    );
}

function shuffleQueue() {
    for (
        let i =
            playerState.queue.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            playerState.queue[i],
            playerState.queue[j]
        ] = [
            playerState.queue[j],
            playerState.queue[i]
        ];
    }
}

/* ===============================
   REPEAT
================================ */

function toggleRepeat() {
    playerState.repeat =
        !playerState.repeat;

    const button =
        document.querySelector(
            "#repeatBtn"
        );

    button?.classList.toggle(
        "active",
        playerState.repeat
    );

    showToast(
        playerState.repeat
            ? "Repeat enabled"
            : "Repeat disabled",
        "success"
    );
}

/* ===============================
   YOUTUBE
================================ */

let youtubeIframe = null;

function playYouTubeSong(song) {
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

    const container =
        document.querySelector(
            "#youtubePlayer"
        );

    if (!container) {
        showToast(
            "YouTube player container missing",
            "error"
        );

        return;
    }

    container.innerHTML = `
        <iframe
            id="youtubePlayerFrame"
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/${encodeURIComponent(
                song.youtube_video_id
            )}?autoplay=1&enablejsapi=1&controls=1&rel=0"
            title="${escapeHtml(
                song.title
            )}"
            frameborder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;

    youtubeIframe =
        document.querySelector(
            "#youtubePlayerFrame"
        );

    playerState.playing = true;

    updatePlayButton(true);
}

/* ===============================
   YOUTUBE PLAY/PAUSE
================================ */

function toggleYouTube() {
    if (!youtubeIframe) {
        return;
    }

    const command =
        playerState.playing
            ? "pauseVideo"
            : "playVideo";

    youtubeIframe.contentWindow
        ?.postMessage(
            JSON.stringify({
                event: "command",
                func: command,
                args: []
            }),
            "*"
        );

    playerState.playing =
        !playerState.playing;

    updatePlayButton(
        playerState.playing
    );
}

function stopYouTube() {
    const container =
        document.querySelector(
            "#youtubePlayer"
        );

    if (container) {
        container.innerHTML = "";
    }

    youtubeIframe = null;
}

/* ===============================
   PLAYER UI
================================ */

function updatePlayerUI(song) {
    const title =
        document.querySelector(
            "#playerTitle"
        );

    const artist =
        document.querySelector(
            "#playerArtist"
        );

    const cover =
        document.querySelector(
            "#playerCover"
        );

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

    if (cover) {
        cover.src =
            song.cover_url ||
            "/images/ganpati.jpg";
    }
}

function updatePlayButton(
    playing
) {
    const button =
        document.querySelector(
            "#playPauseBtn"
        );

    if (!button) {
        return;
    }

    button.innerHTML =
        playing
            ? "❚❚"
            : "▶";
}

/* ===============================
   BUTTON CONNECTIONS
================================ */

document
    .querySelector(
        "#playAllBtn"
    )
    ?.addEventListener(
        "click",
        playAll
    );

document
    .querySelector(
        "#playPauseBtn"
    )
    ?.addEventListener(
        "click",
        togglePlay
    );

document
    .querySelector(
        "#previousBtn"
    )
    ?.addEventListener(
        "click",
        playPrevious
    );

document
    .querySelector(
        "#nextBtn"
    )
    ?.addEventListener(
        "click",
        playNext
    );

document
    .querySelector(
        "#shuffleBtn"
    )
    ?.addEventListener(
        "click",
        toggleShuffle
    );

document
    .querySelector(
        "#repeatBtn"
    )
    ?.addEventListener(
        "click",
        toggleRepeat
    );