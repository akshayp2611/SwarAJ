:root {
  --bg: #07070b;
  --bg-2: #0c0c12;
  --card: rgba(255,255,255,.055);
  --card-hover: rgba(255,255,255,.09);
  --border: rgba(255,255,255,.09);
  --text: #ffffff;
  --muted: #9b9ba7;
  --accent: #a855f7;
  --accent-2: #ec4899;
  --accent-3: #6366f1;
  --green: #22c55e;
  --radius: 22px;
  --player-height: 92px;
  --sidebar-width: 245px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background:
    radial-gradient(
      circle at 75% 10%,
      rgba(124,58,237,.13),
      transparent 28%
    ),
    radial-gradient(
      circle at 20% 60%,
      rgba(236,72,153,.06),
      transparent 25%
    ),
    var(--bg);

  color: var(--text);
  font-family: Inter, sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
}

/* Sidebar */

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width);

  padding: 26px 18px 18px;

  background: rgba(7,7,11,.86);
  border-right: 1px solid var(--border);

  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);

  z-index: 100;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px 30px;
}

.brand-icon {
  width: 43px;
  height: 43px;

  border-radius: 14px;

  display: grid;
  place-items: center;

  font-family: Outfit, sans-serif;
  font-weight: 800;
  font-size: 18px;

  background:
    linear-gradient(
      135deg,
      var(--accent),
      var(--accent-2)
    );

  box-shadow:
    0 8px 30px rgba(168,85,247,.35);
}

.brand-name {
  font-family: Outfit, sans-serif;
  font-weight: 800;
  font-size: 21px;
}

.brand-subtitle {
  font-size: 8px;
  letter-spacing: 3px;
  color: var(--muted);
  margin-top: 1px;
}

.navigation {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 13px;

  width: 100%;
  padding: 13px 14px;

  color: var(--muted);
  background: transparent;

  border-radius: 13px;

  text-align: left;
  transition: .25s;
}

.nav-item span:first-child {
  width: 22px;
  text-align: center;
  font-size: 20px;
}

.nav-item:hover,
.nav-item.active {
  color: white;
  background: rgba(255,255,255,.07);
}

.nav-item.active {
  box-shadow:
    inset 3px 0 0 var(--accent);
}

.sidebar-title {
  margin: 30px 10px 12px;

  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;

  color: #676773;
}

.sidebar-categories {
  overflow-y: auto;
  flex: 1;
}

.sidebar-category {
  display: flex;
  justify-content: space-between;
  align-items: center;

  width: 100%;

  padding: 10px;

  color: var(--muted);
  background: transparent;

  border-radius: 10px;

  text-align: left;
}

.sidebar-category:hover {
  color: white;
  background: rgba(255,255,255,.05);
}

.sidebar-category-count {
  font-size: 11px;
  opacity: .5;
}

.sidebar-bottom {
  padding-top: 15px;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 10px;

  font-size: 10px;
  color: #7f7f8b;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);

  box-shadow:
    0 0 12px rgba(34,197,94,.7);
}

.copyright {
  padding: 4px 10px;
  color: #494951;
  font-size: 10px;
}

/* Main */

.main {
  margin-left: var(--sidebar-width);
  padding-bottom: calc(var(--player-height) + 25px);
}

.topbar {
  height: 78px;

  position: sticky;
  top: 0;

  z-index: 50;

  display: flex;
  align-items: center;
  gap: 20px;

  padding: 0 36px;

  background: rgba(7,7,11,.72);

  border-bottom: 1px solid rgba(255,255,255,.04);

  backdrop-filter: blur(20px);
}

.search-wrapper {
  position: relative;
  max-width: 590px;
  width: 100%;
}

.search-wrapper input {
  width: 100%;
  height: 44px;

  border: 1px solid var(--border);
  border-radius: 14px;

  padding: 0 42px;

  background: rgba(255,255,255,.055);

  color: white;
  outline: none;

  transition: .2s;
}

.search-wrapper input:focus {
  border-color: rgba(168,85,247,.55);

  box-shadow:
    0 0 0 4px rgba(168,85,247,.08);
}

.search-icon {
  position: absolute;
  left: 15px;
  top: 10px;

  color: #777783;
  font-size: 21px;
}

.clear-search {
  position: absolute;
  right: 12px;
  top: 9px;

  color: #999;
  background: transparent;

  font-size: 21px;
}

.top-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
}

.icon-button,
.profile-button {
  width: 42px;
  height: 42px;

  border-radius: 13px;

  color: #aaa;
  background: rgba(255,255,255,.05);

  border: 1px solid var(--border);
}

