import { Language, Translations } from './types';
import { ja } from './locales/ja';
import { en } from './locales/en';

const STORAGE_KEY = 'animevrm_language';

const dictionaries: Record<Language, Translations> = {
  ja,
  en,
};

let currentLanguage: Language = 'ja';
const listeners: Set<(lang: Language) => void> = new Set();

// Initialize language from localStorage or navigator
function initLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }

  // Fallback to browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('ja')) {
      return 'ja';
    }
    return 'en';
  }

  return 'ja';
}

currentLanguage = initLanguage();

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
  document.documentElement.lang = lang;
  listeners.forEach((callback) => callback(lang));
}

export function onLanguageChange(callback: (lang: Language) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getTranslations(lang: Language = currentLanguage): Translations {
  return dictionaries[lang] || dictionaries.ja;
}

export const t = (): Translations => {
  return dictionaries[currentLanguage] || dictionaries.ja;
};

export * from './types';
