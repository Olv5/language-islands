/**
 * islands.js — CRUD das ilhas
 */

let pendingDeleteId = null;

async function renderIslands() {
  const container = document.getElementById('islands-list');
  container.innerHTML = '<p style="color:var(--gray-500);padding:2rem 0">Loading...</p>';

  const islands = await Storage.getIslands();

  if (islands.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🏝️</span>
        <p>No islands yet.</p>
        <p>Click "+ New Island" to get started!</p>
      </div>
    `;
    return;
  }

  const { data: allPhrases } = await supabase
    .from('phrases')
    .select('island_id, mastered')
    .in('island_id', islands.map(i => i.id));

  const countMap = {};
  (allPhrases || []).forEach(p => {
    if (!countMap[p.island_id]) countMap[p.island_id] = { total: 0, mastered: 0 };
    countMap[p.island_id].total++;
    if (p.mastered) countMap[p.island_id].mastered++;
  });

  container.innerHTML = islands.map(island => {
    const counts  = countMap[island.id] || { total: 0, mastered: 0 };
    const hasPlay = counts.total > 0;

    return `
      <div class="island-card">
        <div class="island-card-top">
          <div class="island-card-left">
            <div class="island-card-icon island-icon-purple">🏝️</div>
            <div>
              <div class="island-name">${escapeHtml(island.name)}</div>
              <div class="island-langs">${escapeHtml(island.native_language)} → ${escapeHtml(island.target_language)}</div>
            </div>
          </div>
          <div class="island-stats">
            <span class="stat-badge">${counts.total} phrase${counts.total !== 1 ? 's' : ''}</span>
            ${counts.mastered > 0
              ? `<span class="stat-badge stat-mastered">${counts.mastered} mastered</span>`
              : ''}
          </div>
        </div>
        <div class="island-card-actions">
          ${hasPlay ? `<a href="island.html?id=${island.id}" class="btn btn-primary btn-sm">▶ Play</a>` : ''}
          <a href="island.html?id=${island.id}" class="btn btn-secondary btn-sm">View phrases</a>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${island.id}')">Edit</button>
          <button class="btn btn-danger btn-sm"    onclick="openDeleteModal('${island.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── MODAIS ─────────────────────────────────────

function openCreateModal() {
  document.getElementById('modal-title').textContent = 'New Island';
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

  document.getElementById('modal-title').textContent = 'Edit Island';
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
    alert('Error deleting: ' + e.message);
  }
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── FORMULÁRIO ─────────────────────────────────

async function submitIslandForm(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const id = document.getElementById('island-id').value;

  const island = {
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
    alert('Error saving: ' + e.message);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Save';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── ARRANQUE ───────────────────────────────────

renderSidebar('islands');
renderIslands().catch(err => {
  console.error(err);
  document.getElementById('islands-list').innerHTML =
    '<p style="color:red;padding:2rem 0">Error connecting to Supabase. Check config.js.</p>';
});
