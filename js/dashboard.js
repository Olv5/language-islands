/**
 * dashboard.js — Página inicial
 * Carrega stats globais e ilhas recentes
 */

async function loadDashboard() {
  try {
    const islands = await Storage.getIslands();

    // Uma query busca tudo de uma vez
    const { data: allPhrases } = await supabase
      .from('phrases')
      .select('island_id, mastered');

    const phrases  = allPhrases || [];
    const mastered = phrases.filter(p => p.mastered).length;

    // Stats
    document.getElementById('stat-islands').textContent  = islands.length;
    document.getElementById('stat-phrases').textContent  = phrases.length;
    document.getElementById('stat-mastered').textContent = mastered;

    // Ilhas recentes (últimas 3)
    const recent    = islands.slice(-3).reverse();
    const container = document.getElementById('recent-islands');

    if (recent.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="icon">🏝️</span>
          <p>No islands yet.</p>
          <a href="islands.html" class="btn btn-primary" style="margin-top:1rem">Create your first island</a>
        </div>
      `;
      return;
    }

    // Conta frases por ilha
    const countMap = {};
    phrases.forEach(p => {
      if (!countMap[p.island_id]) countMap[p.island_id] = { total: 0, mastered: 0 };
      countMap[p.island_id].total++;
      if (p.mastered) countMap[p.island_id].mastered++;
    });

    container.innerHTML = recent.map(island => {
      const counts = countMap[island.id] || { total: 0, mastered: 0 };
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
              ${counts.mastered > 0 ? `<span class="stat-badge stat-mastered">${counts.mastered} mastered</span>` : ''}
            </div>
          </div>
          <div class="island-card-actions">
            ${counts.total > 0 ? `<a href="island.html?id=${island.id}" class="btn btn-primary btn-sm">▶ Play</a>` : ''}
            <a href="island.html?id=${island.id}" class="btn btn-secondary btn-sm">View phrases</a>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

renderSidebar('home');
loadDashboard();
