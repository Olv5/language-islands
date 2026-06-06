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
    // Extrai só a extensão (mp3, ogg, wav...)
    const rawExt = file.name.split('.').pop().toLowerCase();

    // Remove qualquer caracter inválido da extensão
    const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'mp3';

    // O caminho usa apenas o UUID — nunca o nome original do ficheiro
    // Assim evitamos completamente o problema de nomes inválidos
    const path = `audio_${phraseId}.${ext}`;

    const { error } = await supabase.storage
      .from('audio')
      .upload(path, file, {
        upsert:      true,
        contentType: file.type || 'audio/mpeg'
      });

    if (error) throw error;

    const { data } = supabase.storage.from('audio').getPublicUrl(path);
    return data.publicUrl;
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