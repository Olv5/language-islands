/**
 * player.js — Reprodução sequencial
 *
 * Conceito-chave: AbortController
 * ─────────────────────────────────
 * Precisamos de poder "cancelar" operações assíncronas
 * (áudio a tocar, temporizadores a correr) quando o
 * utilizador clica em Pausa, Parar ou Seguinte.
 *
 * AbortController é a forma moderna de fazer isto:
 *   const ctrl = new AbortController();
 *   ctrl.signal  → passamos este sinal às funções async
 *   ctrl.abort() → cancela tudo que esteja a usar esse sinal
 */

// ── DADOS ──────────────────────────────────────

const urlParams = new URLSearchParams(window.location.search);
const islandId  = urlParams.get('id');
if (!islandId) window.location.href = 'index.html';

let island   = null;
let phrases  = [];      // carregado no init()
let settings = Storage.getSettings();

let isPlaying          = false;
let currentPhraseIndex = 0;
let abortController    = null;

// ── FUNÇÕES ASSÍNCRONAS ────────────────────────

function sleep(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted || ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function playAudio(url, signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const audio = new Audio(url);
    audio.onended = resolve;
    audio.onerror = resolve;
    signal.addEventListener('abort', () => { audio.pause(); audio.src = ''; resolve(); }, { once: true });
    audio.play().catch(resolve);
  });
}

// ── LOOP PRINCIPAL ─────────────────────────────

async function runPlayback() {
  abortController = new AbortController();
  const signal    = abortController.signal;
  const total     = phrases.length;

  while (currentPhraseIndex < total && !signal.aborted) {
    const phrase   = phrases[currentPhraseIndex];
    const hasAudio = !!phrase.audio_url;
    const totalReps = hasAudio ? settings.repetitions : 1;

    showPhrase(currentPhraseIndex);
    updateProgress();

    for (let rep = 0; rep < totalReps && !signal.aborted; rep++) {
      updateRepCounter(rep + 1, totalReps);

      if (hasAudio) {
        setStatus('A reproduzir...');
        await playAudio(phrase.audio_url, signal);
      } else {
        setStatus('Lê a frase');
        await sleep(3000, signal);
      }

      if (!signal.aborted && rep < totalReps - 1) {
        setStatus('...');
        await sleep(settings.pauseBetweenReps * 1000, signal);
      }
    }

    if (!signal.aborted) {
      currentPhraseIndex++;
      if (currentPhraseIndex < total) {
        setStatus('Próxima frase...');
        await sleep(settings.pauseBetweenPhrases * 1000, signal);
      }
    }
  }

  if (!signal.aborted) showFinished();
  isPlaying = false;
  updatePlayButton();
}

// ── CONTROLOS ──────────────────────────────────

function togglePlay() { isPlaying ? pausePlayback() : startPlayback(); }

function startPlayback() {
  if (currentPhraseIndex >= phrases.length) currentPhraseIndex = 0;
  document.getElementById('finished-display').classList.add('hidden');
  document.getElementById('phrase-display').classList.remove('hidden');
  isPlaying = true;
  updatePlayButton();
  runPlayback();
}

function pausePlayback() {
  if (abortController) abortController.abort();
  isPlaying = false;
  setStatus('Em pausa');
  updatePlayButton();
}

function stopPlayer() {
  if (abortController) abortController.abort();
  isPlaying = false;
  currentPhraseIndex = 0;
  updatePlayButton();
  showPhrase(0);
  updateProgress();
  setStatus('');
}

function nextPhrase() {
  if (abortController) abortController.abort();
  if (currentPhraseIndex < phrases.length - 1) {
    currentPhraseIndex++;
    isPlaying = false;
    showPhrase(currentPhraseIndex);
    updateProgress();
    startPlayback();
  }
}

function prevPhrase() {
  if (abortController) abortController.abort();
  if (currentPhraseIndex > 0) {
    currentPhraseIndex--;
    isPlaying = false;
    showPhrase(currentPhraseIndex);
    updateProgress();
    startPlayback();
  }
}

function resetAndPlay() {
  currentPhraseIndex = 0;
  document.getElementById('finished-display').classList.add('hidden');
  document.getElementById('phrase-display').classList.remove('hidden');
  startPlayback();
}

// ── INTERFACE ──────────────────────────────────

function showPhrase(index) {
  const phrase = phrases[index];
  if (!phrase) return;
  document.getElementById('display-native').textContent = phrase.native_text;
  document.getElementById('display-target').textContent = phrase.target_text;
}

function updateProgress() {
  const total   = phrases.length;
  const current = currentPhraseIndex + 1;
  const percent = (currentPhraseIndex / total) * 100;
  document.getElementById('progress-text').textContent = `Frase ${Math.min(current, total)} de ${total}`;
  document.getElementById('progress-bar-fill').style.width = percent + '%';
}

function updateRepCounter(rep, total) {
  document.getElementById('rep-text').textContent = total > 1 ? `Repetição ${rep} de ${total}` : '';
}

function setStatus(msg) { document.getElementById('display-status').textContent = msg; }

function updatePlayButton() {
  document.getElementById('btn-play').textContent = isPlaying ? '⏸' : '▶';
}

function showFinished() {
  document.getElementById('phrase-display').classList.add('hidden');
  document.getElementById('finished-display').classList.remove('hidden');
  document.getElementById('progress-bar-fill').style.width = '100%';
  document.getElementById('progress-text').textContent = `${phrases.length} de ${phrases.length} frases`;
  document.getElementById('rep-text').textContent = '';
}

// ── DEFINIÇÕES ─────────────────────────────────

const LIMITS = {
  repetitions:         { min: 1,   max: 10 },
  pauseBetweenReps:    { min: 0,   max: 10 },
  pauseBetweenPhrases: { min: 0.5, max: 15 }
};

function adjustSetting(key, delta) {
  const { min, max } = LIMITS[key];
  let val = Math.round((settings[key] + delta) * 10) / 10;
  val = Math.max(min, Math.min(max, val));
  settings[key] = val;
  Storage.saveSettings(settings);
  loadSettingsUI();
}

function loadSettingsUI() {
  document.getElementById('s-reps-value').textContent         = settings.repetitions + 'x';
  document.getElementById('s-pause-reps-value').textContent   = settings.pauseBetweenReps + 's';
  document.getElementById('s-pause-phrases-value').textContent = settings.pauseBetweenPhrases + 's';
}

function toggleSettings() {
  const content = document.getElementById('settings-content');
  const arrow   = document.getElementById('settings-arrow');
  const isOpen  = !content.classList.contains('hidden');
  content.classList.toggle('hidden');
  arrow.textContent = isOpen ? '▼' : '▲';
}

// ── INICIALIZAÇÃO ──────────────────────────────

async function init() {
  const islands = await Storage.getIslands();
  island = islands.find(i => i.id === islandId);
  if (!island) { window.location.href = 'index.html'; return; }

  // Carrega as frases do Supabase
  phrases = await Storage.getPhrases(islandId);
  if (phrases.length === 0) { window.location.href = `island.html?id=${islandId}`; return; }

  document.title = `${island.name} — Player`;
  document.getElementById('back-link').href = `island.html?id=${islandId}`;
  document.getElementById('player-island-name').textContent = island.name;
  document.getElementById('player-island-langs').textContent =
    `${island.native_language} → ${island.target_language}`;

  loadSettingsUI();
  showPhrase(0);
  updateProgress();
}

init().catch(err => {
  console.error(err);
  alert('Erro ao carregar o player. Verifica a ligação ao Supabase.');
});