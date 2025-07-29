import { useState, useEffect, ReactNode } from 'react';
import { I18nContext, Language, getTranslations } from '@/lib/i18n';

interface I18nProviderProps {
  children: ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguage] = useState<Language>(() => {
    // Get saved language from localStorage or default to English
    const saved = localStorage.getItem('videolm-language');
    return (saved as Language) || 'en';
  });

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('videolm-language', language);
  }, [language]);

  const translations = getTranslations(language);

  const value = {
    language,
    setLanguage,
    t: translations,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}