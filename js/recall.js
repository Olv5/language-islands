/**
 * recall.js — Modo "Active Recall"
 *
 * Mostra a frase na língua nativa e esconde (com blur) a
 * frase na língua alvo. O utilizador tenta lembrar-se da
 * frase de cor antes de revelar — é esse esforço de
 * recordar que reforça a memória, em vez de apenas ler.
 */

const urlParams = new URLSearchParams(window.location.search);
const islandId  = urlParams.get('id');
if (!islandId) window.location.href = 'index.html';

let island     = null;
let phrases    = [];
let order      = [];   // array de índices — permite baralhar sem tocar em 'phrases'
let currentPos = 0;    // posição actual dentro de 'order'
let isRevealed = false;

// ── INICIALIZAÇÃO ──────────────────────────────

async function init() {
  const islands = await Storage.getIslands();
  island = islands.find(i => i.id === islandId);
  if (!island) { window.location.href = 'index.html'; return; }

  phrases = await Storage.getPhrases(islandId);
  if (phrases.length === 0) { window.location.href = `island.html?id=${islandId}`; return; }

  // 'order' começa igual à ordem das frases: [0, 1, 2, 3...]
  order = phrases.map((_, index) => index);

  document.title = `${island.name} — Active Recall`;
  document.getElementById('back-link').href = `island.html?id=${islandId}`;
  document.getElementById('recall-island-name').textContent = island.name;
  document.getElementById('recall-island-langs').textContent =
    `${island.native_language} → ${island.target_language}`;

  showCard();
}

// ── RENDERIZAÇÃO ───────────────────────────────

function showCard() {
  // order[currentPos] dá-nos o índice real na lista 'phrases'
  const phrase = phrases[order[currentPos]];

  document.getElementById('recall-native').textContent = phrase.native_text;
  document.getElementById('recall-target').textContent = phrase.target_text;

  const audioEl = document.getElementById('recall-audio');
  if (phrase.audio_url) {
    audioEl.src = phrase.audio_url;
  } else {
    audioEl.removeAttribute('src');
  }

  // Cada nova frase começa sempre escondida
  isRevealed = false;
  applyRevealState();
  updateProgress();
}

function applyRevealState() {
  const target  = document.getElementById('recall-target');
  const audioEl = document.getElementById('recall-audio');
  const btn     = document.getElementById('recall-toggle-btn');
  const phrase  = phrases[order[currentPos]];

  if (isRevealed) {
    target.classList.remove('recall-blurred');
    btn.textContent = 'Ocultar frase';
    // .toggle(classe, condição) — só mostra o áudio se a frase tiver um
    audioEl.classList.toggle('hidden', !phrase.audio_url);
  } else {
    target.classList.add('recall-blurred');
    btn.textContent = 'Revelar frase';
    audioEl.classList.add('hidden');
    audioEl.pause();   // evita que o áudio continue a tocar depois de esconder
  }
}

function updateProgress() {
  const total   = order.length;
  const current = currentPos + 1;
  const percent = (currentPos / total) * 100;

  document.getElementById('recall-progress-text').textContent =
    `Frase ${current} de ${total}`;
  document.getElementById('recall-progress-fill').style.width = percent + '%';
}

// ── CONTROLOS ──────────────────────────────────

function toggleReveal() {
  isRevealed = !isRevealed;
  applyRevealState();
}

function nextCard() {
  // O '%' faz a lista dar a volta: depois da última frase volta à primeira
  currentPos = (currentPos + 1) % order.length;
  showCard();
}

function prevCard() {
  // '+ order.length' antes do '%' evita índices negativos
  currentPos = (currentPos - 1 + order.length) % order.length;
  showCard();
}

function shuffleCards() {
  // Fisher-Yates shuffle: percorre o array de trás para a frente,
  // troca cada posição com uma posição aleatória anterior (ou igual).
  // É o algoritmo padrão para baralhar sem repetições e sem viés.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  currentPos = 0;
  showCard();
}

// ── ARRANQUE ───────────────────────────────────

init().catch(err => {
  console.error(err);
  alert('Erro ao carregar o modo Active Recall.');
});