.profile-button {
  color: white;

  font-weight: 700;

  background:
    linear-gradient(
      135deg,
      rgba(168,85,247,.5),
      rgba(236,72,153,.35)
    );
}

/* Content */

.content {
  max-width: 1450px;
  margin: auto;
  padding: 28px 36px;
}

.hero {
  min-height: 405px;

  position: relative;
  overflow: hidden;

  border-radius: 30px;

  border: 1px solid var(--border);

  background:
    linear-gradient(
      120deg,
      rgba(168,85,247,.2),
      rgba(236,72,153,.08) 50%,
      rgba(20,20,30,.9)
    );

  box-shadow:
    0 30px 100px rgba(0,0,0,.3);
}

.hero-background {
  position: absolute;
  inset: 0;

  background:
    radial-gradient(
      circle at 75% 40%,
      rgba(168,85,247,.3),
      transparent 30%
    ),
    radial-gradient(
      circle at 95% 100%,
      rgba(236,72,153,.2),
      transparent 30%
    );
}

.hero-content {
  position: relative;
  z-index: 2;

  padding: 55px 58px;
  max-width: 690px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  padding: 8px 12px;

  border: 1px solid rgba(255,255,255,.09);
  border-radius: 100px;

  background: rgba(255,255,255,.05);

  color: #c6b9d5;

  font-size: 9px;
  letter-spacing: 1.6px;
  font-weight: 700;
}

.pulse {
  width: 6px;
  height: 6px;

  border-radius: 50%;

  background: #c084fc;

  box-shadow: 0 0 10px #c084fc;
}

.hero h1 {
  margin-top: 22px;

  font-family: Outfit, sans-serif;
  font-size: clamp(42px, 5vw, 72px);
  line-height: .98;
  letter-spacing: -3px;
}

.hero h1 span {
  background:
    linear-gradient(
      90deg,
      #c084fc,
      #f472b6
    );

  -webkit-background-clip: text;
  background-clip: text;

  color: transparent;
}

.hero p {
  margin-top: 20px;

  max-width: 500px;

  color: #a6a6b3;

  line-height: 1.7;
  font-size: 14px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 27px;
}

.primary-button,
.secondary-button {
  height: 46px;

  padding: 0 20px;

  border-radius: 13px;

  display: flex;
  align-items: center;
  gap: 9px;

  font-weight: 700;
}

.primary-button {
  color: white;

  background:
    linear-gradient(
      135deg,
      #9333ea,
      #db2777
    );

  box-shadow:
    0 10px 30px rgba(168,85,247,.3);
}

.secondary-button {
  color: #ddd;
  background: rgba(255,255,255,.07);
  border: 1px solid var(--border);
}

.hero-decoration {
  position: absolute;
  right: 8%;
  top: 50%;

  transform: translateY(-50%);
}

.disc {
  width: 255px;
  height: 255px;

  border-radius: 50%;

  background:
    repeating-radial-gradient(
      circle,
      #15151d 0,
      #15151d 2px,
      #09090e 3px,
      #09090e 7px
    );

  box-shadow:
    0 0 0 18px rgba(255,255,255,.015),
    0 35px 70px rgba(0,0,0,.6);

  display: grid;
  place-items: center;

  animation: spin 12s linear infinite;
}

.disc-center {
  width: 75px;
  height: 75px;

  border-radius: 50%;

  display: grid;
  place-items: center;

  font-family: Outfit;
  font-size: 25px;
  font-weight: 800;

  background:
    linear-gradient(
      135deg,
      #a855f7,
      #ec4899
    );

  box-shadow:
    0 0 35px rgba(168,85,247,.5);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Stats */

.stats {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 14px;

  margin: 20px 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 13px;

  padding: 17px 19px;

  border: 1px solid var(--border);
  border-radius: 17px;

  background: var(--card);
}

.stat-icon {
  width: 40px;
  height: 40px;

  display: grid;
  place-items: center;

  border-radius: 12px;

  background: rgba(168,85,247,.12);

  color: #c084fc;
}

.stat-card strong {
  display: block;

  font-family: Outfit;
  font-size: 20px;
}

.stat-card span {
  color: #777783;
  font-size: 10px;
}

/* Sections */

.section {
  margin-top: 38px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;

  margin-bottom: 18px;
}

.eyebrow {
  color: #8b5cf6;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.8px;
  margin-bottom: 5px;
}

.section-heading h2 {
  font-family: Outfit;
  font-size: 27px;
}

.text-button {
  background: transparent;
  color: #a78bfa;
  font-size: 12px;
  font-weight: 700;
}

/* Categories */

.category-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 14px;
}

