import { useCallback, useEffect, useRef, useState } from 'react';
import type { Brand, BrandInput } from '../../shared/flow-types';
import type { Request } from './useFlow';
import { t } from '../i18n';

export interface BrandFile { name: string; text: string }
const guideHeading = /^#\s+(.+?)\s*$/m;

/** Builds a brand from a brand guide (.md/.txt), a brand.json, or both; brand.json's name wins over the guide heading. */
export function parseBrandFiles(files: BrandFile[]): BrandInput {
  let settings: Record<string, unknown> = {}, guide = '', heading = '';
  for (const file of files) {
    if (/\.json$/i.test(file.name)) {
      let value: unknown;
      try { value = JSON.parse(file.text); } catch { throw new Error(t('Файл {name} не является корректным JSON.', { name: file.name })); }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('Файл {name} должен содержать JSON-объект.', { name: file.name }));
      settings = { ...settings, ...value as Record<string, unknown> };
    } else if (/\.(md|markdown|txt)$/i.test(file.name)) {
      guide = guide ? `${guide}\n\n${file.text}` : file.text;
      heading ||= guideHeading.exec(file.text)?.[1].replace(/\s*[:\-–—]\s*brand guide$/i, '') ?? '';
    } else throw new Error(t('Файл {name}: выберите .md, .txt или .json.', { name: file.name }));
  }
  const fallback = files[0]?.name.replace(/\.[^.]+$/, '') ?? '';
  const name = (typeof settings.name === 'string' && settings.name.trim()) || heading.trim() || fallback;
  if (!name) throw new Error(t('Выберите файл бренда.'));
  return { name: name.slice(0, 120), guide, settings };
}

/** The shared brand library behind every Brand node. */
export function useBrands(request: Request, csrfToken: string) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const data = await request<{ brands: Brand[] }>('/api/flows/brands');
    if (mounted.current) setBrands(data.brands);
  }, [request]);
  useEffect(() => { mounted.current = true; void refresh().catch(() => {}); return () => { mounted.current = false; }; }, [refresh]);
  const send = useCallback(async <T,>(path: string, method: string, body?: unknown) => {
    const result = await request<T>(path, { method, headers: { 'X-CSRF-Token': csrfToken,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    await refresh();
    return result;
  }, [request, csrfToken, refresh]);
  const save = useCallback(async (input: BrandInput, id?: string) => (await send<{ brand: Brand }>(
    id ? `/api/flows/brands/${encodeURIComponent(id)}` : '/api/flows/brands', id ? 'PUT' : 'POST', input)).brand, [send]);
  const remove = useCallback(async (id: string) => { await send(`/api/flows/brands/${encodeURIComponent(id)}`, 'DELETE'); }, [send]);
  return { brands, save, remove };
}
