/**
 * set.js — CRUD das palavras dentro de um conjunto de vocabulário
 */

const urlParams = new URLSearchParams(window.location.search);
const setId     = urlParams.get('id');
if (!setId) window.location.href = 'vocabulary.html';

let vocabSet        = null;
let cachedWords     = [];
let pendingDeleteId = null;
let pendingAudioFile = null;
let removeAudioFlag  = false;
let isBlurred        = false;

const _cardAudio     = new Audio();
let _playingWordId   = null;

// ── INICIALIZAÇÃO ──────────────────────────────

async function init() {
  const sets = await Storage.getVocabSets();
  vocabSet   = sets.find(s => s.id === setId);
  if (!vocabSet) { window.location.href = 'vocabulary.html'; return; }

  document.title = `${vocabSet.name} — Language Islands`;
  document.getElementById('set-title').textContent = vocabSet.name;
  document.getElementById('set-langs-display').textContent =
    `${vocabSet.native_language} → ${vocabSet.target_language}`;
  document.getElementById('label-native').textContent = `Word in ${vocabSet.native_language}`;
  document.getElementById('label-target').textContent = `Word in ${vocabSet.target_language}`;

  renderSidebar('vocabulary');
  await renderWords();
}

// ── RENDERIZAÇÃO ───────────────────────────────

