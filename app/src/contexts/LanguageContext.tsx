import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { SupportedLanguage } from '../types/scenario';

interface LanguageContextValue {
  lang: SupportedLanguage;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ja',
  toggleLanguage: () => {},
});

/** アプリ全体の表示言語。各画面は props で受け取らず useLanguage() で参照する */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<SupportedLanguage>('ja');
  const toggleLanguage = useCallback(() => {
    setLang((prev) => (prev === 'ja' ? 'en' : 'ja'));
  }, []);
  const value = useMemo(() => ({ lang, toggleLanguage }), [lang, toggleLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
