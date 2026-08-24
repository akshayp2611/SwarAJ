const state = {
  songs: [],
  view: 'home',
  current: null,
  index: -1,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 0,
  favorites: JSON.parse(localStorage.getItem('swaraj-favorites') || '[]'),
  yt: null,
  ytReady: false,
  ytLoading: false,
  mode: 'music',
  adminToken: localStorage.getItem('swaraj-admin-token') || ''
};

const $ = selector => document.querySelector(selector);
const audio = $('#audio');

const E = {
  cover: $('#cover'),
  title: $('#title'),
  artist: $('#artist'),

  // IMPORTANT FIXES
  like: $('#like'),
  fullPlayer: $('#fullPlayer'),

  fullCover: $('#fullCover'),
  fullTitle: $('#fullTitle'),
  fullArtist: $('#fullArtist'),

  play: $('#play'),
  fullPlay: $('#fullPlay'),

  prev: $('#prev'),
  next: $('#next'),
  fullPrev: $('#fullPrev'),
  fullNext: $('#fullNext'),

  seek: $('#seek'),
  cur: $('#cur'),
  dur: $('#dur'),
  volume: $('#volume'),

  queue: $('#queue'),
  toast: $('#toast'),

  videoWrap: $('#ytPlayerWrap'),
  videoMode: $('#videoMode'),
  musicMode: $('#musicMode'),
  source: $('#sourceBadge')
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message) {
  if (!E.toast) return;

  E.toast.textContent = message;
  E.toast.classList.add('show');

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    E.toast.classList.remove('show');
  }, 2800);
}

function imageFor(song) {
  return song.cover_url ||
    `/api/cover/${encodeURIComponent(song.category || 'All Songs')}`;
}

function isFavorite(song) {
  return state.favorites.includes(String(song.id));
}

function saveFavorites() {
  localStorage.setItem(
    'swaraj-favorites',
    JSON.stringify(state.favorites)
  );
}

