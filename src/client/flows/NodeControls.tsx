import { useState } from 'react';
import type { FlowNode } from '../../shared/flow-types';
import type { FlowCardData } from './helpers';
import { t } from '../i18n';

const busy = (node: FlowNode) => ['queued', 'running'].includes(node.status);
const swatches = (settings: Record<string, unknown>) => {
  const colors = settings.colors;
  return colors && typeof colors === 'object' ? Object.entries(colors as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && /^#[0-9a-f]{3,8}$/i.test(entry[1])) : [];
};

/** Brand card: add a brand file (upload or fill in), pick one from the shared library, see what it holds. */
export function BrandControls({ data }: { data: FlowCardData }) {
  const { node, brands = [], pending, setConfig, brandFiles, openBrand } = data;
  const [adding, setAdding] = useState(false);
  const brandId = String(node.config.brandId ?? ''), brand = brands.find(b => b.id === brandId);
  const disabled = pending || busy(node);
  const handle = typeof brand?.settings.handle === 'string' ? brand.settings.handle : '';
  return <div className="flow-node-controls nodrag nopan nowheel">
    <button type="button" aria-expanded={adding} disabled={disabled} onClick={() => setAdding(value => !value)}>{t('+ Добавить файл')}</button>
    {adding && <div className="flow-add-file">
      <label className="flow-file-button">{t('Загрузить файлы')}<input type="file" multiple accept=".md,.markdown,.txt,.json" disabled={disabled}
        onChange={event => { const files = [...event.currentTarget.files ?? []]; event.currentTarget.value = ''; if (files.length) { setAdding(false); brandFiles?.(node.id, files); } }} /></label>
      <button type="button" disabled={disabled} onClick={() => { setAdding(false); openBrand?.(node.id); }}>{t('Заполнить в приложении')}</button>
      <p>{t('Брендбук .md и brand.json, как в папке проекта.')}</p>
    </div>}
    <label>{t('Выбрать бренд')}<select value={brand ? brandId : ''} disabled={disabled} onChange={e => setConfig?.(node.id, { brandId: e.target.value })}>
      <option value="">{brands.length ? t('Не выбран') : t('Библиотека пуста')}</option>
      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select></label>
    {brandId && !brand && <p className="flow-node-error">{t('Выбранный бренд удалён из библиотеки.')}</p>}
    {brand && <div className="flow-brand-summary">
      <strong>{brand.name}</strong>{handle && <span>{handle}</span>}
      {swatches(brand.settings).length > 0 && <span className="flow-swatches" aria-label={t('Цвета бренда')}>
        {swatches(brand.settings).map(([key, color]) => <i key={key} title={`${key} ${color}`} style={{ background: color }} />)}</span>}
      <span className="flow-muted">{brand.guide ? t('Брендбук: {n} слов', { n: brand.guide.split(/\s+/).filter(Boolean).length }) : t('Без брендбука')}</span>
      <button type="button" disabled={disabled} onClick={() => openBrand?.(node.id, brand.id)}>{t('Изменить')}</button>
    </div>}
  </div>;
}

/** Project card: pick a content project; a run creates reels/<flow name>/ there for every approved output. */
export function ProjectControls({ data }: { data: FlowCardData }) {
  const { node, projects = [], pending, setConfig } = data;
  const project = String(node.config.project ?? '');
  const path = (node.output?.project?.value as { project?: string; path?: string } | undefined);
  return <div className="flow-node-controls nodrag nopan nowheel">
    <label>{t('Проект')}<select value={project} disabled={pending || busy(node)} onChange={e => setConfig?.(node.id, { project: e.target.value })}>
      <option value="">{projects.length ? t('Не выбран') : t('Папки проектов не найдены')}</option>
      {projects.map(name => <option key={name} value={name}>{name}</option>)}
      {project && !projects.includes(project) && <option value={project} disabled>{project} · {t('недоступно')}</option>}
    </select></label>
    {!projects.length && <p className="flow-muted">{t('Укажите CONTENT_PROJECTS_DIR в .env и перезапустите сервер.')}</p>}
    {path?.path && <p className="flow-muted">{t('Файлы сохраняются в {path}', { path: `${path.project}/${path.path}` })}</p>}
  </div>;
}
