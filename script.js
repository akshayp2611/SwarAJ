async function playYouTube(song) {
  const videoId =
    song.youtubeId ||
    getYouTubeId(song.youtubeUrl);

  if (!videoId) {
    toast("Invalid YouTube video");
    return;
  }

  if (!state.youtubeReady || !state.youtubePlayer) {
    toast("YouTube player is still loading");
    return;
  }

  audio.pause();
  audio.removeAttribute("src");
  audio.load();

  // Load and play YouTube audio WITHOUT opening video UI
  state.youtubePlayer.loadVideoById(videoId);
  state.youtubePlayer.playVideo();

  state.isPlaying = true;
  updatePlayButton();

  // IMPORTANT:
  // Do NOT call showVideo() here.
}