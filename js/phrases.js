/**
 * phrases.js — CRUD + Player integrado
 */

const urlParams  = new URLSearchParams(window.location.search);
const islandId   = urlParams.get('id');
if (!islandId) window.location.href = 'index.html';

let island           = null;
let cachedPhrases    = [];
let pendingDeleteId  = null;
let pendingAudioFile = null;
let removeAudioFlag  = false;
let isBlurred        = false;

// ── ÁUDIO CARDS ───────────────────────────────
const _cardAudio   = new Audio();
let _playingCardId = null;

// ── PLAYER ────────────────────────────────────
const _playerAudio     = new Audio();
let isPlaying          = false;
let currentPhraseIndex = 0;
let abortController    = null;
let isLooping = false;
let isWritingMode  = false;
let writingResolve = null;
let _writingAudioUrl = null;
let settings           = { repetitions: 2, pauseBetweenReps: 1, pauseBetweenPhrases: 2 };

// ── INICIALIZAÇÃO ──────────────────────────────

async function init() {
  const islands = await Storage.getIslands();
  island = islands.find(i => i.id === islandId);
  if (!island) { window.location.href = 'index.html'; return; }

  document.title = `${island.name} — Language Islands`;
  document.getElementById('island-title').textContent        = island.name;
  document.getElementById('island-langs-display').textContent =
    `${island.native_language} → ${island.target_language}`;
  document.getElementById('label-native').textContent = `Texto em ${island.native_language}`;
  document.getElementById('label-target').textContent = `Texto em ${island.target_language}`;

  settings = Storage.getSettings();
  loadSettingsUI();

  await renderPhrases();
}

// ── RENDERIZAÇÃO ───────────────────────────────

