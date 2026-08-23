const audio = document.getElementById("audio");
const state = {
  songs: [],
  filtered: [],
  index: -1,
  shuffle: false,
  repeat: false,
  liked: JSON.parse(localStorage.getItem("swaraj-liked") || "[]")
};

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function load() {
  try {
    const [songsRes, catsRes] = await Promise.all([
      fetch("/api/songs"),
      fetch("/api/categories")
    ]);
    if (!songsRes.ok) throw new Error("Unable to load songs");
    state.songs = await songsRes.json();
    const cats = catsRes.ok ? await catsRes.json() : [];
    $("songCount").textContent = state.songs.length;
    renderCategories(cats);
    renderSongs(state.songs);
    if (!state.songs.length) {
      $("songList").innerHTML = `<div class="empty">No songs found.<br><br>Add MP3 files inside the <b>songs/</b> folder and redeploy.</div>`;
    }
  } catch (err) {
    $("songCount").textContent = "0";
    $("songList").innerHTML = `<div class="empty">Unable to load songs.<br><br>${esc(err.message)}</div>`;
  }
}

function renderCategories(cats) {
  const icons = ["♫","♥","🙏","⚡","💔","🎧","🎼"];
  $("categories").innerHTML = cats.length
    ? cats.map((c,i) => `
      <button class="category" onclick="filterCategory(${JSON.stringify(c.name)})">
        <div class="category-icon">${icons[i % icons.length]}</div>
        <h3>${esc(c.name)}</h3>
        <p>${c.count} song${c.count === 1 ? "" : "s"}</p>
      </button>`).join("")
    : `<div class="empty">No categories yet.</div>`;

  $("sideCategories").innerHTML = cats.map(c =>
    `<button class="cat-side" onclick="filterCategory(${JSON.stringify(c.name)})">${esc(c.name)} <small>(${c.count})</small></button>`
  ).join("");
}

function renderSongs(songs) {
  state.filtered = songs;
  $("songList").innerHTML = songs.length ? songs.map((s, i) => `
    <div class="song">
      <img src="${esc(s.cover)}" onerror="this.src='/images/default-cover.svg'" alt="">
      <div class="song-info">
        <b>${esc(s.title)}</b>
        <span>${esc(s.artist)} • ${esc(s.album)}</span>
      </div>
      <button onclick="toggleLike('${s.id}')" title="Like">${state.liked.includes(s.id) ? "♥" : "♡"}</button>
      <button class="play-small" onclick="playFromList(${i})">▶</button>
    </div>`).join("") : `<div class="empty">No matching songs.</div>`;
}

window.playFromList = i => {
  const song = state.filtered[i];
  const globalIndex = state.songs.findIndex(s => s.id === song.id);
  play(globalIndex);
};

window.filterCategory = category => {
  const songs = state.songs.filter(s => category === "All Songs" || s.category === category);
  $("songsTitle").textContent = category;
  $("songsSubtitle").textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}`;
  renderSongs(songs);
  $("songsSection").scrollIntoView({ behavior: "smooth" });
  closeMenu();
};

function play(i) {
  if (!state.songs[i]) return;
  state.index = i;
  const song = state.songs[i];
  audio.src = song.url;
  audio.load();
  audio.play().catch(() => {});
  $("nowTitle").textContent = song.title;
  $("nowArtist").textContent = `${song.artist} • ${song.album}`;
  $("cover").src = song.cover;
  $("playBtn").textContent = "❚❚";
  $("likeBtn").textContent = state.liked.includes(song.id) ? "♥" : "♡";
}

function next() {
  if (!state.songs.length) return;
  if (state.shuffle) {
    let n = Math.floor(Math.random() * state.songs.length);
    if (state.songs.length > 1 && n === state.index) n = (n + 1) % state.songs.length;
    play(n);
  } else {
    play((state.index + 1) % state.songs.length);
  }
}

function previous() {
  if (!state.songs.length) return;
  play((state.index - 1 + state.songs.length) % state.songs.length);
}

function toggleLike(id) {
  if (state.liked.includes(id)) state.liked = state.liked.filter(x => x !== id);
  else state.liked.push(id);
  localStorage.setItem("swaraj-liked", JSON.stringify(state.liked));
  if (state.index >= 0) $("likeBtn").textContent = state.liked.includes(state.songs[state.index].id) ? "♥" : "♡";
  renderSongs(state.filtered);
}

$("playBtn").onclick = () => {
  if (state.index < 0) return state.songs.length && play(0);
  if (audio.paused) {
    audio.play();
    $("playBtn").textContent = "❚❚";
  } else {
    audio.pause();
    $("playBtn").textContent = "▶";
  }
};

$("nextBtn").onclick = next;
$("prevBtn").onclick = previous;

$("shuffleBtn").onclick = () => {
  state.shuffle = !state.shuffle;
  $("shuffleBtn").style.color = state.shuffle ? "#ff3192" : "";
};

$("repeatBtn").onclick = () => {
  state.repeat = !state.repeat;
  $("repeatBtn").style.color = state.repeat ? "#ff3192" : "";
};

$("likeBtn").onclick = () => {
  if (state.index >= 0) toggleLike(state.songs[state.index].id);
};

audio.addEventListener("loadedmetadata", () => {
  $("duration").textContent = formatTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  $("currentTime").textContent = formatTime(audio.currentTime);
  $("progress").value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
});

audio.addEventListener("ended", () => {
  if (state.repeat) play(state.index);
  else next();
});

$("progress").oninput = e => {
  if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
};

$("volume").oninput = e => audio.volume = Number(e.target.value);
audio.volume = 0.9;

$("search").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  const songs = !q ? state.songs : state.songs.filter(s =>
    [s.title,s.artist,s.album,s.category].some(v => v.toLowerCase().includes(q))
  );
  $("songsTitle").textContent = q ? `Search: ${e.target.value}` : "All Songs";
  renderSongs(songs);
});

$("exploreBtn").onclick = () => $("songsSection").scrollIntoView({behavior:"smooth"});
$("viewAll").onclick = () => filterCategory("All Songs");

$("menuBtn").onclick = () => {
  $("sidebar").classList.toggle("open");
  $("overlay").classList.toggle("show");
};
$("overlay").onclick = closeMenu;

function closeMenu() {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
}

load();