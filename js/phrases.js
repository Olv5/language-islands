/**
 * phrases.js — CRUD das frases
 * O áudio agora é carregado para o Supabase Storage.
 * URL.createObjectURL() substitui o base64 na pré-visualização.
 */

const urlParams = new URLSearchParams(window.location.search);
const islandId  = urlParams.get('id');
if (!islandId) window.location.href = 'index.html';

let island          = null;
let pendingDeleteId = null;
let pendingAudioFile = null;  // File object (não base64)
let removeAudioFlag  = false;

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
  const container = document.getElementById('phrases-list');
  const phrases   = await Storage.getPhrases(islandId);

  const playBtn = document.getElementById('play-btn');
  if (phrases.length > 0) {
    playBtn.href = `play.html?id=${islandId}`;
    playBtn.classList.remove('hidden');
  } else {
    playBtn.classList.add('hidden');
  }

  if (phrases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">💬</span>
        <p>Esta ilha ainda não tem frases.</p>
        <p>Clica em "+ Nova frase" para começar!</p>
      </div>
    `;
    return;
  }

  // Com Supabase os URLs são permanentes — podemos usá-los directamente no src
  container.innerHTML = phrases.map((phrase, index) => `
    <div class="phrase-card">
      <div class="phrase-number">${index + 1}</div>
      <div class="phrase-content">
        <div class="phrase-native">${escapeHtml(phrase.native_text)}</div>
        <div class="phrase-target">${escapeHtml(phrase.target_text)}</div>
        ${phrase.audio_url
          ? `<audio class="phrase-audio" controls src="${escapeHtml(phrase.audio_url)}"></audio>`
          : `<span class="no-audio">Sem áudio</span>`
        }
      </div>
      <div class="phrase-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${phrase.id}')">Editar</button>
        <button class="btn btn-danger btn-sm"    onclick="openDeleteModal('${phrase.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
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

async function openEditModal(id) {
  const phrases = await Storage.getPhrases(islandId);
  const phrase  = phrases.find(p => p.id === id);
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

// ── ÁUDIO ──────────────────────────────────────

function handleAudioUpload(event) {
  const file = event.target.files[0];

  if (!file) {
    pendingAudioFile = null;
    document.getElementById('new-audio-section').classList.add('hidden');
    return;
  }

  // Guardamos o File object — o upload para o Supabase acontece só ao guardar
  pendingAudioFile = file;

  // createObjectURL cria um URL temporário local para pré-visualizar sem fazer upload
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
  document.getElementById('phrase-audio-file').value     = '';
  document.getElementById('current-audio-player').src   = '';
  document.getElementById('new-audio-player').src        = '';
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

    const phrases  = await Storage.getPhrases(islandId);
    const original = id ? phrases.find(p => p.id === id) : null;
    const maxOrder = phrases.reduce((max, p) => Math.max(max, p.sort_order), -1);

    const phraseId = id || crypto.randomUUID();
    let audioUrl   = original?.audio_url || null;

    if (pendingAudioFile) {
      // Faz upload do novo ficheiro; se havia áudio antigo, elimina-o
      if (original?.audio_url) await Storage.deleteAudio(original.audio_url);
      audioUrl = await Storage.uploadAudio(pendingAudioFile, phraseId);

    } else if (removeAudioFlag && original?.audio_url) {
      // Utilizador removeu o áudio existente
      await Storage.deleteAudio(original.audio_url);
      audioUrl = null;
    }

    await Storage.savePhrase({
      id:          phraseId,
      island_id:   islandId,
      native_text: nativeText,
      target_text: targetText,
      audio_url:   audioUrl,
      sort_order:  original ? original.sort_order : maxOrder + 1
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
    const phrases = await Storage.getPhrases(islandId);
    const phrase  = phrases.find(p => p.id === pendingDeleteId);
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