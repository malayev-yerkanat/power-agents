import { useEffect, useRef, useState } from 'react';
import type { Brand, BrandInput } from '../../shared/flow-types';
import { t } from '../i18n';

type Settings = Record<string, unknown>;
const colorKeys = [['accent', 'Акцент'], ['background', 'Фон'], ['ink', 'Обводка'], ['text', 'Текст субтитров']] as const;
const defaults = { accent: '#2468ed', background: '#fffdf5', ink: '#173973', text: '#ffffff' };
const object = (value: unknown): Settings => value && typeof value === 'object' && !Array.isArray(value) ? value as Settings : {};
const hex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

/** Creates or edits a library brand. Fields map onto brand.json; settings without a field here are kept as they are. */
export function BrandEditor({ brand, close, save, remove }: {
  brand?: Brand; close: () => void; save: (input: BrandInput) => Promise<boolean>; remove?: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const settings = object(brand?.settings), colors = object(settings.colors), font = object(settings.font), captions = object(settings.captions);
  const [name, setName] = useState(brand?.name ?? '');
  const [handle, setHandle] = useState(typeof settings.handle === 'string' ? settings.handle : '');
  const [palette, setPalette] = useState(Object.fromEntries(colorKeys.map(([key]) => [key, hex(colors[key], defaults[key])])) as Record<keyof typeof defaults, string>);
  const [family, setFamily] = useState(typeof font.family === 'string' ? font.family : '');
  const [words, setWords] = useState(typeof captions.wordsPerGroup === 'number' ? captions.wordsPerGroup : 3);
  const [uppercase, setUppercase] = useState(captions.uppercase !== false);
  const [guide, setGuide] = useState(brand?.guide ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit() {
    setBusy(true);
    try {
      const next: Settings = { ...settings, name: name.trim(), ...(handle.trim() ? { handle: handle.trim() } : {}),
        colors: { ...colors, ...palette }, ...(family.trim() ? { font: { ...font, family: family.trim() } } : {}),
        captions: { ...captions, wordsPerGroup: words, uppercase } };
      if (!handle.trim()) delete next.handle;
      if (await save({ name: name.trim(), guide, settings: next })) close();
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="flow-reject flow-brand-editor" onCancel={close} aria-labelledby="flow-brand-title">
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h2 id="flow-brand-title">{brand ? t('Изменить бренд') : t('Новый бренд')}</h2>
      <label>{t('Название')}<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
      <label>{t('Аккаунт')}<input maxLength={120} value={handle} placeholder="@handle" onChange={e => setHandle(e.target.value)} /></label>
      <fieldset className="flow-brand-colors"><legend>{t('Цвета')}</legend>
        {colorKeys.map(([key, label]) => <label key={key}><input type="color" value={palette[key]}
          onChange={e => setPalette(current => ({ ...current, [key]: e.target.value }))} />{t(label)}</label>)}
      </fieldset>
      <label>{t('Шрифт')}<input maxLength={120} value={family} placeholder="Luckiest Guy" onChange={e => setFamily(e.target.value)} /></label>
      <div className="flow-brand-row">
        <label>{t('Слов в субтитре')}<input type="number" min={1} max={8} required value={words} onChange={e => setWords(Number(e.target.value))} /></label>
        <label className="flow-checkbox"><input type="checkbox" checked={uppercase} onChange={e => setUppercase(e.target.checked)} />{t('Заглавные буквы')}</label>
      </div>
      <label>{t('Брендбук')}<textarea rows={10} maxLength={40_000} value={guide} placeholder={t('Голос, правила текста, визуальный стиль…')} onChange={e => setGuide(e.target.value)} /></label>
      <div className="flow-reject-actions">
        <button className="primary-button" type="submit" disabled={busy || !name.trim()}>{t('Сохранить')}</button>
        <button className="secondary-button" type="button" onClick={close}>{t('Отмена')}</button>
        {remove && <button className="flow-danger-button" type="button" disabled={busy}
          onClick={async () => { if (confirm(t('Удалить бренд «{name}» из библиотеки?', { name: brand?.name ?? '' }))) { setBusy(true); try { if (await remove()) close(); } finally { setBusy(false); } } }}>{t('Удалить')}</button>}
      </div>
    </form>
  </dialog>;
}
