/**
 * phrases.js — CRUD das frases
 * Inclui: speaker compacto, estrelas, dominadas, blur toggle
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

// Elemento de áudio partilhado entre todos os cards
const _cardAudio     = new Audio();
let _playingPhraseId = null;

// ── INICIALIZAÇÃO ──────────────────────────────

async function init() {
  const islands = await Storage.getIslands();
  island = islands.find(i => i.id === islandId);
  if (!island) { window.location.href = 'index.html'; return; }

  document.title = `${island.name} — Language Islands`;
  document.getElementById('island-title').textContent = island.name;
  document.getElementById('island-langs-display').textContent =
    `${island.native_language} → ${island.target_language}`;
  document.getElementById('label-native').textContent = `Texto em ${island.native_language}`;
  document.getElementById('label-target').textContent = `Texto em ${island.target_language}`;

  await renderPhrases();
}

// ── RENDERIZAÇÃO ───────────────────────────────

async function renderPhrases() {
  const container  = document.getElementById('phrases-list');
  cachedPhrases    = await Storage.getPhrases(islandId);

  const playBtn    = document.getElementById('play-btn');
  const blurToggle = document.getElementById('blur-toggle');

  if (cachedPhrases.length > 0) {
    playBtn.href = `play.html?id=${islandId}`;
    playBtn.classList.remove('hidden');
    blurToggle.classList.remove('hidden');
  } else {
    playBtn.classList.add('hidden');
    blurToggle.classList.add('hidden');
  }

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

    // Divisor antes do primeiro dominado
    if (phrase.mastered && !dividerDone) {
      parts.push(`<div class="mastered-divider"><span>dominadas</span></div>`);
      dividerDone = true;
    }

    const stars = phrase.stars || 0;

    // Gera os 5 botões de estrela
    // Clicar na mesma estrela que já está activa → reset para 0
    const starsHtml = [1,2,3,4,5].map(s => `
      <button class="star-btn ${stars >= s ? 'star-on' : 'star-off'}"
        onclick="setStars('${phrase.id}', ${stars === s ? 0 : s})"
        aria-label="${s} estrela${s > 1 ? 's' : ''}">★</button>
    `).join('');

    parts.push(`
      <div class="phrase-card ${phrase.mastered ? 'phrase-mastered' : ''}"
        data-phrase-id="${phrase.id}">

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

  // Para o áudio se um re-render acontecer enquanto está a tocar
  if (_playingPhraseId) {
    _cardAudio.pause();
    _playingPhraseId = null;
  }
}

// ── SPEAKER COMPACTO ───────────────────────────

function playPhraseAudio(phraseId) {
  // Clicar no mesmo botão pausa
  if (_playingPhraseId === phraseId && !_cardAudio.paused) {
    _cardAudio.pause();
    _cardAudio.currentTime = 0;
    updateSpeakerBtn(phraseId, false);
    _playingPhraseId = null;
    return;
  }

  // Para o áudio anterior se for uma frase diferente
  if (_playingPhraseId && _playingPhraseId !== phraseId) {
    _cardAudio.pause();
    updateSpeakerBtn(_playingPhraseId, false);
  }

  const phrase = cachedPhrases.find(p => p.id === phraseId);
  if (!phrase?.audio_url) return;

  _cardAudio.src         = phrase.audio_url;
  _cardAudio.currentTime = 0;
  _playingPhraseId       = phraseId;
  updateSpeakerBtn(phraseId, true);

  _cardAudio.onended = () => {
    updateSpeakerBtn(phraseId, false);
    _playingPhraseId = null;
  };

  _cardAudio.play().catch(() => {
    updateSpeakerBtn(phraseId, false);
    _playingPhraseId = null;
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
  btn.textContent = isBlurred ? '👁 Mostrar traduções' : '👁 Ocultar traduções';
  btn.classList.toggle('btn-blur-active', isBlurred);
  btn.classList.toggle('btn-secondary',   !isBlurred);
}

// ── ESTRELAS ───────────────────────────────────

async function setStars(phraseId, newStars) {
  try {
    await Storage.updatePhrase(phraseId, { stars: newStars });

    // Actualiza o cache local para não precisar de ir à BD
    const phrase = cachedPhrases.find(p => p.id === phraseId);
    if (phrase) phrase.stars = newStars;

    // Actualiza apenas os botões de estrela sem re-renderizar o card inteiro
    // (evita interromper o áudio que possa estar a tocar)
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
    // Re-render completo porque a posição do card muda
    await renderPhrases();
  } catch (e) {
    alert('Erro ao actualizar frase: ' + e.message);
  }
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

// ── ÁUDIO DO FORMULÁRIO ────────────────────────

function handleAudioUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    pendingAudioFile = null;
    document.getElementById('new-audio-section').classList.add('hidden');
    return;
  }

  pendingAudioFile = file;

  // Preenche o campo alvo com o nome do ficheiro se estiver vazio
  const targetField = document.getElementById('phrase-target');
  if (!targetField.value.trim()) {
    const cleanName = file.name
      .replace(/\.[^.]+$/, '')   // remove extensão
      .replace(/[_-]/g, ' ')     // underscores e hífens → espaços
      .trim();
    targetField.value = cleanName;
  }

  const tempUrl = URL.createObjectURL(file);
  document.getElementById('new-audio-player').src = tempUrl;
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

    const original = id ? cachedPhrases.find(p => p.id === id) : null;
    const maxOrder = cachedPhrases.reduce((max, p) => Math.max(max, p.sort_order), -1);

    const phraseId = id || crypto.randomUUID();
    let audioUrl   = original?.audio_url || null;

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