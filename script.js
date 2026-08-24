let songs = [];

const songList =
  document.getElementById(
    "songList"
  );

const categoryList =
  document.getElementById(
    "categoryList"
  );

const audioPlayer =
  document.getElementById(
    "audioPlayer"
  );

const playerTitle =
  document.getElementById(
    "playerTitle"
  );

const playerArtist =
  document.getElementById(
    "playerArtist"
  );

async function loadSongs() {

  try {

    const response =
      await fetch(
        "/api/songs"
      );

    if (!response.ok) {
      throw new Error(
        `Songs API returned ${response.status}`
      );
    }

    songs =
      await response.json();

    renderSongs(songs);

    loadCategories();

  } catch (error) {

    console.error(error);

    songList.innerHTML =
      `
      <div class="song">
        ❌ Unable to load songs.
        <br><br>
        ${escapeHtml(
          error.message
        )}
      </div>
      `;

  }
}

async function loadCategories() {

  try {

    const response =
      await fetch(
        "/api/categories"
      );

    if (!response.ok) {
      throw new Error(
        "Categories API failed"
      );
    }

    const categories =
      await response.json();

    renderCategories(
      categories
    );

  } catch (error) {

    console.error(error);

    categoryList.innerHTML =
      `
      <div class="category">
        Unable to load categories
      </div>
      `;

  }
}

function renderCategories(
  categories
) {

  if (
    !categories ||
    categories.length === 0
  ) {

    categoryList.innerHTML =
      `
      <div class="category">
        No categories yet
      </div>
      `;

    return;
  }

  categoryList.innerHTML =
    categories
      .map(
        (category) => `
          <div
            class="category"
            onclick="filterCategory(${JSON.stringify(
              category.category
            )})"
          >

            <strong>
              ${escapeHtml(
                category.category
              )}
            </strong>

            <br>

            <small>
              ${category.song_count}
              songs
            </small>

          </div>
        `
      )
      .join("");
}

function renderSongs(
  list
) {

  if (
    !list ||
    list.length === 0
  ) {

    songList.innerHTML =
      `
      <div class="song">
        No songs available.
      </div>
      `;

    return;
  }

  songList.innerHTML =
    list
      .map(
        (song) => {

          let source =
            "";

          if (
            song.audio_url
          ) {
            source =
              "🎵 MP3";
          } else if (
            song.youtube_url
          ) {
            source =
              "▶ YouTube";
          }

          return `
            <div
              class="song"
              onclick="playSong(${Number(
                song.id
              )})"
            >

              <div class="song-info">

                <strong>
                  ${escapeHtml(
                    song.title
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    song.artist ||
                    "Unknown Artist"
                  )}
                </small>

              </div>

              <div class="song-type">
                ${source}
              </div>

            </div>
          `;
        }
      )
      .join("");
}

function playSong(id) {

  const song =
    songs.find(
      (item) =>
        Number(item.id) ===
        Number(id)
    );

  if (!song) {
    return;
  }

  playerTitle.textContent =
    song.title;

  playerArtist.textContent =
    song.artist ||
    "SwarAJ";

  if (
    song.audio_url
  ) {

    audioPlayer.style.display =
      "block";

    audioPlayer.src =
      song.audio_url;

    audioPlayer.load();

    audioPlayer.play()
      .catch(
        (error) => {
          console.warn(
            "Autoplay blocked:",
            error.message
          );
        }
      );

    return;
  }

  if (
    song.youtube_url
  ) {

    audioPlayer.pause();

    audioPlayer.removeAttribute(
      "src"
    );

    audioPlayer.load();

    audioPlayer.style.display =
      "none";

    window.open(
      song.youtube_url,
      "_blank",
      "noopener,noreferrer"
    );

    return;
  }
}

function filterCategory(
  category
) {

  const filtered =
    songs.filter(
      (song) =>
        song.category ===
        category
    );

  renderSongs(
    filtered
  );

  const songsSection =
    document.getElementById(
      "songs"
    );

  if (songsSection) {
    songsSection.scrollIntoView({
      behavior: "smooth"
    });
  }
}

function escapeHtml(
  value
) {

  return String(
    value || ""
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

loadSongs();