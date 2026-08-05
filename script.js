/* ===================== Blind Listening Test ===================== */
/* Static, client-side only. Talks directly to the YouTube Data API  */
/* and the YouTube IFrame Player API using the visitor's own key.    */

const STORAGE_KEYS = { apiKey: 'blt_api_key', playlist: 'blt_playlist_id' };

const state = {
  apiKey: null,
  playlistId: null,
  videos: [],        // [{ id, title }] — title kept hidden from the UI until reveal
  deck: [],          // shuffled queue of videos for the current pass through the playlist
  current: null,      // { id, title, startSeconds }
  player: null,
  playerReady: false,
  playedCount: 0,
  isPaused: false,
  hideVideo: true,
};

/* ---------- DOM shortcuts ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  setupScreen: $('setup-screen'),
  loadingScreen: $('loading-screen'),
  gameScreen: $('game-screen'),
  loadingText: $('loading-text'),
  apiKeyInput: $('api-key'),
  playlistInput: $('playlist-input'),
  hideVideoToggle: $('hide-video-toggle'),
  startBtn: $('start-btn'),
  setupError: $('setup-error'),
  howToKeyLink: $('how-to-key-link'),
  howToKey: $('how-to-key'),
  changePlaylistBtn: $('change-playlist-btn'),
  playerShade: $('player-shade'),
  pauseBtn: $('pause-btn'),
  preReveal: $('pre-reveal'),
  postReveal: $('post-reveal'),
  guessInput: $('guess-input'),
  guessRecap: $('guess-recap'),
  revealBtn: $('reveal-btn'),
  answerTitle: $('answer-title'),
  answerLink: $('answer-link'),
  nextBtn: $('next-btn'),
  scoreTotal: $('score-total'),
  lapNote: $('lap-note'),
  gameError: $('game-error'),
};

/* ---------- small helpers ---------- */
function showScreen(name) {
  els.setupScreen.hidden = name !== 'setup';
  els.loadingScreen.hidden = name !== 'loading';
  els.gameScreen.hidden = name !== 'game';
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}
function clearError(el) {
  el.hidden = true;
  el.textContent = '';
}

// Accepts a raw playlist ID or any of the common playlist URL shapes.
function extractPlaylistId(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const listParam = url.searchParams.get('list');
    if (listParam) return listParam;
  } catch (_) {
    // not a URL — fall through and treat as a raw ID
  }
  return trimmed;
}

// Parses ISO 8601 durations like "PT1H2M10S" into whole seconds.
function parseISODuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return 0;
  const [, h, m, s] = match;
  return (parseInt(h || 0, 10) * 3600) + (parseInt(m || 0, 10) * 60) + parseInt(s || 0, 10);
}

/* ---------- YouTube Data API ---------- */
const API_BASE = 'https://www.googleapis.com/youtube/v3';

