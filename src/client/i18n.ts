import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { en } from './i18n-en';

export type Language = 'ru' | 'en';
const STORAGE_KEY = 'power-agents.language';

function stored(): Language {
  try { return globalThis.localStorage?.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ru'; } catch { return 'ru'; }
}

let current: Language = stored();

export const language = () => current;
export const locale = () => current === 'en' ? 'en-US' : 'ru-RU';

// Russian source text is the key; English comes from the dictionary and falls back to Russian.
export function t(text: string, vars?: Record<string, string | number>): string {
  const template = current === 'en' && Object.hasOwn(en, text) ? en[text] : text;
  return vars ? template.replace(/\{(\w+)\}/g, (match: string, name: string) => Object.hasOwn(vars, name) ? String(vars[name]) : match) : template;
}

export function setLanguage(next: Language) {
  current = next;
  try { globalThis.localStorage?.setItem(STORAGE_KEY, next); } catch { /* storage unavailable: keep for this page only */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

const LanguageContext = createContext<{ language: Language; setLanguage: (next: Language) => void }>({ language: current, setLanguage });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(current);
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  const change = (next: Language) => { setLanguage(next); setValue(next); };
  return createElement(LanguageContext.Provider, { value: { language: value, setLanguage: change } }, children);
}

// Memoized components (React Flow nodes) call this so they re-render on a language switch.
export const useLanguage = () => useContext(LanguageContext);

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language: active, setLanguage: change } = useLanguage();
  const next: Language = active === 'ru' ? 'en' : 'ru';
  return createElement('button', {
    type: 'button', className: `language-toggle ${className}`.trim(), onClick: () => change(next),
    'aria-label': active === 'ru' ? 'Switch to English' : 'Переключить на русский', title: active === 'ru' ? 'English' : 'Русский',
  }, createElement('span', { className: active === 'en' ? 'is-active' : '' }, 'EN'), createElement('span', { 'aria-hidden': true }, '/'), createElement('span', { className: active === 'ru' ? 'is-active' : '' }, 'RU'));
}
