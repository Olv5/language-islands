/**
 * vocabulary.js — CRUD dos conjuntos de vocabulário
 */

let pendingDeleteId = null;

async function renderVocabSets() {
  const container = document.getElementById('vocab-list');
  container.innerHTML = '<p style="color:var(--gray-500);padding:2rem 0">Loading...</p>';

  const sets = await Storage.getVocabSets();

  if (sets.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">📚</span>
        <p>No vocabulary sets yet.</p>
        <p>Click "+ New Set" to get started!</p>
      </div>
    `;
    return;
  }

  // Conta palavras por set
  const { data: allWords } = await supabase
    .from('words')
    .select('set_id, mastered')
    .in('set_id', sets.map(s => s.id));

  const countMap = {};
  (allWords || []).forEach(w => {
    if (!countMap[w.set_id]) countMap[w.set_id] = { total: 0, mastered: 0 };
    countMap[w.set_id].total++;
    if (w.mastered) countMap[w.set_id].mastered++;
  });

  container.innerHTML = sets.map(set => {
    const counts = countMap[set.id] || { total: 0, mastered: 0 };
    return `
      <div class="island-card">
        <div class="island-card-top">
          <div class="island-card-left">
            <div class="island-card-icon island-icon-teal">📚</div>
            <div>
              <div class="island-name">${escapeHtml(set.name)}</div>
              <div class="island-langs">${escapeHtml(set.native_language)} → ${escapeHtml(set.target_language)}</div>
            </div>
          </div>
          <div class="island-stats">
            <span class="stat-badge">${counts.total} word${counts.total !== 1 ? 's' : ''}</span>
            ${counts.mastered > 0
              ? `<span class="stat-badge stat-mastered">${counts.mastered} mastered</span>`
              : ''}
          </div>
        </div>
        <div class="island-card-actions">
          <a href="set.html?id=${set.id}" class="btn btn-primary btn-sm">View words</a>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${set.id}')">Edit</button>
          <button class="btn btn-danger btn-sm"    onclick="openDeleteModal('${set.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── MODAIS ─────────────────────────────────────

function openCreateModal() {
  document.getElementById('modal-title').textContent = 'New Set';
  document.getElementById('set-id').value            = '';
  document.getElementById('set-name').value          = '';
  document.getElementById('native-lang').value       = '';
  document.getElementById('target-lang').value       = '';
  openModal('set-modal');
}

async function openEditModal(id) {
  const sets = await Storage.getVocabSets();
  const set  = sets.find(s => s.id === id);
  if (!set) return;

  document.getElementById('modal-title').textContent = 'Edit Set';
  document.getElementById('set-id').value            = set.id;
  document.getElementById('set-name').value          = set.name;
  document.getElementById('native-lang').value       = set.native_language;
  document.getElementById('target-lang').value       = set.target_language;
  openModal('set-modal');
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  openModal('delete-modal');
}

async function confirmDeleteSet() {
  if (!pendingDeleteId) return;
  try {
    await Storage.deleteVocabSet(pendingDeleteId);
    pendingDeleteId = null;
    closeModal('delete-modal');
    await renderVocabSets();
  } catch (e) {
    alert('Error deleting: ' + e.message);
  }
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── FORMULÁRIO ─────────────────────────────────

async function submitSetForm(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving...';

  const id = document.getElementById('set-id').value;

  const set = {
    id:              id || crypto.randomUUID(),
    name:            document.getElementById('set-name').value.trim(),
    native_language: document.getElementById('native-lang').value.trim(),
    target_language: document.getElementById('target-lang').value.trim()
  };

  try {
    await Storage.saveVocabSet(set);
    closeModal('set-modal');
    await renderVocabSets();
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

renderSidebar('vocabulary');
renderVocabSets().catch(err => {
  console.error(err);
  document.getElementById('vocab-list').innerHTML =
    '<p style="color:red;padding:2rem 0">Error connecting to Supabase. Check config.js.</p>';
});