async function apiGet(path, params) {
  const url = new URL(`${API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('key', state.apiKey);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || 'unknown_error';
    const message = data?.error?.message || 'Request failed.';
    const err = new Error(message);
    err.reason = reason;
    throw err;
  }
  return data;
}

async function fetchAllPlaylistItems(playlistId) {
  let items = [];
  let pageToken = '';
  do {
    const data = await apiGet('playlistItems', {
      part: 'snippet,contentDetails',
      maxResults: 50,
      playlistId,
      pageToken,
    });
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

// videos.list only accepts up to 50 IDs per call.
async function fetchDurations(videoIds) {
  const durations = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await apiGet('videos', {
      part: 'contentDetails,status',
      id: batch.join(','),
    });
    (data.items || []).forEach((item) => {
      durations[item.id] = {
        seconds: parseISODuration(item.contentDetails.duration),
        embeddable: item.status?.embeddable !== false,
      };
    });
  }
  return durations;
}

async function loadPlaylist(apiKey, playlistId) {
  const rawItems = await fetchAllPlaylistItems(playlistId);

  const candidates = rawItems
    .map((item) => ({
      id: item.contentDetails?.videoId,
      title: item.snippet?.title,
    }))
    .filter((v) => v.id && v.title && v.title !== 'Private video' && v.title !== 'Deleted video');

  if (candidates.length === 0) {
    throw new Error('That playlist has no accessible videos (they may all be private or deleted).');
  }

  const durationMap = await fetchDurations(candidates.map((v) => v.id));

  const videos = candidates
    .map((v) => ({ ...v, seconds: durationMap[v.id]?.seconds || 0, embeddable: durationMap[v.id]?.embeddable }))
    .filter((v) => v.embeddable && v.seconds >= 20); // need enough runway to pick a fair random point

  if (videos.length === 0) {
    throw new Error('None of the videos in that playlist are long enough or embeddable to quiz on.');
  }

  return videos;
}

/* ---------- YouTube IFrame Player ---------- */
let iframeApiReady = false;
let onIframeApiReadyCallback = null;

// Called by the YouTube IFrame API script itself once it has loaded.
window.onYouTubeIframeAPIReady = function () {
  iframeApiReady = true;
  if (onIframeApiReadyCallback) onIframeApiReadyCallback();
};

function ensurePlayer() {
  return new Promise((resolve) => {
    if (state.player) return resolve(state.player);
    const create = () => {
      state.player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { state.playerReady = true; resolve(state.player); },
        },
      });
    };
    if (iframeApiReady) create();
    else onIframeApiReadyCallback = create;
  });
}

/* ---------- game logic ---------- */
function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck() {
  state.deck = shuffle(state.videos);
}

function nextVideoFromDeck() {
  if (state.deck.length === 0) {
    buildDeck();
    // Don't let the same track land twice in a row across the reshuffle seam.
    if (state.current && state.deck.length > 1 && state.deck[0].id === state.current.id) {
      [state.deck[0], state.deck[1]] = [state.deck[1], state.deck[0]];
    }
    showLapNote();
  }
  return state.deck.shift();
}

let lapNoteTimer = null;
function showLapNote() {
  if (!state.current) return; // don't show it on the very first round
  clearTimeout(lapNoteTimer);
  els.lapNote.textContent = `Heard all ${state.videos.length} tracks \u2014 starting a new pass.`;
  els.lapNote.hidden = false;
  lapNoteTimer = setTimeout(() => { els.lapNote.hidden = true; }, 4000);
}

function pickRandomVideo() {
  const video = nextVideoFromDeck();

  // Pick a start point with room to listen: skip the first few seconds and
  // leave at least 15s (or 15% of the length) before the end.
  const tail = Math.max(15, Math.floor(video.seconds * 0.15));
  const latestStart = Math.max(4, video.seconds - tail);
  const earliestStart = Math.min(4, latestStart);
  const startSeconds = earliestStart + Math.floor(Math.random() * Math.max(1, latestStart - earliestStart));

  return { ...video, startSeconds };
}

async function playRound() {
  clearError(els.gameError);
  els.preReveal.hidden = false;
  els.postReveal.hidden = true;
  els.playerShade.hidden = state.hideVideo ? false : true;
  els.guessInput.value = '';
  els.guessRecap.hidden = true;

  const round = pickRandomVideo();
  state.current = round;

  const player = await ensurePlayer();
  player.loadVideoById({ videoId: round.id, startSeconds: round.startSeconds });
  player.unMute?.();
  setPaused(false);

  state.playedCount += 1;
  els.scoreTotal.textContent = state.playedCount;
}

function revealAnswer() {
  if (!state.current) return;
  els.preReveal.hidden = true;
  els.postReveal.hidden = false;
  els.playerShade.hidden = true; // always show video once revealed
  els.answerTitle.textContent = state.current.title;
  els.answerLink.href = `https://www.youtube.com/watch?v=${state.current.id}`;

  const guess = els.guessInput.value.trim();
  if (guess) {
    els.guessRecap.innerHTML = `You guessed: <strong></strong>`;
    els.guessRecap.querySelector('strong').textContent = guess;
    els.guessRecap.hidden = false;
  } else {
    els.guessRecap.hidden = true;
  }
}

function setPaused(paused) {
  state.isPaused = paused;
  if (state.player) {
    if (paused) state.player.pauseVideo?.();
    else state.player.playVideo?.();
  }
  els.pauseBtn.textContent = paused ? 'Resume audio' : 'Pause audio';
  els.pauseBtn.classList.toggle('is-paused', paused);
}

function togglePause() {
  setPaused(!state.isPaused);
}

/* ---------- setup flow ---------- */
async function handleStart() {
  clearError(els.setupError);
  const apiKey = els.apiKeyInput.value.trim();
  const playlistId = extractPlaylistId(els.playlistInput.value);

  if (!apiKey) return showError(els.setupError, 'Enter a YouTube Data API key.');
  if (!playlistId) return showError(els.setupError, 'Enter a playlist URL or ID.');

  state.apiKey = apiKey;
  state.playlistId = playlistId;
  state.hideVideo = els.hideVideoToggle.checked;

  localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  localStorage.setItem(STORAGE_KEYS.playlist, playlistId);

  showScreen('loading');
  els.loadingText.textContent = 'Loading playlist\u2026';

  try {
    state.videos = await loadPlaylist(apiKey, playlistId);
    state.playedCount = 0;
    els.scoreTotal.textContent = '0';
    buildDeck();
    showScreen('game');
    await playRound();
  } catch (err) {
    showScreen('setup');
    showError(els.setupError, friendlyError(err));
  }
}

function friendlyError(err) {
  if (err.reason === 'keyInvalid' || err.reason === 'API_KEY_INVALID') return 'That API key was rejected. Double-check it and that the YouTube Data API v3 is enabled.';
  if (err.reason === 'quotaExceeded') return 'This API key has hit its daily quota. Try again tomorrow or use a different key.';
  if (err.reason === 'playlistNotFound') return 'Playlist not found. Make sure it is Public or Unlisted.';
  return err.message || 'Something went wrong loading that playlist.';
}

/* ---------- wiring ---------- */
function init() {
  const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  const savedPlaylist = localStorage.getItem(STORAGE_KEYS.playlist);
  if (savedKey) els.apiKeyInput.value = savedKey;
  if (savedPlaylist) els.playlistInput.value = savedPlaylist;

  els.howToKeyLink.addEventListener('click', (e) => {
    e.preventDefault();
    els.howToKey.hidden = !els.howToKey.hidden;
  });

  els.startBtn.addEventListener('click', handleStart);
  els.playlistInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleStart(); });
  els.apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleStart(); });

  els.revealBtn.addEventListener('click', revealAnswer);
  els.guessInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') revealAnswer(); });
  els.pauseBtn.addEventListener('click', togglePause);
  els.nextBtn.addEventListener('click', async () => {
    try {
      await playRound();
    } catch (err) {
      showError(els.gameError, err.message || 'Could not load the next video.');
    }
  });

  els.changePlaylistBtn.addEventListener('click', () => {
    if (state.player) { try { state.player.stopVideo(); } catch (_) {} }
    showScreen('setup');
  });

  els.hideVideoToggle.addEventListener('change', () => {
    state.hideVideo = els.hideVideoToggle.checked;
    if (!els.preReveal.hidden) els.playerShade.hidden = !state.hideVideo;
  });
}

document.addEventListener('DOMContentLoaded', init);
