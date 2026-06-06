/**
 * islands.js — CRUD das ilhas
 * Actualizado para async/await.
 */

let pendingDeleteId = null;

// ── RENDERIZAÇÃO ───────────────────────────────

async function renderIslands() {
  const container = document.getElementById('islands-list');
  container.innerHTML = '<p style="color:var(--gray-500);padding:2rem 0">A carregar...</p>';

  const islands = await Storage.getIslands();

  if (islands.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🏝️</span>
        <p>Ainda não tens nenhuma ilha.</p>
        <p>Clica em "+ Nova ilha" para começar!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = islands.map(island => `
    <div class="island-card">
      <div>
        <h3 class="island-name">${escapeHtml(island.name)}</h3>
        <p class="island-langs">
          ${escapeHtml(island.native_language)} → ${escapeHtml(island.target_language)}
        </p>
      </div>
      <div class="island-card-actions">
        <a href="island.html?id=${island.id}" class="btn btn-primary btn-sm">Ver frases</a>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${island.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${island.id}')">Eliminar</button>
      </div>
    </div>
  `).join('');
}

// ── MODAIS ─────────────────────────────────────

function openCreateModal() {
  document.getElementById('modal-title').textContent = 'Nova ilha';
  document.getElementById('island-id').value         = '';
  document.getElementById('island-name').value       = '';
  document.getElementById('native-lang').value       = '';
  document.getElementById('target-lang').value       = '';
  openModal('island-modal');
}

async function openEditModal(id) {
  const islands = await Storage.getIslands();
  const island  = islands.find(i => i.id === id);
  if (!island) return;

  document.getElementById('modal-title').textContent = 'Editar ilha';
  document.getElementById('island-id').value         = island.id;
  document.getElementById('island-name').value       = island.name;
  document.getElementById('native-lang').value       = island.native_language;
  document.getElementById('target-lang').value       = island.target_language;
  openModal('island-modal');
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  openModal('delete-modal');
}

async function confirmDeleteIsland() {
  if (!pendingDeleteId) return;
  try {
    await Storage.deleteIsland(pendingDeleteId);
    pendingDeleteId = null;
    closeModal('delete-modal');
    await renderIslands();
  } catch (e) {
    alert('Erro ao eliminar: ' + e.message);
  }
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── FORMULÁRIO ─────────────────────────────────

async function submitIslandForm(event) {
  event.preventDefault();

  const submitBtn = event.target.querySelector('[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'A guardar...';

  const id = document.getElementById('island-id').value;

  const island = {
    // crypto.randomUUID() gera um UUID real (ex: "550e8400-e29b-41d4-...")
    // que é o formato que o Supabase espera para colunas uuid
    id:              id || crypto.randomUUID(),
    name:            document.getElementById('island-name').value.trim(),
    native_language: document.getElementById('native-lang').value.trim(),
    target_language: document.getElementById('target-lang').value.trim()
  };

  try {
    await Storage.saveIsland(island);
    closeModal('island-modal');
    await renderIslands();
  } catch (e) {
    alert('Erro ao guardar: ' + e.message);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Guardar';
  }
}

// ── UTILITÁRIOS ────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── INICIALIZAÇÃO ──────────────────────────────

renderIslands().catch(err => {
  console.error(err);
  document.getElementById('islands-list').innerHTML =
    '<p style="color:red;padding:2rem 0">Erro ao ligar ao Supabase. Verifica o config.js.</p>';
});