function toggleFavorite(song) {
  const id = String(song.id);
  const index = state.favorites.indexOf(id);

  if (index === -1) {
    state.favorites.push(id);
    toast('Added to liked songs');
  } else {
    state.favorites.splice(index, 1);
    toast('Removed from liked songs');
  }

  saveFavorites();
  updateLikeButton();
  renderAll();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

function normalizeSong(song) {
  const youtubeId = song.youtube_id || null;

  const sourceType =
    String(song.source_type || '').toLowerCase() === 'youtube' ||
    !!youtubeId
      ? 'youtube'
      : 'mp3';

  return {
    ...song,

    id: song.id,

    title: song.title || 'Untitled',
    artist: song.artist || 'SwarAJ',
    album: song.album || 'SwarAJ',
    category: song.category || 'All Songs',
    language: song.language || 'Marathi',

    source_type: sourceType,

    audio_url:
      sourceType === 'mp3'
        ? (
            song.audio_url ||
            song.file_url ||
            song.url ||
            null
          )
        : null,

    file_path:
      sourceType === 'mp3'
        ? song.file_path || null
        : null,

    youtube_id:
      sourceType === 'youtube'
        ? youtubeId
        : null,

    youtube_url:
      sourceType === 'youtube'
        ? (
            song.youtube_url ||
            (
              youtubeId
                ? `https://www.youtube.com/watch?v=${youtubeId}`
                : null
            )
          )
        : null,

    cover_url: song.cover_url || null,

    duration: Number(song.duration || 0),

    is_active: song.is_active !== false
  };
}

async function load() {
  try {
    console.log('SwarAJ: loading songs...');

    const [songsData, categoriesData] = await Promise.all([
      api('/api/songs'),
      api('/api/categories')
    ]);

    state.songs = (songsData.songs || [])
      .map(normalizeSong)
      .filter(song => song.is_active !== false);

    console.log(
      `SwarAJ: ${state.songs.length} songs loaded`,
      state.songs
    );

    renderCategories(categoriesData.categories || []);
    renderSide(categoriesData.categories || []);

    renderAll();

    updateStats(categoriesData.categories || []);

  } catch (error) {
    console.error('SwarAJ LOAD ERROR:', error);

    toast(`Unable to load songs: ${error.message}`);

    [
      'homeSongs',
      'musicSongs',
      'youtubeSongs',
      'librarySongs',
      'favoriteSongs'
    ].forEach(id => {
      const element = $('#' + id);

      if (element) {
        element.innerHTML = `
          <div class="panel glass">
            <strong>Unable to load songs</strong>
            <br>
            <small>${esc(error.message)}</small>
          </div>
        `;
      }
    });
  }
}

function updateStats(categories) {
  const count = $('#count');
  const youtubeCount = $('#ytCount');
  const mp3Count = $('#mp3Count');
  const categoryCount = $('#catCount');

  if (count) {
    count.textContent = state.songs.length;
  }

  if (youtubeCount) {
    youtubeCount.textContent =
      state.songs.filter(
        song => song.source_type === 'youtube'
      ).length;
  }

  if (mp3Count) {
    mp3Count.textContent =
      state.songs.filter(
        song => song.source_type === 'mp3'
      ).length;
  }

  if (categoryCount) {
    categoryCount.textContent = categories.length;
  }
}

function renderCategories(categories) {
  const element = $('#categories');

  if (!element) return;

  if (!categories.length) {
    element.innerHTML =
      '<div class="panel glass">No categories yet.</div>';
    return;
  }

  element.innerHTML = categories.map(category => `
    <article
      class="category"
      data-category="${esc(category.name)}"
    >
      <div class="symbol">
        ${symbolFor(category.name)}
      </div>

      <h3>${esc(category.name)}</h3>

      <p>
        ${Number(category.count || 0)}
        songs ·
        ${Number(category.youtube || 0)}
        YouTube
      </p>
    </article>
  `).join('');

  element
    .querySelectorAll('[data-category]')
    .forEach(card => {
      card.addEventListener(
        'click',
        () => filterCategory(card.dataset.category)
      );
    });
}

function renderSide(categories) {
  const element = $('#sideCategories');

  if (!element) return;

  element.innerHTML = categories.map(category => `
    <button data-category="${esc(category.name)}">
      ${esc(category.name)}
      <small>${Number(category.count || 0)}</small>
    </button>
  `).join('');

  element
    .querySelectorAll('[data-category]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => filterCategory(button.dataset.category)
      );
    });
}

function symbolFor(name) {
  const value = String(name || '').toLowerCase();

  if (value.includes('love')) return '♥';
  if (
    value.includes('bhakti') ||
    value.includes('ganpati')
  ) return 'ॐ';

  if (value.includes('marathi')) return 'म';

  if (
    value.includes('energy') ||
    value.includes('energetic')
  ) return '⚡';

  if (value.includes('emotional')) return '◒';

  return '♫';
}

function songCard(song) {
  const youtube = song.source_type === 'youtube';

  return `
    <article class="song-card">

      <div class="art">

        <img
          src="${esc(imageFor(song))}"
          alt=""
          onerror="this.style.display='none'"
        >

        <span class="source">
          ${youtube ? '▶ YOUTUBE' : '♫ MP3'}
        </span>

      </div>

      <div class="body">

        <h3>${esc(song.title)}</h3>

        <p>
          ${esc(song.artist || 'SwarAJ')}
          ·
          ${esc(song.category || 'All Songs')}
        </p>

        <div class="card-actions">

          <button
            class="play-now"
            type="button"
            data-play-id="${esc(song.id)}"
          >
            ▶ Play
          </button>

          <button
            type="button"
            data-favorite-id="${esc(song.id)}"
          >
            ${isFavorite(song) ? '♥' : '♡'}
          </button>

        </div>

      </div>

    </article>
  `;
}

