// src/services/translator.js
import axios from 'axios';

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.onrender.com/translate';
const MAX_CHARS = 800;

export async function translateText(text, sourceLang, targetLang) {
  if (text.length > MAX_CHARS) {
    throw new Error(`Mensagem muito longa (máx ${MAX_CHARS} caracteres).`);
  }
  if (sourceLang === targetLang) return text;

  try {
    const response = await axios.post(LIBRETRANSLATE_URL, {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text'
    }, { timeout: 15000 });
    return response.data.translatedText;
  } catch (error) {
    console.error('[Translator] Erro:', error.message);
    return null;
  }
}