.category-card {
  position: relative;
  overflow: hidden;

  min-height: 155px;

  padding: 20px;

  border: 1px solid var(--border);
  border-radius: 20px;

  background:
    linear-gradient(
      145deg,
      rgba(168,85,247,.15),
      rgba(255,255,255,.025)
    );

  cursor: pointer;

  transition:
    transform .25s,
    border-color .25s,
    background .25s;
}

.category-card:hover {
  transform: translateY(-4px);

  border-color: rgba(168,85,247,.3);

  background:
    linear-gradient(
      145deg,
      rgba(168,85,247,.23),
      rgba(255,255,255,.05)
    );
}

.category-card::after {
  content: "";

  position: absolute;

  width: 100px;
  height: 100px;

  right: -30px;
  bottom: -35px;

  border-radius: 50%;

  background: rgba(168,85,247,.18);

  filter: blur(5px);
}

.category-symbol {
  font-size: 28px;
}

.category-card h3 {
  margin-top: 20px;
  font-family: Outfit;
}

.category-card p {
  margin-top: 4px;
  color: #777783;
  font-size: 11px;
}

/* Songs */

.library-tools select {
  padding: 8px 12px;

  color: #bbb;
  background: #101017;

  border: 1px solid var(--border);
  border-radius: 10px;

  outline: none;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.song-row {
  display: grid;
  grid-template-columns: 45px 1fr 150px 90px 50px;
  align-items: center;

  min-height: 66px;

  padding: 7px 12px;

  border: 1px solid transparent;
  border-radius: 14px;

  transition: .2s;
}

.song-row:hover {
  background: var(--card);
  border-color: var(--border);
}

.song-number {
  color: #656570;
  font-size: 12px;
  text-align: center;
}

.song-cover {
  width: 46px;
  height: 46px;

  border-radius: 11px;

  object-fit: cover;

  background:
    linear-gradient(
      135deg,
      #312e81,
      #7e22ce,
      #be185d
    );

  margin-right: 12px;
}

.song-info {
  display: flex;
  align-items: center;
  min-width: 0;
}

.song-text {
  min-width: 0;
}

.song-title {
  display: block;

  color: white;

  font-size: 13px;
  font-weight: 600;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: block;

  margin-top: 4px;

  color: #686874;
  font-size: 10px;
}

.song-category {
  color: #9b91ad;
  font-size: 11px;
}

.song-play {
  width: 38px;
  height: 38px;

  border-radius: 50%;

  color: white;
  background: rgba(168,85,247,.13);

  opacity: 0;

  transition: .2s;
}

.song-row:hover .song-play {
  opacity: 1;
}

.song-like {
  color: #777783;
  background: transparent;
  font-size: 20px;
}

.song-like.liked {
  color: #f472b6;
}

/* Empty / loading */

.loading-state,
.empty-state {
  min-height: 170px;

  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;

  gap: 12px;

  border: 1px dashed var(--border);
  border-radius: 18px;

  color: #777783;
  font-size: 12px;
}

.loader {
  width: 28px;
  height: 28px;

  border: 3px solid rgba(255,255,255,.08);
  border-top-color: #a855f7;

  border-radius: 50%;

  animation: loader .7s linear infinite;
}

@keyframes loader {
  to {
    transform: rotate(360deg);
  }
}

/* YouTube */

.youtube-card {
  display: flex;
  align-items: center;
  gap: 20px;

  padding: 25px;

  border: 1px solid var(--border);
  border-radius: 22px;

  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,.055),
      rgba(255,255,255,.025)
    );
}

.youtube-logo {
  width: 64px;
  height: 45px;

  display: grid;
  place-items: center;

  border-radius: 12px;

  background: #ff0033;

  font-size: 21px;
}

.youtube-info h3 {
  font-family: Outfit;
}

.youtube-info p {
  margin: 5px 0 15px;

  color: #777783;
  font-size: 11px;
}

.youtube-search {
  display: flex;
  gap: 8px;
}

.youtube-search input {
  width: 300px;
  max-width: 100%;

  height: 40px;

  padding: 0 13px;

  border-radius: 10px;

  border: 1px solid var(--border);

  background: rgba(0,0,0,.25);

  color: white;
  outline: none;
}

.youtube-search button {
  padding: 0 16px;

  border-radius: 10px;

  color: white;

  background: #ef4444;
}

/* Footer */

footer {
  margin: 55px 0 15px;

  padding-top: 22px;

  border-top: 1px solid var(--border);

  display: flex;
  justify-content: space-between;
  align-items: center;

  color: #555560;
  font-size: 10px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 9px;

  color: #aaa;
}

/* Player */

.player {
  position: fixed;

  left: var(--sidebar-width);
  right: 0;
  bottom: 0;

  height: var(--player-height);

  z-index: 200;

  display: grid;
  grid-template-columns: 280px 1fr 280px;
  align-items: center;

  padding: 10px 24px;

  background:
    rgba(12,12,18,.91);

  border-top: 1px solid var(--border);

  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
}