function renderInto(element, songs) {
  if (!element) return;

  if (!songs.length) {
    element.innerHTML =
      '<div class="panel glass">No songs found.</div>';
    return;
  }

  element.innerHTML =
    songs.map(songCard).join('');

  element
    .querySelectorAll('[data-play-id]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => playById(button.dataset.playId)
      );
    });

  element
    .querySelectorAll('[data-favorite-id]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const song = state.songs.find(
            item =>
              String(item.id) ===
              String(button.dataset.favoriteId)
          );

          if (song) {
            toggleFavorite(song);
          }
        }
      );
    });
}

function renderAll() {
  renderInto(
    $('#homeSongs'),
    state.songs.slice(0, 24)
  );

  renderInto(
    $('#musicSongs'),
    state.songs.filter(
      song => song.source_type === 'mp3'
    )
  );

  renderInto(
    $('#youtubeSongs'),
    state.songs.filter(
      song => song.source_type === 'youtube'
    )
  );

  renderInto(
    $('#librarySongs'),
    state.songs
  );

  renderInto(
    $('#favoriteSongs'),
    state.songs.filter(isFavorite)
  );

  updateLikeButton();
}

function filterCategory(category) {
  showView('music');

  const songs = state.songs.filter(
    song =>
      String(song.category) ===
      String(category)
  );

  renderInto(
    $('#musicSongs'),
    songs
  );

  toast(
    `${category}: ${songs.length} song${songs.length === 1 ? '' : 's'}`
  );
}

function searchSongs(query) {
  const value = query
    .trim()
    .toLowerCase();

  const clear = $('#clear');
  const resultsSection = $('#searchResults');

  if (clear) {
    clear.hidden = !value;
  }

  if (!value) {
    if (resultsSection) {
      resultsSection.hidden = true;
    }

    return;
  }

  const songs = state.songs.filter(song =>
    [
      song.title,
      song.artist,
      song.album,
      song.category,
      song.language
    ].some(item =>
      String(item || '')
        .toLowerCase()
        .includes(value)
    )
  );

  if (resultsSection) {
    resultsSection.hidden = false;
  }

  const resultTitle = $('#resultTitle');

  if (resultTitle) {
    resultTitle.textContent =
      `${songs.length} result${songs.length === 1 ? '' : 's'} for “${query}”`;
  }

  renderInto(
    $('#results'),
    songs
  );
}

function showView(view) {
  state.view = view;

  document
    .querySelectorAll('.view')
    .forEach(element => {
      element.hidden = true;
    });

  const viewElement = $(`#${view}View`);

  if (viewElement) {
    viewElement.hidden = false;
  }

  document
    .querySelectorAll('.nav')
    .forEach(nav => {
      nav.classList.toggle(
        'active',
        nav.dataset.view === view
      );
    });

  if (view === 'admin') {
    loadAdminSongs();
  }
}

function stopYouTube() {
  try {
    if (
      state.yt &&
      typeof state.yt.stopVideo === 'function'
    ) {
      state.yt.stopVideo();
    }
  } catch (error) {
    console.warn(
      'YouTube stop error:',
      error
    );
  }
}

