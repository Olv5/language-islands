/**
 * storage.js — Camada de dados (Supabase)
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
    const { error } = await supabase.from('islands').upsert(island);
    if (error) throw error;
  },

  async deleteIsland(id) {
    const { error } = await supabase.from('islands').delete().eq('id', id);
    if (error) throw error;
  },

  // ── FRASES ─────────────────────────────────────

  async getPhrases(islandId) {
    const { data, error } = await supabase
      .from('phrases')
      .select('*')
      .eq('island_id', islandId)
      .order('mastered',   { ascending: true })
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

  async updatePhrase(id, fields) {
    const { error } = await supabase.from('phrases').update(fields).eq('id', id);
    if (error) throw error;
  },

  // ── ÁUDIO ──────────────────────────────────────

  async uploadAudio(file) {
    return new Promise((resolve, reject) => {
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(new Error('File too large. Maximum 2MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Error reading file.'));
      reader.readAsDataURL(file);
    });
  },

  async deleteAudio(audioUrl) {
    // Base64 is stored in the DB — nothing to delete externally
    return;
  },

  // ── VOCABULARY SETS ────────────────────────────

  async getVocabSets() {
    const { data, error } = await supabase
      .from('vocabulary_sets')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveVocabSet(set) {
    const { error } = await supabase.from('vocabulary_sets').upsert(set);
    if (error) throw error;
  },

  async deleteVocabSet(id) {
    const { error } = await supabase.from('vocabulary_sets').delete().eq('id', id);
    if (error) throw error;
  },

  // ── PALAVRAS ───────────────────────────────────

  async getWords(setId) {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('set_id', setId)
      .order('mastered',   { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async saveWord(word) {
    const { error } = await supabase.from('words').upsert(word);
    if (error) throw error;
  },

  async deleteWord(id) {
    const { error } = await supabase.from('words').delete().eq('id', id);
    if (error) throw error;
  },

  async updateWord(id, fields) {
    const { error } = await supabase.from('words').update(fields).eq('id', id);
    if (error) throw error;
  },

  // ── DEFINIÇÕES ─────────────────────────────────

  getSettings() {
    const defaults = { repetitions: 2, pauseBetweenReps: 1, pauseBetweenPhrases: 2 };
    const raw = localStorage.getItem('li_settings');
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  },

  saveSettings(settings) {
    localStorage.setItem('li_settings', JSON.stringify(settings));
  }
};
