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
    .order('mastered',    { ascending: true })
    .order('sort_order',  { ascending: true });
  if (error) throw error;
  return data || [];
},

  async savePhrase(phrase) {
    const { error } = await supabase.from('phrases').upsert(phrase);
    if (error) throw error;
  },

  async updatePhrase(id, fields) {
  const { error } = await supabase
    .from('phrases')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
},

  async deletePhrase(id) {
    const { error } = await supabase.from('phrases').delete().eq('id', id);
    if (error) throw error;
  },

  // ── ÁUDIO ──────────────────────────────────────

async uploadAudio(file) {
  // Converte o ficheiro para base64 — igual ao que fazíamos com localStorage
  return new Promise((resolve, reject) => {
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('Ficheiro demasiado grande. Máximo 2MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erro ao ler o ficheiro.'));
    reader.readAsDataURL(file);
  });
},

async deleteAudio(audioUrl) {
  // Base64 fica na BD — ao apagar a frase o áudio desaparece automaticamente
  // Não há nada para fazer aqui
  return;
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