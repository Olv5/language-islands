/**
 * sidebar.js — Sidebar partilhada entre todas as páginas
 * Chamada em cada página com renderSidebar('nome-da-pagina')
 */
function renderSidebar(activePage) {
  const el = document.getElementById('sidebar');
  if (!el) return;

  el.innerHTML = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">🏝️</div>
      <div>
        <div class="sidebar-logo-text">Language Islands</div>
        <div class="sidebar-logo-sub">Language Learning</div>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">Main</div>
      <a href="index.html" class="sidebar-link ${activePage === 'home' ? 'active' : ''}">
        <span class="sidebar-link-icon">🏠</span> Home
      </a>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-label">Learn</div>
      <a href="islands.html" class="sidebar-link ${activePage === 'islands' ? 'active' : ''}">
        <span class="sidebar-link-icon">🏝️</span> Islands
      </a>
      <a href="vocabulary.html" class="sidebar-link ${activePage === 'vocabulary' ? 'active' : ''}">
        <span class="sidebar-link-icon">📚</span> Vocabulary
      </a>
    </div>
  `;
}

// Botão de menu mobile
function toggleMobileSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
