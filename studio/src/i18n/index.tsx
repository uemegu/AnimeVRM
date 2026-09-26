import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { ja, type Dictionary } from './ja';

export type Language = 'ja' | 'en';

const STORAGE_KEY = 'studio_language';
const DICTIONARIES: Record<Language, Dictionary> = { ja, en };

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') return saved;
  } catch {
    // 保存できない環境では既定の日本語
  }
  return 'ja';
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const value = useMemo(
    () => ({
      language,
      t: DICTIONARIES[language],
      setLanguage: (next: Language) => {
        setLanguageState(next);
        document.documentElement.lang = next;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // 保存できなくても切り替えは効く
        }
      },
    }),
    [language]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('LanguageProvider の外で useI18n が呼ばれました');
  return value;
}

/** '{count} 件' のような文字列に値を入れる */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}
