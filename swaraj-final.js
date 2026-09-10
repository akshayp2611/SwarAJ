
(() => {
  "use strict";

  const THEMES = [
    ["liquid-glass","Liquid Glass","#8b5cf6","#06b6d4","Frosted liquid"],
    ["deep-3d","Deep 3D","#475569","#cbd5e1","Raised depth"],
    ["neon-3d","Neon 3D","#00f5ff","#ff00d4","Futuristic glow"],
    ["aurora-liquid","Aurora Liquid","#22c55e","#8b5cf6","Aurora gradients"],
    ["galaxy-6d","Galaxy 6D","#7c3aed","#38bdf8","Deep space"],
    ["premium-gold","Premium Gold","#f59e0b","#fde68a","Luxury metallic"],
    ["ocean-liquid","Ocean Liquid","#06b6d4","#2563eb","Water glass"],
    ["purple-crystal","Purple Crystal","#a855f7","#e879f9","Crystal glow"],
    ["red-pulse","Red Pulse","#ef4444","#fb7185","Cinematic pulse"],
    ["minimal-dark","Minimal Dark","#64748b","#94a3b8","Clean professional"]
  ];

  const $ = id => document.getElementById(id);
  const audio = $("audioPlayer");
  const DEFAULT_COVER = "/images/default-cover.jpg";
  let shuffle = localStorage.getItem("swaraj-shuffle") === "1";
  let repeat = localStorage.getItem("swaraj-repeat") === "1";
  let toastTimer = null;

  function esc(v){
    return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  }

  function toast(message){
    const el=$("sjToast"); if(!el) return;
    el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1800);
  }

  function applyTheme(id){
    if(!THEMES.some(t=>t[0]===id)) id="liquid-glass";
    document.body.dataset.sjTheme=id;
    localStorage.setItem("swaraj-theme",id);
    document.querySelectorAll(".sj-theme-card").forEach(b=>b.classList.toggle("active",b.dataset.theme===id));
  }

  function buildThemePanel(){
    const grid=$("sjThemeGrid"); if(!grid) return;
    grid.innerHTML=THEMES.map(t=>`
      <button class="sj-theme-card" data-theme="${t[0]}" style="--ta:${t[2]};--tb:${t[3]}" type="button">
        <b>${esc(t[1])}</b><span>${esc(t[4])}</span>
      </button>`).join("");
    grid.querySelectorAll("[data-theme]").forEach(b=>b.addEventListener("click",()=>{
      applyTheme(b.dataset.theme); toast(`${b.textContent.trim()} theme applied`);
    }));
    applyTheme(localStorage.getItem("swaraj-theme")||"liquid-glass");
  }

  function setupTheme(){
    buildThemePanel();
    $("sjThemeToggle")?.addEventListener("click",()=> $("sjThemePanel")?.classList.toggle("open"));
    $("sjThemeClose")?.addEventListener("click",()=> $("sjThemePanel")?.classList.remove("open"));
    document.addEventListener("click",e=>{
      const p=$("sjThemePanel"), b=$("sjThemeToggle");
      if(p?.classList.contains("open") && !p.contains(e.target) && !b?.contains(e.target)) p.classList.remove("open");
    });
  }

  function removeAdminUI(){
    document.querySelectorAll("#adminMenu,[data-admin],.admin-menu,.admin-link,.admin-button,.admin-icon").forEach(el=>el.remove());
    const page=$("adminPage"); if(page) page.remove();
  }

  function setupVideo(){
    const common=$("sjCommonVideo"), frame=$("youtubeFrame");
    if(!common || !frame) return;
    const observer=new MutationObserver(()=>{
      if(!frame.classList.contains("hidden-video")) common.classList.add("open");
    });
    observer.observe(frame,{attributes:true,attributeFilter:["class"]});
    $("sjVideoClose")?.addEventListener("click",()=>common.classList.remove("open"));
    $("sjFullscreen")?.addEventListener("click",fullscreenVideo);
    $("sjMiniFullscreen")?.addEventListener("click",fullscreenVideo);
  }

  async function fullscreenVideo(){
    const target=$("sjCommonVideo")?.querySelector(".sj-video-inner") || $("youtubeFrame");
    try{
      if(document.fullscreenElement) await document.exitFullscreen();
      else await target.requestFullscreen();
    }catch(e){ toast("Fullscreen is not supported here"); }
  }

  function setupControls(){
    $("sjShuffle")?.addEventListener("click",()=>{
      shuffle=!shuffle; localStorage.setItem("swaraj-shuffle",shuffle?"1":"0");
      $("sjShuffle").classList.toggle("active",shuffle); toast(shuffle?"Shuffle on":"Shuffle off");
    });
    $("sjRepeat")?.addEventListener("click",()=>{
      repeat=!repeat; localStorage.setItem("swaraj-repeat",repeat?"1":"0");
      $("sjRepeat").classList.toggle("active",repeat); if(audio) audio.loop=repeat;
      toast(repeat?"Repeat on":"Repeat off");
    });
    $("sjMute")?.addEventListener("click",()=>{
      if(!audio)return; audio.muted=!audio.muted;
      $("sjMute").textContent=audio.muted?"🔇":"🔊";
    });
    $("sjVolume")?.addEventListener("input",e=>{
      if(audio) audio.volume=Number(e.target.value);
      if(audio?.muted){audio.muted=false;$("sjMute").textContent="🔊";}
    });
    $("sjQueue")?.addEventListener("click",()=>{
      renderQueue(); $("sjQueuePanel")?.classList.toggle("open");
    });
    $("sjQueueClose")?.addEventListener("click",()=> $("sjQueuePanel")?.classList.remove("open"));
    $("sjFavorite")?.addEventListener("click",toggleFavorite);
    $("sjShuffle").classList.toggle("active",shuffle);
    $("sjRepeat").classList.toggle("active",repeat);
    if(audio) audio.loop=repeat;
  }

  function currentSongFromCards(){
    const row=document.querySelector(".song.playing");
    if(!row) return null;
    return {
      title:row.querySelector(".song-name")?.textContent?.trim()||"SwarAJ",
      artist:row.querySelector(".song-artist")?.textContent?.trim()||"Music",
      cover:row.querySelector(".song-cover")?.src||DEFAULT_COVER
    };
  }

  function toggleFavorite(){
    const s=currentSongFromCards(); if(!s)return toast("Play a song first");
    const key=`${s.title}::${s.artist}`;
    const list=JSON.parse(localStorage.getItem("swaraj-final-favorites")||"[]");
    const i=list.findIndex(x=>x.key===key);
    if(i>=0){list.splice(i,1);$("sjFavorite").textContent="♡";toast("Removed from favorites");}
    else{list.push({...s,key});$("sjFavorite").textContent="♥";toast("Added to favorites");}
    localStorage.setItem("swaraj-final-favorites",JSON.stringify(list));
  }

  function renderQueue(){
    const list=$("sjQueueList"); if(!list)return;
    const rows=[...document.querySelectorAll(".song")];
    if(!rows.length){list.innerHTML="<div class='sj-queue-row'>No songs loaded.</div>";return;}
    list.innerHTML=rows.map((r,i)=>`
      <div class="sj-queue-row" data-q="${i}">
        <img src="${esc(r.querySelector(".song-cover")?.src||DEFAULT_COVER)}" alt="">
        <div><b>${esc(r.querySelector(".song-name")?.textContent?.trim()||"Unknown")}</b>
        <span>${esc(r.querySelector(".song-artist")?.textContent?.trim()||"Unknown Artist")}</span></div>
      </div>`).join("");
    list.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{
      rows[Number(b.dataset.q)]?.click(); $("sjQueuePanel")?.classList.remove("open");
    }));
  }

  function interceptNextForShuffle(){
    const next=$("nextBtn"); if(!next)return;
    next.addEventListener("click",e=>{
      if(!shuffle)return;
      e.preventDefault(); e.stopImmediatePropagation();
      const buttons=[...document.querySelectorAll("[data-play]")];
      if(!buttons.length)return;
      const index=Math.floor(Math.random()*buttons.length);
      buttons[index].click();
    },true);
  }

  function setupProgressAndMedia(){
    if(!audio)return;
    audio.addEventListener("timeupdate",()=>{
      const p=$("progress"); if(!p)return;
      if(audio.duration) p.value=(audio.currentTime/audio.duration)*100;
      $("currentTime").textContent=format(audio.currentTime);
      $("duration").textContent=format(audio.duration);
    });
    audio.addEventListener("loadedmetadata",()=>{
      $("duration").textContent=format(audio.duration);
      updateMediaSession();
    });
    audio.addEventListener("play",()=>{updateMediaSession();setMediaState("playing")});
    audio.addEventListener("pause",()=>setMediaState("paused"));
    audio.addEventListener("ended",()=>{
      if(repeat){audio.currentTime=0;audio.play().catch(()=>{});}
    });
    $("progress")?.addEventListener("input",e=>{
      if(audio.duration) audio.currentTime=(Number(e.target.value)/100)*audio.duration;
    });
  }

  function format(s){
    if(!Number.isFinite(s))return "0:00";
    const m=Math.floor(s/60), sec=Math.floor(s%60);
    return `${m}:${String(sec).padStart(2,"0")}`;
  }

  function updateMediaSession(){
    if(!("mediaSession" in navigator))return;
    const s=currentSongFromCards(); if(!s)return;
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:s.title,artist:s.artist,album:"SwarAJ Music",
        artwork:s.cover?[{src:s.cover,sizes:"512x512"}]:[]
      });
    }catch(_){}
  }
  function setMediaState(state){
    try{if("mediaSession" in navigator)navigator.mediaSession.playbackState=state;}catch(_){}
  }

  function setupMediaSession(){
    if(!("mediaSession" in navigator))return;
    const click=id=>$(id)?.click();
    const handlers={
      play:()=>click("playBtn"),pause:()=>click("playBtn"),
      nexttrack:()=>click("nextBtn"),previoustrack:()=>click("prevBtn"),
      seekbackward:d=>seek(-(d.seekOffset||10)),seekforward:d=>seek(d.seekOffset||10)
    };
    Object.entries(handlers).forEach(([name,fn])=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch(_){}});
    function seek(delta){
      if(!audio)return;
      audio.currentTime=Math.max(0,Math.min(audio.duration||Infinity,audio.currentTime+delta));
    }
  }

  async function loadCategories(){
    const c=$("sjCategoryContainer"); if(!c)return;
    try{
      const [songsRes,catsRes]=await Promise.all([
        fetch("/api/songs",{cache:"no-store"}),fetch("/api/categories",{cache:"no-store"})
      ]);
      const sd=await songsRes.json(); let songs=Array.isArray(sd)?sd:(sd.songs||sd.data||[]);
      let cats=[];
      if(catsRes.ok){const cd=await catsRes.json();cats=Array.isArray(cd)?cd:(cd.categories||cd.data||[]);}
      const groups=new Map();
      songs.forEach(s=>{const cat=String(s.category||"Music").trim()||"Music";if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(s);});
      if(cats.length) cats.forEach(x=>{const cat=String(typeof x==="string"?x:(x.name||x.category||"")).trim();if(cat&&!groups.has(cat))groups.set(cat,[]);});
      c.innerHTML=[...groups].filter(([,ss])=>ss.length).map(([cat,ss])=>`
        <section class="sj-category-block">
          <div class="sj-category-header"><h2 class="sj-category-title">${esc(cat)}</h2><span class="sj-category-count">${ss.length} songs</span></div>
          <div class="sj-category-scroll">${ss.map(s=>`
            <article class="sj-song-card" data-title="${esc(s.title||s.name||"")}">
              <div class="sj-card-row"><img src="${esc(s.cover_url||s.cover||DEFAULT_COVER)}" onerror="this.src='${DEFAULT_COVER}'" alt="">
              <div class="sj-card-info"><div class="sj-card-title">${esc(s.title||s.name||"Unknown Song")}</div>
              <div class="sj-card-artist">${esc(s.artist||s.singer||"Unknown Artist")}</div></div></div>
            </article>`).join("")}</div>
        </section>`).join("");
      c.querySelectorAll(".sj-song-card").forEach(card=>card.addEventListener("click",()=>{
        const title=card.dataset.title;
        const row=[...document.querySelectorAll(".song")].find(r=>r.querySelector(".song-name")?.textContent?.trim()===title);
        row?.click();
      }));
    }catch(e){console.warn("SwarAJ categories",e);}
  }

  function updatePlayerDetails(){
    const s=currentSongFromCards(); if(!s)return;
    const category=document.querySelector(".song.playing .song-type")?.textContent?.trim()||"Music";
    if($("sjPlayerCategory"))$("sjPlayerCategory").textContent=category;
    const favs=JSON.parse(localStorage.getItem("swaraj-final-favorites")||"[]");
    $("sjFavorite").textContent=favs.some(x=>x.key===`${s.title}::${s.artist}`)?"♥":"♡";
    updateMediaSession();
  }

  function observePlayer(){
    const target=$(".player")||document.body;
    new MutationObserver(updatePlayerDetails).observe(target,{subtree:true,childList:true,characterData:true});
    setInterval(updatePlayerDetails,1200);
  }

  function init(){
    removeAdminUI(); setupTheme(); setupControls(); setupVideo(); setupProgressAndMedia();
    setupMediaSession(); interceptNextForShuffle(); loadCategories(); observePlayer();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