.now-playing {
  display: flex;
  align-items: center;
  min-width: 0;
}

.player-cover {
  width: 55px;
  height: 55px;

  display: grid;
  place-items: center;

  border-radius: 12px;

  margin-right: 12px;

  background:
    linear-gradient(
      135deg,
      #7e22ce,
      #be185d
    );

  font-size: 20px;
}

.player-song {
  min-width: 0;
}

.player-song strong {
  display: block;

  font-size: 12px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-song span {
  display: block;

  margin-top: 4px;

  color: #777783;

  font-size: 10px;
}

.like-button {
  margin-left: 12px;

  color: #777;
  background: transparent;

  font-size: 20px;
}

.player-main {
  max-width: 650px;
  width: 100%;
  margin: auto;
}

.player-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.player-controls button,
.player-extra button {
  color: #aaa;
  background: transparent;
}

.main-play {
  width: 42px;
  height: 42px;

  border-radius: 50% !important;

  color: white !important;

  background:
    linear-gradient(
      135deg,
      #9333ea,
      #db2777
    ) !important;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 8px;

  margin-top: 6px;

  color: #656570;

  font-size: 9px;
}

.progress-container input {
  flex: 1;
}

input[type="range"] {
  accent-color: #a855f7;
}

.player-extra {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 13px;
}

.player-extra input {
  width: 80px;
}

.mobile-menu {
  display: none;
}

/* Toast */

.toast {
  position: fixed;

  left: 50%;
  bottom: 110px;

  transform: translate(-50%, 20px);

  padding: 11px 17px;

  border-radius: 12px;

  background: rgba(25,25,32,.95);

  border: 1px solid var(--border);

  color: white;

  font-size: 11px;

  opacity: 0;
  pointer-events: none;

  transition: .25s;

  z-index: 500;
}

.toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Mobile */

@media (max-width: 1100px) {

  .hero-decoration {
    right: 3%;
    opacity: .45;
  }

  .category-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .player {
    grid-template-columns: 220px 1fr 170px;
  }
}

@media (max-width: 800px) {

  :root {
    --sidebar-width: 0px;
  }

  .sidebar {
    width: 270px;

    transform: translateX(-100%);

    transition: .3s;

    box-shadow: 30px 0 80px rgba(0,0,0,.5);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .main {
    margin-left: 0;
  }

  .topbar {
    padding: 0 15px;
  }

  .mobile-menu {
    display: grid;

    width: 40px;
    height: 40px;

    place-items: center;

    color: white;
    background: rgba(255,255,255,.06);

    border-radius: 12px;
  }

  .content {
    padding: 18px 15px;
  }

  .hero {
    min-height: 440px;
  }

  .hero-content {
    padding: 35px 25px;
  }

  .hero h1 {
    font-size: 47px;
    letter-spacing: -2px;
  }

  .hero-decoration {
    opacity: .15;
    right: -70px;
    top: 70%;
  }

  .stats {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 7px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-icon {
    display: none;
  }

  .stat-card strong {
    font-size: 16px;
  }

  .category-grid {
    grid-template-columns: 1fr 1fr;
  }

  .song-row {
    grid-template-columns: 32px 1fr 45px 35px;
  }

  .song-category {
    display: none;
  }

  .song-play {
    opacity: 1;
  }

  .player {
    left: 0;

    height: 74px;

    grid-template-columns: 1fr auto;

    padding: 8px 12px;
  }

  .player-main {
    position: absolute;

    left: 0;
    right: 0;
    bottom: 0;

    pointer-events: none;
  }

  .player-controls {
    position: absolute;

    right: 15px;
    top: -57px;

    pointer-events: auto;
  }

  .progress-container {
    margin: 0;
  }

  .progress-container span {
    display: none;
  }

  .player-extra {
    display: none;
  }

  .player-song {
    max-width: 170px;
  }

  .now-playing {
    grid-column: 1 / -1;
  }

  .like-button {
    margin-left: auto;
  }

  footer {
    padding-bottom: 15px;
  }
}

@media (max-width: 500px) {

  .search-wrapper input {
    padding-left: 38px;
    font-size: 12px;
  }

  .top-actions .icon-button {
    display: none;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-actions button {
    justify-content: center;
  }

  .section-heading h2 {
    font-size: 23px;
  }

  .category-card {
    min-height: 130px;
  }

  .youtube-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .youtube-search {
    width: 100%;
  }

  .youtube-search input {
    flex: 1;
  }

  footer {
    flex-direction: column;
    gap: 10px;
  }
}