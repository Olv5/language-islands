/**
 * storage.js — Camada de dados
 *
 * Todas as operações são agora async porque o Supabase
 * comunica com um servidor remoto — precisamos de esperar
 * pela resposta antes de continuar.
 *
 * As definições continuam no localStorage porque são
 * preferências locais do utilizador, não dados da app.
 */

const Storage = {

  // ── ILHAS ──────────────────────────────────────

  async getIslands() {
    const { data, error } = await supabase
      .from('islands')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveIsland(island) {
    // upsert = insert se não existir, update se existir (baseado no id)
    const { error } = await supabase.from('islands').upsert(island);
    if (error) throw error;
  },

  async deleteIsland(id) {
    const { error } = await supabase.from('islands').delete().eq('id', id);
    if (error) throw error;
    // O ON DELETE CASCADE na BD elimina as frases automaticamente
  },

  // ── FRASES ─────────────────────────────────────

  async getPhrases(islandId) {
    const { data, error } = await supabase
      .from('phrases')
      .select('*')
      .eq('island_id', islandId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async savePhrase(phrase) {
    const { error } = await supabase.from('phrases').upsert(phrase);
    if (error) throw error;
  },

  async deletePhrase(id) {
    const { error } = await supabase.from('phrases').delete().eq('id', id);
    if (error) throw error;
  },

  // ── ÁUDIO ──────────────────────────────────────

  async uploadAudio(file, phraseId) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `${phraseId}.${ext}`;

    // Faz upload do ficheiro para o bucket "audio" no Supabase Storage
    const { error } = await supabase.storage
      .from('audio')
      .upload(path, file, { upsert: true });
    if (error) throw error;

    // Devolve o URL público permanente do ficheiro
    const { data } = supabase.storage.from('audio').getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteAudio(audioUrl) {
    try {
      // Extrai apenas o caminho do ficheiro a partir do URL completo
      // Ex: ".../object/public/audio/abc.mp3" → "abc.mp3"
      const marker = '/object/public/audio/';
      const idx    = audioUrl.indexOf(marker);
      if (idx < 0) return;
      const path = audioUrl.slice(idx + marker.length);
      await supabase.storage.from('audio').remove([path]);
    } catch (e) {
      console.error('Erro ao eliminar áudio:', e);
    }
  },

  // ── DEFINIÇÕES (localStorage) ──────────────────

  getSettings() {
    const defaults = { repetitions: 2, pauseBetweenReps: 1, pauseBetweenPhrases: 2 };
    const raw = localStorage.getItem('li_settings');
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  },

  saveSettings(settings) {
    localStorage.setItem('li_settings', JSON.stringify(settings));
  }
};