async function renderPhrases() {
  // Para o player e o áudio dos cards antes de re-renderizar
  if (abortController) {
    abortController.abort();
    isPlaying = false;
    clearHighlight();
    updatePlayerBarBtn();
    updateRepText(0, 0);
  }
  _cardAudio.pause();
  _playingCardId = null;

  const container = document.getElementById('phrases-list');
  cachedPhrases   = await Storage.getPhrases(islandId);

  updatePlayerBar();

  if (cachedPhrases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">💬</span>
        <p>Esta ilha ainda não tem frases.</p>
        <p>Clica em "+ Nova frase" para começar!</p>
      </div>
    `;
    return;
  }

  const parts     = [];
  let dividerDone = false;

  cachedPhrases.forEach((phrase, index) => {
    if (phrase.mastered && !dividerDone) {
      parts.push(`<div class="mastered-divider"><span>dominadas</span></div>`);
      dividerDone = true;
    }

    const stars     = phrase.stars || 0;
    const starsHtml = [1,2,3,4,5].map(s => `
      <button class="star-btn ${stars >= s ? 'star-on' : 'star-off'}"
        onclick="setStars('${phrase.id}', ${stars === s ? 0 : s})"
        aria-label="${s} estrela${s > 1 ? 's' : ''}">★</button>
    `).join('');

    parts.push(`
      <div class="phrase-card ${phrase.mastered ? 'phrase-mastered' : ''}"
        data-phrase-id="${phrase.id}"
        onclick="handleCardClick(event, '${phrase.id}')">

        <div class="phrase-left">
          <span class="phrase-number">${index + 1}</span>
          ${phrase.audio_url
            ? `<button class="speaker-btn" id="speaker-${phrase.id}"
                 onclick="playPhraseAudio('${phrase.id}')"
                 aria-label="Reproduzir áudio">🔊</button>`
            : `<div class="speaker-placeholder"></div>`
          }
        </div>

        <div class="phrase-content">
          <p class="phrase-target ${isBlurred ? 'recall-blurred' : ''}">
            ${escapeHtml(phrase.target_text)}
          </p>
          <p class="phrase-native">${escapeHtml(phrase.native_text)}</p>
        </div>

        <div class="phrase-right">
          <div class="phrase-meta">
            <div class="stars-row">${starsHtml}</div>
            <button class="mastered-btn ${phrase.mastered ? 'mastered-on' : ''}"
              onclick="toggleMastered('${phrase.id}')"
              title="${phrase.mastered ? 'Remover marcação' : 'Marcar como dominada'}">✓</button>
          </div>
          <div class="phrase-actions">
            <button class="btn btn-secondary btn-sm"
              onclick="openEditModal('${phrase.id}')">Editar</button>
            <button class="btn btn-danger btn-sm"
              onclick="openDeleteModal('${phrase.id}')">Eliminar</button>
          </div>
        </div>

      </div>
    `);
  });

  container.innerHTML = parts.join('');
}

// ── SPEAKER CARDS ──────────────────────────────

function playPhraseAudio(phraseId) {
  // Para o player se estiver activo
  if (isPlaying) {
    if (abortController) abortController.abort();
    isPlaying = false;
    clearHighlight();
    updatePlayerBarBtn();
    updateRepText(0, 0);
  }

  // Clicar no mesmo botão pausa
  if (_playingCardId === phraseId && !_cardAudio.paused) {
    _cardAudio.pause();
    _cardAudio.currentTime = 0;
    updateSpeakerBtn(phraseId, false);
    _playingCardId = null;
    return;
  }

  // Para o áudio anterior
  if (_playingCardId && _playingCardId !== phraseId) {
    _cardAudio.pause();
    updateSpeakerBtn(_playingCardId, false);
  }

  const phrase = cachedPhrases.find(p => p.id === phraseId);
  if (!phrase?.audio_url) return;

  _cardAudio.src         = phrase.audio_url;
  _cardAudio.currentTime = 0;
  _playingCardId         = phraseId;
  updateSpeakerBtn(phraseId, true);

  _cardAudio.onended = () => {
    updateSpeakerBtn(phraseId, false);
    _playingCardId = null;
  };

  _cardAudio.play().catch(() => {
    updateSpeakerBtn(phraseId, false);
    _playingCardId = null;
  });
}

function updateSpeakerBtn(phraseId, playing) {
  const btn = document.getElementById(`speaker-${phraseId}`);
  if (!btn) return;
  btn.classList.toggle('playing', playing);
  btn.textContent = playing ? '⏸' : '🔊';
}

// ── BLUR TOGGLE ────────────────────────────────

function toggleBlur() {
  isBlurred = !isBlurred;
  document.querySelectorAll('.phrase-target').forEach(el => {
    el.classList.toggle('recall-blurred', isBlurred);
  });
  const btn = document.getElementById('blur-toggle');
  btn.textContent = isBlurred ? '👁 Mostrar' : '👁 Ocultar';
  btn.classList.toggle('btn-blur-active', isBlurred);
  btn.classList.toggle('btn-secondary',   !isBlurred);
}

// ── ESTRELAS ───────────────────────────────────

async function setStars(phraseId, newStars) {
  try {
    await Storage.updatePhrase(phraseId, { stars: newStars });
    const phrase = cachedPhrases.find(p => p.id === phraseId);
    if (phrase) phrase.stars = newStars;

    const card = document.querySelector(`[data-phrase-id="${phraseId}"]`);
    if (!card) return;
    card.querySelectorAll('.star-btn').forEach((btn, i) => {
      const val = i + 1;
      btn.classList.toggle('star-on',  newStars >= val);
      btn.classList.toggle('star-off', newStars < val);
      btn.onclick = () => setStars(phraseId, newStars === val ? 0 : val);
    });
  } catch (e) {
    alert('Erro ao guardar estrelas: ' + e.message);
  }
}

// ── DOMINADAS ──────────────────────────────────

async function toggleMastered(phraseId) {
  try {
    const phrase = cachedPhrases.find(p => p.id === phraseId);
    if (!phrase) return;
    await Storage.updatePhrase(phraseId, { mastered: !phrase.mastered });
    await renderPhrases();
  } catch (e) {
    alert('Erro ao actualizar frase: ' + e.message);
  }
}

// ── PLAYER HELPERS ─────────────────────────────

function sleep(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted || ms <= 0) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function playAudioPlayer(url, signal) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      _playerAudio.onended = null;
      _playerAudio.onerror = null;
      resolve();
    }

    _playerAudio.onended = finish;
    _playerAudio.onerror = finish;

    signal.addEventListener('abort', () => {
      _playerAudio.pause();
      _playerAudio.currentTime = 0;
      finish();
    }, { once: true });

    _playerAudio.src = url;
    _playerAudio.currentTime = 0;
    _playerAudio.play().catch(finish);
  });
}

// ── PLAYER LOOP ───────────────────────────────

async function runPlayback() {
  abortController = new AbortController();
  const signal    = abortController.signal;
  const total     = cachedPhrases.length;

  while (currentPhraseIndex < total && !signal.aborted) {
    const phrase    = cachedPhrases[currentPhraseIndex];
    const hasAudio  = !!phrase.audio_url;
    const totalReps = hasAudio ? settings.repetitions : 1;

    highlightPhrase(currentPhraseIndex);
    updatePlayerBar();

    for (let rep = 0; rep < totalReps && !signal.aborted; rep++) {
      updateRepText(rep + 1, totalReps);

      if (hasAudio) {
        await playAudioPlayer(phrase.audio_url, signal);
      } else {
        await sleep(3000, signal);
      }

      if (!signal.aborted && rep < totalReps - 1) {
        await sleep(settings.pauseBetweenReps * 1000, signal);
      }
    }

    if (!signal.aborted) {
      currentPhraseIndex++;
      if (currentPhraseIndex < total && !isWritingMode) {
        await sleep(settings.pauseBetweenPhrases * 1000, signal);
      }
    }

    if (isWritingMode) {
      // Toca o áudio uma vez antes de mostrar o campo de escrita
      if (hasAudio && !signal.aborted) {
        _writingAudioUrl = phrase.audio_url;
        await playAudioPlayer(phrase.audio_url, signal);
      } else {
        _writingAudioUrl = null;
      }
      if (!signal.aborted) {
        await waitForWritingInput(phrase, signal);
      }
    } else {
      const totalReps = hasAudio ? settings.repetitions : 1;
      for (let rep = 0; rep < totalReps && !signal.aborted; rep++) {
        updateRepText(rep + 1, totalReps);
        if (hasAudio) {
          await playAudioPlayer(phrase.audio_url, signal);
        } else {
          await sleep(3000, signal);
        }
        if (!signal.aborted && rep < totalReps - 1) {
          await sleep(settings.pauseBetweenReps * 1000, signal);
        }
      }
    }
  }

  // Terminou naturalmente
    if (!signal.aborted) {
      if (isLooping) {
        // Reinicia do início sem parar o player
        currentPhraseIndex = 0;
        isPlaying = false;
        startPlayback();
        return;
      } else {
        currentPhraseIndex = 0;
        clearHighlight();
        updatePlayerBar();
        updateRepText(0, 0);
      }
    }

    isPlaying = false;
    updatePlayerBarBtn();
}

// ── PLAYER CONTROLOS ──────────────────────────

function togglePlay() {
  isPlaying ? pausePlayback() : startPlayback();
}

function startPlayback() {
  if (cachedPhrases.length === 0) return;
  if (currentPhraseIndex >= cachedPhrases.length) currentPhraseIndex = 0;

  // Para o áudio dos cards se estiver a tocar
  if (_playingCardId) {
    _cardAudio.pause();
    updateSpeakerBtn(_playingCardId, false);
    _playingCardId = null;
  }

  isPlaying = true;
  updatePlayerBarBtn();
  runPlayback();
}

function pausePlayback() {
  if (abortController) abortController.abort();
  isPlaying = false;
  updatePlayerBarBtn();
}

function stopPlayer() {
  if (abortController) abortController.abort();
  isPlaying          = false;
  currentPhraseIndex = 0;
  clearHighlight();
  updatePlayerBarBtn();
  updatePlayerBar();
  updateRepText(0, 0);
}

function nextPhrase() {
  const wasPlaying = isPlaying;
  if (abortController) abortController.abort();
  isPlaying = false;

  currentPhraseIndex = (currentPhraseIndex + 1) % cachedPhrases.length;
  updatePlayerBar();

  if (wasPlaying) {
    startPlayback();
  } else {
    highlightPhrase(currentPhraseIndex);
  }
}

function prevPhrase() {
  const wasPlaying = isPlaying;
  if (abortController) abortController.abort();
  isPlaying = false;

  currentPhraseIndex = (currentPhraseIndex - 1 + cachedPhrases.length) % cachedPhrases.length;
  updatePlayerBar();

  if (wasPlaying) {
    startPlayback();
  } else {
    highlightPhrase(currentPhraseIndex);
  }
}

function toggleLoop() {
  isLooping = !isLooping;
  const btn = document.getElementById('loop-btn');
  btn.classList.toggle('ipb-settings-active', isLooping);
  btn.title = isLooping ? 'Loop activo' : 'Repetir';
}

function handleCardClick(event, phraseId) {
  // Ignora cliques em botões dentro do card
  // — não queremos interferir com speaker, estrelas, editar, etc.
  if (event.target.closest('button')) return;

  setStartingPoint(phraseId);
}

function setStartingPoint(phraseId) {
  const index = cachedPhrases.findIndex(p => p.id === phraseId);
  if (index < 0) return;

  const wasPlaying = isPlaying;

  // Para a reprodução actual antes de mudar de posição
  if (abortController) abortController.abort();
  isPlaying = false;

  currentPhraseIndex = index;
  highlightPhrase(index);
  updatePlayerBar();
  updateRepText(0, 0);

  // Se estava a tocar, retoma automaticamente a partir da nova frase
  if (wasPlaying) startPlayback();
}

// ── MODO ESCRITA ──────────────────────────────

function toggleWritingMode() {
  isWritingMode = !isWritingMode;

  // Para o player ao activar/desactivar
  if (abortController) abortController.abort();
  isPlaying = false;
  clearHighlight();
  updatePlayerBarBtn();
  updateRepText(0, 0);
  hideWritingPanel();

  const btn = document.getElementById('writing-btn');
  btn.classList.toggle('ipb-settings-active', isWritingMode);
  btn.title = isWritingMode ? 'Modo escrita activo' : 'Modo escrita';

  // Actualiza o nome do idioma alvo no painel
  if (island) {
    document.getElementById('writing-target-lang').textContent = island.target_language;
  }
}

/**
 * normalizeText — remove acentos, pontuação e maiúsculas
 * para uma comparação justa.
 *
 * normalize('NFD') decompõe caracteres acentuados:
 *   'é' → 'e' + acento separado
 * O replace seguinte remove os acentos isolados.
 */
function normalizeText(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAnswerCorrect(input, target) {
  return normalizeText(input) === normalizeText(target);
}

function showWritingPanel(phrase) {
  const panel = document.getElementById('writing-panel');
  document.getElementById('writing-native-text').textContent = phrase.native_text;
  document.getElementById('writing-input').value    = '';
  document.getElementById('writing-input').disabled = false;
  document.getElementById('writing-feedback').classList.add('hidden');

  // Guarda o texto alvo como atributo para aceder no submitWriting()
  panel.dataset.targetText = phrase.target_text;

  // Mostra o botão de replay só se houver áudio
  const replayBtn = document.getElementById('writing-replay-btn');
  replayBtn.style.display = _writingAudioUrl ? 'flex' : 'none';

  panel.classList.remove('hidden');

  // Foca o input automaticamente
  setTimeout(() => document.getElementById('writing-input').focus(), 100);
}

function hideWritingPanel() {
  document.getElementById('writing-panel').classList.add('hidden');
}

function waitForWritingInput(phrase, signal) {
  return new Promise(resolve => {
    writingResolve = resolve;
    showWritingPanel(phrase);

    // Se o player for abortado (pausa/stop), fecha o painel e continua
    signal.addEventListener('abort', () => {
      hideWritingPanel();
      if (writingResolve) { writingResolve = null; resolve(); }
    }, { once: true });
  });
}

function handleWritingKey(event) {
  // Enter submete a resposta
  if (event.key === 'Enter') submitWriting();
}

function submitWriting() {
  const input      = document.getElementById('writing-input');
  const panel      = document.getElementById('writing-panel');
  const feedback   = document.getElementById('writing-feedback');
  const resultEl   = document.getElementById('writing-result');
  const correctEl  = document.getElementById('writing-correct-answer');

  const userAnswer = input.value.trim();
  if (!userAnswer) return;

  const targetText = panel.dataset.targetText;
  const correct    = isAnswerCorrect(userAnswer, targetText);

  input.disabled = true;

  if (correct) {
    resultEl.textContent = '✓ Correcto!';
    resultEl.className   = 'writing-result writing-ok';
    correctEl.textContent = '';
  } else {
    resultEl.textContent  = '✗ Errado';
    resultEl.className    = 'writing-result writing-wrong';
    correctEl.textContent = targetText;
  }

  feedback.classList.remove('hidden');
}

function advanceWriting() {
  hideWritingPanel();
  if (writingResolve) {
    const resolve  = writingResolve;
    writingResolve = null;
    resolve();
  }
}

function replayWritingAudio() {
  if (!_writingAudioUrl) return;
  _playerAudio.src         = _writingAudioUrl;
  _playerAudio.currentTime = 0;
  _playerAudio.play().catch(() => {});
}

// ── PLAYER UI ────────────────────────────────

function highlightPhrase(index) {
  clearHighlight();
  const phrase = cachedPhrases[index];
  if (!phrase) return;
  const card = document.querySelector(`[data-phrase-id="${phrase.id}"]`);
  if (!card) return;
  card.classList.add('phrase-playing');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearHighlight() {
  document.querySelectorAll('.phrase-playing')
    .forEach(el => el.classList.remove('phrase-playing'));
}

function updatePlayerBar() {
  const total   = cachedPhrases.length;
  const current = total > 0 ? Math.min(currentPhraseIndex + 1, total) : 0;
  document.getElementById('bar-progress-text').textContent =
    total > 0 ? `${current} / ${total}` : '';
}

function updateRepText(rep, total) {
  const el = document.getElementById('bar-rep-text');
  if (!el) return;
  el.textContent = (total > 1 && rep > 0) ? `Rep ${rep}×` : '';
}

function updatePlayerBarBtn() {
  const btn = document.getElementById('bar-play-btn');
  if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
}

// ── DEFINIÇÕES ────────────────────────────────

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
  document.getElementById('s-reps-value').textContent          = settings.repetitions + 'x';
  document.getElementById('s-pause-reps-value').textContent    = settings.pauseBetweenReps + 's';
  document.getElementById('s-pause-phrases-value').textContent = settings.pauseBetweenPhrases + 's';
}

function toggleSettings() {
  const content = document.getElementById('settings-content');
  const btn     = document.getElementById('settings-btn');
  const isOpen  = !content.classList.contains('hidden');
  content.classList.toggle('hidden');
  btn.classList.toggle('ipb-settings-active', !isOpen);
}

// ── MODAIS ─────────────────────────────────────

function openCreateModal() {
  resetAudioState();
  document.getElementById('phrase-modal-title').textContent = 'Nova frase';
  document.getElementById('phrase-id').value     = '';
  document.getElementById('phrase-native').value = '';
  document.getElementById('phrase-target').value = '';
  openModal('phrase-modal');
}

function openEditModal(id) {
  const phrase = cachedPhrases.find(p => p.id === id);
  if (!phrase) return;

  resetAudioState();
  document.getElementById('phrase-modal-title').textContent = 'Editar frase';
  document.getElementById('phrase-id').value     = phrase.id;
  document.getElementById('phrase-native').value = phrase.native_text;
  document.getElementById('phrase-target').value = phrase.target_text;

  if (phrase.audio_url) {
    document.getElementById('current-audio-player').src = phrase.audio_url;
    document.getElementById('current-audio-section').classList.remove('hidden');
  }

  openModal('phrase-modal');
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  openModal('delete-modal');
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── ÁUDIO FORMULÁRIO ──────────────────────────

function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    pendingAudioFile = null;
    document.getElementById('new-audio-section').classList.add('hidden');
    return;
  }

  pendingAudioFile = file;

  const targetField = document.getElementById('phrase-target');
  if (!targetField.value.trim()) {
    targetField.value = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]/g, ' ')
      .trim();
  }

  document.getElementById('new-audio-player').src = URL.createObjectURL(file);
  document.getElementById('new-audio-section').classList.remove('hidden');
}

function removeCurrentAudio() {
  removeAudioFlag = true;
  document.getElementById('current-audio-section').classList.add('hidden');
}

function resetAudioState() {
  pendingAudioFile = null;
  removeAudioFlag  = false;
  document.getElementById('phrase-audio-file').value   = '';
  document.getElementById('current-audio-player').src  = '';
  document.getElementById('new-audio-player').src      = '';
  document.getElementById('current-audio-section').classList.add('hidden');
  document.getElementById('new-audio-section').classList.add('hidden');
}

// ── FORMULÁRIO ─────────────────────────────────

async function submitPhraseForm(event) {
  event.preventDefault();

  const submitBtn = event.target.querySelector('[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'A guardar...';

  try {
    const id         = document.getElementById('phrase-id').value;
    const nativeText = document.getElementById('phrase-native').value.trim();
    const targetText = document.getElementById('phrase-target').value.trim();
    const original   = id ? cachedPhrases.find(p => p.id === id) : null;
    const maxOrder   = cachedPhrases.reduce((max, p) => Math.max(max, p.sort_order), -1);
    const phraseId   = id || crypto.randomUUID();
    let audioUrl     = original?.audio_url || null;

    if (pendingAudioFile) {
      if (original?.audio_url) await Storage.deleteAudio(original.audio_url);
      audioUrl = await Storage.uploadAudio(pendingAudioFile);
    } else if (removeAudioFlag && original?.audio_url) {
      await Storage.deleteAudio(original.audio_url);
      audioUrl = null;
    }

    await Storage.savePhrase({
      id:          phraseId,
      island_id:   islandId,
      native_text: nativeText,
      target_text: targetText,
      audio_url:   audioUrl,
      sort_order:  original ? original.sort_order : maxOrder + 1,
      stars:       original?.stars    || 0,
      mastered:    original?.mastered || false
    });

    closeModal('phrase-modal');
    await renderPhrases();

  } catch (e) {
    alert('Erro ao guardar frase: ' + e.message);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Guardar';
  }
}

// ── ELIMINAR ───────────────────────────────────

async function confirmDeletePhrase() {
  if (!pendingDeleteId) return;
  try {
    const phrase = cachedPhrases.find(p => p.id === pendingDeleteId);
    if (phrase?.audio_url) await Storage.deleteAudio(phrase.audio_url);
    await Storage.deletePhrase(pendingDeleteId);
    pendingDeleteId = null;
    closeModal('delete-modal');
    await renderPhrases();
  } catch (e) {
    alert('Erro ao eliminar frase: ' + e.message);
  }
}

// ── UTILITÁRIOS ────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── ARRANQUE ───────────────────────────────────

init().catch(err => {
  console.error(err);
  alert('Erro ao carregar a página. Verifica a ligação ao Supabase.');
});