async function renderWords() {
  const container = document.getElementById('words-list');
  cachedWords     = await Storage.getWords(setId);

  const blurToggle = document.getElementById('blur-toggle');
  blurToggle.classList.toggle('hidden', cachedWords.length === 0);

  if (cachedWords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">📖</span>
        <p>This set has no words yet.</p>
        <p>Click "+ New Word" to get started!</p>
      </div>
    `;
    return;
  }

  const parts     = [];
  let dividerDone = false;

  cachedWords.forEach((word, index) => {
    if (word.mastered && !dividerDone) {
      parts.push(`<div class="mastered-divider"><span>mastered</span></div>`);
      dividerDone = true;
    }

    const stars     = word.stars || 0;
    const starsHtml = [1,2,3,4,5].map(s => `
      <button class="star-btn ${stars >= s ? 'star-on' : 'star-off'}"
        onclick="setStars('${word.id}', ${stars === s ? 0 : s})">★</button>
    `).join('');

    parts.push(`
      <div class="word-card ${word.mastered ? 'word-mastered' : ''}" data-word-id="${word.id}">

        <div class="phrase-left">
          <span class="phrase-number">${index + 1}</span>
          ${word.audio_url
            ? `<button class="speaker-btn" id="speaker-${word.id}"
                 onclick="playWordAudio('${word.id}')">🔊</button>`
            : `<div class="speaker-placeholder"></div>`
          }
        </div>

        <div class="word-content">
          <div class="word-target ${isBlurred ? 'recall-blurred' : ''}">
            ${escapeHtml(word.target_word)}
          </div>
          <div class="word-native">${escapeHtml(word.native_word)}</div>
        </div>

        <div class="word-right">
          <div class="phrase-meta">
            <div class="stars-row">${starsHtml}</div>
            <button class="mastered-btn ${word.mastered ? 'mastered-on' : ''}"
              onclick="toggleMastered('${word.id}')"
              title="${word.mastered ? 'Remove mastered' : 'Mark as mastered'}">✓</button>
          </div>
          <div class="word-actions">
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${word.id}')">Edit</button>
            <button class="btn btn-danger btn-sm"    onclick="openDeleteModal('${word.id}')">Delete</button>
          </div>
        </div>

      </div>
    `);
  });

  container.innerHTML = parts.join('');
}

// ── SPEAKER ────────────────────────────────────

function playWordAudio(wordId) {
  if (_playingWordId === wordId && !_cardAudio.paused) {
    _cardAudio.pause();
    _cardAudio.currentTime = 0;
    updateSpeakerBtn(wordId, false);
    _playingWordId = null;
    return;
  }

  if (_playingWordId && _playingWordId !== wordId) {
    _cardAudio.pause();
    updateSpeakerBtn(_playingWordId, false);
  }

  const word = cachedWords.find(w => w.id === wordId);
  if (!word?.audio_url) return;

  _cardAudio.src         = word.audio_url;
  _cardAudio.currentTime = 0;
  _playingWordId         = wordId;
  updateSpeakerBtn(wordId, true);

  _cardAudio.onended = () => { updateSpeakerBtn(wordId, false); _playingWordId = null; };
  _cardAudio.play().catch(() => { updateSpeakerBtn(wordId, false); _playingWordId = null; });
}

function updateSpeakerBtn(wordId, playing) {
  const btn = document.getElementById(`speaker-${wordId}`);
  if (!btn) return;
  btn.classList.toggle('playing', playing);
  btn.textContent = playing ? '⏸' : '🔊';
}

// ── BLUR ───────────────────────────────────────

function toggleBlur() {
  isBlurred = !isBlurred;
  document.querySelectorAll('.word-target').forEach(el =>
    el.classList.toggle('recall-blurred', isBlurred)
  );
  const btn = document.getElementById('blur-toggle');
  btn.textContent = isBlurred ? '👁 Show' : '👁 Hide';
  btn.classList.toggle('btn-blur-active', isBlurred);
  btn.classList.toggle('btn-secondary',   !isBlurred);
}

// ── ESTRELAS ───────────────────────────────────

async function setStars(wordId, newStars) {
  try {
    await Storage.updateWord(wordId, { stars: newStars });
    const word = cachedWords.find(w => w.id === wordId);
    if (word) word.stars = newStars;

    const card = document.querySelector(`[data-word-id="${wordId}"]`);
    if (!card) return;
    card.querySelectorAll('.star-btn').forEach((btn, i) => {
      const val = i + 1;
      btn.classList.toggle('star-on',  newStars >= val);
      btn.classList.toggle('star-off', newStars < val);
      btn.onclick = () => setStars(wordId, newStars === val ? 0 : val);
    });
  } catch (e) {
    alert('Error saving stars: ' + e.message);
  }
}

// ── DOMINADAS ──────────────────────────────────

async function toggleMastered(wordId) {
  try {
    const word = cachedWords.find(w => w.id === wordId);
    if (!word) return;
    await Storage.updateWord(wordId, { mastered: !word.mastered });
    await renderWords();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ── MODAIS ─────────────────────────────────────

function openCreateModal() {
  resetAudioState();
  document.getElementById('word-modal-title').textContent = 'New Word';
  document.getElementById('word-id').value     = '';
  document.getElementById('word-native').value = '';
  document.getElementById('word-target').value = '';
  openModal('word-modal');
}

function openEditModal(id) {
  const word = cachedWords.find(w => w.id === id);
  if (!word) return;

  resetAudioState();
  document.getElementById('word-modal-title').textContent = 'Edit Word';
  document.getElementById('word-id').value     = word.id;
  document.getElementById('word-native').value = word.native_word;
  document.getElementById('word-target').value = word.target_word;

  if (word.audio_url) {
    document.getElementById('current-audio-player').src = word.audio_url;
    document.getElementById('current-audio-section').classList.remove('hidden');
  }

  openModal('word-modal');
}

function openDeleteModal(id) { pendingDeleteId = id; openModal('delete-modal'); }
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── ÁUDIO ──────────────────────────────────────

function handleAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) { pendingAudioFile = null; document.getElementById('new-audio-section').classList.add('hidden'); return; }

  pendingAudioFile = file;

  const targetField = document.getElementById('word-target');
  if (!targetField.value.trim()) {
    targetField.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim();
  }

  document.getElementById('new-audio-player').src = URL.createObjectURL(file);
  document.getElementById('new-audio-section').classList.remove('hidden');
}

function removeCurrentAudio() {
  removeAudioFlag = true;
  document.getElementById('current-audio-section').classList.add('hidden');
}

function resetAudioState() {
  pendingAudioFile = null; removeAudioFlag = false;
  document.getElementById('word-audio-file').value       = '';
  document.getElementById('current-audio-player').src   = '';
  document.getElementById('new-audio-player').src        = '';
  document.getElementById('current-audio-section').classList.add('hidden');
  document.getElementById('new-audio-section').classList.add('hidden');
}

// ── FORMULÁRIO ─────────────────────────────────

async function submitWordForm(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('[type="submit"]');
  submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

  try {
    const id         = document.getElementById('word-id').value;
    const nativeWord = document.getElementById('word-native').value.trim();
    const targetWord = document.getElementById('word-target').value.trim();
    const original   = id ? cachedWords.find(w => w.id === id) : null;
    const maxOrder   = cachedWords.reduce((max, w) => Math.max(max, w.sort_order), -1);
    const wordId     = id || crypto.randomUUID();
    let audioUrl     = original?.audio_url || null;

    if (pendingAudioFile) {
      if (original?.audio_url) await Storage.deleteAudio(original.audio_url);
      audioUrl = await Storage.uploadAudio(pendingAudioFile);
    } else if (removeAudioFlag && original?.audio_url) {
      await Storage.deleteAudio(original.audio_url);
      audioUrl = null;
    }

    await Storage.saveWord({
      id:          wordId,
      set_id:      setId,
      native_word: nativeWord,
      target_word: targetWord,
      audio_url:   audioUrl,
      sort_order:  original ? original.sort_order : maxOrder + 1,
      stars:       original?.stars    || 0,
      mastered:    original?.mastered || false
    });

    closeModal('word-modal');
    await renderWords();
  } catch (e) {
    alert('Error saving word: ' + e.message);
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = 'Save';
  }
}

// ── ELIMINAR ───────────────────────────────────

async function confirmDeleteWord() {
  if (!pendingDeleteId) return;
  try {
    const word = cachedWords.find(w => w.id === pendingDeleteId);
    if (word?.audio_url) await Storage.deleteAudio(word.audio_url);
    await Storage.deleteWord(pendingDeleteId);
    pendingDeleteId = null;
    closeModal('delete-modal');
    await renderWords();
  } catch (e) {
    alert('Error deleting word: ' + e.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init().catch(err => {
  console.error(err);
  alert('Error loading page. Check Supabase connection.');
});