function ensureYouTubeApi() {
  if (
    state.ytReady &&
    window.YT &&
    window.YT.Player
  ) {
    return Promise.resolve();
  }

  if (state.ytLoading) {
    return new Promise(resolve => {
      const timer = setInterval(() => {
        if (
          state.ytReady &&
          window.YT &&
          window.YT.Player
        ) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  state.ytLoading = true;

  return new Promise(resolve => {

    if (
      window.YT &&
      window.YT.Player
    ) {
      state.ytReady = true;
      state.ytLoading = false;
      resolve();
      return;
    }

    const previous =
      window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady =
      () => {

        state.ytReady = true;
        state.ytLoading = false;

        if (
          typeof previous === 'function'
        ) {
          previous();
        }

        resolve();
      };

    if (
      !document.querySelector(
        'script[data-youtube-api]'
      )
    ) {
      const script =
        document.createElement('script');

      script.src =
        'https://www.youtube.com/iframe_api';

      script.async = true;

      script.dataset.youtubeApi = 'true';

      document.head.appendChild(script);
    }
  });
}

async function playYouTube(song) {
  if (!song.youtube_id) {
    toast(
      'This YouTube song has no valid video ID.'
    );
    return;
  }

  try {
    audio.pause();
    audio.removeAttribute('src');

    await ensureYouTubeApi();

    const options = {
      height: '100%',
      width: '100%',

      videoId: song.youtube_id,

      playerVars: {
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        controls: 1
      },

      events: {
        onReady: event => {
          event.target.playVideo();
        },

        onStateChange: handleYouTubeState,

        onError: event => {
          toast(
            `YouTube player error: ${event.data}`
          );
        }
      }
    };

    if (!state.yt) {

      state.yt =
        new YT.Player(
          'ytPlayer',
          options
        );

    } else if (
      typeof state.yt.loadVideoById ===
      'function'
    ) {

      state.yt.loadVideoById(
        song.youtube_id
      );
    }

    setMode('music');

    if (E.videoMode) {
      E.videoMode.hidden = false;
    }

    if (E.source) {
      E.source.textContent = 'YOUTUBE';
    }

    updatePlayer(song);
    setPlaying(true);

  } catch (error) {

    console.error(
      'YOUTUBE PLAY ERROR:',
      error
    );

    toast(
      `Unable to play YouTube video: ${error.message}`
    );
  }
}

function handleYouTubeState(event) {

  if (!window.YT) return;

  if (
    event.data ===
    YT.PlayerState.PLAYING
  ) {
    setPlaying(true);
  }

  if (
    event.data ===
    YT.PlayerState.PAUSED
  ) {
    setPlaying(false);
  }

  if (
    event.data ===
    YT.PlayerState.ENDED
  ) {
    setPlaying(false);
    nextSong();
  }
}

function playMp3(song) {

  const source =
    song.audio_url ||
    song.file_url ||
    song.url;

  if (!source) {
    toast(
      'This MP3 has no audio URL.'
    );
    return;
  }

  stopYouTube();

  audio.src = source;
  audio.load();

  audio.play()
    .then(() => setPlaying(true))
    .catch(error => {

      console.error(
        'MP3 PLAY ERROR:',
        error
      );

      toast(
        'Unable to play MP3. Check the audio URL.'
      );

      setPlaying(false);
    });

  setMode('music');

  if (E.videoMode) {
    E.videoMode.hidden = true;
  }

  if (E.source) {
    E.source.textContent = 'MP3';
  }

  updatePlayer(song);
}

function playById(id) {

  const index =
    state.songs.findIndex(
      song =>
        String(song.id) ===
        String(id)
    );

  if (index < 0) {
    toast(
      'Song not found.'
    );
    return;
  }

  const song =
    state.songs[index];

  state.current = song;
  state.index = index;

  if (!state.queue.length) {
    state.queue = [
      ...state.songs
    ];
  }

  state.queueIndex =
    state.queue.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  if (state.queueIndex < 0) {
    state.queue.push(song);
    state.queueIndex =
      state.queue.length - 1;
  }

  if (
    song.source_type === 'youtube'
  ) {
    playYouTube(song);
  } else {
    playMp3(song);
  }

  renderQueue();
}

function updatePlayer(song) {

  if (E.title) {
    E.title.textContent =
      song.title;
  }

  if (E.artist) {
    E.artist.textContent =
      song.artist || 'SwarAJ';
  }

  if (E.fullTitle) {
    E.fullTitle.textContent =
      song.title;
  }

  if (E.fullArtist) {
    E.fullArtist.textContent =
      song.artist || 'SwarAJ';
  }

  if (E.cover) {
    E.cover.src =
      imageFor(song);
  }

  if (E.fullCover) {
    E.fullCover.src =
      imageFor(song);
  }

  updateLikeButton();

  document.title =
    `${song.title} — स्वरAJ`;
}

function updateLikeButton() {

  if (!E.like) return;

  E.like.textContent =
    state.current &&
    isFavorite(state.current)
      ? '♥'
      : '♡';
}

function setPlaying(playing) {

  if (E.play) {
    E.play.textContent =
      playing ? 'Ⅱ' : '▶';
  }

  if (E.fullPlay) {
    E.fullPlay.textContent =
      playing ? 'Ⅱ' : '▶';
  }
}

function togglePlay() {

  if (!state.current) {

    if (state.songs.length) {
      playById(
        state.songs[0].id
      );
    }

    return;
  }

  if (
    state.current.source_type ===
    'youtube'
  ) {

    if (!state.yt) {
      playYouTube(
        state.current
      );
      return;
    }

    const playerState =
      state.yt.getPlayerState?.();

    if (
      window.YT &&
      playerState ===
      YT.PlayerState.PLAYING
    ) {

      state.yt.pauseVideo();
      setPlaying(false);

    } else {

      state.yt.playVideo();
      setPlaying(true);
    }

    return;
  }

  if (audio.paused) {

    audio.play()
      .then(() => setPlaying(true))
      .catch(() =>
        toast(
          'Unable to resume MP3.'
        )
      );

  } else {

    audio.pause();
    setPlaying(false);
  }
}

function nextSong() {

  if (!state.queue.length) {
    return;
  }

  if (
    state.repeat === 1 &&
    state.current
  ) {

    if (
      state.current.source_type ===
      'youtube'
    ) {

      state.yt?.seekTo?.(0);
      state.yt?.playVideo?.();

    } else {

      audio.currentTime = 0;

      audio.play()
        .catch(() => {});
    }

    return;
  }

  let nextIndex;

  if (state.shuffle) {

    nextIndex =
      Math.floor(
        Math.random() *
        state.queue.length
      );

  } else {

    nextIndex =
      state.queueIndex + 1;

    if (
      nextIndex >=
      state.queue.length
    ) {

      if (state.repeat === 2) {
        nextIndex = 0;
      } else {
        return;
      }
    }
  }

  state.queueIndex =
    nextIndex;

  const song =
    state.queue[nextIndex];

  state.current = song;

  state.index =
    state.songs.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  if (
    song.source_type ===
    'youtube'
  ) {
    playYouTube(song);
  } else {
    playMp3(song);
  }

  renderQueue();
}

function previousSong() {

  if (
    state.current?.source_type ===
    'mp3' &&
    audio.currentTime > 3
  ) {

    audio.currentTime = 0;
    return;
  }

  if (
    state.current?.source_type ===
    'youtube' &&
    state.yt?.getCurrentTime?.() > 3
  ) {

    state.yt.seekTo(0);
    return;
  }

  if (!state.queue.length) {
    return;
  }

  let index =
    state.queueIndex - 1;

  if (index < 0) {
    index =
      state.queue.length - 1;
  }

  state.queueIndex =
    index;

  const song =
    state.queue[index];

  state.current = song;

  state.index =
    state.songs.findIndex(
      item =>
        String(item.id) ===
        String(song.id)
    );

  if (
    song.source_type ===
    'youtube'
  ) {
    playYouTube(song);
  } else {
    playMp3(song);
  }

  renderQueue();
}

function setMode(mode) {

  if (
    mode === 'video' &&
    state.current?.source_type !==
    'youtube'
  ) {
    return;
  }

  state.mode = mode;

  if (E.musicMode) {
    E.musicMode.classList.toggle(
      'active',
      mode === 'music'
    );
  }

  if (E.videoMode) {
    E.videoMode.classList.toggle(
      'active',
      mode === 'video'
    );
  }

  if (E.videoWrap) {

    E.videoWrap.classList.toggle(
      'hidden',
      !(
        mode === 'video' &&
        state.current?.source_type ===
        'youtube'
      )
    );
  }

  if (
    mode === 'video' &&
    E.fullPlayer
  ) {
    E.fullPlayer.classList.add(
      'open'
    );
  }
}

function renderQueue() {

  if (!E.queue) return;

  if (!state.queue.length) {

    E.queue.innerHTML =
      '<div class="panel glass">Queue is empty.</div>';

    return;
  }

  E.queue.innerHTML =
    state.queue.map(
      (song, index) => `
        <div
          class="queue-row"
          data-queue-index="${index}"
        >

          <img
            src="${esc(imageFor(song))}"
            alt=""
            onerror="this.style.display='none'"
          >

          <div>
            <b>${esc(song.title)}</b>
            <br>
            <small>
              ${
                song.source_type ===
                'youtube'
                  ? 'YouTube'
                  : 'MP3'
              }
              ·
              ${esc(song.artist || 'SwarAJ')}
            </small>
          </div>

        </div>
      `
    ).join('');

  E.queue
    .querySelectorAll(
      '[data-queue-index]'
    )
    .forEach(row => {

      row.addEventListener(
        'click',
        () => {

          const index =
            Number(
              row.dataset.queueIndex
            );

          const song =
            state.queue[index];

          if (!song) return;

          state.queueIndex =
            index;

          state.current =
            song;

          state.index =
            state.songs.findIndex(
              item =>
                String(item.id) ===
                String(song.id)
            );

          if (
            song.source_type ===
            'youtube'
          ) {
            playYouTube(song);
          } else {
            playMp3(song);
          }

          renderQueue();
        }
      );
    });
}

async function loadAdminSongs() {

  const status =
    $('#adminStatus');

  const container =
    $('#adminSongs');

  if (!state.adminToken) {

    if (status) {
      status.textContent =
        'Enter ADMIN_TOKEN';
    }

    return;
  }

  try {

    const data =
      await api(
        '/api/admin/songs',
        {
          headers: {
            'x-admin-token':
              state.adminToken
          }
        }
      );

    if (status) {
      status.textContent =
        `Connected · ${data.count || 0} songs`;
    }

    if (container) {

      container.innerHTML =
        (data.songs || [])
          .map(song => `
            <div class="admin-row">

              <span>
                ${esc(song.title)}
                <small>
                  (${esc(song.source_type)})
                </small>
              </span>

              <button
                type="button"
                data-delete-id="${esc(song.id)}"
              >
                Delete
              </button>

            </div>
          `)
          .join('') ||
        '<small>No database songs.</small>';

      container
        .querySelectorAll(
          '[data-delete-id]'
        )
        .forEach(button => {

          button.addEventListener(
            'click',
            () =>
              deleteAdminSong(
                button.dataset.deleteId
              )
          );
        });
    }

  } catch (error) {

    console.error(
      'ADMIN LIST ERROR:',
      error
    );

    if (status) {
      status.textContent =
        error.message;
    }
  }
}

async function deleteAdminSong(id) {

  if (
    !confirm(
      'Delete this song?'
    )
  ) {
    return;
  }

  try {

    await api(
      `/api/admin/songs/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          'x-admin-token':
            state.adminToken
        }
      }
    );

    toast('Song deleted');

    await load();
    await loadAdminSongs();

  } catch (error) {

    toast(error.message);
  }
}

async function submitYouTube(event) {

  event.preventDefault();

  if (!state.adminToken) {
    toast(
      'Connect admin first.'
    );
    return;
  }

  const formData =
    new FormData(
      event.target
    );

  formData.set(
    'source_type',
    'youtube'
  );

  try {

    const data =
      await api(
        '/api/admin/songs',
        {
          method: 'POST',

          headers: {
            'x-admin-token':
              state.adminToken
          },

          body: formData
        }
      );

    toast(
      `Added ${
        data.song?.title ||
        'YouTube song'
      }`
    );

    event.target.reset();

    await load();
    await loadAdminSongs();

  } catch (error) {

    console.error(
      'ADD YOUTUBE ERROR:',
      error
    );

    toast(error.message);
  }
}

async function submitMP3(event) {

  event.preventDefault();

  if (!state.adminToken) {
    toast(
      'Connect admin first.'
    );
    return;
  }

  const formData =
    new FormData(
      event.target
    );

  formData.set(
    'source_type',
    'mp3'
  );

  try {

    const data =
      await api(
        '/api/admin/upload',
        {
          method: 'POST',

          headers: {
            'x-admin-token':
              state.adminToken
          },

          body: formData
        }
      );

    toast(
      `Uploaded ${
        data.song?.title ||
        'MP3 song'
      }`
    );

    event.target.reset();

    await load();
    await loadAdminSongs();

  } catch (error) {

    console.error(
      'ADD MP3 ERROR:',
      error
    );

    toast(error.message);
  }
}

function formatTime(seconds) {

  const value =
    Number(seconds) || 0;

  return `${Math.floor(value / 60)}:${String(
    Math.floor(value % 60)
  ).padStart(2, '0')}`;
}

/* Navigation */

if ($('#menu')) {

  $('#menu').addEventListener(
    'click',
    () =>
      $('#sidebar')?.classList.toggle(
        'open'
      )
  );
}

document
  .querySelectorAll('.nav')
  .forEach(nav => {

    nav.addEventListener(
      'click',
      () =>
        showView(
          nav.dataset.view
        )
    );
  });

if ($('#search')) {

  $('#search').addEventListener(
    'input',
    event =>
      searchSongs(
        event.target.value
      )
  );
}

if ($('#clear')) {

  $('#clear').addEventListener(
    'click',
    () => {

      $('#search').value = '';

      searchSongs('');
    }
  );
}

if ($('#refresh')) {
  $('#refresh').addEventListener(
    'click',
    load
  );
}

if ($('#showAll')) {

  $('#showAll').addEventListener(
    'click',
    () => {

      showView('home');
      renderAll();

    }
  );
}

if ($('#playAll')) {

  $('#playAll').addEventListener(
    'click',
    () => {

      if (state.songs.length) {
        playById(
          state.songs[0].id
        );
      }

    }
  );
}

if ($('#shuffleAll')) {

  $('#shuffleAll').addEventListener(
    'click',
    () => {

      state.shuffle = true;

      if (!state.queue.length) {
        state.queue = [
          ...state.songs
        ];
      }

      nextSong();

    }
  );
}

/* Player */

if (E.play) {
  E.play.addEventListener(
    'click',
    togglePlay
  );
}

if (E.fullPlay) {
  E.fullPlay.addEventListener(
    'click',
    togglePlay
  );
}

if (E.prev) {
  E.prev.addEventListener(
    'click',
    previousSong
  );
}

if (E.fullPrev) {
  E.fullPrev.addEventListener(
    'click',
    previousSong
  );
}

if (E.next) {
  E.next.addEventListener(
    'click',
    nextSong
  );
}

if (E.fullNext) {
  E.fullNext.addEventListener(
    'click',
    nextSong
  );
}

if (E.like) {

  E.like.addEventListener(
    'click',
    () => {

      if (state.current) {
        toggleFavorite(
          state.current
        );
      }

    }
  );
}

if ($('#expand')) {

  $('#expand').addEventListener(
    'click',
    () =>
      E.fullPlayer?.classList.toggle(
        'open'
      )
  );
}

if (E.musicMode) {

  E.musicMode.addEventListener(
    'click',
    () =>
      setMode('music')
  );
}

if (E.videoMode) {

  E.videoMode.addEventListener(
    'click',
    () =>
      setMode('video')
  );
}

if ($('#shuffle')) {

  $('#shuffle').addEventListener(
    'click',
    () => {

      state.shuffle =
        !state.shuffle;

      toast(
        state.shuffle
          ? 'Shuffle on'
          : 'Shuffle off'
      );
    }
  );
}

if ($('#repeat')) {

  $('#repeat').addEventListener(
    'click',
    () => {

      state.repeat =
        (state.repeat + 1) % 3;

      toast(
        [
          'Repeat off',
          'Repeat one',
          'Repeat all'
        ][state.repeat]
      );
    }
  );
}

if ($('#clearQueue')) {

  $('#clearQueue').addEventListener(
    'click',
    () => {

      state.queue = [];
      state.queueIndex = -1;

      renderQueue();

      toast('Queue cleared');

    }
  );
}

if (E.volume) {

  E.volume.addEventListener(
    'input',
    event => {

      const volume =
        Number(event.target.value);

      audio.volume = volume;

      if (
        state.yt?.setVolume
      ) {
        state.yt.setVolume(
          volume * 100
        );
      }

    }
  );
}

audio.volume = 0.8;

/* MP3 progress */

audio.addEventListener(
  'timeupdate',
  () => {

    if (E.cur) {
      E.cur.textContent =
        formatTime(
          audio.currentTime
        );
    }

    if (audio.duration) {

      if (E.dur) {
        E.dur.textContent =
          formatTime(
            audio.duration
          );
      }

      if (E.seek) {
        E.seek.value =
          (
            audio.currentTime /
            audio.duration
          ) * 100;
      }
    }

  }
);

audio.addEventListener(
  'loadedmetadata',
  () => {

    if (E.dur) {
      E.dur.textContent =
        formatTime(
          audio.duration
        );
    }

  }
);

audio.addEventListener(
  'play',
  () =>
    setPlaying(true)
);

audio.addEventListener(
  'pause',
  () =>
    setPlaying(false)
);

audio.addEventListener(
  'ended',
  nextSong
);

audio.addEventListener(
  'error',
  () => {

    if (
      state.current?.source_type ===
      'mp3'
    ) {

      console.error(
        'Audio error:',
        audio.error
      );

      toast(
        'MP3 could not be loaded. Check the audio file URL.'
      );
    }

  }
);

/* Seek */

if (E.seek) {

  E.seek.addEventListener(
    'input',
    event => {

      const percentage =
        Number(
          event.target.value
        );

      if (
        state.current?.source_type ===
          'mp3' &&
        audio.duration
      ) {

        audio.currentTime =
          audio.duration *
          percentage /
          100;

      } else if (
        state.current?.source_type ===
          'youtube' &&
        state.yt?.getDuration
      ) {

        state.yt.seekTo(
          state.yt.getDuration() *
          percentage /
          100,
          true
        );
      }

    }
  );
}

/* YouTube progress */

setInterval(
  () => {

    if (
      state.current?.source_type !==
      'youtube'
    ) {
      return;
    }

    if (
      !state.yt?.getCurrentTime
    ) {
      return;
    }

    try {

      const current =
        state.yt.getCurrentTime();

      const duration =
        state.yt.getDuration();

      if (E.cur) {
        E.cur.textContent =
          formatTime(current);
      }

      if (E.dur) {
        E.dur.textContent =
          formatTime(duration);
      }

      if (
        E.seek &&
        duration
      ) {
        E.seek.value =
          (
            current /
            duration
          ) * 100;
      }

    } catch (_) {}

  },
  500
);

/* Admin */

if ($('#saveToken')) {

  $('#saveToken').addEventListener(
    'click',
    () => {

      state.adminToken =
        $('#adminToken')
          .value
          .trim();

      localStorage.setItem(
        'swaraj-admin-token',
        state.adminToken
      );

      loadAdminSongs();

    }
  );
}

if ($('#adminToken')) {
  $('#adminToken').value =
    state.adminToken;
}

if ($('#ytForm')) {

  $('#ytForm').addEventListener(
    'submit',
    submitYouTube
  );
}

if ($('#mp3Form')) {

  $('#mp3Form').addEventListener(
    'submit',
    submitMP3
  );
}

/* Start */

load();
","sha":"696e47b57f636d5f72df4a54cc8f63efb33e9af3","branch":"main","message":"Fix SwarAJ song loading and player initialization"}